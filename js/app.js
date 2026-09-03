// ═══════════════════════════════════════════════════════════════
//  GLOBAL SIDEBAR TOGGLE & RETRACTION STATE
// ═══════════════════════════════════════════════════════════════
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
//  DELETE CONFIRMATION & MODAL CONTROLLERS
// ═══════════════════════════════════════════════════════════════
let _pendingDeleteTarget = null;
let caseFormOrigin = "profileDetail";

function setElText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setElVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

window.openDriveWarningModal = function() {
  const modal = document.getElementById("drive-warning-modal");
  if (modal) modal.classList.remove("hidden");
};

window.closeDriveWarningModal = function() {
  const modal = document.getElementById("drive-warning-modal");
  if (modal) modal.classList.add("hidden");
};

// ═══════════════════════════════════════════════════════════════
//  TWO-FACTOR AUTHENTICATION (TOTP / GOOGLE & MICROSOFT AUTH)
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
    backupListEl.innerHTML = generatedBackupCodes.map(code => `<div style="font-family:monospace;font-weight:700;padding:4px 8px;background:var(--surface2);border-radius:6px;border:1px solid var(--border)">${code}</div>`).join("");
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
    await dbUpdateProfile(myProf.id, {
      twoFactorEnabled: true,
      twoFactorSecret: generated2FASecret,
      twoFactorBackupCodes: generatedBackupCodes
    });

    myProf.twoFactorEnabled = true;
    myProf.twoFactorSecret = generated2FASecret;
    myProf.twoFactorBackupCodes = generatedBackupCodes;

    sessionStorage.setItem("simando_2fa_verified", "true");

    showToast("Two-Factor Authentication is now active! 🛡️");
    closeTwoFactorSetupModal();
    renderMyProfile();
  } catch (err) {
    console.error("2FA activation error:", err);
    showToast("Failed to activate 2FA: " + err.message, "error");
  }
};

window.disableTwoFactor = async function() {
  if (!confirm("Are you sure you want to disable Two-Factor Authentication?\nYour account will rely only on your password.")) return;

  const u = window._currentUser || window._auth?.currentUser;
  if (!u) return;
  const myProf = profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase()));
  if (!myProf) return;

  try {
    showToast("Disabling 2FA...");
    await dbUpdateProfile(myProf.id, {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: []
    });

    myProf.twoFactorEnabled = false;
    myProf.twoFactorSecret = null;
    myProf.twoFactorBackupCodes = [];

    sessionStorage.removeItem("simando_2fa_verified");

    showToast("Two-Factor Authentication disabled.");
    renderMyProfile();
  } catch (err) {
    console.error("2FA disable error:", err);
    showToast("Failed to disable 2FA: " + err.message, "error");
  }
};

// ═══════════════════════════════════════════════════════════════
//  CLICK-TO-TOGGLE SET AVAILABILITY MODAL CONTROLLERS
// ═══════════════════════════════════════════════════════════════
let selectedBusyDatesSet = new Set();
let modalCalYear = new Date().getFullYear();
let modalCalMonth = new Date().getMonth();

window.openBusyModal = function() {
  const modal = document.getElementById("busy-modal");
  if (!modal) return;

  selectedBusyDatesSet.clear();
  modalCalYear = new Date().getFullYear();
  modalCalMonth = new Date().getMonth();

  const u = window._currentUser || window._auth?.currentUser;
  if (u && Array.isArray(appointments)) {
    appointments.forEach(a => {
      if (a.type === "busy" && (a.targetUid === u.uid || a.requesterUid === u.uid || a.ownerUid === u.uid) && a.date) {
        selectedBusyDatesSet.add(a.date);
      }
    });
  }

  setElVal("busy-title", "In Court / Out of Office");
  setElVal("busy-notes", "");

  const allDayCb = document.getElementById("busy-all-day");
  if (allDayCb) {
    allDayCb.checked = true;
    toggleBusyTimeInputs(true);
  }

  renderModalCalendarGrid();
  modal.classList.remove("hidden");
};

window.closeBusyModal = function() {
  const modal = document.getElementById("busy-modal");
  if (modal) modal.classList.add("hidden");
};

window.resetBusySelection = function() {
  selectedBusyDatesSet.clear();
  renderModalCalendarGrid();
  showToast("Selection reset.");
};

