
import { useEffect, useMemo, useState } from "react";
import { findNearbyHospitals } from "./hospitalSearch.js";
import { findPreferredVoice, getSavedVoiceChoice } from "./lib/speech.js";

const cardStyle = {
  background: "var(--panel, #fff)",
  border: "1px solid var(--border, #e8e5f2)",
  borderRadius: 20,
  padding: 22,
  boxShadow: "0 12px 35px rgba(45,30,90,.06)",
};
const muted = { color: "var(--muted, #77738a)", fontSize: 14, lineHeight: 1.6 };

function hospitalName(hospital) {
  return hospital?.name || hospital?.hospitalName || "Hospital";
}
function hospitalAddress(hospital) {
  return [
    hospital?.address,
    hospital?.city,
    hospital?.state,
  ].filter(Boolean).join(", ");
}
function destinationFor(hospital) {
  return hospitalAddress(hospital) || hospitalName(hospital);
}
function distanceKm(from, hospital) {
  const rawLat = hospital?.latitude ?? hospital?.lat;
  const rawLon = hospital?.longitude ?? hospital?.lon ?? hospital?.lng;
  if (rawLat == null || rawLat === "" || rawLon == null || rawLon === "") return Number.POSITIVE_INFINITY;
  const lat = Number(rawLat);
  const lon = Number(rawLon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return Number.POSITIVE_INFINITY;
  const radians = (value) => (value * Math.PI) / 180;
  const dLat = radians(lat - from.latitude);
  const dLon = radians(lon - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function MapNavigation({
  language = "en",
  hospitals = [],
  initialHospital = null,
  appointments = [],
  onRefreshHospitals,
  onRequestAppointment,
}) {
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [gps, setGps] = useState(null);
  const [gpsStatus, setGpsStatus] = useState("Location not shared");
  const [gpsError, setGpsError] = useState("");
  const [routeOrigin, setRouteOrigin] = useState(null);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [nearbyHospitals, setNearbyHospitals] = useState([]);
  const [nearbyStatus, setNearbyStatus] = useState("");

  const directory = useMemo(() => {
    const seen = new Set();
    return [...nearbyHospitals, ...hospitals].filter((hospital) => {
      const id = String(hospital.id || hospital._id || "");
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [hospitals, nearbyHospitals]);

  const text = language === "ta"
    ? {
        title: "மருத்துவமனை வரைபடம்",
        subtitle: "உங்கள் மருத்துவமனை பதிவுகளைத் தேர்ந்தெடுத்து வழியைத் திறக்கவும்.",
        search: "மருத்துவமனை அல்லது நகரத்தைத் தேடுங்கள்",
        choose: "மருத்துவமனைத் தேர்ந்தெடுக்கவும்",
        gps: "என் இருப்பிடத்தைப் பயன்படுத்து",
        directions: "வழியைத் திற",
        request: "சந்திப்பு கோரு",
        demoTag: "உண்மையான வெளிப்புற வரைபடம் · இருப்பிட அனுமதி தேவை",
        demoNote: "மருத்துவமனை வெளிப்புற இடம் வரைபடச் சேவையிலிருந்து வருகிறது. உங்கள் தற்போதைய இடத்தைப் பெற, நீங்கள் உலாவி அனுமதி வழங்க வேண்டும். GPS கிடைக்கும் இடங்களில் ஒரு முறை மட்டுமே வாசிக்கப்படும்; தொடர்ந்து கண்காணிப்பு இல்லை.",
      }
    : {
        title: "Hospital navigation",
        subtitle: "Choose a hospital record, review its location, and open directions.",
        search: "Search hospitals or cities…",
        choose: "Choose a hospital",
        gps: "Use my current location",
        directions: "Get directions from my location ↗",
        request: "Request appointment",
        demoTag: "REAL OUTDOOR MAP",
        demoNote: "Choose a hospital, then use Get directions to create a route from your device location to that hospital. Your location is read once after permission is allowed.",
      };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = directory.filter((hospital) =>
      [hospital.name, hospital.address, hospital.city, hospital.state, hospital.type]
        .filter(Boolean).join(" ").toLowerCase().includes(q)
    );
    return gps
      ? matches.slice().sort((a, b) => distanceKm(gps, a) - distanceKm(gps, b))
      : matches;
  }, [directory, search, gps]);

  useEffect(() => {
    if (initialHospital) {
      setSelectedId(String(initialHospital.id || initialHospital._id || ""));
    }
  }, [initialHospital]);

  useEffect(() => {
    if (selectedId && !directory.some((h) => String(h.id || h._id || "") === selectedId)) {
      setSelectedId("");
    }
  }, [directory, selectedId]);

  const selected = directory.find((h) => String(h.id || h._id || "") === selectedId) || initialHospital || null;
  const destination = selected ? destinationFor(selected) : "Hospitals in Tamil Nadu, India";
  const origin = gps ? `${gps.latitude},${gps.longitude}` : "";
  const selectedRawLat = selected?.latitude ?? selected?.lat;
  const selectedRawLon = selected?.longitude ?? selected?.lon ?? selected?.lng;
  const selectedLat = Number(selectedRawLat);
  const selectedLon = Number(selectedRawLon);
  const selectedHasCoordinates = selectedRawLat != null && selectedRawLat !== "" && selectedRawLon != null && selectedRawLon !== "" && Number.isFinite(selectedLat) && Number.isFinite(selectedLon);
  const mapCenter = selectedHasCoordinates
    ? `${selectedLat},${selectedLon}`
    : gps ? `${gps.latitude},${gps.longitude}` : destination;
  const mapQuery = encodeURIComponent(destination);
  const embedUrl = routeOrigin && selectedHasCoordinates
    ? `https://maps.google.com/maps?saddr=${encodeURIComponent(`${routeOrigin.latitude},${routeOrigin.longitude}`)}&daddr=${encodeURIComponent(`${selectedLat},${selectedLon}`)}&output=embed`
    : `https://maps.google.com/maps?q=${encodeURIComponent(mapCenter)}&z=${gps ? 15 : 16}&output=embed`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1${origin ? `&origin=${encodeURIComponent(origin)}` : ""}&destination=${mapQuery}`;

  function captureGps() {
    setGpsError("");
    if (!navigator.geolocation) {
      setGpsError("This browser does not support location access.");
      return;
    }
    setGpsStatus("Requesting permission…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point = { latitude: coords.latitude, longitude: coords.longitude };
        setGps(point);
        setRouteOrigin(point);
        const nearest = directory
          .filter((hospital) => Number.isFinite(distanceKm(point, hospital)))
          .slice()
          .sort((a, b) => distanceKm(point, a) - distanceKm(point, b))[0];
        if (nearest) {
          const id = String(nearest.id || nearest._id || "");
          if (id) setSelectedId(id);
          setGpsStatus(`Nearest directory listing: ${hospitalName(nearest)} · ${distanceKm(point, nearest).toFixed(1)} km`);
        } else {
          setGpsStatus("Location captured. Searching nearby facilities…");
        }
        setNearbyStatus("Searching OpenStreetMap around your current location…");
        findNearbyHospitals(point.latitude, point.longitude)
          .then((found) => {
            setNearbyHospitals(found);
            setNearbyStatus(found.length
              ? `Found ${found.length} nearby OpenStreetMap listings. Mapping may be incomplete; confirm with the facility.`
              : "No named hospital or clinic was mapped nearby in OpenStreetMap.");
            const closest = [...found, ...directory]
              .filter((hospital) => Number.isFinite(distanceKm(point, hospital)))
              .sort((a, b) => distanceKm(point, a) - distanceKm(point, b))[0];
            if (closest) {
              setSelectedId(String(closest.id || closest._id));
              setGpsStatus(`Nearest listing: ${hospitalName(closest)} · ${distanceKm(point, closest).toFixed(1)} km`);
            }
          })
          .catch((error) => setNearbyStatus(`Live nearby search is unavailable: ${error.message}`));
      },
      (error) => {
        setGpsStatus("Location not shared");
        setGpsError(
          error.code === 1 ? "Location permission was denied." :
          error.code === 3 ? "Location request timed out." :
          "Could not obtain your location. You can still open directions."
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  function openDirections() {
    if (!selected) {
      setGpsError("Choose a hospital before opening directions.");
      return;
    }
    const openRoute = (point = gps) => {
      if (point) {
        setGps(point);
        setRouteOrigin(point);
      }
      const routeUrl = `https://www.google.com/maps/dir/?api=1${point ? `&origin=${encodeURIComponent(`${point.latitude},${point.longitude}`)}` : ""}&destination=${mapQuery}`;
      window.open(routeUrl, "_blank", "noopener,noreferrer");
    };
    if (gps) {
      openRoute(gps);
      return;
    }
    if (!navigator.geolocation) {
      setGpsStatus("Location access is unavailable. Opening the hospital destination instead.");
      openRoute(null);
      return;
    }
    setGpsError("");
    setGpsStatus("Requesting your location for directions…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => openRoute({ latitude: coords.latitude, longitude: coords.longitude }),
      () => {
        setGpsStatus("Location was not shared. Opening the hospital destination instead.");
        openRoute(null);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  function speakHospitalDetails() {
    if (!("speechSynthesis" in window)) {
      setVoiceStatus("Voice playback is not supported in this browser.");
      return;
    }
    if (!selected) {
      setVoiceStatus("Choose a hospital, or share your location to select the nearest directory listing.");
      return;
    }
    window.speechSynthesis.cancel();
    const distance = gps ? ` It is about ${distanceKm(gps, selected).toFixed(1)} kilometres from your current location.` : "";
    const locale = language === "ta" ? "ta-IN" : "en-IN";
    const voiceList = window.speechSynthesis.getVoices();
    const spokenDetails = language === "ta"
      ? `தேர்ந்தெடுத்த மருத்துவமனை: ${hospitalName(selected)}. முகவரி: ${hospitalAddress(selected) || "முகவரி பட்டியலிடப்படவில்லை"}.${gps ? ` உங்கள் தற்போதைய இடத்திலிருந்து சுமார் ${distanceKm(gps, selected).toFixed(1)} கிலோமீட்டர்.` : " உங்கள் தற்போதைய இடம் பகிரப்படவில்லை."} திறந்திருக்கும் நேரத்தையும் அவசர வசதியையும் மருத்துவமனையிடம் உறுதிப்படுத்துங்கள்.`
      : `${hospitalName(selected)}. ${hospitalAddress(selected) || "Address not listed."}.${distance} Current opening and emergency availability must be confirmed with the hospital.`;
    const utterance = new SpeechSynthesisUtterance(spokenDetails);
    utterance.lang = locale;
    utterance.voice = findPreferredVoice(voiceList, locale, getSavedVoiceChoice(language === "ta" ? "ta" : "en")) || null;
    utterance.onend = () => setVoiceStatus("Finished reading hospital details.");
    utterance.onerror = () => setVoiceStatus("Voice playback could not start.");
    window.speechSynthesis.speak(utterance);
    setVoiceStatus("Reading hospital details aloud.");
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={{ ...cardStyle, background: "radial-gradient(circle at 100% 0%,#e9e1ff 0,transparent 42%), var(--panel, #fff)" }}>
        <span style={{ display: "inline-flex", padding: "6px 11px", borderRadius: 999, background: "#eee8ff", color: "#6845c5", fontSize: 12, fontWeight: 800 }}>
          LOCATION SERVICES
        </span>
        <h1 style={{ fontSize: "clamp(25px,4vw,36px)", letterSpacing: "-1px", margin: "14px 0 8px" }}>{text.title}</h1>
        <p style={{ ...muted, marginTop: 0 }}>{text.subtitle}</p>
        <div className="map-demo-note" role="note"><b>{text.demoTag}</b><span>{text.demoNote}</span></div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12, marginTop: 20 }}>
          <label style={{ display: "grid", gap: 8, fontSize: 13, fontWeight: 700 }}>
            {text.choose}
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} style={{ width: "100%", padding: 13, borderRadius: 12, border: "1px solid #ded8ed", background: "#fff", color: "#2f2940" }}>
              <option value="">Select from directory</option>
              {directory.map((hospital, index) => {
                const id = String(hospital.id || hospital._id || "");
                return <option key={id || index} value={id} disabled={!id}>{hospitalName(hospital)}</option>;
              })}
            </select>
          </label>
          <label style={{ display: "grid", gap: 8, fontSize: 13, fontWeight: 700 }}>
            Search directory
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={text.search} style={{ width: "100%", boxSizing: "border-box", padding: 13, borderRadius: 12, border: "1px solid #ded8ed" }} />
          </label>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
          <button type="button" className="button button-secondary" onClick={captureGps}>{text.gps}</button>
          <button type="button" className="button button-secondary" onClick={speakHospitalDetails}>🔊 Read hospital details</button>
          <button type="button" className="button button-secondary" onClick={() => onRefreshHospitals?.()}>↻ Refresh hospitals</button>
          {selected && onRequestAppointment && selected.directorySource !== "openstreetmap" && (
            <button type="button" className="button button-primary" onClick={() => onRequestAppointment(selected)}>{text.request}</button>
          )}
        </div>
        <p style={{ ...muted, marginBottom: 0 }}>Location status: {gpsStatus}</p>
        {voiceStatus && <p role="status" style={{ ...muted, margin: "6px 0 0" }}>{voiceStatus}</p>}
        {nearbyStatus && <p role="status" style={{ ...muted, margin: "6px 0 0" }}>{nearbyStatus} {nearbyHospitals.length > 0 && <span>© OpenStreetMap contributors.</span>}</p>}
        {selected?.directorySource === "openstreetmap" && <p style={{ ...muted, margin: "6px 0 0" }}>Community-mapped listing for directions only. Appointment booking and live availability are not confirmed.</p>}
        {gpsError && <p role="alert" style={{ color: "#b42318", fontSize: 13 }}>{gpsError}</p>}
      </section>

      <section style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: 20, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: "0 0 6px", fontSize: 21 }}>{selected ? hospitalName(selected) : "Explore hospital locations"}</h2>
            <p style={{ ...muted, margin: 0 }}>{selected ? (hospitalAddress(selected) || "Address not provided by the directory") : "Select a hospital record to focus the map."}</p>
          </div>
          <button type="button" className="button button-primary" onClick={openDirections}>{text.directions}</button>
        </div>

        <iframe
          title="Hospital map"
          src={embedUrl}
          width="100%"
          height="410"
          loading="lazy"
          style={{ display: "block", border: 0, background: "#f0edf7" }}
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
        <div style={{ padding: 18, background: "#faf9fd" }}>
          <p style={{ ...muted, margin: 0 }}>
            Google Maps provides the outdoor map and route preview. When you allow location, the route begins at your device and ends at the selected hospital. Check the address and call before travelling.
          </p>
          {selected && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 12, fontSize: 13 }}>
              {selected.website && <a href={selected.website} target="_blank" rel="noreferrer">Official hospital website ↗</a>}
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([hospitalName(selected), hospitalAddress(selected)].filter(Boolean).join(", "))}`} target="_blank" rel="noreferrer">Hospital details on Google Maps ↗</a>
              <span style={{ color: "#756d84" }}>Beds and current patient totals are not connected to this directory.</span>
            </div>
          )}
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Directory results <span style={{ fontSize: 13, color: "#7a718c" }}>({filtered.length})</span></h2>
        {filtered.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12 }}>
            {filtered.map((hospital, index) => {
              const id = String(hospital.id || hospital._id || "");
              const active = id && id === selectedId;
              return (
                <button key={id || index} type="button" onClick={() => id && setSelectedId(id)} style={{ textAlign: "left", padding: 16, borderRadius: 15, border: active ? "1px solid #8b6ce0" : "1px solid #e9e5f2", background: active ? "#f5f0ff" : "#fff", cursor: id ? "pointer" : "default", color: "inherit" }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>✚</div>
                  <b>{hospitalName(hospital)}</b>
                  <p style={{ ...muted, marginBottom: 0 }}>{hospitalAddress(hospital) || "No address recorded"}</p>
                  {gps && Number.isFinite(distanceKm(gps, hospital)) && <small style={{ display: "block", marginTop: 6, color: "#6845c5" }}>{distanceKm(gps, hospital).toFixed(1)} km away</small>}
                  {hospital.directorySource === "openstreetmap" && <small style={{ display: "block", marginTop: 4, color: "#77738a" }}>OpenStreetMap listing</small>}
                </button>
              );
            })}
          </div>
        ) : (
          <p style={muted}>No matching hospital records. Share your current location to search OpenStreetMap for nearby facilities, or refresh the directory.</p>
        )}
        <p style={{ ...muted, marginBottom: 0, marginTop: 18 }}>Appointments associated with this directory: {appointments.length}. This count does not indicate provider availability.</p>
      </section>
    </div>
  );
}
