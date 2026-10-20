import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import http from "node:http";
import crypto from "node:crypto";
import app from "../src/server.js";
import { db } from "../src/lib/db.js";

let server;
let baseUrl;
const localAuthTestUserIds = [];

before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  for (const userId of localAuthTestUserIds) {
    await db.deleteLocalUser(userId);
  }
  if (server) {
    if (typeof server.closeAllConnections === "function") {
      server.closeAllConnections();
    }
    await new Promise((resolve) => server.close(resolve));
  }
});

describe("MediNexus One - API Health & System Status", () => {
  test("GET /health returns 200 and valid status report", async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.status, "ok");
    assert.strictEqual(json.service, "MediNexus One API");
    assert.ok(json.integrations, "integrations object must exist");
  });

  test("GET / returns root API index with available endpoints", async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(json.endpoints.includes("/health"));
  });

  test("Non-existent route returns structured 404 error", async () => {
    const res = await fetch(`${baseUrl}/api/non-existent-route`);
    assert.strictEqual(res.status, 404);
    const json = await res.json();
    assert.strictEqual(json.error, "NotFound");
  });
});

describe("MediNexus One - Hospital Directory & Indoor Wayfinding", () => {
  test("GET /api/hospitals returns verified hospital list", async () => {
    const res = await fetch(`${baseUrl}/api/hospitals`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.status, "success");
    assert.ok(Array.isArray(json.hospitals));
    assert.ok(json.hospitals.length > 0);

    const first = json.hospitals[0];
    assert.ok(first.name);
    assert.ok(first.latitude);
    assert.ok(first.longitude);
    assert.ok(Array.isArray(first.specialties));
  });

  test("GET /api/hospitals with search filter works accurately", async () => {
    const res = await fetch(`${baseUrl}/api/hospitals?search=Apollo`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(json.hospitals.every((h) => h.name.toLowerCase().includes("apollo")));
  });

  test("GET /api/hospitals/:id/doctors returns doctor directory", async () => {
    const hospitals = await db.getHospitals();
    const hospital = hospitals[0];
    const res = await fetch(`${baseUrl}/api/hospitals/${hospital.id}/doctors`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.status, "success");
    assert.ok(Array.isArray(json.doctors));
  });

  test("GET /api/hospitals/:id/indoor-map returns verified floor layouts", async () => {
    const hospitals = await db.getHospitals();
    const hospital = hospitals[0];
    const res = await fetch(`${baseUrl}/api/hospitals/${hospital.id}/indoor-map`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.status, "success");
    assert.ok(Array.isArray(json.floorPlans));
    assert.ok(json.notice, "Notice regarding illustrative wayfinding must be present");
  });
});

describe("MediNexus One - Security, Auth, & Role Boundaries", () => {
  test("Local account registration, session restore, protected access, and logout work", async () => {
    const email = `local-auth-${crypto.randomUUID()}@example.test`;
    const password = "local-auth-test-password";
    const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, fullName: "Local Auth Test", password }),
    });
    assert.strictEqual(registerResponse.status, 201);
    const { user } = await registerResponse.json();
    localAuthTestUserIds.push(user.id);
    assert.strictEqual(user.email, email);
    assert.strictEqual(user.fullName, "Local Auth Test");
    assert.ok(!("password_hash" in user));

    const cookie = registerResponse.headers.get("set-cookie");
    assert.ok(cookie?.includes("HttpOnly"));
    const cookiePair = cookie.split(";")[0];

    const sessionResponse = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: cookiePair },
    });
    assert.strictEqual(sessionResponse.status, 200);
    assert.strictEqual((await sessionResponse.json()).user.id, user.id);

    const protectedResponse = await fetch(`${baseUrl}/api/appointments`, {
      headers: { Cookie: cookiePair },
    });
    assert.strictEqual(protectedResponse.status, 200);

    const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: cookiePair },
    });
    assert.strictEqual(logoutResponse.status, 200);

    const expiredSessionResponse = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: cookiePair },
    });
    assert.strictEqual(expiredSessionResponse.status, 401);

    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    assert.strictEqual(loginResponse.status, 200);
    assert.strictEqual((await loginResponse.json()).user.id, user.id);
    const loginCookie = loginResponse.headers.get("set-cookie").split(";")[0];
    const restoredLoginResponse = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: loginCookie },
    });
    assert.strictEqual(restoredLoginResponse.status, 200);
    await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: loginCookie },
    });
  });

  test("Local login rejects invalid credentials and duplicate registration", async () => {
    const email = `local-auth-duplicate-${crypto.randomUUID()}@example.test`;
    const payload = { email, fullName: "Duplicate Test", password: "local-auth-test-password" };
    const registration = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    assert.strictEqual(registration.status, 201);
    localAuthTestUserIds.push((await registration.clone().json()).user.id);

    const duplicate = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    assert.strictEqual(duplicate.status, 409);

    const invalidLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "incorrect-password" }),
    });
    assert.strictEqual(invalidLogin.status, 401);
  });

  test("Unauthenticated request to protected /api/appointments is rejected with 401", async () => {
    const res = await fetch(`${baseUrl}/api/appointments`);
    assert.strictEqual(res.status, 401);
    const json = await res.json();
    assert.strictEqual(json.error, "Authentication required");
  });

  test("Unauthenticated request to protected /api/receipts is rejected with 401", async () => {
    const res = await fetch(`${baseUrl}/api/receipts`);
    assert.strictEqual(res.status, 401);
  });

  test("Unauthenticated request to protected /api/records is rejected with 401", async () => {
    const res = await fetch(`${baseUrl}/api/records`);
    assert.strictEqual(res.status, 401);
  });

  test("Unauthenticated request to protected /api/admin/dashboard is rejected with 401", async () => {
    const res = await fetch(`${baseUrl}/api/admin/dashboard`);
    assert.strictEqual(res.status, 401);
  });
});

