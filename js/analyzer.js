// ═══════════════════════════════════════════════════════════════
//  DOCUMENT ANALYZER — rule-based, no AI API
//  Reads PDF/DOCX/TXT text, extracts legal metadata,
//  and composes a structured brief description.
// ═══════════════════════════════════════════════════════════════

// ── PDF text extraction via pdf.js (loaded from CDN) ──────────
const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

let pdfjsLib = null;

async function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  if (window.pdfjsLib) { pdfjsLib = window.pdfjsLib; return pdfjsLib; }
  await new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = PDFJS_CDN;
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  pdfjsLib = window.pdfjsLib;
  return pdfjsLib;
}

// ── Extract raw text from a File object ───────────────────────
async function extractTextFromFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();

  if (ext === "pdf") {
    return await extractPdfText(file);
  }
  if (["txt", "md", "rtf", "html", "htm"].includes(ext)) {
    return await file.text();
  }
  if (["docx", "odt"].includes(ext)) {
    return await extractDocxText(file);
  }
  // Fallback: try reading as text
  try { return await file.text(); } catch { return ""; }
}

async function extractPdfText(file) {
  try {
    const lib = await loadPdfJs();
    const ab = await file.arrayBuffer();
    const pdf = await lib.getDocument({ data: ab }).promise;
    const pageTexts = [];
    const maxPages = Math.min(pdf.numPages, 10); // first 10 pages is plenty
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pageTexts.push(content.items.map(it => it.str).join(" "));
    }
    return pageTexts.join("\n");
  } catch (e) {
    console.warn("PDF extraction error:", e);
    return "";
  }
}

async function extractDocxText(file) {
  // DOCX is a zip; extract word/document.xml and strip tags
  try {
    const JSZip = await loadJSZip();
    if (!JSZip) return "";
    const ab = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(ab);
    const xmlFile = zip.file("word/document.xml");
    if (!xmlFile) return "";
    const xml = await xmlFile.async("text");
    // Strip XML tags, collapse whitespace
    return xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  } catch (e) {
    console.warn("DOCX extraction error:", e);
    return "";
  }
}

async function loadJSZip() {
  if (window.JSZip) return window.JSZip;
  try {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    return window.JSZip;
  } catch { return null; }
}

// ── Legal pattern library ──────────────────────────────────────

const DOC_TYPE_PATTERNS = [
  { label: "Complaint",           rx: /\bcomplaint\b/i },
  { label: "Petition",            rx: /\bpetition\b/i },
  { label: "Answer",              rx: /\banswer\b/i },
  { label: "Motion",              rx: /\bmotion\b/i },
  { label: "Affidavit",          rx: /\baffidavit\b/i },
  { label: "Contract",           rx: /\b(contract|agreement|deed)\b/i },
  { label: "Court Order",        rx: /\b(order|resolution|decision)\b/i },
  { label: "Subpoena",           rx: /\bsubpoena\b/i },
  { label: "Summons",            rx: /\bsummons\b/i },
  { label: "Memorandum",        rx: /\bmemorandum\b/i },
  { label: "Notice",             rx: /\bnotice\b/i },
  { label: "Demand Letter",     rx: /\b(demand|letter of demand)\b/i },
  { label: "Certificate",       rx: /\bcertificate\b/i },
  { label: "Writ",              rx: /\bwrit\b/i },
];

