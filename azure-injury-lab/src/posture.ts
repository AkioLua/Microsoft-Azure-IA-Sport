import { POSE_LANDMARK, type PoseDetection } from "@/pose"

export type PoseSide = "left" | "right"
export type SquatStatus = "correct" | "improve" | "not-analyzable"

export type SquatAssessment = {
  status: SquatStatus
  label: string
  side: PoseSide
  visibility: number
  kneeAngle: number
  hipAngle: number
  torsoInclination: number
  advice: string[]
}

type Point2D = {
  x: number
  y: number
}

const minimumLandmarkVisibility = 0.35
const minimumAverageVisibility = 0.5

export function assessSquat(
  pose: PoseDetection,
  imageWidth: number,
  imageHeight: number,
  detectedPeople = 1
): SquatAssessment {
  const side = selectMostVisibleSide(pose)
  const indices = getSideIndices(side)
  const selectedLandmarks = [
    pose.landmarks[indices.shoulder],
    pose.landmarks[indices.hip],
    pose.landmarks[indices.knee],
    pose.landmarks[indices.ankle],
  ]
  const visibility = average(
    selectedLandmarks.map((landmark) => landmark?.visibility ?? 0)
  )
  const hasHiddenLandmark = selectedLandmarks.some(
    (landmark) => !landmark || landmark.visibility < minimumLandmarkVisibility
  )

  const shoulder = toImagePoint(
    pose.landmarks[indices.shoulder],
    imageWidth,
    imageHeight
  )
  const hip = toImagePoint(
    pose.landmarks[indices.hip],
    imageWidth,
    imageHeight
  )
  const knee = toImagePoint(
    pose.landmarks[indices.knee],
    imageWidth,
    imageHeight
  )
  const ankle = toImagePoint(
    pose.landmarks[indices.ankle],
    imageWidth,
    imageHeight
  )

  const kneeAngle = angleAtPoint(hip, knee, ankle)
  const hipAngle = angleAtPoint(shoulder, hip, knee)
  const torsoInclination = angleFromVertical(shoulder, hip)

  if (detectedPeople !== 1) {
    return {
      status: "not-analyzable",
      label:
        detectedPeople === 0
          ? "Personne non confirmee"
          : "Image avec plusieurs personnes",
      side,
      visibility,
      kneeAngle,
      hipAngle,
      torsoInclination,
      advice: [
        detectedPeople === 0
          ? "Je n'arrive pas a confirmer clairement la presence d'une personne sur cette photo."
          : `Je vois ${detectedPeople} personnes sur l'image, donc l'analyse du squat risque de melanger les poses.`,
        "Essaie avec une photo ou une seule personne est visible, pendant une seule phase du mouvement.",
      ],
    }
  }

  if (
    hasHiddenLandmark ||
    visibility < minimumAverageVisibility ||
    !Number.isFinite(kneeAngle) ||
    !Number.isFinite(hipAngle) ||
    !Number.isFinite(torsoInclination)
  ) {
    return {
      status: "not-analyzable",
      label: "Photo non analysable",
      side,
      visibility,
      kneeAngle,
      hipAngle,
      torsoInclination,
      advice: [
        "Je ne vois pas assez bien les points importants du corps pour donner un avis fiable.",
        "Reprends une photo nette, de profil, avec le corps entier visible des epaules aux chevilles.",
      ],
    }
  }

  const advice: string[] = []

  if (kneeAngle > 125) {
    advice.push(
      `Le genou est mesure a ${Math.round(kneeAngle)} deg : si cette image correspond au bas du squat, la descente semble encore assez haute.`
    )
  } else if (kneeAngle < 70) {
    advice.push(
      `Le genou est mesure a ${Math.round(kneeAngle)} deg : la position est tres profonde, donc il faut surtout verifier que le mouvement reste controle.`
    )
  } else {
    advice.push(
      `Le genou est mesure a ${Math.round(kneeAngle)} deg : la flexion semble coherente pour une position basse de squat.`
    )
  }

  if (torsoInclination > 55) {
    advice.push(
      `Le torse est incline a ${Math.round(torsoInclination)} deg : la penchee est importante, donc il faut verifier que le dos reste stable pendant le mouvement.`
    )
  } else {
    advice.push(
      `Le torse est incline a ${Math.round(torsoInclination)} deg : l'inclinaison parait raisonnable sur cette image.`
    )
  }

  const status =
    kneeAngle >= 70 && kneeAngle <= 125 && torsoInclination <= 55
      ? "correct"
      : "improve"

  return {
    status,
    label:
      status === "correct" ? "Reperes compatibles" : "Reperes a verifier",
    side,
    visibility,
    kneeAngle,
    hipAngle,
    torsoInclination,
    advice,
  }
}

export function selectMostVisibleSide(pose: PoseDetection): PoseSide {
  const leftVisibility = sideVisibility(pose, "left")
  const rightVisibility = sideVisibility(pose, "right")
  return leftVisibility >= rightVisibility ? "left" : "right"
}

export function getSideLandmarkIndices(side: PoseSide) {
  const indices = getSideIndices(side)
  return [indices.shoulder, indices.hip, indices.knee, indices.ankle]
}

function getSideIndices(side: PoseSide) {
  return side === "left"
    ? {
        shoulder: POSE_LANDMARK.leftShoulder,
        hip: POSE_LANDMARK.leftHip,
        knee: POSE_LANDMARK.leftKnee,
        ankle: POSE_LANDMARK.leftAnkle,
      }
    : {
        shoulder: POSE_LANDMARK.rightShoulder,
        hip: POSE_LANDMARK.rightHip,
        knee: POSE_LANDMARK.rightKnee,
        ankle: POSE_LANDMARK.rightAnkle,
      }
}

function sideVisibility(pose: PoseDetection, side: PoseSide) {
  return average(
    getSideLandmarkIndices(side).map(
      (index) => pose.landmarks[index]?.visibility ?? 0
    )
  )
}

function toImagePoint(
  landmark: PoseDetection["landmarks"][number] | undefined,
  imageWidth: number,
  imageHeight: number
): Point2D {
  return {
    x: (landmark?.x ?? Number.NaN) * imageWidth,
    y: (landmark?.y ?? Number.NaN) * imageHeight,
  }
}

function angleAtPoint(first: Point2D, center: Point2D, last: Point2D) {
  const firstVector = {
    x: first.x - center.x,
    y: first.y - center.y,
  }
  const lastVector = {
    x: last.x - center.x,
    y: last.y - center.y,
  }
  const denominator =
    Math.hypot(firstVector.x, firstVector.y) *
    Math.hypot(lastVector.x, lastVector.y)

  if (!denominator) {
    return Number.NaN
  }

  const cosine = clamp(
    (firstVector.x * lastVector.x + firstVector.y * lastVector.y) /
      denominator,
    -1,
    1
  )

  return radiansToDegrees(Math.acos(cosine))
}

function angleFromVertical(shoulder: Point2D, hip: Point2D) {
  const torso = {
    x: shoulder.x - hip.x,
    y: shoulder.y - hip.y,
  }
  const length = Math.hypot(torso.x, torso.y)

  if (!length) {
    return Number.NaN
  }

  return radiansToDegrees(Math.acos(clamp(Math.abs(torso.y) / length, -1, 1)))
}

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function radiansToDegrees(value: number) {
  return (value * 180) / Math.PI
}
