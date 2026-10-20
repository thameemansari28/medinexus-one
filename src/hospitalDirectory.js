import { INITIAL_HOSPITALS } from "../backend/src/lib/seedData.js";

// The bundled list keeps the finder usable if the API is offline. It deliberately
// omits bed counts, wait times, and indoor-map claims that are not live data.
export const FALLBACK_HOSPITALS = INITIAL_HOSPITALS.map((hospital) => ({
  id: hospital.id,
  name: hospital.name,
  type: hospital.type,
  address: hospital.address,
  city: hospital.city,
  state: hospital.state,
  pincode: hospital.pincode,
  phone: hospital.phone,
  emergencyPhone: hospital.emergencyPhone,
  website: hospital.website || "",
  latitude: hospital.latitude,
  longitude: hospital.longitude,
  specialties: hospital.specialties || [],
  services: hospital.services || [],
  directorySource: "bundled",
}));