describe("MediNexus One - Emergency SOS & Accident Response", () => {
  test("POST /api/emergency/sos records incident with GPS and returns share token", async () => {
    const payload = {
      type: "Accident",
      latitude: 13.0604,
      longitude: 80.2496,
      accuracy: 12.5,
      details: "Two-wheeler skid near Greams road flyover. Bystanders attending.",
      shareMedicalConsent: false,
    };

    const res = await fetch(`${baseUrl}/api/emergency/sos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.status, "success");
    assert.ok(json.incidentNumber.startsWith("SOS-"));
    assert.ok(json.shareToken);
    assert.ok(json.shareUrl);
    assert.strictEqual(json.recordedLocation.latitude, 13.0604);
    assert.strictEqual(json.recordedLocation.longitude, 80.2496);

    // Verify honest disclaimer
    assert.ok(json.disclaimer.ambulanceStatus.includes("NOT_DISPATCHED"));
    assert.ok(json.disclaimer.callRequired.includes("112"));

    // Test public expiring share link
    const shareRes = await fetch(`${baseUrl}/api/emergency/share/${json.shareToken}`);
    assert.strictEqual(shareRes.status, 200);
    const shareJson = await shareRes.json();
    assert.strictEqual(shareJson.status, "active");
    assert.strictEqual(shareJson.incidentNumber, json.incidentNumber);
    assert.strictEqual(shareJson.location.latitude, 13.0604);
  });
});

describe("MediNexus One - AI Healthcare Navigation Assistant", () => {
  test("Emergency query immediately triggers safety alert and directs to 112 / 108", async () => {
    const res = await fetch(`${baseUrl}/api/ai/navigate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Severe chest pain radiating to left arm and cannot breathe" }),
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.isEmergency, true);
    assert.strictEqual(json.triageLevel, "IMMEDIATE_EMERGENCY");
    assert.ok(json.message.includes("Call emergency services immediately"));
    assert.ok(json.message.includes("112") || json.message.includes("108"));
  });

  test("Elective query provides appropriate clinical specialty and preparation tips", async () => {
    const res = await fetch(`${baseUrl}/api/ai/navigate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Suffering from severe knee joint pain after walking" }),
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.isEmergency, false);
    assert.strictEqual(json.triageLevel, "ELECTIVE_CONSULTATION");
    assert.ok(json.recommendedSpecialty.includes("Orthopaedics"));
    assert.ok(Array.isArray(json.preparationTips));
    assert.ok(json.disclaimer, "Disclaimer must always be present");
  });
});

describe("MediNexus One - Direct Repository Persistence & Integrity", () => {
  test("Appointment creation and retrieval via db repository preserves records", async () => {
    const sampleUserId = "test-patient-uuid-1234";
    const hospitals = await db.getHospitals();
    const appt = await db.createAppointment({
      patient_id: sampleUserId,
      hospital_id: hospitals[0].id,
      specialty: "Cardiology",
      date: "2026-11-05",
      time: "10:30",
      reason: "Routine cardiac evaluation",
    });

    assert.ok(appt.id);
    assert.strictEqual(appt.status, "pending");

    const patientAppointments = await db.getAppointmentsByPatient(sampleUserId);
    assert.ok(patientAppointments.some((a) => a.id === appt.id));

    // Reschedule
    const rescheduled = await db.updateAppointment(
      appt.id,
      { date: "2026-11-06", time: "11:00", status: "rescheduled" },
      sampleUserId,
      false
    );
    assert.strictEqual(rescheduled.status, "rescheduled");
    assert.strictEqual(rescheduled.date, "2026-11-06");

    // Cancel
    const cancelled = await db.updateAppointment(
      appt.id,
      { status: "cancelled", cancellation_reason: "Patient conflict" },
      sampleUserId,
      false
    );
    assert.strictEqual(cancelled.status, "cancelled");
  });

  test("Receipt issuance, calculation, and payment protections", async () => {
    const sampleUserId = "test-patient-uuid-1234";
    const hospitals = await db.getHospitals();
    const receipt = await db.createReceipt({
      patient_id: sampleUserId,
      hospital_id: hospitals[0].id,
      items: [
        { description: "Specialist Consultation", qty: 1, unit_price: 800, amount: 800 },
        { description: "12-Lead ECG", qty: 1, unit_price: 350, amount: 350 },
      ],
      subtotal: 1150,
      tax: 57.5,
      discount: 0,
      total: 1207.5,
      currency: "INR",
      payment_status: "unpaid",
    });

    assert.ok(receipt.id);
    assert.ok(receipt.receipt_number.startsWith("MNX-"));
    assert.strictEqual(receipt.total, 1207.5);
    assert.strictEqual(receipt.payment_status, "unpaid");

    const retrieved = await db.getReceiptById(receipt.id, sampleUserId, false);
    assert.strictEqual(retrieved.id, receipt.id);

    // Cross-user access check: another patient must be forbidden
    await assert.rejects(
      async () => {
        await db.getReceiptById(receipt.id, "different-patient-5678", false);
      },
      /Unauthorized/
    );
  });
});
