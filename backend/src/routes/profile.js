import { Router } from "express";
import { db } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/auth/me or /api/profile/me
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const profile = await db.getProfile(req.user.id);
    res.json({
      status: "success",
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
        fullName: profile?.full_name || req.user.fullName,
        phone: profile?.phone || "",
        bloodGroup: profile?.blood_group || "",
        allergies: profile?.allergies || [],
        chronicConditions: profile?.chronic_conditions || [],
        currentMedications: profile?.current_medications || [],
        emergencyNotes: profile?.emergency_notes || "",
        emergencyMedicalConsent: profile?.emergency_medical_consent ?? true,
        avatarData: profile?.avatar_data || "",
      },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/me or /api/profile/me
router.put("/me", requireAuth, async (req, res, next) => {
  try {
    const { fullName, phone, bloodGroup, allergies, chronicConditions, currentMedications, emergencyNotes, emergencyMedicalConsent, avatarData } = req.body;
    if (avatarData && (typeof avatarData !== "string" || avatarData.length > 1_400_000 || !avatarData.startsWith("data:image/"))) {
      return res.status(400).json({ error: "ValidationError", message: "Profile photo must be a valid image under 1 MB." });
    }

    const updated = await db.upsertProfile(req.user.id, {
      full_name: fullName || req.user.fullName,
      phone: phone || "",
      blood_group: bloodGroup || "",
      allergies: Array.isArray(allergies) ? allergies : (allergies ? String(allergies).split(",").map((s) => s.trim()) : []),
      chronic_conditions: Array.isArray(chronicConditions) ? chronicConditions : (chronicConditions ? String(chronicConditions).split(",").map((s) => s.trim()) : []),
      current_medications: Array.isArray(currentMedications) ? currentMedications : (currentMedications ? String(currentMedications).split(",").map((s) => s.trim()) : []),
      emergency_notes: emergencyNotes || "",
      emergency_medical_consent: emergencyMedicalConsent !== undefined ? Boolean(emergencyMedicalConsent) : true,
      avatar_data: avatarData || "",
    });

    await db.logAudit({
      user_id: req.user.id,
      action: "UPDATE_MEDICAL_PROFILE",
      resource_type: "profile",
      resource_id: req.user.id,
      ip_address: req.ip,
    });

    res.json({
      status: "success",
      message: "Medical profile updated successfully.",
      profile: updated,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
