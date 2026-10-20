import { useEffect, useRef, useState } from "react";
import { MessageCircle, Mic, Minimize2, Move, Send, Settings2, Volume2, VolumeX, X } from "lucide-react";
import { apiRequest } from "./api.js";
import { findVoice, speechParts } from "./lib/speech.js";
import "./FloatingCareAssistant.css";

const GREETING = {
  en: "Hi, I’m your MediNexus care guide. Ask me about hospitals, appointments, or how to use the app. I can’t diagnose or contact emergency services.",
  ta: "வணக்கம்! நான் MediNexus சுகாதார வழிகாட்டி. மருத்துவமனை, சந்திப்பு அல்லது இந்தச் செயலியைப் பயன்படுத்துவது பற்றி கேளுங்கள். என்னால் நோயைக் கண்டறியவோ அவசர சேவையை அழைக்கவோ முடியாது.",
};
const QUICK_QUESTIONS = {
  en: ["Open overview", "Find hospitals", "Open hospital map", "Open indoor guide", "Open appointments", "Doctor availability", "My care journey", "Medical records", "Open health profile", "Receipts and bills", "Open SOS help", "Read this page aloud"],
  ta: ["முகப்பைத் திறக்கவும்", "மருத்துவமனையைத் தேடுங்கள்", "மருத்துவமனை வரைபடம்", "உள் வழிகாட்டியைத் திறக்கவும்", "சந்திப்புகளைத் திறக்கவும்", "மருத்துவர் கிடைப்புத் தகவல்", "என் சிகிச்சைப் பயணம்", "மருத்துவப் பதிவுகள்", "சுகாதார விவரம்", "ரசீதுகள் மற்றும் கட்டணங்கள்", "அவசர உதவியைத் திறக்கவும்", "இந்தப் பக்கத்தைச் சத்தமாக வாசிக்கவும்"],
};

