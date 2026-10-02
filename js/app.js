// ═══════════════════════════════════════════════════════════════
//  SIMANDO LAW — APPLICATION CONTROLLER & CASE LIFECYCLE
// ═══════════════════════════════════════════════════════════════

// Global Sidebar Toggle & Collapse State
window.toggleSidebar = function() {
  document.body.classList.toggle("sidebar-collapsed");
  const isCollapsed = document.body.classList.contains("sidebar-collapsed");
  try {
    localStorage.setItem("simando-sidebar-collapsed", isCollapsed ? "true" : "false");
  } catch (e) { /* ignore */ }
};

(function restoreSidebarState() {
  try {
    const saved = localStorage.getItem("simando-sidebar-collapsed");
    if (saved === "true") {
      document.body.classList.add("sidebar-collapsed");
    }
  } catch (e) { /* ignore */ }
})();

// ═══════════════════════════════════════════════════════════════
//  VALIDATION HELPERS (GMAIL & OUTLOOK DOMAINS)
// ═══════════════════════════════════════════════════════════════
function isValidEmail(email) {
  return /^[^\s@]+@(gmail\.com|outlook\.com)$/i.test(String(email || "").trim());
}
window.isValidEmail = isValidEmail;

function isValidMobile(num) {
  if (!num) return true;
  const cleaned = num.replace(/\D/g, "");
  return cleaned.length === 11;
}
window.isValidMobile = isValidMobile;

// ═══════════════════════════════════════════════════════════════
//  DOM HELPERS & ERROR CLEARING
// ═══════════════════════════════════════════════════════════════
let _pendingDeleteTarget = null;
let caseFormOrigin = "allcases";

function setElText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
window.setElText = setElText;

function setElVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}
window.setElVal = setElVal;

function clearCaseErrors() {
  ["cf-title-err", "cf-filed-err", "cf-parties-err", "cf-narrative-err", "cf-hearings-err"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });
  ["cf-case-title", "cf-filed", "cf-narrative"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("err");
  });
}
window.clearCaseErrors = clearCaseErrors;

window.openDriveWarningModal = function() {
  const modal = document.getElementById("drive-warning-modal");
  if (modal) modal.classList.remove("hidden");
};

window.closeDriveWarningModal = function() {
  const modal = document.getElementById("drive-warning-modal");
  if (modal) modal.classList.add("hidden");
};

// ═══════════════════════════════════════════════════════════════
//  COURT HEARINGS & TIMELINE TRACKER (OPTIONAL)
// ═══════════════════════════════════════════════════════════════
let cfHearings = [];
window.cfHearings = cfHearings;

