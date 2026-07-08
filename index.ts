const express = require("express")
const cors = require("cors")
const fs = require("fs")
const os = require("os")
const path = require("path")
const { exec } = require("child_process")

const app = express()
const PORT = parseInt(process.env.PORT || "3001", 10)
const PRINTER_SHARE = process.env.PRINTER_SHARE || "TDPRINTER" // Windows shared printer name

app.use(cors())
app.use(express.json({ limit: "10mb" }))

function printRawBuffer(buffer) {
    return new Promise((resolve, reject) => {
        const tempFile = path.join(os.tmpdir(), `receipt-${Date.now()}.prn`)
        fs.writeFileSync(tempFile, buffer)
        const target = `\\\\localhost\\${PRINTER_SHARE}`
        exec(`copy /b "${tempFile}" "${target}"`, (error) => {
            fs.unlink(tempFile, () => {})
            if (error) reject(error)
            else resolve()
        })
    })
}

app.post("/api/print", async (req, res) => {
    try {
        const { receiptData, paymentMethod } = req.body
        console.log("=== RECEIVED REQUEST ===")
        console.log("Payment method:", paymentMethod)

        const buffer = Buffer.from(receiptData)
        const isCash = paymentMethod && paymentMethod.toLowerCase() === "cash"

        if (isCash) {
            const drawerCommand = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0x19])
            const fullBuffer = Buffer.concat([drawerCommand, buffer])
            await printRawBuffer(fullBuffer)
            console.log("Printed receipt and opened drawer")
        } else {
            await printRawBuffer(buffer)
            console.log("Printed receipt only")
        }

        res.json({ success: true, message: "Receipt printed successfully" })
    } catch (error) {
        console.error("Print error:", error)
        res.status(500).json({ success: false, error: error.message })
    }
})

app.get("/api/health", (_req, res) => {
    res.json({
        status: "ok",
        printerShare: PRINTER_SHARE,
        timestamp: new Date().toISOString(),
    })
})

app.listen(PORT, "127.0.0.1", () => {
    console.log(`Print server running on http://127.0.0.1:${PORT}`)
    console.log(`Printer share: \\\\localhost\\${PRINTER_SHARE}`)
})