window.prevModalCalMonth = function() {
  modalCalMonth--;
  if (modalCalMonth < 0) {
    modalCalMonth = 11;
    modalCalYear--;
  }
  renderModalCalendarGrid();
};

window.nextModalCalMonth = function() {
  modalCalMonth++;
  if (modalCalMonth > 11) {
    modalCalMonth = 0;
    modalCalYear++;
  }
  renderModalCalendarGrid();
};

window.todayModalCalMonth = function() {
  const now = new Date();
  modalCalYear = now.getFullYear();
  modalCalMonth = now.getMonth();
  renderModalCalendarGrid();
};

window.toggleModalBusyDate = function(dateStr) {
  if (selectedBusyDatesSet.has(dateStr)) {
    selectedBusyDatesSet.delete(dateStr);
  } else {
    selectedBusyDatesSet.add(dateStr);
  }
  renderModalCalendarGrid();
};

window.renderModalCalendarGrid = function() {
  const titleEl = document.getElementById("modal-cal-month-title");
  const gridEl = document.getElementById("modal-calendar-grid");
  const countLabel = document.getElementById("modal-busy-count-label");
  const submitBtn = document.getElementById("busy-submit-btn");

  if (!gridEl) return;

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  if (titleEl) {
    titleEl.textContent = `${monthNames[modalCalMonth]} ${modalCalYear}`;
  }

  const selectedCount = selectedBusyDatesSet.size;
  if (countLabel) {
    countLabel.textContent = `${selectedCount} busy date${selectedCount !== 1 ? 's' : ''} selected`;
  }
  if (submitBtn) {
    submitBtn.textContent = `Save Availability (${selectedCount})`;
  }

  const firstDayObj = new Date(modalCalYear, modalCalMonth, 1);
  const startingDayOfWeek = firstDayObj.getDay();
  const daysInMonth = new Date(modalCalYear, modalCalMonth + 1, 0).getDate();
  const prevMonthDays = new Date(modalCalYear, modalCalMonth, 0).getDate();

  const todayObj = new Date();
  const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

  let html = `
    <div class="cal-day-header" style="font-size:9.5px;padding:4px 0">Sun</div>
    <div class="cal-day-header" style="font-size:9.5px;padding:4px 0">Mon</div>
    <div class="cal-day-header" style="font-size:9.5px;padding:4px 0">Tue</div>
    <div class="cal-day-header" style="font-size:9.5px;padding:4px 0">Wed</div>
    <div class="cal-day-header" style="font-size:9.5px;padding:4px 0">Thu</div>
    <div class="cal-day-header" style="font-size:9.5px;padding:4px 0">Fri</div>
    <div class="cal-day-header" style="font-size:9.5px;padding:4px 0">Sat</div>
  `;

  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthDays - i;
    html += `<div class="cal-day-cell other-month" style="min-height:38px;padding:4px"><span class="cal-day-num" style="font-size:11px">${dayNum}</span></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const mStr = String(modalCalMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const fullDateStr = `${modalCalYear}-${mStr}-${dStr}`;

    const isToday = fullDateStr === todayStr;
    const isSelected = selectedBusyDatesSet.has(fullDateStr);

    html += `
      <div class="cal-day-cell ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}" 
           style="min-height:38px;padding:4px;cursor:pointer;align-items:center;justify-content:center;${isSelected ? 'background:rgba(239, 68, 68, 0.22) !important;border-color:var(--red) !important;' : ''}" 
           onclick="toggleModalBusyDate('${fullDateStr}')">
        <span class="cal-day-num" style="font-size:12px;${isSelected ? 'color:var(--red);font-weight:800' : ''}">
          ${day} ${isSelected ? '🚫' : ''}
        </span>
      </div>
    `;
  }

  const totalCells = startingDayOfWeek + daysInMonth;
  const remainingCells = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remainingCells; i++) {
    html += `<div class="cal-day-cell other-month" style="min-height:38px;padding:4px"><span class="cal-day-num" style="font-size:11px">${i}</span></div>`;
  }

  gridEl.innerHTML = html;
};

window.toggleBusyTimeInputs = function(isAllDay) {
  const container = document.getElementById("busy-time-container");
  if (container) {
    container.style.display = isAllDay ? "none" : "grid";
  }
};

window.submitBusyDates = async function() {
  const title = (document.getElementById("busy-title")?.value || "").trim();
  const isAllDay = document.getElementById("busy-all-day")?.checked || false;
  const startTime = document.getElementById("busy-start-time")?.value || "08:00";
  const endTime = document.getElementById("busy-end-time")?.value || "17:00";
  const notes = (document.getElementById("busy-notes")?.value || "").trim();

  if (!title) {
    showToast("Please enter a title or reason.", "error");
    return;
  }

  const u = window._currentUser || window._auth?.currentUser;
  if (!u) {
    showToast("Please sign in first.", "error");
    return;
  }
  const myProf = profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase())) || { name: u.displayName || u.email || "Attorney" };

  try {
    showToast("Saving your availability...");

    const timeLabel = isAllDay ? "All Day" : `${startTime} - ${endTime}`;
    
    const myExistingBusyAppts = appointments.filter(a => 
      a.type === "busy" && (a.targetUid === u.uid || a.requesterUid === u.uid || a.ownerUid === u.uid)
    );

    for (const oldAppt of myExistingBusyAppts) {
      if (!selectedBusyDatesSet.has(oldAppt.date)) {
        if (oldAppt.id && !oldAppt.id.startsWith("local_") && typeof dbDeleteAppointment === "function") {
          await dbDeleteAppointment(oldAppt.id).catch(err => console.warn("Delete appt error:", err));
        }
        appointments = appointments.filter(a => a.id !== oldAppt.id);
      }
    }

    for (const dateStr of selectedBusyDatesSet) {
      const alreadyExists = appointments.some(a => 
        a.type === "busy" && (a.targetUid === u.uid || a.requesterUid === u.uid || a.ownerUid === u.uid) && a.date === dateStr
      );

      if (!alreadyExists) {
        const apptData = {
          title: "🚫 " + title,
          date: dateStr,
          time: timeLabel,
          description: notes || "Unavailable / Busy",
          requesterUid: u.uid,
          requesterName: myProf.name,
          targetUid: u.uid,
          targetName: myProf.name,
          ownerUid: u.uid,
          status: "accepted",
          type: "busy"
        };

        let apptId = null;
        try {
          if (typeof dbAddAppointment === "function") {
            apptId = await dbAddAppointment(apptData);
          }
        } catch (dbErr) {
          console.warn("Firestore write permission warning:", dbErr.message);
        }

        if (apptId) apptData.id = apptId;
        else apptData.id = "local_busy_" + Date.now() + "_" + Math.random().toString(36).slice(2);

        appointments.push(apptData);
      }
    }

    showToast("Availability settings saved!");
    closeBusyModal();

    if (typeof renderMonthlyCalendarGrid === "function") {
      renderMonthlyCalendarGrid();
    }
  } catch (err) {
    console.error("submitBusyDates error:", err);
    showToast("Failed to save availability: " + err.message, "error");
  }
};

window.deleteBusySlot = async function(apptId, dateStr = null) {
  if (!apptId) return;

  const u = window._currentUser || window._auth?.currentUser;
  const slot = appointments.find(a => a.id === apptId);
  if (slot && u) {
    const isOwner = slot.ownerUid === u.uid || slot.targetUid === u.uid || slot.requesterUid === u.uid;
    if (!isOwner) {
      showToast("You can only modify your own availability.", "error");
      return;
    }
  }

  try {
    showToast("Removing availability entry...");
    if (!apptId.startsWith("local_") && typeof dbDeleteAppointment === "function") {
      await dbDeleteAppointment(apptId).catch(err => console.warn("Delete appt error:", err));
    }
    appointments = appointments.filter(a => a.id !== apptId);
    showToast("Availability removed!");

    if (dateStr && typeof openDateScheduleModal === "function") {
      openDateScheduleModal(dateStr);
    }
    if (typeof renderMonthlyCalendarGrid === "function") {
      renderMonthlyCalendarGrid();
    }
  } catch (err) {
    console.error("deleteBusySlot error:", err);
    showToast("Failed to remove: " + err.message, "error");
  }
};

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

function openDeleteModal() {
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
        executeDelete();
      }
    };
  }

  modal.classList.remove("hidden");
  if (input) setTimeout(() => input.focus(), 50);
}

function closeDeleteModal() {
  const modal = document.getElementById("delete-modal");
  if (modal) modal.classList.add("hidden");
  _pendingDeleteTarget = null;
}

async function executeDelete() {
  const target = _pendingDeleteTarget;
  if (!target) return;

  closeDeleteModal();

  try {
    if (target.type === "account_delete") {
      await executeDeleteAccountWipe();
    } else if (target.type === "case") {
      if (target.calendarEventId && typeof deleteCalendarEvent === "function") {
        await deleteCalendarEvent(target.calendarEventId);
      }
      await dbDeleteCase(target.id);
      cases = cases.filter(c => c.id !== target.id);
      selCase = null;
      showToast("Case deleted successfully", "error");
      
      renderDashboard();
      renderAllCases();
      showView("profileDetail");
      renderProfileDetail();
    } else if (target.type === "profile") {
      const toDelete = cases.filter(c => c.profileId === target.id);
      for (const c of toDelete) {
        if (c.calendarEventId && typeof deleteCalendarEvent === "function") {
          await deleteCalendarEvent(c.calendarEventId).catch(() => {});
        }
        await dbDeleteCase(c.id);
      }
      cases = cases.filter(c => c.profileId !== target.id);

      await dbDeleteProfile(target.id);
      profiles = profiles.filter(p => p.id !== target.id);

      selProfile = null;
      selCase = null;
      showToast(`Profile and associated cases deleted`, "error");
      navTo("profiles");
    }

    if (currentView === "dashboard") renderDashboard();
  } catch (err) {
    console.error("executeDelete error:", err);
    showToast("Delete failed: " + (err.message || "Unknown error"), "error");
  }
}

// ═══════════════════════════════════════════════════════════════
//  CASE SHARING SYSTEM
// ═══════════════════════════════════════════════════════════════
function openShareCaseModal() {
  if (!selCase) return;
  const listEl = document.getElementById("share-modal-list");
  if (!listEl) return;

  const sharedUids = selCase.sharedWith || [];
  const permissions = selCase.permissions || {};
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
}

function closeShareModal() {
  const modal = document.getElementById("share-modal");
  if (modal) modal.classList.add("hidden");
}

async function saveShareSettings() {
  if (!selCase) return;
  const checkboxes = document.querySelectorAll('input[name="share-associate-checkbox"]');
  const selectedUids = [];
  checkboxes.forEach(cb => {
    if (cb.checked) selectedUids.push(cb.value);
  });

  const ownerUid = selCase.ownerUid || window._currentUser.uid;
  const allowedUids = [ownerUid, ...selectedUids];

  try {
    showToast("Updating share settings...");
    await dbUpdateCase(selCase.id, {
      sharedWith: selectedUids,
      allowedUids: allowedUids
    });
    selCase.sharedWith = selectedUids;
    selCase.allowedUids = allowedUids;
    closeShareModal();
    showToast("Case shared successfully!");
  } catch (err) {
    console.error("saveShareSettings error:", err);
    showToast("Failed to share case: " + err.message, "error");
  }
}

// ═══════════════════════════════════════════════════════════════
//  PROFILE FORM
// ═══════════════════════════════════════════════════════════════
let pfDriveConnected = false;

function openAddProfile() {
  profFormMode = "add";
  pfColor = AVATAR_COLORS[0];
  pfDriveConnected = false;
  pfPhotoDataUrl = null;

  setElText("pf-title", "New Attorney Profile");
  setElVal("pf-name", "");
  setElVal("pf-role", "");
  setElVal("pf-contact", "");
  setElVal("pf-email", "");

  const cancelBtn = document.getElementById("pf-cancel-btn");
  if (cancelBtn) cancelBtn.onclick = () => navTo("profiles");

  const backBtn = document.getElementById("pf-back-btn");
  if (backBtn) backBtn.onclick = () => navTo("profiles");

  resetDriveAuthUI();
  setDetailsEnabled(false);
  clearProfileErrors();
  resetPhotoUpload();
  updateAvatarPreview();
  showView("profileForm");
}

function openEditProfile() {
  const p = selProfile;
  if (!p) return;
  profFormMode = "edit";
  pfColor = p.avatarColor || AVATAR_COLORS[0];
  pfPhotoDataUrl = p.photoUrl || null;
  pfDriveConnected = true;

  setElText("pf-title", "Edit Profile");
  setElVal("pf-name", p.name);
  setElVal("pf-role", p.role);
  setElVal("pf-contact", p.contact || "");
  setElVal("pf-email", p.email || "");

  const cancelBtn = document.getElementById("pf-cancel-btn");
  if (cancelBtn) cancelBtn.onclick = () => { showView("profileDetail"); renderProfileDetail(); };

  const backBtn = document.getElementById("pf-back-btn");
  if (backBtn) backBtn.onclick = () => { showView("profileDetail"); renderProfileDetail(); };

  const driveSection = document.getElementById("pf-drive-section");
  if (driveSection) driveSection.style.display = "none";

  setDetailsEnabled(true);
  const saveBtn = document.getElementById("pf-save-btn");
  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.style.opacity = "1";
    saveBtn.style.cursor = "pointer";
  }
  setElText("pf-save-btn-text", "Save Changes");

  clearProfileErrors();
  resetPhotoUpload();
  if (pfPhotoDataUrl) {
    showPhotoPreview(pfPhotoDataUrl);
  }
  updateAvatarPreview();
  showView("profileForm");
}

function resetDriveAuthUI() {
  const driveSection = document.getElementById("pf-drive-section");
  if (driveSection) driveSection.style.display = "block";

  const statusEl = document.getElementById("pf-drive-status");
  const btn = document.getElementById("pf-connect-drive-btn");
  const btnText = document.getElementById("pf-connect-drive-text");
  const errorEl = document.getElementById("pf-drive-error");

  if (statusEl) {
    statusEl.className = "drive-status-chip disconnected";
    statusEl.textContent = "● Not Connected";
  }
  if (btn) {
    btn.disabled = false;
    btn.style.opacity = "1";
    btn.style.cursor = "pointer";
    btn.classList.remove("connected");
  }
  if (btnText) btnText.textContent = "Connect Google Drive Account";
  if (errorEl) errorEl.classList.add("hidden");
}

function setDetailsEnabled(enabled) {
  const section = document.getElementById("pf-details-section");
  if (!section) return;
  const inputs = section.querySelectorAll("input, select, textarea");

  if (enabled) {
    section.style.opacity = "1";
    section.style.pointerEvents = "all";
    section.style.filter = "none";
    inputs.forEach(inp => inp.disabled = false);
  } else {
    section.style.opacity = "0.4";
    section.style.pointerEvents = "none";
    section.style.filter = "grayscale(0.5)";
    inputs.forEach(inp => inp.disabled = true);
  }
}

async function connectDriveForProfile() {
  const btn = document.getElementById("pf-connect-drive-btn");
  const btnText = document.getElementById("pf-connect-drive-text");
  const errorEl = document.getElementById("pf-drive-error");

  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = "Connecting...";
  if (errorEl) errorEl.classList.add("hidden");

  try {
    await waitForGoogleDriveReady();
    await promptDriveAuth();

    pfDriveConnected = true;

    const statusEl = document.getElementById("pf-drive-status");
    if (statusEl) {
      statusEl.className = "drive-status-chip connected";
      statusEl.textContent = "● Connected";
    }

    if (btn) btn.classList.add("connected");
    if (btnText) btnText.textContent = "✓ Google Drive Connected";

    setDetailsEnabled(true);

    const saveBtn = document.getElementById("pf-save-btn");
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.style.opacity = "1";
      saveBtn.style.cursor = "pointer";
    }
    setElText("pf-save-btn-text", profFormMode === "add" ? "Create Profile" : "Save Changes");

    showToast("Google Drive connected successfully");
  } catch (err) {
    console.error("Drive auth failed:", err);
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = "Connect Google Drive Account";
    if (errorEl) {
      errorEl.textContent = err.message || "Failed to connect. Please try again.";
      errorEl.classList.remove("hidden");
    }
    showToast("Drive connection failed: " + err.message, "error");
  }
}

let pfPhotoDataUrl = null;

function resetPhotoUpload() {
  pfPhotoDataUrl = null;
  const input = document.getElementById("pf-photo-input");
  if (input) input.value = "";
  const dropzone = document.getElementById("pf-photo-dropzone");
  const previewWrap = document.getElementById("pf-photo-preview-wrap");
  const initialsWrap = document.getElementById("pf-photo-initials-wrap");
  if (dropzone) dropzone.style.display = "block";
  if (previewWrap) previewWrap.style.display = "none";
  if (initialsWrap) initialsWrap.style.display = "flex";
}

function showPhotoPreview(dataUrl) {
  const dropzone = document.getElementById("pf-photo-dropzone");
  const previewWrap = document.getElementById("pf-photo-preview-wrap");
  const initialsWrap = document.getElementById("pf-photo-initials-wrap");
  const img = document.getElementById("pf-photo-preview-img");
  if (dropzone) dropzone.style.display = "none";
  if (previewWrap) previewWrap.style.display = "flex";
  if (initialsWrap) initialsWrap.style.display = "none";
  if (img) img.src = dataUrl;
}

function handlePhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    showToast("Photo must be under 2MB", "error");
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    pfPhotoDataUrl = e.target.result;
    showPhotoPreview(pfPhotoDataUrl);
  };
  reader.readAsDataURL(file);
}

function removePhoto() {
  pfPhotoDataUrl = null;
  const input = document.getElementById("pf-photo-input");
  if (input) input.value = "";
  resetPhotoUpload();
  updateAvatarPreview();
}

function updateAvatarPreview() {
  const name = document.getElementById("pf-name")?.value || "Preview";
  const role = document.getElementById("pf-role")?.value || "Role";

  const av = document.getElementById("pf-avatar-preview");
  if (av) av.textContent = initials(name);

  setElText("pf-name-preview-initials", name === "Preview" ? "Attorney Name" : name);
  setElText("pf-role-preview-initials", role === "Role" ? "Role" : role);
  setElText("pf-name-preview", name === "Preview" ? "Attorney Name" : name);
  setElText("pf-role-preview", role === "Role" ? "Role" : role);
}

function bindProfileInputs() {
  const nameInp = document.getElementById("pf-name");
  const roleInp = document.getElementById("pf-role");
  if (nameInp && !nameInp._bound) {
    nameInp.oninput = updateAvatarPreview;
    nameInp._bound = true;
  }
  if (roleInp && !roleInp._bound) {
    roleInp.oninput = updateAvatarPreview;
    roleInp._bound = true;
  }
}

function clearProfileErrors() {
  ["pf-name-err","pf-role-err","pf-drive-error"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });
  ["pf-name","pf-role"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("err");
  });
}

async function saveProfile() {
  if (profFormMode === "add" && !pfDriveConnected) {
    showToast("Please connect Google Drive before creating a profile", "error");
    return;
  }

  const name = (document.getElementById("pf-name")?.value || "").trim();
  const role = (document.getElementById("pf-role")?.value || "").trim();
  let valid = true;

  if (!name) {
    const errEl = document.getElementById("pf-name-err");
    const inpEl = document.getElementById("pf-name");
    if (errEl) errEl.classList.remove("hidden");
    if (inpEl) inpEl.classList.add("err");
    valid = false;
  }
  if (!role) {
    const errEl = document.getElementById("pf-role-err");
    const inpEl = document.getElementById("pf-role");
    if (errEl) errEl.classList.remove("hidden");
    if (inpEl) inpEl.classList.add("err");
    valid = false;
  }
  if (!valid) return;

  const data = {
    name, role,
    contact: (document.getElementById("pf-contact")?.value || "").trim(),
    email: (document.getElementById("pf-email")?.value || "").trim(),
    avatarColor: pfColor,
    photoDataUrl: null
  };

  try {
    if (profFormMode === "add") {
      data.createdAt = new Date().toISOString().slice(0, 10);
      const np = await dbAddProfile(data);
      selProfile = np;

      showToast("Creating Drive folder...");
      const folderId = await createDriveFolder(`Simando Law — ${np.name}`, DRIVE_FOLDER_ID || null);
      if (folderId) {
        await dbUpdateProfile(np.id, { driveFolderId: folderId });
        np.driveFolderId = folderId;
        showToast("Drive folder created!");
      }

      if (pfPhotoDataUrl && np.driveFolderId) {
        try {
          showToast("Uploading profile photo...");
          const { fileId, thumbnailUrl } = await uploadProfilePhotoToDrive(pfPhotoDataUrl, np.driveFolderId, np.name);
          await dbUpdateProfile(np.id, { photoFileId: fileId, photoUrl: thumbnailUrl });
          np.photoFileId = fileId;
          np.photoUrl = thumbnailUrl;
          showToast("Profile photo saved!");
        } catch (photoErr) {
          console.error("Photo upload error:", photoErr);
          showToast("Photo upload failed: " + photoErr.message, "error");
        }
      }

      showToast("Profile created successfully!");
      renderProfiles();
      navTo("profiles");
    } else {
      if (pfPhotoDataUrl && pfPhotoDataUrl.startsWith("data:")) {
        try {
          showToast("Uploading profile photo...");
          const folderId = selProfile.driveFolderId;
          if (selProfile.photoFileId && hasValidToken()) {
            await deleteDriveFile(selProfile.photoFileId).catch(() => {});
          }
          const { fileId, thumbnailUrl } = await uploadProfilePhotoToDrive(pfPhotoDataUrl, folderId, name);
          data.photoFileId = fileId;
          data.photoUrl = thumbnailUrl;
          showToast("Profile photo updated!");
        } catch (photoErr) {
          console.error("Photo upload error:", photoErr);
          showToast("Photo upload failed: " + photoErr.message, "error");
        }
      } else if (!pfPhotoDataUrl && selProfile.photoFileId) {
        if (hasValidToken()) await deleteDriveFile(selProfile.photoFileId).catch(() => {});
        data.photoFileId = null;
        data.photoUrl = null;
      } else {
        data.photoFileId = selProfile.photoFileId || null;
        data.photoUrl = selProfile.photoUrl || null;
      }

      await dbUpdateProfile(selProfile.id, data);
      selProfile = { ...selProfile, ...data };
      showToast("Profile updated!");
      showView("profileDetail");
      renderProfileDetail();
    }
  } catch (err) {
    console.error("saveProfile error:", err);
    showToast("Failed to save profile: " + (err.message || "Unknown error"), "error");
  }
}

async function createProfileFolderManual() {
  if (!selProfile) return;
  if (!selProfile.driveFolderId && accessToken) {
    showToast("Creating Drive folder...");
    const folderId = await createDriveFolder(`Simando Law — ${selProfile.name}`, DRIVE_FOLDER_ID || null);
    if (folderId) {
      await dbUpdateProfile(selProfile.id, { driveFolderId: folderId });
      selProfile.driveFolderId = folderId;
      showToast("Drive folder created!");
      renderProfileDetail();
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  CASE FORM
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
    `<button type="button" onclick="removeParty('${role}',${i})" style="background:none;border:none;cursor:pointer;padding:0;line-height:1;font-size:14px;opacity:0.6" title="Remove">×</button>`;

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
  const labels = CATEGORY_PARTY_LABELS[category] || ["Petitioner", "Respondent"];
  const aLabel = document.getElementById("cf-party-a-label");
  const bLabel = document.getElementById("cf-party-b-label");
  if (aLabel) aLabel.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;background:var(--gold);display:inline-block;flex-shrink:0"></span> ${labels[0]}`;
  if (bLabel) bLabel.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;background:var(--violet);display:inline-block;flex-shrink:0"></span> ${labels[1]}`;
  await loadCaseTypesForCategory(category);
  setElVal("cf-type-input", "");
  hideCaseTypeSuggestions();
}

