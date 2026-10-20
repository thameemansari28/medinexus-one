import { Router } from "express";
const router = Router();

router.get("/", async (req, res) => {
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);
  const twilioConfigured = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
  const paymentConfigured = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  res.json({
    status: "ok",
    service: "MediNexus One API",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    integrations: {
      database: "local_json",
      localAuth: "active",
      localAccountStore: "ready",
      aiProvider: geminiConfigured ? "configured" : "fallback_rules_engine",
      smsProvider: twilioConfigured ? "configured" : "unconfigured_honest_notice",
      paymentGateway: paymentConfigured ? "configured" : "unconfigured_demo_estimates_only"
    }
  });
});

export default router;
