import {
  BoundingBoxIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { VisionAnalysis, VisionPerson } from "@/vision"

import { VisionStat } from "./vision-stat"

export function VisionResultCard({
  result,
  reliablePeople,
}: {
  result: VisionAnalysis | null
  reliablePeople: VisionPerson[]
}) {
  const objects = result?.objectsResult?.values ?? []
  const tags = result?.tagsResult?.values.slice(0, 8) ?? []
  const imageWidth = result?.metadata.width ?? 0
  const imageHeight = result?.metadata.height ?? 0
  const stats = [
    ["Personnes", result ? String(reliablePeople.length) : "--"],
    ["Objets", result ? String(objects.length) : "--"],
    ["Largeur", result ? `${imageWidth}px` : "--"],
    ["Hauteur", result ? `${imageHeight}px` : "--"],
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resultat Azure Vision</CardTitle>
        <CardDescription>
          Detection cloud via `/api/vision/analyze`.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          {stats.map(([label, value]) => (
            <VisionStat key={label} label={label} value={value} />
          ))}
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
              Le diagnostic est bloque car MediaPipe n'analyse qu'une seule
              pose. Utilise une image avec une seule personne.
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
  )
}

function percent(value?: number) {
  if (!Number.isFinite(value)) {
    return "--"
  }

  return `${Math.round((value ?? 0) * 100)}%`
}
