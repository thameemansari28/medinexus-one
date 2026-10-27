import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { apiRequest as api, clearAccessToken, setAccessToken } from "./api.js";
import { cleanSpeechText, findPreferredVoice, getSavedVoiceChoice, speechParts } from "./lib/speech.js";

import PatientJourney from "./PatientJourney.jsx";
import MapNavigation from "./MapNavigation.jsx";
import IndoorNavigation3D from "./IndoorNavigation3D.jsx";
import AppointmentRecovery from "./AppointmentRecovery.jsx";
import FloatingCareAssistant from "./FloatingCareAssistant.jsx";
import { FALLBACK_HOSPITALS } from "./hospitalDirectory.js";

import {
  AlertTriangle,
  CheckCircle,
  HeartPulse,
  LogOut,
  Phone,
  Printer,
  Shield,
  Trash2,
} from "lucide-react";

const AI_WELCOME = {
  en: {
    text: "Hello! I’m your MediNexus care guide. I can help you find a hospital specialty, prepare for an appointment, or use the app. I can’t diagnose or contact emergency services.",
    disclaimer: "I’m an AI navigation assistant, not a doctor. For an emergency in India, call 112 or 108 now.",
  },
  ta: {
    text: "தமிழ்: வணக்கம்! நான் MediNexus சுகாதார வழிகாட்டி. மருத்துவமனைத் துறை, சந்திப்புக்கான தயாரிப்பு, அல்லது செயலியைப் பயன்படுத்துவது குறித்து உதவுவேன். நோயைக் கண்டறியவோ அவசர சேவையை அழைக்கவோ முடியாது.\n\nEnglish: Hello! I’m your MediNexus care guide. I can help with hospital specialties, appointment preparation, or using the app.",
    disclaimer: "நான் மருத்துவர் அல்ல; வழிகாட்டும் AI உதவியாளர். அவசரநிலையில் இந்தியாவில் 112 அல்லது 108-ஐ உடனே அழைக்கவும். | I’m not a doctor. Call 112 or 108 in an emergency.",
  },
};

function assistantSpeechText(message, language) {
  const sections = [message.text];
  if (message.actionSteps?.length) sections.push(`${language === "ta" ? "தமிழ்: அடுத்த படிகள். | English: Action steps." : "Action steps."}\n${message.actionSteps.join("\n")}`);
  if (message.specialty) sections.push(`${language === "ta" ? "English: பரிந்துரைக்கப்பட்ட துறை" : "Recommended specialty"}: ${message.specialty}`);
  if (message.hospitals?.length) sections.push(`${language === "ta" ? "English: Suggested hospitals" : "Suggested hospitals"}: ${message.hospitals.map((hospital) => `${hospital.name}${hospital.city ? `, ${hospital.city}` : ""}${hospital.phone ? `, ${hospital.phone}` : ""}`).join(". ")}`);
  if (message.tips?.length) sections.push(`${language === "ta" ? "தமிழ்: தயாரிப்பு பட்டியல். | English: Preparation checklist." : "Preparation checklist."}\n${message.tips.join("\n")}`);
  if (message.followUpQuestion) sections.push(message.followUpQuestion);
  if (message.disclaimer) sections.push(message.disclaimer);
  return sections.filter(Boolean).join("\n\n");
}

function profileValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ") || "—";
  return String(value || "").trim() || "—";
}

function waitForSpeechVoices(synthesis) {
  const readyVoices = synthesis.getVoices();
  if (readyVoices.length) return Promise.resolve(readyVoices);
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      synthesis.removeEventListener?.("voiceschanged", finish);
      resolve(synthesis.getVoices());
    };
    synthesis.addEventListener?.("voiceschanged", finish, { once: true });
    window.setTimeout(finish, 1600);
  });
}

async function speakAssistantMessage(text, language, onStatus) {
  if (!("speechSynthesis" in window)) {
    onStatus(language === "ta" ? "இந்த உலாவியில் குரல் வாசிப்பு கிடைக்கவில்லை." : "Voice playback is not available in this browser.");
    return;
  }
  const synthesis = window.speechSynthesis;
  synthesis.cancel();
  const parts = speechParts(text, language);
  const voices = await waitForSpeechVoices(synthesis);
  const selectedVoices = {
    "ta-IN": findPreferredVoice(voices, "ta-IN", getSavedVoiceChoice("ta")),
    "en-IN": findPreferredVoice(voices, "en-IN", getSavedVoiceChoice("en")),
  };
  const playableParts = parts;
  if (!playableParts.length) {
    onStatus(language === "ta"
      ? "தமிழில் வாசிக்க வேண்டிய உரை இல்லை. தமிழில் கேள்வி கேட்டு மீண்டும் முயற்சிக்கவும்."
      : "This message has no English text to read. Ask the guide again in English.");
    return;
  }
  const missingTamil = language === "ta" && parts.some((part) => part.lang === "ta-IN") && !selectedVoices["ta-IN"];
  let pending = playableParts.length;
  let failed = false;
  onStatus(language === "ta" ? "குரல் வழிகாட்டுதல் தொடங்குகிறது…" : "Starting voice guidance…");
  playableParts.forEach((part) => {
    const utterance = new SpeechSynthesisUtterance(part.text);
    utterance.lang = part.lang;
    utterance.rate = 0.96;
    utterance.pitch = 1.04;
    // Let the browser attempt this locale with its default voice if none is listed.
    utterance.voice = selectedVoices[part.lang] || null;
    let settled = false;
    const finish = (didFail = false) => {
      if (settled) return;
      settled = true;
      failed ||= didFail;
      pending -= 1;
      if (pending === 0) {
        onStatus(failed
          ? (language === "ta" ? "சில குரல் பகுதிகளை வாசிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்." : "Voice playback failed for part of this message. Please try again.")
          : (missingTamil
            ? "தமிழ் உரை சாதனத்தின் இயல்புநிலை குரலில் முயற்சிக்கப்பட்டது. சரியான தமிழ் உச்சரிப்புக்கு Windows அமைப்புகளில் தமிழ் குரலை நிறுவவும்."
            : (language === "ta" ? "தமிழ் வழிகாட்டுதல் முடிந்தது." : "Guidance finished.")));
      }
    };
    utterance.onstart = () => onStatus(part.lang === "ta-IN"
      ? (selectedVoices[part.lang] ? `தமிழ் வாசிக்கப்படுகிறது · ${selectedVoices[part.lang].name}` : "தமிழ் வாசிப்பு சாதனத்தின் இயல்புநிலை குரலில் முயற்சிக்கப்படுகிறது…")
      : (selectedVoices[part.lang] ? `English section playing · ${selectedVoices[part.lang].name}` : "Playing with the device default voice…"));
    utterance.onend = () => finish();
    utterance.onerror = () => finish(true);
    try {
      synthesis.speak(utterance);
    } catch {
      finish(true);
    }
  });
}

function responseList(data, key) {
  if (Array.isArray(data)) return data;
  const candidates = [data?.[key], data?.items, data?.data];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    if (Array.isArray(candidate?.[key])) return candidate[key];
    if (Array.isArray(candidate?.items)) return candidate.items;
  }
  return [];
}

function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function StatusBadge({ value }) {
  const status = value || "Pending";
  const className = String(status).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return <span className={`status status-${className}`}>{status}</span>;
}