function renderCaseHearings() {
  const container = document.getElementById("cf-hearings-list");
  const badge = document.getElementById("cf-hearing-status-badge");
  const errEl = document.getElementById("cf-hearings-err");

  if (!container) return;

  const count = cfHearings.length;
  if (badge) {
    badge.textContent = `${count} LOGGED`;
    if (count > 0) {
      badge.style.background = "rgba(52,211,153,0.18)";
      badge.style.color = "var(--green)";
    } else {
      badge.style.background = "rgba(255,255,255,0.06)";
      badge.style.color = "var(--text-dim)";
    }
  }

  if (errEl) errEl.classList.add("hidden");

  if (count === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:14px;background:var(--surface);border:1px dashed var(--border);border-radius:8px;color:var(--text-muted);font-size:12px">
        No court hearing dates logged. You can add scheduled or past court appearances below.
      </div>
    `;
    return;
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const sorted = [...cfHearings].sort((a, b) => new Date(a.date) - new Date(b.date));

  container.innerHTML = sorted.map((h, i) => {
    const isPast = h.date < todayStr;
    const badgeMarkup = isPast
      ? `<span class="badge" style="background:rgba(255,255,255,0.06);color:var(--text-dim);font-size:9.5px"><i class="bi bi-clock-history"></i> Past Hearing</span>`
      : `<span class="badge" style="background:rgba(52,211,153,0.15);color:var(--green);font-size:9.5px"><i class="bi bi-calendar-event"></i> Upcoming Hearing</span>`;

    return `
      <div style="display:flex;align-items:flex-start;justify-content:space-between;padding:10px 12px;background:var(--surface);border:1px solid var(--border);border-left:4px solid ${isPast ? 'var(--text-dim)' : 'var(--gold)'};border-radius:8px;margin-bottom:6px">
        <div style="flex:1;min-width:0;padding-right:8px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap">
            ${badgeMarkup}
            <span style="font-weight:700;font-size:12.5px;color:var(--text)">${formatDate(h.date)}</span>
            ${h.time ? `<span style="font-size:11px;color:var(--text-muted)"><i class="bi bi-clock"></i> ${h.time}</span>` : ''}
          </div>
          <div style="font-size:12px;font-weight:600;color:var(--gold-light)">${escHtml(h.purpose)}</div>
          ${h.notes ? `<div style="font-size:11px;color:var(--text-dim);margin-top:2px;font-style:italic">"${escHtml(h.notes)}"</div>` : ''}
        </div>
        <button type="button" onclick="removeCaseHearing(${i})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;padding:2px 6px" title="Remove hearing"><i class="bi bi-x-lg"></i></button>
      </div>
    `;
  }).join("");
}

function addCaseHearing() {
  const dateInp = document.getElementById("cf-new-hearing-date");
  const timeInp = document.getElementById("cf-new-hearing-time");
  const purposeInp = document.getElementById("cf-new-hearing-purpose");
  const notesInp = document.getElementById("cf-new-hearing-notes");

  const date = (dateInp?.value || "").trim();
  if (!date) {
    showToast("Please pick a hearing date.", "error");
    if (dateInp) dateInp.focus();
    return;
  }

  cfHearings.push({
    id: "h_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    date: date,
    time: timeInp?.value || "08:30",
    purpose: purposeInp?.value || "Court Hearing",
    notes: (notesInp?.value || "").trim()
  });
  window.cfHearings = cfHearings;

  if (dateInp) dateInp.value = "";
  if (notesInp) notesInp.value = "";

  renderCaseHearings();
  showToast("Hearing logged!");
}

function removeCaseHearing(idx) {
  cfHearings.splice(idx, 1);
  window.cfHearings = cfHearings;
  renderCaseHearings();
}

window.renderCaseHearings = renderCaseHearings;
window.addCaseHearing = addCaseHearing;
window.removeCaseHearing = removeCaseHearing;

// ═══════════════════════════════════════════════════════════════
//  DOCUMENT & PLEADING DEADLINES TRACKER (OPTIONAL)
// ═══════════════════════════════════════════════════════════════
let cfDeadlines = [];
window.cfDeadlines = cfDeadlines;

function renderCaseDeadlines() {
  const container = document.getElementById("cf-deadlines-list");
  const badge = document.getElementById("cf-deadline-status-badge");

  if (!container) return;

  const count = cfDeadlines.length;
  if (badge) {
    badge.textContent = `${count} LOGGED`;
    if (count > 0) {
      badge.style.background = "rgba(201,165,92,0.2)";
      badge.style.color = "var(--gold-light)";
    } else {
      badge.style.background = "rgba(255,255,255,0.06)";
      badge.style.color = "var(--text-dim)";
    }
  }

  if (count === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:14px;background:var(--surface);border:1px dashed var(--border);border-radius:8px;color:var(--text-muted);font-size:12px">
        No document deadlines logged for this case. You can add pleading due dates below.
      </div>
    `;
    return;
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const sorted = [...cfDeadlines].sort((a, b) => new Date(a.date) - new Date(b.date));

  container.innerHTML = sorted.map((d, i) => {
    const isPast = d.date < todayStr;
    const borderCol = isPast ? "var(--text-dim)" : "var(--gold)";

    return `
      <div style="display:flex;align-items:flex-start;justify-content:space-between;padding:10px 12px;background:var(--surface);border:1px solid var(--border);border-left:4px solid ${borderCol};border-radius:8px;margin-bottom:6px">
        <div style="flex:1;min-width:0;padding-right:8px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap">
            <span class="badge" style="background:rgba(201,165,92,0.15);color:var(--gold-light);font-size:9.5px">
              <i class="bi bi-file-earmark-text"></i> Deadline
            </span>
            <span style="font-weight:700;font-size:12.5px;color:var(--text)">${formatDate(d.date)}</span>
            <span class="badge" style="background:rgba(129,140,248,0.12);color:var(--violet);font-size:9.5px">${escHtml(d.flow || 'Outbound Motion')}</span>
          </div>
          <div style="font-size:12px;font-weight:600;color:var(--gold-light)">${escHtml(d.subtype || d.title || 'Formal Pleading')}</div>
          ${d.notes ? `<div style="font-size:11px;color:var(--text-dim);margin-top:2px;font-style:italic">"${escHtml(d.notes)}"</div>` : ''}
        </div>
        <button type="button" onclick="removeCaseDeadline(${i})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;padding:2px 6px" title="Remove deadline"><i class="bi bi-x-lg"></i></button>
      </div>
    `;
  }).join("");
}

function addCaseDeadline() {
  const dateInp = document.getElementById("cf-new-deadline-date");
  const flowInp = document.getElementById("cf-new-deadline-flow");
  const subtypeInp = document.getElementById("cf-new-deadline-subtype");
  const notesInp = document.getElementById("cf-new-deadline-notes");

  const date = (dateInp?.value || "").trim();
  const subtype = (subtypeInp?.value || "").trim();

  if (!date) {
    showToast("Please pick a filing deadline date.", "error");
    if (dateInp) dateInp.focus();
    return;
  }
  if (!subtype) {
    showToast("Please enter a document or pleading subtype.", "error");
    if (subtypeInp) subtypeInp.focus();
    return;
  }

  cfDeadlines.push({
    id: "d_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    date: date,
    flow: flowInp?.value || "Outbound Motion",
    subtype: subtype,
    notes: (notesInp?.value || "").trim()
  });
  window.cfDeadlines = cfDeadlines;

  if (dateInp) dateInp.value = "";
  if (subtypeInp) subtypeInp.value = "";
  if (notesInp) notesInp.value = "";

  renderCaseDeadlines();
  showToast("Document deadline logged!");
}

function removeCaseDeadline(idx) {
  cfDeadlines.splice(idx, 1);
  window.cfDeadlines = cfDeadlines;
  renderCaseDeadlines();
}

window.renderCaseDeadlines = renderCaseDeadlines;
window.addCaseDeadline = addCaseDeadline;
window.removeCaseDeadline = removeCaseDeadline;

// ═══════════════════════════════════════════════════════════════
//  TWO-FACTOR AUTHENTICATION (TOTP ENGINE)
// ═══════════════════════════════════════════════════════════════
let generated2FASecret = null;
let generatedBackupCodes = [];

function generateRandomBase32(length = 16) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += alphabet[bytes[i] % 32];
  }
  return result;
}

function generateBackupRecoveryCodes(count = 5) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
    codes.push(`${hex.slice(0, 4)}-${hex.slice(4, 8)}`);
  }
  return codes;
}

function base32Decode(base32) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let cleaned = base32.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  let output = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = alphabet.indexOf(cleaned.charAt(i));
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

async function generateTOTPCode(secretBase32, timeStepOffset = 0) {
  const keyBytes = base32Decode(secretBase32);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );

  const epoch = Math.floor(Date.now() / 1000);
  const timeStep = Math.floor(epoch / 30) + timeStepOffset;

  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(4, timeStep, false);

  const hmacResult = await crypto.subtle.sign("HMAC", key, buffer);
  const hmacBytes = new Uint8Array(hmacResult);

  const offset = hmacBytes[hmacBytes.length - 1] & 0xf;
  const binary =
    ((hmacBytes[offset] & 0x7f) << 24) |
    ((hmacBytes[offset + 1] & 0xff) << 16) |
    ((hmacBytes[offset + 2] & 0xff) << 8) |
    (hmacBytes[offset + 3] & 0xff);

  const code = binary % 1000000;
  return String(code).padStart(6, "0");
}

async function verifyClientTOTP(token, secretBase32) {
  for (const offset of [0, -1, 1]) {
    const valid = await generateTOTPCode(secretBase32, offset);
    if (token === valid) return true;
  }
  return false;
}