function speakText(text, language, setStatus, preferredVoiceURI = "") {
  if (!("speechSynthesis" in window) || !text) {
    setStatus(language === "ta" ? "இந்த உலாவியில் குரல் வாசிப்பு கிடைக்கவில்லை." : "Voice playback is not available in this browser.");
    return;
  }
  const parts = speechParts(text, language);
  if (!parts.length) {
    setStatus(language === "ta" ? "இந்தப் பதிலில் தமிழ் உரை இல்லை. தமிழில் கேள்வியை மீண்டும் கேளுங்கள்." : "No readable text in this reply.");
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const voices = synth.getVoices();
  const langTag = language === "ta" ? "ta-IN" : "en-IN";
  const voice = voices.find((item) => item.voiceURI === preferredVoiceURI && item.lang?.toLowerCase().startsWith(language === "ta" ? "ta" : "en")) || findVoice(voices, langTag);
  setStatus(language === "ta" && !voice
    ? "தமிழ் வாசிப்பை சாதனத்தின் இயல்புநிலை குரலில் முயற்சிக்கிறோம்…"
    : language === "ta" ? `தமிழ் குரல்: ${voice.name}` : `Voice: ${voice?.name || "device default"}`);
  let pending = parts.length;
  let hadError = false;
  parts.forEach((part) => {
    const utterance = new SpeechSynthesisUtterance(part.text);
    utterance.lang = part.lang;
    utterance.rate = 0.92;
    utterance.pitch = 1.02;
    utterance.voice = part.lang === langTag ? voice : findVoice(voices, part.lang);
    utterance.onend = () => {
      pending -= 1;
      if (!pending) setStatus(hadError
        ? (language === "ta" ? "குரல் வாசிப்பு தோல்வியடைந்தது. சாதனத்தில் தமிழ் பேச்சுக் குரல் உள்ளதா எனச் சரிபார்க்கவும்." : "Voice playback failed. Check the speech voices installed on this device.")
        : (language === "ta" && !voice ? "தமிழ் வாசிப்பு முயற்சி முடிந்தது. சரியான உச்சரிப்புக்கு சாதனத்தில் தமிழ் TTS குரலை நிறுவவும்." : language === "ta" ? "தமிழ் வழிகாட்டுதல் முடிந்தது." : "Finished speaking."));
    };
    utterance.onerror = () => {
      hadError = true;
      pending -= 1;
      if (!pending) setStatus(language === "ta" ? "குரல் வாசிப்பு தோல்வியடைந்தது. சாதனத்தில் தமிழ் பேச்சுக் குரல் உள்ளதா எனச் சரிபார்க்கவும்." : "Voice playback failed. Check the speech voices installed on this device.");
    };
    synth.speak(utterance);
  });
}

function getNavigationCommand(prompt) {
  const value = prompt.toLowerCase().trim();
  const says = (...terms) => terms.some((term) => value.includes(term));
  if (says("open home", "go home", "open overview", "open dashboard", "முகப்பைத் திற", "முகப்பு")) return "overview";
  if (says("open hospitals", "find hospitals", "show hospitals", "hospital directory", "மருத்துவமனையைத் தேட", "மருத்துவமனைகள்")) return "hospitals";
  if (says("open indoor", "indoor map", "inside hospital", "hospital indoor", "உள் வரைபட", "உள் வழிகாட்டி")) return "indoor";
  if (says("open map", "hospital map", "show directions", "open directions", "மருத்துவமனை வரைபட", "வரைபடத்தைத் திற", "வழித்தடம்")) return "maps";
  if (says("open appointments", "show appointments", "my appointments", "book appointment", "சந்திப்புகளைத் திற", "சந்திப்புகள்")) return "appointments";
  if (says("doctor availability", "doctor status", "open doctor status", "show doctor availability", "மருத்துவர் கிடைப்ப", "மருத்துவர் நிலை")) return "recovery";
  if (says("open my care journey", "care journey", "open journey", "சிகிச்சைப் பயணம்")) return "journey";
  if (says("open medical records", "show medical records", "my records", "மருத்துவப் பதிவுகள்")) return "records";
  if (says("open health profile", "open profile", "my profile", "சுகாதார விவரம்", "சுயவிவரத்தைத் திற")) return "profile";
  if (says("open receipts", "billing", "my bills", "ரசீதுகள்", "கட்டணங்கள்")) return "receipts";
  if (says("open sos", "open emergency", "sos page", "emergency page", "அவசர உதவியைத் திற")) return "emergency";
  if (says("open ai guide", "open assistant", "care assistant", "ai assistant", "ai guide", "உதவியாளரைத் திற")) return "ai";
  return null;
}
export default function FloatingCareAssistant({ language = "en", onNavigate }) {
  const tamil = language === "ta";
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [messages, setMessages] = useState([]);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [voiceChoices, setVoiceChoices] = useState({ en: "", ta: "" });
  const [showVoiceSettings, setShowVoiceSettings] = useState(true);
  const [position, setPosition] = useState(null);
  const panelRef = useRef(null);
  const listRef = useRef(null);
  const recognitionRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    const loadVoices = () => setAvailableVoices(window.speechSynthesis?.getVoices?.() || []);
    loadVoices();
    window.speechSynthesis?.addEventListener?.("voiceschanged", loadVoices);
    try {
      setVoiceChoices({ en: localStorage.getItem("medinexus-voice-en") || "", ta: localStorage.getItem("medinexus-voice-ta") || "" });
    } catch { /* Voice preference storage may be disabled by the browser. */ }
    return () => window.speechSynthesis?.removeEventListener?.("voiceschanged", loadVoices);
  }, []);
  useEffect(() => {
    const openVoiceSettings = () => { setOpen(true); setShowVoiceSettings(true); };
    window.addEventListener("medinexus:voice-settings", openVoiceSettings);
    return () => window.removeEventListener("medinexus:voice-settings", openVoiceSettings);
  }, []);
  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, busy]);

  useEffect(() => () => {
    recognitionRef.current?.stop?.();
    window.speechSynthesis?.cancel?.();
  }, []);

  const play = (text) => speakText(text, language, setVoiceStatus, voiceChoices[language === "ta" ? "ta" : "en"]);
  const setVoiceChoice = (key, value) => {
    setVoiceChoices((current) => ({ ...current, [key]: value }));
    try { localStorage.setItem(`medinexus-voice-${key}`, value); } catch { /* Keep the selection for this session. */ }
  };

  const previewVoice = (key) => {
    const greeting = key === "ta" ? GREETING.ta : GREETING.en;
    speakText(greeting, key, setVoiceStatus, voiceChoices[key]);
  };

  async function sendQuestion(question = input, { fromVoice = false } = {}) {
    const prompt = question.trim();
    if (!prompt || busy) return;
    setInput("");
    setMessages((current) => [...current, { role: "user", text: prompt }]);
    if (prompt.toLowerCase().includes("read this page aloud") || prompt.includes("இந்தப் பக்கத்தைச் சத்தமாக வாசி")) {
      const page = document.querySelector(".main-content");
      const readable = page?.cloneNode(true);
      readable?.querySelectorAll("button,input,select,textarea,iframe,svg,script,style,[aria-hidden='true']").forEach((element) => element.remove());
      const pageText = readable?.innerText?.replace(/\s+/g, " ").trim().slice(0, 1100);
      const reply = pageText || (tamil ? "இந்தப் பக்கத்தில் வாசிக்கக்கூடிய உரை இல்லை." : "There is no readable page text here.");
      setMessages((current) => [...current, { role: "assistant", text: reply }]);
      window.setTimeout(() => play(reply), 120);
      return;
    }
    const navigationTarget = getNavigationCommand(prompt);
    if (navigationTarget) {
      onNavigate?.(navigationTarget);
      const routeName = tamil ? ({ overview: "முகப்பு", hospitals: "மருத்துவமனைகள்", maps: "மருத்துவமனை வரைபடம்", indoor: "உள் வரைபடம்", appointments: "சந்திப்புகள்", recovery: "மருத்துவர் கிடைப்புத் தகவல்", journey: "சிகிச்சைப் பயணம்", records: "மருத்துவப் பதிவுகள்", profile: "சுகாதார விவரம்", receipts: "ரசீதுகள்", emergency: "அவசர உதவி", ai: "AI உதவியாளர்" }[navigationTarget]) : (navigationTarget === "recovery" ? "doctor availability" : navigationTarget);
      const reply = tamil ? `சரி, ${routeName} பக்கத்தைத் திறக்கிறேன்.` : `Okay, opening ${routeName}.`;
      setMessages((current) => [...current, { role: "assistant", text: reply }]);
      setVoiceStatus(reply);
      // Speak quick-choice and typed-navigation confirmations too, not only microphone commands.
      window.setTimeout(() => play(reply), 120);
      return;
    }
    setBusy(true);
    try {
      const result = await apiRequest("/ai/navigate", {
        method: "POST",
        body: JSON.stringify({ prompt, language }),
      });
      const text = result.response || result.message || (tamil ? "மன்னிக்கவும், பதில் கிடைக்கவில்லை." : "Sorry, no answer was returned.");
      const assistantMessage = {
        role: "assistant",
        text,
        specialty: result.recommendedSpecialty,
        hospitals: result.suggestedHospitals || [],
        followUpQuestion: result.followUpQuestion,
        isEmergency: result.isEmergency,
        emergencyNumber: result.emergencyNumber,
      };
      setMessages((current) => [...current, assistantMessage]);
      setVoiceStatus(fromVoice ? (tamil ? "பதில் குரலில் வாசிக்கப்படுகிறது…" : "Speaking the answer…") : (tamil ? "பதில் தயார். தமிழில் கேட்க ஒலி பொத்தானைத் தொடுங்கள்." : "Reply ready. Tap Listen to hear it."));
      if (fromVoice) window.setTimeout(() => play(text), 120);
    } catch (error) {
      const text = tamil
        ? `உதவியாளரை இப்போது அணுக முடியவில்லை. ${error.message || "பின்னர் மீண்டும் முயற்சிக்கவும்."}`
        : `The care guide is unavailable right now. ${error.message || "Please try again."}`;
      setMessages((current) => [...current, { role: "assistant", text }]);
    } finally {
      setBusy(false);
    }
  }

  function toggleMicrophone() {
    if (listening) {
      recognitionRef.current?.stop?.();
      setListening(false);
      return;
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceStatus(tamil ? "இந்த உலாவியில் குரல் உள்ளீடு இல்லை. கேள்வியைத் தட்டச்சு செய்யுங்கள்." : "Speech input is unavailable in this browser. Type your question instead.");
      return;
    }
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = tamil ? "ta-IN" : "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => { setListening(true); setVoiceStatus(tamil ? "கேட்கிறது… இப்போது பேசுங்கள்." : "Listening… speak now."); };
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      setInput((current) => current ? `${current} ${transcript}` : transcript);
      if (transcript) {
        setInput(transcript);
        setVoiceStatus(tamil ? "கேள்வி அனுப்பப்படுகிறது…" : "Sending your spoken question…");
        void sendQuestion(transcript, { fromVoice: true });
      }
    };
    recognition.onerror = () => setVoiceStatus(tamil ? "ஒலிவாங்கி வேலை செய்யவில்லை. கேள்வியைத் தட்டச்சு செய்யுங்கள்." : "Microphone input failed. Type your question instead.");
    recognition.onend = () => setListening(false);
    try { recognition.start(); } catch { setListening(false); }
  }

  function startDrag(event) {
    if (event.target.closest("button")) return;
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    setPosition({ left: rect.left, top: rect.top });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function moveDrag(event) {
    if (!dragRef.current || !panelRef.current) return;
    const { x, y, left, top } = dragRef.current;
    const rect = panelRef.current.getBoundingClientRect();
    setPosition({
      left: Math.max(8, Math.min(window.innerWidth - rect.width - 8, left + event.clientX - x)),
      top: Math.max(8, Math.min(window.innerHeight - rect.height - 8, top + event.clientY - y)),
    });
  }

  const style = position ? { left: position.left, top: position.top, right: "auto", bottom: "auto" } : undefined;
  return (
    <div className="floating-care-assistant">
      {open && (
        <section className="care-widget-panel" ref={panelRef} style={style} aria-label={tamil ? "சுகாதார வழிகாட்டி" : "MediNexus care guide"}>
          <header className="care-widget-header" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }}>
            <div className="care-widget-heading"><span className="care-widget-avatar"><MessageCircle size={18} /></span><div><b>{tamil ? "MediNexus வழிகாட்டி" : "MediNexus care guide"}</b><small>{tamil ? "குரல் மற்றும் உரையாடல் உதவி" : "Chat and voice help"}</small></div></div>
            <span className="care-widget-header-actions"><Move size={15} aria-hidden="true" /><button type="button" className="care-widget-voice-toggle" onClick={() => setShowVoiceSettings((visible) => !visible)} aria-expanded={showVoiceSettings} aria-label={tamil ? "குரல் அமைப்புகள்" : "Voice settings"}><Settings2 size={16} /><span>{tamil ? "குரல் அமைப்புகள்" : "Voice settings"}</span></button><button type="button" onClick={() => setOpen(false)} aria-label={tamil ? "மூடு" : "Close assistant"}><Minimize2 size={17} /></button></span>
          </header>
          {showVoiceSettings && <div className="care-widget-voice-settings">
            <b>{tamil ? "குரல் தேர்வு" : "Voice settings"}</b>
            <p className="care-widget-voice-scope">{tamil ? "இந்தச் சாதனத்தில் AI வழிகாட்டி, SOS, மருத்துவமனை வரைபடம் மற்றும் உள் வழிகாட்டிக்கு பொருந்தும்." : "Applies on this device to the AI guide, SOS, hospital maps, and indoor guide."}</p>
            {[{ key: "en", label: "English voice", locale: "en" }, { key: "ta", label: "Tamil voice", locale: "ta" }].map(({ key, label, locale }) => {
              const choices = availableVoices.filter((voice) => voice.lang?.toLowerCase().startsWith(locale));
              const selectedVoice = choices.some((voice) => voice.voiceURI === voiceChoices[key]) ? voiceChoices[key] : "";
              return <label key={key}><span>{tamil ? (key === "ta" ? "தமிழ் குரல்" : "ஆங்கிலக் குரல்") : label}<span className="care-widget-voice-controls"><select value={selectedVoice} onChange={(event) => setVoiceChoice(key, event.target.value)}><option value="">{tamil ? "தானாகத் தேர்வு செய்" : "Automatic / recommended"}</option>{choices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} · {voice.lang}</option>)}</select><button type="button" onClick={() => previewVoice(key)} disabled={!choices.length} aria-label={tamil ? (key === "ta" ? "தமிழ் குரலைச் சோதிக்கவும்" : "ஆங்கிலக் குரலைச் சோதிக்கவும்") : (key === "ta" ? "Preview Tamil voice" : "Preview English voice")}>{tamil ? "சோதிக்க" : "Preview"}</button></span>{key === "ta" && !choices.length && <small>{tamil ? "இந்த உலாவியில் தமிழ் குரல் இல்லை; ஆங்கிலக் குரல் தமிழுக்கு பயன்படுத்தப்படாது. Windows அமைப்புகளில் தமிழ் பேச்சுக் குரலை நிறுவி பக்கத்தைப் புதுப்பிக்கவும்." : "No Tamil voice is exposed by this browser. English voices are not used for Tamil. Install a Tamil speech voice in Windows settings, then refresh this page."}</small>}</span></label>;
            })}
          </div>}
          <div className="care-widget-messages" ref={listRef} aria-live="polite">
            {!messages.length && <div className="care-widget-greeting"><p>{GREETING[language === "ta" ? "ta" : "en"]}</p><button type="button" className="care-widget-speak" onClick={() => play(GREETING[language === "ta" ? "ta" : "en"])}><Volume2 size={15} /> {tamil ? "வழிகாட்டுதலைக் கேளுங்கள்" : "Hear greeting"}</button></div>}
            {!messages.length && <div className="care-widget-quick"><span>{tamil ? "இதில் ஒன்றைக் கேளுங்கள்" : "Try asking"}</span>{QUICK_QUESTIONS[language === "ta" ? "ta" : "en"].map((question) => <button type="button" key={question} onClick={() => void sendQuestion(question)}>{question}</button>)}</div>}
            {messages.map((message, index) => (
              <article className={`care-widget-message ${message.role === "user" ? "is-user" : "is-assistant"}`} key={`${message.role}-${index}`}>
                <p>{message.text}</p>
                {message.specialty && <p className="care-widget-extra"><b>{tamil ? "பரிந்துரைக்கப்படும் துறை:" : "Suggested specialty:"}</b> {message.specialty}</p>}
                {!!message.hospitals?.length && <ul>{message.hospitals.slice(0, 3).map((hospital, i) => <li key={`${hospital.name}-${i}`}>{hospital.name}{hospital.city ? ` · ${hospital.city}` : ""}</li>)}</ul>}
                {message.followUpQuestion && <p className="care-widget-extra">{message.followUpQuestion}</p>}
                {message.isEmergency && <div className="care-widget-emergency-actions">{message.emergencyNumber ? <a href={`tel:${message.emergencyNumber}`}>{tamil ? `${message.emergencyNumber}-ஐ அழைக்கவும்` : `Call ${message.emergencyNumber} now`}</a> : <><a href="tel:112">{tamil ? "112 அவசர உதவி" : "Call 112"}</a><a href="tel:108">{tamil ? "108 ஆம்புலன்ஸ்" : "Call 108 ambulance"}</a></>}</div>}
                {message.role === "assistant" && <button type="button" className="care-widget-speak" onClick={() => play(message.text)}><Volume2 size={15} /> {tamil ? "தமிழில் கேளுங்கள்" : "Listen"}</button>}
              </article>
            ))}
            {busy && <div className="care-widget-thinking">{tamil ? "வழிகாட்டி பதிலளிக்கிறது…" : "The guide is responding…"}</div>}
          </div>
          {voiceStatus && <div className="care-widget-status" role="status">{voiceStatus}</div>}
          <form className="care-widget-composer" onSubmit={(event) => { event.preventDefault(); void sendQuestion(); }}>
            <button type="button" className={`care-widget-icon ${listening ? "is-listening" : ""}`} onClick={toggleMicrophone} aria-label={listening ? (tamil ? "ஒலிவாங்கியை நிறுத்து" : "Stop microphone") : (tamil ? "குரல் கேள்வி" : "Ask by voice")}><Mic size={18} /></button>
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={tamil ? "தமிழில் அல்லது English-ல் கேளுங்கள்…" : "Ask about hospitals or appointments…"} aria-label={tamil ? "உங்கள் கேள்வி" : "Your question"} />
            <button type="submit" className="care-widget-send" disabled={busy || !input.trim()} aria-label={tamil ? "அனுப்பு" : "Send question"}><Send size={17} /></button>
          </form>
          <div className="care-widget-footer"><span>{tamil ? "மருத்துவ நோயறிதல் அல்ல · அவசரநிலையில் 112 அழைக்கவும்" : "Navigation only, not a diagnosis · Call 112 in an emergency"}</span><button type="button" onClick={() => { window.speechSynthesis?.cancel?.(); setVoiceStatus(tamil ? "குரல் நிறுத்தப்பட்டது." : "Speech stopped."); }} aria-label={tamil ? "குரலை நிறுத்து" : "Stop speech"}><VolumeX size={15} /></button></div>
        </section>
      )}
      <button type="button" className={`care-widget-launcher ${open ? "is-open" : ""}`} onClick={() => { const next = !open; setOpen(next); if (next && !messages.length) window.setTimeout(() => play(GREETING[language === "ta" ? "ta" : "en"]), 120); }} aria-label={open ? (tamil ? "வழிகாட்டியை மூடு" : "Close care guide") : (tamil ? "சுகாதார வழிகாட்டியைத் திற" : "Open care guide")}>
        {open ? <X size={22} /> : <><MessageCircle size={21} /><span>{tamil ? "உதவி" : "Care guide"}</span></>}
      </button>
    </div>
  );
}
