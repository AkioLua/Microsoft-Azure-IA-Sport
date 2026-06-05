type ChartPoint = {
  x: number
  y: number
}

export type ModelMetrics = {
  auc: number
  threshold: number
  precision: number
  recall: number
  accuracy: number
  f1: number
  confusionMatrix: {
    tp: number
    tn: number
    fp: number
    fn: number
  }
}

export type ModelData = {
  roc: ChartPoint[]
  precisionRecall: ChartPoint[]
  lift: ChartPoint[]
  metrics: ModelMetrics
}

const parseNumber = (value: string) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export async function loadChartData(): Promise<ModelData> {
  const [rocText, prText, liftText, evaluation] = await Promise.all([
    fetch("/data/roc-curve.tsv").then((response) => response.text()),
    fetch("/data/precision-recall-curve.tsv").then((response) =>
      response.text()
    ),
    fetch("/data/lift-curve.tsv").then((response) => response.text()),
    fetch("/data/model-evaluation.visualization").then((response) =>
      response.json()
    ),
  ])

  const chart = evaluation.reports?.[0]?.chart
  const best = [...(chart?.data ?? [])].sort((a, b) => b.f1 - a.f1)[0]

  return {
    roc: parseTsv(rocText, "ROC curve.False positive rate", "ROC curve"),
    precisionRecall: parseTsv(
      prText,
      "Precision-recall curve.Recall",
      "Precision-recall curve"
    ),
    lift: parseTsv(liftText, "Lift curve.Positive rate", "Lift curve"),
    metrics: {
      auc: chart?.auc ?? 0,
      threshold: best?.probability ?? 0.554,
      precision: best?.precision ?? 0,
      recall: best?.recall ?? 0,
      accuracy: best?.accuracy ?? 0,
      f1: best?.f1 ?? 0,
      confusionMatrix: best?.confusionMatrix ?? {
        tp: 0,
        tn: 0,
        fp: 0,
        fn: 0,
      },
    },
  }
}

function parseTsv(text: string, xKey: string, yKey: string): ChartPoint[] {
  const rows = text.trim().split(/\r?\n/)
  const headers = rows.shift()?.split("\t") ?? []
  const xIndex = headers.indexOf(xKey)
  const yIndex = headers.indexOf(yKey)

  return rows
    .map((row) => {
      const columns = row.split("\t")
      return {
        x: parseNumber(columns[xIndex] ?? ""),
        y: parseNumber(columns[yIndex] ?? ""),
      }
    })
    .filter(
      (point): point is ChartPoint => point.x !== null && point.y !== null
    )
    .filter((_, index) => index % 12 === 0)
}
