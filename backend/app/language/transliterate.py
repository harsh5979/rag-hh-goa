import time
from typing import Optional, Dict
import httpx
from loguru import logger

from app.config import get_settings
from app.language.detector import get_language_detector, is_indic_script

SARVAM_TRANSLITERATE_URL = "https://api.sarvam.ai/transliterate"

class IndicTransliterator:
    """
    High-performance asynchronous transliterator for Romanized Indic text.
    Maintains an in-memory LRU cache and persistent HTTP connection pool.
    """

    def __init__(self):
        self._cache: Dict[str, str] = {}
        self._client: Optional[httpx.AsyncClient] = None
        self._detector = get_language_detector()

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=10.0,
                limits=httpx.Limits(max_keepalive_connections=20, max_connections=50)
            )
        return self._client

    async def transliterate(
        self,
        text: str,
        target_language_code: Optional[str] = None
    ) -> str:
        """
        Transliterates English/Latin text (e.g. 'kem chho' or 'mane jamvu chhe')
        into native Indic script (e.g. 'કેમ છો' or 'મને જમવું છે').
        """
        if not text or not text.strip():
            return text

        # If already native Indic Unicode script, no transliteration required
        if is_indic_script(text):
            return text

        # If no target language specified or set to auto/unknown, detect dynamically
        if not target_language_code or target_language_code in ("unknown", "auto", "en-IN"):
            target_language_code = self._detector.detect_latin_indic_language(text)
            if target_language_code == "en-IN":
                return text  # Pure English text

        cache_key = f"{target_language_code}:{text.strip().lower()}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        settings = get_settings()
        if not settings.sarvam_api_key:
            return text

        headers = {
            "api-subscription-key": settings.sarvam_api_key,
            "Content-Type": "application/json"
        }
        payload = {
            "input": text.strip(),
            "source_language_code": "en-IN",
            "target_language_code": target_language_code
        }

        t0 = time.perf_counter()
        client = self._get_client()
        try:
            res = await client.post(SARVAM_TRANSLITERATE_URL, headers=headers, json=payload)
            if res.status_code == 200:
                result = res.json()
                out = result.get("transliterated_text", "").strip()
                if out:
                    ms_elapsed = (time.perf_counter() - t0) * 1000
                    logger.info(f"Transliterated [{target_language_code}] in {ms_elapsed:.1f}ms: '{text}' -> '{out}'")
                    if len(self._cache) < 1000:
                        self._cache[cache_key] = out
                    return out
        except Exception as e:
            logger.warning(f"Transliteration request fallback ({target_language_code}): {e}")

        return text


# ── Global Singleton & Convenience Functions ────────────────────────────────
_TRANSLITERATOR = IndicTransliterator()

def get_transliterator() -> IndicTransliterator:
    return _TRANSLITERATOR

async def transliterate_indic_text(text: str, target_language_code: Optional[str] = None) -> str:
    return await _TRANSLITERATOR.transliterate(text, target_language_code=target_language_code)
