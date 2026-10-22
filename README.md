# MediNexus One

MediNexus One is a local full-stack healthcare navigation and emergency-support prototype for academic demonstration. It helps a user search hospital records, manage a local profile, request appointments, use a browser map, access voice guidance, and open the phone dialer for emergency numbers.

## Repository

https://github.com/thameemansari28/medinexus-one

## Features

- Local account registration and password-hashed sign-in. No confirmation email is required.
- Hospital directory with 50 Tamil Nadu hospital records, specialty information, official website links where listed, and Google Maps details.
- Outdoor map and directions using browser location permission.
- Presentation-only indoor wayfinding demo. It does not provide hospital-approved indoor room routes.
- Appointment requests, appointment timeline, medical records, receipts, health profile, and emergency contacts.
- Floating care assistant with browser voice output. Tamil speech depends on a Tamil voice installed on the device.
- Emergency actions that open the device dialer for 112 and 108. The website does not dispatch an ambulance or send automatic SMS.
- Presentation mode for simulated bed availability, patient load, doctor duty status, and appointment status. These values are clearly labelled as demo data.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | JavaScript, React 19, JSX, Vite, CSS, Lucide React |
| Backend | Node.js, Express, REST API, dotenv, Helmet, CORS |
| Local data | JSON files and Node.js crypto password hashing |
| Browser features | Geolocation API, Web Speech API, localStorage, Google Maps links, `tel:` links |

## Run Locally

### Prerequisites

- Node.js 18 or later
- npm

### Start the API

```powershell
cd "C:\path\to\MediNexus-One-connected-v3-extracted"
npm install
npm --prefix backend install
npm run server:dev
```

The backend runs at `http://localhost:3000`.

### Start the website

Open a second terminal in the same folder:

```powershell
npm run dev
```

Open the `Local:` address printed by Vite, normally `http://localhost:5173`.

## Important Demonstration Boundary

MediNexus One is an academic prototype. Outdoor maps, browser location permission, available browser voices, and `tel:` phone dial actions use device services. Appointment confirmation, bed counts, patient load, doctor duty status, and indoor routes are presentation data unless a verified hospital data connection is added.

## Research and References

See [REFERENCES.md](REFERENCES.md) for technical documentation and emergency-service references used in this project.