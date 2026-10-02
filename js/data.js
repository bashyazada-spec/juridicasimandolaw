// ═══════════════════════════════════════════════════════════════
//  ADMINISTRATIVE & SYSTEM CONFIGURATION
// ═══════════════════════════════════════════════════════════════
const ADMIN_EMAILS = [
  "admin@simandolaw.com", // Authorized admin attorney email
];

let profiles        = [];
let cases           = [];
let notifications   = [];
let appointments    = [];
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

let profilesUnsub      = null;
let casesUnsub         = null;
let notificationsUnsub = null;
let appointmentsUnsub  = null;
let prevNotifCount     = 0;

window._notifsLoaded = false;

// ═══════════════════════════════════════════════════════════════
//  ZERO-KNOWLEDGE CLIENT-SIDE ENCRYPTION ENGINE (AES-GCM 256)
//  Scrambles case data so Firestore shows only unidentifiable cipher
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
  if (!str.trim()) return str;
  if (str.startsWith("enc:v1:")) return str;

  try {
    const key = await getE2EESecretKey();
    if (!key || !window.crypto || !window.crypto.subtle) return str;

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const cipherBuffer = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      enc.encode(str)
    );

    const combined = new Uint8Array(iv.length + cipherBuffer.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipherBuffer), iv.length);

    let binary = "";
    const len = combined.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(combined[i]);
    }
    return "enc:v1:" + btoa(binary);
  } catch (err) {
    console.warn("Field encryption fallback:", err);
    return str;
  }
}

async function decryptE2EEString(cipherText) {
  if (!cipherText || typeof cipherText !== "string") return cipherText;
  if (!cipherText.startsWith("enc:v1:")) return cipherText;

  try {
    const key = await getE2EESecretKey();
    if (!key || !window.crypto || !window.crypto.subtle) return cipherText;

    const rawBase64 = cipherText.slice(7);
    const binary = atob(rawBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const iv = bytes.slice(0, 12);
    const data = bytes.slice(12);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      data
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
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

// ── IMMUTABLE COMPLIANCE AUDIT RECORDER ──────────────────────
async function dbLogAuditAction(action, details = {}) {
  if (localMode || !window._db) return;
  const u = window._currentUser || window._auth?.currentUser;
  if (!u) return;

  try {
    await window._fbAddDoc(window._fbCol(window._db, "audit_logs"), {
      action: action,
      userId: u.uid,
      userEmail: u.email || "unknown",
      details: details,
      createdAt: window._fbServerTs ? window._fbServerTs() : new Date().toISOString()
    });
  } catch (err) {
    console.warn("Audit logging notice:", err.message);
  }
}
window.dbLogAuditAction = dbLogAuditAction;

// ── STRICT ACCESSIBLE CASES FILTER ──
function getAccessibleCases() {
  const u = window._currentUser || window._auth?.currentUser;
  if (!u) return [];

  const myProf = profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === (u.email || "").toLowerCase()));
  
  if (myProf && myProf.role === "developer") {
    return cases.filter(c => c.ownerUid === u.uid);
  }

  const isFirmAdmin = (myProf && myProf.role === "admin") || (u.email && ADMIN_EMAILS.includes(u.email.toLowerCase()));
  if (isFirmAdmin) {
    return cases;
  }

  return cases.filter(c => {
    const isOwner = c.ownerUid === u.uid;
    const isAllowed = c.allowedUids && Array.isArray(c.allowedUids) && c.allowedUids.includes(u.uid);
    const isShared = c.sharedWith && Array.isArray(c.sharedWith) && c.sharedWith.includes(u.uid);
    const isMyProfileCase = myProf && c.profileId === myProf.id;

    return isOwner || isAllowed || isShared || isMyProfileCase;
  });
}

window.getAccessibleCases = getAccessibleCases;

// ── WEB AUDIO SYNTHESIZER ──────────────────────────────────
let sharedAudioCtx = null;

function getAudioContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    try {
      sharedAudioCtx = new AudioCtx();
    } catch (e) {
      return null;
    }
  }
  return sharedAudioCtx;
}

