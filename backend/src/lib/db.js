/**
 * MediNexus One - Persistent local JSON database with optional Supabase support.
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";
import crypto from "crypto";
import { INITIAL_HOSPITALS, INITIAL_DOCTORS, PUBLIC_DOCTOR_DIRECTORY } from "./seedData.js";

// Load backend/.env before reading credentials. Static imports in server.js are
// evaluated before its body, so loading dotenv there is too late for this module.
const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(backendDirectory, ".env") });

const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const SUPABASE_KEY = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  ""
).trim();
const SUPABASE_ENABLED = String(process.env.MEDINEXUS_USE_SUPABASE || "").toLowerCase() === "true";

// This package uses its local JSON store by default. Remote Supabase access is
// opt-in so leftover shell variables cannot silently redirect patient data.
export const isSupabaseLive = SUPABASE_ENABLED && Boolean(SUPABASE_URL && SUPABASE_KEY);

// Default singleton client (anon / service)
export const globalSupabase = isSupabaseLive
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    })
  : null;

/**
 * Creates a request-scoped Supabase client that forwards the user's JWT.
 * This guarantees Supabase RLS is evaluated with auth.uid() == user.id.
 */
export function getScopedClient(jwtToken) {
  if (!isSupabaseLive) return null;
  if (!jwtToken) return globalSupabase;

  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${jwtToken}`,
      },
    },
  });
}

// ---------------------------------------------------------------------
// Local Persistent Storage Engine (resilient fallback & audit retention)
// ---------------------------------------------------------------------
// A hosted service can mount durable storage at MEDINEXUS_DATA_DIR. Locally,
// retain the existing project data folder without requiring configuration.
const DATA_DIR = process.env.MEDINEXUS_DATA_DIR
  ? path.resolve(process.env.MEDINEXUS_DATA_DIR)
  : path.resolve(backendDirectory, "..", "data");
const STORE_FILE = path.join(DATA_DIR, "medinexus-store.json");

function ensureDirectoryExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Existing installs keep their local JSON store. Merge newly bundled hospital
// records into it at startup so a directory update is visible without asking
// the user to delete accounts, appointments, or other saved data.
function mergeHospitalDirectory(savedHospitals = []) {
  const savedById = new Map(savedHospitals.map((hospital) => [String(hospital.id), hospital]));
  const seeded = INITIAL_HOSPITALS.map((hospital) => ({ ...hospital, ...(savedById.get(String(hospital.id)) || {}) }));
  const knownIds = new Set(INITIAL_HOSPITALS.map((hospital) => String(hospital.id)));
  return [...seeded, ...savedHospitals.filter((hospital) => !knownIds.has(String(hospital.id)))];
}

function loadInitialStore() {
  ensureDirectoryExists();
  if (fs.existsSync(STORE_FILE)) {
    try {
      const content = fs.readFileSync(STORE_FILE, "utf-8");
      const parsed = JSON.parse(content);
      return {
        hospitals: parsed.hospitals?.length ? mergeHospitalDirectory(parsed.hospitals) : INITIAL_HOSPITALS,
        doctors: parsed.doctors?.length ? parsed.doctors : INITIAL_DOCTORS,
        profiles: parsed.profiles || {},
        local_users: Array.isArray(parsed.local_users) ? parsed.local_users : [],
        local_sessions: Array.isArray(parsed.local_sessions) ? parsed.local_sessions : [],
        appointments: parsed.appointments || [],
        receipts: parsed.receipts || [],
        emergency_contacts: parsed.emergency_contacts || [],
        emergency_incidents: parsed.emergency_incidents || [],
        medical_records: parsed.medical_records || [],
        audit_logs: parsed.audit_logs || [],
      };
    } catch (e) {
      console.warn("[DB] Failed reading local store file, initializing fresh store:", e.message);
    }
  }

  const initial = {
    hospitals: INITIAL_HOSPITALS,
    doctors: INITIAL_DOCTORS,
    profiles: {},
    local_users: [],
    local_sessions: [],
    appointments: [],
    receipts: [],
    emergency_contacts: [],
    emergency_incidents: [],
    medical_records: [],
    audit_logs: [],
  };
  saveStore(initial);
  return initial;
}

let memoryStore = loadInitialStore();

function saveStore(store = memoryStore) {
  try {
    ensureDirectoryExists();
    const tempFile = `${STORE_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(store, null, 2), "utf-8");
    fs.renameSync(tempFile, STORE_FILE);
  } catch (err) {
    console.error("[DB] Error persisting local store:", err.message);
  }
}

