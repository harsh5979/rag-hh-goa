import { IndicLanguageCode } from "../voice/types";

// ── Unicode Script Range Detection (All 11 Indic Scripts) ─────────────────
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

// ── Romanized Lexical Markers for 4 Fast Auto-Detection Targets ───────────
const HINDI_ROMAN_WORDS = new Set([
  "mujhe", "mujhko", "mera", "meri", "mere", "hum", "tum", "aap", "kya", "kyun",
  "kyu", "karna", "kare", "karo", "karta", "karti", "karte", "karun", "karu", "chahiye",
  "chahie", "hai", "hain", "ho", "kaise", "kaisi", "kaisa", "lagta", "lagti", "lagte", "lag",
  "naam", "tujhe", "tujhko", "tera", "teri", "tere", "batao", "bataiye", "samjhao",
  "prakash", "sanshleshan", "surya", "mandal", "kitne", "kitna", "kitni", "grah", "graha",
  "kahan", "kab", "kaun", "kripya", "kripa", "namaste", "shukriya", "bhai", "hoga", "hogi", "hoge",
  "aisa", "aise", "aisi", "abhi", "kabhi", "jab", "tab", "nahane", "nahan", "jana", "jaana",
  "aana", "aata", "aati", "aate", "raha", "rahe", "rahi", "acha", "achha", "achhi", "achhe",
  "theek", "thik", "nahin", "nhi", "nahii", "bohot", "bahut", "kuch", "kuchh", "ki", "toh", "to"
]);

const GUJARATI_ROMAN_WORDS = new Set([
  "kem", "chho", "cho", "mane", "tamne", "tamaru", "tamari", "tamaro", "maru", "mari",
  "maro", "su", "shu", "shun", "lage", "chhe", "che", "chhiye", "jamvu", "jamvanu",
  "bhaviyu", "bhavya", "bahu", "aaji", "aaje", "nathi", "aave", "aavse", "ketla", "ketli",
  "ketlo", "graho", "suryamandal", "kyare", "kyan", "kai", "kone", "khabar", "maja",
  "majama", "tame", "ame", "mate", "karan", "bolvu", "samjavu", "sharu", "kariye",
  "halo", "kaho", "bhai", "ben"
]);

const MARATHI_ROMAN_WORDS = new Set([
  "tula", "mala", "tyala", "tila", "amhi", "aamhi", "tumhi", "apan", "aapan",
  "majha", "majhi", "majhe", "tujha", "tujhi", "tujhe", "tyacha", "tyachi", "tyache",
  "kay", "kai", "kasa", "kashi", "kase", "kuthe", "kathe", "kadhi", "kiti", "kashala",
  "kashamule", "kashat", "sangu", "sanga", "sang", "sangto", "sangte", "sangtat", "naka", "nako",
  "aahe", "ahe", "aahet", "ahet", "nahi", "nahit", "zhale", "jhale", "jhala", "zala", "zali",
  "hot", "hota", "hoti", "hote", "karu", "kara", "kar", "karaycha", "karayche", "karaychi",
  "karte", "karto", "kartat", "bol", "bolu", "bola", "bolte", "bolto", "boltat",
  "dakhav", "dakhva", "shikva", "samjav", "thik", "chalel", "chalalay", "karnare",
  "mahit", "mahiti", "kahi", "kahich", "dhanyavad", "namaskar"
]);

const ENGLISH_ROMAN_WORDS = new Set([
  "hello", "hi", "hey", "what", "is", "how", "are", "you", "who", "when", "where",
  "why", "can", "tell", "explain", "project", "manhattan", "photosynthesis", "solar", "system"
]);

export function detectLanguageClient(text: string, fallback: IndicLanguageCode = "en-IN"): IndicLanguageCode {
  if (!text || !text.trim()) return fallback;

  // 1. Unicode Script Check (100% exact for all 11 scripts)
  const scriptLang = detectScriptFromUnicode(text);
  if (scriptLang) return scriptLang;

  // 2. Romanized Token Scoring (4 Fast Core Auto-Detect Targets)
  const tokens = text.toLowerCase().match(/[a-zA-Z]+/g) || [];
  if (tokens.length === 0) return fallback;

  let hiScore = 0;
  let guScore = 0;
  let mrScore = 0;
  let enScore = 0;

  for (const token of tokens) {
    if (HINDI_ROMAN_WORDS.has(token)) hiScore += 3;
    if (GUJARATI_ROMAN_WORDS.has(token)) guScore += 3;
    if (MARATHI_ROMAN_WORDS.has(token)) mrScore += 3;
    if (ENGLISH_ROMAN_WORDS.has(token)) enScore += 3;

    // Suffix heuristic for unseen words
    if (token.endsWith("vanu") || token.endsWith("chhe") || token.endsWith("chho")) guScore += 1.5;
    if (token.endsWith("karta") || token.endsWith("karo") || token.endsWith("raha") || token.endsWith("chahiye")) hiScore += 1.5;
    if (token.endsWith("tay") || token.endsWith("tat") || token.endsWith("chya") || token.endsWith("sathi")) mrScore += 1.5;
  }

  const scores = [
    { lang: "gu-IN" as IndicLanguageCode, score: guScore },
    { lang: "hi-IN" as IndicLanguageCode, score: hiScore },
    { lang: "mr-IN" as IndicLanguageCode, score: mrScore },
    { lang: "en-IN" as IndicLanguageCode, score: enScore },
  ];

  scores.sort((a, b) => b.score - a.score);
  if (scores[0].score >= 1.5) {
    return scores[0].lang;
  }

  return fallback;
}

// ── Instant Client-Side Transliteration Preview Dictionary ───────────────
const CLIENT_TRANSLITERATION_MAP: Record<string, string> = {
  // Marathi common words
  "tula": "तुला",
  "kai": "काय",
  "kay": "काय",
  "sangu": "सांगू",
  "naka": "नका",
  "nako": "नको",
  "sanga": "सांगा",
  "sang": "सांग",
  "mala": "मला",
  "tyala": "त्याला",
  "tila": "तिला",
  "amhi": "आम्ही",
  "aamhi": "आम्ही",
  "tumhi": "तुम्ही",
  "apan": "आपण",
  "aapan": "आपण",
  "kasa": "कसा",
  "kashi": "कशी",
  "kase": "कसे",
  "kuthe": "कुठे",
  "kadhi": "कधी",
  "kiti": "किती",
  "kashala": "कशाला",
  "ahe": "आहे",
  "aahe": "आहे",
  "ahet": "आहेत",
  "aahet": "आहेत",
  "nahi": "नाही",
  "nahit": "नाहीत",
  "zhale": "झाले",
  "jhale": "झाले",
  "chalalay": "चाललय",
  "thik": "ठीक",
  "kahi": "काही",
  "kahich": "काहीच",
  "bolu": "बोलू",
  "bola": "बोला",
  "bol": "बोल",
  "mahiti": "माहिती",
  "mahit": "माहित",

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
  "aisa": "ऐसा",
  "aise": "ऐसे",
  "aisi": "ऐसी",
  "abhi": "अभी",
  "kabhi": "कभी",
  "nahane": "नहाने",
  "nahan": "नहाना",
  "jana": "जाना",
  "jaana": "जाना",
  "aana": "आना",
  "lag": "लग",
  "raha": "रहा",
  "rahe": "रहे",
  "rahi": "रही",
  "ki": "कि",
  "toh": "तो",
  "to": "तो",
  "theek": "ठीक",
  "thik": "ठीक",
  "acha": "अच्छा",
  "achha": "अच्छा",
  "bahut": "बहुत",
  "kuch": "कुछ",
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