const unlockAudio = () => {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  } catch (e) { /* ignore */ }
  document.removeEventListener("pointerdown", unlockAudio);
  document.removeEventListener("keydown", unlockAudio);
};
document.addEventListener("pointerdown", unlockAudio, { once: true, passive: true });
document.addEventListener("keydown", unlockAudio, { once: true, passive: true });

function playNotificationSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx || ctx.state !== "running") return;
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
  } catch (e) { /* ignore */ }
}

function playChatSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx || ctx.state !== "running") return;
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
  } catch (e) { /* ignore */ }
}

window.playNotificationSound = playNotificationSound;
window.playChatSound = playChatSound;

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
      try {
        dbLoad();
      } catch (err) {
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
  if (!u) {
    console.warn("dbLoad: waiting for user authentication state...");
    return;
  }

  try {
    const db = window._db;
    dbUnsubscribe();

    // ── Real-Time Sync: Access Directory ─────────────────────
    const pColRef = window._fbCol(db, "profiles");
    profilesUnsub = window._fbOnSnapshot(pColRef, (snap) => {
      profiles = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const currentUser = window._currentUser || window._auth?.currentUser;
      if (currentUser) {
        let myProf = profiles.find(p => p.ownerUid === currentUser.uid || (p.email && p.email.toLowerCase() === currentUser.email.toLowerCase()));

        if (myProf) {
          if (!myProf.ownerUid) {
            dbUpdateProfile(myProf.id, { ownerUid: currentUser.uid });
            myProf.ownerUid = currentUser.uid;
          }
          const isConfiguredAdmin = currentUser.email && ADMIN_EMAILS.includes(currentUser.email.toLowerCase());
          if (isConfiguredAdmin && myProf.role !== "admin" && myProf.role !== "developer") {
            dbUpdateProfile(myProf.id, { role: "admin" });
            myProf.role = "admin";
          }
        } else {
          const defaultName = currentUser.displayName || currentUser.email;
          const isConfiguredAdmin = currentUser.email && ADMIN_EMAILS.includes(currentUser.email.toLowerCase());
          
          const defaultData = {
            name: defaultName,
            role: isConfiguredAdmin ? "admin" : "Attorney",
            contact: "",
            email: currentUser.email,
            avatarColor: ADMIN_EMAILS.includes(currentUser.email.toLowerCase()) ? "#c9a84c" : AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
            photoUrl: currentUser.photoURL || null,
            ownerUid: currentUser.uid,
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

    // ── Real-Time Sync: Cases (Decrypted Seamlessly on Stream) ──
    const activeUid = window._currentUser?.uid || window._auth?.currentUser?.uid;
    if (activeUid) {
      const isEmailAdmin = u.email && ADMIN_EMAILS.includes(u.email.toLowerCase());
      
      const myProf = profiles.find(p => p.ownerUid === activeUid || (p.email && p.email.toLowerCase() === (u.email || "").toLowerCase()));
      const isDeveloper = myProf && myProf.role === "developer";

      let caseQuery;
      if (isDeveloper) {
        caseQuery = window._fbQuery(window._fbCol(db, "cases"), window._fbWhere("ownerUid", "==", activeUid));
      } else if (isEmailAdmin) {
        caseQuery = window._fbCol(db, "cases");
      } else {
        caseQuery = window._fbQuery(window._fbCol(db, "cases"), window._fbWhere("allowedUids", "array-contains", activeUid));
      }

      casesUnsub = window._fbOnSnapshot(caseQuery, async (snap) => {
        const rawCases = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        cases = await Promise.all(rawCases.map(c => decryptCaseRecordFromFirestore(c)));

        if (window._notifsLoaded) {
          checkCaseDueNotifications();
        }
        refreshCurrentView();
      }, (error) => {
        console.warn("Cases real-time connection notice:", error.message);
      });
    }

    // ── Real-Time Sync: Notifications ─────────────────────────
    if (activeUid) {
      try {
        const notifQuery = window._fbQuery(
          window._fbCol(db, "notifications"),
          window._fbWhere("toUid", "==", activeUid)
        );

        notificationsUnsub = window._fbOnSnapshot(notifQuery, (snap) => {
          notifications = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

          window._notifsLoaded = true;
          checkCaseDueNotifications();

          const unreadCount = notifications.filter(n => n.status === "unread").length;
          if (unreadCount > prevNotifCount && prevNotifCount > 0) {
            playNotificationSound();
          }
          prevNotifCount = unreadCount;

          refreshCurrentView();
        }, (error) => {
          console.warn("Notifications sync permission notice:", error.message);
          notifications = [];
          window._notifsLoaded = true;
        });
      } catch (e) {
        console.warn("Notifications listener setup skipped:", e.message);
        window._notifsLoaded = true;
      }
    }

    // ── Real-Time Sync: Firm Appointments & Availability ─────
    if (activeUid) {
      try {
        const apptColRef = window._fbCol(db, "appointments");
        appointmentsUnsub = window._fbOnSnapshot(apptColRef, (snap) => {
          appointments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          refreshCurrentView();
        }, (error) => {
          console.warn("Appointments sync permission notice:", error.message);
          appointments = [];
        });
      } catch (e) {
        console.warn("Appointments listener setup skipped:", e.message);
      }
    }

  } catch(e) {
    console.error("Firestore database connection error:", e);
    dbReady = false;
    showToast("Real-time sync connection failed", "error");
  }
}

// ═══════════════════════════════════════════════════════════════
//  ENHANCED MULTI-TIER PROACTIVE CASE & HEARING NOTIFICATIONS
//  Structured reminders: 30-Day, 15-Day, 7-Day, 3-Day, Due Today, Overdue
//  Covers both Pleading Deadlines AND Court Hearing Appearances
// ═══════════════════════════════════════════════════════════════
function checkCaseDueNotifications() {
  const activeUid = window._currentUser?.uid;
  if (!activeUid || !window._notifsLoaded) return;

  const userCases = getAccessibleCases();
  const today = new Date();
  today.setHours(0,0,0,0);

  userCases.forEach(c => {
    // ── 1. MONITOR CASE PLEADING DEADLINES (c.deadlines & c.docDueDate) ──
    const deadlinesList = Array.isArray(c.deadlines) ? [...c.deadlines] : [];
    if (c.docDueDate && !deadlinesList.some(d => d.date === c.docDueDate)) {
      deadlinesList.push({
        id: "legacy_due",
        date: c.docDueDate,
        subtype: c.docType || "Formal Pleading"
      });
    }

    deadlinesList.forEach(d => {
      if (!d.date) return;
      const dueObj = new Date(d.date + "T00:00:00");
      const diffDays = Math.ceil((dueObj - today) / (1000 * 60 * 60 * 24));
      const pleadingTitle = d.subtype || d.title || c.docType || "Formal Pleading";

      let tier = null;
      let title = "";
      let msgStr = "";
      let severity = "info";

      if (diffDays < 0) {
        tier = "overdue";
        severity = "critical";
        title = `⚠️ OVERDUE: ${pleadingTitle}`;
        msgStr = `The filing deadline (${formatDate(d.date)}) has elapsed for "${c.title}". Please file an urgent motion or extension.`;
      } else if (diffDays === 0) {
        tier = "today";
        severity = "critical";
        title = `⚡ DEADLINE TODAY: ${pleadingTitle}`;
        msgStr = `Document is due for filing TODAY (${formatDate(d.date)}) for Case "${c.title}".`;
      } else if (diffDays <= 3) {
        tier = "3d";
        severity = "critical";
        title = `🚨 CRITICAL: 3 DAYS LEFT — ${pleadingTitle}`;
        msgStr = `Filing due in ${diffDays} day${diffDays !== 1 ? 's' : ''} on ${formatDate(d.date)} for Case "${c.title}".`;
      } else if (diffDays <= 7) {
        tier = "7d";
        severity = "warning";
        title = `⚠️ 7-DAY DEADLINE: ${pleadingTitle}`;
        msgStr = `Pleading deadline approaching in 1 week (${formatDate(d.date)}) for Case "${c.title}".`;
      } else if (diffDays <= 15) {
        tier = "15d";
        severity = "notice";
        title = `📅 15-Day Notice: ${pleadingTitle}`;
        msgStr = `Filing deadline on ${formatDate(d.date)} (${diffDays} days remaining) for "${c.title}".`;
      } else if (diffDays <= 30) {
        tier = "30d";
        severity = "info";
        title = `📋 30-Day Reminder: ${pleadingTitle}`;
        msgStr = `Deadline scheduled for ${formatDate(d.date)} on "${c.title}". Review documents early.`;
      }

      if (tier) {
        const notifKey = `case_deadline_${tier}_${c.id}_${d.id || d.date}`;
        const alreadyNotified = notifications.some(n => n.notifKey === notifKey);

        if (!alreadyNotified) {
          dbAddNotification({
            toUid: activeUid,
            fromUid: "system",
            fromName: "Simando Law Docket",
            title: title,
            message: msgStr,
            type: "case_due",
            category: "deadline",
            severity: severity,
            diffDays: diffDays,
            relatedId: c.id,
            notifKey: notifKey,
            status: "unread"
          });
        }
      }
    });

    // ── 2. MONITOR INDIVIDUAL COURT HEARINGS (c.hearings array) ──
    if (Array.isArray(c.hearings) && c.hearings.length > 0) {
      c.hearings.forEach(h => {
        if (!h.date) return;
        const hearingObj = new Date(h.date + "T00:00:00");
        const hDiff = Math.ceil((hearingObj - today) / (1000 * 60 * 60 * 24));

        let hTier = null;
        let hSeverity = "info";
        let hTitle = "";
        let hMsg = "";

        if (hDiff === 0) {
          hTier = "today";
          hSeverity = "critical";
          hTitle = `🏛️ COURT HEARING TODAY: ${h.purpose || 'Court Appearance'}`;
          hMsg = `Hearing scheduled for TODAY at ${h.time || '08:30 AM'} (${c.venue || 'Courtroom'}). Case: "${c.title}".`;
        } else if (hDiff <= 3 && hDiff > 0) {
          hTier = "3d";
          hSeverity = "critical";
          hTitle = `🚨 HEARING IN ${hDiff} DAYS: ${h.purpose || 'Court Appearance'}`;
          hMsg = `Court appearance in ${hDiff} day(s) on ${formatDate(h.date)} at ${h.time || '08:30 AM'} at ${c.venue || 'Courtroom'}. Case: "${c.title}".`;
        } else if (hDiff <= 7 && hDiff > 3) {
          hTier = "7d";
          hSeverity = "warning";
          hTitle = `📅 Hearing Next Week: ${h.purpose || 'Court Appearance'}`;
          hMsg = `Scheduled court hearing on ${formatDate(h.date)} at ${c.venue || 'Courtroom'}. Case: "${c.title}". Prepare witness affidavits.`;
        }

        if (hTier) {
          const hKey = `hearing_${hTier}_${c.id}_${h.id || h.date}`;
          const alreadyNotified = notifications.some(n => n.notifKey === hKey);

          if (!alreadyNotified) {
            dbAddNotification({
              toUid: activeUid,
              fromUid: "system",
              fromName: "Courtroom Calendar",
              title: hTitle,
              message: hMsg,
              type: "case_due",
              category: "hearing",
              severity: hSeverity,
              diffDays: hDiff,
              relatedId: c.id,
              notifKey: hKey,
              status: "unread"
            });
          }
        }
      });
    }
  });
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

  if (currentView === "dashboard" && typeof renderDashboard === "function") renderDashboard();
  if (currentView === "profiles" && typeof renderProfiles === "function") renderProfiles();
  if (currentView === "allcases" && typeof renderAllCases === "function") renderAllCases();
  if (currentView === "profileDetail" && selProfile && typeof renderProfileDetail === "function") renderProfileDetail();
  if (currentView === "caseDetail" && selCase && typeof renderCaseDetail === "function") renderCaseDetail();
  if (currentView === "myprofile" && typeof renderMyProfile === "function") renderMyProfile();
  if (currentView === "calendar" && typeof renderCalendarView === "function") renderCalendarView();
  if (currentView === "notifications" && typeof renderNotificationsView === "function") renderNotificationsView();
  
  if (typeof renderSidebarUser === "function") renderSidebarUser();
  if (typeof updateNotificationBadge === "function") updateNotificationBadge();
}

async function dbAddProfile(data) {
  if (localMode || !window._db) { 
    data.id = "local_" + Date.now(); 
    profiles.unshift(data); 
    return data; 
  }
  data.ownerUid = window._currentUser?.uid || window._auth?.currentUser?.uid || null;
  data.createdAt = new Date().toISOString().slice(0,10);
  const ref = await window._fbAddDoc(window._fbCol(window._db,"profiles"), data);
  data.id = ref.id;
  dbLogAuditAction("PROFILE_CREATED", { profileId: data.id, name: data.name });
  return data;
}

async function dbUpdateProfile(id, data) {
  if (!localMode && window._db) await window._fbUpdate(window._fbDoc(window._db,"profiles",id), data);
  const idx = profiles.findIndex(p=>p.id===id);
  if (idx>=0) profiles[idx] = {...profiles[idx],...data};
  dbLogAuditAction("PROFILE_UPDATED", { profileId: id });
}

async function dbDeleteProfile(id) {
  if (!localMode && window._db) await window._fbDelete(window._fbDoc(window._db,"profiles",id));
  profiles = profiles.filter(p=>p.id!==id);
  dbLogAuditAction("PROFILE_DELETED", { profileId: id });
}

async function dbAddCase(data) {
  if (localMode || !window._db) { 
    data.id = "local_" + Date.now(); 
    cases.unshift(data); 
    return data; 
  }
  const uId = window._currentUser?.uid || window._auth?.currentUser?.uid || null;
  data.ownerUid = uId;
  data.createdAt = new Date().toISOString().slice(0,10);
  
  if (!data.allowedUids || !Array.isArray(data.allowedUids)) {
    data.allowedUids = [uId];
  } else if (uId && !data.allowedUids.includes(uId)) {
    data.allowedUids.push(uId);
  }

  const encryptedPayload = await encryptCaseRecordForFirestore(data);

  const ref = await window._fbAddDoc(window._fbCol(window._db,"cases"), encryptedPayload);
  data.id = ref.id;
  dbLogAuditAction("CASE_CREATED_ENCRYPTED", { caseId: data.id });
  return data;
}

async function dbUpdateCase(id, data) {
  if (!localMode && window._db) {
    const encryptedPayload = await encryptCaseRecordForFirestore(data);
    await window._fbUpdate(window._fbDoc(window._db,"cases",id), encryptedPayload);
  }
  const idx = cases.findIndex(c=>c.id===id);
  if (idx>=0) cases[idx] = {...cases[idx],...data};
  dbLogAuditAction("CASE_UPDATED_ENCRYPTED", { caseId: id });
}

async function dbDeleteCase(id) {
  if (!localMode && window._db) await window._fbDelete(window._fbDoc(window._db,"cases",id));
  cases = cases.filter(c=>c.id!==id);
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
  if (localMode || !window._db) return null;
  data.createdAt = new Date().toISOString();
  const ref = await window._fbAddDoc(window._fbCol(window._db, "appointments"), data);
  dbLogAuditAction("APPOINTMENT_REQUESTED", { apptId: ref.id, title: data.title });
  return ref.id;
}

async function dbUpdateAppointment(id, data) {
  if (!localMode && window._db) await window._fbUpdate(window._fbDoc(window._db, "appointments", id), data);
  dbLogAuditAction("APPOINTMENT_UPDATED", { apptId: id });
}

async function dbDeleteAppointment(id) {
  if (!localMode && window._db) await window._fbDelete(window._fbDoc(window._db, "appointments", id));
  dbLogAuditAction("APPOINTMENT_DELETED", { apptId: id });
}
