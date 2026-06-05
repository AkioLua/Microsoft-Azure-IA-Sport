import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

const azureScoreTarget =
  "http://c953e64f-4fc1-4e1c-a0d9-c8154f053f60.swedencentral.azurecontainer.io/score"

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

function readBody(request: NodeJS.ReadableStream) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)))
    request.on("end", () => resolve(Buffer.concat(chunks)))
    request.on("error", reject)
  })
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), azureScoreProxy()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
