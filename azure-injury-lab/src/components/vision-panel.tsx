import * as React from "react"
import {
  BoundingBoxIcon,
  GaugeIcon,
  ImageIcon,
  ScanIcon,
  UploadSimpleIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  detectPose,
  drawPoseOverlay,
  type PoseDetection,
} from "@/pose"
import {
  assessSquat,
  getSideLandmarkIndices,
  type SquatAssessment,
} from "@/posture"
import {
  analyzeVisionImage,
  validateVisionImage,
  type VisionAnalysis,
  type VisionBoundingBox,
} from "@/vision"

export function VisionPanel() {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const imageRef = React.useRef<HTMLImageElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const analysisIdRef = React.useRef(0)
  const [file, setFile] = React.useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<VisionAnalysis | null>(null)
  const [pose, setPose] = React.useState<PoseDetection | null>(null)
  const [assessment, setAssessment] = React.useState<SquatAssessment | null>(
    null
  )
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [dragging, setDragging] = React.useState(false)

  React.useEffect(() => {
    return () => {
      analysisIdRef.current += 1
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  React.useEffect(() => {
    const image = imageRef.current
    const canvas = canvasRef.current

    if (!image || !canvas || !image.complete) {
      return
    }

    drawPoseOverlay(
      canvas,
      image,
      pose,
      assessment ? getSideLandmarkIndices(assessment.side) : []
    )
  }, [assessment, pose, previewUrl])

  function selectFile(nextFile?: File) {
    if (!nextFile) {
      return
    }

    const validationError = validateVisionImage(nextFile)

    if (validationError) {
      setError(validationError)
      toast.error("Image non valide", { description: validationError })
      return
    }

    analysisIdRef.current += 1
    setPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current)
      }
      return URL.createObjectURL(nextFile)
    })
    setFile(nextFile)
    setResult(null)
    setPose(null)
    setAssessment(null)
    setError(null)
    setPending(false)
  }

  async function handleAnalyze() {
    const image = imageRef.current

    if (!file || !image) {
      return
    }

    const analysisId = ++analysisIdRef.current
    setPending(true)
    setError(null)

    try {
      const [analysis, detectedPose] = await Promise.all([
        analyzeVisionImage(file),
        detectPose(image),
      ])

      if (analysisId !== analysisIdRef.current) {
        return
      }

      setResult(analysis)
      setPose(detectedPose)

      if (!detectedPose) {
        setAssessment(null)
        setError(
          "Azure a analyse l'image, mais MediaPipe n'a detecte aucune pose exploitable."
        )
        toast.warning("Pose non detectee", {
          description:
            "Utilise une photo de profil avec le corps entier visible.",
        })
        return
      }

      const squatAssessment = assessSquat(
        detectedPose,
        image.naturalWidth,
        image.naturalHeight,
        analysis.peopleResult?.values.filter(
          (person) => person.confidence >= 0.5
        ).length ?? 0
      )
      setAssessment(squatAssessment)
      const peopleCount = analysis.peopleResult?.values.length ?? 0
      toast.success("Analyse posture terminee", {
        description: `${peopleCount} personne${peopleCount > 1 ? "s" : ""} detectee${peopleCount > 1 ? "s" : ""} par Azure, pose calculee localement.`,
      })
    } catch (caught) {
      if (analysisId !== analysisIdRef.current) {
        return
      }

      const message =
        caught instanceof Error ? caught.message : "Erreur Azure Vision."
      setError(message)
      toast.error("Echec de l'analyse", { description: message })
    } finally {
      if (analysisId === analysisIdRef.current) {
        setPending(false)
      }
    }
  }

  const people = result?.peopleResult?.values ?? []
  const objects = result?.objectsResult?.values ?? []
  const tags = result?.tagsResult?.values.slice(0, 8) ?? []
  const reliablePeople = people.filter((person) => person.confidence >= 0.5)
  const imageWidth = result?.metadata.width ?? 0
  const imageHeight = result?.metadata.height ?? 0

  return (
    <section className="flex flex-col gap-4">
      <Alert>
        <ScanIcon />
        <AlertTitle>Analyse hybride cloud et locale</AlertTitle>
        <AlertDescription>
          Azure Vision detecte les personnes et les objets. MediaPipe calcule
          localement les articulations, les angles et les reperes du squat.
        </AlertDescription>
      </Alert>

      {error ? (
        <Alert variant="destructive">
          <WarningCircleIcon />
          <AlertTitle>Analyse impossible</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.6fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Photo du mouvement</CardTitle>
            <CardDescription>
              Une personne, corps entier visible, idealement de profil.
            </CardDescription>
            <CardAction>
              <Badge variant={result ? "secondary" : "outline"}>
                {result ? "Analyse terminee" : "Image requise"}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/bmp,image/webp"
              onChange={(event) => selectFile(event.target.files?.[0])}
            />

            {previewUrl ? (
              <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-lg border bg-muted">
                <img
                  ref={imageRef}
                  src={previewUrl}
                  alt="Mouvement a analyser"
                  className="block max-h-[65svh] max-w-full object-contain"
                  onLoad={() => {
                    if (canvasRef.current && imageRef.current) {
                      drawPoseOverlay(
                        canvasRef.current,
                        imageRef.current,
                        pose,
                        assessment
                          ? getSideLandmarkIndices(assessment.side)
                          : []
                      )
                    }
                  }}
                />
                <canvas
                  ref={canvasRef}
                  className="pointer-events-none absolute inset-0 z-10 size-full"
                  aria-hidden="true"
                />
                {result && imageWidth > 0 && imageHeight > 0
                  ? reliablePeople.map((person, index) => (
                      <VisionBox
                        key={`${person.boundingBox.x}-${person.boundingBox.y}-${index}`}
                        box={person.boundingBox}
                        imageWidth={imageWidth}
                        imageHeight={imageHeight}
                        label={`Personne ${index + 1} - ${percent(person.confidence)}`}
                      />
                    ))
                  : null}
              </div>
            ) : (
              <button
                type="button"
                className={`flex min-h-80 w-full flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-muted/40 p-8 text-center transition-colors ${
                  dragging ? "border-foreground bg-muted" : "border-border"
                }`}
                onClick={() => inputRef.current?.click()}
                onDragEnter={(event) => {
                  event.preventDefault()
                  setDragging(true)
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragging(false)
                  selectFile(event.dataTransfer.files[0])
                }}
              >
                <span className="flex size-12 items-center justify-center rounded-full bg-background ring-1 ring-border">
                  <UploadSimpleIcon className="size-6" />
                </span>
                <span>
                  <span className="block font-medium">
                    Selectionner une photo
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    JPEG, PNG, GIF, BMP ou WebP, 20 Mo maximum
                  </span>
                </span>
              </button>
            )}
          </CardContent>
          <CardFooter className="justify-between gap-3">
            <div className="min-w-0 text-sm text-muted-foreground">
              {file ? (
                <span className="block truncate">
                  {file.name} - {formatFileSize(file.size)}
                </span>
              ) : (
                "Aucune image selectionnee"
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              {file ? (
                <Button
                  variant="outline"
                  onClick={() => inputRef.current?.click()}
                >
                  <ImageIcon data-icon="inline-start" />
                  Changer
                </Button>
              ) : null}
              <Button onClick={handleAnalyze} disabled={!file || pending}>
                <ScanIcon data-icon="inline-start" />
                {pending ? "Analyse..." : "Analyser la posture"}
              </Button>
            </div>
          </CardFooter>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Resultat Azure Vision</CardTitle>
              <CardDescription>
                Detection cloud via `/api/vision/analyze`.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <VisionStat
                  label="Personnes"
                  value={result ? String(reliablePeople.length) : "--"}
                />
                <VisionStat
                  label="Objets"
                  value={result ? String(objects.length) : "--"}
                />
                <VisionStat
                  label="Largeur"
                  value={result ? `${imageWidth}px` : "--"}
                />
                <VisionStat
                  label="Hauteur"
                  value={result ? `${imageHeight}px` : "--"}
                />
              </div>

              {result && reliablePeople.length === 0 ? (
                <Alert variant="destructive">
                  <WarningCircleIcon />
                  <AlertTitle>Aucune personne fiable</AlertTitle>
                  <AlertDescription>
                    Choisis une photo plus nette avec le corps entier visible.
                  </AlertDescription>
                </Alert>
              ) : null}

              {result && reliablePeople.length > 1 ? (
                <Alert variant="destructive">
                  <WarningCircleIcon />
                  <AlertTitle>Plusieurs personnes detectees</AlertTitle>
                  <AlertDescription>
                    Le diagnostic est bloque car MediaPipe n'analyse qu'une
                    seule pose. Utilise une image avec une seule personne.
                  </AlertDescription>
                </Alert>
              ) : null}

              {tags.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <div className="text-sm font-medium">Tags principaux</div>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge key={tag.name} variant="outline">
                        {tag.name} {percent(tag.confidence)}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {!result ? (
                <Alert>
                  <BoundingBoxIcon />
                  <AlertTitle>En attente d'une image</AlertTitle>
                  <AlertDescription>
                    Les zones detectees seront dessinees sur la photo.
                  </AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Diagnostic du squat</CardTitle>
              <CardDescription>
                Mesures indicatives calculees localement par MediaPipe.
              </CardDescription>
              <CardAction>
                <Badge variant={assessmentVariant(assessment)}>
                  {assessment?.label ?? "En attente"}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <VisionStat
                  label="Cote analyse"
                  value={
                    assessment
                      ? assessment.side === "left"
                        ? "Gauche"
                        : "Droit"
                      : "--"
                  }
                />
                <VisionStat
                  label="Visibilite"
                  value={
                    assessment ? percent(assessment.visibility) : "--"
                  }
                />
                <VisionStat
                  label="Angle genou"
                  value={formatAngle(assessment?.kneeAngle)}
                />
                <VisionStat
                  label="Angle hanche"
                  value={formatAngle(assessment?.hipAngle)}
                />
                <VisionStat
                  label="Inclinaison torse"
                  value={formatAngle(assessment?.torsoInclination)}
                />
                <VisionStat
                  label="Execution"
                  value={pose ? "Locale" : "--"}
                />
              </div>

              {assessment ? (
                <div className="flex flex-col gap-2">
                  <div className="text-sm font-medium">
                    Observations automatiques
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {assessment.advice.map((advice) => (
                      <li className="flex gap-2" key={advice}>
                        <span
                          className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground"
                          aria-hidden="true"
                        />
                        <span>{advice}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <Alert>
                  <GaugeIcon />
                  <AlertTitle>Aucune mesure</AlertTitle>
                  <AlertDescription>
                    Lance l'analyse pour calculer les angles du cote le plus
                    visible.
                  </AlertDescription>
                </Alert>
              )}

              <p className="text-xs text-muted-foreground">
                Une photo 2D ne permet pas d'evaluer la trajectoire, l'equilibre,
                la charge, la position des genoux dans le plan frontal ni la
                neutralite de la colonne. Ces mesures ne constituent pas un
                diagnostic medical.
              </p>
            </CardContent>
          </Card>

          {result ? (
            <Card>
              <CardHeader>
                <CardTitle>Reponse technique</CardTitle>
                <CardDescription>
                  JSON renvoye par Azure, utile pour verifier l'integration.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="max-h-72 overflow-auto rounded-lg bg-muted p-4 text-xs">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function VisionBox({
  box,
  imageWidth,
  imageHeight,
  label,
}: {
  box: VisionBoundingBox
  imageWidth: number
  imageHeight: number
  label: string
}) {
  return (
    <div
      className="pointer-events-none absolute z-20 border-2 border-emerald-400 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
      style={{
        left: `${(box.x / imageWidth) * 100}%`,
        top: `${(box.y / imageHeight) * 100}%`,
        width: `${(box.w / imageWidth) * 100}%`,
        height: `${(box.h / imageHeight) * 100}%`,
      }}
    >
      <span className="absolute top-0 left-0 max-w-full translate-y-[-100%] truncate bg-emerald-500 px-1.5 py-1 text-xs font-medium text-white">
        {label}
      </span>
    </div>
  )
}

function VisionStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  )
}

function percent(value?: number) {
  if (!Number.isFinite(value)) {
    return "--"
  }

  return `${Math.round((value ?? 0) * 100)}%`
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} Ko`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function formatAngle(value?: number) {
  return Number.isFinite(value) ? `${Math.round(value ?? 0)} deg` : "--"
}

function assessmentVariant(assessment: SquatAssessment | null) {
  if (!assessment) {
    return "outline" as const
  }

  if (assessment.status === "correct") {
    return "secondary" as const
  }

  return assessment.status === "improve" ? "destructive" : "outline"
}
