import json
import logging
import re

from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from app.core.config import settings

logger = logging.getLogger(__name__)

llm = ChatGroq(
    model=settings.GROQ_MODEL,
    api_key=settings.GROQ_API_KEY,
    temperature=0.1,
)

# Separate Groq client for the legal-doc classifier.
# Same API key, different model → independent rate-limit pool on Groq
# (per-model pools, not per-key). 12x cheaper input/output than the 70B,
# fastest Groq model, plenty smart for binary classification.
classifier_llm = ChatGroq(
    model=settings.GROQ_CLASSIFIER_MODEL,
    api_key=settings.GROQ_API_KEY,
    temperature=0.0,
    model_kwargs={"response_format": {"type": "json_object"}},
)

ANALYSIS_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        "You are an expert Indian legal document analyst. "
        "Analyze the document and return ONLY valid JSON (no markdown fencing) with this exact structure:\n"
        '{{\n'
        '  "title": "document title inferred from content",\n'
        '  "type": "document type (FIR, Bail Application, Rental Agreement, Court Order, Legal Notice, Contract, etc.)",\n'
        '  "summary": "multi-paragraph summary separated by \\n\\n. Be thorough — cover key facts, parties, dates, and legal implications.",\n'
        '  "lawReferences": [\n'
        '    {{"section": "Section X of Act", "description": "what this section covers", "type": "primary|related|procedural"}}\n'
        '  ],\n'
        '  "suggestions": ["actionable suggestion 1", "suggestion 2", ...]\n'
        '}}\n'
        "Include at least 3-5 law references and 4-6 suggestions. "
        "Focus on Indian law (BNS, BNSS, CPC, specific Acts). "
        "Return ONLY the JSON.",
    ),
    ("human", "Analyze this legal document:\n\n{text}"),
])


async def analyze_document(text: str, pages: int, upload_date: str) -> dict:
    """Run AI analysis on document text. Returns dict matching DocumentAnalysis schema."""
    chain = ANALYSIS_PROMPT | llm
    response = await chain.ainvoke({"text": text[:15000]})
    result = json.loads(response.content)
    result["pages"] = pages
    result["date"] = upload_date
    return result


# ----- Legal-document classifier (Indian-law content gate) -----
#
# Two-stage hybrid:
#   Stage A — regex pre-scan over a curated Indian-legal marker list (5 categories)
#   Stage B — Groq LLM (llama-3.1-8b-instant) confirmation with strict India-only prompt
#
# Both stages must agree. Fail-strict: if Stage B errors out, fall back to Stage A
# threshold alone; if even that fails, REJECT. False positives (junk accepted) are
# considered worse than false negatives (real doc bounced — user can retry).

INDIAN_STATUTE_PATTERNS = [
    # Modern criminal codes (2023 reform)
    r"\bBharatiya Nyaya Sanhita\b", r"\bBNS\b",
    r"\bBharatiya Nagarik Suraksha Sanhita\b", r"\bBNSS\b",
    r"\bBharatiya Sakshya (Adhiniyam|Bill)\b", r"\bBSA\b",
    # Pre-2023 codes (still cited in older docs)
    r"\bIndian Penal Code\b", r"\bI\.?P\.?C\.?\b",
    r"\bCode of Criminal Procedure\b", r"\bCr\.?P\.?C\.?\b",
    r"\bCode of Civil Procedure\b", r"\bC\.?P\.?C\.?\b",
    r"\bIndian Evidence Act\b",
    # Constitutional + civil
    r"\bConstitution of India\b",
    r"\bIndian Contract Act\b",
    r"\bTransfer of Property Act\b",
    r"\bRegistration Act\b",
    r"\bSpecific Relief Act\b",
    r"\bNegotiable Instruments Act\b",
    r"\bCompanies Act\b",
    r"\bArbitration and Conciliation Act\b",
    r"\bConsumer Protection Act\b",
    r"\bIncome[- ]Tax Act\b",
    r"\bGoods and Services Tax Act\b",
    r"\bHindu Marriage Act\b",
    r"\bMuslim Personal Law\b",
    r"\bMotor Vehicles Act\b",
    r"\bProtection of Women from Domestic Violence Act\b",
    r"\bPOCSO\b", r"\bNDPS\b", r"\bUAPA\b", r"\bPMLA\b",
    # Devanagari (Hindi) — for OCR'd Hindi legal docs
    r"भारतीय न्याय संहिता",
    r"भारतीय नागरिक सुरक्षा संहिता",
    r"भारतीय साक्ष्य अधिनियम",
    r"भारतीय दण्ड संहिता",
    r"दण्ड प्रक्रिया संहिता",
    r"भारत का संविधान",
    r"अधिनियम",
]