// ---------------------------------------------------------------------
// Repository Methods
// ---------------------------------------------------------------------

export const db = {
  // --- LOCAL ACCOUNTS (password hashes only; no email verification) ---
  async getLocalUserByEmail(email) {
    const normalized = String(email || "").trim().toLowerCase();
    return memoryStore.local_users.find((user) => user.email.toLowerCase() === normalized) || null;
  },

  async getLocalUserById(userId) {
    return memoryStore.local_users.find((user) => user.id === userId) || null;
  },

  async getLocalAccountCount() {
    return memoryStore.local_users.length;
  },

  async createLocalUser({ email, fullName, passwordHash }) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (memoryStore.local_users.some((user) => user.email.toLowerCase() === normalizedEmail)) return null;
    const user = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      full_name: String(fullName || "").trim(),
      password_hash: passwordHash,
      role: "patient",
      created_at: new Date().toISOString(),
    };
    memoryStore.local_users.push(user);
    memoryStore.profiles[user.id] = { id: user.id, full_name: user.full_name, role: user.role };
    saveStore();
    return user;
  },

  async deleteLocalUser(userId) {
    const userExists = memoryStore.local_users.some((user) => user.id === userId);
    if (!userExists) return false;
    memoryStore.local_users = memoryStore.local_users.filter((user) => user.id !== userId);
    memoryStore.local_sessions = memoryStore.local_sessions.filter((session) => session.user_id !== userId);
    delete memoryStore.profiles[userId];
    for (const [collection, key] of [
      ["appointments", "patient_id"],
      ["receipts", "patient_id"],
      ["emergency_contacts", "user_id"],
      ["emergency_incidents", "user_id"],
      ["medical_records", "patient_id"],
      ["audit_logs", "user_id"],
    ]) {
      memoryStore[collection] = memoryStore[collection].filter((record) => record[key] !== userId);
    }
    saveStore();
    return true;
  },

  async createLocalSession({ tokenHash, userId, expiresAt }) {
    memoryStore.local_sessions = memoryStore.local_sessions.filter((session) => session.user_id !== userId || Date.parse(session.expires_at) > Date.now());
    memoryStore.local_sessions.push({ token_hash: tokenHash, user_id: userId, expires_at: expiresAt });
    saveStore();
  },

  async getLocalSession(tokenHash) {
    const index = memoryStore.local_sessions.findIndex((session) => session.token_hash === tokenHash);
    if (index < 0) return null;
    const session = memoryStore.local_sessions[index];
    if (Date.parse(session.expires_at) <= Date.now()) {
      memoryStore.local_sessions.splice(index, 1);
      saveStore();
      return null;
    }
    const user = memoryStore.local_users.find((entry) => entry.id === session.user_id);
    return user ? { session, user } : null;
  },

  async deleteLocalSession(tokenHash) {
    const previousLength = memoryStore.local_sessions.length;
    memoryStore.local_sessions = memoryStore.local_sessions.filter((session) => session.token_hash !== tokenHash);
    if (previousLength !== memoryStore.local_sessions.length) saveStore();
  },

  // --- HOSPITALS ---
  async getHospitals({ search = "", city = "", specialty = "" } = {}) {
    let list = memoryStore.hospitals;

    // Try Supabase if live
    if (globalSupabase) {
      try {
        const { data, error } = await globalSupabase.from("hospitals").select("*");
        if (!error && Array.isArray(data) && data.length > 0) {
          list = data;
        }
      } catch {
        // Fall back gracefully to verified seed list
      }
    }

    let result = [...list];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (h) =>
          h.name?.toLowerCase().includes(q) ||
          h.address?.toLowerCase().includes(q) ||
          h.city?.toLowerCase().includes(q) ||
          (h.specialties || []).some((s) => s.toLowerCase().includes(q))
      );
    }
    if (city) {
      result = result.filter((h) => h.city?.toLowerCase() === city.toLowerCase());
    }
    if (specialty) {
      const s = specialty.toLowerCase();
      result = result.filter((h) =>
        (h.specialties || []).some((item) => item.toLowerCase().includes(s))
      );
    }

    return result;
  },

  async getHospitalById(id) {
    if (globalSupabase) {
      try {
        const { data, error } = await globalSupabase
          .from("hospitals")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (!error && data) return data;
      } catch {}
    }
    return memoryStore.hospitals.find((h) => String(h.id) === String(id)) || null;
  },

  // --- DOCTORS ---
  async getDoctorsByHospitalId(hospitalId) {
    if (globalSupabase) {
      try {
        const { data, error } = await globalSupabase
          .from("doctors")
          .select("*")
          .eq("hospital_id", hospitalId);
        if (!error && Array.isArray(data) && data.length > 0) return data;
      } catch {}
    }
    // Local seed doctors are examples and are deliberately excluded. This smaller
    // list comes from a named hospital's public physician directory and remains
    // separate from live availability.
    return PUBLIC_DOCTOR_DIRECTORY.filter((doctor) => String(doctor.hospital_id) === String(hospitalId));
  },

  // --- PROFILES ---
  async getProfile(userId) {
    if (globalSupabase) {
      try {
        const { data, error } = await globalSupabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();
        if (!error && data) return data;
      } catch {}
    }
    return memoryStore.profiles[userId] || null;
  },

  async upsertProfile(userId, profileData) {
    const updated = {
      id: userId,
      ...(memoryStore.profiles[userId] || {}),
      ...profileData,
      updated_at: new Date().toISOString(),
    };

    if (globalSupabase) {
      try {
        const { error } = await globalSupabase.from("profiles").upsert(updated);
        if (!error) {
          memoryStore.profiles[userId] = updated;
          saveStore();
          return updated;
        }
      } catch {}
    }

    memoryStore.profiles[userId] = updated;
    saveStore();
    return updated;
  },

  // --- APPOINTMENTS ---
  async createAppointment(appointmentData, jwtToken = null) {
    const scoped = getScopedClient(jwtToken);
    const id = appointmentData.id || crypto.randomUUID();
    const created = {
      id,
      patient_id: appointmentData.patient_id || appointmentData.userId,
      hospital_id: appointmentData.hospital_id || appointmentData.hospitalId,
      doctor_id: appointmentData.doctor_id || appointmentData.doctorId || null,
      specialty: appointmentData.specialty || "General Consultation",
      date: appointmentData.date,
      time: appointmentData.time,
      scheduled_at: appointmentData.scheduled_at || `${appointmentData.date}T${appointmentData.time}:00Z`,
      reason: appointmentData.reason || "",
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      hospitalName: appointmentData.hospitalName || "",
      doctorName: appointmentData.doctorName || "",
    };

    if (scoped) {
      try {
        const { data, error } = await scoped.from("appointments").insert({
          id: created.id,
          patient_id: created.patient_id,
          hospital_id: created.hospital_id,
          doctor_id: created.doctor_id,
          specialty: created.specialty,
          date: created.date,
          time: created.time,
          scheduled_at: created.scheduled_at,
          reason: created.reason,
          status: created.status,
        }).select().maybeSingle();

        if (!error && data) {
          const merged = { ...created, ...data };
          memoryStore.appointments.unshift(merged);
          saveStore();
          return merged;
        }
      } catch {}
    }

    memoryStore.appointments.unshift(created);
    saveStore();
    return created;
  },

  async getAppointmentsByPatient(userId, jwtToken = null) {
    const scoped = getScopedClient(jwtToken);
    if (scoped) {
      try {
        const { data, error } = await scoped
          .from("appointments")
          .select("*, hospitals(name, address, city)")
          .eq("patient_id", userId)
          .order("created_at", { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          return data.map((item) => ({
            ...item,
            hospitalName: item.hospitals?.name || item.hospitalName,
          }));
        }
      } catch {}
    }

    return memoryStore.appointments.filter(
      (a) => String(a.patient_id) === String(userId) || String(a.userId) === String(userId)
    );
  },

  async updateAppointment(id, updateData, userId, isAdmin = false) {
    const index = memoryStore.appointments.findIndex((a) => String(a.id) === String(id));
    if (index === -1) {
      throw new Error("Appointment not found");
    }

    const current = memoryStore.appointments[index];
    if (!isAdmin && String(current.patient_id) !== String(userId)) {
      throw new Error("Unauthorized to modify this appointment");
    }

    const updated = {
      ...current,
      ...updateData,
      updated_at: new Date().toISOString(),
    };

    memoryStore.appointments[index] = updated;
    saveStore();

    if (globalSupabase) {
      try {
        await globalSupabase.from("appointments").update(updateData).eq("id", id);
      } catch {}
    }

    return updated;
  },

  // --- RECEIPTS & BILLING ---
  async createReceipt(receiptData) {
    const id = receiptData.id || crypto.randomUUID();
    const receiptNumber =
      receiptData.receipt_number ||
      `MNX-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const created = {
      id,
      receipt_number: receiptNumber,
      patient_id: receiptData.patient_id || receiptData.userId,
      hospital_id: receiptData.hospital_id || receiptData.hospitalId,
      appointment_id: receiptData.appointment_id || receiptData.appointmentId || null,
      items: receiptData.items || [],
      subtotal: Number(receiptData.subtotal || 0),
      tax: Number(receiptData.tax || 0),
      discount: Number(receiptData.discount || 0),
      total: Number(receiptData.total || 0),
      currency: receiptData.currency || "INR",
      payment_method: receiptData.payment_method || "UPI / Card",
      payment_status: receiptData.payment_status || "unpaid",
      transaction_ref: receiptData.transaction_ref || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      hospitalName: receiptData.hospitalName || "",
      patientName: receiptData.patientName || "",
    };

    if (globalSupabase) {
      try {
        await globalSupabase.from("receipts").insert({
          id: created.id,
          receipt_number: created.receipt_number,
          patient_id: created.patient_id,
          hospital_id: created.hospital_id,
          currency: created.currency,
          payment_status: created.payment_status,
        });
      } catch {}
    }

    memoryStore.receipts.unshift(created);
    saveStore();
    return created;
  },

  async getReceiptsByPatient(userId) {
    if (globalSupabase) {
      try {
        const { data, error } = await globalSupabase
          .from("receipts")
          .select("*")
          .eq("patient_id", userId)
          .order("created_at", { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          // Merge with memory store details if any
          return data.map((d) => {
            const mem = memoryStore.receipts.find((r) => r.id === d.id);
            return mem ? { ...d, ...mem } : d;
          });
        }
      } catch {}
    }

    return memoryStore.receipts.filter(
      (r) => String(r.patient_id) === String(userId) || String(r.userId) === String(userId)
    );
  },

  async getReceiptById(id, userId, isAdmin = false) {
    const receipt = memoryStore.receipts.find((r) => String(r.id) === String(id));
    if (!receipt) return null;

    if (!isAdmin && String(receipt.patient_id) !== String(userId)) {
      throw new Error("Unauthorized access to this receipt");
    }

    return receipt;
  },

  async updateReceiptPayment(id, { payment_status, transaction_ref, payment_method }) {
    const index = memoryStore.receipts.findIndex((r) => String(r.id) === String(id));
    if (index === -1) throw new Error("Receipt not found");

    const current = memoryStore.receipts[index];
    const updated = {
      ...current,
      payment_status,
      transaction_ref: transaction_ref || current.transaction_ref,
      payment_method: payment_method || current.payment_method,
      paid_at: payment_status === "paid" ? new Date().toISOString() : current.paid_at,
      updated_at: new Date().toISOString(),
    };

    memoryStore.receipts[index] = updated;
    saveStore();

    if (globalSupabase) {
      try {
        await globalSupabase.from("receipts").update({ payment_status }).eq("id", id);
      } catch {}
    }

    return updated;
  },

  // --- EMERGENCY SOS ---
  async recordEmergencyIncident(data) {
    const id = data.id || crypto.randomUUID();
    const incidentNumber = `SOS-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const shareToken = crypto.randomBytes(16).toString("hex");

    const created = {
      id,
      incident_number: incidentNumber,
      user_id: data.user_id || null,
      type: data.type || "Accident",
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      accuracy_meters: data.accuracy_meters || null,
      location_address: data.location_address || "",
      details: data.details || "",
      medical_summary_shared: Boolean(data.medical_summary_shared),
      medical_summary: data.medical_summary || {},
      status: "recorded",
      notification_attempts: data.notification_attempts || [],
      share_token: shareToken,
      update_token: crypto.randomBytes(32).toString("hex"),
      share_expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours validity
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    memoryStore.emergency_incidents.unshift(created);
    saveStore();
    return created;
  },

  async getEmergencyIncidentsByUser(userId) {
    return memoryStore.emergency_incidents.filter((i) => String(i.user_id) === String(userId));
  },

  async getEmergencyIncidentById(id) {
    return memoryStore.emergency_incidents.find((i) => String(i.id) === String(id)) || null;
  },

  async getEmergencyIncidentByToken(token) {
    const incident = memoryStore.emergency_incidents.find((i) => i.share_token === token);
    if (!incident) return null;

    // Check expiration
    if (new Date(incident.share_expires_at).getTime() < Date.now()) {
      return { expired: true, message: "Emergency sharing link has expired." };
    }

    return incident;
  },

  async updateEmergencyIncident(id, updateData) {
    const index = memoryStore.emergency_incidents.findIndex((i) => String(i.id) === String(id));
    if (index === -1) throw new Error("Incident not found");

    const updated = {
      ...memoryStore.emergency_incidents[index],
      ...updateData,
      updated_at: new Date().toISOString(),
    };

    memoryStore.emergency_incidents[index] = updated;
    saveStore();
    return updated;
  },

  // --- EMERGENCY CONTACTS ---
  async getEmergencyContacts(userId) {
    if (globalSupabase) {
      try {
        const { data, error } = await globalSupabase
          .from("emergency_contacts")
          .select("*")
          .eq("user_id", userId);
        if (!error && Array.isArray(data) && data.length > 0) return data;
      } catch {}
    }

    return memoryStore.emergency_contacts.filter((c) => String(c.user_id) === String(userId));
  },

  async addEmergencyContact(data) {
    const id = data.id || crypto.randomUUID();
    const created = {
      id,
      user_id: data.user_id,
      contact_name: data.contact_name || data.name,
      phone: data.phone,
      relationship: data.relationship || "Family",
      is_primary: Boolean(data.is_primary),
      created_at: new Date().toISOString(),
    };

    if (globalSupabase) {
      try {
        await globalSupabase.from("emergency_contacts").insert(created);
      } catch {}
    }

    memoryStore.emergency_contacts.push(created);
    saveStore();
    return created;
  },

  async updateEmergencyContact(id, userId, updates) {
    const index = memoryStore.emergency_contacts.findIndex((contact) => String(contact.id) === String(id) && String(contact.user_id) === String(userId));
    if (index === -1) throw new Error("Emergency contact not found");
    const updated = {
      ...memoryStore.emergency_contacts[index],
      contact_name: updates.contact_name || updates.name || memoryStore.emergency_contacts[index].contact_name,
      phone: updates.phone || memoryStore.emergency_contacts[index].phone,
      relationship: updates.relationship || memoryStore.emergency_contacts[index].relationship,
      updated_at: new Date().toISOString(),
    };
    memoryStore.emergency_contacts[index] = updated;
    saveStore();
    if (globalSupabase) {
      try { await globalSupabase.from("emergency_contacts").update(updated).eq("id", id).eq("user_id", userId); } catch {}
    }
    return updated;
  },

  async deleteEmergencyContact(id, userId) {
    memoryStore.emergency_contacts = memoryStore.emergency_contacts.filter(
      (c) => !(String(c.id) === String(id) && String(c.user_id) === String(userId))
    );
    saveStore();

    if (globalSupabase) {
      try {
        await globalSupabase
          .from("emergency_contacts")
          .delete()
          .eq("id", id)
          .eq("user_id", userId);
      } catch {}
    }

    return { success: true };
  },

  // --- MEDICAL RECORDS ---
  async getMedicalRecords(patientId) {
    return memoryStore.medical_records.filter((r) => String(r.patient_id) === String(patientId));
  },

  async createMedicalRecord(data) {
    const id = data.id || crypto.randomUUID();
    const created = {
      id,
      patient_id: data.patient_id,
      title: data.title,
      record_type: data.record_type || "Clinical Report",
      hospital_name: data.hospital_name || "",
      doctor_name: data.doctor_name || "",
      record_date: data.record_date || new Date().toISOString().slice(0, 10),
      notes: data.notes || "",
      file_name: data.file_name || null,
      file_data: data.file_data || null,
      file_size: data.file_size || 0,
      mime_type: data.mime_type || "application/pdf",
      privacy_level: data.privacy_level || "private",
      created_at: new Date().toISOString(),
    };

    memoryStore.medical_records.unshift(created);
    saveStore();
    return created;
  },

  async deleteMedicalRecord(id, patientId) {
    const initialLen = memoryStore.medical_records.length;
    memoryStore.medical_records = memoryStore.medical_records.filter(
      (r) => !(String(r.id) === String(id) && String(r.patient_id) === String(patientId))
    );
    saveStore();
    return { success: memoryStore.medical_records.length < initialLen };
  },

  // --- AUDIT LOGS ---
  async logAudit({ user_id = null, action, resource_type, resource_id = null, ip_address = null, user_agent = null, details = {} }) {
    const logEntry = {
      id: crypto.randomUUID(),
      user_id,
      action,
      resource_type,
      resource_id,
      ip_address,
      user_agent,
      details,
      created_at: new Date().toISOString(),
    };

    memoryStore.audit_logs.unshift(logEntry);
    if (memoryStore.audit_logs.length > 500) {
      memoryStore.audit_logs.pop();
    }
    saveStore();
    return logEntry;
  },

  async getAuditLogs(limit = 50) {
    return memoryStore.audit_logs.slice(0, limit);
  },

  // --- ADMIN STATS ---
  async getAdminStats() {
    const totalHospitals = memoryStore.hospitals.length;
    const totalAppointments = memoryStore.appointments.length;
    const pendingAppointments = memoryStore.appointments.filter((a) => a.status === "pending").length;
    const confirmedAppointments = memoryStore.appointments.filter((a) => a.status === "confirmed").length;
    const totalReceipts = memoryStore.receipts.length;
    const totalRevenue = memoryStore.receipts
      .filter((r) => r.payment_status === "paid")
      .reduce((sum, r) => sum + Number(r.total || 0), 0);
    const emergencyIncidentsCount = memoryStore.emergency_incidents.length;
    const usersCount = Object.keys(memoryStore.profiles).length + 1; // At least admin/current user

    return {
      totalHospitals,
      totalAppointments,
      pendingAppointments,
      confirmedAppointments,
      totalReceipts,
      totalRevenue,
      emergencyIncidentsCount,
      totalUsers: usersCount,
      timestamp: new Date().toISOString(),
    };
  },
};
