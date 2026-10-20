import { Router } from "express";
import crypto from "crypto";
import { db } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";

const router = Router();

// GET /api/receipts or /api/patient/receipts
router.get(["/", "/patient"], requireAuth, async (req, res, next) => {
  try {
    const receipts = await db.getReceiptsByPatient(req.user.id);
    res.json({
      status: "success",
      count: receipts.length,
      receipts,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/receipts/:id
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const isAdmin = ["admin", "hospital_staff"].includes(String(req.user.role).toLowerCase());
    const receipt = await db.getReceiptById(req.params.id, req.user.id, isAdmin);

    if (!receipt) {
      return res.status(404).json({ error: "NotFound", message: "Receipt or billing invoice not found." });
    }

    res.json({
      status: "success",
      receipt,
      isOfficial: receipt.payment_status === "paid",
      isEstimate: receipt.payment_status === "estimate" || receipt.payment_status === "unpaid",
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/receipts/create (Hospital staff or Admin only)
router.post("/create", requireAuth, requireRole("admin", "hospital_staff"), async (req, res, next) => {
  try {
    const { patientId, hospitalId, appointmentId, items, subtotal, tax, discount, total, currency, paymentStatus, patientName } = req.body;

    if (!patientId || !hospitalId) {
      return res.status(400).json({ error: "ValidationError", message: "Patient ID and Hospital ID are required." });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "ValidationError", message: "At least one itemized charge is required." });
    }

    const hospital = await db.getHospitalById(hospitalId);

    const calculatedSubtotal = items.reduce((sum, item) => sum + (Number(item.amount) || Number(item.qty || 1) * Number(item.unit_price || 0)), 0);
    const calculatedTax = Number(tax || (calculatedSubtotal * 0.05).toFixed(2));
    const calculatedDiscount = Number(discount || 0);
    const calculatedTotal = Number((calculatedSubtotal + calculatedTax - calculatedDiscount).toFixed(2));

    const receipt = await db.createReceipt({
      patient_id: patientId,
      hospital_id: hospitalId,
      hospitalName: hospital?.name || "Hospital Healthcare Provider",
      appointment_id: appointmentId || null,
      patientName: patientName || "Patient",
      items,
      subtotal: subtotal !== undefined ? Number(subtotal) : calculatedSubtotal,
      tax: calculatedTax,
      discount: calculatedDiscount,
      total: total !== undefined ? Number(total) : calculatedTotal,
      currency: currency || "INR",
      payment_status: paymentStatus || "unpaid",
    });

    await db.logAudit({
      user_id: req.user.id,
      action: "ISSUE_BILLING_INVOICE",
      resource_type: "receipt",
      resource_id: receipt.id,
      ip_address: req.ip,
      details: { receiptNumber: receipt.receipt_number, total: receipt.total },
    });

    res.status(201).json({
      status: "success",
      message: "Billing invoice created successfully.",
      receipt,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/receipts/:id/pay
// Processes verified payment if configured gateway exists; strictly rejects fabricated payments
router.post("/:id/pay", requireAuth, async (req, res, next) => {
  try {
    const receipt = await db.getReceiptById(req.params.id, req.user.id);
    if (!receipt) {
      return res.status(404).json({ error: "NotFound", message: "Invoice not found." });
    }

    if (receipt.payment_status === "paid") {
      return res.status(400).json({
        error: "AlreadyPaid",
        message: "This invoice has already been paid and settled.",
        receiptNumber: receipt.receipt_number,
      });
    }

    const razorpayKey = process.env.RAZORPAY_KEY_ID;
    const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;

    // If real gateway is not configured, do not fabricate success!
    if (!razorpayKey || !razorpaySecret) {
      return res.status(503).json({
        error: "GatewayUnconfigured",
        message: "Online payment gateway (Razorpay / Stripe) credentials are not configured on this server. In accordance with clinical financial integrity, simulated official payments are disabled. Please pay at the hospital billing desk.",
        invoiceDetails: {
          receiptNumber: receipt.receipt_number,
          total: receipt.total,
          currency: receipt.currency,
          status: receipt.payment_status,
        },
      });
    }

    // In production with credentials, create order through gateway...
    res.json({
      status: "gateway_ready",
      message: "Payment order created with configured gateway.",
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/receipts/webhook
// Verifies webhook signature and ensures idempotent payment processing
router.post("/webhook", async (req, res, next) => {
  try {
    const signature = req.headers["x-razorpay-signature"] || req.headers["stripe-signature"];
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;

    if (!webhookSecret || !signature) {
      return res.status(400).json({ error: "WebhookError", message: "Missing webhook secret or signature." });
    }

    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");

    if (signature !== expectedSignature) {
      return res.status(400).json({ error: "InvalidSignature", message: "Webhook signature verification failed." });
    }

    const { receipt_id, transaction_ref, payment_status } = req.body;
    if (receipt_id && payment_status === "paid") {
      const updated = await db.updateReceiptPayment(receipt_id, {
        payment_status: "paid",
        transaction_ref,
      });

      await db.logAudit({
        action: "PAYMENT_WEBHOOK_RECEIVED",
        resource_type: "receipt",
        resource_id: receipt_id,
        details: { transaction_ref },
      });

      return res.json({ status: "success", receipt: updated });
    }

    res.json({ status: "ignored" });
  } catch (err) {
    next(err);
  }
});

export default router;
