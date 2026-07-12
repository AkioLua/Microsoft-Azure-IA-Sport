import * as React from "react"
import { ImageIcon, ScanIcon, UploadSimpleIcon } from "@phosphor-icons/react"

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
  drawPoseOverlay,
  type PoseDetection,
} from "@/pose"
import {
  getSideLandmarkIndices,
  type SquatAssessment,
} from "@/posture"
import type { VisionAnalysis, VisionPerson } from "@/vision"
import { cn } from "@/lib/utils"

import { VisionBox } from "./vision-box"

type VisionImageCardProps = {
  inputRef: React.RefObject<HTMLInputElement | null>
  imageRef: React.RefObject<HTMLImageElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  file: File | null
  previewUrl: string | null
  result: VisionAnalysis | null
  pose: PoseDetection | null
  assessment: SquatAssessment | null
  pending: boolean
  dragging: boolean
  reliablePeople: VisionPerson[]
  imageWidth: number
  imageHeight: number
  onAnalyze: () => void
  onDraggingChange: (dragging: boolean) => void
  onSelectFile: (file?: File) => void
}

export function VisionImageCard({
  inputRef,
  imageRef,
  canvasRef,
  file,
  previewUrl,
  result,
  pose,
  assessment,
  pending,
  dragging,
  reliablePeople,
  imageWidth,
  imageHeight,
  onAnalyze,
  onDraggingChange,
  onSelectFile,
}: VisionImageCardProps) {
  return (
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
          onChange={(event) => onSelectFile(event.target.files?.[0])}
        />

        {previewUrl ? (
          <ImagePreview
            imageRef={imageRef}
            canvasRef={canvasRef}
            previewUrl={previewUrl}
            result={result}
            pose={pose}
            assessment={assessment}
            reliablePeople={reliablePeople}
            imageWidth={imageWidth}
            imageHeight={imageHeight}
          />
        ) : (
          <Dropzone
            dragging={dragging}
            onSelect={() => inputRef.current?.click()}
            onDraggingChange={onDraggingChange}
            onDrop={(file) => onSelectFile(file)}
          />
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
            <Button variant="outline" onClick={() => inputRef.current?.click()}>
              <ImageIcon data-icon="inline-start" />
              Changer
            </Button>
          ) : null}
          <Button onClick={onAnalyze} disabled={!file || pending}>
            <ScanIcon data-icon="inline-start" />
            {pending ? "Analyse..." : "Analyser la posture"}
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}

type ImagePreviewProps = {
  imageRef: React.RefObject<HTMLImageElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  previewUrl: string
  result: VisionAnalysis | null
  pose: PoseDetection | null
  assessment: SquatAssessment | null
  reliablePeople: VisionPerson[]
  imageWidth: number
  imageHeight: number
}

function ImagePreview({
  imageRef,
  canvasRef,
  previewUrl,
  result,
  pose,
  assessment,
  reliablePeople,
  imageWidth,
  imageHeight,
}: ImagePreviewProps) {
  return (
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
              assessment ? getSideLandmarkIndices(assessment.side) : []
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
  )
}

function Dropzone({
  dragging,
  onSelect,
  onDraggingChange,
  onDrop,
}: {
  dragging: boolean
  onSelect: () => void
  onDraggingChange: (dragging: boolean) => void
  onDrop: (file?: File) => void
}) {
  const dropzoneClassName = cn(
    "flex min-h-80 w-full flex-col items-center justify-center gap-4",
    "rounded-lg border border-dashed bg-muted/40 p-8 text-center",
    "transition-colors",
    dragging ? "border-foreground bg-muted" : "border-border"
  )

  return (
    <button
      type="button"
      className={dropzoneClassName}
      onClick={onSelect}
      onDragEnter={(event) => {
        event.preventDefault()
        onDraggingChange(true)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => onDraggingChange(false)}
      onDrop={(event) => {
        event.preventDefault()
        onDraggingChange(false)
        onDrop(event.dataTransfer.files[0])
      }}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-background ring-1 ring-border">
        <UploadSimpleIcon className="size-6" />
      </span>
      <span>
        <span className="block font-medium">Selectionner une photo</span>
        <span className="mt-1 block text-sm text-muted-foreground">
          JPEG, PNG, GIF, BMP ou WebP, 20 Mo maximum
        </span>
      </span>
    </button>
  )
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} Ko`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function percent(value?: number) {
  if (!Number.isFinite(value)) {
    return "--"
  }

  return `${Math.round((value ?? 0) * 100)}%`
}
