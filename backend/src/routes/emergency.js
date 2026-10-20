import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import { db } from "../lib/db.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { rateLimiter } from "../middleware/rateLimiter.js";

const router = Router();

// Rate limit emergency submissions to prevent spam while allowing urgent calls
const emergencyLimiter = rateLimiter({
  windowMs: 60000,
  maxRequests: 10,
  message: "Emergency request limit reached. Call 112 or 108 directly on your telephone.",
});

// POST /api/emergency or /api/emergency/sos
router.post(["/", "/sos"], emergencyLimiter, optionalAuth, async (req, res, next) => {
  try {
    const {
      type = "Accident",
      latitude,
      longitude,
      accuracy,
      accuracy_meters,
      locationAddress,
      location_address,
      details = "",
      shareMedicalConsent = false,
      occurredAt,
    } = req.body;

    let medicalSummary = {};
    if (req.user && shareMedicalConsent) {
      const profile = await db.getProfile(req.user.id);
      if (profile) {
        medicalSummary = {
          fullName: profile.full_name || req.user.fullName || "",
          phone: profile.phone || "",
          bloodGroup: profile.blood_group || "Not recorded",
          allergies: profile.allergies || [],
          chronicConditions: profile.chronic_conditions || [],
          currentMedications: profile.current_medications || [],
          emergencyNotes: profile.emergency_notes || "",
        };
      }
    }

    // Determine notification channels
    const notificationAttempts = [];
    const twilioConfigured = Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
    );

    let userContacts = [];
    if (req.user) {
      userContacts = await db.getEmergencyContacts(req.user.id);
    }

    if (userContacts.length > 0) {
      for (const contact of userContacts) {
        if (twilioConfigured) {
          notificationAttempts.push({
            channel: "SMS",
            destination: contact.phone,
            recipientName: contact.contact_name,
            status: "not_sent",
            provider: "Twilio",
            detail: "SMS dispatch is not implemented in this build. No message was sent.",
            timestamp: new Date().toISOString(),
          });
        } else {
          // Honestly record that SMS gateway is unconfigured
          notificationAttempts.push({
            channel: "SMS",
            destination: contact.phone,
            recipientName: contact.contact_name,
            status: "unconfigured_provider",
            detail: "SMS gateway (Twilio) is not configured in backend environment. Notification not sent.",
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    const incident = await db.recordEmergencyIncident({
      user_id: req.user ? req.user.id : null,
      type,
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      accuracy_meters: accuracy || accuracy_meters ? Number(accuracy || accuracy_meters) : null,
      location_address: locationAddress || location_address || (latitude && longitude ? `${latitude}, ${longitude}` : "Location not provided"),
      details,
      medical_summary_shared: Boolean(shareMedicalConsent && Object.keys(medicalSummary).length > 0),
      medical_summary: medicalSummary,
      notification_attempts: notificationAttempts,
    });

    await db.logAudit({
      user_id: req.user?.id || null,
      action: "EMERGENCY_SOS_TRIGGERED",
      resource_type: "emergency_incident",
      resource_id: incident.id,
      ip_address: req.ip,
      details: {
        incidentNumber: incident.incident_number,
        type,
        hasCoordinates: Boolean(latitude && longitude),
        contactsNotified: notificationAttempts.length,
      },
    });

    const shareUrl = `${req.protocol}://${req.get("host")}/api/emergency/share/${incident.share_token}`;

    res.status(201).json({
      status: "success",
      message: "Emergency incident recorded on MediNexus server.",
      incidentNumber: incident.incident_number,
      incidentId: incident.id,
      updateToken: incident.update_token,
      shareToken: incident.share_token,
      shareUrl,
      shareExpiresAt: incident.share_expires_at,
      recordedLocation: {
        latitude: incident.latitude,
        longitude: incident.longitude,
        accuracyMeters: incident.accuracy_meters,
        address: incident.location_address,
      },
      notificationAttempts,
      disclaimer: {
        ambulanceStatus: "NOT_DISPATCHED — Automatic ambulance dispatch requires direct call to 112 / 108.",
        callRequired: "Please tap Call 112 or Call 108 on your mobile device immediately.",
      },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/emergency/:id — update details for the person who created the SOS.
// The one-time incident update token is never included in public share links.
router.patch("/:id", emergencyLimiter, async (req, res, next) => {
  try {
    const incident = await db.getEmergencyIncidentById(req.params.id);
    const providedToken = String(req.get("X-Incident-Update-Token") || "");
    const storedToken = String(incident?.update_token || "");
    const provided = Buffer.from(providedToken);
    const stored = Buffer.from(storedToken);
    const tokenMatches = provided.length === stored.length && stored.length > 0 && timingSafeEqual(provided, stored);
    if (!incident || !tokenMatches) {
      return res.status(404).json({ error: "NotFound", message: "Incident update access was not found." });
    }

    const update = {};
    if (typeof req.body.type === "string") update.type = req.body.type.slice(0, 150);
    if (typeof req.body.details === "string") update.details = req.body.details.slice(0, 2000);
    if (typeof req.body.location_address === "string") update.location_address = req.body.location_address.slice(0, 500);
    if (req.body.latitude === null || Number.isFinite(Number(req.body.latitude))) update.latitude = req.body.latitude === null ? null : Number(req.body.latitude);
    if (req.body.longitude === null || Number.isFinite(Number(req.body.longitude))) update.longitude = req.body.longitude === null ? null : Number(req.body.longitude);
    if (req.body.accuracy_meters === null || Number.isFinite(Number(req.body.accuracy_meters))) update.accuracy_meters = req.body.accuracy_meters === null ? null : Number(req.body.accuracy_meters);

    const updated = await db.updateEmergencyIncident(incident.id, update);
    res.json({
      status: "success",
      incidentId: updated.id,
      incidentNumber: updated.incident_number,
      type: updated.type,
      details: updated.details,
      location: {
        latitude: updated.latitude,
        longitude: updated.longitude,
        accuracyMeters: updated.accuracy_meters,
        address: updated.location_address,
      },
      updatedAt: updated.updated_at,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/emergency/share/:token
// Public expiring link for responders / family
router.get("/share/:token", async (req, res, next) => {
  try {
    const incident = await db.getEmergencyIncidentByToken(req.params.token);
    if (!incident) {
      return res.status(404).json({ error: "NotFound", message: "Emergency incident link not found or expired." });
    }
    if (incident.expired) {
      return res.status(410).json({ error: "Expired", message: incident.message });
    }

    res.json({
      status: "active",
      incidentNumber: incident.incident_number,
      type: incident.type,
      location: {
        latitude: incident.latitude,
        longitude: incident.longitude,
        accuracyMeters: incident.accuracy_meters,
        address: incident.location_address,
      },
      details: incident.details,
      medicalSummary: incident.medical_summary_shared ? incident.medical_summary : null,
      createdAt: incident.created_at,
      shareExpiresAt: incident.share_expires_at,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/emergency/contacts
router.get("/contacts", requireAuth, async (req, res, next) => {
  try {
    const contacts = await db.getEmergencyContacts(req.user.id);
    res.json({
      status: "success",
      count: contacts.length,
      contacts,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/emergency/contacts
router.post("/contacts", requireAuth, async (req, res, next) => {
  try {
    const { contact_name, name, phone, relationship, is_primary } = req.body;
    const contactName = contact_name || name;

    if (!contactName || !contactName.trim()) {
      return res.status(400).json({ error: "ValidationError", message: "Contact name is required." });
    }
    if (!phone || !phone.trim() || phone.trim().length < 8) {
      return res.status(400).json({ error: "ValidationError", message: "A valid phone number is required." });
    }

    const contact = await db.addEmergencyContact({
      user_id: req.user.id,
      contact_name: contactName.trim(),
      phone: phone.trim(),
      relationship: relationship || "Family",
      is_primary: Boolean(is_primary),
    });

    await db.logAudit({
      user_id: req.user.id,
      action: "ADD_EMERGENCY_CONTACT",
      resource_type: "emergency_contact",
      resource_id: contact.id,
      ip_address: req.ip,
      details: { contactName, relationship },
    });

    res.status(201).json({
      status: "success",
      message: "Emergency contact saved.",
      contact,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/emergency/contacts/:id
router.put("/contacts/:id", requireAuth, async (req, res, next) => {
  try {
    const { contact_name, name, phone, relationship } = req.body;
    const contactName = contact_name || name;
    if (!contactName || !contactName.trim()) return res.status(400).json({ error: "ValidationError", message: "Contact name is required." });
    if (!phone || !phone.trim() || phone.trim().length < 8) return res.status(400).json({ error: "ValidationError", message: "A valid phone number is required." });
    const contact = await db.updateEmergencyContact(req.params.id, req.user.id, { contact_name: contactName.trim(), phone: phone.trim(), relationship: relationship || "Family" });
    await db.logAudit({ user_id: req.user.id, action: "UPDATE_EMERGENCY_CONTACT", resource_type: "emergency_contact", resource_id: req.params.id, ip_address: req.ip });
    res.json({ status: "success", message: "Emergency contact updated.", contact });
  } catch (err) { next(err); }
});

// DELETE /api/emergency/contacts/:id
router.delete("/contacts/:id", requireAuth, async (req, res, next) => {
  try {
    await db.deleteEmergencyContact(req.params.id, req.user.id);
    await db.logAudit({
      user_id: req.user.id,
      action: "DELETE_EMERGENCY_CONTACT",
      resource_type: "emergency_contact",
      resource_id: req.params.id,
      ip_address: req.ip,
    });

    res.json({
      status: "success",
      message: "Emergency contact removed.",
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/emergency/incidents
router.get("/incidents", requireAuth, async (req, res, next) => {
  try {
    const incidents = await db.getEmergencyIncidentsByUser(req.user.id);
    res.json({
      status: "success",
      count: incidents.length,
      incidents: incidents.map(({ update_token, ...item }) => item),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