window.openTwoFactorSetupModal = async function() {
  const u = window._currentUser || window._auth?.currentUser;
  if (!u) return;

  const myProf = profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase())) || { name: u.displayName || u.email, email: u.email };

  generated2FASecret = generateRandomBase32(16);
  generatedBackupCodes = generateBackupRecoveryCodes(5);

  const secretDisplay = document.getElementById("tfa-setup-secret-key");
  const qrContainer = document.getElementById("tfa-setup-qrcode");
  const codeInp = document.getElementById("tfa-setup-verify-code");
  const backupListEl = document.getElementById("tfa-setup-backup-list");

  if (secretDisplay) secretDisplay.textContent = generated2FASecret.match(/.{1,4}/g).join(" ");
  if (codeInp) codeInp.value = "";

  if (backupListEl) {
    backupListEl.innerHTML = generatedBackupCodes.map(code => `<div style="font-family:monospace;font-weight:700;padding:4px 8px;background:var(--surface2);border-radius:6px;border:1px solid var(--border);color:var(--gold-light)">${code}</div>`).join("");
  }

  const otpAuthUrl = `otpauth://totp/Simando%20Law:${encodeURIComponent(myProf.email || u.email)}?secret=${generated2FASecret}&issuer=Simando%20Law&algorithm=SHA1&digits=6&period=30`;
  
  if (qrContainer) {
    qrContainer.innerHTML = "";
    if (typeof QRCode !== "undefined") {
      new QRCode(qrContainer, {
        text: otpAuthUrl,
        width: 170,
        height: 170,
        colorDark: "#060c13",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    } else {
      qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=${encodeURIComponent(otpAuthUrl)}" alt="2FA QR" style="border-radius:8px"/>`;
    }
  }

  const modal = document.getElementById("tfa-setup-modal");
  if (modal) modal.classList.remove("hidden");
};

window.closeTwoFactorSetupModal = function() {
  const modal = document.getElementById("tfa-setup-modal");
  if (modal) modal.classList.add("hidden");
  generated2FASecret = null;
};

window.confirmAndEnableTwoFactor = async function() {
  const codeInp = document.getElementById("tfa-setup-verify-code");
  const code = (codeInp?.value || "").trim();

  if (code.length !== 6) {
    showToast("Please enter the 6-digit code from your authenticator app.", "error");
    return;
  }

  const isValid = await verifyClientTOTP(code, generated2FASecret);
  if (!isValid) {
    showToast("Invalid 6-digit verification code. Please try again.", "error");
    return;
  }

  const u = window._currentUser || window._auth?.currentUser;
  if (!u) return;
  const myProf = profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase()));
  if (!myProf) return;

  try {
    showToast("Enabling Two-Factor Security...");
    
    const secRef = window._fbDoc(window._db, "profiles", myProf.id, "private", "security");
    const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    
    await setDoc(secRef, {
      twoFactorEnabled: true,
      twoFactorSecret: generated2FASecret,
      twoFactorBackupCodes: generatedBackupCodes
    }, { merge: true });

    await dbUpdateProfile(myProf.id, {
      twoFactorEnabled: true
    });

    myProf.twoFactorEnabled = true;
    myProf.twoFactorSecret = generated2FASecret;
    myProf.twoFactorBackupCodes = generatedBackupCodes;

    sessionStorage.setItem("simando_2fa_verified", "true");

    if (typeof dbLogAuditAction === "function") {
      dbLogAuditAction("2FA_ACTIVATED", { profileId: myProf.id });
    }

    showToast("Two-Factor Authentication is now active! 🛡️");
    closeTwoFactorSetupModal();
    if (typeof renderMyProfile === "function") renderMyProfile();
  } catch (err) {
    console.error("2FA activation error:", err);
    showToast("Failed to activate 2FA: " + err.message, "error");
  }
};

window.disableTwoFactor = function() {
  const u = window._currentUser || window._auth?.currentUser;
  if (!u) return;
  const myProf = profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase()));
  if (!myProf) return;

  window.openConfirmModal({
    icon: "bi-unlock-fill",
    title: "Disable Two-Factor Auth?",
    body: "Are you sure you want to disable Two-Factor Authentication (2FA)? Your account will rely only on your password.",
    confirmText: "Disable 2FA",
    confirmStyle: "btn-danger",
    onConfirm: async () => {
      try {
        showToast("Disabling 2FA...");
        
        const secRef = window._fbDoc(window._db, "profiles", myProf.id, "private", "security");
        const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        
        await setDoc(secRef, {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: []
        }, { merge: true });

        await dbUpdateProfile(myProf.id, {
          twoFactorEnabled: false
        });

        myProf.twoFactorEnabled = false;
        myProf.twoFactorSecret = null;
        myProf.twoFactorBackupCodes = [];

        sessionStorage.removeItem("simando_2fa_verified");

        if (typeof dbLogAuditAction === "function") {
          dbLogAuditAction("2FA_DISABLED", { profileId: myProf.id });
        }

        showToast("Two-Factor Authentication disabled.");
        if (typeof renderMyProfile === "function") renderMyProfile();
      } catch (err) {
        console.error("2FA disable error:", err);
        showToast("Failed to disable 2FA: " + err.message, "error");
      }
    }
  });
};

// ═══════════════════════════════════════════════════════════════
//  DELETE CONFIRMATION & DIALOGS
// ═══════════════════════════════════════════════════════════════
window.checkDeleteInput = function() {
  const input = document.getElementById("del-confirm-input");
  const btn = document.getElementById("del-confirm-btn");
  const err = document.getElementById("del-input-err");
  const targetLabel = document.getElementById("del-confirm-target-text");
  if (!input || !btn) return;

  const val = input.value.trim();
  const expected = targetLabel ? targetLabel.textContent.trim() : "DELETE";

  const isMatched = expected.includes("@") 
    ? (val.toLowerCase() === expected.toLowerCase())
    : (val.toUpperCase() === "DELETE");

  if (isMatched) {
    btn.disabled = false;
    btn.style.opacity = "1";
    btn.style.cursor = "pointer";
    if (err) err.classList.add("hidden");
  } else {
    btn.disabled = true;
    btn.style.opacity = "0.5";
    btn.style.cursor = "not-allowed";
  }
};

function confirmDeleteProfile() {
  if (!selProfile) return;
  const cnt = cases.filter(c => c.profileId === selProfile.id).length;
  _pendingDeleteTarget = { type: "profile", id: selProfile.id, name: selProfile.name, caseCount: cnt };

  setElText("del-title", "Delete Attorney Profile?");
  const bodyEl = document.getElementById("del-body");
  if (bodyEl) {
    bodyEl.innerHTML = 
      `You are about to permanently remove <strong style="color:var(--text)">${selProfile.name}</strong> and all ${cnt} associated case(s).<br>This action <strong>cannot</strong> be undone.`;
  }

  const label = document.getElementById("del-confirm-target-text");
  if (label) {
    label.textContent = "DELETE";
    label.style.color = "var(--red)";
  }

  openDeleteModal();
}

