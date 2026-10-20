
import { useEffect, useState } from "react";
import {
  Activity, LayoutDashboard, MapPinned, CalendarDays, ReceiptText,
  Siren, Hospital, Settings, Search, Bell, ChevronRight, Clock3,
  ShieldCheck, ArrowUpRight, Menu, X, HeartPulse, Navigation,
  Eye, EyeOff, LogOut, Languages, UserRound, LockKeyhole,
  Volume2, VolumeX, CheckCircle2, AlertTriangle, Map, Phone,
  Printer, ExternalLink, RefreshCw, UserCheck, FileText
} from "lucide-react";
import "./App.css";

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Hospital Navigation", icon: MapPinned },
  { label: "Appointments", icon: CalendarDays },
  { label: "Receipts & Bills", icon: ReceiptText },
  { label: "Emergency SOS", icon: Siren },
  { label: "Hospitals", icon: Hospital },
  { label: "Administration", icon: Settings },
];

const languages = {
  en: {
    name: "English",
    welcome: "Welcome back",
    signIn: "Sign in to your healthcare workspace.",
    email: "Email address",
    password: "Password",
    login: "Sign in",
    register: "Create account",
    fullName: "Full name",
    noAccount: "New to MediNexus One?",
    haveAccount: "Already have an account?",
    chooseLanguage: "Choose your language",
    invalid: "Enter a valid email and a password of at least 6 characters.",
    demo: "Demo mode only. No real account is created.",
    subtitle: "Your connected healthcare workspace.",
    overview: "Workspace overview",
    navigation: "Hospital Navigation",
    appointments: "Appointments",
    bills: "Receipts & Bills",
    emergency: "Emergency SOS",
    hospitals: "Hospitals",
    administration: "Administration",
    search: "Search this workspace...",
    back: "Back to overview",
    voice: "Play voice guidance",
    mute: "Mute voice",
    enableVoice: "Enable voice",
    demoWarning: "Prototype data only. Hospital records, doctor availability, payments and bookings are not connected to a live healthcare system.",
    doctorUnavailable: "Your scheduled doctor may be unavailable or delayed. Would you like to review other suitable doctors at this hospital?",
    delayed: "Doctor delayed",
    unavailable: "Doctor unavailable",
    emergencyDoctor: "Doctor handling an emergency",
    sameHospital: "Other doctors at this hospital",
    chooseDoctor: "Select a sample doctor",
    confirm: "Confirm demo selection",
    notBooked: "This is only a local demo selection. No real appointment has been booked.",
    indoor: "Indoor hospital guidance",
    indoorFallback: "A verified indoor floor plan is not connected. Please ask the hospital reception desk for directions.",
    alternatives: "Find alternative hospitals",
    route: "Find directions",
    noLive: "Live availability is not connected.",
    patient: "Patient journey",
    trust: "Trust and safety",
    receiptWarning: "Sample receipt only — not proof of payment.",
    amount: "Sample amount",
    paymentStatus: "Payment status",
    unpaid: "Not verified",
    emergencyWarning: "This prototype cannot detect a crash, dispatch help, or verify that an emergency call connected.",
    call108: "Open phone dialler for 108",
    callContact: "Call saved emergency contact",
    noContact: "No emergency contact is configured.",
    admin: "System readiness",
    save: "Save demo settings",
    saved: "Demo settings saved in this session.",
    status: "Prototype",
  },
  ta: {
    name: "தமிழ்",
    welcome: "மீண்டும் வரவேற்கிறோம்",
    signIn: "உங்கள் மருத்துவப் பணியிடத்தில் உள்நுழையவும்.",
    email: "மின்னஞ்சல் முகவரி",
    password: "கடவுச்சொல்",
    login: "உள்நுழைக",
    register: "கணக்கை உருவாக்கு",
    fullName: "முழுப் பெயர்",
    noAccount: "MediNexus One-க்கு புதியவரா?",
    haveAccount: "ஏற்கனவே கணக்கு உள்ளதா?",
    chooseLanguage: "மொழியைத் தேர்ந்தெடுக்கவும்",
    invalid: "சரியான மின்னஞ்சல் மற்றும் குறைந்தது 6 எழுத்துகள் கொண்ட கடவுச்சொல்லை உள்ளிடவும்.",
    demo: "மாதிரி முறை மட்டுமே. உண்மையான கணக்கு உருவாக்கப்படாது.",
    subtitle: "உங்கள் ஒருங்கிணைந்த மருத்துவப் பணியிடம்.",
    overview: "பணியிட மேலோட்டம்",
    navigation: "மருத்துவமனை வழிகாட்டல்",
    appointments: "சந்திப்புகள்",
    bills: "ரசீதுகள் மற்றும் கட்டணங்கள்",
    emergency: "அவசர உதவி",
    hospitals: "மருத்துவமனைகள்",
    administration: "நிர்வாகம்",
    search: "தேடவும்...",
    back: "மேலோட்டத்திற்குத் திரும்பு",
    voice: "குரல் வழிகாட்டலை இயக்கவும்",
    mute: "குரலை நிறுத்து",
    enableVoice: "குரலை இயக்கு",
    demoWarning: "இது மாதிரி தரவு மட்டுமே. உண்மையான மருத்துவமனை, மருத்துவர், கட்டணம் அல்லது முன்பதிவு தரவு இணைக்கப்படவில்லை.",
    doctorUnavailable: "உங்கள் மருத்துவர் தற்போது கிடைக்காமல் அல்லது தாமதமாக இருக்கலாம். இதே மருத்துவமனையில் வேறு மருத்துவரைப் பார்க்கலாமா?",
    delayed: "மருத்துவர் தாமதம்",
    unavailable: "மருத்துவர் கிடைக்கவில்லை",
    emergencyDoctor: "மருத்துவர் அவசர சிகிச்சையில் உள்ளார்",
    sameHospital: "இதே மருத்துவமனையின் மற்ற மருத்துவர்கள்",
    chooseDoctor: "மாதிரி மருத்துவரைத் தேர்ந்தெடுக்கவும்",
    confirm: "மாதிரி தேர்வை உறுதிப்படுத்து",
    notBooked: "இது மாதிரி தேர்வு மட்டுமே. உண்மையான சந்திப்பு முன்பதிவு செய்யப்படவில்லை.",
    indoor: "மருத்துவமனை உட்புற வழிகாட்டல்",
    indoorFallback: "சரிபார்க்கப்பட்ட உட்புற வரைபடம் இணைக்கப்படவில்லை. வழிகாட்டலுக்கு வரவேற்பகத்தை அணுகவும்.",
    alternatives: "மாற்று மருத்துவமனைகளைக் கண்டறியவும்",
    route: "வழியைக் கண்டறி",
    noLive: "நேரடி கிடைக்கும் நிலை இணைக்கப்படவில்லை.",
    patient: "நோயாளர் பயணம்",
    trust: "நம்பிக்கை மற்றும் பாதுகாப்பு",
    receiptWarning: "மாதிரி ரசீது மட்டுமே — பணம் செலுத்தியதற்கான சான்று அல்ல.",
    amount: "மாதிரி தொகை",
    paymentStatus: "கட்டண நிலை",
    unpaid: "சரிபார்க்கப்படவில்லை",
    emergencyWarning: "இந்த மாதிரி செயலி விபத்தைக் கண்டறியவோ உதவியை அனுப்பவோ அவசர அழைப்பு இணைந்ததை உறுதிப்படுத்தவோ முடியாது.",
    call108: "108 அழைப்பைத் திறக்கவும்",
    callContact: "சேமித்த அவசர தொடர்பை அழைக்கவும்",
    noContact: "அவசர தொடர்பு அமைக்கப்படவில்லை.",
    admin: "கணினி தயார்நிலை",
    save: "மாதிரி அமைப்புகளைச் சேமி",
    saved: "இந்த அமர்வில் மாதிரி அமைப்புகள் சேமிக்கப்பட்டன.",
    status: "மாதிரி",
  },
  hi: {
    name: "हिन्दी",
    welcome: "वापसी पर स्वागत है",
    signIn: "अपने स्वास्थ्य सेवा वर्कस्पेस में साइन इन करें।",
    email: "ईमेल पता",
    password: "पासवर्ड",
    login: "साइन इन",
    register: "खाता बनाएँ",
    fullName: "पूरा नाम",
    noAccount: "MediNexus One पर नए हैं?",
    haveAccount: "पहले से खाता है?",
    chooseLanguage: "अपनी भाषा चुनें",
    invalid: "सही ईमेल और कम से कम 6 अक्षरों का पासवर्ड दर्ज करें।",
    demo: "केवल डेमो मोड। वास्तविक खाता नहीं बनाया जाता।",
    subtitle: "आपका एकीकृत स्वास्थ्य सेवा वर्कस्पेस।",
    overview: "वर्कस्पेस अवलोकन",
    navigation: "अस्पताल नेविगेशन",
    appointments: "अपॉइंटमेंट",
    bills: "रसीदें और बिल",
    emergency: "आपातकालीन SOS",
    hospitals: "अस्पताल",
    administration: "प्रशासन",
    search: "वर्कस्पेस खोजें...",
    back: "अवलोकन पर वापस जाएँ",
    voice: "आवाज़ में मार्गदर्शन सुनें",
    mute: "आवाज़ बंद करें",
    enableVoice: "आवाज़ चालू करें",
    demoWarning: "केवल डेमो डेटा। वास्तविक अस्पताल, डॉक्टर, भुगतान या बुकिंग डेटा जुड़ा नहीं है।",
    doctorUnavailable: "आपके निर्धारित डॉक्टर उपलब्ध नहीं हो सकते या देर हो सकती है। क्या आप इसी अस्पताल में दूसरे डॉक्टर को देखना चाहेंगे?",
    delayed: "डॉक्टर देर से आ रहे हैं",
    unavailable: "डॉक्टर उपलब्ध नहीं हैं",
    emergencyDoctor: "डॉक्टर आपातकालीन स्थिति में व्यस्त हैं",
    sameHospital: "इसी अस्पताल के अन्य डॉक्टर",
    chooseDoctor: "डेमो डॉक्टर चुनें",
    confirm: "डेमो चयन की पुष्टि करें",
    notBooked: "यह केवल डेमो चयन है। वास्तविक अपॉइंटमेंट बुक नहीं हुआ है।",
    indoor: "अस्पताल के अंदर मार्गदर्शन",
    indoorFallback: "सत्यापित इनडोर नक्शा उपलब्ध नहीं है। कृपया रास्ते के लिए रिसेप्शन से पूछें।",
    alternatives: "वैकल्पिक अस्पताल खोजें",
    route: "रास्ता खोजें",
    noLive: "लाइव उपलब्धता जुड़ी नहीं है।",
    patient: "मरीज की यात्रा",
    trust: "विश्वास और सुरक्षा",
    receiptWarning: "केवल नमूना रसीद — भुगतान का प्रमाण नहीं।",
    amount: "नमूना राशि",
    paymentStatus: "भुगतान स्थिति",
    unpaid: "सत्यापित नहीं",
    emergencyWarning: "यह डेमो दुर्घटना का पता नहीं लगा सकता, सहायता भेज नहीं सकता और कॉल कनेक्शन सत्यापित नहीं कर सकता।",
    call108: "108 डायलर खोलें",
    callContact: "सहेजे गए आपातकालीन संपर्क को कॉल करें",
    noContact: "कोई आपातकालीन संपर्क सेट नहीं है।",
    admin: "सिस्टम की तैयारी",
    save: "डेमो सेटिंग सहेजें",
    saved: "इस सत्र में डेमो सेटिंग सहेजी गई।",
    status: "डेमो",
  },
  te: {
    name: "తెలుగు",
    welcome: "స్వాగతం",
    signIn: "మీ ఆరోగ్య సేవల వర్క్‌స్పేస్‌లోకి సైన్ ఇన్ చేయండి.",
    email: "ఈమెయిల్",
    password: "పాస్‌వర్డ్",
    login: "సైన్ ఇన్",
    register: "ఖాతా సృష్టించండి",
    fullName: "పూర్తి పేరు",
    noAccount: "MediNexus One కొత్తవారా?",
    haveAccount: "ఇప్పటికే ఖాతా ఉందా?",
    chooseLanguage: "భాషను ఎంచుకోండి",
    invalid: "సరైన ఈమెయిల్ మరియు కనీసం 6 అక్షరాల పాస్‌వర్డ్ ఇవ్వండి.",
    demo: "డెమో మాత్రమే. నిజమైన ఖాతా సృష్టించబడదు.",
    subtitle: "మీ సమగ్ర ఆరోగ్య సేవల వర్క్‌స్పేస్.",
    overview: "అవలోకనం",
    navigation: "ఆసుపత్రి మార్గదర్శకం",
    appointments: "అపాయింట్‌మెంట్లు",
    bills: "రసీదులు మరియు బిల్లులు",
    emergency: "అత్యవసర SOS",
    hospitals: "ఆసుపత్రులు",
    administration: "నిర్వహణ",
    search: "వెతకండి...",
    back: "అవలోకనానికి తిరిగి వెళ్లండి",
    voice: "వాయిస్ మార్గదర్శకాన్ని వినండి",
    mute: "వాయిస్ మ్యూట్",
    enableVoice: "వాయిస్ ప్రారంభించండి",
    demoWarning: "డెమో డేటా మాత్రమే. నిజమైన ఆసుపత్రి, డాక్టర్, చెల్లింపు లేదా బుకింగ్ డేటా అనుసంధానించబడలేదు.",
    doctorUnavailable: "మీ డాక్టర్ అందుబాటులో లేకపోవచ్చు లేదా ఆలస్యం కావచ్చు. ఇదే ఆసుపత్రిలో మరో డాక్టర్‌ను చూడాలా?",
    delayed: "డాక్టర్ ఆలస్యం",
    unavailable: "డాక్టర్ అందుబాటులో లేరు",
    emergencyDoctor: "డాక్టర్ అత్యవసర పరిస్థితిలో ఉన్నారు",
    sameHospital: "ఇదే ఆసుపత్రిలో ఇతర వైద్యులు",
    chooseDoctor: "డెమో డాక్టర్‌ను ఎంచుకోండి",
    confirm: "డెమో ఎంపికను నిర్ధారించండి",
    notBooked: "ఇది డెమో ఎంపిక మాత్రమే. నిజమైన అపాయింట్‌మెంట్ బుక్ కాలేదు.",
    indoor: "ఆసుపత్రి లోపలి మార్గదర్శకం",
    indoorFallback: "ధృవీకరించిన ఇండోర్ మ్యాప్ లేదు. దారి కోసం రిసెప్షన్‌ను అడగండి.",
    alternatives: "ప్రత్యామ్నాయ ఆసుపత్రులు",
    route: "దారిని కనుగొనండి",
    noLive: "ప్రత్యక్ష లభ్యత అనుసంధానించబడలేదు.",
    patient: "రోగి ప్రయాణం",
    trust: "నమ్మకం మరియు భద్రత",
    receiptWarning: "డెమో రసీదు మాత్రమే — చెల్లింపు రుజువు కాదు.",
    amount: "డెమో మొత్తం",
    paymentStatus: "చెల్లింపు స్థితి",
    unpaid: "ధృవీకరించబడలేదు",
    emergencyWarning: "ఈ డెమో ప్రమాదాన్ని గుర్తించదు, సహాయాన్ని పంపదు లేదా కాల్ కనెక్ట్ అయిందని నిర్ధారించదు.",
    call108: "108 డయలర్ తెరవండి",
    callContact: "సేవ్ చేసిన అత్యవసర పరిచయానికి కాల్ చేయండి",
    noContact: "అత్యవసర పరిచయం సెటప్ కాలేదు.",
    admin: "సిస్టమ్ సిద్ధత",
    save: "డెమో సెట్టింగ్‌లను సేవ్ చేయండి",
    saved: "డెమో సెట్టింగ్‌లు ఈ సెషన్‌లో సేవ్ చేయబడ్డాయి.",
    status: "డెమో",
  },
  ml: {
    name: "മലയാളം",
    welcome: "വീണ്ടും സ്വാഗതം",
    signIn: "ആരോഗ്യ സേവന വർക്ക്സ്പേസിൽ പ്രവേശിക്കുക.",
    email: "ഇമെയിൽ",
    password: "പാസ്‌വേഡ്",
    login: "പ്രവേശിക്കുക",
    register: "അക്കൗണ്ട് സൃഷ്ടിക്കുക",
    fullName: "പൂർണ്ണ പേര്",
    noAccount: "MediNexus One-ൽ പുതുതാണോ?",
    haveAccount: "അക്കൗണ്ട് ഉണ്ടോ?",
    chooseLanguage: "ഭാഷ തിരഞ്ഞെടുക്കുക",
    invalid: "ശരിയായ ഇമെയിലും കുറഞ്ഞത് 6 അക്ഷരമുള്ള പാസ്‌വേഡും നൽകുക.",
    demo: "ഡെമോ മാത്രം. യഥാർത്ഥ അക്കൗണ്ട് സൃഷ്ടിക്കില്ല.",
    subtitle: "നിങ്ങളുടെ ഏകീകൃത ആരോഗ്യ സേവന വർക്ക്സ്പേസ്.",
    overview: "അവലോകനം",
    navigation: "ആശുപത്രി വഴികാട്ടൽ",
    appointments: "അപ്പോയിന്റ്മെന്റുകൾ",
    bills: "രസീതുകളും ബില്ലുകളും",
    emergency: "അടിയന്തര SOS",
    hospitals: "ആശുപത്രികൾ",
    administration: "ഭരണം",
    search: "തിരയുക...",
    back: "അവലോകനത്തിലേക്ക് മടങ്ങുക",
    voice: "ശബ്ദ വഴികാട്ടൽ കേൾക്കുക",
    mute: "ശബ്ദം നിശ്ശബ്ദമാക്കുക",
    enableVoice: "ശബ്ദം പ്രവർത്തനക്ഷമമാക്കുക",
    demoWarning: "ഡെമോ ഡാറ്റ മാത്രം. യഥാർത്ഥ ആശുപത്രി, ഡോക്ടർ, പേയ്‌മെന്റ് അല്ലെങ്കിൽ ബുക്കിംഗ് ഡാറ്റ ബന്ധിപ്പിച്ചിട്ടില്ല.",
    doctorUnavailable: "നിങ്ങളുടെ ഡോക്ടർ ലഭ്യമല്ലാതെയോ വൈകിയോ വരാം. ഇതേ ആശുപത്രിയിൽ മറ്റൊരു ഡോക്ടറെ പരിശോധിക്കണോ?",
    delayed: "ഡോക്ടർ വൈകുന്നു",
    unavailable: "ഡോക്ടർ ലഭ്യമല്ല",
    emergencyDoctor: "ഡോക്ടർ അടിയന്തര സാഹചര്യത്തിലാണ്",
    sameHospital: "ഇതേ ആശുപത്രിയിലെ മറ്റ് ഡോക്ടർമാർ",
    chooseDoctor: "ഡെമോ ഡോക്ടറെ തിരഞ്ഞെടുക്കുക",
    confirm: "ഡെമോ തിരഞ്ഞെടുപ്പ് സ്ഥിരീകരിക്കുക",
    notBooked: "ഇത് ഡെമോ തിരഞ്ഞെടുപ്പ് മാത്രമാണ്. യഥാർത്ഥ അപ്പോയിന്റ്മെന്റ് ബുക്ക് ചെയ്തിട്ടില്ല.",
    indoor: "ആശുപത്രിക്കുള്ളിലെ വഴികാട്ടൽ",
    indoorFallback: "സ്ഥിരീകരിച്ച ഇൻഡോർ മാപ്പ് ലഭ്യമല്ല. ദിശകൾക്കായി റിസപ്ഷനിൽ ചോദിക്കുക.",
    alternatives: "മറ്റ് ആശുപത്രികൾ",
    route: "വഴി കണ്ടെത്തുക",
    noLive: "തത്സമയ ലഭ്യത ബന്ധിപ്പിച്ചിട്ടില്ല.",
    patient: "രോഗിയുടെ യാത്ര",
    trust: "വിശ്വാസവും സുരക്ഷയും",
    receiptWarning: "ഡെമോ രസീത് മാത്രം — പേയ്‌മെന്റ് തെളിവല്ല.",
    amount: "ഡെമോ തുക",
    paymentStatus: "പേയ്‌മെന്റ് നില",
    unpaid: "സ്ഥിരീകരിച്ചിട്ടില്ല",
    emergencyWarning: "ഈ ഡെമോ അപകടം കണ്ടെത്തുകയോ സഹായം അയയ്ക്കുകയോ കോൾ ബന്ധിപ്പിച്ചെന്ന് സ്ഥിരീകരിക്കുകയോ ചെയ്യില്ല.",
    call108: "108 ഡയലർ തുറക്കുക",
    callContact: "സേവ് ചെയ്ത അടിയന്തര കോൺടാക്റ്റിലേക്ക് വിളിക്കുക",
    noContact: "അടിയന്തര കോൺടാക്റ്റ് സജ്ജീകരിച്ചിട്ടില്ല.",
    admin: "സിസ്റ്റം തയ്യാറെടുപ്പ്",
    save: "ഡെമോ ക്രമീകരണങ്ങൾ സേവ് ചെയ്യുക",
    saved: "ഈ സെഷനിൽ ഡെമോ ക്രമീകരണങ്ങൾ സേവ് ചെയ്തു.",
    status: "ഡെമോ",
  },
  kn: {
    name: "ಕನ್ನಡ",
    welcome: "ಮತ್ತೆ ಸ್ವಾಗತ",
    signIn: "ನಿಮ್ಮ ಆರೋಗ್ಯ ಸೇವಾ ಕಾರ್ಯಕ್ಷೇತ್ರಕ್ಕೆ ಸೈನ್ ಇನ್ ಮಾಡಿ.",
    email: "ಇಮೇಲ್",
    password: "ಪಾಸ್‌ವರ್ಡ್",
    login: "ಸೈನ್ ಇನ್",
    register: "ಖಾತೆ ರಚಿಸಿ",
    fullName: "ಪೂರ್ಣ ಹೆಸರು",
    noAccount: "MediNexus One ಗೆ ಹೊಸಬರೇ?",
    haveAccount: "ಈಗಾಗಲೇ ಖಾತೆ ಇದೆಯೇ?",
    chooseLanguage: "ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ",
    invalid: "ಸರಿಯಾದ ಇಮೇಲ್ ಮತ್ತು ಕನಿಷ್ಠ 6 ಅಕ್ಷರಗಳ ಪಾಸ್‌ವರ್ಡ್ ನಮೂದಿಸಿ.",
    demo: "ಡೆಮೋ ಮಾತ್ರ. ನಿಜವಾದ ಖಾತೆ ರಚಿಸಲಾಗುವುದಿಲ್ಲ.",
    subtitle: "ನಿಮ್ಮ ಸಂಯೋಜಿತ ಆರೋಗ್ಯ ಸೇವಾ ಕಾರ್ಯಕ್ಷೇತ್ರ.",
    overview: "ಅವಲೋಕನ",
    navigation: "ಆಸ್ಪತ್ರೆ ಮಾರ್ಗದರ್ಶನ",
    appointments: "ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್‌ಗಳು",
    bills: "ರಸೀದಿಗಳು ಮತ್ತು ಬಿಲ್‌ಗಳು",
    emergency: "ತುರ್ತು SOS",
    hospitals: "ಆಸ್ಪತ್ರೆಗಳು",
    administration: "ಆಡಳಿತ",
    search: "ಹುಡುಕಿ...",
    back: "ಅವಲೋಕನಕ್ಕೆ ಹಿಂತಿರುಗಿ",
    voice: "ಧ್ವನಿ ಮಾರ್ಗದರ್ಶನ ಕೇಳಿ",
    mute: "ಧ್ವನಿ ಮ್ಯೂಟ್ ಮಾಡಿ",
    enableVoice: "ಧ್ವನಿ ಸಕ್ರಿಯಗೊಳಿಸಿ",
    demoWarning: "ಡೆಮೋ ಡೇಟಾ ಮಾತ್ರ. ನಿಜವಾದ ಆಸ್ಪತ್ರೆ, ವೈದ್ಯರು, ಪಾವತಿ ಅಥವಾ ಬುಕಿಂಗ್ ಡೇಟಾ ಸಂಪರ್ಕಗೊಂಡಿಲ್ಲ.",
    doctorUnavailable: "ನಿಮ್ಮ ವೈದ್ಯರು ಲಭ್ಯವಿಲ್ಲದಿರಬಹುದು ಅಥವಾ ತಡವಾಗಿರಬಹುದು. ಇದೇ ಆಸ್ಪತ್ರೆಯಲ್ಲಿ ಬೇರೆ ವೈದ್ಯರನ್ನು ನೋಡಬೇಕೇ?",
    delayed: "ವೈದ್ಯರು ತಡವಾಗಿದ್ದಾರೆ",
    unavailable: "ವೈದ್ಯರು ಲಭ್ಯವಿಲ್ಲ",
    emergencyDoctor: "ವೈದ್ಯರು ತುರ್ತು ಪರಿಸ್ಥಿತಿಯಲ್ಲಿ ನಿರತರಾಗಿದ್ದಾರೆ",
    sameHospital: "ಇದೇ ಆಸ್ಪತ್ರೆಯ ಇತರ ವೈದ್ಯರು",
    chooseDoctor: "ಡೆಮೋ ವೈದ್ಯರನ್ನು ಆಯ್ಕೆಮಾಡಿ",
    confirm: "ಡೆಮೋ ಆಯ್ಕೆಯನ್ನು ದೃಢೀಕರಿಸಿ",
    notBooked: "ಇದು ಡೆಮೋ ಆಯ್ಕೆ ಮಾತ್ರ. ನಿಜವಾದ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಬುಕ್ ಆಗಿಲ್ಲ.",
    indoor: "ಆಸ್ಪತ್ರೆಯ ಒಳಾಂಗಣ ಮಾರ್ಗದರ್ಶನ",
    indoorFallback: "ಪರಿಶೀಲಿಸಿದ ಒಳಾಂಗಣ ನಕ್ಷೆ ಲಭ್ಯವಿಲ್ಲ. ದಾರಿಗಾಗಿ ಸ್ವಾಗತ ಕೌಂಟರ್‌ನಲ್ಲಿ ಕೇಳಿ.",
    alternatives: "ಪರ್ಯಾಯ ಆಸ್ಪತ್ರೆಗಳು",
    route: "ದಾರಿ ಹುಡುಕಿ",
    noLive: "ನೇರ ಲಭ್ಯತೆ ಸಂಪರ್ಕಗೊಂಡಿಲ್ಲ.",
    patient: "ರೋಗಿಯ ಪ್ರಯಾಣ",
    trust: "ನಂಬಿಕೆ ಮತ್ತು ಸುರಕ್ಷತೆ",
    receiptWarning: "ಡೆಮೋ ರಸೀದಿ ಮಾತ್ರ — ಪಾವತಿಯ ಪುರಾವೆಯಲ್ಲ.",
    amount: "ಡೆಮೋ ಮೊತ್ತ",
    paymentStatus: "ಪಾವತಿ ಸ್ಥಿತಿ",
    unpaid: "ಪರಿಶೀಲಿಸಲಾಗಿಲ್ಲ",
    emergencyWarning: "ಈ ಡೆಮೋ ಅಪಘಾತವನ್ನು ಪತ್ತೆಹಚ್ಚಲು, ಸಹಾಯ ಕಳುಹಿಸಲು ಅಥವಾ ಕರೆ ಸಂಪರ್ಕಗೊಂಡಿದೆ ಎಂದು ದೃಢೀಕರಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ.",
    call108: "108 ಡಯಲರ್ ತೆರೆಯಿರಿ",
    callContact: "ಉಳಿಸಿದ ತುರ್ತು ಸಂಪರ್ಕಕ್ಕೆ ಕರೆಮಾಡಿ",
    noContact: "ತುರ್ತು ಸಂಪರ್ಕ ಹೊಂದಿಸಲಾಗಿಲ್ಲ.",
    admin: "ಸಿಸ್ಟಮ್ ಸಿದ್ಧತೆ",
    save: "ಡೆಮೋ ಸೆಟ್ಟಿಂಗ್‌ಗಳನ್ನು ಉಳಿಸಿ",
    saved: "ಈ ಸೆಷನ್‌ನಲ್ಲಿ ಡೆಮೋ ಸೆಟ್ಟಿಂಗ್‌ಗಳನ್ನು ಉಳಿಸಲಾಗಿದೆ.",
    status: "ಡೆಮೋ",
  },
};

