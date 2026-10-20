import { Router } from "express";
import { db } from "../lib/db.js";

const router = Router();

const EMERGENCY_KEYWORDS = [
  "chest pain", "heart attack", "can't breathe", "cannot breathe", "choking",
  "severe bleeding", "unconscious", "stroke", "paralysis", "seizure",
  "head injury", "crushed", "poison", "overdose", "accident",
  "மார்பு வலி", "மூச்சு விட முடியவில்லை", "மூச்சுத்திணறல்", "அதிக ரத்தப்போக்கு",
  "மயக்கம்", "பக்கவாதம்", "வலிப்பு", "விபத்து", "விஷம்"
];

function checkIsEmergency(prompt) {
  const lower = prompt.toLowerCase();
  return EMERGENCY_KEYWORDS.some((kw) => lower.includes(kw)) || /(?:call|dial|phone|ring|அழை|தொடர்பு)\s*(?:the\s*)?(?:ambulance|emergency|108|112)|(?:108|112)\s*(?:க்கு|ஐ)?\s*(?:அழை|அழைக்க|call|dial)/i.test(lower);
}

// Fallback clinical navigation rules engine
function generateClinicalNavigationResponse(prompt, hospitals = [], language = "en") {
  const lower = prompt.toLowerCase();
  const isEmergency = checkIsEmergency(prompt);
  const requestedEmergencyNumber = lower.match(/(?:call|dial|phone|ring|அழை|தொடர்பு)\s*(?:the\s*)?(108|112)|\b(108|112)\b\s*(?:க்கு|ஐ)?\s*(?:அழை|அழைக்க|call|dial)/i);
  const emergencyNumber = requestedEmergencyNumber?.[1] || requestedEmergencyNumber?.[2] || null;

  if (isEmergency) {
    return {
      isEmergency: true,
      triageLevel: "IMMEDIATE_EMERGENCY",
      message: emergencyNumber
        ? (language === "ta"
          ? `உதவி தேவைப்பட்டால், இப்போது ${emergencyNumber}-ஐ அழைக்கவும். இந்தச் செயலி தானாக அழைக்காது; கீழே உள்ள அழைப்பு பொத்தானைத் தொடுங்கள்.`
          : `If you need emergency help, call ${emergencyNumber} now using the button below. This app will not place the call automatically.`)
        : (language === "ta"
          ? "தமிழ்: ⚠️ அவசர எச்சரிக்கை: இது உயிருக்கு ஆபத்தான நிலையாக இருக்கலாம். சந்திப்புக்காகக் காத்திருக்க வேண்டாம். இந்தியாவில் 112 அல்லது 108-ஐ உடனே அழைக்கவும்.\n\nEnglish: This may be life-threatening. Do not wait for an appointment. Call 112 or 108 in India now."
          : "⚠️ CRITICAL SAFETY NOTICE: This may be life-threatening. Do not wait for appointment scheduling. Call 112 or 108 in India now."),
      emergencyNumber,
      actionSteps: [
        ...(language === "ta" ? [
          "தமிழ்: உடனே 112 (அவசர உதவி) அல்லது 108 (ஆம்புலன்ஸ்) அழைக்கவும். | English: Call 112 or 108 now.",
          "தமிழ்: தனியாக இருந்தால் கதவைத் திறந்து வைத்து தொலைபேசியை அருகில் வைத்திருங்கள். | English: If alone, unlock the door and keep your phone nearby.",
          "தமிழ்: மயக்கம், மார்பு அழுத்தம் அல்லது மூச்சுத்திணறல் இருந்தால் நீங்களே வாகனம் ஓட்ட வேண்டாம். | English: Do not drive yourself if dizzy, breathless, or having chest pressure."
        ] : [
          "Dial 112 (Emergency Services) or 108 (Ambulance) immediately.",
          "If you are alone, unlock your front door and keep your phone close.",
          "Do not drive yourself if experiencing dizziness, chest pressure, or shortness of breath."
        ])
      ],
      followUpQuestion: language === "ta"
        ? "தமிழ்: இப்போது 112/108-ஐ அழைக்க முடியுமா? | English: Can you call 112/108 now?"
        : "Can you call 112 or 108 now?",
      recommendedSpecialty: "Trauma & Emergency Medicine",
      suggestedHospitals: hospitals.slice(0, 2).map((h) => ({
        name: h.name,
        emergencyPhone: h.emergencyPhone || "112",
        address: h.address,
        city: h.city
      })),
      disclaimer: language === "ta"
        ? "தமிழ்: MediNexus AI மருத்துவர் அல்ல. அவசரநிலையில் 112-ஐ அழைக்கவும். | English: MediNexus AI is not a doctor. Call 112 in an emergency."
        : "MediNexus One AI is a healthcare navigation assistant, not a medical practitioner. For emergencies, contact 112 immediately."
    };
  }

  // Specialty mapping
  let specialty = "General Medicine";
  let guidance = language === "ta"
    ? "தமிழ்: சரியான மருத்துவமனைத் துறையைத் தேர்ந்தெடுத்து சந்திப்புக்குத் தயாராக உதவுகிறேன். உங்கள் முக்கியக் கவலை, அது எத்தனை நாட்களாக உள்ளது, வயது வரம்பு, அருகிலுள்ள நகரம் ஆகியவற்றைப் பகிருங்கள். முழுப் பெயர் அல்லது அடையாளத் தகவல் தேவையில்லை.\n\nEnglish: I can help you choose a hospital specialty and prepare for a visit. Share your main concern, how long it has been happening, your age range, and nearby city. Do not include your full name or identifying details."
    : "I can help you choose a hospital specialty and prepare for a visit. Share your main concern, how long it has been happening, your age range, and nearby city. Do not include your full name or identifying details.";

  if (lower.includes("heart") || lower.includes("bp") || lower.includes("blood pressure") || lower.includes("palpitation")) {
    specialty = "Cardiology & Cardio-Thoracic Surgery";
    guidance = language === "ta" ? "தமிழ்: இதயம், உயர் இரத்த அழுத்தம் அல்லது இதயத் துடிப்பு குறித்த கவலைகளுக்கு இதயநோய் நிபுணரை அணுகுங்கள். சமீபத்திய ECG அல்லது கொழுப்பு பரிசோதனை அறிக்கைகளை எடுத்துச் செல்லுங்கள்.\n\nEnglish: For heart concerns, high blood pressure, or palpitations, consult a cardiologist. Bring recent ECG or lipid reports." : "For heart health concerns, high blood pressure, or palpitations, we recommend consulting a Cardiologist. Bring recent ECGs or lipid reports.";
  } else if (lower.includes("bone") || lower.includes("knee") || lower.includes("fracture") || lower.includes("joint") || lower.includes("back pain")) {
    specialty = "Orthopaedics & Joint Replacement";
    guidance = language === "ta" ? "தமிழ்: எலும்பு, மூட்டு, முழங்கால் அல்லது முதுகுத்தண்டு பிரச்சினைகளுக்கு எலும்பியல் நிபுணரை அணுகுங்கள். இருந்தால் பழைய X-ray அல்லது MRI படங்களை எடுத்துச் செல்லுங்கள்.\n\nEnglish: For bone, joint, knee, or spine concerns, consult an orthopaedic specialist. Bring previous X-rays or MRI scans if available." : "For bone, joint, knee, or spinal concerns, consult an Orthopaedic surgeon. Bring prior X-rays or MRI scans if available.";
  } else if (lower.includes("headache") || lower.includes("migraine") || lower.includes("nerve") || lower.includes("dizziness") || lower.includes("numbness")) {
    specialty = "Neurology & Neurosurgery";
    guidance = language === "ta" ? "தமிழ்: நீடித்த நரம்பியல் பிரச்சினைகள், மீண்டும் வரும் ஒற்றைத்தலைவலி அல்லது காரணமற்ற உணர்வின்மைக்கு நரம்பியல் நிபுணரை அணுகுங்கள்.\n\nEnglish: For ongoing neurological concerns, recurring migraine, or unexplained numbness, consult a neurologist." : "For chronic neurological issues, recurrent migraines, or unexplained numbness, consult a Neurologist.";
  } else if (lower.includes("stomach") || lower.includes("digest") || lower.includes("acidity") || lower.includes("liver") || lower.includes("gastric")) {
    specialty = "Gastroenterology";
    guidance = language === "ta" ? "தமிழ்: நீடித்த செரிமானக் கோளாறு, அமிலத்தன்மை அல்லது கல்லீரல் தொடர்பான கேள்விகளுக்கு குடலியல் நிபுணரை அணுகுங்கள்.\n\nEnglish: For ongoing digestive discomfort, acid reflux, or liver concerns, consult a gastroenterologist." : "For chronic digestive discomfort, acid reflux, or liver function inquiries, consult a Gastroenterologist.";
  } else if (lower.includes("child") || lower.includes("baby") || lower.includes("infant") || lower.includes("fever") && lower.includes("kid")) {
    specialty = "Paediatrics & Neonatology";
    guidance = language === "ta" ? "தமிழ்: குழந்தைகளின் உடல்நலம் மற்றும் தடுப்பூசிகளுக்கு குழந்தை நல மருத்துவரை அணுகுங்கள்.\n\nEnglish: For a child's health or vaccinations, consult a paediatric specialist." : "For pediatric health and vaccinations, consult a Paediatric specialist.";
  }

  // Find matching hospitals offering this specialty
  const matchedHospitals = hospitals.filter((h) =>
    (h.specialties || []).some((s) => s.toLowerCase().includes(specialty.toLowerCase()))
  );

  const displayHospitals = (matchedHospitals.length > 0 ? matchedHospitals : hospitals).slice(0, 3).map((h) => ({
    name: h.name,
    city: h.city,
    phone: h.phone,
    address: h.address,
    specialties: h.specialties
  }));

  return {
    isEmergency: false,
    triageLevel: "ELECTIVE_CONSULTATION",
    message: guidance,
    recommendedSpecialty: specialty,
    suggestedHospitals: displayHospitals,
    preparationTips: language === "ta" ? [
      "தமிழ்: பழைய மருந்துச் சீட்டுகள், ஆய்வக அறிக்கைகள், ஸ்கேன் அறிக்கைகள் இருந்தால் எடுத்துச் செல்லுங்கள். | English: Bring previous prescriptions, lab reports, or scan reports if available.",
      "தமிழ்: தற்போது எடுத்துக்கொள்ளும் மருந்துகள் மற்றும் தெரிந்த ஒவ்வாமைகளைப் பட்டியலிடுங்கள். | English: List current medicines and known allergies.",
      "தமிழ்: பதிவு செய்ய சந்திப்பு நேரத்திற்கு 15–20 நிமிடங்கள் முன்பாகச் செல்லுங்கள். | English: Arrive 15–20 minutes early for registration."
    ] : [
      "Carry previous medical prescriptions, lab reports, and imaging reports if available.",
      "List current medicines and known allergies.",
      "Arrive 15–20 minutes before your scheduled slot for registration."
    ],
    actionSteps: language === "ta" ? [
      "தமிழ்: திடீர் மார்பு வலி, கடுமையான மூச்சுத்திணறல், மயக்கம், பக்கவாத அறிகுறி அல்லது அதிக ரத்தப்போக்கு இருந்தால் காத்திருக்க வேண்டாம்; 112/108-ஐ அழைக்கவும். | English: If you have sudden chest pain, severe breathing trouble, fainting, stroke signs, or heavy bleeding, do not wait; call 112/108.",
      "தமிழ்: அவசர அறிகுறிகள் இல்லையெனில், அருகிலுள்ள மருத்துவமனையைத் தேர்ந்தெடுத்து அதன் நேரம் மற்றும் சேவையை நேரடியாக உறுதிப்படுத்துங்கள். | English: If there are no emergency signs, choose a nearby hospital and confirm its hours and services directly."
    ] : [
      "If there is sudden chest pain, severe breathing trouble, fainting, stroke signs, or heavy bleeding, do not wait; call 112/108.",
      "Otherwise, choose a nearby hospital and confirm its hours and services directly."
    ],
    followUpQuestion: language === "ta"
      ? "தமிழ்: எந்த உதவி வேண்டும்—மருத்துவத் துறை பரிந்துரை, அருகிலுள்ள மருத்துவமனை, அல்லது சந்திப்புத் தயாரிப்பா? | English: What would help next: a specialty suggestion, a nearby hospital, or appointment preparation?"
      : "What would help next: a specialty suggestion, a nearby hospital, or appointment preparation?",
    disclaimer: language === "ta"
      ? "தமிழ்: MediNexus AI வழிகாட்டி மட்டுமே; மருத்துவர் அல்ல, நோயறிதல் செய்யாது. | English: MediNexus AI provides navigation guidance only; it is not a doctor and does not diagnose."
      : "MediNexus One AI provides navigation guidance only; it is not a doctor and does not diagnose."
  };
}

