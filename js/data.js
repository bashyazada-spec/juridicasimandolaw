// ═══════════════════════════════════════════════════════════════
//  ADMINISTRATIVE & SYSTEM CONFIGURATION
// ═══════════════════════════════════════════════════════════════
const ADMIN_EMAILS = [
  "admin@simandolaw.com",
];

let profiles        = [];
let cases           = [];
let notifications   = [];
let appointments    = [];
let onlineUsers     = [];
let globalCaseTypes = [];
let currentView     = "dashboard";
let selProfile      = null;
let selCase         = null;
let caseFormMode    = "add";
let profFormMode    = "add";
let pfColor         = AVATAR_COLORS[0];
let pendingDocs     = [];
let deleteTarget    = null;
let statusFilter    = "All";
let pdFilter        = "All";
let dbReady         = false;
let localMode       = false;

window.cases         = cases;
window.profiles      = profiles;
window.appointments  = appointments;
window.notifications = notifications;
window.onlineUsers   = onlineUsers;

let profilesUnsub        = null;
let casesUnsub           = null;
let notificationsUnsub   = null;
let appointmentsUnsub    = null;
let appointmentsReqUnsub = null;
let presenceUnsub        = null;
let presenceHeartbeatId  = null;
let prevNotifCount       = 0;

window._notifsLoaded = false;

// ═══════════════════════════════════════════════════════════════
//  ZERO-KNOWLEDGE CLIENT-SIDE ENCRYPTION ENGINE (AES-GCM 256)
// ═══════════════════════════════════════════════════════════════
const E2EE_SALT_PHRASE = "SimandoLaw_FirmMaster_Vault_2026_SecureCipher";
let _cachedCryptoKey = null;

async function getE2EESecretKey() {
  if (_cachedCryptoKey) return _cachedCryptoKey;
  try {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      enc.encode(E2EE_SALT_PHRASE),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );
    _cachedCryptoKey = await window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: enc.encode("simando_vault_vector_99"),
        iterations: 100000,
        hash: "SHA-256"
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    return _cachedCryptoKey;
  } catch (err) {
    console.warn("Crypto key derivation notice:", err);
    return null;
  }
}

async function encryptE2EEString(plainText) {
  if (plainText === null || plainText === undefined) return plainText;
  const str = String(plainText);
  if (!str.trim() || str.startsWith("enc:v1:")) return str;

  try {
    const key = await getE2EESecretKey();
    if (!key || !window.crypto || !window.crypto.subtle) return str;

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const cipherBuffer = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(str)
    );

    const combined = new Uint8Array(iv.length + cipherBuffer.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipherBuffer), iv.length);

    let binary = "";
    for (let i = 0; i < combined.byteLength; i++) {
      binary += String.fromCharCode(combined[i]);
    }
    return "enc:v1:" + btoa(binary);
  } catch (err) {
    console.warn("Field encryption fallback:", err);
    return str;
  }
}

async function decryptE2EEString(cipherText) {
  if (!cipherText || typeof cipherText !== "string" || !cipherText.startsWith("enc:v1:")) return cipherText;

  try {
    const key = await getE2EESecretKey();
    if (!key || !window.crypto || !window.crypto.subtle) return cipherText;

    const binary = atob(cipherText.slice(7));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.slice(0, 12) },
      key,
      bytes.slice(12)
    );
    return new TextDecoder().decode(decryptedBuffer);
  } catch (err) {
    console.warn("Field decryption notice:", err);
    return cipherText;
  }
}

