export const AZURE_SCORE_ENDPOINT =
  "http://c953e64f-4fc1-4e1c-a0d9-c8154f053f60.swedencentral.azurecontainer.io/score"
export const DEFAULT_ENDPOINT = "/api/score"
export const WORKFLOW_ACTIVITY_ENDPOINT =
  "https://coach-sport-resource.services.ai.azure.com/api/projects/coach-sport/applications/Coach-IA-Workflow/protocols/activityprotocol?api-version=2025-11-15-preview"
export const WORKFLOW_RESPONSES_ENDPOINT =
  "https://coach-sport-resource.services.ai.azure.com/api/projects/coach-sport/applications/Coach-IA-Workflow/protocols/openai/responses?api-version=2025-11-15-preview"

export const SERVICE_ID = "deploy-v3-injury"
export const MODEL_ID = "amlstudio-deploy-v3-injury:1"

export type AthleteProfile = {
  id: string
  injuryNextSeason: number
  fatigueRiskScore: number
  stressScore: number
  sleepHours: number
  balanceScore: number
  sprint10mSeconds: number
  reactionTimeMs: number
  kneeStrengthScore: number
  hamstringFlexibility: number
  nutritionScore: number
  agilityScore: number
  previousInjuries: number
  preventionAdherenceScore: number
  injuryExposureIndex: number
  warmupAdherence: number
}

export type EndpointSettings = {
  endpoint: string
  key?: string
}

export type WorkflowSettings = {
  endpoint: string
  token?: string
}

export type SessionCredentials = {
  azureMlToken: string
  workflowToken: string
  workflowEndpoint: string
}

type AzureValue = number | string

export type AzureScoreRow = {
  Injury_Next_Season?: AzureValue
  Fatigue_Risk_Score?: AzureValue
  Stress_Level_Score?: AzureValue
  Sleep_Hours_Per_Night?: AzureValue
  Balance_Test_Score?: AzureValue
  Sprint_Speed_10m_s?: AzureValue
  Reaction_Time_ms?: AzureValue
  Knee_Strength_Score?: AzureValue
  Hamstring_Flexibility?: AzureValue
  Nutrition_Quality_Score?: AzureValue
  Agility_Score?: AzureValue
  Previous_Injury_Count?: AzureValue
  Prevention_Adherence_Score?: AzureValue
  Injury_Exposure_Index?: AzureValue
  Warmup_Routine_Adherence?: AzureValue
  "Scored Labels"?: AzureValue
  "Scored Probabilities"?: AzureValue
}

export type AzureInputRow = Required<
  Pick<
    AzureScoreRow,
    | "Injury_Next_Season"
    | "Fatigue_Risk_Score"
    | "Stress_Level_Score"
    | "Sleep_Hours_Per_Night"
    | "Balance_Test_Score"
    | "Sprint_Speed_10m_s"
    | "Reaction_Time_ms"
    | "Knee_Strength_Score"
    | "Hamstring_Flexibility"
    | "Nutrition_Quality_Score"
    | "Agility_Score"
    | "Previous_Injury_Count"
    | "Prevention_Adherence_Score"
    | "Injury_Exposure_Index"
    | "Warmup_Routine_Adherence"
  >
>

export type InferenceResult = {
  id: string
  profile: AthleteProfile
  probability?: number
  scoredLabel?: number
  source: "Azure ML endpoint"
  output?: AzureScoreRow
  raw: unknown
  createdAt: string
}

export type Execution = {
  id: string
  profile: AthleteProfile
  prediction: InferenceResult
}

const STORAGE_KEY = "azure-injury-executions"
const SETTINGS_KEY = "azure-injury-endpoint-settings"
const SESSION_CREDENTIALS_KEY = "azure-sport-session-credentials"
const AZURE_SCORE_HOST = "azurecontainer.io/score"

const round = (value: number, digits = 3) => Number(value.toFixed(digits))