function confirmDeleteCase() {
  if (!selCase) return;
  _pendingDeleteTarget = { 
    type: "case", 
    id: selCase.id, 
    title: selCase.title,
    calendarEventId: selCase.calendarEventId || null 
  };

  setElText("del-title", "Delete Case?");
  const bodyEl = document.getElementById("del-body");
  if (bodyEl) {
    bodyEl.innerHTML = 
      `You are about to permanently remove <strong style="color:var(--text)">${selCase.title}</strong>.<br>This action <strong>cannot</strong> be undone.`;
  }

  const label = document.getElementById("del-confirm-target-text");
  if (label) {
    label.textContent = "DELETE";
    label.style.color = "var(--red)";
  }

  openDeleteModal();
}

window.openDeleteModal = function() {
  const modal = document.getElementById("delete-modal");
  const input = document.getElementById("del-confirm-input");
  const btn = document.getElementById("del-confirm-btn");
  const err = document.getElementById("del-input-err");
  if (!modal) return;

  if (input) input.value = "";
  if (btn) {
    btn.disabled = true;
    btn.style.opacity = "0.5";
    btn.style.cursor = "not-allowed";
  }
  if (err) err.classList.add("hidden");

  if (input) {
    input.onkeydown = (e) => {
      if (e.key === "Enter" && btn && !btn.disabled) {
        if (typeof executeDelete === "function") executeDelete();
      }
    };
  }

  modal.classList.remove("hidden");
  if (input) setTimeout(() => input.focus(), 50);
};

window.closeDeleteModal = function() {
  const modal = document.getElementById("delete-modal");
  if (modal) modal.classList.add("hidden");
  _pendingDeleteTarget = null;
};

async function executeDelete() {
  const target = _pendingDeleteTarget;
  if (!target) return;

  if (typeof closeDeleteModal === "function") closeDeleteModal();

  try {
    if (target.type === "account_delete") {
      if (typeof executeDeleteAccountWipe === "function") {
        await executeDeleteAccountWipe();
      }
    } else if (target.type === "case") {
      if (target.calendarEventId && typeof deleteCalendarEvent === "function") {
        await deleteCalendarEvent(target.calendarEventId);
      }
      if (typeof dbDeleteCase === "function") await dbDeleteCase(target.id);
      cases = cases.filter(c => c.id !== target.id);
      selCase = null;
      showToast("Case deleted successfully", "error");
      
      if (typeof renderDashboard === "function") renderDashboard();
      if (typeof renderAllCases === "function") renderAllCases();
      if (typeof showView === "function") showView("allcases");
    } else if (target.type === "profile") {
      const toDelete = cases.filter(c => c.profileId === target.id);
      for (const c of toDelete) {
        if (c.calendarEventId && typeof deleteCalendarEvent === "function") {
          await deleteCalendarEvent(c.calendarEventId).catch(() => {});
        }
        if (typeof dbDeleteCase === "function") await dbDeleteCase(c.id);
      }
      cases = cases.filter(c => c.profileId !== target.id);

      if (typeof dbDeleteProfile === "function") await dbDeleteProfile(target.id);
      profiles = profiles.filter(p => p.id !== target.id);

      selProfile = null;
      selCase = null;
      showToast(`Profile and associated cases deleted`, "error");
      if (typeof navTo === "function") navTo("profiles");
    }

    if (currentView === "dashboard" && typeof renderDashboard === "function") renderDashboard();
  } catch (err) {
    console.error("executeDelete error:", err);
    showToast("Delete failed: " + (err.message || "Unknown error"), "error");
  }
}
window.executeDelete = executeDelete;

// ═══════════════════════════════════════════════════════════════
//  CASE SHARING SYSTEM
// ═══════════════════════════════════════════════════════════════
window.openShareCaseModal = function() {
  if (!selCase) return;
  const listEl = document.getElementById("share-modal-list");
  if (!listEl) return;

  const sharedUids = selCase.sharedWith || [];
  const currentUid = window._currentUser?.uid;

  const associates = profiles.filter(p => p.ownerUid && p.ownerUid !== currentUid);

  if (associates.length === 0) {
    listEl.innerHTML = `<div style="text-align:center;color:var(--text-dim);font-size:13px;padding:12px">No other associate attorneys are currently registered in the system.</div>`;
  } else {
    listEl.innerHTML = associates.map(p => {
      const isChecked = sharedUids.includes(p.ownerUid) ? "checked" : "";
      return `
        <label style="display:flex;align-items:center;gap:12px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px 14px;cursor:pointer;margin:0;text-transform:none;letter-spacing:normal">
          <input type="checkbox" name="share-associate-checkbox" value="${p.ownerUid}" ${isChecked} style="accent-color:var(--gold);width:16px;height:16px;margin:0"/>
          ${avatarDiv(p.name, p.avatarColor, 28, p.photoUrl)}
          <div style="flex:1">
            <div style="font-size:13px;font-weight:600;color:var(--text)">${p.name}</div>
            <div style="font-size:11px;color:var(--text-muted)">${p.email}</div>
          </div>
        </label>
      `;
    }).join("");
  }

  const modal = document.getElementById("share-modal");
  if (modal) modal.classList.remove("hidden");
};

window.closeShareModal = function() {
  const modal = document.getElementById("share-modal");
  if (modal) modal.classList.add("hidden");
};

async function saveShareSettings() {
  if (!selCase) return;
  const checkboxes = document.querySelectorAll('input[name="share-associate-checkbox"]');
  const selectedUids = [];
  checkboxes.forEach(cb => {
    if (cb.checked) selectedUids.push(cb.value);
  });

  const ownerUid = selCase.ownerUid || window._currentUser.uid;
  const allowedUids = Array.from(new Set([ownerUid, ...selectedUids]));

  try {
    showToast("Updating share settings...");
    if (typeof dbUpdateCase === "function") {
      await dbUpdateCase(selCase.id, {
        sharedWith: selectedUids,
        allowedUids: allowedUids
      });
    }
    selCase.sharedWith = selectedUids;
    selCase.allowedUids = allowedUids;
    
    if (typeof dbLogAuditAction === "function") {
      dbLogAuditAction("CASE_SHARED", { caseId: selCase.id, sharedWith: selectedUids });
    }

    if (typeof closeShareModal === "function") closeShareModal();
    showToast("Case shared successfully!");
  } catch (err) {
    console.error("saveShareSettings error:", err);
    showToast("Failed to share case: " + err.message, "error");
  }
}
window.saveShareSettings = saveShareSettings;