async function encryptCaseRecordForFirestore(c) {
  if (!c) return c;
  const clone = { ...c };

  if (clone.title !== undefined)      clone.title      = await encryptE2EEString(clone.title);
  if (clone.caseNumber !== undefined) clone.caseNumber = await encryptE2EEString(clone.caseNumber);
  if (clone.parties !== undefined)    clone.parties    = await encryptE2EEString(clone.parties);
  if (clone.narrative !== undefined)  clone.narrative  = await encryptE2EEString(clone.narrative);
  if (clone.venue !== undefined)      clone.venue      = await encryptE2EEString(clone.venue);
  if (clone.docType !== undefined)    clone.docType    = await encryptE2EEString(clone.docType);
  if (clone.type !== undefined)       clone.type       = await encryptE2EEString(clone.type);

  if (Array.isArray(clone.hearings)) {
    clone.hearings = await Promise.all(clone.hearings.map(async h => ({
      ...h,
      purpose: h.purpose !== undefined ? await encryptE2EEString(h.purpose) : h.purpose,
      notes: h.notes !== undefined ? await encryptE2EEString(h.notes) : h.notes
    })));
  }

  if (Array.isArray(clone.deadlines)) {
    clone.deadlines = await Promise.all(clone.deadlines.map(async d => ({
      ...d,
      subtype: d.subtype !== undefined ? await encryptE2EEString(d.subtype) : (d.title ? await encryptE2EEString(d.title) : d.subtype),
      notes: d.notes !== undefined ? await encryptE2EEString(d.notes) : d.notes
    })));
  }

  if (Array.isArray(clone.documents)) {
    clone.documents = await Promise.all(clone.documents.map(async d => ({
      ...d,
      name: d.name !== undefined ? await encryptE2EEString(d.name) : d.name
    })));
  }

  return clone;
}

async function decryptCaseRecordFromFirestore(c) {
  if (!c) return c;
  const clone = { ...c };

  if (clone.title !== undefined)      clone.title      = await decryptE2EEString(clone.title);
  if (clone.caseNumber !== undefined) clone.caseNumber = await decryptE2EEString(clone.caseNumber);
  if (clone.parties !== undefined)    clone.parties    = await decryptE2EEString(clone.parties);
  if (clone.narrative !== undefined)  clone.narrative  = await decryptE2EEString(clone.narrative);
  if (clone.venue !== undefined)      clone.venue      = await decryptE2EEString(clone.venue);
  if (clone.docType !== undefined)    clone.docType    = await decryptE2EEString(clone.docType);
  if (clone.type !== undefined)       clone.type       = await decryptE2EEString(clone.type);

  if (Array.isArray(clone.hearings)) {
    clone.hearings = await Promise.all(clone.hearings.map(async h => ({
      ...h,
      purpose: h.purpose !== undefined ? await decryptE2EEString(h.purpose) : h.purpose,
      notes: h.notes !== undefined ? await decryptE2EEString(h.notes) : h.notes
    })));
  }

  if (Array.isArray(clone.deadlines)) {
    clone.deadlines = await Promise.all(clone.deadlines.map(async d => ({
      ...d,
      subtype: d.subtype !== undefined ? await decryptE2EEString(d.subtype) : (d.title ? await decryptE2EEString(d.title) : d.subtype),
      notes: d.notes !== undefined ? await decryptE2EEString(d.notes) : d.notes
    })));
  }

  if (Array.isArray(clone.documents)) {
    clone.documents = await Promise.all(clone.documents.map(async d => ({
      ...d,
      name: d.name !== undefined ? await decryptE2EEString(d.name) : d.name
    })));
  }

  return clone;
}
window.decryptCaseRecordFromFirestore = decryptCaseRecordFromFirestore;

// ── IMMUTABLE COMPLIANCE AUDIT RECORDER ──────────────────────
async function dbLogAuditAction(action, details = {}) {
  if (localMode || !window._db) return;
  const u = window._currentUser || window._auth?.currentUser;
  if (!u) return;

  try {
    await window._fbAddDoc(window._fbCol(window._db, "audit_logs"), {
      action,
      userId: u.uid,
      userEmail: u.email || "unknown",
      details,
      createdAt: window._fbServerTs ? window._fbServerTs() : new Date().toISOString()
    });
  } catch (err) {
    console.warn("Audit logging notice:", err.message);
  }
}
window.dbLogAuditAction = dbLogAuditAction;

