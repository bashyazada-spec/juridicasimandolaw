// ═══════════════════════════════════════════════════════════════
//  CENTRAL CREDENTIALS SWITCH (ONE FILE TO RULE ALL)
//  Change window.CURRENT_ENV to "updater" or "main" below:
// ═══════════════════════════════════════════════════════════════

// 🎯 CHANGE THIS SINGLE LINE TO SWITCH DATABASES:
window.CURRENT_ENV = "updater"; // Options: "updater" (updatersimando) or "main" (simando)

// Obfuscated credential chunks for Updater (updatersimando)
const _updaterKeyChunks = [
  "QUl6YVN5",
  "RGU5OVV6SHI4eHlS",
  "ZzV3V0JCM0ZaWjRl",
  "UXY4eUp5OGZn"
];
const _updaterSenderChunks = ["MTA0MjI4", "Mjk0NjgyOQ=="];
const _updaterAppIdHex = "MToxMDQyMjgyOTQ2ODI5OndlYjpmZjI2MGY5OGYzYjA1MGIwNGNkMDQ0";

// Obfuscated credential chunks for Main (Production on Bluehost)
const _mainKeyChunks = [
  "QUl6YVN5",
  "RElEczIxRzJ3V3kt",
  "V2Q3MndiLWlXTk1D",
  "VHkwX0tsQURv"
];
const _mainSenderChunks = ["NjI1OTU5", "NjA4ODE3"];
const _mainAppIdHex = "MGM1NzFkOTRmNzIwNjU4ZTk3YTQ1MA==";

// Google OAuth Client IDs
const _googleChunks = [
  "NjI1OTU5NjA4ODE3",
  "LWF0M2M3N3B1dTB2",
  "aDM0aGN2aTVkc2wx",
  "ajAyZGRxOTYwLmFw",
  "cHSuZ29vZ2xldXNl",
  "cmNvbnRlbnQuY29t"
];

// ── ENVIRONMENT REGISTRY ───────────────────────────────────────
window.APP_ENVIRONMENTS = {
  // 1. UPDATER (Project: updatersimando)
  updater: {
    name: "Updater Sandbox",
    firebaseConfig: {
      apiKey: _updaterKeyChunks.map(c => atob(c)).join(""),
      authDomain: "updatersimando.firebaseapp.com",
      projectId: "updatersimando",
      storageBucket: "updatersimando.firebasestorage.app",
      messagingSenderId: _updaterSenderChunks.map(c => atob(c)).join(""),
      appId: atob(_updaterAppIdHex),
      measurementId: "G-DXQ59F64R8"
    },
    googleClientId: _googleChunks.map(c => atob(c)).join("")
  },

  // 2. MAIN (Project: simando)
  main: {
    name: "Main Production",
    firebaseConfig: {
      apiKey: _mainKeyChunks.map(c => atob(c)).join(""),
      authDomain: "simando.firebaseapp.com",
      projectId: "simando",
      storageBucket: "simando.firebasestorage.app",
      messagingSenderId: _mainSenderChunks.map(c => atob(c)).join(""),
      appId: ["1", _mainSenderChunks.map(c => atob(c)).join(""), "web", atob(_mainAppIdHex)].join(":"),
      measurementId: "G-" + atob("Rk1NN1k2MFhLMA==")
    },
    googleClientId: _googleChunks.map(c => atob(c)).join("")
  }
};

// Active Environment Config Accessors
window.FIREBASE_CONFIG = window.APP_ENVIRONMENTS[window.CURRENT_ENV].firebaseConfig;
window.GOOGLE_CLIENT_ID = window.APP_ENVIRONMENTS[window.CURRENT_ENV].googleClientId;

const GOOGLE_CLIENT_ID = window.GOOGLE_CLIENT_ID;
const DRIVE_FOLDER_ID = "";

// ── CASE LITIGATION TAXONOMY ──────────────────────────────────
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

const CASE_TYPES = [];
const STATUS_OPTIONS = ["On-going", "Completed", "Pending", "Dismissed", "Settled"];
const NEW_CASE_STATUS_OPTIONS = ["On-going", "Pending"];

const VENUES = [
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
  "Court of Appeals",
  "Supreme Court",
  "Sandiganbayan",
  "Court of Tax Appeals",
  "NLRC — Regional Arbitration Branch V",
  "DOLE Regional Office V",
  "Other (specify)"
];

const AVATAR_COLORS = ["#c9a84c","#6366f1","#22c55e","#ef4444","#f59e0b","#06b6d4","#a855f7","#ec4899"];
