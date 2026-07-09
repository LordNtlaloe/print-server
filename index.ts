import express, { Request, Response } from "express"
import { WebSocketServer, WebSocket } from "ws"
import http from "http"

const app = express()
app.use(express.json({ limit: "10mb" }))

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: "/agent" })

const connectedAgents = new Map<string, WebSocket>()

const RELAY_SECRET = process.env.RELAY_SECRET

wss.on("connection", (ws: WebSocket, req: http.IncomingMessage) => {
    const url = new URL(req.url || "", "http://localhost")
    const agentId = url.searchParams.get("agentId")
    const token = url.searchParams.get("token")

    if (token !== RELAY_SECRET || !agentId) {
        ws.close(4001, "Unauthorized")
        return
    }

    connectedAgents.set(agentId, ws)
    console.log(`Agent connected: ${agentId}`)

    ws.on("close", () => {
        connectedAgents.delete(agentId)
        console.log(`Agent disconnected: ${agentId}`)
    })

    ws.on("message", (raw: Buffer) => {
        try {
            const msg = JSON.parse(raw.toString())
            console.log(`Ack from ${agentId}:`, msg)
        } catch {
            // ignore malformed messages
        }
    })
})

app.post("/print/:agentId", (req: Request, res: Response) => {
    const { agentId } = req.params
    const { receiptData, paymentMethod } = req.body
    const auth = req.headers.authorization

    if (auth !== `Bearer ${RELAY_SECRET}`) {
        return res.status(401).json({ success: false, error: "Unauthorized" })
    }

    const agent = connectedAgents.get(agentId)
    if (!agent || agent.readyState !== WebSocket.OPEN) {
        return res.status(503).json({ success: false, error: "Printer agent offline for this address" })
    }

    agent.send(JSON.stringify({ type: "print", jobId: Date.now().toString(), receiptData, paymentMethod }))
    res.json({ success: true, message: "Job sent to printer agent" })
})

app.get("/health", (_req: Request, res: Response) => {
    res.json({
        status: "ok",
        connectedAgents: Array.from(connectedAgents.keys()),
    })
})

const PORT = parseInt(process.env.PORT || "8080", 10)

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Relay listening on 0.0.0.0:${PORT}`)
})