export function createEmptyProfile(): AthleteProfile {
  return {
    id: `athlete-${Date.now()}`,
    injuryNextSeason: 0,
    fatigueRiskScore: 23.522331321438557,
    stressScore: 46.61641520851219,
    sleepHours: 8.238293030872281,
    balanceScore: 91.21247628562678,
    sprint10mSeconds: 5.874629899095096,
    reactionTimeMs: 284.48785262294393,
    kneeStrengthScore: 77.46027901003853,
    hamstringFlexibility: 79.11573817783952,
    nutritionScore: 81.47220606471353,
    agilityScore: 77.59970508640522,
    previousInjuries: 1,
    preventionAdherenceScore: 8.238293030872281,
    injuryExposureIndex: 36,
    warmupAdherence: 1,
  }
}

export function normalizePayload(profile: AthleteProfile) {
  return {
    Injury_Next_Season: profile.injuryNextSeason,
    Fatigue_Risk_Score: profile.fatigueRiskScore,
    Stress_Level_Score: profile.stressScore,
    Sleep_Hours_Per_Night: profile.sleepHours,
    Balance_Test_Score: profile.balanceScore,
    Sprint_Speed_10m_s: profile.sprint10mSeconds,
    Reaction_Time_ms: profile.reactionTimeMs,
    Knee_Strength_Score: profile.kneeStrengthScore,
    Hamstring_Flexibility: profile.hamstringFlexibility,
    Nutrition_Quality_Score: profile.nutritionScore,
    Agility_Score: profile.agilityScore,
    Previous_Injury_Count: profile.previousInjuries,
    Prevention_Adherence_Score: profile.preventionAdherenceScore,
    Injury_Exposure_Index: profile.injuryExposureIndex,
    Warmup_Routine_Adherence: profile.warmupAdherence,
  } satisfies AzureInputRow
}

export function createScoreRequest(profile: AthleteProfile) {
  return {
    Inputs: {
      input1: [normalizePayload(profile)],
    },
    GlobalParameters: {},
  }
}

export async function runInference(
  profile: AthleteProfile,
  settings: EndpointSettings
): Promise<InferenceResult> {
  if (!settings.endpoint) {
    throw new Error("Endpoint Azure ML manquant.")
  }

  if (!settings.key) {
    throw new Error("Cle Bearer requise pour ce endpoint Azure ML.")
  }

  const response = await fetch(resolveScoreEndpoint(settings.endpoint), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: formatAuthorizationHeader(settings.key),
    },
    body: JSON.stringify(createScoreRequest(profile)),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(formatAzureError(response.status, detail))
  }

  const raw = await response.json()
  const output = extractOutput(raw)
  const probability = parseAzureNumber(output?.["Scored Probabilities"])
  const scoredLabel = parseAzureNumber(output?.["Scored Labels"])

  return {
    id: crypto.randomUUID(),
    profile,
    probability:
      typeof probability === "number" ? round(probability) : undefined,
    scoredLabel,
    source: "Azure ML endpoint",
    output,
    raw,
    createdAt: new Date().toISOString(),
  }
}

export async function invokeWorkflow(
  text: string,
  settings: WorkflowSettings
) {
  if (!settings.endpoint) {
    throw new Error("Endpoint workflow manquant.")
  }

  if (!settings.token) {
    throw new Error("Token Bearer requis pour appeler le workflow.")
  }

  const endpoint = settings.endpoint.trim()

  if (isActivityProtocolEndpoint(endpoint)) {
    return invokeWorkflowActivity(text, {
      endpoint,
      token: settings.token,
    })
  }

  return invokeWorkflowResponses(text, {
    endpoint: resolveResponsesEndpoint(endpoint),
    token: settings.token,
  })
}

async function invokeWorkflowResponses(text: string, settings: WorkflowSettings) {
  const response = await fetch(settings.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: formatAuthorizationHeader(settings.token ?? ""),
    },
    body: JSON.stringify({
      input: text,
    }),
  })

  const rawText = await response.text()

  if (response.status === 202 && !rawText.trim()) {
    throw new Error(
      "Le workflow a accepte la requete avec 202, mais n'a pas renvoye de contenu."
    )
  }

  if (!response.ok) {
    throw new Error(formatAzureError(response.status, rawText))
  }

  const raw = parseMaybeJson(rawText)

  return {
    raw,
    text: extractWorkflowText(raw),
    createdAt: new Date().toISOString(),
  }
}

