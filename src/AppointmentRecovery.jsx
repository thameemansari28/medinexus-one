
import { useCallback, useEffect, useState } from "react";
import { apiRequest as api } from "./api.js";

const styles = {
  panel: { background: "var(--panel, #fff)", border: "1px solid var(--border, #e8e5f2)", borderRadius: 20, padding: 24, boxShadow: "0 12px 35px rgba(45,30,90,.06)" },
  muted: { color: "var(--muted, #77738a)", fontSize: 14, lineHeight: 1.6 },
  chip: { display: "inline-flex", padding: "6px 11px", borderRadius: 999, background: "#f0ebff", color: "#6845c5", fontSize: 12, fontWeight: 700 },
};

function getStatus(item) {
  return String(item.status || "Pending").toLowerCase();
}

function statusLabel(status) {
  if (status.includes("confirm")) return "Demo confirmation";
  if (status.includes("cancel")) return "Cancelled";
  if (status.includes("complete")) return "Completed";
  if (status.includes("reject")) return "Declined";
  return "Saved in MediNexus";
}

function statusColor(status) {
  if (status.includes("confirm") || status.includes("complete")) {
    return { background: "#e5f8ef", color: "#18794e" };
  }
  if (status.includes("cancel") || status.includes("reject")) {
    return { background: "#fff0f0", color: "#b42318" };
  }
  return { background: "#fff5df", color: "#946200" };
}