const languageOptions = Object.entries(languages).map(([value, item]) => ({
  value,
  label: item.name,
}));

// Explicitly fictional sample data. Never present these as real doctors.
const sampleDoctors = [
  { id: "sample-1", name: "Dr. Sample A", department: "General Medicine", slot: "Sample slot · 11:30 AM" },
  { id: "sample-2", name: "Dr. Sample B", department: "General Medicine", slot: "Sample slot · 12:15 PM" },
];

function LanguageSelect({ language, setLanguage, label }) {
  return (
    <label className="language-select">
      <Languages size={17} aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <select value={language} onChange={e => setLanguage(e.target.value)} aria-label={label}>
        {languageOptions.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function AuthScreen({ language, setLanguage, t, onLogin }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function submit(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!email.includes("@") || !email.includes(".") || password.length < 6) {
      setError(t.invalid);
      return;
    }

    if (mode === "register") {
      if (!name.trim()) {
        setError(t.fullName);
        return;
      }
      setNotice(t.demo);
      return;
    }

    onLogin();
  }

  return (
    <main className="auth-shell">
      <section className="auth-brand-panel">
        <div className="auth-brand">
          <div className="brand-mark"><HeartPulse size={25} /></div>
          <span>MediNexus <b>One</b></span>
        </div>
        <div className="auth-message">
          <div className="auth-orb"><HeartPulse size={62} strokeWidth={1.35} /></div>
          <span className="auth-overline">CONNECTED CARE PLATFORM</span>
          <h1>{t.welcome}</h1>
          <p>{t.subtitle}</p>
          <div className="auth-feature"><ShieldCheck size={18} /><span>Safety-first patient workflows</span></div>
          <div className="auth-feature"><MapPinned size={18} /><span>Care navigation in one place</span></div>
          <div className="auth-feature"><Volume2 size={18} /><span>Multilingual voice assistance</span></div>
        </div>
        <div className="auth-brand-footer">© MediNexus One · Demo preview</div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-top">
          <span className="auth-top-label">{t.chooseLanguage}</span>
          <LanguageSelect language={language} setLanguage={setLanguage} label={t.chooseLanguage} />
        </div>
        <form className="auth-card" onSubmit={submit}>
          <div className="auth-card-icon"><HeartPulse size={25} /></div>
          <span className="auth-overline violet-overline">MEDINEXUS ONE</span>
          <h2>{mode === "login" ? t.welcome : t.register}</h2>
          <p className="auth-description">{t.signIn}</p>

          {mode === "register" && (
            <label className="field-label">
              {t.fullName}
              <span className="input-wrap"><UserRound size={18} />
                <input value={name} onChange={e => setName(e.target.value)} autoComplete="name" placeholder={t.fullName} />
              </span>
            </label>
          )}

          <label className="field-label">
            {t.email}
            <span className="input-wrap"><UserRound size={18} />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required />
            </span>
          </label>

          <label className="field-label">
            {t.password}
            <span className="input-wrap"><LockKeyhole size={18} />
              <input type={showPassword ? "text" : "password"} value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="At least 6 characters" required />
              <button className="password-toggle" type="button" onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>

          {error && <p className="form-message error-message" role="alert">{error}</p>}
          {notice && <p className="form-message notice-message" role="status">{notice}</p>}

          <button className="primary-button auth-submit" type="submit">
            {mode === "login" ? t.login : t.register}<ArrowUpRight size={17} />
          </button>
          <p className="auth-switch">
            {mode === "login" ? t.noAccount : t.haveAccount}{" "}
            <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setNotice(""); }}>
              {mode === "login" ? t.register : t.login}
            </button>
          </p>
          <p className="demo-disclaimer">{t.demo}</p>
        </form>
      </section>
    </main>
  );
}