async function invokeWorkflowActivity(text: string, settings: WorkflowSettings) {
  const response = await fetch(settings.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: formatAuthorizationHeader(settings.token ?? ""),
    },
    body: JSON.stringify({
      type: "message",
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      channelId: "webchat",
      deliveryMode: "expectReplies",
      locale: "fr-FR",
      from: {
        id: "local-user",
        name: "Utilisateur",
      },
      recipient: {
        id: "Coach-IA-Workflow",
        name: "Coach-IA-Workflow",
      },
      conversation: {
        id: getWorkflowConversationId(),
      },
      text,
    }),
  })

  const rawText = await response.text()

  if (response.status === 202 && !rawText.trim()) {
    throw new Error(
      "Le workflow a accepte la requete avec 202, mais le protocole Activity n'a pas renvoye de reponse synchrone. Dans Foundry, les workflows publies en Activity Protocol sont souvent prevus pour Teams/Bot Service. Pour une app web avec reponse directe, utilise un prompt agent publie en Responses API ou un backend qui orchestre les agents."
    )
  }

  if (!response.ok) {
    throw new Error(formatAzureError(response.status, rawText))
  }

  const raw = parseMaybeJson(rawText)

  return {
    raw,
    text: extractWorkflowText(raw),
    createdAt: new Date().toISOString(),
  }
}

function resolveScoreEndpoint(endpoint: string) {
  if (endpoint.includes(AZURE_SCORE_HOST)) {
    return `${DEFAULT_ENDPOINT}?endpoint=${encodeURIComponent(endpoint)}`
  }

  return endpoint
}

function formatAuthorizationHeader(key: string) {
  const trimmed = key.trim()
  return trimmed.toLowerCase().startsWith("bearer ")
    ? trimmed
    : `Bearer ${trimmed}`
}

function formatAzureError(status: number, detail: string) {
  if (detail.includes("Input data are inconsistent with schema")) {
    return `Azure ML a repondu ${status}. Le payload doit respecter exactement le schema Swagger public. Le endpoint actuel attend les colonnes d'ingenierie, pas les colonnes brutes comme Age ou BMI.`
  }

  if (
    detail.includes("MissingFeaturesError") ||
    detail.includes("Prevention_Adherence_Score required")
  ) {
    return `Azure ML a repondu ${status}. Le module Score Model attend Prevention_Adherence_Score, mais cette colonne n'existe pas dans le schema d'entree public. Il faut la creer dans le pipeline Azure Designer avant Score Model, puis redeployer.`
  }

  return `Azure ML a repondu ${status}. ${detail}`
}

export function parseAzureNumber(value: AzureValue | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value !== "string") {
    return undefined
  }

  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function loadExecutions(): Execution[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")
  } catch {
    return []
  }
}