// ═══════════════════════════════════════════════════════════════
//  CASE FORM OPEN & EDIT
// ═══════════════════════════════════════════════════════════════
async function openAddCase() {
  caseFormOrigin = currentView === "dashboard" ? "dashboard" : "allcases";
  
  const u = window._currentUser || window._auth?.currentUser;
  if (!u) return;

  const myProf = profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase()));
  if (!myProf) {
    showToast("Your attorney profile is still loading. Please wait a moment.", "error");
    return;
  }

  if (typeof hasValidToken === "function" && !hasValidToken()) {
    openDriveWarningModal();
    return;
  }

  selProfile = myProf;
  caseFormMode = "add";
  pendingDocs = [];
  cfPetitioners = selProfile.name ? [selProfile.name] : [];
  cfRespondents = [];
  cfHearings = [];
  cfDeadlines = [];
  window.cfHearings = cfHearings;
  window.cfDeadlines = cfDeadlines;
  
  if (typeof populateCaseSelects === "function") populateCaseSelects(false);

  setElText("cf-title", "New Case");
  setElText("cf-save-btn", "Add Case");
  setElVal("cf-case-title", "");
  setElVal("cf-narrative", "");
  setElVal("cf-filed", "");
  setElVal("cf-due", "");
  setElVal("cf-case-number", "");
  setElVal("cf-doc-type", "");
  setElVal("cf-type-input", "");
  setElVal("cf-new-deadline-date", "");
  setElVal("cf-new-deadline-subtype", "");
  setElVal("cf-new-deadline-notes", "");
  setElVal("cf-status", "On-going");
  if (typeof setVenueValue === "function" && typeof VENUES !== "undefined") setVenueValue(VENUES[0]);
  setElText("drive-status", "");
  
  const backBtn = document.getElementById("cf-back-btn");
  if (backBtn) backBtn.onclick = () => window.handleCaseCancelOrExit();

  const cancelBtn = document.getElementById("cf-cancel-btn");
  if (cancelBtn) cancelBtn.onclick = () => window.handleCaseCancelOrExit();
  
  const firstCat = CASE_CATEGORIES[0];
  setElVal("cf-category", firstCat);
  if (typeof onCategoryChange === "function") await onCategoryChange(firstCat);
  
  renderPartyLists();
  serializeParties();
  renderPendingDocs();
  renderCaseHearings();
  renderCaseDeadlines();
  clearCaseErrors();
  updateCfChip();
  if (typeof updateDriveFolderChip === "function") updateDriveFolderChip();
  showView("caseForm");
}

async function openEditCase() {
  const c = selCase;
  if (!c) return;

  if (typeof hasValidToken === "function" && !hasValidToken()) {
    openDriveWarningModal();
    return;
  }

  caseFormMode = "edit";
  pendingDocs = [...(c.documents || [])];
  parsePartiesString(c.parties);
  
  cfHearings = Array.isArray(c.hearings) ? [...c.hearings] : [];
  if (cfHearings.length === 0 && c.dueDate) {
    cfHearings.push({
      id: "h_legacy",
      date: c.dueDate,
      time: "08:30",
      purpose: "Hearing Appearance",
      notes: "Migrated schedule date"
    });
  }
  window.cfHearings = cfHearings;

  cfDeadlines = Array.isArray(c.deadlines) ? [...c.deadlines] : [];
  if (cfDeadlines.length === 0 && c.docDueDate) {
    cfDeadlines.push({
      id: "d_legacy",
      date: c.docDueDate,
      flow: "Outbound Motion",
      subtype: c.docType || "Formal Pleading",
      notes: "Migrated filing deadline"
    });
  }
  window.cfDeadlines = cfDeadlines;
  
  if (typeof populateCaseSelects === "function") populateCaseSelects(true);

  setElText("cf-title", "Edit Case");
  setElText("cf-save-btn", "Save Changes");
  setElVal("cf-case-title", c.title);
  setElVal("cf-narrative", c.narrative);
  setElVal("cf-filed", c.filedDate || "");
  setElVal("cf-due", c.docDueDate || c.dueDate || "");
  setElVal("cf-case-number", c.caseNumber || "");
  setElVal("cf-doc-type", c.docType || "");
  setElVal("cf-new-deadline-date", "");
  setElVal("cf-new-deadline-subtype", "");
  setElVal("cf-new-deadline-notes", "");
  if (typeof setVenueValue === "function") setVenueValue(c.venue);
  
  const cat = c.category || CASE_CATEGORIES[0];
  setElVal("cf-category", cat);
  if (typeof onCategoryChange === "function") await onCategoryChange(cat);
  setElVal("cf-type-input", c.type || "");
  
  setElText("drive-status", pendingDocs.length ? `${pendingDocs.length} file(s)` : "");

  const backBtn = document.getElementById("cf-back-btn");
  if (backBtn) backBtn.onclick = () => window.handleCaseCancelOrExit();

  const cancelBtn = document.getElementById("cf-cancel-btn");
  if (cancelBtn) cancelBtn.onclick = () => window.handleCaseCancelOrExit();

  renderPartyLists();
  serializeParties();
  renderPendingDocs();
  renderCaseHearings();
  renderCaseDeadlines();
  clearCaseErrors();
  updateCfChip();
  if (typeof updateDriveFolderChip === "function") updateDriveFolderChip();
  showView("caseForm");
}

window.openAddCase = openAddCase;
window.openEditCase = openEditCase;

// ═══════════════════════════════════════════════════════════════
//  CASE FORM HELPERS (PARTIES, VENUE, DOCS)
// ═══════════════════════════════════════════════════════════════
let cfPetitioners = [];
let cfRespondents = [];

function addParty(role) {
  const inputId = role === "petitioner" ? "cf-petitioner-input" : "cf-respondent-input";
  const input = document.getElementById(inputId);
  if (!input) return;
  const name = input.value.trim();
  if (!name) { input.focus(); return; }
  if (role === "petitioner") { cfPetitioners.push(name); }
  else                       { cfRespondents.push(name); }
  input.value = "";
  input.focus();
  renderPartyLists();
  serializeParties();
}

function removeParty(role, idx) {
  if (role === "petitioner") cfPetitioners.splice(idx, 1);
  else                       cfRespondents.splice(idx, 1);
  renderPartyLists();
  serializeParties();
}

