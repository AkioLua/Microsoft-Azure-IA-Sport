import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type Plugin } from "vite"

const azureScoreTarget =
  "http://c953e64f-4fc1-4e1c-a0d9-c8154f053f60.swedencentral.azurecontainer.io/score"
const visionApiVersion = "2024-02-01"
const visionFeatures = "tags,objects,people"
const maxVisionImageSize = 20 * 1024 * 1024
const supportedVisionContentTypes = new Set([
  "application/octet-stream",
  "image/bmp",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
])

function azureScoreProxy(): Plugin {
  return {
    name: "azure-score-proxy",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const requestUrl = new URL(request.url ?? "", "http://localhost")

        if (requestUrl.pathname !== "/api/score") {
          next()
          return
        }

        const endpoint =
          requestUrl.searchParams.get("endpoint") ?? azureScoreTarget

        if (!isAllowedAzureEndpoint(endpoint)) {
          response.statusCode = 400
          response.end("Endpoint Azure ML invalide.")
          return
        }

        try {
          const body = await readBody(request)
          const azureResponse = await fetch(endpoint, {
            method: request.method ?? "POST",
            headers: {
              "content-type":
                request.headers["content-type"] ?? "application/json",
              authorization: request.headers.authorization ?? "",
            },
            body,
          })

          response.statusCode = azureResponse.status
          response.setHeader(
            "content-type",
            azureResponse.headers.get("content-type") ?? "application/json"
          )
          response.end(Buffer.from(await azureResponse.arrayBuffer()))
        } catch (error) {
          response.statusCode = 502
          response.end(
            error instanceof Error ? error.message : "Erreur proxy Azure ML."
          )
        }
      })
    },
  }
}

function azureVisionProxy(endpoint: string, key: string): Plugin {
  return {
    name: "azure-vision-proxy",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const requestUrl = new URL(request.url ?? "", "http://localhost")

        if (requestUrl.pathname !== "/api/vision/analyze") {
          next()
          return
        }

        response.setHeader("content-type", "application/json")

        if (request.method !== "POST") {
          response.statusCode = 405
          response.setHeader("allow", "POST")
          response.end(JSON.stringify({ error: "Methode POST requise." }))
          return
        }

        if (!endpoint || !key) {
          response.statusCode = 503
          response.end(
            JSON.stringify({
              error:
                "Azure Vision n'est pas configure. Renseigne VISION_ENDPOINT et VISION_KEY dans .env, puis redemarre Vite.",
            })
          )
          return
        }

        if (!isAllowedVisionEndpoint(endpoint)) {
          response.statusCode = 500
          response.end(
            JSON.stringify({
              error: "VISION_ENDPOINT n'est pas un endpoint Azure Vision valide.",
            })
          )
          return
        }

        const contentType = normalizeContentType(request.headers["content-type"])

        if (!supportedVisionContentTypes.has(contentType)) {
          response.statusCode = 415
          response.end(
            JSON.stringify({
              error:
                "Format non pris en charge. Utilise une image JPEG, PNG, GIF, BMP ou WebP.",
            })
          )
          return
        }

        try {
          const body = await readBody(request, maxVisionImageSize)

          if (body.length === 0) {
            response.statusCode = 400
            response.end(JSON.stringify({ error: "L'image est vide." }))
            return
          }

          const azureResponse = await fetch(createVisionAnalyzeUrl(endpoint), {
            method: "POST",
            headers: {
              "content-type": contentType,
              "ocp-apim-subscription-key": key,
            },
            body,
          })
          const responseBody = Buffer.from(await azureResponse.arrayBuffer())

          response.statusCode = azureResponse.status
          response.setHeader(
            "content-type",
            azureResponse.headers.get("content-type") ?? "application/json"
          )
          response.end(responseBody)
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Erreur lors de l'appel Azure Vision."
          response.statusCode = message.includes("20 Mo") ? 413 : 502
          response.end(JSON.stringify({ error: message }))
        }
      })
    },
  }
}

function isAllowedAzureEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint)
    return (
      ["http:", "https:"].includes(url.protocol) &&
      url.hostname.endsWith(".azurecontainer.io") &&
      url.pathname === "/score"
    )
  } catch {
    return false
  }
}

function isAllowedVisionEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint)
    return (
      url.protocol === "https:" &&
      (url.hostname.endsWith(".cognitiveservices.azure.com") ||
        url.hostname.endsWith(".api.cognitive.microsoft.com"))
    )
  } catch {
    return false
  }
}

function createVisionAnalyzeUrl(endpoint: string) {
  const url = new URL(
    "/computervision/imageanalysis:analyze",
    endpoint.endsWith("/") ? endpoint : `${endpoint}/`
  )
  url.searchParams.set("api-version", visionApiVersion)
  url.searchParams.set("features", visionFeatures)
  return url
}

function normalizeContentType(contentType: string | undefined) {
  return contentType?.split(";", 1)[0]?.trim().toLowerCase() ?? ""
}

function readBody(request: NodeJS.ReadableStream, maxBytes?: number) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    let rejected = false

    request.on("data", (chunk) => {
      if (rejected) {
        return
      }

      const buffer = Buffer.from(chunk)
      size += buffer.length

      if (maxBytes && size > maxBytes) {
        rejected = true
        reject(new Error("L'image depasse la limite de 20 Mo."))
        return
      }

      chunks.push(buffer)
    })
    request.on("end", () => resolve(Buffer.concat(chunks)))
    request.on("error", reject)
  })
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")

  return {
    plugins: [
      react(),
      tailwindcss(),
      azureScoreProxy(),
      azureVisionProxy(env.VISION_ENDPOINT, env.VISION_KEY),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})