export function saveExecution(execution: Execution) {
  const next = [
    execution,
    ...loadExecutions().filter((item) => item.id !== execution.id),
  ].slice(0, 12)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export function removeExecution(id: string) {
  const next = loadExecutions().filter((execution) => execution.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export function loadSettings(): Pick<EndpointSettings, "endpoint"> {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}")

    return {
      endpoint:
        typeof stored.endpoint === "string"
          ? stored.endpoint
          : DEFAULT_ENDPOINT,
    }
  } catch {
    return {
      endpoint: DEFAULT_ENDPOINT,
    }
  }
}

export function saveSettings(settings: Pick<EndpointSettings, "endpoint">) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function loadSessionCredentials(): SessionCredentials {
  try {
    const stored = JSON.parse(
      sessionStorage.getItem(SESSION_CREDENTIALS_KEY) ?? "{}"
    )

    return {
      azureMlToken:
        typeof stored.azureMlToken === "string" ? stored.azureMlToken : "",
      workflowToken:
        typeof stored.workflowToken === "string" ? stored.workflowToken : "",
      workflowEndpoint:
        typeof stored.workflowEndpoint === "string"
          ? stored.workflowEndpoint
          : WORKFLOW_ACTIVITY_ENDPOINT,
    }
  } catch {
    return {
      azureMlToken: "",
      workflowToken: "",
      workflowEndpoint: WORKFLOW_ACTIVITY_ENDPOINT,
    }
  }
}

export function saveSessionCredentials(credentials: SessionCredentials) {
  sessionStorage.setItem(SESSION_CREDENTIALS_KEY, JSON.stringify(credentials))
}

export function clearSessionCredentials() {
  sessionStorage.removeItem(SESSION_CREDENTIALS_KEY)
  sessionStorage.removeItem("azure-sport-workflow-conversation")
}

function extractOutput(raw: unknown): AzureScoreRow | undefined {
  const record = raw as {
    Results?: {
      WebServiceOutput0?: AzureScoreRow[]
    }
  }

  return record.Results?.WebServiceOutput0?.[0]
}

function getWorkflowConversationId() {
  const key = "azure-sport-workflow-conversation"
  const current = sessionStorage.getItem(key)

  if (current) {
    return current
  }

  const next = `web-${crypto.randomUUID()}`
  sessionStorage.setItem(key, next)
  return next
}

function parseMaybeJson(value: string) {
  if (!value.trim()) {
    return null
  }

  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function extractWorkflowText(raw: unknown): string {
  if (typeof raw === "string") {
    return cleanWorkflowText(raw) || "Le workflow a repondu sans contenu lisible."
  }

  if (!raw || typeof raw !== "object") {
    return "Le workflow a repondu sans contenu lisible."
  }

  const record = raw as {
    text?: string
    message?: string
    output_text?: string
    reply?: string
    activities?: Array<{ text?: string }>
    expectedReplies?: {
      activities?: Array<{ text?: string }>
    }
    body?: {
      activities?: Array<{ text?: string }>
    }
    output?: Array<{
      content?: Array<{
        text?: string
        type?: string
      }>
    }>
    choices?: Array<{ message?: { content?: string } }>
  }

  const responseOutputText = record.output
    ?.flatMap((item) => item.content ?? [])
    .find((content) => content.text)?.text

  const candidates = [
    record.text,
    record.output_text,
    record.message,
    record.reply,
    responseOutputText,
    record.choices?.find((choice) => choice.message?.content)?.message
      ?.content,
    ...(record.expectedReplies?.activities?.map((activity) => activity.text) ??
      []),
    ...(record.body?.activities?.map((activity) => activity.text) ?? []),
    ...(record.activities?.map((activity) => activity.text) ?? []),
  ]

  return selectBestWorkflowText(candidates) ?? JSON.stringify(raw, null, 2)
}

function selectBestWorkflowText(candidates: Array<string | undefined>) {
  return candidates
    .filter((candidate): candidate is string => Boolean(candidate?.trim()))
    .map(cleanWorkflowText)
    .filter((candidate) => candidate && !isRoutingJsonText(candidate))
    .at(-1)
}

function cleanWorkflowText(value: string) {
  return value
    .trim()
    .replace(/^```json\s*\{[\s\S]*?\}\s*```\s*/i, "")
    .replace(
      /^\{\s*"agent"\s*:\s*"[^"]+"\s*,\s*"reformulatedMessage"\s*:\s*"[^"]*"\s*\}\s*/i,
      ""
    )
    .trim()
}

function isRoutingJsonText(value: string) {
  try {
    const parsed = JSON.parse(value)

    return (
      parsed &&
      typeof parsed === "object" &&
      "agent" in parsed &&
      "reformulatedMessage" in parsed
    )
  } catch {
    return false
  }
}

function isActivityProtocolEndpoint(endpoint: string) {
  return endpoint.includes("/protocols/activityprotocol")
}

function resolveResponsesEndpoint(endpoint: string) {
  const trimmed = endpoint.trim()

  if (trimmed.endsWith("/protocols/openai")) {
    return `${trimmed}/responses`
  }

  return trimmed
}
