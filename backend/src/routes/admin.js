import { Router } from "express";
import { db } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";

const router = Router();

// GET /api/admin/dashboard
router.get("/dashboard", requireAuth, requireRole("admin", "hospital_staff"), async (req, res, next) => {
  try {
    const stats = await db.getAdminStats();
    const recentLogs = await db.getAuditLogs(10);

    res.json({
      status: "success",
      ...stats,
      recentAuditLogs: recentLogs,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/audit-logs
router.get("/audit-logs", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const logs = await db.getAuditLogs(limit);

    res.json({
      status: "success",
      count: logs.length,
      logs,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/appointments/:id/status
router.patch("/appointments/:id/status", requireAuth, requireRole("admin", "hospital_staff"), async (req, res, next) => {
  try {
    const { status, note } = req.body;
    if (!["pending", "confirmed", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({ error: "ValidationError", message: "Invalid status value." });
    }

    const updated = await db.updateAppointment(
      req.params.id,
      { status, staff_note: note || "" },
      req.user.id,
      true // Admin privilege
    );

    await db.logAudit({
      user_id: req.user.id,
      action: "STAFF_UPDATE_APPOINTMENT_STATUS",
      resource_type: "appointment",
      resource_id: req.params.id,
      ip_address: req.ip,
      details: { newStatus: status, staffId: req.user.id },
    });

    res.json({
      status: "success",
      message: `Appointment updated to ${status}.`,
      appointment: updated,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
