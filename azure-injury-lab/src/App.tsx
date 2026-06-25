import * as React from "react"
import {
  ChatCircleIcon,
  BrainIcon,
  ChartLineIcon,
  ClipboardTextIcon,
  DatabaseIcon,
  GaugeIcon,
  ImageIcon,
  KeyIcon,
  LightningIcon,
  PaperPlaneTiltIcon,
  PlayIcon,
  ScanIcon,
  ShieldCheckIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { toast } from "sonner"

import { loadChartData, type ModelData } from "@/data"
import { VisionPanel } from "@/components/vision-panel"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  DEFAULT_ENDPOINT,
  MODEL_ID,
  SERVICE_ID,
  WORKFLOW_ACTIVITY_ENDPOINT,
  clearSessionCredentials,
  createEmptyProfile,
  createScoreRequest,
  invokeWorkflow,
  loadExecutions,
  loadSessionCredentials,
  loadSettings,
  parseAzureNumber,
  removeExecution,
  runInference,
  saveExecution,
  saveSessionCredentials,
  saveSettings,
  type AzureScoreRow,
  type AthleteProfile,
  type Execution,
  type InferenceResult,
  type SessionCredentials,
} from "@/model"

const chartConfig = {
  value: {
    label: "Valeur",
    color: "var(--primary)",
  },
} satisfies ChartConfig

const profileFields = [
  {
    key: "injuryNextSeason",
    label: "Injury_Next_Season",
    min: 0,
    max: 1,
    step: 1,
    unit: "0/1",
  },
  {
    key: "fatigueRiskScore",
    label: "Fatigue_Risk_Score",
    min: 0,
    max: 250,
    step: 0.000001,
    unit: "score",
  },
  {
    key: "stressScore",
    label: "Stress_Level_Score",
    min: 0,
    max: 100,
    step: 0.000001,
    unit: "/100",
  },
  {
    key: "sleepHours",
    label: "Sleep_Hours_Per_Night",
    min: 0,
    max: 14,
    step: 0.000001,
    unit: "h",
  },
  {
    key: "balanceScore",
    label: "Balance_Test_Score",
    min: 0,
    max: 100,
    step: 0.000001,
    unit: "/100",
  },
  {
    key: "sprint10mSeconds",
    label: "Sprint_Speed_10m_s",
    min: 0,
    max: 12,
    step: 0.000001,
    unit: "s",
  },
  {
    key: "reactionTimeMs",
    label: "Reaction_Time_ms",
    min: 100,
    max: 600,
    step: 0.000001,
    unit: "ms",
  },
  {
    key: "kneeStrengthScore",
    label: "Knee_Strength_Score",
    min: 0,
    max: 100,
    step: 0.000001,
    unit: "/100",
  },
  {
    key: "hamstringFlexibility",
    label: "Hamstring_Flexibility",
    min: 0,
    max: 100,
    step: 0.000001,
    unit: "/100",
  },
  {
    key: "nutritionScore",
    label: "Nutrition_Quality_Score",
    min: 0,
    max: 100,
    step: 0.000001,
    unit: "/100",
  },
  {
    key: "agilityScore",
    label: "Agility_Score",
    min: 0,
    max: 100,
    step: 0.000001,
    unit: "/100",
  },
  {
    key: "previousInjuries",
    label: "Previous_Injury_Count",
    min: 0,
    max: 10,
    step: 1,
    unit: "count",
  },
  {
    key: "preventionAdherenceScore",
    label: "Prevention_Adherence_Score",
    min: 0,
    max: 14,
    step: 0.000001,
    unit: "score",
  },
  {
    key: "injuryExposureIndex",
    label: "Injury_Exposure_Index",
    min: 0,
    max: 800,
    step: 1,
    unit: "index",
  },
  {
    key: "warmupAdherence",
    label: "Warmup_Routine_Adherence",
    min: 0,
    max: 1,
    step: 1,
    unit: "0/1",
  },
] satisfies Array<{
  key: keyof AthleteProfile
  label: string
  min: number
  max: number
  step: number
  unit: string
}>

