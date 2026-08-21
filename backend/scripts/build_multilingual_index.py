import os
import json
import faiss
import pickle
from loguru import logger
from datasets import load_dataset
from sentence_transformers import SentenceTransformer
from rank_bm25 import BM25Okapi
import numpy as np

from app.chunking.strategies import (
    FixedWindowChunker,
    SemanticChunker,
    RecursiveCharacterChunker,
    MetadataAwareChunker,
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX_DIR = os.path.join(BASE_DIR, "indexes")

def build_multilingual_index():
    os.makedirs(INDEX_DIR, exist_ok=True)
    
    logger.info("Initializing multi-strategy chunkers...")
    chunker = MetadataAwareChunker(primary_chunker=FixedWindowChunker(window_size=2, overlap=1))
    
    all_chunks = []

    # 1. Load English MS MARCO subset
    logger.info("Loading English MS MARCO corpus...")
    try:
        ds = load_dataset("mteb/msmarco", "corpus", split="corpus", streaming=True)
        for i, doc in enumerate(ds):
            if i >= 1000:
                break
            raw_text = doc.get("text", "")
            doc_id = doc.get("_id", f"en_{i}")
            doc_chunks = chunker.chunk(raw_text, metadata={"doc_id": doc_id, "lang": "en"})
            all_chunks.extend(doc_chunks)
        logger.info(f"Loaded English passages ({len(all_chunks)} chunks)")
    except Exception as e:
        logger.warning(f"Could not load remote English dataset: {e}")

    # 2. Rich Multilingual Gujarati & Hindi Knowledge Corpus
    multilingual_knowledge = [
        # ── Gujarati Knowledge Corpus (ai4bharat / MSMARCO-XI topics) ──
        {
            "doc_id": "gu_ai_1",
            "lang": "gu",
            "text": "કૃત્રિમ બુદ્ધિમત્તા (Artificial Intelligence) એ કમ્પ્યુટર વિજ્ઞાનની એક અદ્યતન શાખા છે. તે મશીનોને માનવ જેવી બુદ્ધિ, વિચારશક્તિ, શીખવાની ક્ષમતા અને નિર્ણય લેવાની શક્તિ પ્રદાન કરે છે. આજના યુગમાં AI નો ઉપયોગ આરોગ્ય, શિક્ષણ, ડ્રાઈવરલેસ કાર અને વૉઇસ આસિસ્ટન્ટ્સમાં વ્યાપકપણે થાય છે."
        },
        {
            "doc_id": "gu_solar_1",
            "lang": "gu",
            "text": "સૂર્યમંડળમાં સૂર્ય મુખ્ય તારો છે અને તેની આસપાસ 8 મુખ્ય ગ્રહો ભ્રમણ કરે છે. આ ગ્રહોમાં બુધ, શુક્ર, પૃથ્વી, મંગળ, ગુરુ, શનિ, યુરેનસ અને નેપ્ચ્યુનનો સમાવેશ થાય છે. પૃથ્વી સૂર્યથી ત્રીજો ગ્રહ છે જ્યાં જીવન શક્ય બન્યું છે."
        },
        {
            "doc_id": "gu_oppenheimer_1",
            "lang": "gu",
            "text": "જે. રોબર્ટ ઓપનહાઇમર એક અમેરિકન સૈદ્ધાંતિક ભૌતિકશાસ્ત્રી હતા. તેમને બીજા વિશ્વયુદ્ધ દરમિયાન લોસ એલામોસ લેબોરેટરીના ડિરેક્ટર તરીકે નિયુક્ત કરવામાં આવ્યા હતા અને તેઓ 'અણુબોમ્બના પિતા' તરીકે ઓળખાય છે. તેમણે મેનહટન પ્રોજેક્ટનું સફળ નેતૃત્વ કર્યું હતું."
        },
        {
            "doc_id": "gu_manhattan_1",
            "lang": "gu",
            "text": "મેનહટન પ્રોજેક્ટ બીજા વિશ્વયુદ્ધ દરમિયાન અમેરિકા, યુકે અને કેનેડા દ્વારા સંયુક્ત રીતે ચલાવવામાં આવેલ એક ગુપ્ત સંશોધન પ્રોજેક્ટ હતો. તેનો મુખ્ય ઉદ્દેશ્ય વિશ્વનો સૌપ્રથમ પરમાણુ બોમ્બ બનાવવાનો હતો, જેનું નેતૃત્વ જનરલ લેસ્લી ગ્રોવ્ઝ અને રોબર્ટ ઓપનહાઇમરે કર્યું હતું."
        },
        {
            "doc_id": "gu_quantum_1",
            "lang": "gu",
            "text": "ક્વોન્ટમ કમ્પ્યુટિંગ એ ક્વોન્ટમ મિકેનિક્સના સિદ્ધાંતો જેમ કે સુપરપોઝિશન અને એન્ટેંગલમેન્ટ પર આધારિત કમ્પ્યુટર તકનીક છે. તે પરંપરાગત બાઈનરી બિટ્સના બદલે ક્યુબિટ્સ (Qubits) નો ઉપયોગ કરે છે, જેનાથી અતિ જટિલ ગણતરીઓ અત્યંત ઝડપથી થઈ શકે છે."
        },
        {
            "doc_id": "gu_photo_1",
            "lang": "gu",
            "text": "પ્રકાશસંશ્લેષણ (Photosynthesis) એ જૈવિક રાસાયણિક પ્રક્રિયા છે જેના દ્વારા લીલી વનસ્પતિઓ સૂર્યપ્રકાશ, પાણી અને કાર્બન ડાયોક્સાઇડનો ઉપયોગ કરીને પોતાનો ખોરાક (ગ્લુકોઝ) બનાવે છે અને ઓક્સિજન વાયુ મુક્ત કરે છે."
        },

        # ── Tamil Knowledge Corpus (தமிழ்) ──
        {
            "doc_id": "ta_solar_1",
            "lang": "ta",
            "text": "சூரிய குடும்பத்தில் சூரியன் மையத்தில் உள்ளது மற்றும் அதைச் சுற்றி 8 கோள்கள் சுற்றி வருகின்றன. புதன், வெள்ளி, பூமி, செவ்வாய், வியாழன், சனி, யுரேனஸ் மற்றும் நெப்டியூன் ஆகியவை அந்த எட்டு கோள்கள் ஆகும். பூமி சூரியனிலிருந்து மூன்றாவது கோள் ஆகும்."
        },
        {
            "doc_id": "ta_ai_1",
            "lang": "ta",
            "text": "செயற்கை நுண்ணறிவு (Artificial Intelligence) என்பது கணினி அறிவியலின் ஒரு மேம்பட்ட பிரிவு. இது மனிதனைப் போல சிந்திக்கவும், கற்றுக்கொள்ளவும், முடிவெடுக்கவும் கூடிய இயந்திரங்களை உருவாக்குகிறது."
        },
        {
            "doc_id": "ta_photo_1",
            "lang": "ta",
            "text": "ஒளிச்சேர்க்கை (Photosynthesis) என்பது தாவரங்கள் சூரிய ஒளி, நீர் மற்றும் கார்பன் டை ஆக்சைடு ஆகியவற்றைப் பயன்படுத்தி தங்களுக்குத் தேவையான உணவை (குளுக்கோஸ்) தயாரித்து ஆக்ஸிஜனை வெளியிடும் உயிரியல் செயல்முறையாகும்."
        },

        # ── Telugu Knowledge Corpus (తెలుగు) ──
        {
            "doc_id": "te_solar_1",
            "lang": "te",
            "text": "సౌర వ్యవస్థలో సూర్యుడు కేంద్రంలో ఉంటాడు మరియు దాని చుట్టూ 8 గ్రహాలు తిరుగుతాయి. బుధుడు, శుక్రుడు, భూమి, కుజుడు, బృహస్పతి, శని, యురేనస్ మరియు నెప్ట్యూన్ ఆ ఎనిమిది గ్రహాలు."
        },
        {
            "doc_id": "te_ai_1",
            "lang": "te",
            "text": "కృత్రిమ మేధస్సు (Artificial Intelligence) అనేది కంప్యూటర్ సైన్స్ విభాగం, ఇది మానవుల వలె ఆలోచించగల మరియు నిర్ణయాలు తీసుకోగల తెలివైన యంత్రాలను అభివృద్ధి చేస్తుంది."
        },
        {
            "doc_id": "te_photo_1",
            "lang": "te",
            "text": "కిరణజన్య సంయోగక్రియ (Photosynthesis) అనేది మొక్కలు సూర్యరశ్మి, నీరు మరియు కార్బన్ డయాక్సైడ్ సహాయంతో ఆహారాన్ని తయారుచేసి ఆక్సిజన్‌ను విడుదల చేసే ప్రక్రియ."
        },

        # ── Bengali Knowledge Corpus (বাংলা) ──
        {
            "doc_id": "bn_solar_1",
            "lang": "bn",
            "text": "সৌরজগতে সূর্য কেন্দ্রে অবস্থিত এবং এর চারপাশে ৮টি প্রধান গ্রহ আবর্তন করছে। এই গ্রহগুলি হল বুধ, শুক্র, পৃথিবী, মঙ্গল, বৃহস্পতি, শনি, ইউরেনাস এবং নেপচুন।"
        },
        {
            "doc_id": "bn_ai_1",
            "lang": "bn",
            "text": "কৃত্রিম বুদ্ধিমত্তা (Artificial Intelligence) হলো কম্পিউটার বিজ্ঞানের একটি শাখা যা মানুষের মতো চিন্তাভাবনা এবং সিদ্ধান্ত গ্রহণে সক্ষম বুদ্ধিমান সিস্টেম তৈরি করে।"
        },
        {
            "doc_id": "bn_photo_1",
            "lang": "bn",
            "text": "সালোকসংশ্লেষ (Photosynthesis) হলো এমন একটি জৈব রাসায়নিক প্রক্রিয়া যার মাধ্যমে সবুজ উদ্ভিদ সূর্যালোক, জল এবং কার্বন ডাই অক্সাইড ব্যবহার করে নিজেদের খাদ্য তৈরি করে এবং অক্সিজেন নির্গমন করে।"
        },

        # ── Marathi Knowledge Corpus (मराठी) ──
        {
            "doc_id": "mr_solar_1",
            "lang": "mr",
            "text": "सूर्यमालेत सूर्य मध्यभागी असून त्याच्याभोवती ८ मुख्य ग्रह फिरतात. यामध्ये बुध, शुक्र, पृथ्वी, मंगळ, गुरू, शनी, युरेनस आणि नेपच्यून यांचा समावेश आहे."
        },
        {
            "doc_id": "mr_ai_1",
            "lang": "mr",
            "text": "कृत्रिम बुद्धिमत्ता (Artificial Intelligence) ही संगणक विज्ञानाची एक प्रगत शाखा आहे, ज्याद्वारे मानवाप्रमाणे विचार करू शकणाऱ्या आणि निर्णय घेऊ शकणाऱ्या यंत्रांची निर्मिती केली जाते."
        },
        {
            "doc_id": "mr_photo_1",
            "lang": "mr",
            "text": "प्रकाशसंश्लेषण (Photosynthesis) ही वनस्पतींची अशी प्रक्रिया आहे ज्यामध्ये सूर्यप्रकाश, पाणी आणि कार्बन डायऑक्साईडचा वापर करून अन्न तयार केले जाते आणि ऑक्सिजन सोडला जातो."
        },

        # ── Kannada Knowledge Corpus (ಕನ್ನಡ) ──
        {
            "doc_id": "kn_solar_1",
            "lang": "kn",
            "text": "ಸೌರವ್ಯೂಹದಲ್ಲಿ ಸೂರ್ಯನು ಕೇಂದ್ರದಲ್ಲಿದ್ದು, ಅದರ ಸುತ್ತಲೂ 8 ಪ್ರಮುಖ ಗ್ರಹಗಳು ಸುತ್ತುತ್ತವೆ. ಅವುಗಳೆಂದರೆ ಬುಧ, ಶುಕ್ರ, ಭೂಮಿ, ಮಂಗಳ, ಗುರು, ಶನಿ, ಯುರೇನಸ್ ಮತ್ತು ನೆಪ್ಚೂನ್."
        },
        {
            "doc_id": "kn_ai_1",
            "lang": "kn",
            "text": "ಕೃತಕ ಬುದ್ಧಿಮತ್ತೆ (Artificial Intelligence) ಕಂಪ್ಯೂಟರ್ ವಿಜ್ಞಾನದ ಒಂದು ಶಾಖೆಯಾಗಿದ್ದು, ಇದು ಮಾನವರಂತೆ ಯೋಚಿಸುವ ಮತ್ತು ನಿರ್ಧಾರ ತೆಗೆದುಕೊಳ್ಳುವ ಯಂತ್ರಗಳನ್ನು ರೂಪಿಸುತ್ತದೆ."
        },

        # ── Malayalam Knowledge Corpus (മലയാളം) ──
        {
            "doc_id": "ml_solar_1",
            "lang": "ml",
            "text": "സൗരയൂഥത്തിൽ സൂര്യൻ കേന്ദ്രമായി നിലകൊള്ളുന്നു, അതിനെ ചുറ്റി 8 ഗ്രഹങ്ങൾ സഞ്ചരിക്കുന്നു. ബുധൻ, ശുക്രൻ, ഭൂമി, ചൊവ്വ, വ്യാഴം, ശനി, യുറാനസ്, നെപ്റ്റ്യൂൺ എന്നിവയാണ് അവ."
        },
        {
            "doc_id": "ml_ai_1",
            "lang": "ml",
            "text": "കൃത്രിമ ബുദ്ധി (Artificial Intelligence) എന്നത് മനുഷ്യനെപ്പോലെ ചിന്തിക്കാനും തീരുമാനങ്ങൾ എടുക്കാനും കഴിവുള്ള കമ്പ്യൂട്ടർ സിസ്റ്റങ്ങളെ വികസിപ്പിക്കുന്ന ശാസ്ത്രശാഖയാണ്."
        },

        # ── Punjabi Knowledge Corpus (ਪੰਜਾਬੀ) ──
        {
            "doc_id": "pa_solar_1",
            "lang": "pa",
            "text": "ਸੂਰਜੀ ਪਰਿਵਾਰ ਵਿੱਚ ਸੂਰਜ ਕੇਂਦਰ ਵਿੱਚ ਹੈ ਅਤੇ ਇਸਦੇ ਦੁਆਲੇ 8 ਮੁੱਖ ਗ੍ਰਹਿ ਘੁੰਮਦੇ ਹਨ: ਬੁੱਧ, ਸ਼ੁੱਕਰ, ਧਰਤੀ, ਮੰਗਲ, ਬ੍ਰਹਿਸਪਤੀ, ਸ਼ਨੀ, ਯੂਰੇਨਸ ਅਤੇ ਨੈਪਚਿਊਨ।"
        },

        # ── Odia Knowledge Corpus (ଓଡ଼ିଆ) ──
        {
            "doc_id": "or_solar_1",
            "lang": "or",
            "text": "ସୌରମଣ୍ଡଳରେ ସୂର୍ଯ୍ୟ କେନ୍ଦ୍ରରେ ଅବସ୍ଥିତ ଏବଂ ଏହା ଚାରିପାଖରେ ୮ଟି ମୁଖ୍ୟ ଗ୍ରହ ପରିକ୍ରମା କରନ୍ତି ଯଥା ବୁଧ, ଶୁକ୍ର, ପୃଥିବୀ, ମଙ୍ଗଳ, ବୃହସ୍ପତି, ଶନି, ୟୁରେନସ ଓ ନେପଚ୍ୟୁନ।"
        },
    ]

    for item in multilingual_knowledge:
        chunks = chunker.chunk(item["text"], metadata={"doc_id": item["doc_id"], "lang": item["lang"]})
        all_chunks.extend(chunks)

    logger.info(f"Total chunks indexed across all languages: {len(all_chunks)}")

    # 3. Sparse BM25 Index
    logger.info("Building Sparse BM25 index...")
    corpus_tokens = [c["text"].lower().split() for c in all_chunks]
    bm25 = BM25Okapi(corpus_tokens)
    bm25_path = os.path.join(INDEX_DIR, "msmarco.bm25")
    with open(bm25_path, "wb") as f:
        pickle.dump(bm25, f)
    logger.info(f"Saved BM25 to {bm25_path}")

    # 4. Dense FAISS Vector Index
    logger.info("Building Dense FAISS Index...")
    model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    texts = [c["text"] for c in all_chunks]
    embeddings = model.encode(texts, show_progress_bar=True, normalize_embeddings=True)

    dim = embeddings.shape[1]
    faiss_index = faiss.IndexFlatIP(dim)
    faiss_index.add(embeddings)
    faiss_path = os.path.join(INDEX_DIR, "msmarco.faiss")
    faiss.write_index(faiss_index, faiss_path)
    logger.info(f"Saved FAISS to {faiss_path}")

    # 5. Metadata JSONL
    metadata_path = os.path.join(INDEX_DIR, "metadata.jsonl")
    with open(metadata_path, "w", encoding="utf-8") as f:
        for c in all_chunks:
            record = {
                "id": c["metadata"].get("doc_id", ""),
                "text": c["text"],
                "lang": c["metadata"].get("lang", "en"),
                "strategy": c.get("strategy", "fixed_window"),
                "metadata": c.get("metadata", {})
            }
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    logger.info(f"Saved metadata to {metadata_path}")
    logger.info("Multilingual Indexing Complete! 🎉")

if __name__ == "__main__":
    build_multilingual_index()
