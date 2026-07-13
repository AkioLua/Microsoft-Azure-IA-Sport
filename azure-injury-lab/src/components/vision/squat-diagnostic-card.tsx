import { GaugeIcon } from "@phosphor-icons/react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { PoseDetection } from "@/pose"
import type { SquatAssessment } from "@/posture"

import { VisionStat } from "./vision-stat"

export function SquatDiagnosticCard({
  assessment,
  pose,
}: {
  assessment: SquatAssessment | null
  pose: PoseDetection | null
}) {
  const stats = [
    ["Cote analyse", formatSide(assessment)],
    ["Visibilite", assessment ? percent(assessment.visibility) : "--"],
    ["Angle genou", formatAngle(assessment?.kneeAngle)],
    ["Angle hanche", formatAngle(assessment?.hipAngle)],
    ["Inclinaison torse", formatAngle(assessment?.torsoInclination)],
    ["Execution", pose ? "Locale" : "--"],
  ]

  return (
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
          {stats.map(([label, value]) => (
            <VisionStat key={label} label={label} value={value} />
          ))}
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
              Lance l'analyse pour calculer les angles du cote le plus visible.
            </AlertDescription>
          </Alert>
        )}

        <p className="text-xs text-muted-foreground">
          Une photo 2D ne permet pas d'evaluer la trajectoire, l'equilibre, la
          charge, la position des genoux dans le plan frontal ni la neutralite
          de la colonne. Ces mesures ne constituent pas un diagnostic medical.
        </p>
      </CardContent>
    </Card>
  )
}

function formatSide(assessment: SquatAssessment | null) {
  if (!assessment) {
    return "--"
  }

  return assessment.side === "left" ? "Gauche" : "Droit"
}

function formatAngle(value?: number) {
  return Number.isFinite(value) ? `${Math.round(value ?? 0)} deg` : "--"
}

function percent(value?: number) {
  if (!Number.isFinite(value)) {
    return "--"
  }

  return `${Math.round((value ?? 0) * 100)}%`
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
