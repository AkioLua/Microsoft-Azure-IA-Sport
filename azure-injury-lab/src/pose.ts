import type {
  Landmark,
  NormalizedLandmark,
  PoseLandmarker,
} from "@mediapipe/tasks-vision"

const wasmBaseUrl = "/mediapipe/wasm"
const poseModelPath = "/models/pose_landmarker_lite.task"

let poseLandmarkerPromise: Promise<PoseLandmarker> | null = null

export const POSE_LANDMARK = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32,
} as const

export const POSE_CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 7],
  [0, 4],
  [4, 5],
  [5, 6],
  [6, 8],
  [9, 10],
  [11, 12],
  [11, 13],
  [13, 15],
  [15, 17],
  [15, 19],
  [15, 21],
  [17, 19],
  [12, 14],
  [14, 16],
  [16, 18],
  [16, 20],
  [16, 22],
  [18, 20],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [24, 26],
  [25, 27],
  [26, 28],
  [27, 29],
  [28, 30],
  [29, 31],
  [30, 32],
  [27, 31],
  [28, 32],
].map(([start, end]) => ({ start, end }))

export type PoseDetection = {
  landmarks: NormalizedLandmark[]
  worldLandmarks: Landmark[]
}

export type PoseImageSource =
  | HTMLImageElement
  | HTMLCanvasElement
  | HTMLVideoElement
  | ImageBitmap

export async function initializePoseLandmarker() {
  if (typeof window === "undefined") {
    throw new Error("MediaPipe doit etre initialise dans le navigateur.")
  }

  if (!poseLandmarkerPromise) {
    poseLandmarkerPromise = createPoseLandmarker().catch((error: unknown) => {
      poseLandmarkerPromise = null
      const detail =
        error instanceof Error ? error.message : "Erreur MediaPipe inconnue."
      throw new Error(`Impossible de charger MediaPipe. ${detail}`)
    })
  }

  return poseLandmarkerPromise
}

export async function detectPose(
  image: PoseImageSource
): Promise<PoseDetection | null> {
  assertImageReady(image)

  const poseLandmarker = await initializePoseLandmarker()
  const result = poseLandmarker.detect(image)
  const landmarks = result.landmarks[0]
  const worldLandmarks = result.worldLandmarks[0]

  if (!landmarks || !worldLandmarks) {
    result.close()
    return null
  }

  const detection = {
    landmarks: landmarks.map((landmark) => ({ ...landmark })),
    worldLandmarks: worldLandmarks.map((landmark) => ({ ...landmark })),
  }

  result.close()
  return detection
}

export async function closePoseLandmarker() {
  if (!poseLandmarkerPromise) {
    return
  }

  const poseLandmarker = await poseLandmarkerPromise
  poseLandmarker.close()
  poseLandmarkerPromise = null
}

export function drawPoseOverlay(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  pose: PoseDetection | null,
  highlightedLandmarks: number[] = []
) {
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight

  const context = canvas.getContext("2d")

  if (!context) {
    throw new Error("Le canvas de visualisation n'est pas disponible.")
  }

  context.clearRect(0, 0, canvas.width, canvas.height)

  if (!pose) {
    return
  }

  const highlighted = new Set(highlightedLandmarks)
  const lineWidth = Math.max(3, Math.round(canvas.width / 300))
  const pointRadius = Math.max(4, Math.round(canvas.width / 220))

  context.lineCap = "round"
  context.lineJoin = "round"

  for (const connection of POSE_CONNECTIONS) {
    const start = pose.landmarks[connection.start]
    const end = pose.landmarks[connection.end]

    if (!start || !end || start.visibility < 0.4 || end.visibility < 0.4) {
      continue
    }

    const isHighlighted =
      highlighted.has(connection.start) && highlighted.has(connection.end)
    context.beginPath()
    context.moveTo(start.x * canvas.width, start.y * canvas.height)
    context.lineTo(end.x * canvas.width, end.y * canvas.height)
    context.strokeStyle = isHighlighted
      ? "rgba(16, 185, 129, 0.95)"
      : "rgba(56, 189, 248, 0.75)"
    context.lineWidth = isHighlighted ? lineWidth * 1.5 : lineWidth
    context.stroke()
  }

  pose.landmarks.forEach((landmark, index) => {
    if (landmark.visibility < 0.4) {
      return
    }

    context.beginPath()
    context.arc(
      landmark.x * canvas.width,
      landmark.y * canvas.height,
      highlighted.has(index) ? pointRadius * 1.35 : pointRadius,
      0,
      Math.PI * 2
    )
    context.fillStyle = highlighted.has(index)
      ? "rgba(16, 185, 129, 1)"
      : "rgba(255, 255, 255, 0.95)"
    context.fill()
    context.lineWidth = Math.max(2, lineWidth / 2)
    context.strokeStyle = "rgba(15, 23, 42, 0.85)"
    context.stroke()
  })
}

async function createPoseLandmarker() {
  const { FilesetResolver, PoseLandmarker } = await import(
    "@mediapipe/tasks-vision"
  )
  const vision = await FilesetResolver.forVisionTasks(wasmBaseUrl)

  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: poseModelPath,
      delegate: "CPU",
    },
    runningMode: "IMAGE",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputSegmentationMasks: false,
  })
}

function assertImageReady(image: PoseImageSource) {
  if (
    image instanceof HTMLImageElement &&
    (!image.complete || image.naturalWidth === 0)
  ) {
    throw new Error("L'image doit etre entierement chargee avant l'analyse.")
  }

  if (image instanceof HTMLVideoElement && image.readyState < 2) {
    throw new Error("La video n'est pas encore prete pour l'analyse.")
  }
}