// POST /api/ai/navigate
router.post("/navigate", async (req, res, next) => {
  try {
    const { prompt = "", language = "en" } = req.body;

    if (!prompt.trim()) {
      return res.status(400).json({ error: "ValidationError", message: "Please provide a query or symptom description." });
    }

    const hospitals = await db.getHospitals();
    const isEmergency = checkIsEmergency(prompt);

    // If Gemini API key is configured, use it with strict clinical system instructions
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && !isEmergency) {
      try {
        const systemPrompt = `You are MediNexus One's AI Healthcare Navigation Assistant.
Your sole mission is hospital wayfinding, specialty recommendation, and visit preparation.
Strict Rules:
1. You are NOT a doctor and cannot diagnose, prescribe, or treat. Always include a brief medical disclaimer.
2. If the user describes emergency symptoms (e.g., severe chest pain, stroke, heavy bleeding), tell them to call 112 / 108 immediately.
3. Keep answers concise, empathetic, accessible, and structured with recommended specialty and what to prepare.
Answer with: (1) a direct helpful response, (2) the most relevant specialty and why, (3) safe next steps, (4) what to bring, and (5) one short follow-up question only if it would improve guidance. Never diagnose, prescribe, invent hospital availability, or ask for a full name/address. For Tamil, provide natural Tamil script first under 'தமிழ்:' and concise English second under 'English:'. Do not transliterate English into Tamil. Keep hospital names, phone numbers, and specialty names accurate.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              { role: "user", parts: [{ text: `${systemPrompt}\n\nPatient Query: ${prompt}` }] }
            ],
            generationConfig: { maxOutputTokens: 600, temperature: 0.2 }
          })
        });

        if (response.ok) {
          const result = await response.json();
          const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            return res.json({
              status: "success",
              provider: "Google Gemini",
              isEmergency: false,
              response: text,
              suggestedHospitals: hospitals.slice(0, 3).map((h) => ({ name: h.name, city: h.city, phone: h.phone })),
              disclaimer: "MediNexus One AI is a navigation assistant, not a doctor. Consult a licensed physician for diagnosis."
            });
          }
        }
      } catch (geminiError) {
        console.warn("[AI] Gemini API call failed, falling back to clinical rules engine:", geminiError.message);
      }
    }

    // Default to basic care navigation rules when no AI provider is configured.
    const guidance = generateClinicalNavigationResponse(prompt, hospitals, language);
    res.json({
      status: "success",
      provider: "MediNexus Clinical Navigation Engine",
      ...guidance
    });
  } catch (err) {
    next(err);
  }
});

export default router;