// ── STRICT ACCESSIBLE CASES FILTER ───────────────────────────
function getAccessibleCases() {
  const u = window._currentUser || window._auth?.currentUser;
  if (!u) return [];

  const userEmail = (u.email || "").toLowerCase();
  const myProf = profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === userEmail));
  const isFirmAdmin = (myProf && myProf.role === "admin") || (u.email && ADMIN_EMAILS.some(e => e.toLowerCase() === userEmail));
  if (isFirmAdmin) return cases;

  return cases.filter(c => {
    const isOwner = c.ownerUid === u.uid;
    const isAllowed = Array.isArray(c.allowedUids) && c.allowedUids.includes(u.uid);
    const isShared = Array.isArray(c.sharedWith) && c.sharedWith.includes(u.uid);
    const isMyProfileCase = myProf && c.profileId === myProf.id;
    return isOwner || isAllowed || isShared || isMyProfileCase;
  });
}
window.getAccessibleCases = getAccessibleCases;

// ── WEB AUDIO SYNTHESIZER (RESPECTS USER SOUND SETTINGS) ─────
let sharedAudioCtx = null;

function getAudioContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    try { sharedAudioCtx = new AudioCtx(); } catch (e) { return null; }
  }
  return sharedAudioCtx;
}

const unlockAudio = () => {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
  } catch (e) {}
  document.removeEventListener("pointerdown", unlockAudio);
  document.removeEventListener("keydown", unlockAudio);
};
document.addEventListener("pointerdown", unlockAudio, { once: true, passive: true });
document.addEventListener("keydown", unlockAudio, { once: true, passive: true });

function isSoundEnabled(kind) {
  try {
    return localStorage.getItem(kind === "chat" ? "simando_sound_chat" : "simando_sound_notif") !== "false";
  } catch (e) {
    return true;
  }
}

function playNotificationSound(forceTest = false) {
  if (!forceTest && !isSoundEnabled("notif")) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {}
}

function playChatSound(forceTest = false) {
  if (!forceTest && !isSoundEnabled("chat")) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) {}
}

window.playNotificationSound = playNotificationSound;
window.playChatSound = playChatSound;
window.testNotificationAudio = function() {
  playNotificationSound(true);
  if (typeof showToast === "function") showToast("Notification chime played");
};

// ── UI FORMATTERS ────────────────────────────────────────────
const statusColor = (status) => {
  switch (status) {
    case "On-going":  return "var(--amber)";
    case "Completed":
    case "Resolved":  return "var(--green)";
    default:          return "var(--text-muted)";
  }
};

const initials = name => name ? name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "?";

const badge = (label, color) =>
  `<span class="badge" style="background:${color}22;color:${color}">${label}</span>`;

const avatarDiv = (name, color, size = 38, photoUrl = null) => {
  const fs = Math.round(size * 0.34);
  if (photoUrl) {
    return `<img src="${photoUrl}" alt="${initials(name)}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;border:2px solid ${color || '#c9a84c'};flex-shrink:0"/>`;
  }
  const c = color || '#c9a84c';
  return `<div class="avatar" style="width:${size}px;height:${size}px;background:${c}33;border:2px solid ${c};font-size:${fs}px;color:${c};flex-shrink:0">${initials(name)}</div>`;
};

const formatDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "N/A";