const outputFields = [
  ["Fatigue_Risk_Score", "Fatigue"],
  ["Prevention_Adherence_Score", "Prevention"],
  ["Injury_Exposure_Index", "Exposition"],
  ["Balance_Test_Score", "Balance"],
  ["Reaction_Time_ms", "Reaction"],
  ["Knee_Strength_Score", "Genou"],
  ["Hamstring_Flexibility", "Ischio"],
  ["Previous_Injury_Count", "Blessures"],
  ["Warmup_Routine_Adherence", "Echauffement"],
  ["Injury_Next_Season", "Label source"],
] satisfies Array<[keyof AzureScoreRow, string]>

type SurfaceView = "inference" | "evaluation" | "history" | "schema"
type ActiveApp = "injury" | "vision" | "coach" | "settings"

type CoachMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt: string
}

const surfaceItems = [
  ["inference", "Inference Azure", PlayIcon],
  ["evaluation", "Evaluation modele", ChartLineIcon],
  ["history", "Historique reel", ClipboardTextIcon],
  ["schema", "Schema Swagger", DatabaseIcon],
] satisfies Array<[SurfaceView, string, React.ComponentType]>

function percent(value?: number) {
  if (!Number.isFinite(value)) {
    return "--"
  }

  return `${Math.round((value ?? 0) * 100)}%`
}

function decimal(value?: number, digits = 3) {
  if (!Number.isFinite(value)) {
    return "--"
  }

  return (value ?? 0).toFixed(digits)
}

function riskLabel(result?: InferenceResult) {
  if (!result) {
    return "Aucun score"
  }

  if (typeof result.scoredLabel !== "number") {
    return "Sortie Azure"
  }

  return result.scoredLabel === 1 ? "Risque blessure" : "Risque controle"
}

function riskVariant(result?: InferenceResult) {
  if (!result || typeof result.scoredLabel !== "number") {
    return "outline" as const
  }

  return result.scoredLabel === 1 ? "destructive" : "secondary"
}

