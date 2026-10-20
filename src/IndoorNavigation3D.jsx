import { useState } from "react";
import { findNearbyHospitals } from "./hospitalSearch.js";
import { findPreferredVoice, getSavedVoiceChoice } from "./lib/speech.js";

const APOLLO_FACILITY_IMAGE = "https://www.apollohospitals.com/sites/default/files/2026-02/ip---op-facility.jpg.jpeg";
const DEMO_LEVELS = {
  1: { title: "Arrival & registration", tamil: "வருகை மற்றும் பதிவு", rooms: ["Main entrance", "Registration", "Pharmacy", "Waiting area", "Lift lobby"], photo: APOLLO_FACILITY_IMAGE },
  2: { title: "Consultation & diagnostics", tamil: "ஆலோசனை மற்றும் பரிசோதனை", rooms: ["Cardiology", "Imaging", "Laboratory", "Waiting lounge", "Lift lobby"], photo: "https://www.apollohospitals.com/sites/default/files/2026-02/patient-care.jpg.jpeg" },
  3: { title: "Inpatient care", tamil: "உள்நோயாளர் சிகிச்சை", rooms: ["Patient rooms", "Nursing station", "Family lounge", "Discharge desk", "Lift lobby"], photo: "https://www.apollohospitals.com/sites/default/files/2026-02/550-bed.jpg.jpeg" },
};

const panel = {
  border: "1px solid #e9e4f2",
  borderRadius: 18,
  background: "#fff",
  boxShadow: "0 10px 28px rgba(45,30,90,.05)",
};

function hospitalId(hospital) {
  return String(hospital?.id || hospital?._id || "");
}

function hospitalName(hospital) {
  return hospital?.name || hospital?.hospitalName || "Hospital";
}

function hospitalPoint(hospital) {
  const rawLatitude = hospital?.latitude ?? hospital?.lat;
  const rawLongitude = hospital?.longitude ?? hospital?.lon ?? hospital?.lng;
  if (rawLatitude == null || rawLatitude === "" || rawLongitude == null || rawLongitude === "") return null;
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
}