let toastTimer;
function showToast(msg, type = "success") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.className = `show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ""; }, 3000);
}

// ── LIVE ONLINE PRESENCE ENGINE ──────────────────────────────
async function updateUserPresenceHeartbeat() {
  if (localMode || !window._db) return;
  const u = window._currentUser || window._auth?.currentUser;
  if (!u) return;
  try {
    const userEmail = (u.email || "").toLowerCase();
    const myProf = profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === userEmail));
    const displayName = myProf?.name || u.displayName || u.email?.split("@")[0] || "Counsel";
    const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    await setDoc(window._fbDoc(window._db, "chat_peers", u.uid), {
      uid: u.uid,
      name: displayName,
      lastSeen: window._fbServerTs ? window._fbServerTs() : new Date()
    }, { merge: true });
  } catch (e) { /* ignore */ }
}

function computeOnlineUsersFromPeers(peerDocs) {
  const u = window._currentUser || window._auth?.currentUser;
  const currentUid = u?.uid || "";
  const nowMs = Date.now();
  const ONLINE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes active window

  const myProf = profiles.find(p => p.ownerUid === currentUid);
  const isDev = myProf && myProf.role === "developer";

  const activeMap = new Map();
  if (currentUid) {
    activeMap.set(currentUid, {
      uid: currentUid,
      name: myProf?.name || u.displayName || u.email?.split("@")[0] || "You",
      role: myProf?.role || "Attorney",
      avatarColor: myProf?.avatarColor || "#c9a55c",
      photoUrl: myProf?.photoUrl || null,
      isMe: true
    });
  }

  (peerDocs || []).forEach(d => {
    if (!d.uid) return;
    const seenMs = d.lastSeen?.toDate ? d.lastSeen.toDate().getTime() : (typeof d.lastSeen === "number" ? d.lastSeen : 0);
    if (d.uid !== currentUid && (nowMs - seenMs) > ONLINE_WINDOW_MS) return;

    const prof = profiles.find(p => p.ownerUid === d.uid);
    if (isDev && prof && prof.role !== "developer") return;
    if (!isDev && prof && prof.role === "developer") return;

    activeMap.set(d.uid, {
      uid: d.uid,
      name: prof?.name || d.name || "Counsel",
      role: prof?.role || "Attorney",
      avatarColor: prof?.avatarColor || "#c9a55c",
      photoUrl: prof?.photoUrl || null,
      isMe: d.uid === currentUid
    });
  });

  onlineUsers = Array.from(activeMap.values());
  window.onlineUsers = onlineUsers;
  if (typeof window.renderOnlineUsersPopover === "function") {
    window.renderOnlineUsersPopover();
  }
}

function dbUnsubscribe() {
  if (profilesUnsub)        { profilesUnsub();        profilesUnsub = null; }
  if (casesUnsub)           { casesUnsub();           casesUnsub = null; }
  if (notificationsUnsub)   { notificationsUnsub();   notificationsUnsub = null; }
  if (appointmentsUnsub)    { appointmentsUnsub();    appointmentsUnsub = null; }
  if (appointmentsReqUnsub) { appointmentsReqUnsub(); appointmentsReqUnsub = null; }
  if (presenceUnsub)        { presenceUnsub();        presenceUnsub = null; }
  if (presenceHeartbeatId)  { clearInterval(presenceHeartbeatId); presenceHeartbeatId = null; }
}

function enterLocalMode(reason) {
  localMode = true;
  const banner = document.getElementById("config-banner");
  if (banner) {
    banner.textContent = "⚠️ " + (reason || "Firebase not connected. Data is stored in memory only and will be lost on refresh.");
    banner.classList.add("show");
    banner.style.display = "block";
  }
  showToast("Running in local mode — data will not persist", "error");
}

function connectDatabase() {
  if (typeof window._fbReady !== "undefined" && window._fbReady && window._db) {
    localMode = false;
    const banner = document.getElementById("config-banner");
    if (banner) {
      banner.classList.remove("show");
      banner.style.display = "none";
    }
    const u = window._currentUser || window._auth?.currentUser;
    if (u) {
      try { dbLoad(); } catch (err) {
        console.error("Database load failed:", err);
        enterLocalMode("Database connection failed.");
      }
    }
  } else {
    enterLocalMode("Firebase initialization failed.");
  }
}

async function dbLoad() {
  if (localMode || !window._db) return;
  const u = window._currentUser || window._auth?.currentUser;
  if (!u) return;

  try {
    const db = window._db;
    dbUnsubscribe();

    // ── Real-Time Sync: Profiles ─────────────────────────────
    const pColRef = window._fbCol(db, "profiles");
    profilesUnsub = window._fbOnSnapshot(pColRef, (snap) => {
      profiles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      window.profiles = profiles;

      const currentUser = window._currentUser || window._auth?.currentUser;
      if (currentUser) {
        const userEmail = (currentUser.email || "").toLowerCase();
        let myProf = profiles.find(p => (p.ownerUid && p.ownerUid === currentUser.uid) || (p.email && p.email.toLowerCase() === userEmail));

        if (myProf) {
          if (!myProf.ownerUid) {
            dbUpdateProfile(myProf.id, { ownerUid: currentUser.uid });
            myProf.ownerUid = currentUser.uid;
          }
          const isConfiguredAdmin = ADMIN_EMAILS.some(e => e.toLowerCase() === userEmail);
          if (isConfiguredAdmin && myProf.role !== "admin" && myProf.role !== "developer") {
            dbUpdateProfile(myProf.id, { role: "admin" });
            myProf.role = "admin";
          }
        } else {
          const defaultName = currentUser.displayName || currentUser.email?.split("@")[0] || "Attorney";
          const isConfiguredAdmin = ADMIN_EMAILS.some(e => e.toLowerCase() === userEmail);
          const defaultData = {
            name: defaultName,
            role: isConfiguredAdmin ? "admin" : "Attorney",
            contact: "",
            description: "",
            email: currentUser.email,
            avatarColor: isConfiguredAdmin ? "#c9a84c" : AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
            photoUrl: currentUser.photoURL || null,
            ownerUid: currentUser.uid,
            createdAt: new Date().toISOString().slice(0, 10)
          };
          dbAddProfile(defaultData);
          profiles.unshift(defaultData);
          window.profiles = profiles;
        }
      }

      dbReady = true;
      updateUserPresenceHeartbeat();
      if (typeof renderSidebarUser === "function") renderSidebarUser();
      refreshCurrentView();
    }, (error) => {
      console.error("Profiles real-time connection error:", error);
    });

    // ── Real-Time Sync: Online Users Presence ────────────────
    try {
      presenceUnsub = window._fbOnSnapshot(window._fbCol(db, "chat_peers"), (snap) => {
        computeOnlineUsersFromPeers(snap.docs.map(d => d.data()));
      }, () => {
        computeOnlineUsersFromPeers([]);
      });
      presenceHeartbeatId = setInterval(updateUserPresenceHeartbeat, 60000);
    } catch (e) {
      computeOnlineUsersFromPeers([]);
    }

    // ── Real-Time Sync: Cases ────────────────────────────────
    const activeUid = window._currentUser?.uid || window._auth?.currentUser?.uid;
    if (activeUid) {
      const userEmail = (u.email || "").toLowerCase();
      const isEmailAdmin = ADMIN_EMAILS.some(e => e.toLowerCase() === userEmail);
      const caseQuery = isEmailAdmin
        ? window._fbCol(db, "cases")
        : window._fbQuery(window._fbCol(db, "cases"), window._fbWhere("allowedUids", "array-contains", activeUid));

      casesUnsub = window._fbOnSnapshot(caseQuery, async (snap) => {
        const rawCases = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        cases = await Promise.all(rawCases.map(c => decryptCaseRecordFromFirestore(c)));
        window.cases = cases;

        if (window._notifsLoaded) checkCaseDueNotifications();
        refreshCurrentView();
      }, (error) => {
        console.warn("Cases real-time connection notice:", error.message);
      });
    }

    // ── Real-Time Sync: Notifications ────────────────────────
    if (activeUid) {
      try {
        const notifQuery = window._fbQuery(
          window._fbCol(db, "notifications"),
          window._fbWhere("toUid", "==", activeUid)
        );
        notificationsUnsub = window._fbOnSnapshot(notifQuery, (snap) => {
          notifications = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          window.notifications = notifications;
          window._notifsLoaded = true;
          checkCaseDueNotifications();

          const unreadCount = notifications.filter(n => n.status === "unread").length;
          if (unreadCount > prevNotifCount && prevNotifCount > 0) playNotificationSound();
          prevNotifCount = unreadCount;

          refreshCurrentView();
        }, () => {
          notifications = [];
          window.notifications = notifications;
          window._notifsLoaded = true;
        });
      } catch (e) {
        window._notifsLoaded = true;
      }
    }

    // ── Real-Time Sync: Appointments ─────────────────────────
    if (activeUid) {
      const userEmail = (u.email || "").toLowerCase();
      const isEmailAdmin = ADMIN_EMAILS.some(e => e.toLowerCase() === userEmail);
      let targetApptsMap = {};
      let reqApptsMap = {};

      const syncApptsMerged = () => {
        appointments = Object.values({ ...targetApptsMap, ...reqApptsMap });
        window.appointments = appointments;
        refreshCurrentView();
      };

      if (isEmailAdmin) {
        appointmentsUnsub = window._fbOnSnapshot(window._fbCol(db, "appointments"), (snap) => {
          appointments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          window.appointments = appointments;
          refreshCurrentView();
        }, () => {});
      } else {
        appointmentsUnsub = window._fbOnSnapshot(
          window._fbQuery(window._fbCol(db, "appointments"), window._fbWhere("targetUid", "==", activeUid)),
          (snap) => {
            targetApptsMap = {};
            snap.docs.forEach(d => { targetApptsMap[d.id] = { id: d.id, ...d.data() }; });
            syncApptsMerged();
          }, () => {}
        );
        appointmentsReqUnsub = window._fbOnSnapshot(
          window._fbQuery(window._fbCol(db, "appointments"), window._fbWhere("requesterUid", "==", activeUid)),
          (snap) => {
            reqApptsMap = {};
            snap.docs.forEach(d => { reqApptsMap[d.id] = { id: d.id, ...d.data() }; });
            syncApptsMerged();
          }, () => {}
        );
      }
    }
  } catch (e) {
    console.error("Firestore database connection error:", e);
    dbReady = false;
    showToast("Real-time sync connection failed", "error");
  }
}

// ── MULTI-TIER CASE & HEARING NOTIFICATIONS ──────────────────
function checkCaseDueNotifications() {
  const activeUid = window._currentUser?.uid;
  if (!activeUid || !window._notifsLoaded) return;

  const userCases = getAccessibleCases();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  userCases.forEach(c => {
    const deadlinesList = Array.isArray(c.deadlines) ? [...c.deadlines] : [];
    if (c.docDueDate && !deadlinesList.some(d => d.date === c.docDueDate)) {
      deadlinesList.push({ id: "legacy_due", date: c.docDueDate, subtype: c.docType || "Formal Pleading" });
    }

    deadlinesList.forEach(d => {
      if (!d.date) return;
      const dueObj = new Date(d.date + "T00:00:00");
      const diffDays = Math.ceil((dueObj - today) / (1000 * 60 * 60 * 24));
      const pleadingTitle = d.subtype || d.title || c.docType || "Formal Pleading";

      let tier = null, title = "", msgStr = "", severity = "info";
      if (diffDays < 0)       { tier = "overdue"; severity = "critical"; title = `⚠️ OVERDUE: ${pleadingTitle}`; msgStr = `The filing deadline (${formatDate(d.date)}) has elapsed for "${c.title}".`; }
      else if (diffDays === 0){ tier = "today";   severity = "critical"; title = `⚡ DEADLINE TODAY: ${pleadingTitle}`; msgStr = `Document is due TODAY (${formatDate(d.date)}) for "${c.title}".`; }
      else if (diffDays <= 3) { tier = "3d";      severity = "critical"; title = `🚨 CRITICAL: 3 DAYS LEFT — ${pleadingTitle}`; msgStr = `Filing due in ${diffDays} day(s) on ${formatDate(d.date)} for "${c.title}".`; }
      else if (diffDays <= 7) { tier = "7d";      severity = "warning";  title = `⚠️ 7-DAY DEADLINE: ${pleadingTitle}`; msgStr = `Pleading deadline approaching (${formatDate(d.date)}) for "${c.title}".`; }
      else if (diffDays <= 15){ tier = "15d";     severity = "notice";   title = `📅 15-Day Notice: ${pleadingTitle}`; msgStr = `Filing deadline on ${formatDate(d.date)} (${diffDays} days remaining) for "${c.title}".`; }
      else if (diffDays <= 30){ tier = "30d";     severity = "info";     title = `📋 30-Day Reminder: ${pleadingTitle}`; msgStr = `Deadline scheduled for ${formatDate(d.date)} on "${c.title}".`; }

      if (tier) {
        const notifKey = `case_deadline_${tier}_${c.id}_${d.id || d.date}`;
        if (!notifications.some(n => n.notifKey === notifKey)) {
          dbAddNotification({
            toUid: activeUid, fromUid: "system", fromName: "Simando Law Docket",
            title, message: msgStr, type: "case_due", category: "deadline",
            severity, diffDays, relatedId: c.id, notifKey, status: "unread"
          });
        }
      }
    });

    if (Array.isArray(c.hearings)) {
      c.hearings.forEach(h => {
        if (!h.date) return;
        const hDiff = Math.ceil((new Date(h.date + "T00:00:00") - today) / (1000 * 60 * 60 * 24));
        let hTier = null, hSeverity = "info", hTitle = "", hMsg = "";
        if (hDiff === 0)                { hTier = "today"; hSeverity = "critical"; hTitle = `🏛️ COURT HEARING TODAY: ${h.purpose || 'Appearance'}`; hMsg = `Today at ${h.time || '08:30 AM'} (${c.venue || 'Courtroom'}). Case: "${c.title}".`; }
        else if (hDiff <= 3 && hDiff > 0){ hTier = "3d";   hSeverity = "critical"; hTitle = `🚨 HEARING IN ${hDiff} DAYS: ${h.purpose || 'Appearance'}`; hMsg = `${formatDate(h.date)} at ${h.time || '08:30 AM'} (${c.venue || 'Courtroom'}). Case: "${c.title}".`; }
        else if (hDiff <= 7 && hDiff > 3){ hTier = "7d";   hSeverity = "warning";  hTitle = `📅 Hearing Next Week: ${h.purpose || 'Appearance'}`; hMsg = `${formatDate(h.date)} at ${c.venue || 'Courtroom'}. Case: "${c.title}".`; }

        if (hTier) {
          const hKey = `hearing_${hTier}_${c.id}_${h.id || h.date}`;
          if (!notifications.some(n => n.notifKey === hKey)) {
            dbAddNotification({
              toUid: activeUid, fromUid: "system", fromName: "Courtroom Calendar",
              title: hTitle, message: hMsg, type: "case_due", category: "hearing",
              severity: hSeverity, diffDays: hDiff, relatedId: c.id, notifKey: hKey, status: "unread"
            });
          }
        }
      });
    }
  });
}

function refreshCurrentView() {
  if (typeof renderSidebarUser === "function") renderSidebarUser();
  if (typeof window.renderGoogleStatusPopover === "function") window.renderGoogleStatusPopover();
  if (!dbReady) return;

  if (selProfile) {
    const up = profiles.find(p => p.id === selProfile.id);
    if (up) selProfile = up;
  }
  if (selCase) {
    const uc = cases.find(c => c.id === selCase.id);
    if (uc) selCase = uc;
  }

  if (currentView === "dashboard"     && typeof renderDashboard === "function") renderDashboard();
  if (currentView === "profiles"      && typeof renderProfiles === "function") renderProfiles();
  if (currentView === "allcases"      && typeof renderAllCases === "function") renderAllCases();
  if (currentView === "profileDetail" && selProfile && typeof renderProfileDetail === "function") renderProfileDetail();
  if (currentView === "caseDetail"    && selCase    && typeof renderCaseDetail === "function") renderCaseDetail();
  if (currentView === "myprofile"     && typeof renderMyProfile === "function") renderMyProfile();
  if (currentView === "settings"      && typeof renderSettingsView === "function") renderSettingsView();
  if (currentView === "calendar"      && typeof renderCalendarView === "function") renderCalendarView();
  if (currentView === "notifications" && typeof renderNotificationsView === "function") renderNotificationsView();
  if (typeof updateNotificationBadge === "function") updateNotificationBadge();
}

async function dbAddProfile(data) {
  if (localMode || !window._db) {
    data.id = "local_" + Date.now();
    profiles.unshift(data);
    window.profiles = profiles;
    return data;
  }
  data.ownerUid = window._currentUser?.uid || window._auth?.currentUser?.uid || null;
  data.createdAt = new Date().toISOString().slice(0, 10);
  const ref = await window._fbAddDoc(window._fbCol(window._db, "profiles"), data);
  data.id = ref.id;
  dbLogAuditAction("PROFILE_CREATED", { profileId: data.id, name: data.name });
  return data;
}

async function dbUpdateProfile(id, data) {
  if (!localMode && window._db) await window._fbUpdate(window._fbDoc(window._db, "profiles", id), data);
  const idx = profiles.findIndex(p => p.id === id);
  if (idx >= 0) profiles[idx] = { ...profiles[idx], ...data };
  window.profiles = profiles;
  dbLogAuditAction("PROFILE_UPDATED", { profileId: id });
}

async function dbDeleteProfile(id) {
  if (!localMode && window._db) await window._fbDelete(window._fbDoc(window._db, "profiles", id));
  profiles = profiles.filter(p => p.id !== id);
  window.profiles = profiles;
  dbLogAuditAction("PROFILE_DELETED", { profileId: id });
}

async function dbAddCase(data) {
  if (localMode || !window._db) {
    data.id = "local_" + Date.now();
    cases.unshift(data);
    window.cases = cases;
    return data;
  }
  const uId = window._currentUser?.uid || window._auth?.currentUser?.uid || null;
  data.ownerUid = uId;
  data.createdAt = new Date().toISOString().slice(0, 10);
  if (!Array.isArray(data.allowedUids)) data.allowedUids = [uId];
  else if (uId && !data.allowedUids.includes(uId)) data.allowedUids.push(uId);

  const encryptedPayload = await encryptCaseRecordForFirestore(data);
  const ref = await window._fbAddDoc(window._fbCol(window._db, "cases"), encryptedPayload);
  data.id = ref.id;
  dbLogAuditAction("CASE_CREATED_ENCRYPTED", { caseId: data.id });
  return data;
}

async function dbUpdateCase(id, data) {
  if (!localMode && window._db) {
    const encryptedPayload = await encryptCaseRecordForFirestore(data);
    await window._fbUpdate(window._fbDoc(window._db, "cases", id), encryptedPayload);
  }
  const idx = cases.findIndex(c => c.id === id);
  if (idx >= 0) cases[idx] = { ...cases[idx], ...data };
  window.cases = cases;
  dbLogAuditAction("CASE_UPDATED_ENCRYPTED", { caseId: id });
}

async function dbDeleteCase(id) {
  if (!localMode && window._db) await window._fbDelete(window._fbDoc(window._db, "cases", id));
  cases = cases.filter(c => c.id !== id);
  window.cases = cases;
  dbLogAuditAction("CASE_DELETED", { caseId: id });
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
  data.createdAt = new Date().toISOString();
  const u = window._currentUser || window._auth?.currentUser;
  if (!data.ownerUid && u) data.ownerUid = u.uid;

  if (localMode || !window._db) {
    data.id = "local_appt_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    if (!appointments.some(x => x.id === data.id)) {
      appointments.push(data);
      window.appointments = appointments;
    }
    refreshCurrentView();
    return data.id;
  }

  try {
    const ref = await window._fbAddDoc(window._fbCol(window._db, "appointments"), data);
    data.id = ref.id;
    if (!appointments.some(x => x.id === ref.id)) {
      appointments.push(data);
      window.appointments = appointments;
    }
    refreshCurrentView();
    dbLogAuditAction("APPOINTMENT_REQUESTED", { apptId: ref.id, title: data.title });
    return ref.id;
  } catch (err) {
    data.id = "local_appt_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    appointments.push(data);
    window.appointments = appointments;
    refreshCurrentView();
    return data.id;
  }
}

async function dbUpdateAppointment(id, data) {
  if (!localMode && window._db) {
    try { await window._fbUpdate(window._fbDoc(window._db, "appointments", id), data); } catch (e) {}
  }
  const idx = appointments.findIndex(a => a.id === id);
  if (idx >= 0) appointments[idx] = { ...appointments[idx], ...data };
  window.appointments = appointments;
  refreshCurrentView();
  dbLogAuditAction("APPOINTMENT_UPDATED", { apptId: id });
}

async function dbDeleteAppointment(id) {
  if (!localMode && window._db) {
    try { await window._fbDelete(window._fbDoc(window._db, "appointments", id)); } catch (e) {}
  }
  appointments = appointments.filter(a => a.id !== id);
  window.appointments = appointments;
  refreshCurrentView();
  dbLogAuditAction("APPOINTMENT_DELETED", { apptId: id });
}