function Panel({ title, subtitle, icon: Icon, children }) {
  return (
    <section className="panel feature-panel">
      <div className="feature-heading">
        <span className="feature-icon"><Icon size={21} /></span>
        <div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, value, onChange, options }) {
  return (
    <label className="feature-field">
      <span>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}>
        {options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function AppointmentModule({ t, language }) {
  const [status, setStatus] = useState("unavailable");
  const [doctorId, setDoctorId] = useState("");
  const [notice, setNotice] = useState("");
  const [indoorOpen, setIndoorOpen] = useState(false);
  const statusMessage = status === "delayed"
    ? t.doctorUnavailable
    : status === "emergency"
      ? t.doctorUnavailable
      : t.doctorUnavailable;

  const speechLocale = { en: "en-IN", ta: "ta-IN", hi: "hi-IN", te: "te-IN", ml: "ml-IN", kn: "kn-IN" };

  function speak(text) {
    if (!("speechSynthesis" in window)) {
      setNotice("Voice playback is not supported by this browser. Please read the message.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLocale[language] || "en-IN";
    utterance.rate = 0.9;
    utterance.onerror = () => setNotice("Voice playback failed. Please read the message on screen.");
    window.speechSynthesis.speak(utterance);
  }

  useEffect(() => () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  return (
    <div className="feature-grid">
      <Panel title={t.appointments} subtitle="Voice-first appointment recovery" icon={CalendarDays}>
        <div className="demo-warning"><AlertTriangle size={19} /><span>{t.demoWarning}</span></div>
        <Field label="Appointment status" value={status} onChange={setStatus} options={[
          { value: "unavailable", label: t.unavailable },
          { value: "delayed", label: t.delayed },
          { value: "emergency", label: t.emergencyDoctor },
        ]} />
        <div className="voice-box">
          <span className="voice-indicator"><span /> Voice guidance</span>
          <p>{statusMessage}</p>
          <button className="feature-primary" onClick={() => speak(statusMessage)}><Volume2 size={17} /> {t.voice}</button>
        </div>
        <h4>{t.sameHospital}</h4>
        <p className="feature-muted">{t.noLive} These entries are fictional examples.</p>
        <div className="sample-doctors">
          {sampleDoctors.map(doctor => (
            <label className={`sample-doctor ${doctorId === doctor.id ? "selected" : ""}`} key={doctor.id}>
              <input type="radio" name="sample-doctor" checked={doctorId === doctor.id}
                onChange={() => { setDoctorId(doctor.id); setNotice(""); }} />
              <span className="sample-doctor-avatar"><Hospital size={20} /></span>
              <span className="sample-doctor-copy"><strong>{doctor.name}</strong><small>{doctor.department}</small><small>{doctor.slot}</small></span>
              <span className="sample-label">SAMPLE</span>
            </label>
          ))}
        </div>
        <button className="feature-primary" disabled={!doctorId} onClick={() => setNotice(t.notBooked)}>
          <CheckCircle2 size={17} /> {t.confirm}
        </button>
        {notice && <p className="feature-feedback" role="status">{notice}</p>}
      </Panel>

      <Panel title={t.indoor} subtitle="Indoor room and department guidance" icon={Navigation}>
        <p>{t.indoorFallback}</p>
        <button className="feature-secondary" onClick={() => setIndoorOpen(!indoorOpen)}>
          <MapPinned size={17} /> {indoorOpen ? "Hide details" : "Show guidance"}
        </button>
        {indoorOpen && (
          <div className="indoor-message">
            <AlertTriangle size={20} />
            <div><strong>Verified floor plan unavailable</strong><p>{t.indoorFallback}</p></div>
          </div>
        )}
        <div className="demo-warning"><ShieldCheck size={18} /><span>Indoor routes should only be shown after the hospital verifies its floor plan, floor, room and entrance data.</span></div>
      </Panel>

      <Panel title={t.alternatives} subtitle="Find hospitals and open route directions" icon={Map}>
        <p>Search nearby hospitals using your map provider. Results and availability must be checked before changing an appointment.</p>
        <button className="feature-primary" onClick={() => window.open("https://www.google.com/maps/search/hospitals+in+Tamil+Nadu", "_blank", "noopener,noreferrer")}>
          <ExternalLink size={17} /> {t.route}
        </button>
      </Panel>
    </div>
  );
}

function NavigationModule() {
  const [query, setQuery] = useState("Chennai, Tamil Nadu");
  const [destination, setDestination] = useState("hospital");
  const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(destination === "hospital" ? "hospitals " + query : query)}`;
  const routeUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;

  return (
    <div className="feature-grid">
      <Panel title="Hospital navigation" subtitle="Search places across Tamil Nadu" icon={MapPinned}>
        <label className="feature-field"><span>City, area or destination</span>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Enter a city or hospital" />
        </label>
        <Field label="Search type" value={destination} onChange={setDestination} options={[
          { value: "hospital", label: "Hospitals" },
          { value: "general", label: "Any destination" },
        ]} />
        <div className="map-preview">
          <MapPinned size={32} />
          <strong>Map provider preview</strong>
          <p>The interactive map and live location are opened in your map provider.</p>
          <small>Location access is handled by the map provider.</small>
        </div>
        <div className="feature-button-row">
          <button className="feature-primary" onClick={() => window.open(mapsUrl, "_blank", "noopener,noreferrer")}><Search size={17} /> Search map</button>
          <button className="feature-secondary" onClick={() => window.open(routeUrl, "_blank", "noopener,noreferrer")}><Navigation size={17} /> Directions</button>
        </div>
      </Panel>
      <Panel title="Indoor navigation" subtitle="Entrance to department or room" icon={Navigation}>
        <p>Indoor navigation requires a verified hospital floor plan and room locations. This prototype will not invent indoor routes.</p>
        <div className="indoor-message"><AlertTriangle size={20} /><div><strong>Floor plan not connected</strong><p>Please ask hospital reception for current directions.</p></div></div>
      </Panel>
    </div>
  );
}

function HospitalsModule() {
  const [query, setQuery] = useState("Tamil Nadu");
  return (
    <div className="feature-grid">
      <Panel title="Hospital directory" subtitle="Open a map search for hospitals" icon={Hospital}>
        <label className="feature-field"><span>Search location</span><input value={query} onChange={e => setQuery(e.target.value)} /></label>
        <button className="feature-primary" onClick={() => window.open(`https://www.google.com/maps/search/hospitals+in+${encodeURIComponent(query)}`, "_blank", "noopener,noreferrer")}>
          <Search size={17} /> Search hospitals
        </button>
        <p className="feature-muted">Hospital names, contact details, specialties and doctor schedules must be verified with the provider. A map search does not confirm clinical availability.</p>
      </Panel>
      <Panel title="Doctor availability" subtitle="Connect verified provider data" icon={UserCheck}>
        <div className="demo-warning"><AlertTriangle size={19} /><span>{languages.en.noLive} No real doctor directory is connected to this prototype.</span></div>
        <p>For production, connect an authorised hospital directory and appointment scheduling system. Confirm department, qualifications, current availability and booking status before presenting a replacement.</p>
      </Panel>
    </div>
  );
}

function BillsModule({ t }) {
  const [receiptId, setReceiptId] = useState("DEMO-0001");
  const [patient, setPatient] = useState("Sample Patient");
  const [service, setService] = useState("Consultation (sample)");
  const [amount, setAmount] = useState("500");
  const [status, setStatus] = useState("unverified");

  function printReceipt() {
    window.print();
  }

  return (
    <div className="feature-grid">
      <Panel title={t.bills} subtitle="Sample receipt preview" icon={ReceiptText}>
        <div className="demo-warning"><AlertTriangle size={19} /><span>{t.receiptWarning}</span></div>
        <label className="feature-field"><span>Sample receipt number</span><input value={receiptId} onChange={e => setReceiptId(e.target.value)} /></label>
        <label className="feature-field"><span>Patient label</span><input value={patient} onChange={e => setPatient(e.target.value)} /></label>
        <label className="feature-field"><span>Service item</span><input value={service} onChange={e => setService(e.target.value)} /></label>
        <label className="feature-field"><span>Sample amount (INR)</span><input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} /></label>
        <Field label={t.paymentStatus} value={status} onChange={setStatus} options={[
          { value: "unverified", label: t.unpaid },
          { value: "paid", label: "Demo status: paid (not verified)" },
        ]} />
        <div className="receipt-preview">
          <div className="receipt-brand"><HeartPulse size={22} /><strong>MediNexus One</strong></div>
          <span className="sample-label">SAMPLE · NOT AN OFFICIAL RECEIPT</span>
          <h3>Payment summary</h3>
          <p>Receipt: {receiptId || "—"}</p>
          <p>Patient: {patient || "—"}</p>
          <p>Service: {service || "—"}</p>
          <p>{t.paymentStatus}: {status === "paid" ? "Demo status only — not verified" : t.unpaid}</p>
          <div className="receipt-total"><span>{t.amount}</span><strong>₹{Number(amount || 0).toLocaleString("en-IN")}</strong></div>
          <p className="feature-muted">{t.receiptWarning}</p>
        </div>
        <button className="feature-primary" onClick={printReceipt}><Printer size={17} /> Print / Save as PDF</button>
      </Panel>
      <Panel title="Verified billing integration" subtitle="Required before issuing official receipts" icon={FileText}>
        <p>Official receipts must come from verified payment and billing records. A production integration should record the provider, itemised charges, payment method, transaction reference, date and status.</p>
        <div className="indoor-message"><ShieldCheck size={20} /><div><strong>Payment integrity</strong><p>Demo data is never proof that a payment occurred.</p></div></div>
      </Panel>
    </div>
  );
}

function EmergencyModule({ t }) {
  const [contact, setContact] = useState("");
  const [location, setLocation] = useState("");
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState("");

  function prepareSOS() {
    if (!consent) {
      setMessage("Please confirm that you want to prepare the emergency call.");
      return;
    }
    setMessage("Your phone dialler may open. Confirm the call on your device. This website cannot verify that the call connected.");
    window.location.href = "tel:108";
  }

  return (
    <div className="feature-grid">
      <Panel title="Emergency SOS" subtitle="Manual emergency workflow prototype" icon={Siren}>
        <div className="demo-warning"><AlertTriangle size={19} /><span>{t.emergencyWarning}</span></div>
        <label className="feature-field"><span>Location to share (check before calling)</span><input value={location} onChange={e => setLocation(e.target.value)} placeholder="Enter or verify your location" /></label>
        <label className="feature-field"><span>Saved emergency contact number</span><input value={contact} onChange={e => setContact(e.target.value)} placeholder="Enter a trusted contact number" /></label>
        <label className="consent-row"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /><span>I understand that this will open my phone dialler and I must confirm the call.</span></label>
        <button className="feature-danger" onClick={prepareSOS}><Phone size={18} /> {t.call108}</button>
        <button className="feature-secondary" disabled={!contact.trim()} onClick={() => { window.location.href = `tel:${contact.replace(/[^\d+]/g, "")}`; }}>
          <Phone size={17} /> {t.callContact}
        </button>
        {message && <p className="feature-feedback" role="status">{message}</p>}
        <p className="feature-muted">In an emergency, use your local emergency service. Never rely on this prototype as the only way to request help.</p>
      </Panel>
      <Panel title="Accident emergency workflow" subtitle="Integration required" icon={ShieldCheck}>
        <ul className="feature-list">
          <li>Manual SOS with explicit user confirmation.</li>
          <li>Crash detection requires tested device sensors and permission handling.</li>
          <li>Location and timestamp must be checked before sharing.</li>
          <li>AI voice should announce only confirmed information.</li>
          <li>Display call status only when the device or service can verify it.</li>
        </ul>
      </Panel>
    </div>
  );
}

function AdminModule({ t, language, setLanguage }) {
  const [saved, setSaved] = useState(false);
  const [contact, setContact] = useState("");
  return (
    <div className="feature-grid">
      <Panel title={t.admin} subtitle="Prototype configuration" icon={Settings}>
        <Field label={t.chooseLanguage} value={language} onChange={value => { setLanguage(value); setSaved(false); }} options={languageOptions} />
        <label className="feature-field"><span>Emergency contact (prototype only)</span><input value={contact} onChange={e => { setContact(e.target.value); setSaved(false); }} placeholder="Contact number" /></label>
        <button className="feature-primary" onClick={() => setSaved(true)}><CheckCircle2 size={17} /> {t.save}</button>
        {saved && <p className="feature-feedback" role="status">{t.saved} This setting is not connected to a secure user account.</p>}
      </Panel>
      <Panel title="Integration status" subtitle="What is not connected yet" icon={Activity}>
        <ul className="feature-list">
          <li>Authentication server: not connected.</li>
          <li>Doctor availability and appointment booking API: not connected.</li>
          <li>Verified hospital floor plans: not connected.</li>
          <li>Payment processor and official receipt records: not connected.</li>
          <li>Emergency dispatch integration: not connected.</li>
        </ul>
      </Panel>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail, tone }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}><Icon size={21} /></div>
      <p className="metric-label">{label}</p>
      <div className="metric-value">{value}</div>
      <p className="metric-detail">{detail}</p>
    </article>
  );
}

