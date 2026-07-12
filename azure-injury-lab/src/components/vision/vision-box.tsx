import type { VisionBoundingBox } from "@/vision"

export function VisionBox({
  box,
  imageWidth,
  imageHeight,
  label,
}: {
  box: VisionBoundingBox
  imageWidth: number
  imageHeight: number
  label: string
}) {
  return (
    <div
      className="pointer-events-none absolute z-20 border-2 border-emerald-400"
      style={{
        left: toPercent(box.x, imageWidth),
        top: toPercent(box.y, imageHeight),
        width: toPercent(box.w, imageWidth),
        height: toPercent(box.h, imageHeight),
      }}
    >
      <span className="absolute left-0 top-0 bg-emerald-500 px-1.5 py-1 text-xs font-medium text-white">
        {label}
      </span>
    </div>
  )
}

function toPercent(value: number, total: number) {
  return `${(value / total) * 100}%`
}