function renderPartyLists() {
  const chipStyle = (color, bg) =>
    `display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:20px;font-size:12px;font-weight:500;background:${bg};border:1px solid ${color};color:${color};margin-bottom:6px;margin-right:4px`;
  const removeBtn = (role, i) =>
    `<button type="button" onclick="removeParty('${role}',${i})" style="background:none;border:none;cursor:pointer;padding:0;line-height:1;font-size:14px;opacity:0.6;color:inherit" title="Remove">×</button>`;

  const petEl = document.getElementById("cf-petitioners-list");
  if (petEl) {
    petEl.innerHTML =
      cfPetitioners.length === 0
        ? `<div style="font-size:12px;color:var(--text-dim);font-style:italic;padding:2px 0">None added yet</div>`
        : cfPetitioners.map((n,i) => `<span style="${chipStyle("var(--gold)","rgba(201,165,92,0.1)")}">${n} ${removeBtn("petitioner",i)}</span>`).join("");
  }

  const resEl = document.getElementById("cf-respondents-list");
  if (resEl) {
    resEl.innerHTML =
      cfRespondents.length === 0
        ? `<div style="font-size:12px;color:var(--text-dim);font-style:italic;padding:2px 0">None added yet</div>`
        : cfRespondents.map((n,i) => `<span style="${chipStyle("var(--violet)","rgba(129,140,248,0.1)")}">${n} ${removeBtn("respondent",i)}</span>`).join("");
  }
}

function serializeParties() {
  const parts = [];
  if (cfPetitioners.length) parts.push("Petitioner: " + cfPetitioners.join(", "));
  if (cfRespondents.length) parts.push("Respondent: " + cfRespondents.join(", "));
  setElVal("cf-parties", parts.join(" | "));
}

function parsePartiesString(str) {
  cfPetitioners = [];
  cfRespondents = [];
  if (!str) return;
  str.split("|").forEach(seg => {
    seg = seg.trim();
    if (seg.toLowerCase().startsWith("petitioner:")) {
      cfPetitioners = seg.slice(11).split(",").map(s=>s.trim()).filter(Boolean);
    } else if (seg.toLowerCase().startsWith("respondent:")) {
      cfRespondents = seg.slice(11).split(",").map(s=>s.trim()).filter(Boolean);
    } else if (seg) {
      cfRespondents = [seg];
    }
  });
}

function onVenueChange(sel) {
  const manual = document.getElementById("cf-venue-manual");
  if (!manual) return;
  if (sel.value === "Other (specify)") {
    manual.style.display = "block";
    manual.required = true;
    manual.focus();
  } else {
    manual.style.display = "none";
    manual.required = false;
    manual.value = "";
  }
}

function getVenueValue() {
  const sel = document.getElementById("cf-venue");
  if (!sel) return "Other";
  if (sel.value === "Other (specify)") {
    const manual = document.getElementById("cf-venue-manual");
    return (manual?.value || "").trim() || "Other";
  }
  return sel.value;
}

function setVenueValue(val) {
  const sel = document.getElementById("cf-venue");
  const manual = document.getElementById("cf-venue-manual");
  if (!sel) return;
  if (typeof VENUES !== "undefined") {
    const match = VENUES.find(v => v === val);
    if (match) {
      sel.value = match;
      if (manual) manual.style.display = "none";
    } else if (val) {
      sel.value = "Other (specify)";
      if (manual) {
        manual.style.display = "block";
        manual.value = val;
      }
    }
  }
}

let _caseTypeSuggestions = [];

async function loadCaseTypesForCategory(category) {
  _caseTypeSuggestions = [];
  if (!window._db || !category) return;
  try {
    const snap = await window._fbGetDocs(window._fbQuery(
      window._fbCol(window._db, "caseTypes"),
      window._fbWhere("category", "==", category)
    ));
    _caseTypeSuggestions = snap.docs.map(d => d.data().name).filter(Boolean);
  } catch(e) { console.warn("loadCaseTypes error:", e); }
}

async function saveCaseTypeIfNew(category, typeName) {
  if (!typeName || !category || !window._db) return;
  const name = typeName.trim();
  if (!name || _caseTypeSuggestions.includes(name)) return;
  try {
    await window._fbAddDoc(window._fbCol(window._db, "caseTypes"), { category, name, createdAt: new Date().toISOString() });
    _caseTypeSuggestions.push(name);
  } catch(e) { console.warn("saveCaseType error:", e); }
}

function filterCaseTypeSuggestions(val) {
  const dd = document.getElementById("cf-type-dropdown");
  if (!dd) return;
  const q = val.trim().toLowerCase();
  const filtered = q ? _caseTypeSuggestions.filter(s => s.toLowerCase().includes(q)) : _caseTypeSuggestions;
  if (!filtered.length) { dd.style.display = "none"; return; }
  dd.innerHTML = filtered.map(s =>
    `<div onclick="selectCaseType('${s.replace(/'/g,"\'")}')" style="padding:9px 14px;cursor:pointer;font-size:13px;color:var(--text);transition:background 0.1s" onmouseover="this.style.background='rgba(201,165,92,0.08)'" onmouseout="this.style.background=''">${s}</div>`
  ).join("");
  dd.style.display = "block";
}

function showCaseTypeSuggestions() {
  const inp = document.getElementById("cf-type-input");
  filterCaseTypeSuggestions(inp?.value || "");
}

function hideCaseTypeSuggestions() {
  const dd = document.getElementById("cf-type-dropdown");
  if (dd) dd.style.display = "none";
}

function selectCaseType(name) {
  setElVal("cf-type-input", name);
  hideCaseTypeSuggestions();
}

function onCaseTypeKeydown(e) {
  if (e.key === "Escape") hideCaseTypeSuggestions();
}

async function onCategoryChange(category) {
  if (typeof CATEGORY_PARTY_LABELS !== "undefined") {
    const labels = CATEGORY_PARTY_LABELS[category] || ["Petitioner", "Respondent"];
    const aLabel = document.getElementById("cf-party-a-label");
    const bLabel = document.getElementById("cf-party-b-label");
    if (aLabel) aLabel.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;background:var(--gold);display:inline-block;flex-shrink:0"></span> ${labels[0]}`;
    if (bLabel) bLabel.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;background:var(--violet);display:inline-block;flex-shrink:0"></span> ${labels[1]}`;
  }
  await loadCaseTypesForCategory(category);
  setElVal("cf-type-input", "");
  hideCaseTypeSuggestions();
}

function updateCfChip() {
  const chip = document.getElementById("cf-profile-chip");
  if (!chip) return;
  if (selProfile) {
    const av = typeof avatarDiv === "function" ? avatarDiv(selProfile.name, selProfile.avatarColor, 24, selProfile.photoUrl) : "";
    chip.innerHTML = `${av}<span style="font-size:13px;color:var(--text-muted)">${selProfile.name}</span>`;
    chip.style.display = "flex";
  } else {
    chip.style.display = "none";
  }
}