export default function App() {
  const [language, setLanguage] = useState(() => {
    try {
      const saved = localStorage.getItem("medinexus-language");
      return languages[saved] ? saved : "en";
    } catch {
      return "en";
    }
  });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activePage, setActivePage] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const t = languages[language] || languages.en;

  function changeLanguage(nextLanguage) {
    setLanguage(nextLanguage);
    try { localStorage.setItem("medinexus-language", nextLanguage); } catch {}
  }

  useEffect(() => () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  if (!isLoggedIn) {
    return <AuthScreen language={language} setLanguage={changeLanguage} t={t} onLogin={() => setIsLoggedIn(true)} />;
  }

  const pageLabel = {
    Overview: t.overview,
    "Hospital Navigation": t.navigation,
    Appointments: t.appointments,
    "Receipts & Bills": t.bills,
    "Emergency SOS": t.emergency,
    Hospitals: t.hospitals,
    Administration: t.administration,
  }[activePage] || activePage;

  const filteredNavigation = navigation.filter(item => {
    const label = ({
      Overview: t.overview,
      "Hospital Navigation": t.navigation,
      Appointments: t.appointments,
      "Receipts & Bills": t.bills,
      "Emergency SOS": t.emergency,
      Hospitals: t.hospitals,
      Administration: t.administration,
    })[item.label] || item.label;
    return label.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="app-shell">
      {sidebarOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><HeartPulse size={24} /></div>
          <div><strong>MediNexus<span> One</span></strong><small>CONNECTED CARE PLATFORM</small></div>
          <button className="icon-button sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X /></button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="nav-list" aria-label="Main navigation">
          {filteredNavigation.map(({ label, icon: Icon }) => {
            const translated = ({
              Overview: t.overview,
              "Hospital Navigation": t.navigation,
              Appointments: t.appointments,
              "Receipts & Bills": t.bills,
              "Emergency SOS": t.emergency,
              Hospitals: t.hospitals,
              Administration: t.administration,
            })[label] || label;
            return (
              <button key={label} className={`nav-item ${activePage === label ? "active" : ""}`}
                onClick={() => { setActivePage(label); setSidebarOpen(false); }}>
                <Icon size={19} /><span>{translated}</span>
                {label === "Emergency SOS" && <span className="nav-dot" />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="secure-card"><div className="secure-icon"><ShieldCheck size={19} /></div><strong>Care with confidence</strong><p>Safety-first workflows. Live integrations are not connected.</p></div>
          <div className="profile-row"><div className="avatar">MN</div><div className="profile-copy"><strong>Care workspace</strong><small>Demo session</small></div>
            <button className="icon-button" aria-label="Sign out" onClick={() => setIsLoggedIn(false)}><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu /></button>
            <div className="breadcrumb">WORKSPACE <ChevronRight size={15} /><strong>{pageLabel}</strong></div>
          </div>
          <div className="topbar-actions">
            <label className="global-search"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search} /></label>
            <LanguageSelect language={language} setLanguage={changeLanguage} label={t.chooseLanguage} />
            <button className="icon-button notification-button" aria-label="Notifications" title="Notifications are not connected"><Bell size={19} /><i /></button>
            <div className="topbar-avatar">MN</div>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div><div className="eyebrow"><span className="status-pulse" /> MEDINEXUS ONE</div>
              <h1>{pageLabel}</h1><p className="page-subtitle">{t.subtitle}</p>
            </div>
            <div className="date-chip"><Clock3 size={16} /> Demo preview</div>
          </section>

          <div className="demo-warning global-warning"><AlertTriangle size={19} /><span>{t.demoWarning}</span></div>

          {activePage === "Overview" && (
            <>
              <section className="hero-banner">
                <div className="hero-copy">
                  <span className="hero-kicker">MEDINEXUS ONE · CONNECTED CARE</span>
                  <h2>Your care,<br />connected.</h2>
                  <p>Appointments, hospital directions, voice guidance and patient support in one workspace.</p>
                  <button className="primary-button" onClick={() => setActivePage("Appointments")}>Open appointments <ArrowUpRight size={17} /></button>
                </div>
                <div className="hero-visual" aria-hidden="true">
                  <div className="orbit orbit-one" /><div className="orbit orbit-two" />
                  <div className="hero-glow"><HeartPulse size={65} strokeWidth={1.4} /></div>
                </div>
              </section>
              <section className="section-heading"><div><h2>{t.overview}</h2><p>Prototype module status</p></div><span className="soft-badge">DEMO</span></section>
              <section className="metrics-grid">
                <Metric icon={Hospital} label={t.hospitals} value="Directory preview" detail="Live provider records not connected" tone="blue" />
                <Metric icon={CalendarDays} label={t.appointments} value="Demo workflow" detail="No live booking API" tone="purple" />
                <Metric icon={ReceiptText} label={t.bills} value="Sample receipt" detail="No verified payment records" tone="orange" />
                <Metric icon={ShieldCheck} label={t.emergency} value="Manual preview" detail="Emergency call outcome not verified" tone="green" />
              </section>
              <section className="lower-grid">
                <article className="panel activity-panel">
                  <div className="panel-heading"><div><h3>Patient journey</h3><p>Choose a workflow to explore</p></div><Activity size={19} /></div>
                  <div className="activity-list">
                    {navigation.slice(1).map(({ label, icon: Icon }) => (
                      <button className="activity-row" key={label} onClick={() => setActivePage(label)}>
                        <span className="activity-icon"><Icon size={18} /></span>
                        <span className="activity-copy"><strong>{({
                          "Hospital Navigation": t.navigation,
                          Appointments: t.appointments,
                          "Receipts & Bills": t.bills,
                          "Emergency SOS": t.emergency,
                          Hospitals: t.hospitals,
                          Administration: t.administration,
                        })[label]}</strong><small>Open module preview</small></span>
                        <ChevronRight size={16} />
                      </button>
                    ))}
                  </div>
                </article>
                <article className="panel safety-panel"><div className="safety-symbol"><ShieldCheck size={24} /></div>
                  <span className="hero-kicker">{t.trust}</span><h3>Clear, honest status</h3>
                  <p>Sample records are labelled. Actual bookings, payments and emergency outcomes require verified system records.</p>
                  <button className="text-button" onClick={() => setActivePage("Emergency SOS")}>Review safety <ChevronRight size={16} /></button>
                </article>
              </section>
            </>
          )}

          {activePage === "Appointments" && <AppointmentModule t={t} language={language} />}
          {activePage === "Hospital Navigation" && <NavigationModule />}
          {activePage === "Hospitals" && <HospitalsModule />}
          {activePage === "Receipts & Bills" && <BillsModule t={t} />}
          {activePage === "Emergency SOS" && <EmergencyModule t={t} />}
          {activePage === "Administration" && <AdminModule t={t} language={language} setLanguage={changeLanguage} />}

          <footer className="app-footer">
            <span>© MediNexus One · Connected care prototype</span>
            <span><span className="footer-status" /> Demo mode · Not connected to production data</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