function updateCfChip() {
  const chip = document.getElementById("cf-profile-chip");
  if (!chip) return;
  if (selProfile) {
    chip.innerHTML = `${avatarDiv(selProfile.name, selProfile.avatarColor, 24, selProfile.photoUrl)}<span style="font-size:13px;color:var(--text-muted)">${selProfile.name}</span>`;
    chip.style.display = "flex";
  } else {
    chip.style.display = "none";
  }
}

// ═══════════════════════════════════════════════════════════════
//  BOOT LOGIC WITH LOOP-FREE 2FA SESSION GUARD
// ═══════════════════════════════════════════════════════════════
function enterLocalMode(reason) {
  localMode = true;
  const banner = document.getElementById("config-banner");
  if (banner) {
    banner.textContent = "⚠️ " + (reason || "Firebase not connected. Data is stored in memory only and will be lost on refresh.");
    banner.classList.add("show");
  }
  showToast("Running in local mode — data will not persist", "error");
}

function initAppUI() {
  const loader = document.getElementById("loading-screen");
  if (loader) loader.style.display = "none";
  if (typeof initTheme === "function") initTheme();
  if (typeof bindProfileInputs === "function") bindProfileInputs();
  if (typeof initPasswordStrengthChecker === "function") initPasswordStrengthChecker();
  showView("dashboard");
  renderDashboard();
}

