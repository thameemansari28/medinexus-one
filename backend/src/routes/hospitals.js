import { Router } from "express";
import { db } from "../lib/db.js";

const router = Router();

function publicFacilityRecord(hospital) {
  const {
    totalBeds, total_beds, availableBeds, available_beds, icuBedsAvailable, icu_beds_available,
    erWaitTimeMins, er_wait_time_mins, isVerified, is_verified, verifiedAt, verified_at,
    indoorMapAvailable, indoor_map_available, floorPlans, floor_plans,
    ...directoryRecord
  } = hospital;
  return { ...directoryRecord, availabilityStatus: "not_connected", indoorMapAvailable: false };
}

// GET /api/hospitals
router.get("/", async (req, res, next) => {
  try {
    const { search, city, specialty } = req.query;
    const hospitals = await db.getHospitals({ search, city, specialty });
    res.json({
      status: "success",
      count: hospitals.length,
      hospitals: hospitals.map(publicFacilityRecord),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/hospitals/:id
router.get("/:id", async (req, res, next) => {
  try {
    const hospital = await db.getHospitalById(req.params.id);
    if (!hospital) {
      return res.status(404).json({ error: "NotFound", message: "Hospital not found." });
    }
    res.json({ status: "success", hospital: publicFacilityRecord(hospital) });
  } catch (err) {
    next(err);
  }
});

// GET /api/hospitals/:id/doctors
router.get("/:id/doctors", async (req, res, next) => {
  try {
    const doctors = await db.getDoctorsByHospitalId(req.params.id);
    const roster = doctors.map((doctor) => ({
      id: doctor.id,
      name: doctor.full_name || doctor.fullName || "",
      specialty: doctor.specialty || "",
      qualification: doctor.qualification || "",
      sourceLabel: doctor.source_label || "Connected hospital directory",
      sourceUrl: doctor.source_url || "",
    }));
    const directoryConnected = roster.length > 0;
    res.json({
      status: "success",
      count: roster.length,
      doctors: roster,
      doctorDirectoryStatus: directoryConnected ? "connected" : "not_connected",
      directorySource: directoryConnected && roster.some((doctor) => doctor.sourceUrl) ? "official_public_directory" : "connected_directory",
      scheduleStatus: "not_connected",
      notice: "Live doctor schedules and next-available appointments are not connected. Confirm availability with the hospital.",
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/hospitals/:id/indoor-map
router.get("/:id/indoor-map", async (req, res, next) => {
  try {
    const hospital = await db.getHospitalById(req.params.id);
    if (!hospital) {
      return res.status(404).json({ error: "NotFound", message: "Hospital not found." });
    }

    res.json({
      status: "success",
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      indoorMapAvailable: false,
      floorPlans: [],
      notice: "No hospital-approved indoor floor plan is connected for this facility. Follow hospital signage and ask staff for directions.",
    });
  } catch (err) {
    next(err);
  }
});

export default router;
