import { Router } from "express";
import { db } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/records
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const records = await db.getMedicalRecords(req.user.id);
    res.json({
      status: "success",
      count: records.length,
      records,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/records
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { title, recordType, hospitalName, doctorName, recordDate, notes, fileName, fileData, fileSize, mimeType, privacyLevel } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "ValidationError", message: "Record title is required." });
    }

    const record = await db.createMedicalRecord({
      patient_id: req.user.id,
      title: title.trim(),
      record_type: recordType || "Clinical Report",
      hospital_name: hospitalName || "",
      doctor_name: doctorName || "",
      record_date: recordDate || new Date().toISOString().slice(0, 10),
      notes: notes || "",
      file_name: fileName || null,
      file_data: fileData || null,
      file_size: fileSize || (fileData ? Math.round(fileData.length * 0.75) : 0),
      mime_type: mimeType || "application/pdf",
      privacy_level: privacyLevel || "private",
    });

    await db.logAudit({
      user_id: req.user.id,
      action: "UPLOAD_MEDICAL_RECORD",
      resource_type: "medical_record",
      resource_id: record.id,
      ip_address: req.ip,
      details: { title: record.title, type: record.record_type, privacyLevel: record.privacy_level },
    });

    res.status(201).json({
      status: "success",
      message: "Medical record securely saved.",
      record,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/records/:id
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const result = await db.deleteMedicalRecord(req.params.id, req.user.id);
    if (!result.success) {
      return res.status(404).json({ error: "NotFound", message: "Record not found or not owned by you." });
    }

    await db.logAudit({
      user_id: req.user.id,
      action: "DELETE_MEDICAL_RECORD",
      resource_type: "medical_record",
      resource_id: req.params.id,
      ip_address: req.ip,
    });

    res.json({
      status: "success",
      message: "Medical record removed.",
    });
  } catch (err) {
    next(err);
  }
});

export default router;
