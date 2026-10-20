import { Router } from "express";
import { db } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/appointments or /api/patient/appointments
router.get(["/", "/patient"], requireAuth, async (req, res, next) => {
  try {
    const list = await db.getAppointmentsByPatient(req.user.id, req.token);
    res.json({
      status: "success",
      count: list.length,
      appointments: list,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/appointments
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { hospitalId, hospital_id, specialty, date, time, reason, doctorId, doctor_id } = req.body;
    const targetHospitalId = hospitalId || hospital_id;

    if (!targetHospitalId) {
      return res.status(400).json({ error: "ValidationError", message: "Hospital ID is required." });
    }
    if (!date) {
      return res.status(400).json({ error: "ValidationError", message: "Appointment date is required." });
    }
    if (!time) {
      return res.status(400).json({ error: "ValidationError", message: "Appointment time is required." });
    }

    const hospital = await db.getHospitalById(targetHospitalId);
    if (!hospital) {
      return res.status(404).json({ error: "NotFound", message: "Selected hospital was not found." });
    }

    const appointment = await db.createAppointment(
      {
        patient_id: req.user.id,
        hospital_id: targetHospitalId,
        hospitalName: hospital.name,
        doctor_id: doctorId || doctor_id || null,
        specialty: specialty || "General Consultation",
        date,
        time,
        reason: reason || "",
      },
      req.token
    );

    await db.logAudit({
      user_id: req.user.id,
      action: "CREATE_APPOINTMENT",
      resource_type: "appointment",
      resource_id: appointment.id,
      ip_address: req.ip,
      details: { hospitalId: targetHospitalId, date, time },
    });

    res.status(201).json({
      status: "success",
      message: "Appointment request submitted. It will be marked pending confirmation until verified by hospital staff.",
      appointment,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/appointments/:id/reschedule
router.patch("/:id/reschedule", requireAuth, async (req, res, next) => {
  try {
    const { date, time, reason } = req.body;
    if (!date || !time) {
      return res.status(400).json({ error: "ValidationError", message: "New date and time are required." });
    }

    const isAdmin = ["admin", "hospital_staff"].includes(String(req.user.role).toLowerCase());
    const updated = await db.updateAppointment(
      req.params.id,
      {
        date,
        time,
        scheduled_at: `${date}T${time}:00Z`,
        status: "rescheduled",
        reschedule_reason: reason || "Patient requested reschedule",
      },
      req.user.id,
      isAdmin
    );

    await db.logAudit({
      user_id: req.user.id,
      action: "RESCHEDULE_APPOINTMENT",
      resource_type: "appointment",
      resource_id: req.params.id,
      ip_address: req.ip,
      details: { newDate: date, newTime: time },
    });

    res.json({
      status: "success",
      message: "Appointment rescheduled successfully.",
      appointment: updated,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/appointments/:id/cancel
router.patch("/:id/cancel", requireAuth, async (req, res, next) => {
  try {
    const { reason } = req.body;
    const isAdmin = ["admin", "hospital_staff"].includes(String(req.user.role).toLowerCase());

    const updated = await db.updateAppointment(
      req.params.id,
      {
        status: "cancelled",
        cancellation_reason: reason || "Cancelled by patient",
      },
      req.user.id,
      isAdmin
    );

    await db.logAudit({
      user_id: req.user.id,
      action: "CANCEL_APPOINTMENT",
      resource_type: "appointment",
      resource_id: req.params.id,
      ip_address: req.ip,
      details: { reason },
    });

    res.json({
      status: "success",
      message: "Appointment cancelled.",
      appointment: updated,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/appointments/:id/checkin
router.post("/:id/checkin", requireAuth, async (req, res, next) => {
  try {
    const isAdmin = ["admin", "hospital_staff"].includes(String(req.user.role).toLowerCase());
    const updated = await db.updateAppointment(
      req.params.id,
      {
        checked_in_at: new Date().toISOString(),
      },
      req.user.id,
      isAdmin
    );

    await db.logAudit({
      user_id: req.user.id,
      action: "HOSPITAL_CHECKIN",
      resource_type: "appointment",
      resource_id: req.params.id,
      ip_address: req.ip,
    });

    res.json({
      status: "success",
      message: "Self check-in recorded. Please proceed to the reception / waiting area.",
      appointment: updated,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
