import re
from typing import List
from transformers import pipeline
from better_profanity import profanity
from loguru import logger

from app.schemas import GuardrailResult

# Queries shorter than this length are always flagged as off-topic greetings/noise
MIN_QUERY_LENGTH = 5

# Explicit greeting / chit-chat patterns that must be blocked before any LLM call
_OFFTOPIC_PATTERNS = re.compile(
    r"^\s*("
    r"hello|hi|hey|sup|howdy|hiya|yo|hola|namaste|"
    r"नमस्ते|नमस्कार|प्रणाम|हैलो|हाय|"
    r"નમસ્તે|નમસ્કાર|કેમ છો|હાય|હેલો|"
    r"how are you|how r u|what('s| is) up|wassup|what's good|"
    r"good morning|good evening|good night|good afternoon|"
    r"thank(s| you)|bye|goodbye|see you|ttyl|"
    r"who are you|what are you|tell me about yourself|"
    r"can you help|are you there|is anybody there|"
    r"lol|lmao|haha|okay|ok|yes|no|sure|nope|yep|nah"
    r")\s*[!?.]*\s*$",
    re.IGNORECASE
)

# Queries that are clearly out-of-scope programming / code requests
_CODE_PATTERNS = re.compile(
    r"\b("
    r"write (me )?(a |the )?(program|code|script|function|class|algorithm)|"
    r"implement|debug|fix this code|how to code|coding|programming|"
    r"what is (js|javascript|python|java|c\+\+|cpp|html|css|sql|react|node|php|rust|typescript)|"
    r"javascript|python code|java code|react js|node js|html css|c\+\+|"
    r"leetcode|hackerrank|github repo|api endpoint|function in|"
    r"કોડ|પ્રોગ્રામિંગ|કોડિંગ|જાવાસ્ક્રિપ્ટ|પાયથોન|"
    r"प्रोग्रामिंग|कोडिंग|जावास्क्रिप्ट|पायथन"
    r")\b",
    re.IGNORECASE
)

# Must-be-information-retrieval topics we serve
_ALLOWED_TOPICS = [
    "information retrieval", "question answering", "text search",
    "natural language processing", "machine learning", "data science",
    "science", "history", "geography", "biology", "physics", "chemistry",
    "technology", "engineering", "mathematics", "economics", "medicine",
    "general knowledge", "facts", "definitions", "explanations",
]

_BLOCKED_TOPICS = [
    "harmful instructions", "violence", "illegal activities",
    "casual conversation", "personal chat", "greeting", "social talk",
]


class GuardrailManager:
    def __init__(self):
        profanity.load_censor_words()

        try:
            self.zero_shot = pipeline(
                "zero-shot-classification",
                model="cross-encoder/nli-deberta-v3-small"
            )
            logger.info("Loaded zero-shot classifier for guardrails")
        except Exception as e:
            logger.warning(f"Could not load zero-shot classifier: {e}")
            self.zero_shot = None

        self.email_regex = re.compile(r"[\w\.-]+@[\w\.-]+\.\w+")
        self.phone_regex = re.compile(r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b")

    # ── Toxicity ──────────────────────────────────────────────────────────
    def check_toxicity(self, text: str) -> GuardrailResult:
        if profanity.contains_profanity(text):
            return GuardrailResult(passed=False, reason="Inappropriate language detected", type="toxicity")
        return GuardrailResult(passed=True, type="toxicity")

    # ── PII ───────────────────────────────────────────────────────────────
    def check_pii(self, text: str) -> GuardrailResult:
        if self.email_regex.search(text) or self.phone_regex.search(text):
            return GuardrailResult(passed=False, reason="PII (email/phone) detected — not stored or answered", type="pii")
        return GuardrailResult(passed=True, type="pii")

    # ── Off-topic / Greeting ──────────────────────────────────────────────
    def check_topic(self, text: str, is_voice: bool = False) -> GuardrailResult:
        text_clean = text.strip()

        # 1. Greeting / chit-chat match -> flag as greeting (skip for voice)
        if not is_voice and (_OFFTOPIC_PATTERNS.match(text_clean) or text_clean.lower() in ("hi", "hello", "hey", "namaste", "help", "start")):
            return GuardrailResult(
                passed=False,
                reason="greeting",
                type="greeting",
            )

        # 2. Too short (< 3 chars) (skip for voice)
        if not is_voice and len(text_clean) < 3:
            return GuardrailResult(
                passed=False,
                reason="greeting",
                type="greeting",
            )

        # 3. Code generation request
        if _CODE_PATTERNS.search(text_clean):
            return GuardrailResult(
                passed=False,
                reason="Code generation requests are out of scope. This system answers factual questions from documents.",
                type="off-topic",
            )

        # Fast-path: Allow all other questions directly into high-speed retrieval
        return GuardrailResult(passed=True, type="off-topic")

    def run_all(self, text: str, is_voice: bool = False) -> List[GuardrailResult]:
        return [
            self.check_toxicity(text),
            self.check_pii(text),
            self.check_topic(text, is_voice=is_voice)
        ]


# Singleton
_manager = None

def init_guardrails():
    global _manager
    _manager = GuardrailManager()

def get_guardrails() -> GuardrailManager:
    if _manager is None:
        raise RuntimeError("Guardrails not initialized. Call init_guardrails() first.")
    return _manager
