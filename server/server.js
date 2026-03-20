import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./configs/mongodb.js";
import { clerkWebhooks, stripeWebhooks } from "./controllers/webhooks.js";
import educatorRouter from "./routes/educatorRoutes.js";
import { clerkMiddleware } from "@clerk/express";
import connectCloudinary from "./configs/cloudinary.js";
import courseRouter from "./routes/courseRoute.js";
import userRouter from "./routes/userRoutes.js";

dotenv.config()

const app = express();

await connectDB();
await connectCloudinary();

app.use(cors({
  origin: ["https://lms-nhwv.vercel.app"],
  credentials: true,
}));
app.use(clerkMiddleware());

// Stripe Webhook (RAW body)
app.post(
  "/stripe-webhook",
  express.raw({ type: "application/json" }),
  stripeWebhooks
);

// Clerk Webhook
app.post("/clerk-webhook", express.raw({ type: "application/json" }), clerkWebhooks);

// Normal Routes
app.use(express.json());

app.use("/api/educator", educatorRouter);
app.use("/api/course", courseRouter);
app.use("/api/user", userRouter);

const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {

 return res.send({ success: true, message: "Test API Working" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});