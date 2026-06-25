import express, { Request, Response } from "express";
import cors from "cors";
import { writeFile } from "fs/promises";

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

app.use(cors());
app.use(express.json({ limit: "10mb" }));

async function openCashDrawer(): Promise<boolean> {
    console.log("Opening cash drawer...");

    try {
        const buffer = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0x19]);

        await writeFile("/dev/usb/lp0", buffer);

        console.log("Cash drawer opened");
        return true;
    } catch (error: any) {
        console.error("Failed to open cash drawer:", error.message);
        return false;
    }
}

interface PrintRequest {
    receiptData: number[];
    paymentMethod: string;
}

app.post(
    "/api/print",
    async (req: Request<{}, {}, PrintRequest>, res: Response) => {
        try {
            const { receiptData, paymentMethod } = req.body;

            console.log("=== RECEIVED REQUEST ===");
            console.log("Payment method:", paymentMethod);

            const buffer = Buffer.from(receiptData);

            const isCash =
                paymentMethod &&
                paymentMethod.toLowerCase() === "cash";

            if (isCash) {
                console.log("Opening cash drawer");

                const drawerCommand = Buffer.from([
                    0x1b,
                    0x70,
                    0x00,
                    0x19,
                    0x19,
                ]);

                const fullBuffer = Buffer.concat([
                    drawerCommand,
                    buffer,
                ]);

                await writeFile("/dev/usb/lp0", fullBuffer);

                console.log("Printed receipt and opened drawer");
            } else {
                await writeFile("/dev/usb/lp0", buffer);

                console.log("Printed receipt only");
            }

            res.json({
                success: true,
                message: "Receipt printed successfully",
            });
        } catch (error: any) {
            console.error("Print error:", error);

            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
);

app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
        status: "ok",
        printer: "/dev/usb/lp0",
        timestamp: new Date().toISOString(),
    });
});

app.post("/api/test-drawer", async (_req, res) => {
    const opened = await openCashDrawer();

    res.json({
        success: opened,
        message: opened
            ? "Drawer opened"
            : "Failed to open drawer",
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(
        `Print server running on http://0.0.0.0:${PORT}`
    );

    console.log("Printer device: /dev/usb/lp0");
});