INDIAN_SECTION_PATTERNS = [
    r"\bSection\s+\d+[A-Z]?\b",
    r"\bArticle\s+\d+[A-Z]?\s+of the Constitution\b",
    r"\bu/s\s+\d+\b",
    r"\br/w\s+(Section|s\.)\s*\d+\b",
    r"\bSub[- ]Section\s*\(\d+\)\b",
    r"\bClause\s+\(\w+\)\s+of\s+Section\b",
    # Devanagari
    r"धारा\s*\d+",
    r"अनुच्छेद\s*\d+",
    r"उपधारा",
]

INDIAN_COURT_PATTERNS = [
    r"\bSupreme Court of India\b",
    r"\bHigh Court of [A-Z][a-z]+\b",
    r"\b[A-Z][a-z]+ High Court\b",
    r"\bDistrict (Court|Judge)\b",
    r"\bSessions (Court|Judge)\b",
    r"\bChief Judicial Magistrate\b", r"\bC\.?J\.?M\.?\b",
    r"\bMetropolitan Magistrate\b",
    r"\bJudicial Magistrate (First|1st) Class\b",
    r"\bTribunal\b",
    r"\bLok Adalat\b",
    r"\bHon'?ble\b", r"\bHis Lordship\b", r"\bHer Ladyship\b",
    # Devanagari
    r"उच्चतम न्यायालय",
    r"उच्च न्यायालय",
    r"न्यायालय",
    r"न्यायाधीश",
    r"लोक अदालत",
    r"माननीय",
]

INDIAN_PROCEDURAL_PATTERNS = [
    r"\bPetitioner\b", r"\bRespondent\b",
    r"\bPlaintiff\b", r"\bDefendant\b",
    r"\bComplainant\b", r"\bAccused\b",
    r"\bAppellant\b", r"\bDeponent\b",
    r"\bVakalatnama\b", r"\bAffidavit\b",
    r"\bIn the matter of\b",
    r"\b(WHEREAS|hereinafter referred to as)\b",
    r"\bShri\s+[A-Z]", r"\bSmt\.?\s+[A-Z]",
    r"\bSworn (before|on this)\b",
    r"\bSolemnly affirm(ed)?\b",
    # Devanagari
    r"याचिकाकर्ता",
    r"प्रतिवादी",
    r"वादी",
    r"अभियुक्त",
    r"शिकायतकर्ता",
    r"शपथ पत्र",
    r"वकालतनामा",
    r"श्री\s",
    r"श्रीमती\s",
]

INDIAN_DOCTYPE_PATTERNS = [
    r"\bFirst Information Report\b", r"\bF\.?I\.?R\.?\b",
    r"\bBail Application\b", r"\bAnticipatory Bail\b",
    r"\bCharge[- ]?sheet\b",
    r"\bWrit Petition\b", r"\bPublic Interest Litigation\b", r"\bPIL\b",
    r"\bSpecial Leave Petition\b", r"\bSLP\b",
    r"\bLegal Notice\b", r"\bDemand Notice\b",
    r"\bPower of Attorney\b",
    r"\b(Sale|Lease|Rent|Gift) Deed\b",
    r"\bMemorandum of Understanding\b", r"\bMoU\b",
    r"\bNon[- ]Disclosure Agreement\b", r"\bNDA\b",
    r"\b(Employment|Service|Partnership|Franchise) Agreement\b",
    r"\bPlaint\b", r"\bWritten Statement\b",
    r"\bJudgment\b", r"\bOrder\b", r"\bDecree\b",
    # Devanagari
    r"प्रथम सूचना रिपोर्ट",
    r"जमानत आवेदन",
    r"आरोप पत्र",
    r"रिट याचिका",
    r"कानूनी नोटिस",
    r"विक्रय विलेख",
    r"पट्टा विलेख",
    r"निर्णय",
    r"आदेश",
    r"डिक्री",
]

_INDIAN_LEGAL_CATEGORIES = [
    ("statute",     INDIAN_STATUTE_PATTERNS),
    ("section",     INDIAN_SECTION_PATTERNS),
    ("court",       INDIAN_COURT_PATTERNS),
    ("procedural",  INDIAN_PROCEDURAL_PATTERNS),
    ("doctype",     INDIAN_DOCTYPE_PATTERNS),
]

# Pre-compile once at import time — re.compile in a hot path is wasteful.
_COMPILED_CATEGORIES = [
    (name, [re.compile(p, re.IGNORECASE) for p in patterns])
    for name, patterns in _INDIAN_LEGAL_CATEGORIES
]


def indian_legal_marker_score(text: str) -> tuple[int, set[str], list[str]]:
    """Stage A: count Indian-legal markers in text.

    Returns (total_hits, categories_hit, sample_matches).
    Strict-mode acceptance threshold = >=2 categories AND >=3 total hits.
    """
    sample = text[:8000]  # legal docs front-load identifiers
    categories_hit: set[str] = set()
    sample_matches: list[str] = []
    total_hits = 0
    for category, patterns in _COMPILED_CATEGORIES:
        for pat in patterns:
            matches = pat.findall(sample)
            if matches:
                categories_hit.add(category)
                total_hits += len(matches)
                if len(sample_matches) < 5:
                    first = matches[0]
                    sample_matches.append(first if isinstance(first, str) else str(first))
    return total_hits, categories_hit, sample_matches


