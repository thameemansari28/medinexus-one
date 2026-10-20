const tamilScript = /[\u0B80-\u0BFF]/;
const languageMarkers = /(?:தமிழ்|Tamil)\s*:\s*([\s\S]*?)(?=(?:English|ஆங்கிலம்)\s*:|(?:தமிழ்|Tamil)\s*:|$)|(?:English|ஆங்கிலம்)\s*:\s*([\s\S]*?)(?=(?:தமிழ்|Tamil)\s*:|(?:English|ஆங்கிலம்)\s*:|$)/gi;

/** Remove formatting characters that screen readers or device voices may read literally. */
export function cleanSpeechText(text) {
  return String(text || "")
    .normalize("NFC")
    .replace(/[|｜]+/g, ", ")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[`*_#<>]/g, "")
    .replace(/^\s*[•*-]\s+/gm, "")
    .replace(/([.!?])\s*,/g, "$1")
    .replace(/\s+([,.;!?])/g, "$1")
    .replace(/([,;:])\s*[,;:]+/g, "$1 ")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/\n[\t ]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function findVoice(voices, locale) {
  const femaleHints = /female|zira|aria|jenny|samantha|sara|heera|kalpana|swara|aditi|priya|veena|pallavi|tara|kavya|sangeetha|susan|sonia|natasha|meera|lekha/i;
  const maleHints = /male|david|mark|guy|james|valluvar/i;
  const candidates = voices.filter((voice) => voice.lang?.toLowerCase().startsWith(locale.slice(0, 2).toLowerCase()));
  return candidates.sort((a, b) => {
    const score = (voice) => (voice.lang?.toLowerCase() === locale.toLowerCase() ? 10 : 0)
      + (femaleHints.test(voice.name) ? 70 : 0)
      + (/natural|neural|online|premium/i.test(voice.name) ? 55 : 0)
      + (voice.localService === false ? 12 : 0)
      - (maleHints.test(voice.name) ? 80 : 0);
    return score(b) - score(a);
  })[0] || null;
}

export function findPreferredVoice(voices, locale, preferredVoiceURI = "") {
  const localePrefix = locale.slice(0, 2).toLowerCase();
  const matchingVoices = voices.filter((voice) => voice.lang?.toLowerCase().startsWith(localePrefix));
  return matchingVoices.find((voice) => voice.voiceURI === preferredVoiceURI) || findVoice(matchingVoices, locale);
}

export function getSavedVoiceChoice(language) {
  try {
    return window.localStorage.getItem(`medinexus-voice-${language}`) || "";
  } catch {
    return "";
  }
}

/** Split bilingual assistant copy into Tamil and English speech segments. */
export function speechParts(text, selectedLanguage = "en") {
  const cleanText = cleanSpeechText(text);
  const marked = [...cleanText.matchAll(languageMarkers)];
  let parts = marked.length
    ? marked.map((match) => ({ text: (match[1] || match[2] || "").trim(), lang: match[1] ? "ta-IN" : "en-IN" }))
    : cleanText.split(/(?:\r?\n)+/).map((segment) => ({
        text: segment.trim(),
        lang: tamilScript.test(segment) ? "ta-IN" : "en-IN",
      }));

  parts = parts.map((part) => ({ ...part, text: cleanSpeechText(part.text) })).filter((part) => part.text);
  // Tamil mode must not silently read only the English part of a bilingual reply.
  return selectedLanguage === "ta"
    ? parts.filter((part) => part.lang === "ta-IN")
    : parts.filter((part) => part.lang === "en-IN");
}