async function connectDatabase() {
  if (typeof window._fbReady !== "undefined" && window._fbReady && window._db) {
    localMode = false;
    const banner = document.getElementById("config-banner");
    if (banner) banner.classList.remove("show");

    const u = window._currentUser || window._auth?.currentUser;
    if (u) {
      try {
        await dbLoad();
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

function clearCaseErrors() {
  ["cf-title-err","cf-filed-err","cf-parties-err","cf-narrative-err"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });
  ["cf-case-title","cf-filed","cf-narrative"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("err");
  });
}

// ── ROBUST SAVE CASE (AUTO-CAPTURES INPUT TEXT & ENSURES STABLE SAVE) ──
async function saveCase() {
  // 1. Auto-capture pending party inputs if user typed without clicking '+'
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
  const due = document.getElementById("cf-due")?.value || "";
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

  const category = document.getElementById("cf-category")?.value || CASE_CATEGORIES[0];
  const caseType = (document.getElementById("cf-type-input")?.value || "").trim();
  if (caseType) await saveCaseTypeIfNew(category, caseType);

  const u = window._currentUser || window._auth?.currentUser;
  const myProf = profiles.find(p => p.ownerUid === u?.uid || (p.email && p.email.toLowerCase() === u?.email?.toLowerCase())) || selProfile;

  const data = {
    title,
    filedDate: filed,
    dueDate: due || null,
    parties,
    narrative,
    category,
    type: caseType,
    caseNumber: (document.getElementById("cf-case-number")?.value || "").trim(),
    docType: (document.getElementById("cf-doc-type")?.value || "").trim(),
    status: document.getElementById("cf-status")?.value || STATUS_OPTIONS[0],
    venue: getVenueValue(),
    documents: pendingDocs,
  };

  try {
    const caseCategory = data.category || "Other";
    const cType = data.type || "Other";
    const caseTitle = data.title || "Untitled";
    const profileFolderId = myProf?.driveFolderId || selProfile?.driveFolderId || null;
    const hadLocalFiles = pendingDocs.some(d => d._localTempId);

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

    if (hasValidToken() && typeof createOrUpdateCalendarEvent === "function") {
      showToast("Syncing with Google Calendar...");
      if (caseFormMode === "edit" && selCase?.calendarEventId) {
        data.calendarEventId = selCase.calendarEventId;
      }
      const eventId = await createOrUpdateCalendarEvent(data);
      if (eventId) {
        data.calendarEventId = eventId;
      }
    }

    if (caseFormMode === "add") {
      data.profileId = myProf?.id || (selProfile?.id || "unassigned");
      data.createdAt = new Date().toISOString().slice(0, 10);
      data.ownerUid = u?.uid || "unknown";
      data.sharedWith = [];
      data.allowedUids = [u?.uid || "unknown"];
      
      const newCaseObj = await dbAddCase(data);
      
      if (newCaseObj && !cases.some(c => c.id === newCaseObj.id)) {
        cases.unshift(newCaseObj);
      } else if (!cases.some(c => c.title === data.title && c.filedDate === data.filedDate)) {
        cases.unshift(data);
      }

      showToast("Case added successfully!");
    } else {
      if (selCase) {
        data.ownerUid = selCase.ownerUid || u?.uid;
        data.sharedWith = selCase.sharedWith || [];
        data.allowedUids = selCase.allowedUids || [data.ownerUid];
      }
      await dbUpdateCase(selCase.id, data);
      
      const idx = cases.findIndex(c => c.id === selCase.id);
      if (idx >= 0) cases[idx] = { ...cases[idx], ...data };
      selCase = { ...selCase, ...data };

      showToast("Case updated successfully!");
    }

    pendingDocs = [];

    renderDashboard();
    renderAllCases();
    if (caseFormOrigin === "profileDetail" && selProfile) {
      renderProfileDetail();
    }

    navTo(caseFormMode === "add" ? (caseFormOrigin === "profileDetail" ? "profileDetail" : "allcases") : "caseDetail");
    if (caseFormMode === "edit") renderCaseDetail();

  } catch (err) {
    console.error("saveCase error:", err);
    showToast("Failed to save case: " + (err.message || "Unknown error"), "error");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = caseFormMode === "add" ? "Add Case" : "Save Changes";
    }
  }
}