LEGAL_CLASSIFIER_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        "You are a STRICT binary classifier for INDIAN legal documents. Be conservative — "
        "when in doubt, classify as NOT legal. False positives (accepting a non-legal doc) are "
        "much worse than false negatives.\n\n"
        "ACCEPT as legal ONLY if the document is one of these AND has clear Indian-jurisdiction signals:\n"
        "- Court documents: judgments, orders, decrees, FIRs, charge-sheets, bail applications, "
        "  writ petitions, SLPs, plaints, written statements, vakalatnamas\n"
        "- Statutes/acts: BNS, BNSS, BSA, IPC, CrPC, CPC, Constitution of India, Indian Contract Act, "
        "  any Indian central/state Act\n"
        "- Contracts under Indian law: NDAs, employment contracts, lease/rent/sale deeds, MoUs, POAs, "
        "  partnership deeds, service agreements (must reference Indian parties/jurisdiction)\n"
        "- Notices: legal notices, demand notices, government notifications, gazette notifications\n"
        "- Affidavits, declarations, sworn statements\n\n"
        "REJECT (is_legal=false) for:\n"
        "- Resumes, CVs, cover letters, college notes, lecture transcripts, recipes, novels, "
        "  marketing copy, blog posts, news articles\n"
        "- Plain invoices/receipts WITHOUT contract terms\n"
        "- Documents from non-Indian jurisdictions with no Indian connection (e.g. pure US contract "
        "  with no Indian party) — set jurisdiction='non-india'\n"
        "- Generic forms with no legal content\n"
        "- Image-only PDFs where extracted text is gibberish or empty\n\n"
        "Return ONLY valid JSON (no markdown fence): "
        '{{"is_legal": true_or_false, "jurisdiction": "india"|"non-india"|"unknown", '
        '"doc_type": "short label or unknown", "reason": "one short sentence"}}',
    ),
    ("human", "First 3000 characters of extracted document text:\n\n{text}"),
])


async def classify_legal_document(text: str) -> tuple[bool, str]:
    """Hybrid Indian-legal classifier. Returns (is_legal, reason).

    Strict mode — both stages must agree:
      Stage A: regex marker scan (>=2 categories AND >=3 hits = strong signal)
      Stage B: Groq LLM confirmation (is_legal=true AND jurisdiction in {india, unknown})

    Decision matrix:
      | Stage A      | Stage B      | Result                                 |
      | zero hits    | (skipped)    | REJECT — saves LLM cost on obvious junk |
      | >=1 hit      | legal+india  | ACCEPT                                 |
      | >=1 hit      | legal+unknown| ACCEPT only if Stage A is strong       |
      | >=1 hit      | not legal    | REJECT — LLM is more authoritative     |
      | (any)        | non-india    | REJECT — Indian-only product           |
      | error/empty  | (skipped)    | REJECT                                 |
    """
    if not text or len(text.strip()) < 100:
        return False, "Document contains no extractable text or is too short"

    hits, categories, samples = indian_legal_marker_score(text)
    logger.info(
        f"[legal-classifier] Stage A: hits={hits} categories={categories} samples={samples}"
    )

    # Fast reject — zero Indian markers, skip the LLM call entirely
    if hits == 0:
        return False, (
            "No Indian-legal markers found "
            "(zero matches across statutes/sections/courts/procedural/doctype)"
        )

    # Stage B — LLM confirmation
    try:
        chain = LEGAL_CLASSIFIER_PROMPT | classifier_llm
        response = await chain.ainvoke({"text": text[:3000]})
        result = json.loads(response.content)
    except Exception as e:
        logger.warning(f"[legal-classifier] Stage B error: {e}")
        # Fail-strict: if LLM hiccups, fall back to keyword threshold alone
        if len(categories) >= 2 and hits >= 3:
            return True, "Accepted on keyword threshold (LLM unavailable)"
        return False, "Could not verify legal status"

    is_legal = bool(result.get("is_legal", False))
    jurisdiction = result.get("jurisdiction", "unknown")
    reason = result.get("reason", "")
    logger.info(
        f"[legal-classifier] Stage B: is_legal={is_legal} jurisdiction={jurisdiction} reason={reason}"
    )

    if not is_legal:
        return False, reason or "LLM classifier rejected"
    if jurisdiction == "non-india":
        return False, "Document is from a non-Indian jurisdiction"
    if jurisdiction == "unknown" and (len(categories) < 2 or hits < 3):
        # Per plan: accept jurisdiction=unknown only if Stage A is strong
        return False, "LLM could not confirm Indian jurisdiction and keyword signal is weak"

    return True, reason or "Accepted"