window.addParty = addParty;
window.removeParty = removeParty;
window.onVenueChange = onVenueChange;
window.filterCaseTypeSuggestions = filterCaseTypeSuggestions;
window.showCaseTypeSuggestions = showCaseTypeSuggestions;
window.selectCaseType = selectCaseType;
window.onCaseTypeKeydown = onCaseTypeKeydown;
window.onCategoryChange = onCategoryChange;

// ═══════════════════════════════════════════════════════════════
//  RESTRICT CONTACT & MOBILE NUMBER INPUTS TO DIGITS ONLY
// ═══════════════════════════════════════════════════════════════
function initNumericInputConstraints() {
  const contactInputs = document.querySelectorAll('input[id*="contact"], input[id*="phone"], input[id*="mobile"]');
  contactInputs.forEach(input => {
    if (input._numericBound) return;
    input.setAttribute("inputmode", "numeric");
    input.setAttribute("pattern", "[0-9]*");
    
    input.addEventListener("input", (e) => {
      const sanitized = e.target.value.replace(/\D/g, "");
      if (e.target.value !== sanitized) {
        e.target.value = sanitized;
      }
    });

    input.addEventListener("keypress", (e) => {
      if (e.key && !/^\d$/.test(e.key) && !["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"].includes(e.key)) {
        e.preventDefault();
      }
    });

    input._numericBound = true;
  });
}

// ═══════════════════════════════════════════════════════════════
//  BOOT LOGIC WITH 2FA UNVERIFIED EVICTION GUARD
// ═══════════════════════════════════════════════════════════════
function enterLocalMode(reason) {
  localMode = true;
  const banner = document.getElementById("config-banner");
  if (banner) {
    banner.textContent = "⚠️ " + (reason || "Firebase not connected. Data is stored in memory only and will be lost on refresh.");
    banner.classList.add("show");
  }
  if (typeof showToast === "function") showToast("Running in local mode — data will not persist", "error");
}

function initAppUI() {
  const loader = document.getElementById("loading-screen");
  if (loader) loader.style.display = "none";
  if (typeof initTheme === "function") initTheme();
  if (typeof bindProfileInputs === "function") bindProfileInputs();
  if (typeof initPasswordStrengthChecker === "function") initPasswordStrengthChecker();
  if (typeof initNumericInputConstraints === "function") initNumericInputConstraints();
  showView("dashboard");
  if (typeof renderDashboard === "function") renderDashboard();
}

async function connectDatabase() {
  if (typeof window._fbReady !== "undefined" && window._fbReady && window._db) {
    localMode = false;
    const banner = document.getElementById("config-banner");
    if (banner) banner.classList.remove("show");

    const u = window._currentUser || window._auth?.currentUser;
    if (u) {
      try {
        if (typeof dbLoad === "function") await dbLoad();
      } catch (err) {
        console.error("Database load failed:", err);
        enterLocalMode("Database connection failed.");
      }
    }
  } else {
    enterLocalMode("Firebase initialization failed.");
  }
}

let uiBooted = false;
let dbConnected = false;

document.addEventListener("firebase-ready", () => {
  if (!uiBooted) {
    uiBooted = true;
    initAppUI();
  }

  if (window._auth && typeof window._fbOnAuth === "function") {
    window._fbOnAuth(window._auth, async (user) => {
      window._currentUser = user;
      if (user) {
        try {
          if (typeof fetchUserProfile === "function") {
            const { data: profData } = await fetchUserProfile(user);
            if (profData.twoFactorEnabled) {
              const isVerified = sessionStorage.getItem("simando_2fa_verified") === "true";
              if (!isVerified) {
                console.warn("Unverified 2FA session detected. Evicting session.");
                if (typeof window._fbSignOut === "function") await window._fbSignOut(window._auth);
                window.location.replace("login.html");
                return;
              }
            }
          }
        } catch (e) { /* ignore */ }

        if (!dbConnected) {
          dbConnected = true;
          connectDatabase();
        }
      } else {
        const isLoginPage = window.location.pathname.toLowerCase().endsWith("login.html") || window.location.pathname.toLowerCase().endsWith("login");
        if (!isLoginPage) {
          sessionStorage.removeItem("simando_2fa_verified");
          window.location.replace("login.html");
        }
      }
    });
  }
});

if (window._fbReady) {
  if (!uiBooted) {
    uiBooted = true;
    initAppUI();
  }
  if (!dbConnected && window._currentUser) {
    dbConnected = true;
    connectDatabase();
  }
}

setTimeout(() => {
  if (!uiBooted) {
    uiBooted = true;
    initAppUI();
  }
}, 2000);

setTimeout(() => {
  if (!dbConnected && window._currentUser) {
    dbConnected = true;
    connectDatabase();
  }
}, 8000);