function EmptyState({ title, detail, action, onAction }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{detail}</p>
      {action && (
        <button type="button" className="button button-secondary" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("overview");
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  const [hospitals, setHospitals] = useState(FALLBACK_HOSPITALS);
  const [hospitalDirectorySource, setHospitalDirectorySource] = useState("bundled");
  const [appointments, setAppointments] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  const [adminData, setAdminData] = useState(null);
  const [serviceHealth, setServiceHealth] = useState(null);
  const [userProfile, setUserProfile] = useState({ fullName: "", phone: "", bloodGroup: "", allergies: [], chronicConditions: [], currentMedications: [], emergencyNotes: "", emergencyMedicalConsent: true, avatarData: "" });
  const [profileEditing, setProfileEditing] = useState(false);
  const [avatarInputKey, setAvatarInputKey] = useState(0);
  const [editingContact, setEditingContact] = useState(null);
  const [profileLoadError, setProfileLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [indoorHospital, setIndoorHospital] = useState("");
  const [mapHospital, setMapHospital] = useState(null);

  // Booking & Modals
  const [booking, setBooking] = useState({ hospitalId: "", specialty: "", date: "", time: "", reason: "" });
  const [rescheduleModal, setRescheduleModal] = useState(null);
  const [cancelModal, setCancelModal] = useState(null);
  const [invoicePreview, setInvoicePreview] = useState(null);
  const [recordUploadModal, setRecordUploadModal] = useState(false);
  const [recordForm, setRecordForm] = useState({ title: "", recordType: "Lab Report", hospitalName: "", doctorName: "", notes: "", privacyLevel: "private" });

  // Emergency SOS State
  const [emergencyType, setEmergencyType] = useState("Accident");
  const [emergencyHospitalId, setEmergencyHospitalId] = useState("");
  const [emergencyDetails, setEmergencyDetails] = useState("");
  const [emergencyLocation, setEmergencyLocation] = useState("");
  const [emergencyGpsData, setEmergencyGpsData] = useState(null);
  const [emergencyTime, setEmergencyTime] = useState("");
  const [emergencyConsent, setEmergencyConsent] = useState(true);
  const [sosCountdown, setSosCountdown] = useState(null);
  const [sirenPlaying, setSirenPlaying] = useState(false);
  const [crashSensorActive, setCrashSensorActive] = useState(false);
  const [crashSensorStatus, setCrashSensorStatus] = useState("Off. Enable while this page is open.");
  const [voiceInputActive, setVoiceInputActive] = useState(false);
  const [activeIncident, setActiveIncident] = useState(null);
  const [repeatSosVoice, setRepeatSosVoice] = useState(true);

  // Web Audio Context reference for Siren
  const audioCtxRef = useRef(null);
  const oscillatorRef = useRef(null);
  const sosRepeatTimerRef = useRef(null);
  const sosRequestPendingRef = useRef(false);
  const crashTriggeredRef = useRef(false);
  const emergencySpeechDataRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const voiceInputActiveRef = useRef(false);
  const emergencyFormDataRef = useRef(null);

  // AI Healthcare Navigation Chat State
  const [aiMessages, setAiMessages] = useState([
    {
      role: "assistant",
      ...AI_WELCOME.en,
    }
  ]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // UI state
  const [language, setLanguage] = useState("en");
  const tamil = language === "ta";
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("Ready");

  useEffect(() => {
    setAiMessages((messages) => messages.length === 1 && messages[0].role === "assistant"
      ? [{ role: "assistant", ...AI_WELCOME[language === "ta" ? "ta" : "en"] }]
      : messages);
  }, [language]);

  useEffect(() => {
    if (page !== "emergency" && voiceInputActiveRef.current) {
      voiceInputActiveRef.current = false;
      speechRecognitionRef.current?.stop();
      setVoiceInputActive(false);
    }
  }, [page]);

  const isAdmin = ["admin", "administrator"].includes(
    String(user?.app_metadata?.role || user?.user_metadata?.role || user?.role || "").toLowerCase()
  );

  const displayName =
    userProfile?.fullName || userProfile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Patient";
  const emergencyHospital = hospitals.find((hospital) => String(hospital.id || hospital._id) === emergencyHospitalId)
    || selectedHospital || hospitals[0] || null;
  emergencyFormDataRef.current = {
    emergencyType, emergencyDetails, emergencyLocation, emergencyGpsData, emergencyTime,
    patientName: displayName,
    patientPhone: userProfile?.phone || "",
    medicalProfile: emergencyConsent ? {
      bloodGroup: userProfile?.bloodGroup || "",
      allergies: userProfile?.allergies || [],
      chronicConditions: userProfile?.chronicConditions || [],
      currentMedications: userProfile?.currentMedications || [],
      emergencyNotes: userProfile?.emergencyNotes || "",
    } : null,
    emergencyContacts,
  };
  const emergencySmsBody = [
    "EMERGENCY — please call me now.",
    `Patient: ${displayName}${userProfile?.phone ? ` · ${userProfile.phone}` : ""}`,
    `Incident: ${emergencyType}`,
    `Location: ${emergencyLocation || "Not captured"}`,
    emergencyGpsData ? `GPS: https://maps.google.com/?q=${emergencyGpsData.latitude},${emergencyGpsData.longitude} (accuracy ±${Math.round(emergencyGpsData.accuracy)} m)` : "GPS coordinates: not captured",
    emergencyTime ? `Captured: ${emergencyTime}` : "",
    emergencyDetails ? `Details: ${emergencyDetails}` : "",
    activeIncident?.incidentNumber ? `MediNexus incident reference: ${activeIncident.incidentNumber}` : "",
    emergencyConsent && userProfile?.bloodGroup ? `Blood group: ${userProfile.bloodGroup}` : "",
    emergencyConsent && userProfile?.allergies?.length ? `Allergies: ${userProfile.allergies.join(", ")}` : "",
    emergencyConsent && userProfile?.chronicConditions?.length ? `Conditions: ${userProfile.chronicConditions.join(", ")}` : "",
    emergencyConsent && userProfile?.currentMedications?.length ? `Medications: ${userProfile.currentMedications.join(", ")}` : "",
    emergencyConsent && userProfile?.emergencyNotes ? `Emergency notes: ${userProfile.emergencyNotes}` : "",
    "This message is a draft. Review and send it in your messaging app.",
  ].filter(Boolean).join("\n");
  const callOrTextNumber = (value) => String(value || "").replace(/[^\d+*#]/g, "");
  const smsDraftHref = (phone) => `sms:${callOrTextNumber(phone)}?body=${encodeURIComponent(emergencySmsBody)}`;

  const openPage = (next) => {
    setPage(next);
    setMobileNav(false);
    setError("");
    setNotice("");
    if (next === "profile") void refreshProfile();
  };

  // --- REFRESH DATA HANDLERS ---
  const refreshHospitals = useCallback(async () => {
    try {
      const data = await api("/hospitals");
      const list = responseList(data, "hospitals");
      setHospitals(list.length ? list : FALLBACK_HOSPITALS);
      setHospitalDirectorySource(list.length ? "server" : "bundled");
      setError((current) => current.startsWith("Hospital server unavailable.") ? "" : current);
    } catch (e) {
      setHospitals(FALLBACK_HOSPITALS);
      setHospitalDirectorySource("bundled");
      setError(`Hospital server unavailable. Showing the bundled facility directory; live availability is not connected. ${e.message}`);
    }
  }, []);

  const refreshAppointments = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api("/appointments");
      setAppointments(responseList(data, "appointments"));
    } catch (e) {
      setAppointments([]);
    }
  }, [user]);

  const refreshReceipts = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api("/receipts");
      setReceipts(Array.isArray(data) ? data : data.receipts || []);
    } catch (e) {
      setReceipts([]);
    }
  }, [user]);

  const refreshRecords = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api("/records");
      setMedicalRecords(data.records || []);
    } catch {
      setMedicalRecords([]);
    }
  }, [user]);

  const refreshEmergencyContacts = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api("/emergency/contacts");
      setEmergencyContacts(data.contacts || []);
    } catch {
      setEmergencyContacts([]);
    }
  }, [user]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api("/profile/me");
      if (data?.user) {
        setUserProfile(data.user);
        setEmergencyConsent(data.user.emergencyMedicalConsent ?? false);
        setProfileLoadError("");
      } else {
        setProfileLoadError(tamil ? "சுயவிவரத் தகவல் கிடைக்கவில்லை." : "Profile information was not returned by the server.");
      }
    } catch (err) {
      setProfileLoadError(tamil ? `சுயவிவரத்தை ஏற்ற முடியவில்லை: ${err.message}` : `Could not load profile: ${err.message}`);
    }
  }, [user, tamil]);

  // Auth Initialization
  useEffect(() => {
    let active = true;
    api("/auth/me")
      .then((data) => { if (active) setUser(data?.user || null); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setAuthChecked(true); });
    return () => {
      active = false;
    };
  }, []);

  // Fetch initial directory
  useEffect(() => {
    void refreshHospitals();
  }, [refreshHospitals]);

  useEffect(() => {
    let active = true;
    const checkHealth = async () => {
      try {
        const health = await api("/health");
        if (active) setServiceHealth(health);
      } catch (healthError) {
        if (active) setServiceHealth({ status: "unreachable", message: healthError.message, integrations: {} });
      }
    };
    void checkHealth();
    const healthTimer = window.setInterval(checkHealth, 30000);
    return () => { active = false; window.clearInterval(healthTimer); };
  }, []);

  // Fetch user data when logged in
  useEffect(() => {
    if (!user) return;
    void refreshAppointments();
    void refreshReceipts();
    void refreshRecords();
    void refreshEmergencyContacts();
    void refreshProfile();
  }, [user, refreshAppointments, refreshReceipts, refreshRecords, refreshEmergencyContacts, refreshProfile]);

  // Fetch Admin Stats
  useEffect(() => {
    if (!isAdmin) return;
    api("/admin/dashboard")
      .then((data) => setAdminData(data))
      .catch(() => setAdminData(null));
  }, [isAdmin]);

  // Filtered hospitals
  const filteredHospitals = useMemo(() => {
    const q = search.trim().toLowerCase();
    return hospitals.filter((h) =>
      [h.name, h.address, h.city, h.type, h.specialty, ...(h.specialties || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [hospitals, search]);

  // --- AUDIO SIREN (Web Audio API Synthesizer) ---
  const startSiren = () => {
    try {
      if (audioCtxRef.current) return;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      // Frequency sweep for siren tone
      const now = ctx.currentTime;
      for (let i = 0; i < 20; i++) {
        osc.frequency.exponentialRampToValueAtTime(1400, now + i * 0.8 + 0.4);
        osc.frequency.exponentialRampToValueAtTime(800, now + i * 0.8 + 0.8);
      }

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      audioCtxRef.current = ctx;
      oscillatorRef.current = osc;
      setSirenPlaying(true);
    } catch (e) {
      console.warn("Audio siren initialization error:", e.message);
    }
  };

  const stopSiren = () => {
    try {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    } catch {}
    audioCtxRef.current = null;
    oscillatorRef.current = null;
    setSirenPlaying(false);
  };

  // Ask for motion permission directly from the user's tap. Some mobile browsers
  // reject permission requests made later inside an effect.
  const toggleCrashSensor = async () => {
    if (crashSensorActive) {
      setCrashSensorActive(false);
      setCrashSensorStatus("Off. Enable while this page is open.");
      return;
    }
    if (typeof DeviceMotionEvent === "undefined") {
      setCrashSensorStatus("This browser does not provide motion sensor access.");
      return;
    }
    try {
      if (typeof DeviceMotionEvent.requestPermission === "function") {
        const permission = await DeviceMotionEvent.requestPermission();
        if (permission !== "granted") {
          setCrashSensorStatus("Permission was not granted. Sensor remains off.");
          return;
        }
      }
      crashTriggeredRef.current = false;
      setCrashSensorStatus("Monitoring while this page stays open and visible.");
      setCrashSensorActive(true);
    } catch {
      setCrashSensorStatus("Could not enable motion access. Check browser permissions.");
    }
  };

  // --- DEVICE MOTION CRASH DETECTION ---
  useEffect(() => {
    if (!crashSensorActive) return;

    const handleMotion = (event) => {
      const acc = event.accelerationIncludingGravity || event.acceleration;
      if (!acc) return;
      const magnitude = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
      // Hard threshold: > 28 m/s² indicates severe collision / abrupt deceleration
      if (magnitude > 28 && !crashTriggeredRef.current) {
        crashTriggeredRef.current = true;
        setNotice("Possible hard impact detected by the motion sensor. Check the 5-second SOS countdown and cancel if this is a false alarm.");
        startSosCountdown("Possible impact detected by device motion sensor");
      }
    };

    window.addEventListener("devicemotion", handleMotion);

    return () => {
      window.removeEventListener("devicemotion", handleMotion);
    };
  }, [crashSensorActive]);

  // --- EMERGENCY SOS TRIGGER WITH COUNTDOWN ---
  const startSosCountdown = (overrideType = null) => {
    if (overrideType) setEmergencyType(overrideType);
    if (sosCountdown !== null) return;
    if (sosRequestPendingRef.current) return;
    sosRequestPendingRef.current = true;
    requestEmergencyLocation(() => {
      sosRequestPendingRef.current = false;
      setSosCountdown(5);
    });
  };

  const cancelSosCountdown = () => {
    sosRequestPendingRef.current = false;
    crashTriggeredRef.current = false;
    setSosCountdown(null);
    stopSiren();
    setNotice("SOS activation cancelled by user.");
  };

  // Countdown countdown ticker
  useEffect(() => {
    if (sosCountdown === null) return;
    if (sosCountdown > 0) {
      const timer = setTimeout(() => setSosCountdown((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
      return () => clearTimeout(timer);
    } else if (sosCountdown === 0) {
      setSosCountdown(null);
      sosRequestPendingRef.current = false;
      void executeSosSubmission();
    }
  }, [sosCountdown]);

  // GPS Location Capture
  const requestEmergencyLocation = (callback) => {
    if (!navigator.geolocation) {
      setError("Location is not supported on this device. Manual location or direct 112 calling available.");
      return;
    }
    setVoiceStatus("Requesting location...");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const isChennaiRegion = coords.latitude >= 12.7 && coords.latitude <= 13.4 && coords.longitude >= 79.8 && coords.longitude <= 80.5;
        const fallbackArea = isChennaiRegion
          ? "Chennai, Tamil Nadu · device location recorded"
          : "Current device location · address lookup unavailable";
        setEmergencyLocation(fallbackArea);
        setEmergencyGpsData({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        });
        setEmergencyTime(new Date().toLocaleString(language === "ta" ? "ta-IN" : "en-IN"));
        setVoiceStatus("GPS captured. Looking up a nearby place name…");
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 2500);
        fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}&zoom=18&addressdetails=1`, { signal: controller.signal })
          .then((response) => response.ok ? response.json() : Promise.reject(new Error("Address lookup unavailable")))
          .then((place) => {
            const address = place.address || {};
            const readable = [address.road || address.pedestrian || address.neighbourhood, address.suburb || address.city_district || address.town || address.city || address.village, address.city || address.state_district, address.state]
              .filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).slice(0, 3).join(", ");
            setEmergencyLocation(readable || place.name || fallbackArea);
            setVoiceStatus(readable ? "GPS captured and nearby area named." : "GPS captured. Your device location was recorded.");
          })
          .catch(() => {
            setEmergencyLocation(fallbackArea);
            setVoiceStatus("GPS captured. Your device location was recorded.");
          })
          .finally(() => {
            window.clearTimeout(timer);
            callback?.(coords);
          });
      },
      (geoErr) => {
        setError(`Location access notice: ${geoErr.message}. You can manually type your location or call 112 directly.`);
        callback?.(null);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Request a location as soon as the user opens the emergency console so it
  // is ready if they need SOS. Browser permission is still required.
  useEffect(() => {
    if (page === "emergency" && !emergencyGpsData && !emergencyLocation) {
      requestEmergencyLocation();
    }
  }, [page]);

  // Execute SOS Server Record
  const executeSosSubmission = async () => {
    setBusy(true);
    startSiren();
    try {
      const payload = {
        type: emergencyType,
        latitude: emergencyGpsData?.latitude || null,
        longitude: emergencyGpsData?.longitude || null,
        accuracy_meters: emergencyGpsData?.accuracy || null,
        location_address: emergencyLocation || "Location entered manually / unavailable",
        details: emergencyDetails,
        shareMedicalConsent: emergencyConsent,
        occurredAt: new Date().toISOString(),
      };

      const result = await api("/emergency/sos", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      emergencySpeechDataRef.current = emergencyFormDataRef.current;
      setActiveIncident(result);
      setNotice(`🚨 Incident reference created: ${result.incidentNumber}. Call 112 or 108 directly; this web app does not dispatch responders.`);
    } catch (err) {
      setError(`Emergency record could not reach server: ${err.message}. Please dial 112 immediately!`);
    } finally {
      setBusy(false);
    }
  };

  // Speech Output
  const speakEmergencyScript = useCallback(async (incidentNum = "") => {
    if (!("speechSynthesis" in window)) {
      setVoiceStatus(language === "ta" ? "இந்த உலாவியில் குரல் வாசிப்பு இல்லை." : "Voice playback is not supported in this browser.");
      return;
    }
    const synthesis = window.speechSynthesis;
    synthesis.cancel();
    const voices = await waitForSpeechVoices(synthesis);
    const voice = findPreferredVoice(voices, language === "ta" ? "ta-IN" : "en-IN", getSavedVoiceChoice(language === "ta" ? "ta" : "en"));
    if (!voice) {
      setVoiceStatus(language === "ta"
        ? "தமிழ் TTS குரல் இந்தச் சாதனத்தில் இல்லை. Windows Speech அமைப்புகளில் தமிழ் குரலைச் சேர்க்கவும்."
        : "No English TTS voice is available. Add an English speech voice in system settings.");
      return;
    }
    const current = emergencySpeechDataRef.current || {};
    const tamil = language === "ta";
    const place = current.emergencyLocation || "nearby place name unavailable";
    const locationStatus = current.emergencyGpsData
      ? "Device location is included with this incident record."
      : "Device location was not captured.";
    const medical = current.medicalProfile;
    const savedFamily = current.emergencyContacts?.map((contact) => `${contact.contact_name || contact.name}${contact.relationship ? `, ${contact.relationship}` : ""}`).filter(Boolean).join("; ") || "none saved";
    const text = tamil
      ? `அவசர உதவி தேவை. நோயாளி: ${current.patientName || "பெயர் பதிவு செய்யப்படவில்லை"}. ${current.patientPhone ? `தொலைபேசி எண்: ${current.patientPhone}.` : ""} சம்பவம்: ${current.emergencyType || "விவரம் இல்லை"}. கூடுதல் விவரம்: ${current.emergencyDetails || "கூடுதல் விவரம் இல்லை"}. அருகிலுள்ள இடம்: ${place}. சாதன இருப்பிடத் தகவல் இந்தச் சம்பவப் பதிவில் உள்ளது. பதிவு செய்த நேரம்: ${current.emergencyTime || "நேரம் கிடைக்கவில்லை"}. சேமித்த குடும்பத் தொடர்புகள்: ${savedFamily}. ${medical ? `இரத்த வகை: ${medical.bloodGroup || "பதிவு செய்யப்படவில்லை"}. ஒவ்வாமைகள்: ${medical.allergies?.join(", ") || "பதிவு செய்யப்படவில்லை"}. உடல்நிலைகள்: ${medical.chronicConditions?.join(", ") || "பதிவு செய்யப்படவில்லை"}. மருந்துகள்: ${medical.currentMedications?.join(", ") || "பதிவு செய்யப்படவில்லை"}. அவசரக் குறிப்பு: ${medical.emergencyNotes || "இல்லை"}.` : "மருத்துவ விவரங்களைப் பகிர நோயாளர் அனுமதி அளிக்கவில்லை."} சம்பவக் குறிப்பு: ${incidentNum || "பதிவு செய்யப்படவில்லை"}. தயவுசெய்து 112 அல்லது 108 ஐ நேரடியாக அழைக்கவும்.`
      : `Emergency assistance needed. Patient: ${current.patientName || "name not recorded"}. ${current.patientPhone ? `Phone: ${current.patientPhone}.` : ""} Incident: ${current.emergencyType || "not specified"}. Details: ${current.emergencyDetails || "no extra details provided"}. Nearby place: ${place}. ${locationStatus} Captured at: ${current.emergencyTime || "time unavailable"}. Saved family contacts: ${savedFamily}. ${medical ? `Blood group: ${medical.bloodGroup || "not recorded"}. Allergies: ${medical.allergies?.join(", ") || "not recorded"}. Conditions: ${medical.chronicConditions?.join(", ") || "not recorded"}. Current medications: ${medical.currentMedications?.join(", ") || "not recorded"}. Emergency notes: ${medical.emergencyNotes || "none"}.` : "The patient has not consented to sharing medical profile details."} Incident reference: ${incidentNum || "not recorded"}. Call 112 or 108 directly.`;

    const utterance = new SpeechSynthesisUtterance(cleanSpeechText(text));
    utterance.lang = voice.lang || (tamil ? "ta-IN" : "en-IN");
    utterance.voice = voice;
    utterance.rate = 0.96;
    utterance.pitch = 1.04;
    utterance.onstart = () => setVoiceStatus(tamil ? `சம்பவ விவரங்களை ${voice.name} குரலில் வாசிக்கிறது.` : `Reading incident details with ${voice.name}.`);
    utterance.onend = () => setVoiceStatus(tamil ? "அறிவிப்பு முடிந்தது." : "Announcement finished.");
    utterance.onerror = () => setVoiceStatus(tamil ? "குரல் அறிவிப்பை இயக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்." : "Voice playback failed. Please try again.");
    try {
      synthesis.speak(utterance);
    } catch {
      setVoiceStatus(tamil ? "குரல் அறிவிப்பை இயக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்." : "Voice playback failed. Please try again.");
    }
  }, [language]);

  useEffect(() => {
    if (!activeIncident || !repeatSosVoice) {
      if (sosRepeatTimerRef.current) window.clearInterval(sosRepeatTimerRef.current);
      sosRepeatTimerRef.current = null;
      return undefined;
    }
    speakEmergencyScript(activeIncident.incidentNumber);
    sosRepeatTimerRef.current = window.setTimeout(() => {
      speakEmergencyScript(activeIncident.incidentNumber);
      setRepeatSosVoice(false);
      sosRepeatTimerRef.current = null;
    }, 20000);
    return () => {
      if (sosRepeatTimerRef.current) window.clearInterval(sosRepeatTimerRef.current);
      sosRepeatTimerRef.current = null;
    };
  }, [activeIncident?.incidentNumber, repeatSosVoice, speakEmergencyScript]);

  const updateActiveIncident = async () => {
    if (!activeIncident?.incidentId || !activeIncident?.updateToken) {
      setError("This incident cannot be updated from this session. Call 112 or 108 and share the new details directly.");
      return;
    }
    setBusy(true);
    try {
      const result = await api(`/emergency/${encodeURIComponent(activeIncident.incidentId)}`, {
        method: "PATCH",
        headers: { "X-Incident-Update-Token": activeIncident.updateToken },
        body: JSON.stringify({
          type: emergencyType,
          details: emergencyDetails,
          location_address: emergencyLocation,
          latitude: emergencyGpsData?.latitude ?? null,
          longitude: emergencyGpsData?.longitude ?? null,
          accuracy_meters: emergencyGpsData?.accuracy ?? null,
        }),
      });
      emergencySpeechDataRef.current = emergencyFormDataRef.current;
      setActiveIncident((current) => ({ ...current, ...result }));
      setNotice(`Incident ${result.incidentNumber} updated. Call 112 or 108 directly with any urgent change.`);
      speakEmergencyScript(result.incidentNumber);
    } catch (err) {
      setError(`Incident update did not reach the server: ${err.message}. Call 112 or 108 and give the changed details directly.`);
    } finally {
      setBusy(false);
    }
  };

  // Voice Input for details
  const startVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError(language === "ta" ? "இந்த உலாவியில் குரல் உள்ளீடு இல்லை. விவரங்களைத் தட்டச்சு செய்யுங்கள்." : "Speech recognition is not supported in this browser. Please type details.");
      return;
    }
    if (voiceInputActiveRef.current) {
      voiceInputActiveRef.current = false;
      setVoiceInputActive(false);
      speechRecognitionRef.current?.stop();
      setVoiceStatus(language === "ta" ? "ஒலிவாங்கி நிறுத்தப்பட்டது." : "Microphone stopped.");
      return;
    }
    const recognition = new SpeechRecognition();
    speechRecognitionRef.current = recognition;
    voiceInputActiveRef.current = true;
    setVoiceInputActive(true);
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = language === "ta" ? "ta-IN" : "en-IN";
    recognition.onstart = () => setVoiceStatus(language === "ta" ? "கேட்கிறது… இப்போது பேசுங்கள்." : "Listening… speak now.");
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .filter((result) => result.isFinal)
        .map((result) => result[0].transcript.trim())
        .filter(Boolean)
        .join(" ");
      if (transcript) {
        setEmergencyDetails((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setVoiceStatus(language === "ta" ? "குரல் விவரம் சேர்க்கப்பட்டது. நிறுத்தும் வரை ஒலிவாங்கி இயங்கும்." : "Voice details added. The microphone stays on until you stop it.");
      }
    };
    recognition.onerror = (event) => {
      if (["not-allowed", "service-not-allowed", "audio-capture"].includes(event.error)) {
        voiceInputActiveRef.current = false;
        setVoiceInputActive(false);
      }
      setVoiceStatus(language === "ta"
        ? `ஒலிவாங்கி சிக்கல்: ${event.error || "குரல் அறிதல் நிறுத்தப்பட்டது"}. மீண்டும் முயற்சிக்கவும்.`
        : `Microphone issue: ${event.error || "recognition stopped"}. Tap to try again.`);
    };
    recognition.onend = () => {
      if (voiceInputActiveRef.current) {
        window.setTimeout(() => {
          try { speechRecognitionRef.current?.start(); } catch {}
        }, 250);
      } else {
        setVoiceInputActive(false);
      }
    };
    try {
      recognition.start();
    } catch {
      voiceInputActiveRef.current = false;
      setVoiceInputActive(false);
      setVoiceStatus(language === "ta" ? "குரல் உள்ளீட்டைத் தொடங்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்." : "Could not start voice input. Please try again.");
    }
  };

  // --- AI HEALTH ASSISTANT CHAT HANDLER ---
  const handleAiSend = async (e) => {
    e?.preventDefault();
    if (!aiInput.trim()) return;

    const userQuery = aiInput.trim();
    setAiMessages((prev) => [...prev, { role: "user", text: userQuery }]);
    setAiInput("");
    setAiLoading(true);

    try {
      const result = await api("/ai/navigate", {
        method: "POST",
        body: JSON.stringify({ prompt: userQuery, language }),
      });

      setAiMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: result.response || result.message,
          isEmergency: result.isEmergency,
          actionSteps: result.actionSteps || [],
          specialty: result.recommendedSpecialty,
          hospitals: result.suggestedHospitals || [],
          tips: result.preparationTips || [],
          followUpQuestion: result.followUpQuestion || (language === "ta"
            ? "தமிழ்: மேலும் என்ன உதவி வேண்டும்? | English: What else would you like help with?"
            : "What else would you like help with?"),
          disclaimer: language === "ta"
            ? "தமிழ்: இது சுகாதார வழிகாட்டுதல் மட்டுமே; மருத்துவரின் நோயறிதல் அல்ல. | English: This is care navigation, not a medical diagnosis."
            : result.disclaimer,
        },
      ]);

      if (result.isEmergency) {
        setNotice("⚠️ AI assistant flagged potential emergency symptoms. Direct emergency call advised.");
      }
    } catch (err) {
      setAiMessages((prev) => [
        ...prev,
        { role: "assistant", text: language === "ta"
          ? `தமிழ்: உங்கள் கேள்வியைச் செயல்படுத்த முடியவில்லை: ${err.message}. அவசரநிலையில் 112 அல்லது 108-ஐ அழைக்கவும்.\n\nEnglish: I couldn’t process that request. If this is an emergency, call 112 or 108.`
          : `I encountered an issue processing your request: ${err.message}. Please consult a physician.` },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  // --- AUTH SUBMISSION ---
  const submitAuth = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (authMode === "register") {
        const data = await api("/auth/register", {
          method: "POST",
          body: JSON.stringify({ email: authForm.email.trim(), password: authForm.password, fullName: authForm.name.trim() }),
        });
        setAccessToken(data.accessToken);
        setUser(data.user);
        setNotice(tamil ? "கணக்கு உருவாக்கப்பட்டது. நீங்கள் உள்நுழைந்துள்ளீர்கள்." : "Account created. You are signed in.");
      } else {
        const data = await api("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: authForm.email.trim(), password: authForm.password }),
        });
        setAccessToken(data.accessToken);
        setUser(data.user);
        setNotice(tamil ? "MediNexus One-க்கு மீண்டும் வரவேற்கிறோம்." : "Welcome back to MediNexus One.");
      }
    } catch (e) {
      const message = String(e?.message || "");
      setError(tamil
        ? (/already exists/i.test(message) ? "இந்த மின்னஞ்சலுக்கு கணக்கு ஏற்கனவே உள்ளது. உள்நுழையவும்." : /incorrect/i.test(message) ? "மின்னஞ்சல் அல்லது கடவுச்சொல் தவறு." : /8 and 128|between 8/i.test(message) ? "கடவுச்சொல் 8 முதல் 128 எழுத்துகள் வரை இருக்க வேண்டும்." : message)
        : message);
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {}
    clearAccessToken();
    setUser(null);
    setAppointments([]);
    setReceipts([]);
    setMedicalRecords([]);
    setEmergencyContacts([]);
    setActiveIncident(null);
    setEmergencyConsent(false);
    setUserProfile({ fullName: "", phone: "", bloodGroup: "", allergies: [], chronicConditions: [], currentMedications: [], emergencyNotes: "", emergencyMedicalConsent: false });
    setProfileLoadError("");
    setAdminData(null);
    setPage("overview");
    setNotice("Signed out successfully.");
  };

  // --- APPOINTMENT ACTIONS ---
  const submitBooking = async (event) => {
    event.preventDefault();
    if (!user) return setError("Please sign in first.");
    setBusy(true);
    setError("");
    try {
      await api("/appointments", {
        method: "POST",
        body: JSON.stringify({
          hospitalId: booking.hospitalId,
          specialty: booking.specialty || "General Consultation",
          date: booking.date,
          time: booking.time,
          reason: booking.reason,
        }),
      });
      setSelectedHospital(null);
      setBooking({ hospitalId: "", specialty: "", date: "", time: "", reason: "" });
      setNotice(tamil
        ? "உங்கள் சந்திப்பு கோரிக்கை MediNexus-இல் சேமிக்கப்பட்டது. மருத்துவமனை உறுதிப்படுத்தல் இந்த வழங்கல் மாதிரியில் மட்டும் காட்டப்படும்."
        : "Your appointment request was saved in MediNexus. The confirmation shown for this presentation is a demo and is not a hospital confirmation.");
      await refreshAppointments();
      setPage("appointments");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleReschedule = async (appointmentId, newDate, newTime) => {
    setBusy(true);
    try {
      await api(`/appointments/${appointmentId}/reschedule`, {
        method: "PATCH",
        body: JSON.stringify({ date: newDate, time: newTime }),
      });
      setRescheduleModal(null);
      setNotice("Appointment rescheduled successfully.");
      await refreshAppointments();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCancelAppointment = async (appointmentId, reason) => {
    setBusy(true);
    try {
      await api(`/appointments/${appointmentId}/cancel`, {
        method: "PATCH",
        body: JSON.stringify({ reason }),
      });
      setCancelModal(null);
      setNotice("Appointment cancelled.");
      await refreshAppointments();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCheckIn = async (appointmentId) => {
    setBusy(true);
    try {
      await api(`/appointments/${appointmentId}/checkin`, { method: "POST" });
      setNotice("Self check-in recorded. Welcome to the facility!");
      await refreshAppointments();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // --- RECORD UPLOAD ---
  const handleUploadRecord = async (e) => {
    e.preventDefault();
    if (!recordForm.title) return;
    setBusy(true);
    try {
      await api("/records", {
        method: "POST",
        body: JSON.stringify(recordForm),
      });
      setRecordUploadModal(false);
      setRecordForm({ title: "", recordType: "Lab Report", hospitalName: "", doctorName: "", notes: "", privacyLevel: "private" });
      setNotice("Medical document added to your secure vault.");
      await refreshRecords();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Navigation Links
  const navItems = [
    ["overview", "Overview", "⌂"],
    ["hospitals", "Find Hospitals", "✚"],
    ["maps", "Hospital Maps", "🗺️"],
    ["indoor", "Hospital location & indoor info", "🧭"],
    ["appointments", "Appointments", "▦"],
    ["recovery", "Doctor Recovery", "🔄"],
    ["journey", "My Care Journey", "➜"],
    ["records", "Medical Records", "📁"],
    ["profile", "Health Profile", "👤"],
    ["receipts", "Receipts & Bills", "▤"],
    ["emergency", "SOS & Accident", "🆘"],
    ["ai", "AI Health Assistant", "✨"],
    ...(isAdmin ? [["admin", "Admin Console", "⚙"]] : []),
  ];
  const navTamil = {
    overview: "முகப்பு", hospitals: "மருத்துவமனைகள்", maps: "மருத்துவமனை வரைபடம்",
    indoor: "மருத்துவமனை இடம் மற்றும் உள் தகவல்", appointments: "சந்திப்புகள்", recovery: "மருத்துவர் நிலை",
    journey: "என் சிகிச்சைப் பயணம்", records: "மருத்துவப் பதிவுகள்", profile: "சுகாதார விவரம்",
    receipts: "ரசீதுகள் மற்றும் கட்டணங்கள்", emergency: "அவசர உதவி", ai: "AI சுகாதார உதவியாளர்",
    admin: "நிர்வாகம்",
  };

  // Auth gate if not logged in
  if (authChecked && !user) {
    return (
      <div className="auth-shell">
        <div className="auth-brand-panel">
          <div className="auth-brand">
            <span className="brand-mark"><HeartPulse size={25} strokeWidth={2.2} aria-hidden="true" /></span>
            <span className="auth-brand-copy"><span>MediNexus <b>One</b></span><small>INTEGRATED HEALTH</small></span>
          </div>
          <div className="auth-message">
            <span className="auth-overline">SECURE HEALTHCARE PLATFORM</span>
            <h1>Connected care, instant navigation & emergency response.</h1>
            <p>Find hospitals, manage appointments and records, and access emergency calling tools.</p>
            <div className="auth-feature"><CheckCircle size={18} /><span>Hospital directory and location tools</span></div>
            <div className="auth-feature"><Shield size={18} /><span>Password-hashed local sign-in; no confirmation email</span></div>
            <div className="auth-feature"><Phone size={18} /><span>Direct 112 & 108 Emergency Call Integrations</span></div>
          </div>
          <div className="auth-brand-footer">© {new Date().getFullYear()} MediNexus One Healthcare Systems</div>
        </div>

        <div className="auth-form-panel">
          <div className="auth-form-top">
            <label className="language-select" aria-label="Choose language">
              <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="en">English (India)</option>
                <option value="ta">தமிழ் (Tamil)</option>
              </select>
            </label>
          </div>
          <div className="auth-card">
            <span className="eyebrow">{tamil ? "நோயாளர் மற்றும் பணியாளர் அணுகல்" : "PATIENT & STAFF ACCESS"}</span>
            <h2>{authMode === "login" ? (tamil ? "மீண்டும் வரவேற்கிறோம்" : "Welcome back") : (tamil ? "கணக்கை உருவாக்குங்கள்" : "Create your account")}</h2>
            <p className="muted">{authMode === "register"
              ? (tamil ? "உள்ளூர் கணக்கை உருவாக்குங்கள்; மின்னஞ்சல் உறுதிப்படுத்தல் தேவையில்லை." : "Create a local account. No confirmation email is required.")
              : (tamil ? "இந்தச் சேவையகத்தில் உள்ள உங்கள் கணக்கில் உள்நுழையுங்கள். முதல் முறை என்றால் ஒருமுறை கணக்கை உருவாக்குங்கள்." : "Sign in to your account on this server. If this is your first time here, register once.")}</p>

            {error && <div className="alert alert-error">{error}</div>}
            {notice && <div className="alert alert-success">{notice}</div>}

            <form onSubmit={submitAuth}>
              {authMode === "register" && (
                <label className="field-label">
                  {tamil ? "முழுப் பெயர்" : "Full Name"}
                  <input required value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} placeholder="Dr. / Mr. / Ms. Full Name" />
                </label>
              )}
              <label className="field-label">
                  {tamil ? "மின்னஞ்சல் / உள்நுழைவு ID" : "Email / Login ID"}
                <input type="email" required value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} placeholder="patient@example.com" />
              </label>
              <label className="field-label">
                  {tamil ? "கடவுச்சொல்" : "Password"}
                <div style={{ display: "flex", gap: 8 }}>
                  <input style={{ flex: 1, minWidth: 0 }} type={showPassword ? "text" : "password"} autoComplete={authMode === "login" ? "current-password" : "new-password"} required minLength={authMode === "register" ? 8 : undefined} maxLength={128} value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} placeholder="••••••••" />
                  <button type="button" className="button button-secondary auth-password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? (tamil ? "மறை" : "Hide") : (tamil ? "காட்டு" : "Show")}</button>
                </div>
              </label>

              <button className="button button-primary button-wide" disabled={busy} style={{ marginTop: 16 }}>
                {busy ? (tamil ? "செயலாக்கப்படுகிறது…" : "Processing...") : authMode === "login" ? (tamil ? "உள்நுழை" : "Sign In") : (tamil ? "கணக்கை உருவாக்கு" : "Create Account")}
              </button>

              <p className="auth-switch">
                {authMode === "login" ? (tamil ? "புதிய கணக்கு வேண்டுமா?" : "Need an account?") : (tamil ? "ஏற்கனவே கணக்கு உள்ளதா?" : "Already registered?")}{" "}
                <button type="button" onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setError(""); }}>
                  {authMode === "login" ? (tamil ? "இங்கே பதிவு செய்யுங்கள்" : "Register here") : (tamil ? "இங்கே உள்நுழையுங்கள்" : "Sign in here")}
                </button>
              </p>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <span className="brand-mark"><HeartPulse size={23} strokeWidth={2.2} aria-hidden="true" /></span>
          <span className="brand-name">
            MediNexus <b>One</b>
            <small>INTEGRATED HEALTH</small>
          </span>
          <button type="button" className="icon-button mobile-close" onClick={() => setMobileNav(false)}>×</button>
        </div>

        <nav className="main-nav">
          {navItems.map(([id, label, icon]) => (
            <button
              type="button"
              key={id}
              className={`nav-item ${page === id ? "active" : ""}`}
              onClick={() => openPage(id)}
            >
              <span>{icon}</span>
              {tamil ? navTamil[id] || label : label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile-badge">
            <div className="user-avatar">{displayName[0]}</div>
            <div className="user-info">
              <b>{displayName}</b>
              <small>{user?.email}</small>
            </div>
          </div>
          <button type="button" className="button button-secondary button-small button-wide" onClick={signOut}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="app-header">
          <button type="button" className="mobile-toggle icon-button" onClick={() => setMobileNav(true)}>☰</button>
          <div className="breadcrumb">
            MediNexus One / <b>{tamil ? navTamil[page] || "முகப்பு" : navItems.find(([id]) => id === page)?.[1] || "Overview"}</b>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <label className="language-select">
              <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="en">English (India)</option>
                <option value="ta">தமிழ் (Tamil)</option>
              </select>
            </label>
            <button type="button" className="button button-secondary button-small" onClick={() => window.dispatchEvent(new Event("medinexus:voice-settings"))} title={tamil ? "குரல் அமைப்புகளைத் திற" : "Open voice settings"}>
              {tamil ? "குரல் அமைப்புகள்" : "Voice settings"}
            </button>
            <button
              type="button"
              className="button button-danger button-small"
              onClick={() => openPage("emergency")}
              title="Immediate Emergency Assistance"
            >
              🆘 SOS 112
            </button>
            <button type="button" className="button button-secondary button-small header-signout" onClick={signOut} aria-label="Sign out" title="Sign out">
              <LogOut size={15} aria-hidden="true" /> <span>Sign Out</span>
            </button>
          </div>
        </header>

        <div className="page-container">
          {(error || notice) && (
            <div className={`alert ${error ? "alert-error" : "alert-success"}`} role={error ? "alert" : "status"}>
              <span>{!error && tamil && notice === "Welcome back to MediNexus One." ? "MediNexus One-க்கு மீண்டும் வரவேற்கிறோம்." : error || notice}</span>
              <button type="button" onClick={() => { setError(""); setNotice(""); }} aria-label={tamil ? "மூடு" : "Dismiss"}>×</button>
            </div>
          )}
          {serviceHealth?.status === "unreachable" && (
            <div className="service-health-notice" role="status">
              <span className="service-health-icon" aria-hidden="true">i</span>
              <span>{tamil ? "உள்ளூர் சேவையகத்தை அணுக முடியவில்லை. backend-ஐ இயக்கி மீண்டும் முயற்சிக்கவும்." : "The local backend is unavailable. Start the backend and try again."}</span>
              <button type="button" className="service-health-refresh" onClick={async () => {
                try { setServiceHealth(await api("/health")); }
                catch (healthError) { setServiceHealth({ status: "unreachable", message: healthError.message, integrations: {} }); }
              }}>{tamil ? "மீண்டும் சரிபார்" : "Check again"}</button>
            </div>
          )}

          {/* SOS Countdown Active Banner */}
          {sosCountdown !== null && (
            <div className="sos-countdown-banner">
              <div>
                <h2 style={{ margin: 0, color: "#d9363e", display: "flex", alignItems: "center", gap: 10 }}>
                  <AlertTriangle size={28} /> Emergency SOS Countdown: <span className="sos-countdown-number">{sosCountdown}s</span>
                </h2>
                <p style={{ margin: "6px 0 0", color: "#611a1e" }}>
                  Incident will be transmitted to MediNexus server in {sosCountdown} seconds. Direct dial 112 / 108 immediately if in danger.
                </p>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" className="button button-secondary" onClick={cancelSosCountdown}>
                  Cancel False Alarm
                </button>
                <button type="button" className="button button-danger" onClick={executeSosSubmission}>
                  Trigger Immediately
                </button>
              </div>
            </div>
          )}

          {/* Siren Active Banner */}
          {sirenPlaying && (
            <div className="alert alert-error sos-alarm-active" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>🔊 Audible Emergency Siren is sounding on this device!</span>
              <button type="button" className="button button-secondary button-small" onClick={stopSiren}>
                Mute Siren
              </button>
            </div>
          )}

          {/* PAGE: OVERVIEW */}
          {page === "overview" && (
            <>
              <section className="welcome-row">
                <div>
                  <span className="eyebrow">{tamil ? "உங்கள் ஒருங்கிணைந்த சுகாதார மையம்" : "YOUR CONNECTED HEALTH HUB"}</span>
                  <h1>{tamil ? `வணக்கம், ${displayName.split(" ")[0]}` : `Welcome back, ${displayName.split(" ")[0]}`}</h1>
                  <p>{tamil ? "மருத்துவமனைகள், சந்திப்புகள், மருத்துவப் பதிவுகள் மற்றும் அவசர உதவி அனைத்தும் ஒரே இடத்தில்." : "Hospitals, appointments, medical records, and emergency help together in one clear place."}</p>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" className="button button-primary" onClick={() => openPage("hospitals")}>
                    {tamil ? "மருத்துவ உதவி தேடுங்கள் →" : "Find care →"}
                  </button>
                  <button type="button" className="button button-danger" onClick={() => openPage("emergency")}>
                    {tamil ? "அவசர உதவி" : "Emergency SOS"}
                  </button>
                </div>
              </section>

              <section className="stats-grid">
                <article className="stat-card">
                  <div className="stat-number">{hospitals.length}</div>
                  <div className="stat-label">{tamil ? "மருத்துவமனைகள்" : "Hospital listings"}</div>
                </article>
                <article className="stat-card">
                  <div className="stat-number">{appointments.length}</div>
                  <div className="stat-label">{tamil ? "உங்கள் சந்திப்புகள்" : "Your appointments"}</div>
                </article>
                <article className="stat-card">
                  <div className="stat-number">{medicalRecords.length}</div>
                  <div className="stat-label">{tamil ? "மருத்துவப் பதிவுகள்" : "Medical records"}</div>
                </article>
                <article className="stat-card">
                  <div className="stat-number">{receipts.length}</div>
                  <div className="stat-label">{tamil ? "கட்டண ரசீதுகள்" : "Billing invoices"}</div>
                </article>
              </section>

              <section className="content-grid">
                <div className="panel">
                  <h2>{tamil ? "சுகாதார வழிகாட்டி சேவைகள்" : "Your care, at a glance"}</h2>
                  <div className="action-grid">
                    {[
                      ["hospitals", tamil ? "மருத்துவமனைகள்" : "Hospitals & clinics", tamil ? "மருத்துவமனைகளைப் பாருங்கள்" : "Browse the facility directory"],
                      ["maps", tamil ? "வரைபடம் மற்றும் வழித்தடம்" : "Maps & directions", tamil ? "வழித்தடத்தைத் திறக்கவும்" : "Open directions to a hospital"],
                      ["indoor", tamil ? "மருத்துவமனை இடம் மற்றும் உள் தகவல்" : "Hospital location & indoor info", tamil ? "வெளிப்புற வரைபடம்; அங்கீகரிக்கப்பட்ட உள் வரைபடம் இருந்தால் மட்டும் காட்டப்படும்" : "Outdoor map; verified indoor plans only when supplied"],
                      ["appointments", tamil ? "சந்திப்புகள்" : "Appointments", tamil ? "சந்திப்பைக் கோருங்கள் அல்லது பாருங்கள்" : "Request or review visits"],
                      ["recovery", tamil ? "மருத்துவர் நிலை" : "Doctor recovery", tamil ? "மாற்று வழிகாட்டுதலைப் பாருங்கள்" : "See delay and recovery guidance"],
                      ["records", tamil ? "மருத்துவப் பதிவுகள்" : "Medical records", tamil ? "உங்கள் பதிவுகளைப் பாதுகாப்பாகப் பாருங்கள்" : "Review your saved records"],
                      ["receipts", tamil ? "ரசீதுகள் மற்றும் கட்டணங்கள்" : "Receipts & billing", tamil ? "கிடைக்கும் ரசீதுகளைப் பாருங்கள்" : "Review available receipts"],
                      ["ai", tamil ? "AI சுகாதார உதவியாளர்" : "AI care guide", tamil ? "சுகாதார வழிகாட்டுதலைப் பெறுங்கள்" : "Get care navigation guidance"],
                    ].map(([id, title, desc]) => (
                      <button type="button" key={id} className="action-tile" onClick={() => openPage(id)}>
                        <b>{title} →</b>
                        <small style={{ color: "#777189" }}>{desc}</small>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="panel emergency-mini">
                  <span className="eyebrow">{tamil ? "அவசர சிகிச்சை" : "URGENT CARE"}</span>
                  <h2>{tamil ? "அவசர உதவி" : "Emergency assistance"}</h2>
                  <p>{tamil ? "உயிருக்கு ஆபத்தான நிலை என்றால் 112 அல்லது 108-ஐ நேரடியாக அழைக்கவும். இங்கிருந்து SOS உதவி திறக்கலாம்." : "In a life-threatening situation, call 112 or 108 directly. Open the SOS console for available location and incident tools."}</p>
                  <button type="button" className="button button-danger button-wide" onClick={() => openPage("emergency")}>
                    {tamil ? "SOS உதவியைத் திறக்கவும்" : "Open SOS console"}
                  </button>
                  <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                    <a className="button button-secondary button-small button-wide" href="tel:112">{tamil ? "112 அவசர அழைப்பு" : "Call 112"}</a>
                    <a className="button button-secondary button-small button-wide" href="tel:108">{tamil ? "108 ஆம்புலன்ஸ்" : "Call 108"}</a>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* PAGE: FIND HOSPITALS */}
          {page === "hospitals" && (
            <>
              <section className="page-heading">
                <div>
                  <span className="eyebrow">CARE DIRECTORY</span>
                  <h1>Hospitals & Clinics</h1>
                  <p>50 Tamil Nadu hospital listings with addresses, official links when published, and directions. Confirm current hours, services, beds, and appointment availability with the hospital.</p>
                  <p className="muted" style={{ margin: "5px 0 0", fontSize: 11 }}>
                    Directory source: {hospitalDirectorySource === "server" ? "local API directory" : "bundled directory (API unavailable)"}. {hospitals.length} records loaded. Bed counts, patient totals, and live wait times require a hospital data feed.
                  </p>
                </div>
                <button type="button" className="button button-secondary" onClick={refreshHospitals}>
                  ↻ Refresh Directory
                </button>
              </section>

              <section className="search-panel">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by hospital name, city (e.g. Chennai, Vellore), or specialty (e.g. Cardiology)..."
                />
              </section>

              <section className="hospital-grid">
                {filteredHospitals.map((hospital, idx) => {
                  const matchingRequest = appointments
                    .filter((item) => String(item.hospitalId || item.hospital_id || item.hospital?.id || "") === String(hospital.id || "") || String(item.hospitalName || item.hospital_name || item.hospital || "").toLowerCase() === String(hospital.name || "").toLowerCase())
                    .sort((a, b) => new Date(`${b.date || ""}T${b.time || "00:00"}`) - new Date(`${a.date || ""}T${a.time || "00:00"}`))[0];
                  const mapsSearch = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([hospital.name, hospital.address, hospital.city, hospital.state].filter(Boolean).join(", "))}`;
                  return (
                  <article className="hospital-card" key={hospital.id || idx}>
                    <div className={`hospital-art hospital-art-${idx % 4}`}>
                      <h3>{hospital.name}</h3>
                      <small style={{ opacity: 0.9 }}>{hospital.city}, {hospital.state || "Tamil Nadu"}</small>
                    </div>
                    <div className="hospital-card-body">
                      <p><strong>Address:</strong> {hospital.address}</p>
                      {hospital.phone
                        ? <p><strong>Phone:</strong> {hospital.phone}{hospital.emergencyPhone ? <> | <strong>Emergency:</strong> {hospital.emergencyPhone}</> : null}</p>
                        : <p><strong>Contact:</strong> Open the hospital website or Maps listing to verify phone and visiting hours.</p>}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0" }}>
                        <span className="status">Beds: live feed unavailable</span>
                        <span className="status">Patients: not published</span>
                        <span className="status">Indoor floor plan: not supplied</span>
                      </div>
                      <p className="muted" style={{ margin: "0 0 12px", fontSize: 12 }}>
                        <strong>Your booking:</strong> {matchingRequest ? `${matchingRequest.status || "request saved"} · ${matchingRequest.date || "date pending"}${matchingRequest.time ? ` at ${matchingRequest.time}` : ""}` : "No request saved for this hospital"}
                      </p>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "0 0 12px", fontSize: 12 }}>
                        <a href={hospital.website || mapsSearch} target="_blank" rel="noreferrer">{hospital.website ? "Official hospital website ↗" : "Find this hospital on Google Maps ↗"}</a>
                        <a href={mapsSearch} target="_blank" rel="noreferrer">Hospital details & directions ↗</a>
                      </div>
                      <div className="hospital-card-footer">
                        <button
                          type="button"
                          className="button button-secondary button-small"
                          onClick={() => {
                            setIndoorHospital(hospital.name);
                            openPage("indoor");
                          }}
                        >
                          Site Map
                        </button>
                        <button
                          type="button"
                          className="button button-secondary button-small"
                          onClick={() => {
                            setMapHospital(hospital);
                            openPage("maps");
                          }}
                        >
                          Directions
                        </button>
                        <button
                          type="button"
                          className="button button-primary button-small"
                          onClick={() => {
                            setSelectedHospital(hospital);
                            setBooking((b) => ({ ...b, hospitalId: String(hospital.id) }));
                          }}
                        >
                          Book Visit
                        </button>
                      </div>
                    </div>
                  </article>
                  );
                })}
              </section>

              {/* Booking Modal */}
              {selectedHospital && (
                <div className="modal-backdrop" onClick={() => setSelectedHospital(null)}>
                  <form className="booking-modal" onSubmit={submitBooking} onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="modal-close" onClick={() => setSelectedHospital(null)}>×</button>
                    <h2>Schedule Appointment</h2>
                    <p style={{ margin: "4px 0 16px", color: "#6e4bd1", fontWeight: 700 }}>{selectedHospital.name}</p>
                    <div className="appointment-demo-note" role="note">{tamil
                      ? "உங்கள் கோரிக்கை MediNexus-இல் சேமிக்கப்படும். காட்டப்படும் உறுதிப்படுத்தல் விளக்க மாதிரி மட்டுமே; மருத்துவமனையின் நேரம் உறுதி செய்யப்பட்டதாகாது."
                      : "Your request is saved to MediNexus. The confirmation displayed is a presentation demo; it does not mean the hospital has confirmed a slot."}</div>

                    <label className="field-label">
                      Specialty Requested
                      <input
                        list="specialties-list"
                        value={booking.specialty}
                        onChange={(e) => setBooking({ ...booking, specialty: e.target.value })}
                        placeholder="e.g. Cardiology, Orthopaedics, General Medicine"
                      />
                      <datalist id="specialties-list">
                        {(selectedHospital.specialties || []).map((s) => <option key={s} value={s} />)}
                      </datalist>
                    </label>

                    <div className="form-two">
                      <label className="field-label">
                        Date
                        <input
                          type="date"
                          required
                          min={localDateInputValue()}
                          value={booking.date}
                          onChange={(e) => setBooking({ ...booking, date: e.target.value })}
                        />
                      </label>
                      <label className="field-label">
                        Time
                        <input
                          type="time"
                          required
                          value={booking.time}
                          onChange={(e) => setBooking({ ...booking, time: e.target.value })}
                        />
                      </label>
                    </div>

                    <label className="field-label">
                      Reason for Consultation
                      <textarea
                        rows="3"
                        value={booking.reason}
                        onChange={(e) => setBooking({ ...booking, reason: e.target.value })}
                        placeholder="Describe your health symptoms or reason for visit"
                      />
                    </label>

                    <button className="button button-primary button-wide" disabled={busy}>
                      {busy ? (tamil ? "சேமிக்கிறது…" : "Saving request...") : (tamil ? "கோரிக்கையைச் சேமி" : "Save request")}
                    </button>
                  </form>
                </div>
              )}
            </>
          )}

          {/* PAGE: MAPS & ROUTING */}
          {page === "maps" && (
            <MapNavigation
              language={language}
              hospitals={hospitals}
              initialHospital={mapHospital}
              appointments={appointments}
              onRefreshHospitals={refreshHospitals}
              onRequestAppointment={(h) => {
                setSelectedHospital(h);
                setBooking((b) => ({ ...b, hospitalId: String(h.id) }));
                openPage("hospitals");
              }}
            />
          )}

          {/* PAGE: INDOOR WAYFINDING */}
          {page === "indoor" && (
            <IndoorNavigation3D
              hospitals={hospitals}
              selectedHospital={hospitals.find((h) => h.name === indoorHospital) || hospitals[0] || null}
              language={language}
              onSelectHospital={(h) => setIndoorHospital(h?.name || "")}
              onRefreshHospitals={refreshHospitals}
              onOpenMap={(h) => {
                setMapHospital(h);
                openPage("maps");
              }}
              onRequestAppointment={(h) => {
                setSelectedHospital(h);
                setBooking((b) => ({ ...b, hospitalId: String(h.id) }));
                openPage("hospitals");
              }}
            />
          )}

          {/* PAGE: APPOINTMENTS */}
          {page === "appointments" && (
            <>
              <section className="page-heading">
                <div>
                  <span className="eyebrow">YOUR SCHEDULE</span>
                  <h1>Consultation Appointments</h1>
                  <p>{tamil ? "விளக்கக் கோரிக்கைகள் இங்கே சேமிக்கப்படும். மருத்துவமனை முன்பதிவு அல்லது உறுதிப்படுத்தல் இணைக்கப்படவில்லை." : "Presentation requests are saved here. Hospital booking and confirmation are not connected."}</p>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" className="button button-secondary" onClick={() => openPage("recovery")}>
                    🔄 Doctor Recovery
                  </button>
                  <button type="button" className="button button-secondary" onClick={refreshAppointments}>
                    ↻ Refresh
                  </button>
                </div>
              </section>

              <section className="panel">
                {appointments.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Hospital / Facility</th>
                          <th>Specialty</th>
                          <th>Date & Time</th>
                          <th>Status</th>
                          <th>Check-in</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {appointments.map((appt) => (
                          <tr key={appt.id}>
                            <td><b>{appt.hospitalName || "Hospital"}</b></td>
                            <td>{appt.specialty}</td>
                            <td>{appt.date} at {appt.time}</td>
                            <td><StatusBadge value={appt.status} /></td>
                            <td>
                              {appt.checked_in_at ? (
                                <span className="status status-confirmed">Checked In</span>
                              ) : appt.status !== "cancelled" ? (
                                <button type="button" className="button button-secondary button-small" onClick={() => handleCheckIn(appt.id)}>
                                  Self Check-in
                                </button>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td>
                              {appt.status !== "cancelled" && (
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button type="button" className="button button-secondary button-small" onClick={() => setRescheduleModal(appt)}>
                                    Reschedule
                                  </button>
                                  <button type="button" className="button button-danger button-small" onClick={() => setCancelModal(appt)}>
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    title="No appointments scheduled"
                    detail="Browse the hospital directory to request a visit. Facility availability must be confirmed directly."
                    action="Find a Hospital"
                    onAction={() => openPage("hospitals")}
                  />
                )}
              </section>

              {/* Reschedule Modal */}
              {rescheduleModal && (
                <div className="modal-backdrop" onClick={() => setRescheduleModal(null)}>
                  <form
                    className="booking-modal"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.target;
                      void handleReschedule(rescheduleModal.id, form.newDate.value, form.newTime.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button type="button" className="modal-close" onClick={() => setRescheduleModal(null)}>×</button>
                    <h2>Reschedule Appointment</h2>
                    <p style={{ margin: "6px 0 14px", color: "#66588a" }}>{rescheduleModal.hospitalName}</p>
                    <label className="field-label">
                      New Date
                      <input name="newDate" type="date" required min={localDateInputValue()} defaultValue={rescheduleModal.date} />
                    </label>
                    <label className="field-label">
                      New Time
                      <input name="newTime" type="time" required defaultValue={rescheduleModal.time} />
                    </label>
                    <button className="button button-primary button-wide" disabled={busy} style={{ marginTop: 14 }}>
                      {busy ? "Updating..." : "Confirm Reschedule"}
                    </button>
                  </form>
                </div>
              )}

              {/* Cancel Modal */}
              {cancelModal && (
                <div className="modal-backdrop" onClick={() => setCancelModal(null)}>
                  <form
                    className="booking-modal"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleCancelAppointment(cancelModal.id, e.target.reason.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button type="button" className="modal-close" onClick={() => setCancelModal(null)}>×</button>
                    <h2>Cancel Appointment</h2>
                    <p style={{ margin: "6px 0 14px", color: "#a32020" }}>Are you sure you want to cancel this visit?</p>
                    <label className="field-label">
                      Reason for cancellation
                      <input name="reason" placeholder="Personal conflict, feeling better, etc." required />
                    </label>
                    <button className="button button-danger button-wide" disabled={busy} style={{ marginTop: 14 }}>
                      {busy ? "Cancelling..." : "Confirm Cancellation"}
                    </button>
                  </form>
                </div>
              )}
            </>
          )}

          {/* PAGE: DOCTOR RECOVERY */}
          {page === "recovery" && (
            <AppointmentRecovery
              appointments={appointments}
              hospitals={hospitals}
              language={language}
              onSpeakStatus={(hospital, operations, latestRequest) => {
                const requestTime = latestRequest ? `${latestRequest.date || "date pending"}${latestRequest.time ? ` at ${latestRequest.time}` : ""}` : "no appointment request is saved";
                const english = `${hospital.name}. Presentation status: ${operations.availableBeds} of ${operations.totalBeds} beds are available. Simulated patient load is ${operations.currentPatients}. Simulated waiting time is ${operations.waitingTime}. The next simulated doctor time is ${operations.doctorSlot}. Your request: ${requestTime}. This is presentation data, not a live hospital feed.`;
                const tamilText = `${hospital.name}. வழங்கல் நிலை: ${operations.availableBeds} படுக்கைகள் உள்ளன. உருவகப்படுத்தப்பட்ட நோயாளர் எண்ணிக்கை ${operations.currentPatients}. காத்திருப்பு நேரம் ${operations.waitingTime}. அடுத்த மருத்துவர் நேரம் ${operations.doctorSlot}. இது நேரடி மருத்துவமனை தரவு அல்ல, விளக்கக் காட்சி தரவு.`;
                void speakAssistantMessage(language === "ta" ? tamilText : english, language, setVoiceStatus);
              }}
              onBookHospital={(hospital) => {
                setSelectedHospital(hospital);
                setBooking((current) => ({ ...current, hospitalId: String(hospital.id) }));
                openPage("hospitals");
              }}
            />
          )}

          {/* PAGE: CARE JOURNEY */}
          {page === "journey" && (
            <PatientJourney appointments={appointments} />
          )}

          {/* PAGE: MEDICAL RECORDS VAULT */}
          {page === "records" && (
            <>
              <section className="page-heading">
                <div>
                  <span className="eyebrow">PATIENT VAULT</span>
                  <h1>Medical Records & Reports</h1>
                  <p>Securely store laboratory reports, prescriptions, discharge summaries, and radiology results.</p>
                </div>
                <button type="button" className="button button-primary" onClick={() => setRecordUploadModal(true)}>
                  + Upload Report
                </button>
              </section>

              <section className="panel">
                {medicalRecords.length ? (
                  <div className="record-grid">
                    {medicalRecords.map((rec) => (
                      <article className="record-card" key={rec.id}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <span className={`badge-privacy ${rec.privacy_level === "emergency_accessible" ? "emergency" : "private"}`}>
                            {rec.privacy_level === "emergency_accessible" ? "Emergency Accessible" : "Private Vault"}
                          </span>
                          <span style={{ fontSize: 12, color: "#8a839f" }}>{rec.record_date}</span>
                        </div>
                        <h3 style={{ margin: "6px 0 2px" }}>{rec.title}</h3>
                        <p style={{ fontSize: 13, color: "#665e7d", margin: 0 }}>Type: <b>{rec.record_type}</b></p>
                        {rec.hospital_name && <p style={{ fontSize: 12, color: "#887f9d", margin: 0 }}>Facility: {rec.hospital_name}</p>}
                        {rec.notes && <p style={{ fontSize: 13, color: "#544d67", background: "#f8f6fc", padding: 10, borderRadius: 8, margin: "6px 0" }}>{rec.notes}</p>}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: 10, borderTop: "1px solid #eeeaf6" }}>
                          <span style={{ fontSize: 12, color: "#928aab" }}>{rec.file_name || "Diagnostic Note"}</span>
                          <button
                            type="button"
                            className="icon-button"
                            style={{ color: "#d9363e" }}
                            title="Delete record"
                            onClick={async () => {
                              if (confirm("Delete this medical record?")) {
                                await api(`/records/${rec.id}`, { method: "DELETE" });
                                void refreshRecords();
                              }
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No medical records uploaded"
                    detail="Keep your prescriptions and reports safe for consultations and emergency responders."
                    action="Upload Document"
                    onAction={() => setRecordUploadModal(true)}
                  />
                )}
              </section>

              {/* Upload Record Modal */}
              {recordUploadModal && (
                <div className="modal-backdrop" onClick={() => setRecordUploadModal(false)}>
                  <form className="booking-modal" onSubmit={handleUploadRecord} onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="modal-close" onClick={() => setRecordUploadModal(false)}>×</button>
                    <h2>Upload Medical Document</h2>
                    <p className="muted">Uploaded records are private to you by default.</p>

                    <label className="field-label">
                      Document Title
                      <input required value={recordForm.title} onChange={(e) => setRecordForm({ ...recordForm, title: e.target.value })} placeholder="e.g. Lipid Profile Lab Test" />
                    </label>

                    <label className="field-label">
                      Record Type
                      <select value={recordForm.recordType} onChange={(e) => setRecordForm({ ...recordForm, recordType: e.target.value })}>
                        <option>Lab Report</option>
                        <option>Doctor Prescription</option>
                        <option>Radiology / Imaging</option>
                        <option>Discharge Summary</option>
                        <option>Vaccination Record</option>
                      </select>
                    </label>

                    <div className="form-two">
                      <label className="field-label">
                        Hospital / Clinic Name
                        <input value={recordForm.hospitalName} onChange={(e) => setRecordForm({ ...recordForm, hospitalName: e.target.value })} placeholder="Apollo / CMC / MIOT" />
                      </label>
                      <label className="field-label">
                        Doctor Name
                        <input value={recordForm.doctorName} onChange={(e) => setRecordForm({ ...recordForm, doctorName: e.target.value })} placeholder="Dr. Senthil Kumar" />
                      </label>
                    </div>

                    <label className="field-label">
                      Privacy & Responders Setting
                      <select value={recordForm.privacyLevel} onChange={(e) => setRecordForm({ ...recordForm, privacyLevel: e.target.value })}>
                        <option value="private">Private (Only you & authorized doctors)</option>
                        <option value="emergency_accessible">Emergency Accessible (Shared with verified 112 responders on SOS)</option>
                      </select>
                    </label>

                    <label className="field-label">
                      Notes or Key Findings
                      <textarea rows="3" value={recordForm.notes} onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })} placeholder="Key diagnostic values, allergies observed, etc." />
                    </label>

                    <button className="button button-primary button-wide" disabled={busy} style={{ marginTop: 14 }}>
                      {busy ? "Saving..." : "Save to Medical Vault"}
                    </button>
                  </form>
                </div>
              )}
            </>
          )}

          {/* PAGE: HEALTH PROFILE */}
          {page === "profile" && (
            <>
              <section className="page-heading">
                <div>
                  <span className="eyebrow">{tamil ? "நோயாளர் சுயவிவரம்" : "PATIENT PROFILE"}</span>
                  <h1>{tamil ? "சுகாதார விவரம் மற்றும் அவசரத் தகவல்" : "Health profile & emergency information"}</h1>
                  <p>{tamil ? "அவசரநிலையில் பகிர விரும்பும் முக்கியமான சுகாதாரத் தகவல்களை இங்கே நிர்வகிக்கவும்." : "Manage the health information you choose to share during an emergency."}</p>
                </div>
                <button type="button" className="button button-secondary" onClick={() => void refreshProfile()}>{tamil ? "மீண்டும் ஏற்று" : "Reload profile"}</button>
              </section>

              {profileLoadError && <div className="service-health-notice" role="status"><span className="service-health-icon">i</span><span>{profileLoadError}</span></div>}

              <div className="content-grid">
                <section className="panel">
                  <div className="profile-section-heading">
                    <div><span className="eyebrow">{tamil ? "சேமிக்கப்பட்ட சுயவிவரம்" : "SAVED PROFILE"}</span><h2>{tamil ? "தனிப்பட்ட மருத்துவத் தகவல்கள்" : "Personal medical information"}</h2></div>
                    {!profileEditing && <button type="button" className="button button-secondary" onClick={() => setProfileEditing(true)}>{tamil ? "விவரங்களைத் திருத்து" : "Edit details"}</button>}
                  </div>
                  {profileEditing ? <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setBusy(true);
                      try {
                        const result = await api("/profile/me", {
                          method: "PUT",
                          body: JSON.stringify(userProfile),
                        });
                        if (result?.profile) await refreshProfile();
                        setProfileEditing(false);
                        setNotice(tamil ? "உங்கள் சுயவிவரம் சேமிக்கப்பட்டு மீண்டும் ஏற்றப்பட்டது." : "Your profile was saved and refreshed.");
                      } catch (err) {
                        setError(err.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <div className="profile-photo-editor">
                      <div className="profile-photo" aria-hidden="true">{userProfile?.avatarData ? <img src={userProfile.avatarData} alt="" /> : <span>{(userProfile?.fullName || user?.fullName || user?.email || "M").trim().slice(0, 1).toUpperCase()}</span>}</div>
                      <div className="profile-photo-picker-wrap">
                        <input id="profile-photo-upload" key={avatarInputKey} className="profile-photo-file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          if (file.size > 1024 * 1024) { setError(tamil ? "படம் 1 MB-க்குள் இருக்க வேண்டும்." : "Choose an image under 1 MB."); event.target.value = ""; return; }
                          const reader = new FileReader();
                          reader.onload = () => setUserProfile({ ...userProfile, avatarData: String(reader.result || "") });
                          reader.readAsDataURL(file);
                        }} />
                        <label htmlFor="profile-photo-upload" className="profile-photo-picker"><span aria-hidden="true">▧</span><span><strong>{tamil ? "புகைப்படத்தைத் தேர்ந்தெடுக்கவும்" : "Choose profile photo"}</strong><small>{tamil ? "PNG, JPG அல்லது WebP · அதிகபட்சம் 1 MB" : "PNG, JPG, or WebP · maximum 1 MB"}</small></span></label>
                      </div>
                      {userProfile?.avatarData && <button type="button" className="button button-secondary button-small" onClick={() => { setUserProfile({ ...userProfile, avatarData: "" }); setAvatarInputKey((key) => key + 1); }}>{tamil ? "படத்தை நீக்கு" : "Remove photo"}</button>}
                    </div>
                    <div className="form-two">
                      <label className="field-label">
                        {tamil ? "முழுப் பெயர்" : "Full name"}
                        <input
                          value={userProfile?.fullName || ""}
                          onChange={(e) => setUserProfile({ ...userProfile, fullName: e.target.value })}
                        />
                      </label>
                      <label className="field-label">
                        {tamil ? "தொலைபேசி எண்" : "Phone number"}
                        <input
                          value={userProfile?.phone || ""}
                          onChange={(e) => setUserProfile({ ...userProfile, phone: e.target.value })}
                          placeholder="+91 98765 43210"
                        />
                      </label>
                    </div>

                    <div className="form-two">
                      <label className="field-label">
                        {tamil ? "இரத்த வகை" : "Blood group"}
                        <select
                          value={userProfile?.bloodGroup || ""}
                          onChange={(e) => setUserProfile({ ...userProfile, bloodGroup: e.target.value })}
                        >
                          <option value="">{tamil ? "இரத்த வகையைத் தேர்ந்தெடுக்கவும்" : "Select blood group"}</option>
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                        </select>
                      </label>
                      <label className="field-label">
                        {tamil ? "அவசரநிலை அனுமதி" : "Emergency sharing consent"}
                        <select
                          value={userProfile?.emergencyMedicalConsent ? "yes" : "no"}
                          onChange={(e) => {
                            const allowed = e.target.value === "yes";
                            setUserProfile({ ...userProfile, emergencyMedicalConsent: allowed });
                            setEmergencyConsent(allowed);
                          }}
                        >
                          <option value="yes">{tamil ? "SOS நேரத்தில் சரிபார்க்கப்பட்ட உதவியாளர்களுடன் பகிரவும்" : "Share with verified responders during SOS"}</option>
                          <option value="no">{tamil ? "தானாகப் பகிர வேண்டாம்" : "Do not share automatically"}</option>
                        </select>
                      </label>
                    </div>

                    <label className="field-label">
                      {tamil ? "நீடித்த உடல்நிலைகள் (காற்புள்ளியால் பிரிக்கவும்)" : "Chronic conditions (comma separated)"}
                      <input
                        value={Array.isArray(userProfile?.chronicConditions) ? userProfile.chronicConditions.join(", ") : userProfile?.chronicConditions || ""}
                        onChange={(e) => setUserProfile({ ...userProfile, chronicConditions: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                        placeholder="e.g. Asthma, diabetes"
                      />
                    </label>

                    <label className="field-label">
                      {tamil ? "தெரிந்த ஒவ்வாமைகள் (காற்புள்ளியால் பிரிக்கவும்)" : "Known allergies (comma separated)"}
                      <input
                        value={Array.isArray(userProfile?.allergies) ? userProfile.allergies.join(", ") : userProfile?.allergies || ""}
                        onChange={(e) => setUserProfile({ ...userProfile, allergies: e.target.value.split(",").map((s) => s.trim()) })}
                        placeholder="e.g. Penicillin, Peanuts, Sulfa drugs"
                      />
                    </label>

                    <label className="field-label">
                      {tamil ? "தற்போதைய மருந்துகள் (காற்புள்ளியால் பிரிக்கவும்)" : "Current medications (comma separated)"}
                      <input
                        value={Array.isArray(userProfile?.currentMedications) ? userProfile.currentMedications.join(", ") : userProfile?.currentMedications || ""}
                        onChange={(e) => setUserProfile({ ...userProfile, currentMedications: e.target.value.split(",").map((s) => s.trim()) })}
                        placeholder="e.g. Metformin 500mg, Atorvastatin 10mg"
                      />
                    </label>

                    <label className="field-label">
                      {tamil ? "அவசரக் குறிப்பு / நீடித்த உடல்நிலைகள்" : "Emergency notes / chronic conditions"}
                      <textarea
                        rows="3"
                        value={userProfile?.emergencyNotes || ""}
                        onChange={(e) => setUserProfile({ ...userProfile, emergencyNotes: e.target.value })}
                        placeholder="Pacemaker fitted, Type 2 Diabetic, Hypertension..."
                      />
                    </label>

                    <button className="button button-primary" disabled={busy} style={{ marginTop: 14 }}>
                      {busy ? (tamil ? "சேமிக்கிறது…" : "Saving...") : (tamil ? "சுகாதார விவரத்தைச் சேமி" : "Save health profile")}
                    </button>
                    <button type="button" className="button button-secondary" style={{ margin: "14px 0 0 8px" }} onClick={() => { void refreshProfile(); setProfileEditing(false); }}>{tamil ? "ரத்து செய்" : "Cancel"}</button>
                  </form> : (<>
                    <div className="profile-card-header">
                      <div className="profile-photo" aria-hidden="true">{userProfile?.avatarData ? <img src={userProfile.avatarData} alt="" /> : <span>{(userProfile?.fullName || user?.fullName || user?.email || "M").trim().slice(0, 1).toUpperCase()}</span>}</div>
                      <div><h3>{userProfile?.fullName || user?.fullName || "Your profile"}</h3><p>{user?.email || ""}</p><span>{tamil ? "சேமிக்கப்பட்ட நோயாளர் சுயவிவரம்" : "Saved patient profile"}</span></div>
                    </div>
                    <div className="profile-summary-grid">
                      {[
                        [tamil ? "முழுப் பெயர்" : "Full name", userProfile?.fullName || userProfile?.full_name || "—"],
                        [tamil ? "தொலைபேசி எண்" : "Phone number", userProfile?.phone || "—"],
                        [tamil ? "இரத்த வகை" : "Blood group", userProfile?.bloodGroup || userProfile?.blood_group || "—"],
                        [tamil ? "தெரிந்த ஒவ்வாமைகள்" : "Known allergies", profileValue(userProfile?.allergies)],
                        [tamil ? "நீடித்த உடல்நிலைகள்" : "Chronic conditions", profileValue(userProfile?.chronicConditions || userProfile?.chronic_conditions)],
                        [tamil ? "தற்போதைய மருந்துகள்" : "Current medications", profileValue(userProfile?.currentMedications || userProfile?.current_medications)],
                        [tamil ? "அவசரக் குறிப்புகள்" : "Emergency notes", userProfile?.emergencyNotes || userProfile?.emergency_notes || "—"],
                        [tamil ? "SOS மருத்துவத் தகவல் பகிர்வு" : "SOS medical information sharing", (userProfile?.emergencyMedicalConsent ?? userProfile?.emergency_medical_consent) ? (tamil ? "அனுமதி வழங்கப்பட்டுள்ளது" : "Allowed") : (tamil ? "அனுமதி இல்லை" : "Not allowed")],
                      ].map(([label, value]) => <div className="profile-summary-item" key={label}><span>{label}</span><strong>{value}</strong></div>)}
                    </div>
                  </>)}
                </section>

                <section className="panel">
                  <h2>{tamil ? "அவசரத் தொடர்புகள்" : "Emergency contacts"}</h2>
                  <p className="muted">{tamil ? "உங்கள் குடும்பத் தொடர்புகள் உள்நுழைந்த கணக்கில் சேமிக்கப்படும். SOS பக்கத்தில் அழைப்பு உங்கள் தொலைபேசியில் திறக்கும்; செய்தி விவரங்களுடன் SMS வரைவைத் திறக்கும். அனுப்புவதற்கு முன் நீங்கள் சரிபார்க்கலாம்." : "Your family contacts are saved to your signed-in account. From SOS, Call opens your phone dialler and Text details opens a prefilled message for you to review and send."}</p>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "16px 0" }}>
                    {emergencyContacts.map((c) => (
                      <div key={c.id} style={{ padding: 12, border: "1px solid #e8e3f4", borderRadius: 12 }}>
                        {editingContact?.id === c.id ? (
                          <form className="contact-edit-form" onSubmit={async (event) => {
                            event.preventDefault();
                            try {
                              await api(`/emergency/contacts/${c.id}`, { method: "PUT", body: JSON.stringify(editingContact) });
                              await refreshEmergencyContacts();
                              setEditingContact(null);
                              setNotice(tamil ? "அவசரத் தொடர்பு புதுப்பிக்கப்பட்டது." : "Emergency contact updated.");
                            } catch (err) { setError(err.message); }
                          }}>
                            <label className="field-label">{tamil ? "பெயர்" : "Name"}<input value={editingContact.contact_name} onChange={(event) => setEditingContact({ ...editingContact, contact_name: event.target.value })} required /></label>
                            <label className="field-label">{tamil ? "தொலைபேசி எண்" : "Phone number"}<input value={editingContact.phone} onChange={(event) => setEditingContact({ ...editingContact, phone: event.target.value })} required /></label>
                            <label className="field-label">{tamil ? "உறவு" : "Relationship"}<input value={editingContact.relationship || "Family"} onChange={(event) => setEditingContact({ ...editingContact, relationship: event.target.value })} required /></label>
                            <div className="profile-contact-actions"><button className="button button-primary button-small">{tamil ? "சேமி" : "Save"}</button><button type="button" className="button button-secondary button-small" onClick={() => setEditingContact(null)}>{tamil ? "ரத்து செய்" : "Cancel"}</button></div>
                          </form>
                        ) : <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                        <div>
                          <b>{c.contact_name}</b> <small style={{ color: "#777" }}>({c.relationship})</small>
                          <div style={{ fontSize: 13, color: "#665888" }}>{c.phone}</div>
                          <div className="profile-contact-actions">
                            <a className="button button-secondary button-small" href={"tel:" + callOrTextNumber(c.phone)}>{tamil ? "அழை" : "Call"}</a>
                            <a className="button button-secondary button-small" href={smsDraftHref(c.phone)}>{tamil ? "SOS விவரங்களைச் செய்தியாகத் திற" : "Text SOS details"}</a>
                            <button type="button" className="button button-secondary button-small" onClick={() => setEditingContact({ id: c.id, contact_name: c.contact_name || "", phone: c.phone || "", relationship: c.relationship || "Family" })}>{tamil ? "திருத்து" : "Edit"}</button>
                          </div>
                        </div>
                          <button
                          type="button"
                          className="icon-button"
                          style={{ color: "#d9363e" }}
                            aria-label={tamil ? `${c.contact_name} தொடர்பை நீக்கு` : `Remove ${c.contact_name}`}
                          onClick={async () => {
                            try {
                              await api(`/emergency/contacts/${c.id}`, { method: "DELETE" });
                              await refreshEmergencyContacts();
                              setNotice(tamil ? "அவசரத் தொடர்பு நீக்கப்பட்டது." : "Emergency contact removed.");
                            } catch (err) { setError(err.message); }
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>}</div>
                    ))}

                    {!emergencyContacts.length && <p className="muted">{tamil ? "அவசரத் தொடர்புகள் இன்னும் சேர்க்கப்படவில்லை." : "No emergency contacts added yet."}</p>}
                  </div>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.target;
                      try {
                      await api("/emergency/contacts", {
                        method: "POST",
                        body: JSON.stringify({
                          contact_name: form.cName.value,
                          phone: form.cPhone.value,
                          relationship: form.cRel.value,
                        }),
                      });
                      form.reset();
                      await refreshEmergencyContacts();
                      setNotice(tamil ? "அவசரத் தொடர்பு சேர்க்கப்பட்டது." : "Emergency contact added.");
                      } catch (err) { setError(err.message); }
                    }}
                    style={{ borderTop: "1px solid #eeeaf6", paddingTop: 16 }}
                  >
                      <h4>{tamil ? "அவசரத் தொடர்பைச் சேர்க்கவும்" : "Add emergency contact"}</h4>
                    <label className="field-label">
                      {tamil ? "பெயர்" : "Name"}
                      <input name="cName" required placeholder="Parent, Spouse, Doctor" />
                    </label>
                    <label className="field-label">
                      {tamil ? "தொலைபேசி எண்" : "Phone number"}
                      <input name="cPhone" required placeholder="+91 98765 00000" />
                    </label>
                    <label className="field-label">
                      {tamil ? "உறவு" : "Relationship"}
                      <select name="cRel">
                        <option>Spouse / Partner</option>
                        <option>Parent</option>
                        <option>Sibling / Family</option>
                        <option>Primary Physician</option>
                        <option>Friend / Colleague</option>
                      </select>
                    </label>
                    <button className="button button-secondary button-wide" style={{ marginTop: 10 }}>
                      {tamil ? "+ தொடர்பைச் சேமி" : "+ Save contact"}
                    </button>
                  </form>
                </section>
              </div>
            </>
          )}

          {/* PAGE: RECEIPTS & BILLING */}
          {page === "receipts" && (
            <>
              <section className="page-heading">
                <div>
                  <span className="eyebrow">BILLING & INVOICES</span>
                  <h1>Receipts & Billing Records</h1>
                  <p>Itemized hospital charges, verifiable receipt numbers, and official printable tax invoices.</p>
                </div>
                <button type="button" className="button button-secondary" onClick={refreshReceipts}>
                  ↻ Refresh
                </button>
              </section>

              <section className="panel">
                {receipts.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Receipt #</th>
                          <th>Provider</th>
                          <th>Date</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Invoice</th>
                          <th>Payment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {receipts.map((r) => (
                          <tr key={r.id}>
                            <td><b>{r.receipt_number || "MNX-INVOICE"}</b></td>
                            <td>{r.hospitalName || "Hospital Facility"}</td>
                            <td>{r.created_at?.slice(0, 10) || "—"}</td>
                            <td>{r.currency || "INR"} {Number(r.total || 0).toFixed(2)}</td>
                            <td><StatusBadge value={r.payment_status} /></td>
                            <td>
                              <button type="button" className="button button-secondary button-small" onClick={() => setInvoicePreview(r)}>
                                <Printer size={14} /> View / Print
                              </button>
                            </td>
                            <td>
                              {r.payment_status === "paid" ? (
                                <span className="status status-confirmed">Settled</span>
                              ) : (
                                <button
                                  type="button"
                                  className="button button-primary button-small"
                                  onClick={async () => {
                                    try {
                                      await api(`/receipts/${r.id}/pay`, { method: "POST" });
                                      void refreshReceipts();
                                    } catch (err) {
                                      setError(err.message);
                                    }
                                  }}
                                >
                                  Pay Bill
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    title="No billing invoices"
                    detail="Itemized invoices generated by hospital staff will appear here."
                  />
                )}
              </section>

              {/* Printable Invoice Modal */}
              {invoicePreview && (
                <div className="modal-backdrop" onClick={() => setInvoicePreview(null)}>
                  <div className="booking-modal" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="modal-close no-print" onClick={() => setInvoicePreview(null)}>×</button>

                    <div className="invoice-print-container">
                      <div className="invoice-header-row">
                        <div>
                          <h2 style={{ margin: 0, color: "#6845c5" }}>MEDINEXUS ONE</h2>
                          <p style={{ margin: "4px 0", fontSize: 13, color: "#665e7d" }}>Connected Healthcare Invoicing</p>
                          <p style={{ margin: 0, fontSize: 13 }}><b>Provider:</b> {invoicePreview.hospitalName || "Apollo Hospitals"}</p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span className={`status ${invoicePreview.payment_status === "paid" ? "status-confirmed" : "status-pending"}`}>
                            {invoicePreview.payment_status === "paid" ? "OFFICIAL PAID RECEIPT" : "ESTIMATE / UNPAID INVOICE"}
                          </span>
                          <p style={{ margin: "6px 0 0", fontSize: 13 }}><b>Invoice #:</b> {invoicePreview.receipt_number}</p>
                          <p style={{ margin: 0, fontSize: 13 }}><b>Date:</b> {invoicePreview.created_at?.slice(0, 10)}</p>
                        </div>
                      </div>

                      <div style={{ margin: "16px 0", fontSize: 13 }}>
                        <p><b>Patient:</b> {displayName} ({user?.email})</p>
                      </div>

                      <table className="invoice-table">
                        <thead>
                          <tr>
                            <th>Description</th>
                            <th>Qty</th>
                            <th>Unit Price</th>
                            <th>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(invoicePreview.items || [
                            { description: "Specialist Consultation Fee", qty: 1, unit_price: invoicePreview.subtotal || invoicePreview.total, amount: invoicePreview.subtotal || invoicePreview.total }
                          ]).map((item, i) => (
                            <tr key={i}>
                              <td>{item.description}</td>
                              <td>{item.qty || 1}</td>
                              <td>{invoicePreview.currency || "INR"} {Number(item.unit_price || item.amount).toFixed(2)}</td>
                              <td>{invoicePreview.currency || "INR"} {Number(item.amount).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <div className="invoice-total-row">
                        <div>Subtotal: <b>{invoicePreview.currency || "INR"} {Number(invoicePreview.subtotal || invoicePreview.total || 0).toFixed(2)}</b></div>
                        <div>Applicable Tax (GST): <b>{invoicePreview.currency || "INR"} {Number(invoicePreview.tax || 0).toFixed(2)}</b></div>
                        {Number(invoicePreview.discount || 0) > 0 && <div>Discount: -{invoicePreview.currency || "INR"} {Number(invoicePreview.discount).toFixed(2)}</div>}
                        <div style={{ fontSize: 18, color: "#29233c" }}>Total: <b>{invoicePreview.currency || "INR"} {Number(invoicePreview.total || 0).toFixed(2)}</b></div>
                      </div>

                      <div style={{ marginTop: 24, padding: 14, background: "#faf8ff", borderRadius: 10, fontSize: 12, color: "#6e6686" }}>
                        Notice: This invoice is generated by MediNexus One. Payments are verified through encrypted hospital billing webhooks. Duplicate charges are strictly prevented.
                      </div>

                      <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
                        <button type="button" className="button button-secondary" onClick={() => window.print()}>
                          <Printer size={16} /> Print / Save as PDF
                        </button>
                        <button type="button" className="button button-primary" onClick={() => setInvoicePreview(null)}>
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* PAGE: EMERGENCY SOS & ACCIDENT RESPONSE */}
          {page === "emergency" && (
            <>
              <section className="page-heading">
                <div>
                  <span className="eyebrow">CAREPATH SOS CONSOLE</span>
                  <h1>Emergency SOS & Accident Response</h1>
                  <p>Immediate location broadcast, siren alarm, crash detection, and honest emergency channel tracking.</p>
                </div>
              </section>

              <div className="emergency-warning" style={{ background: "#fff2f2", borderLeft: "6px solid #d9363e", padding: 18, borderRadius: 12, marginBottom: 20 }}>
                <b style={{ color: "#a31818", fontSize: 16 }}>Immediate Danger or Severe Injury?</b>
                <p style={{ margin: "6px 0 0", color: "#611a1e" }}>
                  Call <b>112</b> (India National Emergency) or <b>108</b> (Ambulance) now. Do not wait for web forms or AI chat. Web browsers cannot autonomously dispatch first responders without verified telephonic confirmation.
                </p>
                <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
                  <a className="button button-danger" href="tel:112" style={{ fontSize: 15, padding: "10px 22px" }}>
                    📞 Call 112 (National Emergency)
                  </a>
                  <a className="button button-secondary" href="tel:108" style={{ fontSize: 15, padding: "10px 22px" }}>
                    🚑 Call 108 (Ambulance)
                  </a>
                </div>
              </div>

              {/* 5-Step Honest Tracker */}
              <div className="honest-tracker">
                <div className={`tracker-step ${emergencyLocation ? "step-verified" : "step-pending"}`}>
                  <span className="tracker-label">Step 1: Device GPS</span>
                  <span className="tracker-value">{emergencyLocation ? "✓ Coordinates Captured" : "Waiting for GPS permission"}</span>
                </div>
                <div className={`tracker-step ${activeIncident ? "step-verified" : "step-notice"}`}>
                  <span className="tracker-label">Step 2: Server Database</span>
                  <span className="tracker-value">{activeIncident ? `✓ Record ${activeIncident.incidentNumber}` : "Not transmitted"}</span>
                </div>
                <div className="tracker-step step-notice">
                  <span className="tracker-label">Step 3: Direct Call</span>
                  <span className="tracker-value">User-Initiated via Tel Button</span>
                </div>
                <div className={`tracker-step ${activeIncident?.notificationAttempts?.length ? "step-verified" : "step-notice"}`}>
                  <span className="tracker-label">Step 4: Contact SMS</span>
                  <span className="tracker-value">{activeIncident?.notificationAttempts?.[0]?.status === "unconfigured_provider" ? "Use Text details to open your SMS app" : activeIncident?.notificationAttempts?.[0]?.status || "Use Text details to open your SMS app"}</span>
                </div>
                <div className="tracker-step step-notice">
                  <span className="tracker-label">Step 5: Ambulance Dispatch</span>
                  <span className="tracker-value">Requires 108 Operator Voice Ack</span>
                </div>
              </div>

              <section className="emergency-grid">
                <div className="panel emergency-form">
                  <span className="eyebrow">INCIDENT DETAILS</span>
                  <h2>Report Emergency</h2>

                  <label className="field-label">
                    Incident Type
                    <select value={emergencyType} onChange={(e) => setEmergencyType(e.target.value)}>
                      <option>Accident / Vehicle Crash</option>
                      <option>Cardiac / Chest Pain Emergency</option>
                      <option>Trauma / Heavy Bleeding</option>
                      <option>Breathing / Respiratory Distress</option>
                      <option>Fire / Burn Injury</option>
                      <option>Other Urgent Medical Emergency</option>
                    </select>
                  </label>

                  <label className="field-label">
                    Specific Landmark or Details
                    <textarea
                      rows="3"
                      value={emergencyDetails}
                      onChange={(e) => setEmergencyDetails(e.target.value)}
                      placeholder="e.g. Near Greams Road flyover pillar 14, 2 people injured..."
                    />
                  </label>

                  <div className="action-grid">
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => requestEmergencyLocation()}
                    >
                      📍 Capture GPS Location
                    </button>
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={startVoiceInput}
                    >
                      {voiceInputActive ? "⏹ Stop microphone" : "🎙️ Speak details"}
                    </button>
                  </div>

                  <p className="muted" style={{ fontSize: 13, margin: "8px 0" }}>Voice Assistant: {voiceStatus}</p>
                  <p className="muted" style={{ fontSize: 11, margin: "0 0 8px" }}>When GPS permission is allowed, the app records your device location for this incident and tries to show a nearby street or area name. The screen keeps the location readable instead of displaying coordinate numbers.</p>

                  <div className="location-result">
                    <div className="location-result-icon">📍</div>
                    <div>
                      <b>Location Recorded:</b>
                      <p style={{ margin: "2px 0" }}>{emergencyLocation || "Location not captured yet"}</p>
                      {emergencyGpsData && <small>Accuracy: ±{Math.round(emergencyGpsData.accuracy)} meters</small>}
                      {emergencyTime && <small style={{ display: "block", color: "#695f82" }}>Captured at: {emergencyTime}</small>}
                    </div>
                  </div>

                  {/* Manual fallback input */}
                  <label className="field-label" style={{ marginTop: 10 }}>
                    Manual address or landmark
                    <input
                      value={emergencyLocation}
                      onChange={(e) => {
                        setEmergencyLocation(e.target.value);
                        setEmergencyGpsData(null);
                        setEmergencyTime("");
                      }}
                      placeholder="Type street, landmark, or village name manually"
                    />
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0", fontSize: 13, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={emergencyConsent}
                      onChange={(e) => {
                        setEmergencyConsent(e.target.checked);
                        setUserProfile((current) => ({ ...current, emergencyMedicalConsent: e.target.checked }));
                      }}
                    />
                    <span>Attach my blood group & emergency medical profile with the incident record</span>
                  </label>

                  {/* SOS Trigger Button with 5s countdown */}
                  <button
                    type="button"
                    className="button button-danger button-wide"
                    style={{ fontSize: 18, padding: "16px 24px", fontWeight: 800 }}
                    onClick={() => startSosCountdown()}
                  >
                    🚨 TRANSMIT EMERGENCY SOS
                  </button>

                  <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                    <button
                      type="button"
                      className="button button-secondary button-wide"
                      onClick={() => (sirenPlaying ? stopSiren() : startSiren())}
                    >
                      {sirenPlaying ? "🔇 Mute Siren" : "🔊 Sound Siren Alarm"}
                    </button>
                    <button
                      type="button"
                      className="button button-secondary button-wide"
                      onClick={() => speakEmergencyScript(activeIncident?.incidentNumber || "")}
                    >
                      🗣️ Speak Announcement
                    </button>
                  </div>

                  {/* Crash Sensor Toggle with Honest Disclaimers */}
                  <div style={{ marginTop: 18, padding: 14, background: "#f8f5fd", borderRadius: 12, border: "1px solid #e7deff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <b>📱 Device Crash Detection Sensor</b>
                      <button
                        type="button"
                        className={`button ${crashSensorActive ? "button-danger" : "button-secondary"} button-small`}
                        onClick={toggleCrashSensor}
                      >
                      {crashSensorActive ? "Sensor Active (Stop)" : "Enable Sensor"}
                      </button>
                    </div>
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6c6386" }}>
                      {crashSensorStatus} A sudden movement can be a false alarm; SOS starts a 5-second cancel countdown. This browser sensor cannot monitor while the page is closed or suspended in the background.
                    </p>
                  </div>

                  {activeIncident && (
                    <div style={{ marginTop: 18, padding: 16, background: "#f2fbf6", border: "1px solid #28a745", borderRadius: 12 }}>
                      <h4 style={{ margin: "0 0 6px", color: "#177d3b" }}>Incident Registered: {activeIncident.incidentNumber}</h4>
                      <p style={{ margin: "0 0 6px", fontSize: 13 }}>Shareable Expiring Responder Link:</p>
                      <a href={activeIncident.shareUrl} target="_blank" rel="noreferrer" style={{ wordBreak: "break-all", fontSize: 12, color: "#6845c5" }}>
                        {activeIncident.shareUrl}
                      </a>
                      <label style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 13, fontSize: 13 }}>
                        <input type="checkbox" checked={repeatSosVoice} onChange={(event) => setRepeatSosVoice(event.target.checked)} />
                        Repeat the full voice announcement once after 20 seconds
                      </label>
                      <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: 10 }}>
                        <button type="button" className="button button-primary button-small" disabled={busy} onClick={updateActiveIncident}>
                          Update incident details and speak
                        </button>
                        <button type="button" className="button button-secondary button-small" onClick={() => speakEmergencyScript(activeIncident.incidentNumber)}>
                          Speak current details now
                        </button>
                      </div>
                      <p style={{ margin: "8px 0 0", fontSize: 11, color: "#5f6f64" }}>
                        Change the incident type, location, or notes above, then update it here. Repeated speech uses the latest saved details. This does not notify emergency operators; call 112 or 108 directly.
                      </p>
                    </div>
                  )}
                </div>

                <div className="panel emergency-call-panel">
                  <span className="eyebrow">DIRECT TELEPHONE ACCESS</span>
                  <h2>Emergency Responders</h2>
                  <p className="muted">Direct hardware phone links trigger immediate calling on your device.</p>

                  <label className="field-label" style={{ marginTop: 12 }}>
                    {tamil ? "தொடர்புகொள்ள வேண்டிய மருத்துவமனை" : "Hospital to call"}
                    <select value={String(emergencyHospital?.id || emergencyHospital?._id || "")} onChange={(event) => setEmergencyHospitalId(event.target.value)}>
                      {hospitals.map((hospital, index) => <option key={hospital.id || hospital._id || index} value={String(hospital.id || hospital._id || "")}>{hospital.name}</option>)}
                    </select>
                  </label>
                  {emergencyHospital && (emergencyHospital.emergencyPhone || emergencyHospital.phone) && <a className="button button-primary button-wide" href={`tel:${callOrTextNumber(emergencyHospital.emergencyPhone || emergencyHospital.phone)}`} style={{ margin: "0 0 12px", padding: "12px 16px" }}>
                    🏥 {tamil ? `${emergencyHospital.name} மருத்துவமனைக்கு அழைக்கவும்` : `Call ${emergencyHospital.name}`}
                  </a>}

                  <a className="button button-danger button-wide" href="tel:112" style={{ padding: "14px 20px", fontSize: 16, marginBottom: 12 }}>
                    📞 Call 112 — National Emergency
                  </a>

                  <a className="button button-secondary button-wide" href="tel:108" style={{ padding: "14px 20px", fontSize: 16, marginBottom: 12 }}>
                    🚑 Call 108 — Ambulance Control
                  </a>

                  <div className="voice-note" style={{ marginTop: 16 }}>
                    <b>Important Clinical Dispatch Rule</b>
                    <p>
                      Never assume an ambulance has been dispatched until you have spoken to an authorized 108 / 112 operator and received verbal confirmation. MediNexus records your incident timestamp and coordinates to aid responders, but does not simulate fake dispatches.
                    </p>
                  </div>

                  <div style={{ marginTop: 18 }}>
                    <h4>Configured Emergency Contacts ({emergencyContacts.length})</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                      {emergencyContacts.map((c) => (
                        <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: 10, background: "#fcfaff", border: "1px solid #ebe5f5", borderRadius: 10 }}>
                          <div>
                            <b>{c.contact_name}</b> <small>({c.relationship})</small>
                            <div style={{ fontSize: 12, color: "#665882" }}>{c.phone}</div>
                          </div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <a href={`tel:${callOrTextNumber(c.phone)}`} className="button button-secondary button-small">{tamil ? "அழை" : "Call"}</a>
                            <a href={smsDraftHref(c.phone)} className="button button-primary button-small" title={tamil ? "விவரங்களுடன் SMS வரைவைத் திற" : "Open a prefilled SMS draft with incident details"}>{tamil ? "விவரங்களை அனுப்பு" : "Text details"}</a>
                          </div>
                        </div>
                      ))}
                      {!emergencyContacts.length && (
                        <button type="button" className="button button-secondary button-small" onClick={() => openPage("profile")}>
                          + Add Emergency Contacts
                        </button>
                      )}
                    </div>
                    <p style={{ marginTop: 10, fontSize: 11, color: "#766d86", lineHeight: 1.5 }}>{tamil ? "SMS உங்கள் தொலைபேசியில் வரைவு மட்டுமே. இந்தச் செயலி தானாக அழைக்கவோ செய்தி அனுப்பவோ இல்லை. விவரங்களைச் சொல்லும் குரல் உங்கள் சாதனத்தில் மட்டுமே கேட்கும்." : "Text details opens a draft in your messaging app; this site does not auto-call or send SMS. The spoken briefing plays on this device and is not transmitted into a phone call."}</p>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* PAGE: AI HEALTH ASSISTANT */}
          {page === "ai" && (
            <>
              <section className="page-heading ai-page-heading">
                <div>
                  <span className="eyebrow">{language === "ta" ? "மருத்துவமனை வழிகாட்டுதல் · CARE NAVIGATION" : "CARE NAVIGATION & WAYFINDING"}</span>
                  <h1>{language === "ta" ? "AI சுகாதார வழிகாட்டி" : "Your AI care guide"}</h1>
                  <p>{language === "ta" ? "மருத்துவமனைத் துறை, சந்திப்பு தயாரிப்பு, அல்லது செயலி வழிகாட்டுதலைக் கேளுங்கள். இது நோயறிதல் செய்யாது; அவசர சேவையைத் தொடர்புகொள்ளாது." : "Get help finding a hospital specialty, preparing for an appointment, or using MediNexus. This assistant cannot diagnose or contact emergency services."}</p>
                </div>
              </section>

              <div className="ai-chat-box">
                <div className="ai-chat-messages">
                  {aiMessages.length === 1 && (
                    <div className="ai-suggestions" aria-label="Suggested questions">
                      <span>{language === "ta" ? "தொடங்க ஒரு கேள்வியைத் தேர்ந்தெடுக்கவும்" : "Try asking"}</span>
                      {[
                        language === "ta" ? "இதய மருத்துவரைத் தேட உதவுங்கள்" : "Help me find a heart specialist",
                        language === "ta" ? "சந்திப்புக்கு என்ன எடுத்துச் செல்ல வேண்டும்?" : "What should I bring to an appointment?",
                        language === "ta" ? "இந்த செயலியைப் பயன்படுத்த வழிகாட்டுங்கள்" : "Guide me around this app",
                      ].map((suggestion) => (
                        <button key={suggestion} type="button" className="ai-suggestion-chip" onClick={() => setAiInput(suggestion)}>{suggestion}</button>
                      ))}
                    </div>
                  )}
                  {aiMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`chat-bubble ${msg.role === "user" ? "chat-user" : "chat-assistant"} ${msg.isEmergency ? "bubble-emergency" : ""}`}
                    >
                      <div style={{ whiteSpace: "pre-line" }}>{msg.text}</div>
                      {msg.role === "assistant" && <button type="button" className="button button-secondary button-small" style={{ marginTop: 8 }} onClick={() => speakAssistantMessage(assistantSpeechText(msg, language), language, setVoiceStatus)}>{language === "ta" ? "🔊 முழு வழிகாட்டுதலையும் கேளுங்கள்" : "🔊 Listen to full guidance"}</button>}
                      {msg.actionSteps?.length > 0 && (
                        <div className="ai-response-section">
                          <b>{language === "ta" ? "அடுத்த படிகள் · Next steps" : "Next steps"}</b>
                          <ol>{msg.actionSteps.map((step, i) => <li key={i}>{step}</li>)}</ol>
                        </div>
                      )}
                      {msg.specialty && (
                        <div style={{ marginTop: 10, padding: 10, background: "#f3edff", borderRadius: 8, fontSize: 13, color: "#5437a3" }}>
                          {language === "ta" ? "பரிந்துரைக்கப்படும் துறை · Recommended specialty:" : "Recommended specialty:"} <b>{msg.specialty}</b>
                        </div>
                      )}
                      {msg.hospitals && msg.hospitals.length > 0 && (
                        <div style={{ marginTop: 10, fontSize: 13 }}>
                          <b>{language === "ta" ? "பரிந்துரைக்கப்படும் மருத்துவமனைகள் · Suggested hospitals:" : "Suggested hospitals:"}</b>
                          <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                            {msg.hospitals.map((h, i) => (
                              <li key={i}>{h.name} ({h.city}) — Phone: {h.phone}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {msg.tips && msg.tips.length > 0 && (
                        <div style={{ marginTop: 10, fontSize: 12, color: "#615777" }}>
                          <b>{language === "ta" ? "தயாரிப்பு பட்டியல் · Preparation checklist:" : "Preparation checklist:"}</b>
                          <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                            {msg.tips.map((tip, i) => <li key={i}>{tip}</li>)}
                          </ul>
                        </div>
                      )}
                      {msg.disclaimer && (
                        <small style={{ display: "block", marginTop: 8, opacity: 0.8, fontSize: 11 }}>
                          ℹ {msg.disclaimer}
                        </small>
                      )}
                      {msg.followUpQuestion && <div className="ai-followup-question">{msg.followUpQuestion}</div>}
                      {msg.role === "assistant" && idx > 0 && (
                        <div className="ai-followup-actions" aria-label={language === "ta" ? "மேலும் உதவி" : "More help"}>
                          {[
                            [language === "ta" ? "அருகிலுள்ள மருத்துவமனை" : "Nearby hospitals", language === "ta" ? "என் அருகிலுள்ள மருத்துவமனையைக் கண்டுபிடிக்க உதவுங்கள்" : "Help me find a nearby hospital"],
                            [language === "ta" ? "சந்திப்புக்குத் தயாராக" : "Prepare for a visit", language === "ta" ? "மருத்துவ சந்திப்புக்கு என்னென்ன எடுத்துச் செல்ல வேண்டும்?" : "What should I bring to a medical appointment?"],
                            [language === "ta" ? "செயலியைப் பயன்படுத்த" : "Using the app", language === "ta" ? "இந்த செயலியில் மருத்துவமனை வரைபடத்தை எப்படிப் பயன்படுத்துவது?" : "How do I use the hospital map in this app?"],
                          ].map(([label, question]) => <button type="button" key={label} className="ai-suggestion-chip" onClick={() => setAiInput(question)}>{label}</button>)}
                        </div>
                      )}
                    </div>
                  ))}
                  {aiLoading && <div className="chat-bubble chat-assistant">{language === "ta" ? "பதில் தயாராகிறது…" : "Preparing a helpful answer…"}</div>}
                </div>

                <div className="ai-voice-status" aria-live="polite">{voiceStatus !== "Ready" ? voiceStatus : (language === "ta" ? "தமிழ் மற்றும் English குரல் கிடைப்பது உங்கள் சாதனத்தின் குரல் அமைப்பைப் பொறுத்தது." : "Voice playback uses the voices available on this device.")}</div>

                <form className="ai-chat-input-row" onSubmit={handleAiSend}>
                  <input
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder={language === "ta" ? "உங்கள் கேள்வியை தமிழில் அல்லது English-ல் எழுதுங்கள்…" : "Ask about a hospital, appointment, or how to use the app…"}
                  />
                  <button className="button button-primary" disabled={aiLoading || !aiInput.trim()}>
                    {language === "ta" ? "கேளுங்கள்" : "Ask guide"}
                  </button>
                </form>
              </div>
            </>
          )}

          {/* PAGE: ADMIN CONSOLE */}
          {page === "admin" && isAdmin && (
            <>
              <section className="page-heading">
                <div>
                  <span className="eyebrow">ADMINISTRATION & AUDIT</span>
                  <h1>Hospital Administrator Console</h1>
                  <p>Real record analytics, appointment verification, and tamper-evident audit logs.</p>
                </div>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => {
                    api("/admin/dashboard").then((d) => setAdminData(d));
                    setNotice("Admin dashboard refreshed.");
                  }}
                >
                  ↻ Refresh
                </button>
              </section>

              <section className="stats-grid">
                <article className="stat-card">
                  <div className="stat-number">{adminData?.totalHospitals || hospitals.length}</div>
                  <div className="stat-label">Hospitals in System</div>
                </article>
                <article className="stat-card">
                  <div className="stat-number">{adminData?.totalAppointments || appointments.length}</div>
                  <div className="stat-label">Total Appointments</div>
                </article>
                <article className="stat-card">
                  <div className="stat-number">{adminData?.pendingAppointments || 0}</div>
                  <div className="stat-label">Pending Approval</div>
                </article>
                <article className="stat-card">
                  <div className="stat-number">{adminData?.emergencyIncidentsCount || 0}</div>
                  <div className="stat-label">Emergency SOS Incidents</div>
                </article>
              </section>

              <section className="panel" style={{ marginTop: 20 }}>
                <h2>Appointment Requests Management</h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Patient ID</th>
                        <th>Hospital</th>
                        <th>Date & Time</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appointments.map((a) => (
                        <tr key={a.id}>
                          <td>{a.patient_id?.slice(0, 8) || "Patient"}</td>
                          <td>{a.hospitalName || "Hospital"}</td>
                          <td>{a.date} at {a.time}</td>
                          <td><StatusBadge value={a.status} /></td>
                          <td>
                            {a.status === "pending" && (
                              <div style={{ display: "flex", gap: 6 }}>
                                <button
                                  type="button"
                                  className="button button-primary button-small"
                                  onClick={async () => {
                                    await api(`/admin/appointments/${a.id}/status`, {
                                      method: "PATCH",
                                      body: JSON.stringify({ status: "confirmed" }),
                                    });
                                    void refreshAppointments();
                                    setNotice("Appointment confirmed.");
                                  }}
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  className="button button-danger button-small"
                                  onClick={async () => {
                                    await api(`/admin/appointments/${a.id}/status`, {
                                      method: "PATCH",
                                      body: JSON.stringify({ status: "cancelled" }),
                                    });
                                    void refreshAppointments();
                                    setNotice("Appointment declined.");
                                  }}
                                >
                                  Decline
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {adminData?.recentAuditLogs && (
                <section className="panel" style={{ marginTop: 20 }}>
                  <h2>Recent Security Audit Trail</h2>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Timestamp</th>
                          <th>Action</th>
                          <th>Resource</th>
                          <th>IP Address</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminData.recentAuditLogs.map((log) => (
                          <tr key={log.id}>
                            <td>{log.created_at?.slice(0, 19).replace("T", " ")}</td>
                            <td><b>{log.action}</b></td>
                            <td>{log.resource_type} ({log.resource_id?.slice(0, 8) || "—"})</td>
                            <td>{log.ip_address || "127.0.0.1"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}

          <footer className="app-footer">
            <span>© {new Date().getFullYear()} MediNexus One Connected Healthcare System</span>
            <span>Emergency Services: Dial 112 | Ambulance: Dial 108</span>
            <span>Tamil Nadu & India Verified Healthcare Infrastructure</span>
          </footer>
        </div>
      </main>
      {user && <FloatingCareAssistant language={language} onNavigate={openPage} />}
    </div>
  );
}
