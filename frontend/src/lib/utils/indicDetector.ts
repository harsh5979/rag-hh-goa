import { IndicLanguageCode } from "../voice/types";

// ── Unicode Script Range Detection ─────────────────────────────────────────
export function isIndicScript(text: string): boolean {
  return /[\u0900-\u0D7F]/.test(text);
}

export function detectScriptFromUnicode(text: string): IndicLanguageCode | null {
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu-IN"; // Gujarati
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta-IN"; // Tamil
  if (/[\u0C00-\u0C7F]/.test(text)) return "te-IN"; // Telugu
  if (/[\u0980-\u09FF]/.test(text)) return "bn-IN"; // Bengali
  if (/[\u0C80-\u0CFF]/.test(text)) return "kn-IN"; // Kannada
  if (/[\u0D00-\u0D7F]/.test(text)) return "ml-IN"; // Malayalam
  if (/[\u0A00-\u0A7F]/.test(text)) return "pa-IN"; // Punjabi
  if (/[\u0B00-\u0B7F]/.test(text)) return "or-IN"; // Odia
  if (/[\u0900-\u097F]/.test(text)) {
    // Check Marathi specific particles in Devanagari
    if (/\b(आहे|आहेत|किती|झाले|नाही|म्हणजे|तुम्ही|आम्ही|काय|कसे)\b/.test(text)) {
      return "mr-IN";
    }
    return "hi-IN"; // Hindi
  }
  return null;
}

// ── Romanized Lexical Markers for Instant Client-Side Detection ───────────
const HINDI_ROMAN_WORDS = new Set([
  "mujhe", "mujhko", "mera", "meri", "mere", "hum", "tum", "aap", "kya", "kyun",
  "kyu", "karna", "kare", "karo", "karta", "karti", "karte", "karun", "karu", "chahiye",
  "chahie", "hai", "hain", "ho", "kaise", "kaisi", "kaisa", "lagta", "lagti", "lagte",
  "naam", "tujhe", "tujhko", "tera", "teri", "tere", "batao", "bataiye", "samjhao",
  "prakash", "sanshleshan", "surya", "mandal", "kitne", "kitna", "kitni", "grah", "graha",
  "kahan", "kab", "kaun", "kripya", "namaste", "shukriya", "bhai", "hoga", "hogi", "hoge"
]);

const GUJARATI_ROMAN_WORDS = new Set([
  "kem", "chho", "cho", "mane", "tamne", "tamaru", "tamari", "tamaro", "maru", "mari",
  "maro", "su", "shu", "shun", "lage", "chhe", "che", "chhiye", "jamvu", "jamvanu",
  "bhaviyu", "bhavya", "bahu", "aaji", "aaje", "nathi", "aave", "aavse", "ketla", "ketli",
  "ketlo", "graho", "suryamandal", "kyare", "kyan", "kai", "kone", "khabar", "maja",
  "majama", "tame", "ame", "mate", "karan", "bolvu", "samjavu", "sharu", "kariye"
]);

const MARATHI_ROMAN_WORDS = new Set([
  "aahe", "aahet", "kiti", "zhale", "nahi", "mhanje", "tumhi", "aamhi", "majhe", "tujhe",
  "kasa", "kashi", "kase", "kay", "kuthe", "kadhi"
]);

const TAMIL_ROMAN_WORDS = new Set([
  "vanakkam", "eppadi", "irukinga", "irukku", "enna", "ethu", "enge", "eppothu", "nanri", "ungal"
]);

const TELUGU_ROMAN_WORDS = new Set([
  "namaskaram", "ela", "unnaru", "undi", "emi", "enti", "ekkada", "eppudu", "dhanyavadalu", "mee"
]);

const BENGALI_ROMAN_WORDS = new Set([
  "nomoshkar", "kemon", "achhen", "achhe", "ki", "kothay", "kokhon", "dhonnobad", "apnar", "amar"
]);

