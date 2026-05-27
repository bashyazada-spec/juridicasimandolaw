let profiles     = [];
let cases        = [];
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

async function dbLoad() {
  if (localMode || !window._db) return;

  if (!window._currentUser) {
    console.warn("dbLoad: no authenticated user, skipping load");
    return;
  }

  try {
    const db = window._db;

    // Users are allowed to read the basic directories of ALL attorneys in the system
    let pSnap;
    try {
      pSnap = await window._fbGetDocs(window._fbQuery(
        window._fbCol(db, "profiles"),
        window._fbOrderBy("createdAt", "desc")
      ));
    } catch (indexErr) {
      console.warn("profiles orderBy failed, loading without sort:", indexErr.message);
      pSnap = await window._fbGetDocs(window._fbCol(db, "profiles"));
    }
    profiles = pSnap.docs.map(d=>({id:d.id,...d.data()}));

    // SECURITY: Users can only pull and view cases that belong to them
    let cSnap;
    try {
      cSnap = await window._fbGetDocs(window._fbQuery(
        window._fbCol(db, "cases"),
        window._fbWhere("ownerUid", "==", window._currentUser.uid)
      ));
    } catch (indexErr) {
      console.warn("cases filtered query failed:", indexErr.message);
      cSnap = await window._fbGetDocs(window._fbCol(db, "cases"));
    }
    cases = cSnap.docs.map(d=>({id:d.id,...d.data()}));

    // Auto-create a linked profile if this is the user's first time logging in
    let myProf = profiles.find(p => p.ownerUid === window._currentUser.uid);
    if (!myProf) {
      const defaultName = window._currentUser.displayName || "Atty. " + window._currentUser.email.split('@')[0];
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
      myProf = await dbAddProfile(defaultData);
    }

    dbReady = true;
    if (currentView === "dashboard") renderDashboard();
    if (currentView === "profiles")  renderProfiles();
    if (currentView === "allcases")  renderAllCases();
    if (currentView === "profileDetail" && selProfile) renderProfileDetail();
    if (currentView === "caseDetail" && selCase) renderCaseDetail();
    if (currentView === "myprofile") renderMyProfile();
  } catch(e) {
    console.error("Firestore load error:", e);
    dbReady = false;
    if (e.code === "permission-denied") {
      showToast("Firestore permission denied","error");
    } else {
      showToast("Database connection error","error");
    }
  }
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
