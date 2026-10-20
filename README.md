# MediNexus One — Complete AI Healthcare, Hospital Navigation & Emergency SOS Platform

MediNexus One is a full-stack, enterprise-grade connected healthcare platform built with **React 19 + Vite**, **Express + Node.js**, **Supabase PostgreSQL & Auth**, **Leaflet Maps**, and **Lucide React**.

---

## 🌟 Key Functional Modules

1. **Hospital & Clinic Discovery**
   - Verified hospital directory for Tamil Nadu & India (Apollo Greams, CMC Vellore, Fortis Malar, MIOT International, PSG Coimbatore, Gleneagles Perumbakkam).
   - Real GPS coordinates, verified specialty departments, available bed indicators, and emergency ER wait times.
2. **Interactive Maps & Navigation**
   - Leaflet + OpenStreetMap & Google Maps integration.
   - Permission-based device GPS capture, manual address fallback, and external directions links.
3. **Indoor 3D Wayfinding**
   - Multi-floor level selector (Floor 0 Ground, Floor 1, Floor 2).
   - 3D perspective and 2D top-down SVG rendering with start point, destination, turn-by-turn guidance, and receptionist egress notices.
4. **Appointment Management & Recovery**
   - Appointment booking with date, time slot, and medical department selection.
   - Self check-in upon arrival.
   - Reschedule modal with date/time pickers and cancellation workflow.
   - Integrated **Doctor Recovery** module recommending alternative specialists or nearby hospitals with multilingual speech in English, Tamil, Telugu, Malayalam, and Kannada.
5. **Care Journey Timeline**
   - Visual patient history timeline tracking past and upcoming visits, statuses (Pending, Confirmed, Completed, Cancelled).
6. **Medical Records Vault**
   - Secure patient clinical document vault.
   - Upload and categorize lab reports, prescriptions, radiology scans, and discharge summaries.
   - Strict privacy levels (`private` vs `emergency_accessible`).
7. **Patient Health Profile**
   - Blood group, allergies, chronic conditions, current medications, emergency medical notes.
   - Emergency contact management (CRUD family/physician contacts).
8. **Receipts & Invoices Module**
   - Unique receipt numbers (`MNX-2026-XXXXX`).
   - Itemized breakdown of charges, subtotal, applicable taxes (GST), discounts, and net total.
   - Printable invoice view triggering high-contrast print / PDF export via browser.
   - Strict financial integrity: rejects fabricated payments when payment gateway is unconfigured; validates signed webhooks.
9. **Emergency SOS & Accident Response System**
   - Prominent Emergency button with accessible high-contrast design.
   - 5-second countdown with immediate "Cancel False Alarm" option.
   - Real Web Audio API synthesizer siren tone with mute control.
   - Hardware accelerometer crash detection (`DeviceMotionEvent`) with explicit permission, false-positive cancellation, and background limitation disclaimer.
   - India emergency call buttons: **112** (National Emergency) and **108** (Ambulance).
   - Multilingual voice announcement in English and Tamil.
   - Expiring secure share link (`/api/emergency/share/:token`).
   - Honest 5-step status tracker: Device Recorded → Database Stored → User Phone Call Dialed → Provider SMS Dispatched → Operator Verified.
10. **AI Healthcare Navigation Assistant**
    - Conversational chat assistant with clinical safety rules.
    - Life-threatening symptom detection (chest pain, stroke, severe trauma) immediately directs user to 112 / 108.
    - Medical specialty and facility recommendations, consultation preparation checklists.
    - Google Gemini API integration when `GEMINI_API_KEY` is provided; resilient clinical rules engine when key is absent.
11. **Hospital Administrator & Staff Console**
    - Real-time database metrics (hospitals, appointments, revenue, emergency incidents).
    - Review and approve/confirm appointment requests.
    - System security audit log inspection.

---

## 🚀 Quick Startup Guide (Windows PowerShell)

### Prerequisites
- Node.js (v18+ recommended; tested on v26.8)
- npm (v9+)

### Step 1: Install Dependencies
```powershell
# In project root:
cd C:\Users\thame\Desktop\MediNexus-Reborn
npm install

# In backend directory:
cd backend
npm install
cd ..
```

### Step 2: Start the Backend API Server
```powershell
# From project root:
npm run server
# Or directly from backend:
# cd backend && npm run dev
```
The API server will listen on `http://localhost:3000`.

### Step 3: Start the Frontend Application
Open a second PowerShell terminal:
```powershell
cd C:\Users\thame\Desktop\MediNexus-Reborn
npm run dev
```
The Vite development server will start on `http://localhost:5173`.

Create an account from the sign-in screen to use local authentication. Local accounts work without Supabase and are stored in `backend/data/medinexus-store.json`; passwords are stored as scrypt hashes and browser sessions use an HTTP-only cookie. Local sign-up does not send email verification.

---

## 🧪 Automated Testing & Verification

Run the comprehensive integration test suite:
```powershell
cd C:\Users\thame\Desktop\MediNexus-Reborn
npm test
```
**Tests Covered:**
- Health endpoint status report (`GET /health`)
- Hospital discovery, search filtering, doctor directory, indoor map layouts
- Authentication & role boundaries (401 on unauthorized protected routes)
- Local sign-up, sign-in, cookie session restore, and sign-out
- Emergency SOS recording, coordinate capture, and share token verification
- AI clinical safety triage (emergency prompt triggers 112 warning)
- Direct repository persistence, appointment rescheduling, and invoice access controls

---

## 🗄️ Database Migrations (Supabase PostgreSQL)

The complete SQL schema with Row-Level Security (RLS) is located at:
`backend/sql/schema.sql`

To run in your Supabase project:
1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor**.
3. Copy and paste the contents of `backend/sql/schema.sql`.
4. Click **Run**.