const CASE_NO_PATTERNS = [
  /(?:case|civil|criminal|crim|sp\. proc|sp proc|ca-g\.r|g\.r)[\s.\-#:]*(?:no|nos?|number)?[\s.\-#:]*([a-z0-9\-\/]+)/i,
  /(?:docket|doc)[\s.\-#:]*(?:no|number)?[\s.\-#:]*([a-z0-9\-\/]+)/i,
];

const PARTY_PATTERNS = [
  // "Petitioner/Plaintiff vs./v. Respondent/Defendant"
  /([A-Z][A-Za-z.,'\s]{2,40})\s+(?:vs?\.?|versus)\s+([A-Z][A-Za-z.,'\s]{2,40})/,
  /(?:plaintiff|petitioner)[:\s]+([A-Z][A-Za-z.,'\s]{2,40})/i,
  /(?:defendant|respondent)[:\s]+([A-Z][A-Za-z.,'\s]{2,40})/i,
];

const DATE_RX = /\b(\d{1,2}[\s](?:January|February|March|April|May|June|July|August|September|October|November|December)[\s]\d{4}|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/gi;

const COURT_PATTERNS = [
  /(?:regional trial court|rtc)(?:[,\s]+branch[\s]+\d+)?(?:[,\s]+of[\s]+[A-Z][a-z]+)?/i,
  /(?:municipal trial court|mtc)(?:[,\s]+of[\s]+[A-Z][a-z]+)?/i,
  /court of appeals/i,
  /supreme court/i,
  /national labor relations commission|nlrc/i,
  /family court/i,
  /sandiganbayan/i,
];

const AMOUNT_RX = /(?:php|₱|peso[s]?)\s*[\d,]+(?:\.\d{2})?/gi;

const RELIEF_PATTERNS = [
  /(?:pray(?:ing|s)?|relief|prayer|wherefore)[^.]{0,200}/i,
  /(?:seeks?|request(?:ing)?|demand(?:ing)?)\s+(?:the\s+)?(?:sum|amount|payment|damages|compensation)[^.]{0,150}/i,
];

// ── Core extraction ────────────────────────────────────────────

function detectDocumentType(text) {
  // Try the first 500 chars (title area) first, then full text
  const header = text.slice(0, 500);
  for (const { label, rx } of DOC_TYPE_PATTERNS) {
    if (rx.test(header)) return label;
  }
  for (const { label, rx } of DOC_TYPE_PATTERNS) {
    if (rx.test(text)) return label;
  }
  return "Document";
}

function extractCaseNumber(text) {
  for (const rx of CASE_NO_PATTERNS) {
    const m = text.match(rx);
    if (m && m[1] && m[1].length < 30) return m[1].trim().toUpperCase();
  }
  return null;
}

function extractParties(text) {
  // Try vs. pattern first (most reliable)
  const vsMatch = text.match(/([A-Z][A-Za-z\s.,'-]{2,40})\s+(?:vs?\.?|versus)\s+([A-Z][A-Za-z\s.,'-]{2,40})/);
  if (vsMatch) {
    return {
      petitioner: clean(vsMatch[1]),
      respondent: clean(vsMatch[2])
    };
  }
  // Fallback: look for labelled parties
  const pet = text.match(/(?:plaintiff|petitioner)[:\s]+([A-Z][A-Za-z\s.,'-]{2,40})/i);
  const res = text.match(/(?:defendant|respondent)[:\s]+([A-Z][A-Za-z\s.,'-]{2,40})/i);
  return {
    petitioner: pet ? clean(pet[1]) : null,
    respondent:  res ? clean(res[1])  : null,
  };
}

function extractDates(text) {
  const matches = [...text.matchAll(DATE_RX)].map(m => m[0].trim());
  // Deduplicate
  return [...new Set(matches)].slice(0, 3);
}

function extractCourt(text) {
  for (const rx of COURT_PATTERNS) {
    const m = text.match(rx);
    if (m) return m[0].replace(/\s+/g, " ").trim();
  }
  return null;
}

function extractAmounts(text) {
  const matches = [...text.matchAll(AMOUNT_RX)].map(m => m[0].trim());
  return [...new Set(matches)].slice(0, 3);
}

function extractRelief(text) {
  for (const rx of RELIEF_PATTERNS) {
    const m = text.match(rx);
    if (m) {
      return m[0].replace(/\s+/g, " ").trim().slice(0, 200);
    }
  }
  return null;
}

function extractKeyLegalTerms(text) {
  const terms = [
    "damages", "injunction", "specific performance", "breach of contract",
    "illegal dismissal", "reinstatement", "back wages", "annulment",
    "partition", "reconveyance", "ejectment", "unlawful detainer",
    "support", "custody", "adoption", "probate", "estate",
    "libel", "slander", "estafa", "qualified theft", "carnapping",
    "homicide", "murder", "rape", "violation of ra",
    "sum of money", "recovery", "replevin", "mandamus", "certiorari",
    "prohibition", "habeas corpus", "quo warranto",
  ];
  return terms.filter(t => new RegExp(`\\b${t}\\b`, "i").test(text));
}

function clean(str) {
  return str.replace(/\s+/g, " ").replace(/[,\s]+$/, "").trim();
}

// ── Brief description composer ─────────────────────────────────

function composeBriefDescription(docType, caseNo, parties, dates, court, amounts, relief, legalTerms, fileName) {
  const lines = [];

  // Opening line — document type + case number
  let opening = `This is a ${docType}`;
  if (caseNo) opening += ` (Case No. ${caseNo})`;
  if (court)  opening += ` filed before the ${court}`;
  opening += ".";
  lines.push(opening);

  // Parties
  if (parties.petitioner && parties.respondent) {
    lines.push(`The case involves ${parties.petitioner} as petitioner/plaintiff against ${parties.respondent} as respondent/defendant.`);
  } else if (parties.petitioner) {
    lines.push(`Filed by ${parties.petitioner}.`);
  }

  // Subject matter / legal terms
  if (legalTerms.length > 0) {
    const subj = legalTerms.slice(0, 3).join(", ");
    lines.push(`The document pertains to: ${subj}.`);
  }

  // Relief / prayer
  if (relief) {
    const truncated = relief.length > 150 ? relief.slice(0, 150) + "…" : relief;
    lines.push(`Relief sought: ${truncated}`);
  }

  // Monetary amounts
  if (amounts.length > 0) {
    lines.push(`Amount(s) involved: ${amounts.join(", ")}.`);
  }

  // Key dates
  if (dates.length > 0) {
    lines.push(`Relevant date(s): ${dates.join("; ")}.`);
  }

  // Fallback if nothing was extracted
  if (lines.length === 1 && !caseNo && !parties.petitioner) {
    lines.push(`Extracted from file: ${fileName}. Unable to identify specific legal details — please review the document manually.`);
  }

  return lines.join(" ");
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Analyze a File object and return a brief description string.
 * @param {File} file
 * @returns {Promise<{description: string, meta: object}>}
 */
async function analyzeDocument(file) {
  const text = await extractTextFromFile(file);

  if (!text || text.trim().length < 30) {
    return {
      description: `Document: ${file.name}. Text could not be extracted from this file — it may be a scanned image or protected PDF.`,
      meta: {}
    };
  }

  const docType    = detectDocumentType(text);
  const caseNo     = extractCaseNumber(text);
  const parties    = extractParties(text);
  const dates      = extractDates(text);
  const court      = extractCourt(text);
  const amounts    = extractAmounts(text);
  const relief     = extractRelief(text);
  const legalTerms = extractKeyLegalTerms(text);

  const description = composeBriefDescription(
    docType, caseNo, parties, dates, court, amounts, relief, legalTerms, file.name
  );

  return {
    description,
    meta: { docType, caseNo, parties, dates, court, amounts, legalTerms }
  };
}
