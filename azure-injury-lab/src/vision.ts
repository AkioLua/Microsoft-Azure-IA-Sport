export type VisionBoundingBox = {
  x: number
  y: number
  w: number
  h: number
}

export type VisionTag = {
  name: string
  confidence: number
}

export type VisionPerson = {
  boundingBox: VisionBoundingBox
  confidence: number
}

export type VisionObject = {
  boundingBox: VisionBoundingBox
  tags: VisionTag[]
}

export type VisionAnalysis = {
  metadata: {
    width: number
    height: number
  }
  tagsResult?: {
    values: VisionTag[]
  }
  objectsResult?: {
    values: VisionObject[]
  }
  peopleResult?: {
    values: VisionPerson[]
  }
  modelVersion?: string
}

const maxImageSize = 20 * 1024 * 1024
const supportedImageTypes = new Set([
  "image/bmp",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
])

export function validateVisionImage(file: File) {
  if (!supportedImageTypes.has(file.type)) {
    return "Utilise une image JPEG, PNG, GIF, BMP ou WebP."
  }

  if (file.size > maxImageSize) {
    return "L'image depasse la limite de 20 Mo."
  }

  return null
}

export async function analyzeVisionImage(file: File) {
  const response = await fetch("/api/vision/analyze", {
    method: "POST",
    headers: {
      "Content-Type": file.type,
    },
    body: file,
  })

  const rawText = await response.text()
  const raw = parseJson(rawText)

  if (!response.ok) {
    throw new Error(extractVisionError(raw, response.status))
  }

  return raw as VisionAnalysis
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

function extractVisionError(raw: unknown, status: number) {
  if (typeof raw === "string" && raw.trim()) {
    return `Azure Vision a repondu ${status}. ${raw}`
  }

  if (raw && typeof raw === "object") {
    const record = raw as {
      error?: string | { message?: string }
      message?: string
    }

    if (typeof record.error === "string") {
      return record.error
    }

    if (record.error?.message) {
      return `Azure Vision a repondu ${status}. ${record.error.message}`
    }

    if (record.message) {
      return `Azure Vision a repondu ${status}. ${record.message}`
    }
  }

  return `Azure Vision a repondu ${status}.`
}
