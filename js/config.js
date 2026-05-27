// ═══════════════════════════════════════════════════════════════
//  CONFIGURATION — EDIT THESE VALUES
// ═══════════════════════════════════════════════════════════════
const GOOGLE_CLIENT_ID = "625959608817-at3c77puu0vh34hcvi5dsl1j02ddq960.apps.googleusercontent.com";
const DRIVE_FOLDER_ID = "";

// Case Categories (fixed list per firm)
const CASE_CATEGORIES = [
  "Cadastral and Land Registration Case",
  "Civil Case",
  "Commercial or Corporate Case",
  "Criminal Case",
  "Environmental Case",
  "Family Court Case",
  "Others",
  "Special Civil Action",
  "Special Proceedings"
];

// Party labels per category: [partyA label, partyB label]
const CATEGORY_PARTY_LABELS = {
  "Criminal Case":                      ["Private Complainant", "Accused"],
  "Civil Case":                         ["Plaintiff", "Defendant"],
  "Commercial or Corporate Case":       ["Plaintiff", "Defendant"],
  "Cadastral and Land Registration Case":["Petitioner", "Respondent"],
  "Environmental Case":                 ["Petitioner", "Respondent"],
  "Family Court Case":                  ["Petitioner", "Respondent"],
  "Special Civil Action":               ["Petitioner", "Respondent"],
  "Special Proceedings":                ["Petitioner", "Respondent"],
  "Others":                             ["Petitioner", "Respondent"],
};

// Case Types are saved per category in Firestore (dynamic)
// This is just a fallback default
const CASE_TYPES = [];

const STATUS_OPTIONS = ["On-going","Completed","Pending","Dismissed","Settled"];
const VENUES         = [
  // — Naga City, Camarines Sur —
  "RTC Branch 19, Naga City",
  "RTC Branch 20, Naga City",
  "RTC Branch 21, Naga City",
  "RTC Branch 22, Naga City",
  "RTC Branch 23, Naga City",
  "RTC Branch 24, Naga City",
  "RTC Branch 25, Naga City",
  "RTC Branch 26, Naga City",
  "RTC Branch 27, Naga City",
  "RTC Branch 28, Naga City",
  "RTC Branch 61, Naga City",
  "RTC Branch 62, Naga City",
  "RTC Branch 6-FC, Naga City",
  "MTCC Branch 1, Naga City",
  "MTCC Branch 2, Naga City",
  "MTCC Branch 3, Naga City",
  // — Other / Higher Courts —
  "Court of Appeals",
  "Supreme Court",
  "Sandiganbayan",
  "Court of Tax Appeals",
  "NLRC — Regional Arbitration Branch V",
  "DOLE Regional Office V",
  // — Manual —
  "Other (specify)"
];
const AVATAR_COLORS  = ["#c9a84c","#6366f1","#22c55e","#ef4444","#f59e0b","#06b6d4","#a855f7","#ec4899"];