export function detectLanguageClient(text: string, fallback: IndicLanguageCode = "en-IN"): IndicLanguageCode {
  if (!text || !text.trim()) return fallback;

  // 1. Unicode Script Check (100% exact)
  const scriptLang = detectScriptFromUnicode(text);
  if (scriptLang) return scriptLang;

  // 2. Romanized Token Scoring
  const tokens = text.toLowerCase().match(/[a-zA-Z]+/g) || [];
  if (tokens.length === 0) return fallback;

  let hiScore = 0;
  let guScore = 0;
  let mrScore = 0;
  let taScore = 0;
  let teScore = 0;
  let bnScore = 0;

  for (const token of tokens) {
    if (HINDI_ROMAN_WORDS.has(token)) hiScore += 3;
    if (GUJARATI_ROMAN_WORDS.has(token)) guScore += 3;
    if (MARATHI_ROMAN_WORDS.has(token)) mrScore += 3;
    if (TAMIL_ROMAN_WORDS.has(token)) taScore += 3;
    if (TELUGU_ROMAN_WORDS.has(token)) teScore += 3;
    if (BENGALI_ROMAN_WORDS.has(token)) bnScore += 3;

    // Suffix heuristic for unseen words
    if (token.endsWith("vanu") || token.endsWith("chhe") || token.endsWith("chho")) guScore += 1.5;
    if (token.endsWith("karta") || token.endsWith("karo") || token.endsWith("raha") || token.endsWith("chahiye")) hiScore += 1.5;
  }

  const scores = [
    { lang: "hi-IN" as IndicLanguageCode, score: hiScore },
    { lang: "gu-IN" as IndicLanguageCode, score: guScore },
    { lang: "mr-IN" as IndicLanguageCode, score: mrScore },
    { lang: "ta-IN" as IndicLanguageCode, score: taScore },
    { lang: "te-IN" as IndicLanguageCode, score: teScore },
    { lang: "bn-IN" as IndicLanguageCode, score: bnScore },
  ];

  scores.sort((a, b) => b.score - a.score);
  if (scores[0].score >= 1.5) {
    return scores[0].lang;
  }

  return fallback;
}

// ── Instant Client-Side Transliteration Preview Dictionary ───────────────
const CLIENT_TRANSLITERATION_MAP: Record<string, string> = {
  // Hindi common words
  "mujhe": "मुझे",
  "kya": "क्या",
  "karna": "करना",
  "chahiye": "चाहिए",
  "chahie": "चाहिए",
  "karun": "करूँ",
  "karu": "करूँ",
  "karo": "करो",
  "hai": "है",
  "hain": "हैं",
  "main": "मैं",
  "mein": "में",
  "aap": "आप",
  "kaise": "कैसे",
  "kaisi": "कैसी",
  "ho": "हो",
  "naam": "नाम",
  "mera": "मेरा",
  "meri": "मेरी",
  "mere": "मेरे",
  "tujhe": "तुझे",
  "lagta": "लगता",
  "lagti": "लगती",
  "surya": "सूर्य",
  "mandal": "मंडल",
  "kitne": "कितने",
  "grah": "ग्रह",
  "prakash": "प्रकाश",
  "sanshleshan": "संश्लेषण",
  "batao": "बताओ",
  "namaste": "नमस्ते",
  "shukriya": "शुक्रिया",
  
  // Gujarati common words
  "kem": "કેમ",
  "chho": "છો",
  "cho": "છો",
  "chhe": "છે",
  "che": "છે",
  "mane": "મને",
  "tamne": "તમને",
  "tamaru": "તમારું",
  "maru": "મારું",
  "mari": "મારી",
  "jamvu": "જમવું",
  "jamvanu": "જમવાનું",
  "bhaviyu": "ભાવ્યું",
  "bahu": "બહુ",
  "aaji": "આજે",
  "aaje": "આજે",
  "nathi": "નથી",
  "ketla": "કેટલા",
  "graho": "ગ્રહો",
  "suryamandal": "સૂર્યમંડળ",
  "su": "શું",
  "shu": "શું",
  "shun": "શું",
  "lage": "લાગે",
  "tame": "તમે",
  "maja": "મજા",
  "majama": "મજામાં"
};

/**
 * Returns a high-speed instant native Indic script preview for the loading skeleton card.
 */
export function getIndicDisplayPreview(text: string, targetLang?: IndicLanguageCode): string {
  if (!text || !text.trim()) return "";
  
  // If already native Indic Unicode script, return immediately
  if (isIndicScript(text)) {
    return text.trim();
  }

  const detected = targetLang && targetLang !== "auto" ? targetLang : detectLanguageClient(text, "en-IN");
  if (detected === "en-IN") {
    return text.trim();
  }

  // Replace recognized phonetic words with native script words
  const words = text.split(/(\s+|[.,!?]+)/);
  const transliteratedWords = words.map((w) => {
    const clean = w.toLowerCase().trim();
    if (CLIENT_TRANSLITERATION_MAP[clean]) {
      return CLIENT_TRANSLITERATION_MAP[clean];
    }
    return w;
  });

  return transliteratedWords.join("");
}
