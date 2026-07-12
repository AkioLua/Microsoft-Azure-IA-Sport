import * as React from "react"
import {
  ScanIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
  type VisionPerson,
} from "@/vision"

import { SquatDiagnosticCard } from "./squat-diagnostic-card"
import { VisionImageCard } from "./vision-image-card"
import { VisionResultCard } from "./vision-result-card"

const personConfidenceThreshold = 0.5

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

      const reliablePeopleCount = getReliablePeople(
        analysis.peopleResult?.values ?? []
      ).length
      const squatAssessment = assessSquat(
        detectedPose,
        image.naturalWidth,
        image.naturalHeight,
        reliablePeopleCount
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

  const reliablePeople = getReliablePeople(result?.peopleResult?.values ?? [])
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

      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <VisionImageCard
          inputRef={inputRef}
          imageRef={imageRef}
          canvasRef={canvasRef}
          file={file}
          previewUrl={previewUrl}
          result={result}
          pose={pose}
          assessment={assessment}
          pending={pending}
          dragging={dragging}
          reliablePeople={reliablePeople}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
          onAnalyze={handleAnalyze}
          onDraggingChange={setDragging}
          onSelectFile={selectFile}
        />

        <div className="flex flex-col gap-4">
          <VisionResultCard
            result={result}
            reliablePeople={reliablePeople}
          />
          <SquatDiagnosticCard assessment={assessment} pose={pose} />
        </div>
      </div>
    </section>
  )
}

function getReliablePeople(people: VisionPerson[]) {
  return people.filter(
    (person) => person.confidence >= personConfidenceThreshold
  )
}