function distanceKm(from, hospital) {
  const point = hospitalPoint(hospital);
  if (!point || !from) return Number.POSITIVE_INFINITY;
  const radians = (value) => (value * Math.PI) / 180;
  const dLat = radians(point.latitude - from.latitude);
  const dLon = radians(point.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(point.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function IndoorNavigation3D({
  hospitals = [],
  selectedHospital = null,
  language = "en",
  onSelectHospital,
  onRefreshHospitals,
  onOpenMap,
  onRequestAppointment,
}) {
  const [gps, setGps] = useState(null);
  const [gpsStatus, setGpsStatus] = useState("Location not shared");
  const [gpsError, setGpsError] = useState("");
  const [voiceStatus, setVoiceStatus] = useState("");
  const [nearbyHospitals, setNearbyHospitals] = useState([]);
  const [localSelection, setLocalSelection] = useState(null);
  const [nearbyStatus, setNearbyStatus] = useState("");
  const [demoFloor, setDemoFloor] = useState("1");
  const [demoDestination, setDemoDestination] = useState("Registration");
  const [demoStep, setDemoStep] = useState(-1);
  const tamil = language === "ta";
  const copy = tamil ? {
    badge: "உண்மையான வெளிப்புற மருத்துவமனை வரைபடம்",
    title: "மருத்துவமனை இடம் மற்றும் உள் வழிகாட்டி",
    intro: "மருத்துவமனையின் வெளிப்புற இடத்தைப் பாருங்கள்; GPS வழித்தடத்தையும் திறக்கலாம். மருத்துவமனை வழங்கிய உறுதிப்படுத்தப்பட்ட உள் வரைபடம் இருந்தால் மட்டுமே அறை வழிகாட்டுதல் கிடைக்கும்.",
    directory: "மருத்துவமனைப் பட்டியல்", choose: "மருத்துவமனையைத் தேர்ந்தெடுக்கவும்",
    location: "எனது தற்போதைய இடத்தைப் பயன்படுத்து", refresh: "மருத்துவமனைகளைப் புதுப்பி",
    satellite: "செயற்கைக்கோள் வரைபடம் · வெளிப்புற இடம்", addressMissing: "முகவரி பட்டியலிடப்படவில்லை",
    indoorTitle: "சரிபார்க்கப்பட்ட உள் வழிகாட்டி நிலை",
    indoorMissing: "இந்த மருத்துவமனைக்கான மருத்துவமனை அங்கீகரித்த உள் தள வரைபடம், அறை எண்கள் அல்லது வழித்தடத் தரவு இணைக்கப்படவில்லை. இந்தப் பக்கம் உண்மையான வெளிப்புற இடம் மற்றும் சாதன வழித்தடத்தை மட்டுமே காட்டுகிறது. உள் வழிக்காக வரவேற்பில் கேளுங்கள்.",
    outdoorNote: "இது மருத்துவமனையின் வெளிப்புற இடம் மட்டுமே; உள் அறை வழிகாட்டி அல்ல. அவசரநிலையில் 112 அல்லது 108-ஐ அழைத்து அவர்களின் வழிமுறைகளைப் பின்பற்றுங்கள்.",
    maps: "Google Maps-ஐத் திறக்கவும் ↗", directions: "வழித்தடம் ↗", speak: "விவரங்களைக் கேளுங்கள்",
    mapPage: "மருத்துவமனை வரைபடம்", appointment: "சந்திப்பைக் கோருங்கள்",
    emergency: "அவசரமா?", emergencyNote: "அவசர அறை வழிக்காக இணைய வரைபடத்தைப் பயன்படுத்த வேண்டாம். 112 அல்லது 108-ஐ அழைக்கவும்.",
    call112: "112-ஐ அழைக்கவும்", call108: "108-ஐ அழைக்கவும்",
  } : {
    badge: "REAL HOSPITAL LOCATION MAP", title: "Hospital location & indoor guidance",
    intro: "View the hospital’s real outdoor location and open GPS directions. Room-level indoor guidance appears only when the hospital supplies a verified floor plan.",
    directory: "Hospital directory", choose: "Choose a hospital", location: "Use my current location", refresh: "Refresh hospitals",
    satellite: "SATELLITE MAP · OUTDOOR LOCATION", addressMissing: "Address not listed",
    indoorTitle: "Verified indoor guidance status",
    indoorMissing: "No hospital-approved indoor floor plan, room number, or route data is connected for this facility. This page shows the real outdoor location and device directions only. Ask reception for verified directions inside the building.",
    outdoorNote: "This is the facility’s outdoor location, not an indoor room guide. In an emergency, call 112 or 108 and follow the operator’s instructions.",
    maps: "Open Google Maps ↗", directions: "Get directions ↗", speak: "Read details aloud",
    mapPage: "Open hospital map", appointment: "Request appointment", emergency: "Emergency?",
    emergencyNote: "Do not use a web map for emergency-room routing. Call 112 or 108 and follow the operator’s instructions.",
    call112: "Call 112", call108: "Call 108",
  };
  const selected = localSelection || selectedHospital || hospitals[0] || null;
  const directory = [...nearbyHospitals, ...hospitals].filter((hospital, index, all) =>
    all.findIndex((candidate) => hospitalId(candidate) === hospitalId(hospital)) === index
  );
  const point = hospitalPoint(selected);
  const place = point
    ? `${point.latitude},${point.longitude}`
    : [selected?.address, selected?.city, selected?.state]
        .filter(Boolean)
        .join(", ") || hospitalName(selected);
  const encodedPlace = encodeURIComponent(place);
  const mapUrl = gps && point
    ? `https://maps.google.com/maps?saddr=${encodeURIComponent(`${gps.latitude},${gps.longitude}`)}&daddr=${encodeURIComponent(`${point.latitude},${point.longitude}`)}&output=embed`
    : `https://maps.google.com/maps?q=${encodedPlace}&t=k&z=18&output=embed`;
  const googleMapsUrl = point
    ? `https://www.google.com/maps/@${point.latitude},${point.longitude},18z/data=!3m1!1e3`
    : `https://www.google.com/maps/search/?api=1&query=${encodedPlace}`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1${gps ? `&origin=${encodeURIComponent(`${gps.latitude},${gps.longitude}`)}` : ""}&destination=${encodedPlace}`;
  const level = DEMO_LEVELS[demoFloor];
  const routeRooms = level.rooms;
  const roomPoints = [
    { x: 236, y: 164, doorX: 236, doorY: 218 },
    { x: 503, y: 147, doorX: 503, doorY: 202 },
    { x: 769, y: 133, doorX: 769, doorY: 187 },
    { x: 290, y: 362, doorX: 290, doorY: 309 },
    { x: 557, y: 348, doorX: 557, doorY: 295 },
  ];
  const destinationIndex = Math.max(1, routeRooms.indexOf(demoDestination));
  const destinationPoint = roomPoints[destinationIndex];
  const corridorPoint = { x: destinationPoint.doorX, y: destinationIndex < 3 ? 225 : 278 };
  const demoRoute = `M188 260 L${corridorPoint.x} ${corridorPoint.y} L${destinationPoint.x} ${destinationPoint.y}`;
  const demoInstruction = tamil
    ? [`தரை ${demoFloor} மாதிரி வரைபடம் திறக்கப்பட்டுள்ளது.`, `${level.tamil} பகுதியில் உள்ள மைய நடைபாதையைப் பின்தொடருங்கள்.`, `${demoDestination} மாதிரி இலக்கை அடைந்துவிட்டீர்கள்.`]
    : [`Floor ${demoFloor} demo map is open.`, `Follow the central corridor in ${level.title}.`, `You have reached the demo destination: ${demoDestination}.`];

  function captureLocation() {
    setGpsError("");
    if (!navigator.geolocation) {
      setGpsError("This browser does not support location access.");
      return;
    }
    setGpsStatus("Requesting permission…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const current = { latitude: coords.latitude, longitude: coords.longitude };
        setGps(current);
    setGpsStatus(tamil
      ? `இந்தச் சாதனத்தில் இடம் பெறப்பட்டது (±${Math.round(coords.accuracy)} மீ). அருகிலுள்ள இடங்களைத் தேடுகிறது…`
      : `Current location captured on this device (±${Math.round(coords.accuracy)} m). Searching nearby facilities…`);
        setNearbyStatus(tamil ? "10 கி.மீ. சுற்றளவில் OpenStreetMap-இல் தேடுகிறது…" : "Searching OpenStreetMap within 10 km…");
        findNearbyHospitals(current.latitude, current.longitude)
          .then((found) => {
            setNearbyHospitals(found);
            setNearbyStatus(found.length
              ? (tamil ? `${found.length} அருகிலுள்ள OpenStreetMap பதிவுகள் கிடைத்தன. செல்லும் முன் மருத்துவமனையுடன் உறுதிப்படுத்தவும்.` : `Found ${found.length} nearby community-mapped listings. Confirm the facility before travelling.`)
              : (tamil ? "OpenStreetMap-இல் அருகிலுள்ள மருத்துவமனைப் பதிவு கிடைக்கவில்லை." : "No named hospital or clinic was mapped nearby in OpenStreetMap."));
            const closest = [...found, ...hospitals]
              .filter((hospital) => hospitalPoint(hospital))
              .sort((a, b) => distanceKm(current, a) - distanceKm(current, b))[0];
            if (closest) {
              setLocalSelection(closest);
              onSelectHospital?.(closest);
              setGpsStatus(tamil
                ? `அருகிலுள்ள பட்டியல்: ${hospitalName(closest)} · ${distanceKm(current, closest).toFixed(1)} கி.மீ.`
                : `Nearest directory listing: ${hospitalName(closest)} · ${distanceKm(current, closest).toFixed(1)} km`);
            }
          })
          .catch((error) => setNearbyStatus(tamil ? `அருகிலுள்ள தேடல் கிடைக்கவில்லை: ${error.message}` : `Live nearby search is unavailable: ${error.message}`));
      },
      (error) => {
        setGpsStatus("Location not shared");
        setGpsError(tamil
          ? (error.code === 1 ? "இட அனுமதி மறுக்கப்பட்டது." : "இடத்தைப் பெற முடியவில்லை. மருத்துவமனை வரைபடத்தைத் திறக்கலாம்.")
          : (error.code === 1 ? "Location permission was denied." : "Could not obtain your location. You can still open the hospital map."));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  function readHospitalDetails() {
    if (!("speechSynthesis" in window)) {
      setVoiceStatus("Voice playback is not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const details = [hospitalName(selected), selected?.address, selected?.city, selected?.state].filter(Boolean).join(". ");
    const voices = window.speechSynthesis.getVoices();
    const parts = tamil
      ? [
        [`இந்த மருத்துவமனை: ${hospitalName(selected)}. முகவரி: ${selected?.address || ""}, ${selected?.city || ""}, ${selected?.state || ""}. சரிபார்க்கப்பட்ட உள் அறை வழி வழங்கப்படவில்லை.`, "ta-IN"],
        [`Hospital: ${details}. A verified indoor room route is not supplied.`, "en-IN"],
      ]
      : [[`${details}. This is the outdoor location; verified indoor room directions are not available.`, "en-IN"]];
    parts.forEach(([text, locale], index) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = locale;
      utterance.rate = 0.94;
      utterance.voice = findPreferredVoice(voices, locale, getSavedVoiceChoice(locale.startsWith("ta") ? "ta" : "en")) || null;
      if (index === parts.length - 1) utterance.onend = () => setVoiceStatus(tamil ? "விவரங்கள் முடிந்தன." : "Finished reading facility details.");
      utterance.onerror = () => setVoiceStatus(tamil ? "குரல் இயங்கவில்லை." : "Voice playback could not start.");
      window.speechSynthesis.speak(utterance);
    });
    setVoiceStatus(tamil ? "தமிழ் மற்றும் English விவரங்களைச் சொல்கிறது." : "Reading facility details aloud.");
  }

  function openDirections() {
    const openRoute = (origin) => {
      if (origin) setGps(origin);
      const url = `https://www.google.com/maps/dir/?api=1${origin ? `&origin=${encodeURIComponent(`${origin.latitude},${origin.longitude}`)}` : ""}&destination=${encodedPlace}`;
      window.open(url, "_blank", "noopener,noreferrer");
    };
    if (gps) {
      openRoute(gps);
      return;
    }
    if (!navigator.geolocation) {
      setGpsStatus(tamil ? "இருப்பிட அனுமதி இல்லை; மருத்துவமனை இடம் மட்டும் திறக்கப்படுகிறது." : "Location is unavailable; opening the hospital destination only.");
      openRoute(null);
      return;
    }
    setGpsError("");
    setGpsStatus(tamil ? "வழித்தடத்திற்காக உங்கள் இடத்தைக் கேட்கிறது…" : "Requesting your location for directions…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => openRoute({ latitude: coords.latitude, longitude: coords.longitude }),
      () => { setGpsStatus(tamil ? "இடம் பகிரப்படவில்லை; மருத்துவமனை இடம் மட்டும் திறக்கப்படுகிறது." : "Location was not shared; opening the hospital destination only."); openRoute(null); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section style={{ ...panel, padding: 22, background: "radial-gradient(circle at 100% 0%,#e9e0ff 0,transparent 38%), #fff" }}>
        <span style={{ display: "inline-flex", padding: "6px 11px", borderRadius: 999, background: "#eee8ff", color: "#6845c5", fontSize: 11, fontWeight: 800, letterSpacing: ".07em" }}>
          {copy.badge}
        </span>
        <h1 style={{ margin: "14px 0 8px", fontSize: "clamp(25px,4vw,36px)", letterSpacing: "-.04em" }}>{copy.title}</h1>
        <p style={{ margin: 0, color: "#77738a", lineHeight: 1.65 }}>
          {copy.intro}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginTop: 18 }}>
          <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 700 }}>
            {copy.directory}
            <select
              value={hospitalId(selected)}
              onChange={(event) => {
                const hospital = directory.find((item) => hospitalId(item) === event.target.value) || null;
                setLocalSelection(hospital);
                onSelectHospital?.(hospital);
              }}
              style={{ padding: 12, borderRadius: 12, border: "1px solid #ded8ed", background: "#fff" }}
            >
              <option value="">{copy.choose}</option>
              {directory.map((hospital, index) => <option key={hospitalId(hospital) || index} value={hospitalId(hospital)}>{hospitalName(hospital)}{hospital.directorySource === "openstreetmap" ? " · OpenStreetMap" : ""}</option>)}
            </select>
          </label>
          <div style={{ display: "flex", alignItems: "end", gap: 9, flexWrap: "wrap" }}>
            <button type="button" className="button button-secondary" onClick={captureLocation}>📍 {copy.location}</button>
            <button type="button" className="button button-secondary" onClick={() => onRefreshHospitals?.()}>↻ {copy.refresh}</button>
          </div>
        </div>
        <p role="status" style={{ margin: "12px 0 0", color: "#77738a", fontSize: 12 }}>{tamil && gpsStatus === "Location not shared" ? "இடம் பகிரப்படவில்லை" : gpsStatus}</p>
        {gpsError && <p role="alert" style={{ margin: "6px 0 0", color: "#b42318", fontSize: 12 }}>{tamil ? "இடத்தைப் பெற முடியவில்லை. உலாவி அனுமதியைச் சரிபார்க்கவும்; இல்லையெனில் மருத்துவமனை வரைபடத்தைத் திறக்கலாம்." : gpsError}</p>}
      </section>

      <section style={{ ...panel, overflow: "hidden" }}>
        <div style={{ padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: "0 0 5px", fontSize: 21 }}>{hospitalName(selected)}</h2>
            <p style={{ margin: 0, color: "#77738a", fontSize: 13 }}>{[selected?.address, selected?.city, selected?.state].filter(Boolean).join(", ") || copy.addressMissing}</p>
          </div>
          <span style={{ padding: "7px 10px", borderRadius: 999, background: "#edf8f3", color: "#17633e", fontWeight: 800, fontSize: 10 }}>{copy.satellite}</span>
        </div>
        <iframe title={`Satellite map for ${hospitalName(selected)}`} src={mapUrl} width="100%" height="470" loading="lazy" style={{ display: "block", border: 0, background: "#f0edf7" }} referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
        <div style={{ padding: 18, background: "#faf9fd" }}>
          <div className="indoor-map-status" role="status">
            <strong>{copy.indoorTitle}</strong>
            <p>{copy.indoorMissing}</p>
          </div>
          <p style={{ margin: "12px 0", color: "#6f6880", fontSize: 12, lineHeight: 1.65 }}>{copy.outdoorNote}</p>
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            <a className="button button-primary" href={googleMapsUrl} target="_blank" rel="noreferrer">{copy.maps}</a>
            <button type="button" className="button button-secondary" onClick={openDirections}>{copy.directions}</button>
            <button type="button" className="button button-secondary" onClick={readHospitalDetails}>🔊 {copy.speak}</button>
            <button type="button" className="button button-secondary" onClick={() => onOpenMap?.(selected)}>{copy.mapPage}</button>
            {selected?.directorySource !== "openstreetmap" && <button type="button" className="button button-secondary" onClick={() => onRequestAppointment?.(selected)}>{copy.appointment}</button>}
          </div>
          {voiceStatus && <p role="status" style={{ margin: "10px 0 0", color: "#77738a", fontSize: 12 }}>{voiceStatus}</p>}
          {nearbyStatus && <p role="status" style={{ margin: "10px 0 0", color: "#77738a", fontSize: 12 }}>{nearbyStatus} {nearbyHospitals.length > 0 && <span>© OpenStreetMap contributors.</span>}</p>}
        </div>
      </section>

      <section className="indoor-demo-card" aria-labelledby="indoor-demo-title">
        <div className="indoor-demo-heading">
          <div>
            <span className="indoor-demo-eyebrow">{tamil ? "வழங்கல் விளக்க மாதிரி" : "PRESENTATION DEMO"}</span>
            <h2 id="indoor-demo-title">{tamil ? "3D உள் மருத்துவமனை வழிகாட்டி" : "3D indoor hospital guide"}</h2>
            <p>{tamil ? "உண்மையான மருத்துவமனைப் படத்தை அடிப்படையாகக் கொண்ட ஊடாடும் உள் வழிகாட்டி விளக்க மாதிரி" : "Interactive indoor wayfinding demo with public hospital facility imagery"}</p>
          </div>
          <span className="indoor-demo-chip">{tamil ? "விளக்க மாதிரி" : "DEMO EXPERIENCE"}</span>
        </div>
        <div className="indoor-demo-layout">
          <figure className="indoor-demo-photo">
            <img key={level.photo} src={level.photo} alt={tamil ? "Apollo Hospitals வெளியிட்ட வசதி படம்" : "Hospital facility image published by Apollo Hospitals"} loading="lazy" />
            <figcaption><span>{tamil ? "Apollo Hospitals வெளியிட்ட வசதி படம்" : "Apollo Hospitals public facility image"}</span><a href="https://www.apollohospitals.com/hospitals/apollo-hospitals-greams-road-chennai" target="_blank" rel="noreferrer">{tamil ? "மூலம் ↗" : "Source ↗"}</a></figcaption>
          </figure>
          <div className="indoor-demo-experience">
            <div className="indoor-demo-controls">
              <label>{tamil ? "தளம்" : "Floor"}<select value={demoFloor} onChange={(event) => { const next = event.target.value; setDemoFloor(next); setDemoDestination(DEMO_LEVELS[next].rooms[1]); setDemoStep(-1); }}>{Object.keys(DEMO_LEVELS).map((floor) => <option value={floor} key={floor}>{tamil ? `தளம் ${floor} · ${DEMO_LEVELS[floor].tamil}` : `Floor ${floor} · ${DEMO_LEVELS[floor].title}`}</option>)}</select></label>
              <label>{tamil ? "இலக்கு" : "Destination"}<select value={demoDestination} onChange={(event) => { setDemoDestination(event.target.value); setDemoStep(-1); }}>{routeRooms.slice(1).map((room) => <option key={room} value={room}>{room}</option>)}</select></label>
            </div>
            <div className="indoor-demo-scene" data-floor={demoFloor} aria-label={tamil ? `தளம் ${demoFloor} 3D விளக்க மாதிரி` : `Floor ${demoFloor} 3D wayfinding demo`}>
              <div className="indoor-demo-floor">
                <svg viewBox="0 0 1000 500" role="img" aria-label={tamil ? "3D உள் வழிகாட்டி விளக்க மாதிரி" : "3D indoor wayfinding demonstration"}>
                  <defs><linearGradient id="demo-floor-gradient" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#fff"/><stop offset="1" stopColor="#eee7ff"/></linearGradient><linearGradient id="demo-wall-gradient" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#ffffff"/><stop offset="1" stopColor="#d9ceef"/></linearGradient><filter id="demo-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#4b3880" floodOpacity=".16"/></filter><marker id="demo-arrow" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,1 L8,5 L0,9 Z" fill="#7651df"/></marker></defs>
                  <path d="M150 444 L935 374 L935 402 L150 472 Z" fill="#d6c9ec"/><path d="M90 82 L870 45 L935 374 L150 444 Z" fill="url(#demo-floor-gradient)" stroke="#c9bced" strokeWidth="7" filter="url(#demo-shadow)"/>
                  <path d="M90 82 L870 45 L870 65 L90 102 Z" fill="url(#demo-wall-gradient)" opacity=".92"/><path d="M870 45 L935 374 L935 402 L870 65 Z" fill="#d0c2e8" opacity=".9"/>
                  <path d="M170 260 L825 224" stroke="#d9d0ed" strokeWidth="90" strokeLinecap="round"/><path d="M170 260 L825 224" stroke="#fff" strokeWidth="72" strokeLinecap="round"/>
                  {[[130,112],[397,94],[664,81],[180,309],[453,295]].map(([x, y], index) => <g className={`indoor-demo-room ${index === destinationIndex ? "is-destination" : ""}`} key={routeRooms[index]}><path d={`M${x} ${y} L${x + 205} ${y - 10} L${x + 216} ${y + 96} L${x + 12} ${y + 106} Z`}/><path className="indoor-demo-room-depth" d={`M${x + 12} ${y + 106} L${x + 216} ${y + 96} L${x + 216} ${y + 110} L${x + 12} ${y + 120} Z`}/><text x={x + 106} y={y + 52}>{routeRooms[index]}</text></g>)}
                  <path d={demoRoute} fill="none" stroke="#7651df" strokeWidth="8" strokeDasharray="14 13" strokeLinecap="round" markerEnd="url(#demo-arrow)" className="indoor-demo-route-line"/>
                  <circle cx="188" cy="260" r="20" fill="#19a881" stroke="white" strokeWidth="6"/><circle cx={destinationPoint.x} cy={destinationPoint.y} r="18" fill="#7651df" stroke="white" strokeWidth="6"/>
                  <text x="180" y="265" className="indoor-demo-map-icon">S</text><text x={destinationPoint.x - 8} y={destinationPoint.y + 5} className="indoor-demo-map-icon">●</text>
                </svg>
              </div>
              <span className="indoor-demo-scene-caption">{tamil ? `தளம் ${demoFloor} · 3D விளக்க மாதிரி` : `Floor ${demoFloor} · 3D demonstration`}</span>
            </div>
            <div className="indoor-demo-route-controls"><button type="button" className="button button-primary" onClick={() => setDemoStep((step) => step < 0 ? 0 : (step + 1) % demoInstruction.length)}>{demoStep < 0 ? (tamil ? "வழிகாட்டியைத் தொடங்கு" : "Start guided demo") : demoStep === demoInstruction.length - 1 ? (tamil ? "மீண்டும் தொடங்கு" : "Restart") : (tamil ? "அடுத்த படி" : "Next step")}</button><span role="status">{demoStep < 0 ? (tamil ? "இலக்கைத் தேர்ந்தெடுக்கவும்." : "Select a destination to preview the journey.") : `${demoStep + 1}/${demoInstruction.length} · ${demoInstruction[demoStep]}`}</span></div>
          </div>
        </div>
        <p className="indoor-demo-disclaimer">{tamil ? "இந்த 3D வழித்தடம் வழங்கல் விளக்க மாதிரி; உண்மையான அறை வழித்தடமாக பயன்படுத்த வேண்டாம்." : "This 3D route is a presentation demonstration and must not be used as a real room route."}</p>
      </section>

      <section style={{ ...panel, padding: 18, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <strong>{copy.emergency}</strong>
        <span style={{ color: "#77738a", fontSize: 13 }}>{copy.emergencyNote}</span>
        <a className="button button-danger" href="tel:112">{copy.call112}</a>
        <a className="button button-secondary" href="tel:108">{copy.call108}</a>
      </section>
    </div>
  );
}