function AppSidebar({
  activeApp,
  activeView,
  onAppChange,
  onViewChange,
}: {
  activeApp: ActiveApp
  activeView: SurfaceView
  onAppChange: (app: ActiveApp) => void
  onViewChange: (view: SurfaceView) => void
}) {
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" isActive tooltip={SERVICE_ID}>
              <div className="flex size-8 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <BrainIcon />
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium">Azure ML Sport</span>
                <span className="truncate text-xs text-muted-foreground">
                  {SERVICE_ID}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeApp === "injury"}
                  tooltip="Prediction blessure"
                  onClick={() => onAppChange("injury")}
                >
                  <ShieldCheckIcon />
                  <span>Prediction blessure</span>
                </SidebarMenuButton>
                <SidebarMenuBadge>ACI</SidebarMenuBadge>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeApp === "vision"}
                  tooltip="Analyse de posture"
                  onClick={() => onAppChange("vision")}
                >
                  <ScanIcon />
                  <span>Analyse de posture</span>
                </SidebarMenuButton>
                <SidebarMenuBadge>Vision</SidebarMenuBadge>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeApp === "coach"}
                  tooltip="Sport Coach Agent IA"
                  onClick={() => onAppChange("coach")}
                >
                  <ChatCircleIcon />
                  <span>Sport Coach Agent IA</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeApp === "settings"}
                  tooltip="Settings"
                  onClick={() => onAppChange("settings")}
                >
                  <KeyIcon />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        {activeApp === "injury" ? (
          <SidebarGroup>
            <SidebarGroupLabel>Surfaces</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {surfaceItems.map(([view, label, Icon]) => (
                  <SidebarMenuItem key={view}>
                    <SidebarMenuButton
                      isActive={activeView === view}
                      tooltip={label}
                      onClick={() => onViewChange(view)}
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : activeApp === "vision" ? (
          <SidebarGroup>
            <SidebarGroupLabel>Computer Vision</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive tooltip="Analyse d'image">
                    <ImageIcon />
                    <span>Analyse d'image</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : activeApp === "coach" ? (
          <SidebarGroup>
            <SidebarGroupLabel>Agent</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive tooltip="Prompt coach">
                    <ChatCircleIcon />
                    <span>Prompt coach</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <SidebarGroup>
            <SidebarGroupLabel>Configuration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive tooltip="Tokens de session">
                    <KeyIcon />
                    <span>Tokens de session</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarSeparator />
        <div className="px-3 py-2 text-xs text-muted-foreground">
          Donnees affichees: endpoint, Swagger, sorties Azure et fichiers
          d'evaluation.
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function CoachPanel({
  prompt,
  messages,
  pending,
  workflowConfigured,
  onPromptChange,
  onSubmit,
}: {
  prompt: string
  messages: CoachMessage[]
  pending: boolean
  workflowConfigured: boolean
  onPromptChange: (value: string) => void
  onSubmit: () => void
}) {
  return (
    <section className="grid h-[calc(100svh-6.5rem)] min-h-0 gap-4 overflow-hidden xl:grid-cols-[minmax(0,1fr)_22rem]">
      <Card className="flex min-h-0 flex-col overflow-hidden">
        <CardHeader>
          <CardTitle>Sport Coach Agent IA</CardTitle>
          <CardDescription>
            Interface de prompt pour préparer des consignes de coaching sportif.
          </CardDescription>
          <CardAction>
            <Badge variant="outline">Prompt UI</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
          <ScrollArea className="min-h-0 flex-1 rounded-2xl border">
            <div className="flex min-h-full flex-col gap-4 p-4">
              {messages.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                  <Avatar className="size-12">
                    <AvatarFallback>AI</AvatarFallback>
                  </Avatar>
                  <div className="max-w-md">
                    <h2 className="text-lg font-semibold">
                      Demarre une session coach
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Redige une demande pour un plan d'entrainement, une
                      prevention blessure, une analyse de fatigue ou une
                      strategie de recuperation.
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    className={
                      message.role === "user"
                        ? "ml-auto flex max-w-[82%] items-start gap-3"
                        : "mr-auto flex max-w-[82%] items-start gap-3"
                    }
                    key={message.id}
                  >
                    {message.role === "assistant" ? (
                      <Avatar className="size-9">
                        <AvatarFallback>AI</AvatarFallback>
                      </Avatar>
                    ) : null}
                    <div
                      className={
                        message.role === "user"
                          ? "rounded-2xl bg-primary px-4 py-3 text-sm text-primary-foreground"
                          : "rounded-2xl border bg-muted px-4 py-3 text-sm"
                      }
                    >
                      <div className="whitespace-pre-wrap">
                        {message.content}
                      </div>
                    </div>
                    {message.role === "user" ? (
                      <Avatar className="size-9">
                        <AvatarFallback>MR</AvatarFallback>
                      </Avatar>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="coach-prompt">Prompt</FieldLabel>
              <Textarea
                id="coach-prompt"
                value={prompt}
                onChange={(event) => onPromptChange(event.target.value)}
                placeholder="Ex: Prepare un plan de recuperation pour un joueur avec forte fatigue et risque de blessure..."
                className="min-h-28 resize-none"
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    (event.metaKey || event.ctrlKey)
                  ) {
                    event.preventDefault()
                    onSubmit()
                  }
                }}
              />
              <FieldDescription>
                Ctrl+Entree envoie le prompt. Le workflow est appele si le
                token est configure dans Settings.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end">
          <Button onClick={onSubmit} disabled={!prompt.trim() || pending}>
            <PaperPlaneTiltIcon data-icon="inline-start" />
            {pending ? "Envoi..." : "Envoyer"}
          </Button>
        </CardFooter>
      </Card>

      <div className="flex min-h-0 flex-col gap-4 overflow-auto">
        <Card>
          <CardHeader>
            <CardTitle>Contexte coach</CardTitle>
            <CardDescription>
              L'interface est prete pour connecter un agent IA.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {[
              "Planification entrainement",
              "Prevention blessure",
              "Retour au jeu",
              "Charge et recuperation",
            ].map((item) => (
              <Badge className="justify-start" variant="secondary" key={item}>
                {item}
              </Badge>
            ))}
          </CardContent>
        </Card>
        <Alert variant={workflowConfigured ? "default" : "destructive"}>
          <KeyIcon />
          <AlertTitle>
            {workflowConfigured ? "Workflow connecte" : "Token workflow requis"}
          </AlertTitle>
          <AlertDescription>
            {workflowConfigured
              ? "Les prompts sont envoyes au workflow Coach-IA-Workflow."
              : "Va dans Settings et renseigne le token d'acces au workflow."}
          </AlertDescription>
        </Alert>
      </div>
    </section>
  )
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string
  value: string
  detail: string
  icon: React.ComponentType
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="truncate text-2xl font-semibold">{value}</div>
          <p className="truncate text-sm text-muted-foreground">{detail}</p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-2xl bg-muted">
          <Icon />
        </div>
      </CardContent>
    </Card>
  )
}

function CurveChart({
  title,
  description,
  data,
}: {
  title: string
  description: string
  data: Array<{ x: number; y: number }>
}) {
  const chartData = data.map((point) => ({
    x: Number(point.x.toFixed(3)),
    value: Number(point.y.toFixed(3)),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <LineChart data={chartData} margin={{ left: 4, right: 12 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="x"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            <Line
              dataKey="value"
              type="monotone"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function SettingsPanel({
  endpoint,
  credentials,
  onEndpointChange,
  onCredentialsChange,
  onSave,
  onClear,
}: {
  endpoint: string
  credentials: SessionCredentials
  onEndpointChange: (value: string) => void
  onCredentialsChange: (value: SessionCredentials) => void
  onSave: () => void
  onClear: () => void
}) {
  const mlReady = Boolean(credentials.azureMlToken.trim())
  const workflowReady = Boolean(
    credentials.workflowToken.trim() && credentials.workflowEndpoint.trim()
  )

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            Tokens conserves dans sessionStorage pour l'onglet courant.
          </CardDescription>
          <CardAction>
            <Badge variant={mlReady && workflowReady ? "secondary" : "outline"}>
              Session
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <FieldSet>
              <FieldLegend>Machine learning</FieldLegend>
              <Field>
                <FieldLabel htmlFor="settings-ml-endpoint">
                  Endpoint Azure ML
                </FieldLabel>
                <Input
                  id="settings-ml-endpoint"
                  value={endpoint}
                  onChange={(event) => onEndpointChange(event.target.value)}
                />
                <FieldDescription>
                  Utilise pour appeler le endpoint de scoring blessure.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="settings-ml-token">
                  Token machine learning
                </FieldLabel>
                <Input
                  id="settings-ml-token"
                  type="password"
                  value={credentials.azureMlToken}
                  onChange={(event) =>
                    onCredentialsChange({
                      ...credentials,
                      azureMlToken: event.target.value,
                    })
                  }
                  placeholder="Bearer token Azure ML"
                />
                <FieldDescription>
                  Stocke seulement dans la session du navigateur.
                </FieldDescription>
              </Field>
            </FieldSet>

            <FieldSet>
              <FieldLegend>Workflow coach IA</FieldLegend>
              <Field>
                <FieldLabel htmlFor="settings-workflow-endpoint">
                  Endpoint workflow
                </FieldLabel>
                <Input
                  id="settings-workflow-endpoint"
                  value={credentials.workflowEndpoint}
                  onChange={(event) =>
                    onCredentialsChange({
                      ...credentials,
                      workflowEndpoint: event.target.value,
                    })
                  }
                />
                <FieldDescription>
                  Par defaut: {WORKFLOW_ACTIVITY_ENDPOINT}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="settings-workflow-token">
                  Token acces workflow
                </FieldLabel>
                <Input
                  id="settings-workflow-token"
                  type="password"
                  value={credentials.workflowToken}
                  onChange={(event) =>
                    onCredentialsChange({
                      ...credentials,
                      workflowToken: event.target.value,
                    })
                  }
                  placeholder="Bearer token Foundry"
                />
                <FieldDescription>
                  Utilise par Sport Coach Agent IA pour appeler
                  Coach-IA-Workflow.
                </FieldDescription>
              </Field>
            </FieldSet>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-between gap-3">
          <Button variant="ghost" onClick={onClear}>
            Effacer session
          </Button>
          <Button onClick={onSave}>
            <KeyIcon data-icon="inline-start" />
            Enregistrer
          </Button>
        </CardFooter>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Etat des acces</CardTitle>
            <CardDescription>
              Resume des secrets disponibles pour cette session.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Badge className="justify-start" variant={mlReady ? "secondary" : "destructive"}>
              Azure ML: {mlReady ? "token present" : "token manquant"}
            </Badge>
            <Badge
              className="justify-start"
              variant={workflowReady ? "secondary" : "destructive"}
            >
              Workflow: {workflowReady ? "token present" : "token manquant"}
            </Badge>
          </CardContent>
        </Card>
        <Alert>
          <ShieldCheckIcon />
          <AlertTitle>Usage prototype</AlertTitle>
          <AlertDescription>
            sessionStorage se vide a la fermeture de l'onglet, mais le token
            reste visible par le JavaScript de la page. Pour une app publique,
            passe par un backend.
          </AlertDescription>
        </Alert>
      </div>
    </section>
  )
}

function InferenceForm({
  profile,
  pending,
  onChange,
  onSubmit,
}: {
  profile: AthleteProfile
  pending: boolean
  onChange: (key: keyof AthleteProfile, value: number | string) => void
  onSubmit: () => void
}) {
  const scoreRequest = createScoreRequest(profile)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inference Azure</CardTitle>
        <CardDescription>
          Formulaire direct pour les 15 colonnes attendues par `Inputs.input1`.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <Field>
          <FieldLabel htmlFor="athlete-id">Athlete ID</FieldLabel>
          <Input
            id="athlete-id"
            value={profile.id}
            onChange={(event) => onChange("id", event.target.value)}
          />
        </Field>
        <FieldSet>
          <FieldLegend>Variables envoyees au modele</FieldLegend>
          <div className="grid gap-4 md:grid-cols-2">
            {profileFields.map((field) => (
              <Field key={field.key}>
                <FieldLabel htmlFor={field.key}>{field.label}</FieldLabel>
                <Input
                  id={field.key}
                  type="number"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={profile[field.key]}
                  onChange={(event) =>
                    onChange(field.key, Number(event.target.value))
                  }
                />
                <FieldDescription>
                  {field.unit || "valeur numerique"}
                </FieldDescription>
              </Field>
            ))}
          </div>
        </FieldSet>
        <Alert>
          <WarningCircleIcon />
          <AlertTitle>Schema Swagger actuel</AlertTitle>
          <AlertDescription>
            Ces champs sont envoyes tels quels au endpoint Azure ML. Les
            colonnes brutes comme `Age`, `BMI` ou `Training_Hours_Per_Week` ne
            font plus partie du schema expose.
          </AlertDescription>
        </Alert>
        <pre className="max-h-72 overflow-auto rounded-2xl bg-muted p-4 text-xs">
          {JSON.stringify(scoreRequest, null, 2)}
        </pre>
      </CardContent>
      <CardFooter className="justify-end">
        <Button onClick={onSubmit} disabled={pending}>
          <LightningIcon data-icon="inline-start" />
          {pending ? "Scoring..." : "Appeler /score"}
        </Button>
      </CardFooter>
    </Card>
  )
}

function LatestResult({ result }: { result?: InferenceResult }) {
  const outputRows = outputFields
    .map(([key, label]) => ({
      key,
      label,
      value: parseAzureNumber(result?.output?.[key]),
    }))
    .filter((row) => typeof row.value === "number")

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dernier resultat Azure</CardTitle>
        <CardDescription>
          Sortie renvoyee par `Results.WebServiceOutput0`.
        </CardDescription>
        <CardAction>
          <Badge variant={riskVariant(result)}>{riskLabel(result)}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <div className="text-4xl font-semibold">
            {result ? percent(result.probability) : "--"}
          </div>
          <p className="text-sm text-muted-foreground">
            {typeof result?.probability === "number"
              ? "Scored Probabilities"
              : "Probabilite non exposee par ce endpoint"}
          </p>
        </div>
        <Progress value={result?.probability ? result.probability * 100 : 0} />
        {outputRows.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Champ Azure</TableHead>
                <TableHead className="text-right">Valeur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {outputRows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-right font-mono">
                    {decimal(row.value, 3)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
        {result ? (
          <pre className="max-h-80 overflow-auto rounded-2xl bg-muted p-4 text-xs">
            {JSON.stringify(result.output ?? result.raw, null, 2)}
          </pre>
        ) : (
          <Alert>
            <KeyIcon />
            <AlertTitle>Aucun appel effectue</AlertTitle>
            <AlertDescription>
              Saisis la cle Azure ML puis lance une inference.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

function HistoryTable({
  executions,
  onRemove,
}: {
  executions: Execution[]
  onRemove: (id: string) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique reel</CardTitle>
        <CardDescription>
          Uniquement les appels `/score` lances depuis cette interface.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Athlete</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Probabilite</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {executions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  Aucun resultat Azure enregistre.
                </TableCell>
              </TableRow>
            ) : (
              executions.map((execution) => (
                <TableRow key={execution.id}>
                  <TableCell>
                    {new Date(execution.prediction.createdAt).toLocaleString(
                      "fr-FR"
                    )}
                  </TableCell>
                  <TableCell className="font-mono">
                    {execution.profile.id}
                  </TableCell>
                  <TableCell>
                    <Badge variant={riskVariant(execution.prediction)}>
                      {riskLabel(execution.prediction)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {percent(execution.prediction.probability)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(execution.id)}
                    >
                      Retirer
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function SchemaPanel({
  endpoint,
  profile,
}: {
  endpoint: string
  profile: AthleteProfile
}) {
  const row = createScoreRequest(profile).Inputs.input1[0]
  const rows = Object.entries(row)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schema Swagger</CardTitle>
        <CardDescription>
          Colonnes exactes envoyees dans `Inputs.input1` vers {endpoint}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colonne</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Valeur actuelle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(([key, value]) => (
              <TableRow key={key}>
                <TableCell className="font-mono">{key}</TableCell>
                <TableCell>
                  {Number.isInteger(value) ? "int64" : "double"}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {Number.isInteger(value) ? value : decimal(value, 6)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <pre className="max-h-80 overflow-auto rounded-2xl bg-muted p-4 text-xs">
          {JSON.stringify(createScoreRequest(profile), null, 2)}
        </pre>
      </CardContent>
    </Card>
  )
}

function App() {
  const [modelData, setModelData] = React.useState<ModelData | null>(null)
  const [activeApp, setActiveApp] = React.useState<ActiveApp>("injury")
  const [activeView, setActiveView] = React.useState<SurfaceView>("inference")
  const [coachPrompt, setCoachPrompt] = React.useState("")
  const [coachMessages, setCoachMessages] = React.useState<CoachMessage[]>([])
  const [profile, setProfile] = React.useState<AthleteProfile>(() =>
    createEmptyProfile()
  )
  const [endpoint, setEndpoint] = React.useState(() => loadSettings().endpoint)
  const [sessionCredentials, setSessionCredentials] = React.useState(() =>
    loadSessionCredentials()
  )
  const [executions, setExecutions] = React.useState<Execution[]>(() =>
    loadExecutions()
  )
  const [latestResult, setLatestResult] = React.useState<
    InferenceResult | undefined
  >(executions[0]?.prediction)
  const [pending, setPending] = React.useState(false)
  const [coachPending, setCoachPending] = React.useState(false)
  const [lastError, setLastError] = React.useState<string | null>(null)

  React.useEffect(() => {
    loadChartData()
      .then(setModelData)
      .catch((error: unknown) => {
        setLastError(error instanceof Error ? error.message : "Erreur donnees")
      })
  }, [])

  React.useEffect(() => {
    saveSettings({ endpoint })
  }, [endpoint])

  React.useEffect(() => {
    saveSessionCredentials(sessionCredentials)
  }, [sessionCredentials])

  function updateProfile(key: keyof AthleteProfile, value: number | string) {
    setProfile((current) => ({
      ...current,
      [key]: value,
    }))
  }

  async function handleSubmit() {
    setPending(true)
    setLastError(null)

    try {
      const prediction = await runInference(profile, {
        endpoint,
        key: sessionCredentials.azureMlToken,
      })
      const execution = {
        id: prediction.id,
        profile,
        prediction,
      }
      const next = saveExecution(execution)
      setExecutions(next)
      setLatestResult(prediction)
      toast.success("Inference Azure terminee", {
        description: `${riskLabel(prediction)} - ${percent(prediction.probability)}`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue"
      setLastError(message)
      toast.error("Echec du scoring Azure", {
        description: message,
      })
    } finally {
      setPending(false)
    }
  }

  function handleRemove(id: string) {
    const next = removeExecution(id)
    setExecutions(next)
    setLatestResult(next[0]?.prediction)
  }

  function handleAppChange(app: ActiveApp) {
    setActiveApp(app)
    if (app === "injury") {
      setActiveView((current) => current)
    }
  }

  async function handleCoachSubmit() {
    const content = coachPrompt.trim()

    if (!content) {
      return
    }

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user" as const,
      content,
      createdAt: new Date().toISOString(),
    }

    setCoachMessages((current) => [
      ...current,
      userMessage,
    ])
    setCoachPrompt("")

    if (
      !sessionCredentials.workflowToken.trim() ||
      !sessionCredentials.workflowEndpoint.trim()
    ) {
      toast.info("Prompt ajoute a la session", {
        description: "Ajoute le token workflow dans Settings pour appeler l'IA.",
      })
      return
    }

    setCoachPending(true)

    try {
      const response = await invokeWorkflow(content, {
        endpoint: sessionCredentials.workflowEndpoint,
        token: sessionCredentials.workflowToken,
      })

      setCoachMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.text,
          createdAt: response.createdAt,
        },
      ])
      toast.success("Workflow appele", {
        description: "Coach-IA-Workflow a renvoye une reponse.",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue"
      setLastError(message)
      toast.error("Echec du workflow", {
        description: message,
      })
    } finally {
      setCoachPending(false)
    }
  }

  function handleSaveSessionSettings() {
    saveSessionCredentials(sessionCredentials)
    toast.success("Settings enregistres", {
      description: "Les tokens sont disponibles pour cet onglet.",
    })
  }

  function handleClearSessionSettings() {
    clearSessionCredentials()
    setSessionCredentials(loadSessionCredentials())
    toast.info("Session effacee", {
      description: "Les tokens de cet onglet ont ete retires.",
    })
  }

  const metrics = modelData?.metrics
  const injuryContent =
    activeView === "inference" ? (
      <section className="grid gap-4 xl:grid-cols-2">
        <div className="flex flex-col gap-4">
          <LatestResult result={latestResult} />
        </div>
        <InferenceForm
          profile={profile}
          pending={pending}
          onChange={updateProfile}
          onSubmit={handleSubmit}
        />
      </section>
    ) : activeView === "evaluation" ? (
      <section className="flex flex-col gap-4">
        <div className="grid gap-4 xl:grid-cols-3">
          <CurveChart
            title="ROC curve"
            description="Depuis ROC curve_chart_data.tsv"
            data={modelData?.roc ?? []}
          />
          <CurveChart
            title="Precision-recall"
            description="Depuis Precision-recall curve_chart_data.tsv"
            data={modelData?.precisionRecall ?? []}
          />
          <CurveChart
            title="Lift curve"
            description="Depuis Lift curve_chart_data.tsv"
            data={modelData?.lift ?? []}
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Matrice de confusion au meilleur seuil F1</CardTitle>
            <CardDescription>
              Donnees lues dans `model-evaluation.visualization`.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            {[
              ["TP", metrics?.confusionMatrix.tp],
              ["TN", metrics?.confusionMatrix.tn],
              ["FP", metrics?.confusionMatrix.fp],
              ["FN", metrics?.confusionMatrix.fn],
            ].map(([label, value]) => (
              <div className="rounded-2xl border p-4" key={label}>
                <div className="text-sm text-muted-foreground">{label}</div>
                <div className="text-2xl font-semibold">{value ?? "--"}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    ) : activeView === "history" ? (
      <HistoryTable executions={executions} onRemove={handleRemove} />
    ) : (
      <SchemaPanel endpoint={endpoint} profile={profile} />
    )
  const activeContent =
    activeApp === "injury" ? (
      <>
        <Alert>
          <WarningCircleIcon />
          <AlertTitle>Diagnostic pipeline Azure</AlertTitle>
          <AlertDescription>
            Le endpoint actuel attend les colonnes apres feature engineering
            (`Fatigue_Risk_Score`, `Prevention_Adherence_Score`,
            `Injury_Exposure_Index`) et refuse les colonnes brutes.
          </AlertDescription>
        </Alert>

        {lastError ? (
          <Alert variant="destructive">
            <WarningCircleIcon />
            <AlertTitle>Erreur endpoint</AlertTitle>
            <AlertDescription>{lastError}</AlertDescription>
          </Alert>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Service ID"
            value={SERVICE_ID}
            detail="Container instance"
            icon={ShieldCheckIcon}
          />
          <MetricCard
            title="AUC"
            value={decimal(metrics?.auc)}
            detail="Depuis model-evaluation"
            icon={GaugeIcon}
          />
          <MetricCard
            title="Precision"
            value={percent(metrics?.precision)}
            detail={`Seuil ${decimal(metrics?.threshold)}`}
            icon={ChartLineIcon}
          />
          <MetricCard
            title="Recall"
            value={percent(metrics?.recall)}
            detail="Courbe precision-recall"
            icon={PlayIcon}
          />
        </section>

        {injuryContent}
      </>
    ) : activeApp === "vision" ? (
      <VisionPanel />
    ) : activeApp === "coach" ? (
      <CoachPanel
        prompt={coachPrompt}
        messages={coachMessages}
        pending={coachPending}
        workflowConfigured={Boolean(
          sessionCredentials.workflowToken.trim() &&
            sessionCredentials.workflowEndpoint.trim()
        )}
        onPromptChange={setCoachPrompt}
        onSubmit={handleCoachSubmit}
      />
    ) : (
      <SettingsPanel
        endpoint={endpoint || DEFAULT_ENDPOINT}
        credentials={sessionCredentials}
        onEndpointChange={setEndpoint}
        onCredentialsChange={setSessionCredentials}
        onSave={handleSaveSessionSettings}
        onClear={handleClearSessionSettings}
      />
    )

  return (
    <SidebarProvider>
      <AppSidebar
        activeApp={activeApp}
        activeView={activeView}
        onAppChange={handleAppChange}
        onViewChange={setActiveView}
      />
      <SidebarInset className="h-svh overflow-hidden md:h-[calc(100svh-1rem)]">
        <header className="z-10 flex min-h-14 shrink-0 items-center gap-3 rounded-t-xl border-b bg-background px-2 md:px-3">
          <SidebarTrigger />
          <Separator orientation="vertical" className="min-h-6" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold">
              {activeApp === "injury"
                ? "Azure ML Injury Dashboard"
                : activeApp === "vision"
                  ? "Analyse de posture"
                : activeApp === "coach"
                  ? "Sport Coach Agent IA"
                  : "Settings"}
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              {activeApp === "injury"
                ? `${SERVICE_ID} - ${MODEL_ID}`
                : activeApp === "vision"
                  ? "Azure AI Vision - analyse d'image"
                : activeApp === "coach"
                  ? "Assistant de coaching sportif"
                  : "Tokens de session"}
            </p>
          </div>
          <Badge
            variant={
              activeApp === "vision"
                ? "secondary"
                : activeApp === "coach"
                ? "outline"
                : activeApp === "settings"
                  ? "secondary"
                  : sessionCredentials.azureMlToken
                    ? "secondary"
                    : "destructive"
            }
          >
            {activeApp === "vision"
              ? "Vision configuree"
              : activeApp === "coach"
              ? sessionCredentials.workflowToken
                ? "Workflow pret"
                : "Token workflow"
              : activeApp === "settings"
                ? "Session"
                : sessionCredentials.azureMlToken
                  ? "Pret a scorer"
                  : "Cle requise"}
          </Badge>
        </header>

        <ScrollArea className="min-h-0 flex-1">
          <main className="flex flex-col gap-6 p-4 md:p-6">
            {activeContent}
          </main>
        </ScrollArea>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