function formatDate(value) {
  if (!value) return "Date not provided";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

// Deliberately stable presentation data. The values vary by hospital so a demo
// does not look copied, while the UI identifies every value as simulated.
function presentationSeed(value) {
  return [...String(value || "hospital")].reduce((total, char) => ((total * 31) + char.charCodeAt(0)) >>> 0, 17);
}

function presentationOperations(hospitalId) {
  const seed = presentationSeed(hospitalId);
  const availableBeds = 6 + (seed % 19);
  const totalBeds = 110 + (seed % 190);
  const currentPatients = Math.max(1, totalBeds - availableBeds - (9 + (seed % 23)));
  const hour = 9 + (seed % 7);
  const minute = seed % 2 ? "30" : "00";
  return {
    availableBeds,
    totalBeds,
    currentPatients,
    waitingTime: `${12 + (seed % 34)} min`,
    doctorSlot: `Today · ${hour}:${minute} ${hour >= 12 ? "PM" : "AM"}`,
  };
}

function presentationDoctors(hospital, specialty) {
  const area = specialty || hospital.specialties?.[0] || "General Medicine";
  const seed = presentationSeed(`${hospital.id}-${area}`);
  const startHour = 9 + (seed % 3);
  return [0, 1].map((index) => ({
    id: `presentation-${hospital.id}-${index}`,
    name: `Presentation duty doctor ${index + 1}`,
    qualification: `${area} · ${String(startHour + index).padStart(2, "0")}:00–${String(startHour + index + 4).padStart(2, "0")}:00`,
    presentation: true,
  }));
}

export default function PatientJourney({ appointments: suppliedAppointments, hospitals = [], language = "en", onBookHospital, onSpeakStatus }) {
  const [appointments, setAppointments] = useState(suppliedAppointments || []);
  const [loading, setLoading] = useState(!suppliedAppointments);
  const [error, setError] = useState("");
  const [doctorDirectory, setDoctorDirectory] = useState({});
  const [specialtyFilter, setSpecialtyFilter] = useState("");
  const [presentationMode, setPresentationMode] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api("/patient/appointments");
      const list = Array.isArray(result)
        ? result
        : result?.appointments || result?.items || result?.data || [];
      setAppointments(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err?.message || "Could not load your appointment history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (suppliedAppointments) {
      setAppointments(suppliedAppointments);
      setLoading(false);
      return;
    }
    void load();
  }, [suppliedAppointments, load]);

  useEffect(() => {
    let active = true;
    const loadDoctorDirectories = async () => {
      const results = await Promise.all(hospitals.map(async (hospital) => {
        const id = hospital.id || hospital._id;
        if (!id) return [String(hospital.name), { doctors: [], connected: false }];
        try {
          const result = await api(`/hospitals/${encodeURIComponent(id)}/doctors`);
          const doctors = Array.isArray(result?.doctors) ? result.doctors : [];
          return [String(id), { doctors, connected: result?.doctorDirectoryStatus === "connected" && doctors.length > 0, source: result?.directorySource || "", sourceUrl: doctors.find((doctor) => doctor.sourceUrl)?.sourceUrl || "" }];
        } catch {
          return [String(id), { doctors: [], connected: false }];
        }
      }));
      if (active) setDoctorDirectory(Object.fromEntries(results));
    };
    void loadDoctorDirectories();
    return () => { active = false; };
  }, [hospitals]);

  const ordered = [...appointments].sort((a, b) => {
    const da = new Date(`${String(a.date || "").slice(0, 10)}T12:00:00`).getTime();
    const db = new Date(`${String(b.date || "").slice(0, 10)}T12:00:00`).getTime();
    return (db || 0) - (da || 0);
  });

  const confirmed = appointments.filter((item) =>
    ["confirmed", "completed"].some((word) => getStatus(item).includes(word))
  ).length;
  const tamil = language === "ta";
  const listedSpecialties = [...new Set(hospitals.flatMap((hospital) => Array.isArray(hospital.specialties) ? hospital.specialties : []))].sort();

  return (
    <section style={styles.panel}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <span style={{ ...styles.chip }}>{tamil ? "மருத்துவர் மற்றும் சந்திப்பு நிலை" : "DOCTOR & APPOINTMENT STATUS"}</span>
          <h2 style={{ margin: "14px 0 6px", fontSize: 25, letterSpacing: "-.7px" }}>
            {tamil ? "மருத்துவர் பட்டியல் மற்றும் சந்திப்பு கோரிக்கை" : "Hospital doctors and appointment request"}
          </h2>
          <p style={{ ...styles.muted, margin: 0 }}>
            {tamil ? "துறையைத் தேர்ந்தெடுத்து மருத்துவர் விவரங்களையும் உங்கள் கோரிக்கை நேரத்தையும் பாருங்கள். வழங்கல் நிலை இயக்கத்தில் இருக்கும்போது ஒவ்வொரு மருத்துவமனைக்கும் படுக்கை, நோயாளர் மற்றும் மருத்துவர் நிலை விளக்கத் தரவு காட்டப்படும்." : "Filter by specialty to see doctor information and your saved request time. With presentation mode on, every hospital shows simulated bed, patient, and doctor status."}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "end", flexWrap: "wrap", gap: 10 }}>
          <label className="field-label" style={{ margin: 0, minWidth: 220 }}>
            {tamil ? "மருத்துவத் துறை" : "Filter by specialty"}
            <select value={specialtyFilter} onChange={(event) => setSpecialtyFilter(event.target.value)}>
              <option value="">{tamil ? "அனைத்து துறைகளும்" : "All specialties"}</option>
              {listedSpecialties.map((specialty) => <option key={specialty} value={specialty}>{specialty}</option>)}
            </select>
          </label>
          <button type="button" className="button button-secondary" onClick={load} disabled={loading}>
          {loading ? (tamil ? "புதுப்பிக்கிறது…" : "Refreshing…") : (tamil ? "↻ கோரிக்கைகளைப் புதுப்பிக்கவும்" : "↻ Refresh requests")}
          </button>
          <button type="button" className={`button ${presentationMode ? "button-primary" : "button-secondary"}`} onClick={() => setPresentationMode((value) => !value)}>
            {presentationMode ? (tamil ? "வழங்கல் நிலை: இயக்கத்தில்" : "Presentation live demo: ON") : (tamil ? "வழங்கல் நிலை: முடக்கப்பட்டது" : "Presentation live demo: OFF")}
          </button>
        </div>
      </div>

      <div className="availability-notice" role="note">
        <strong>{presentationMode ? (tamil ? "வழங்கல் விளக்க மாதிரி · உருவகப்படுத்தப்பட்ட நேரடி நிலை" : "PRESENTATION DEMO · SIMULATED LIVE STATUS") : (tamil ? "மருத்துவர், படுக்கை மற்றும் சந்திப்பு நிலை" : "Doctor, bed, and appointment status")}</strong>
        <span>{tamil
          ? (presentationMode ? "ஒவ்வொரு மருத்துவமனை அட்டையிலும் காட்டப்படும் படுக்கைகள், நோயாளர் எண்ணிக்கை, காத்திருப்பு நேரம் மற்றும் மருத்துவர் பணிநிலை விளக்கக் காட்சிக்காக உருவகப்படுத்தப்பட்டவை. உங்கள் கோரிக்கை தேதி மற்றும் நேரம் மட்டும் MediNexus-ல் சேமிக்கப்பட்ட உண்மையான தகவல்." : "பொதுவாக வெளியிடப்பட்ட மருத்துவமனை அடைவிலிருந்து மட்டும் மருத்துவர் பெயர்கள் காட்டப்படும். நேரடி காலிப் படுக்கைகள், தற்போதைய நோயாளர் எண்ணிக்கை மற்றும் மருத்துவர் பணிநேரம் மருத்துவமனைகள் வழங்கவில்லை.")
          : (presentationMode ? "Bed counts, patient load, waiting time, and doctor duty status below are simulated for presentation. Only your saved request date and time comes from MediNexus." : "Only publicly listed doctors are shown. Hospitals do not supply a live feed for vacant beds, current patient count, or on-duty doctor times.")}</span>
      </div>

      <div className="availability-hospital-grid">
        {hospitals.map((hospital) => {
          const specialties = Array.isArray(hospital.specialties) ? hospital.specialties : [];
          const phone = String(hospital.phone || "").replace(/[^+\d]/g, "");
          const hospitalId = String(hospital.id || hospital._id || hospital.name);
          const directory = doctorDirectory[hospitalId] || { doctors: [], connected: false, source: "", sourceUrl: "" };
          const publicDoctors = directory.doctors.filter((doctor) => !specialtyFilter || String(doctor.specialty || "").toLowerCase() === specialtyFilter.toLowerCase());
          const doctors = publicDoctors.length ? publicDoctors : (presentationMode ? presentationDoctors(hospital, specialtyFilter) : []);
          const relevantSpecialties = specialtyFilter ? specialties.filter((item) => item.toLowerCase() === specialtyFilter.toLowerCase()) : specialties;
          const operations = presentationOperations(hospitalId);
          const hospitalRequests = appointments.filter((item) => String(item.hospitalId || item.hospital_id || item.hospital?.id || "") === hospitalId || String(item.hospitalName || item.hospital_name || item.hospital || "").toLowerCase() === String(hospital.name || "").toLowerCase());
          const latestRequest = hospitalRequests.slice().sort((a, b) => new Date(`${b.date || ""}T${b.time || "00:00"}`) - new Date(`${a.date || ""}T${a.time || "00:00"}`))[0];
          return (
            <article className="availability-hospital-card" key={hospital.id || hospital.name}>
              <div className="availability-hospital-heading">
                <div>
                  <h3>{hospital.name}</h3>
                  <p>{[hospital.city, hospital.state].filter(Boolean).join(", ")}</p>
                </div>
                <span className={`availability-status-pill ${presentationMode ? "availability-connected-pill" : (directory.connected ? "availability-connected-pill" : "availability-demo-pill")}`}>{presentationMode ? (tamil ? "விளக்க மாதிரி நேரடி நிலை" : "PRESENTATION LIVE DEMO") : (directory.connected ? (directory.source === "official_public_directory" ? (tamil ? "அதிகாரப்பூர்வ பொதுப் பட்டியல்" : "OFFICIAL PUBLIC LISTING") : (tamil ? "அடைவு இணைக்கப்பட்டது" : "DIRECTORY CONNECTED")) : (tamil ? "மருத்துவர் பட்டியல் இணைக்கப்படவில்லை" : "DOCTOR DIRECTORY NOT CONNECTED"))}</span>
              </div>
              <div className="availability-roster-row">
                <span>{tamil ? "மருத்துவர் நிலை" : "Doctor status"}</span>
                <strong>{presentationMode ? (tamil ? "பணியில் உள்ளது · விளக்க மாதிரி" : "On duty · simulated") : (tamil ? "மருத்துவமனை வழங்கவில்லை" : "Not supplied by hospital")}</strong>
              </div>
              <div className="availability-capacity-grid" aria-label={tamil ? "கிடைப்புத் தகவல்" : "Availability information"}>
                <div><span>{tamil ? "காலிப் படுக்கைகள்" : "Vacant beds"}</span><strong>{presentationMode ? `${operations.availableBeds} / ${operations.totalBeds} · demo` : (tamil ? "நேரடி தகவல் இல்லை" : "Live feed unavailable")}</strong></div>
                <div><span>{tamil ? "தற்போதைய நோயாளிகள்" : "Current patients"}</span><strong>{presentationMode ? `${operations.currentPatients} · demo` : (tamil ? "மருத்துவமனை வெளியிடவில்லை" : "Not published by hospital")}</strong></div>
                <div><span>{tamil ? "காத்திருப்பு நேரம்" : "Waiting time"}</span><strong>{presentationMode ? `${operations.waitingTime} · demo` : (tamil ? "தரவு இல்லை" : "Not available")}</strong></div>
                <div><span>{tamil ? "அடுத்த மருத்துவர் நேரம்" : "Next doctor time"}</span><strong>{presentationMode ? `${operations.doctorSlot} · demo` : (tamil ? "தரவு இல்லை" : "Not available")}</strong></div>
                <div><span>{tamil ? "உங்கள் கோரிக்கை நேரம்" : "Your request time"}</span><strong>{latestRequest ? `${formatDate(latestRequest.date)}${latestRequest.time ? ` · ${latestRequest.time}` : ""}` : (tamil ? "கோரிக்கை இல்லை" : "No request yet")}</strong></div>
              </div>
              <div className="availability-specialties">
                <span>{tamil ? "அடைவு பட்டியலில் உள்ள துறைகள்" : "Specialties listed in directory"}</span>
                <div>{relevantSpecialties.length
                  ? relevantSpecialties.map((specialty) => <span className="availability-specialty-chip" key={specialty}>{specialty}</span>)
                  : <span className="availability-muted">{tamil ? "துறை விவரங்கள் இல்லை" : "No specialties listed"}</span>}
                </div>
              </div>
              <div className="availability-doctor-list" aria-live="polite">
                <b>{tamil ? "மருத்துவர் பெயர்கள்" : "Doctors for this specialty"}</b>
                {doctors.length ? doctors.map((doctor) => (
                  <div className="availability-doctor-row" key={doctor.id || doctor.name}>
                    <span><strong>{doctor.name}</strong><small>{doctor.qualification || doctor.specialty}</small></span>
                    <span className="availability-muted">{presentationMode ? (tamil ? "பணியில் · விளக்க மாதிரி" : "On duty · demo") : (tamil ? "நேரடி நிலை இல்லை" : "Live status unavailable")}</span>
                  </div>
                )) : <p className="availability-muted">{directory.connected
                  ? (tamil ? "இந்தத் துறைக்கான மருத்துவர் பெயர் அடைவில் கிடைக்கவில்லை." : "No doctor name is listed for this specialty in the connected directory.")
                  : (tamil ? "இந்தத் துறைக்கான மருத்துவர் பெயர் அடைவில் கிடைக்கவில்லை." : "No doctor name is listed for this specialty in the connected directory.")}</p>}
                {directory.connected && directory.sourceUrl && <a className="availability-directory-source" href={directory.sourceUrl} target="_blank" rel="noreferrer">{tamil ? "அதிகாரப்பூர்வ மருத்துவர் பட்டியல் ↗" : "Official public doctor directory ↗"}</a>}
              </div>
              <div className="availability-hospital-actions">
                {phone && <a className="button button-secondary button-small" href={`tel:${phone}`}>{tamil ? "மருத்துவமனைக்கு அழைக்கவும்" : "Call hospital"}</a>}
                {hospital.website && <a className="button button-secondary button-small" href={hospital.website} target="_blank" rel="noreferrer">{tamil ? "மருத்துவமனை தளம் ↗" : "Hospital website ↗"}</a>}
                {presentationMode && <button type="button" className="button button-secondary button-small" onClick={() => onSpeakStatus?.(hospital, operations, latestRequest)}>{tamil ? "நிலையை கேளுங்கள்" : "Hear demo status"}</button>}
                <button type="button" className="button button-primary button-small" onClick={() => onBookHospital?.(hospital)}>
                  {tamil ? "சந்திப்பு கோருங்கள்" : "Request appointment"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div style={{ marginTop: 30, paddingTop: 24, borderTop: "1px solid #eeeaf6" }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 19 }}>{tamil ? "உங்கள் சந்திப்பு கோரிக்கைகள்" : "Your appointment requests"}</h3>
        <p style={{ ...styles.muted, margin: 0 }}>{tamil ? "கோரிக்கை MediNexus-இல் சேமிக்கப்படும்; உறுதிப்படுத்தல் இந்த வழங்கல் மாதிரி மட்டுமே." : "Requests are recorded in MediNexus; any confirmation shown here is a presentation demo."}</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, margin: "24px 0" }}>
        <div style={{ background: "linear-gradient(135deg,#f4efff,#fbfaff)", borderRadius: 15, padding: 17 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#6845c5" }}>{appointments.length}</div>
          <div style={styles.muted}>{tamil ? "பதிவான கோரிக்கைகள்" : "Recorded requests"}</div>
        </div>
        <div style={{ background: "linear-gradient(135deg,#e9fbf3,#f8fffb)", borderRadius: 15, padding: 17 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#18794e" }}>{confirmed}</div>
          <div style={styles.muted}>{tamil ? "வழங்கல் மாதிரி உறுதிப்படுத்தல்கள்" : "Demo confirmations"}</div>
        </div>
      </div>

      {error && (
        <div role="alert" style={{ padding: 14, borderRadius: 12, background: "#fff0f0", color: "#a32020", marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={styles.muted}>{tamil ? "உங்கள் சிகிச்சைப் பதிவுகள் ஏற்றப்படுகின்றன…" : "Loading your care records…"}</p>
      ) : !ordered.length ? (
        <div style={{ textAlign: "center", padding: "36px 12px", background: "#faf9fd", borderRadius: 16 }}>
          <div style={{ fontSize: 34 }}>♡</div>
          <h3 style={{ marginBottom: 6 }}>{tamil ? "உங்கள் பயணம் இங்கே தொடங்குகிறது" : "Your journey starts here"}</h3>
          <p style={styles.muted}>{tamil ? "இந்தக் கணக்கில் இதுவரை சந்திப்பு கோரிக்கை பதிவாகவில்லை. மேலே உள்ள மருத்துவமனையைத் தேர்ந்தெடுத்து கோரிக்கை அனுப்பலாம்." : "There are no appointment requests saved to this account yet. Choose a hospital above to request one."}</p>
        </div>
      ) : (
        <div>
          {ordered.map((item, index) => {
            const status = getStatus(item);
            const hospital = item.hospitalName || item.hospital_name || item.hospital?.name || item.hospital || "Hospital not specified";
            const specialty = item.specialty || item.department || "";
            return (
              <article key={item.id || item._id || `${item.date}-${index}`} style={{ display: "grid", gridTemplateColumns: "25px minmax(0,1fr)", gap: 14, position: "relative", paddingBottom: index === ordered.length - 1 ? 0 : 24 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: status.includes("confirm") ? "#21a875" : "#8a6be0", boxShadow: "0 0 0 5px #f0ebff", zIndex: 1, marginTop: 5 }} />
                  {index !== ordered.length - 1 && <div style={{ width: 2, flex: 1, background: "#e9e3f7", minHeight: 65 }} />}
                </div>
                <div style={{ border: "1px solid #ece9f4", borderRadius: 15, padding: 17, background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <h3 style={{ margin: "0 0 6px", fontSize: 17 }}>{hospital}</h3>
                      <p style={{ ...styles.muted, margin: 0 }}>
                        {formatDate(item.date)}{item.time ? ` · ${item.time}` : ""}
                      </p>
                    </div>
                    <span style={{ ...statusColor(status), padding: "6px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800 }}>
                      {tamil ? (status.includes("confirm") ? "உறுதி செய்யப்பட்டது" : status.includes("cancel") ? "ரத்து செய்யப்பட்டது" : status.includes("complete") ? "முடிந்தது" : status.includes("reject") ? "நிராகரிக்கப்பட்டது" : "உறுதிப்படுத்தல் நிலுவையில்") : statusLabel(status)}
                    </span>
                  </div>
                  {specialty && <p style={{ margin: "12px 0 0", fontSize: 13, color: "#51466d" }}>Department: {specialty}</p>}
                  {item.reason && <p style={{ ...styles.muted, marginBottom: 0 }}>Reason: {item.reason}</p>}
                  <p style={{ ...styles.muted, marginBottom: 0, fontSize: 12 }}>
                    {tamil ? "இந்தக் கோரிக்கை MediNexus-இல் மட்டுமே பதிவு செய்யப்பட்டது. மருத்துவமனைக்கு அனுப்பப்படவில்லை. உறுதிப்படுத்தல் நிலை வழங்கல் மாதிரி." : "This request is recorded in MediNexus only and has not been sent to the hospital. Confirmation status is a presentation demo."}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