// ═══════════════════════════════════════════════════════════════
//  SAVE CASE: FORM RESET & DIRECT ALL-CASES NAVIGATION
// ═══════════════════════════════════════════════════════════════
async function saveCase() {
  const petInp = document.getElementById("cf-petitioner-input");
  const resInp = document.getElementById("cf-respondent-input");

  if (petInp && petInp.value.trim()) {
    cfPetitioners.push(petInp.value.trim());
    petInp.value = "";
  }
  if (resInp && resInp.value.trim()) {
    cfRespondents.push(resInp.value.trim());
    resInp.value = "";
  }

  renderPartyLists();
  serializeParties();

  const title = (document.getElementById("cf-case-title")?.value || "").trim();
  const filed = document.getElementById("cf-filed")?.value || "";
  const parties = (document.getElementById("cf-parties")?.value || "").trim();
  const narrative = (document.getElementById("cf-narrative")?.value || "").trim();
  
  let valid = true;
  if (!title) {
    const err = document.getElementById("cf-title-err");
    const inp = document.getElementById("cf-case-title");
    if (err) err.classList.remove("hidden");
    if (inp) inp.classList.add("err");
    valid = false;
  }
  if (!filed) {
    const err = document.getElementById("cf-filed-err");
    const inp = document.getElementById("cf-filed");
    if (err) err.classList.remove("hidden");
    if (inp) inp.classList.add("err");
    valid = false;
  }
  if (cfPetitioners.length === 0 || cfRespondents.length === 0) {
    const err = document.getElementById("cf-parties-err");
    if (err) err.classList.remove("hidden");
    valid = false;
  }
  if (!narrative) {
    const err = document.getElementById("cf-narrative-err");
    const inp = document.getElementById("cf-narrative");
    if (err) err.classList.remove("hidden");
    if (inp) inp.classList.add("err");
    valid = false;
  }
  if (!valid) return;

  const saveBtn = document.getElementById("cf-save-btn");
  if (saveBtn) {
    if (saveBtn.disabled) return;
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
  }

  // Flag that we are intentionally saving so navigation isn't blocked by unsaved changes guard
  window._isSubmittingCase = true;

  const category = document.getElementById("cf-category")?.value || CASE_CATEGORIES[0];
  const caseType = (document.getElementById("cf-type-input")?.value || "").trim();
  if (caseType) await saveCaseTypeIfNew(category, caseType);

  const u = window._currentUser || window._auth?.currentUser;
  const myProf = profiles.find(p => p.ownerUid === u?.uid || (p.email && p.email.toLowerCase() === u?.email?.toLowerCase())) || selProfile;

  const sortedHearings = [...cfHearings].sort((a, b) => new Date(a.date) - new Date(b.date));
  const sortedDeadlines = [...cfDeadlines].sort((a, b) => new Date(a.date) - new Date(b.date));

  const todayStr = new Date().toISOString().split("T")[0];
  const nextHearing = sortedHearings.find(h => h.date >= todayStr) || sortedHearings[sortedHearings.length - 1];
  const nextDeadline = sortedDeadlines.find(d => d.date >= todayStr) || sortedDeadlines[sortedDeadlines.length - 1];

  const data = {
    title,
    filedDate: filed,
    dueDate: nextHearing ? nextHearing.date : null,
    docDueDate: nextDeadline ? nextDeadline.date : null,
    hearings: sortedHearings,
    deadlines: sortedDeadlines,
    parties,
    narrative,
    category,
    type: caseType,
    caseNumber: (document.getElementById("cf-case-number")?.value || "").trim(),
    docType: nextDeadline ? (nextDeadline.subtype || nextDeadline.title) : "",
    status: document.getElementById("cf-status")?.value || STATUS_OPTIONS[0],
    venue: getVenueValue(),
    documents: typeof pendingDocs !== "undefined" ? pendingDocs : [],
  };

  try {
    const caseCategory = data.category || "Other";
    const cType = data.type || "Other";
    const caseTitle = data.title || "Untitled";
    const profileFolderId = myProf?.driveFolderId || selProfile?.driveFolderId || null;
    const hadLocalFiles = data.documents.some(d => d._localTempId);

    if (typeof syncPendingFilesToDrive === "function") {
      const syncedDocs = await syncPendingFilesToDrive(caseCategory, cType, caseTitle, profileFolderId);
      data.documents = syncedDocs.map(d => {
        const clean = { ...d };
        delete clean._localTempId;
        return clean;
      });
      const stillLocal = data.documents.some(d => !d.driveFileId && d.name);
      if (hadLocalFiles && stillLocal) {
        showToast("Case saved locally — Drive session expired.", "error");
      }
    }

    if (typeof hasValidToken === "function" && hasValidToken() && typeof createOrUpdateCalendarEvent === "function") {
      showToast("Syncing hearing with Google Calendar...");
      if (caseFormMode === "edit" && selCase?.calendarEventId) {
        data.calendarEventId = selCase.calendarEventId;
      }
      const eventId = await createOrUpdateCalendarEvent(data);
      if (eventId) {
        data.calendarEventId = eventId;
      }
    }

    let savedCaseId = null;

    if (caseFormMode === "add") {
      data.profileId = myProf?.id || (selProfile?.id || "unassigned");
      data.createdAt = new Date().toISOString().slice(0, 10);
      data.ownerUid = u?.uid || "unknown";
      data.sharedWith = [];
      data.allowedUids = [u?.uid || "unknown"];
      
      let newCaseObj = null;
      if (typeof dbAddCase === "function") {
        newCaseObj = await dbAddCase(data);
      }
      
      if (newCaseObj && typeof cases !== "undefined" && !cases.some(c => c.id === newCaseObj.id)) {
        cases.unshift(newCaseObj);
        savedCaseId = newCaseObj.id;
      } else if (typeof cases !== "undefined" && !cases.some(c => c.title === data.title && c.filedDate === data.filedDate)) {
        cases.unshift(data);
        savedCaseId = data.id;
      }

      showToast("Case created successfully!");
    } else {
      if (selCase) {
        data.ownerUid = selCase.ownerUid || u?.uid;
        data.sharedWith = selCase.sharedWith || [];
        data.allowedUids = Array.from(new Set([data.ownerUid, ...(selCase.sharedWith || [])]));
      }
      if (typeof dbUpdateCase === "function") await dbUpdateCase(selCase.id, data);
      
      if (typeof cases !== "undefined") {
        const idx = cases.findIndex(c => c.id === selCase.id);
        if (idx >= 0) cases[idx] = { ...cases[idx], ...data };
      }
      selCase = { ...selCase, ...data };
      savedCaseId = selCase.id;

      showToast("Case details updated!");
    }

    // Clear form inputs and temp state completely before navigating
    setElVal("cf-case-title", "");
    setElVal("cf-narrative", "");
    setElVal("cf-filed", "");
    setElVal("cf-due", "");
    setElVal("cf-case-number", "");
    setElVal("cf-doc-type", "");
    setElVal("cf-type-input", "");
    setElVal("cf-new-deadline-date", "");
    setElVal("cf-new-deadline-subtype", "");
    setElVal("cf-new-deadline-notes", "");
    pendingDocs = [];
    cfHearings = [];
    cfDeadlines = [];
    cfPetitioners = [];
    cfRespondents = [];
    window.cfHearings = cfHearings;
    window.cfDeadlines = cfDeadlines;

    // Turn off submission flag so future forms work normally
    window._isSubmittingCase = false;

    // Refresh directory views
    if (typeof renderDashboard === "function") renderDashboard();
    if (typeof renderAllCases === "function") renderAllCases();
    if (caseFormOrigin === "profileDetail" && selProfile && typeof renderProfileDetail === "function") {
      renderProfileDetail();
    }

    // Direct clean navigation to All Cases on add, or Case Detail on edit
    if (caseFormMode === "add") {
      executeNavigation("allcases");
    } else {
      executeNavigation("caseDetail");
      if (typeof renderCaseDetail === "function") renderCaseDetail();
    }

  } catch (err) {
    console.error("saveCase error:", err);
    window._isSubmittingCase = false;
    showToast("Failed to save case: " + (err.message || "Unknown error"), "error");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = caseFormMode === "add" ? "Add Case" : "Save Changes";
    }
  }
}
window.saveCase = saveCase;
