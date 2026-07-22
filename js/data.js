// ═══════════════════════════════════════════════════════════════
//  ADMINISTRATIVE & SYSTEM CONFIGURATION
// ═══════════════════════════════════════════════════════════════
const ADMIN_EMAILS = [
  "admin@simandolaw.com", // Change this to your authorized admin attorney's email
];

let profiles     = [];
let cases        = [];
let notifications = [];
let appointments = [];
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
let notificationsUnsub = null;
let appointmentsUnsub = null;

const statusColor = (status) => {
  switch (status) {
    case "On-going":  return "var(--amber)";
    case "Completed": return "var(--green)";
    case "Resolved":  return "var(--green)";
    default:          return "var(--text-muted)";
  }
};

const initials = name => name ? name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() : "?";

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
  if (notificationsUnsub) { notificationsUnsub(); notificationsUnsub = null; }
  if (appointmentsUnsub) { appointmentsUnsub(); appointmentsUnsub = null; }
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

    // ── Real-Time Sync: Attorney Directory ───────────────────
    const pColRef = window._fbCol(db, "profiles");
    profilesUnsub = window._fbOnSnapshot(pColRef, (snap) => {
      profiles = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const u = window._currentUser;
      if (u) {
        let myProf = profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase()));

        if (myProf) {
          if (!myProf.ownerUid) {
            dbUpdateProfile(myProf.id, { ownerUid: u.uid });
            myProf.ownerUid = u.uid;
          }
          const isConfiguredAdmin = u.email && ADMIN_EMAILS.includes(u.email.toLowerCase());
          if (isConfiguredAdmin && myProf.role !== "admin") {
            dbUpdateProfile(myProf.id, { role: "admin" });
            myProf.role = "admin";
          }
        } else {
          const defaultName = u.displayName || u.email;
          const isConfiguredAdmin = u.email && ADMIN_EMAILS.includes(u.email.toLowerCase());
          
          const defaultData = {
            name: defaultName,
            role: isConfiguredAdmin ? "admin" : "Attorney",
            contact: "",
            email: u.email,
            avatarColor: ADMIN_EMAILS.includes(u.email.toLowerCase()) ? "#c9a84c" : AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
            photoUrl: u.photoURL || null,
            ownerUid: u.uid,
            createdAt: new Date().toISOString().slice(0,10)
          };
          dbAddProfile(defaultData);
        }
      }

      dbReady = true;
      refreshCurrentView();
    }, (error) => {
      console.error("Profiles real-time connection error:", error);
    });

    // ── Real-Time Sync: Cases ─────────────
    const cColRef = window._fbCol(db, "cases");
    const cQuery = window._fbQuery(cColRef, window._fbWhere("allowedUids", "array-contains", window._currentUser.uid));
    casesUnsub = window._fbOnSnapshot(cQuery, (snap) => {
      cases = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      refreshCurrentView();
    }, (error) => {
      console.error("Cases real-time connection error:", error);
    });

    // ── Real-Time Sync: Notifications (Targeted to Active User) ─────────────
    try {
      const notifColRef = window._fbCol(db, "notifications");
      const notifQuery = window._fbQuery(notifColRef, window._fbWhere("toUid", "==", window._currentUser.uid));
      notificationsUnsub = window._fbOnSnapshot(notifQuery, (snap) => {
        notifications = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        refreshCurrentView();
      }, (error) => {
        console.warn("Notifications sync permission notice:", error.message);
        notifications = [];
      });
    } catch (e) {
      console.warn("Notifications listener setup skipped:", e.message);
    }

    // ── Real-Time Sync: Appointment Proposals (Requester or Target) ─────────────
    try {
      const apptColRef = window._fbCol(db, "appointments");
      appointmentsUnsub = window._fbOnSnapshot(apptColRef, (snap) => {
        const allAppts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const u = window._currentUser;
        appointments = allAppts.filter(a => a.targetUid === u.uid || a.requesterUid === u.uid);
        refreshCurrentView();
      }, (error) => {
        console.warn("Appointments sync permission notice:", error.message);
        appointments = [];
      });
    } catch (e) {
      console.warn("Appointments listener setup skipped:", e.message);
    }

  } catch(e) {
    console.error("Firestore database connection error:", e);
    dbReady = false;
    showToast("Real-time sync connection failed", "error");
  }
}

function refreshCurrentView() {
  if (!dbReady) return;

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
  if (currentView === "calendar")  renderCalendarView();
  if (currentView === "notifications") renderNotificationsView();
  
  if (typeof renderSidebarUser === "function") renderSidebarUser();
  if (typeof updateNotificationBadge === "function") updateNotificationBadge();
}

async function dbAddProfile(data) {
  if (localMode || !window._db) { 
    data.id = "local_" + Date.now(); 
    profiles.unshift(data); 
    return data; 
  }
  data.ownerUid = window._currentUser?.uid || null;
  data.createdAt = new Date().toISOString().slice(0,10);
  const ref = await window._fbAddDoc(window._fbCol(window._db,"profiles"), data);
  data.id = ref.id;
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
  if (localMode || !window._db) { 
    data.id = "local_" + Date.now(); 
    cases.unshift(data); 
    return data; 
  }
  data.ownerUid = window._currentUser?.uid || null;
  data.createdAt = new Date().toISOString().slice(0,10);
  const ref = await window._fbAddDoc(window._fbCol(window._db,"cases"), data);
  data.id = ref.id;
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

async function dbAddNotification(data) {
  if (localMode || !window._db) return;
  data.createdAt = new Date().toISOString();
  await window._fbAddDoc(window._fbCol(window._db, "notifications"), data);
}

async function dbUpdateNotification(id, data) {
  if (!localMode && window._db) await window._fbUpdate(window._fbDoc(window._db, "notifications", id), data);
}

async function dbDeleteNotification(id) {
  if (!localMode && window._db) await window._fbDelete(window._fbDoc(window._db, "notifications", id));
}

async function dbAddAppointment(data) {
  if (localMode || !window._db) return null;
  data.createdAt = new Date().toISOString();
  const ref = await window._fbAddDoc(window._fbCol(window._db, "appointments"), data);
  return ref.id;
}

async function dbUpdateAppointment(id, data) {
  if (!localMode && window._db) await window._fbUpdate(window._fbDoc(window._db, "appointments", id), data);
}

async function dbDeleteAppointment(id) {
  if (!localMode && window._db) await window._fbDelete(window._fbDoc(window._db, "appointments", id));
}
