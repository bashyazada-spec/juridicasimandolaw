let profiles     = [];
let cases        = [];
let globalCaseTypes = [];
let currentView  = "dashboard";
let selProfile   = null;
let selCase      = null;
let caseFormMode = "add";
let profFormMode = "add";
let pfColor      = AVATAR_COLORS[0];
let pendingDocs  = [];
let deleteTarget = null;
let statusFilter = "All";
let pdFilter     = "All";
let dbReady      = false;
let localMode    = false;

let profilesUnsub  = null;
let casesUnsub     = null;
let caseTypesUnsub = null;

const statusColor = s =>
  ({Completed:"#22c55e","On-going":"#f59e0b",Dismissed:"#ef4444",Settled:"#6366f1"}[s]||"#94a3b8");

const initials = name => name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();

const badge = (label, color) =>
  `<span class="badge" style="background:${color}22;color:${color}">${label}</span>`;

const avatarDiv = (name, color, size=38, photoUrl=null) => {
  const fs = Math.round(size*0.34);
  if (photoUrl) {
    return `<img src="${photoUrl}" alt="${initials(name)}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;border:2px solid ${color||'#c9a84c'};flex-shrink:0"/>`;
  }
  const c = color || '#c9a84c';
  return `<div class="avatar" style="width:${size}px;height:${size}px;background:${c}33;border:2px solid ${c};font-size:${fs}px;color:${c};flex-shrink:0">${initials(name)}</div>`;
};

const formatDate = d => d ? new Date(d+'T00:00:00').toLocaleDateString("en-PH",{year:"numeric",month:"short",day:"numeric"}) : "N/A";

let toastTimer;
function showToast(msg, type="success") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.className = `show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ t.className=""; }, 3000);
}

function dbUnsubscribe() {
  if (profilesUnsub) { profilesUnsub(); profilesUnsub = null; }
  if (casesUnsub) { casesUnsub(); casesUnsub = null; }
  if (caseTypesUnsub) { caseTypesUnsub(); caseTypesUnsub = null; }
}

async function dbLoad() {
  if (localMode || !window._db) return;

  if (!window._currentUser) {
    console.warn("dbLoad: no authenticated user, skipping load");
    return;
  }

  try {
    const db = window._db;
    dbUnsubscribe();

    // ── Real-Time Sync: Attorney Directory ───────────────────────────────────
    const pColRef = window._fbCol(db, "profiles");
    profilesUnsub = window._fbOnSnapshot(pColRef, (snap) => {
      profiles = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Automatically generate user profile on first login using email fallback
      let myProf = profiles.find(p => p.ownerUid === window._currentUser.uid);
      if (!myProf) {
        const defaultName = window._currentUser.displayName || window._currentUser.email;
        const defaultData = {
          name: defaultName,
          role: "Attorney",
          contact: "",
          email: window._currentUser.email,
          avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
          photoUrl: window._currentUser.photoURL || null,
          ownerUid: window._currentUser.uid,
          createdAt: new Date().toISOString().slice(0,10)
        };
        dbAddProfile(defaultData);
      }

      dbReady = true;
      refreshCurrentView();
    }, (error) => {
      console.error("Profiles real-time connection error:", error);
    });

    // ── Real-Time Sync: Cases (Checks allowedUids for access) ─────────────
    const cColRef = window._fbCol(db, "cases");
    const cQuery = window._fbQuery(cColRef, window._fbWhere("allowedUids", "array-contains", window._currentUser.uid));
    casesUnsub = window._fbOnSnapshot(cQuery, (snap) => {
      cases = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      refreshCurrentView();
    }, (error) => {
      console.error("Cases real-time connection error:", error);
    });

    // ── Real-Time Sync: Dynamic Case Types list ──────────────────────────────
    const ctColRef = window._fbCol(db, "caseTypes");
    caseTypesUnsub = window._fbOnSnapshot(ctColRef, (snap) => {
      globalCaseTypes = snap.docs.map(d => d.data());
      if (typeof updateAllFilterDropdowns === "function") {
        updateAllFilterDropdowns();
      }
    }, (error) => {
      console.error("CaseTypes sync error:", error);
    });

  } catch(e) {
    console.error("Firestore database connection error:", e);
    dbReady = false;
    showToast("Real-time sync connection failed", "error");
  }
}

// ── Refresh router for real-time changes ────────────────────────────────────
function refreshCurrentView() {
  if (!dbReady) return;

  // Preserve selected profiles and cases when array lists update
  if (selProfile) {
    const updatedProfile = profiles.find(p => p.id === selProfile.id);
    if (updatedProfile) selProfile = updatedProfile;
  }
  if (selCase) {
    const updatedCase = cases.find(c => c.id === selCase.id);
    if (updatedCase) selCase = updatedCase;
  }

  if (currentView === "dashboard") renderDashboard();
  if (currentView === "profiles")  renderProfiles();
  if (currentView === "allcases")  renderAllCases();
  if (currentView === "profileDetail" && selProfile) renderProfileDetail();
  if (currentView === "caseDetail" && selCase) renderCaseDetail();
  if (currentView === "myprofile") renderMyProfile();
}

async function dbAddProfile(data) {
  if (localMode || !window._db) { data.id = "local_"+Date.now(); profiles.unshift(data); return data; }
  data.ownerUid = window._currentUser?.uid || null;
  data.createdAt = new Date().toISOString().slice(0,10);
  const ref = await window._fbAddDoc(window._fbCol(window._db,"profiles"), data);
  data.id = ref.id;
  profiles.unshift(data);
  return data;
}

async function dbUpdateProfile(id, data) {
  if (!localMode && window._db) await window._fbUpdate(window._fbDoc(window._db,"profiles",id), data);
  const idx = profiles.findIndex(p=>p.id===id);
  if (idx>=0) profiles[idx] = {...profiles[idx],...data};
}

async function dbDeleteProfile(id) {
  if (!localMode && window._db) await window._fbDelete(window._fbDoc(window._db,"profiles",id));
  profiles = profiles.filter(p=>p.id!==id);
}

async function dbAddCase(data) {
  if (localMode || !window._db) { data.id = "local_"+Date.now(); cases.unshift(data); return data; }
  data.ownerUid = window._currentUser?.uid || null;
  data.createdAt = new Date().toISOString().slice(0,10);
  const ref = await window._fbAddDoc(window._fbCol(window._db,"cases"), data);
  data.id = ref.id;
  cases.unshift(data);
  return data;
}

async function dbUpdateCase(id, data) {
  if (!localMode && window._db) await window._fbUpdate(window._fbDoc(window._db,"cases",id), data);
  const idx = cases.findIndex(c=>c.id===id);
  if (idx>=0) cases[idx] = {...cases[idx],...data};
}

async function dbDeleteCase(id) {
  if (!localMode && window._db) await window._fbDelete(window._fbDoc(window._db,"cases",id));
  cases = cases.filter(c=>c.id!==id);
}
