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
          ? "Azure Vision n'a confirme aucune personne dans l'image."
          : `Azure Vision a detecte ${detectedPeople} personnes, alors que MediaPipe n'analyse qu'une pose.`,
        "Utilise une photo contenant une seule personne et une seule phase du mouvement.",
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
        "Place le corps entier dans l'image, des epaules aux chevilles.",
        "Utilise une photo nette, bien eclairee et prise de profil.",
      ],
    }
  }

  const advice: string[] = []

  if (kneeAngle > 125) {
    advice.push(
      `Flexion du genou mesuree a ${Math.round(kneeAngle)} deg : la position semble haute si la photo represente le bas du squat.`
    )
  } else if (kneeAngle < 70) {
    advice.push(
      `Flexion du genou mesuree a ${Math.round(kneeAngle)} deg : la position est tres profonde.`
    )
  } else {
    advice.push(
      `Flexion du genou mesuree a ${Math.round(kneeAngle)} deg, compatible avec une position basse sur cette image.`
    )
  }

  if (torsoInclination > 55) {
    advice.push(
      `Inclinaison du torse mesuree a ${Math.round(torsoInclination)} deg : elle est marquee, mais une photo 2D ne permet pas d'evaluer la neutralite du dos.`
    )
  } else {
    advice.push(
      `Inclinaison du torse mesuree a ${Math.round(torsoInclination)} deg sur le plan de l'image.`
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
