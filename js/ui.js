// ═══════════════════════════════════════════════════════════════
//  THEME INITIALIZATION & TOGGLE
// ═══════════════════════════════════════════════════════════════
function initTheme() {
  const saved = localStorage.getItem('simando-theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
    if (typeof updateThemeIcon === "function") updateThemeIcon(saved);
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('simando-theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const sw = document.querySelector('.theme-switch');
  if (sw) {
    sw.setAttribute('data-theme-active', theme);
    if (theme === 'light') sw.classList.add('is-light');
    else sw.classList.remove('is-light');
  }
}

window.initTheme = initTheme;
window.toggleTheme = toggleTheme;
window.updateThemeIcon = updateThemeIcon;

// ═══════════════════════════════════════════════════════════════
//  DOM HELPERS & ERROR CLEARING
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
//  SET AVAILABILITY MODAL (MATCHING CHAT ASK-AVAILABILITY)
// ═══════════════════════════════════════════════════════════════
window.openBusyModal = function() {
  const u = window._currentUser || window._auth?.currentUser;
  if (!u) {
    if (typeof showToast === "function") showToast("Please wait for your session to load.", "error");
    return;
  }

  let modal = document.getElementById("busy-modal");

  // If the old modal layout exists in HTML, dynamically update its content to match the chat card design
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "busy-modal";
    modal.className = "modal-overlay hidden";
    modal.style.zIndex = "10004";
    modal.onclick = (e) => { if (e.target === modal) window.closeBusyModal(); };
    document.body.appendChild(modal);
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().split("T")[0];

  const myProf = profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase()));
  const associates = profiles.filter(p => p.ownerUid && p.ownerUid !== u.uid);

  let associateOptions = `<option value="personal">🔒 Personal Schedule (My Out of Office / Hearing)</option>`;
  associates.forEach(p => {
    associateOptions += `<option value="${p.ownerUid}">👤 ${escHtml(p.name)} (${escHtml(p.role || "Attorney")})</option>`;
  });

  modal.innerHTML = `
    <div class="modal-box" style="max-width: 460px; padding: 22px;">
      <div style="font-size: 17px; font-weight: 700; color: var(--gold-light); display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; border-bottom: 1px solid var(--border); padding-bottom: 10px;">
        <span style="display: flex; align-items: center; gap: 8px;">
          <i class="bi bi-calendar-event"></i> Set / Propose Availability
        </span>
        <button onclick="window.closeBusyModal()" style="background: none; border: none; color: var(--text-dim); font-size: 18px; cursor: pointer; padding: 0 4px;"><i class="bi bi-x-lg"></i></button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;">
        <div>
          <label class="field-label">Purpose / Session Title *</label>
          <input class="field-input" id="avail-modal-title" placeholder="e.g. Case Strategy Sync / Court Appearance" value="Case Strategy Sync" autocomplete="off"/>
        </div>

        <div class="grid2">
          <div>
            <label class="field-label">Date *</label>
            <input type="date" class="field-input" id="avail-modal-date" value="${defaultDate}"/>
          </div>
          <div>
            <label class="field-label">Time *</label>
            <input type="time" class="field-input" id="avail-modal-time" value="14:00"/>
          </div>
        </div>

        <div>
          <label class="field-label">Assign To / Invite Associate</label>
          <select class="field-input" id="avail-modal-target">
            ${associateOptions}
          </select>
        </div>

        <div>
          <label class="field-label">Brief Description (Optional)</label>
          <input class="field-input" id="avail-modal-notes" placeholder="e.g. Discuss formal offer or pre-trial notes"/>
        </div>
      </div>

      <div style="display: flex; gap: 10px; justify-content: flex-end; border-top: 1px solid var(--border); padding-top: 14px;">
        <button class="btn btn-ghost" type="button" onclick="window.closeBusyModal()">Cancel</button>
        <button class="btn btn-primary" type="button" id="btn-submit-avail-modal" onclick="window.submitAvailabilityFromModal()">
          <i class="bi bi-send-fill"></i> Save Availability
        </button>
      </div>
    </div>
  `;

  modal.classList.remove("hidden");
};

window.closeBusyModal = function() {
  const modal = document.getElementById("busy-modal");
  if (modal) modal.classList.add("hidden");
};

window.submitAvailabilityFromModal = async function() {
  const title = (document.getElementById("avail-modal-title")?.value || "").trim() || "Availability Session";
  const date = document.getElementById("avail-modal-date")?.value || "";
  const time = document.getElementById("avail-modal-time")?.value || "14:00";
  const targetVal = document.getElementById("avail-modal-target")?.value || "personal";
  const notes = (document.getElementById("avail-modal-notes")?.value || "").trim();

  if (!date) {
    if (typeof showToast === "function") showToast("Please select a valid date.", "error");
    return;
  }

  const u = window._currentUser || window._auth?.currentUser;
  const myProf = profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase()));

  const btn = document.getElementById("btn-submit-avail-modal");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Saving...";
  }

  try {
    if (typeof showToast === "function") showToast("Saving schedule...");

    if (targetVal === "personal") {
      // 1. Personal Out of Office / Busy block
      const busyData = {
        title: title,
        date: date,
        time: time,
        description: notes,
        type: "busy",
        targetUid: u.uid,
        targetName: myProf?.name || u.displayName || u.email,
        requesterUid: u.uid,
        requesterName: myProf?.name || u.displayName || u.email,
        status: "accepted"
      };

      if (typeof dbAddAppointment === "function") {
        await dbAddAppointment(busyData);
      }
      if (typeof showToast === "function") showToast("Availability logged to schedule! 📅");
    } else {
      // 2. Direct Proposal to another attorney
      const targetProf = profiles.find(p => p.ownerUid === targetVal);
      const apptData = {
        title: title,
        date: date,
        time: time,
        description: notes,
        requesterUid: u.uid,
        requesterName: myProf?.name || u.displayName || u.email,
        targetUid: targetVal,
        targetName: targetProf?.name || "Attorney",
        status: "pending"
      };

      let apptId = null;
      if (typeof dbAddAppointment === "function") {
        apptId = await dbAddAppointment(apptData);
      }

      if (typeof dbAddNotification === "function") {
        await dbAddNotification({
          toUid: targetVal,
          fromUid: u.uid,
          fromName: myProf?.name || u.displayName || u.email,
          title: "📅 Availability Request",
          message: `${myProf?.name || "An attorney"} requested availability for "${title}" on ${date} at ${time}.`,
          type: "appointment_request",
          relatedId: apptId,
          status: "unread",
          appointmentStatus: "pending"
        });
      }
      if (typeof showToast === "function") showToast("Availability proposal card sent & notified! 📅");
    }

    window.closeBusyModal();
    if (typeof renderCalendarView === "function") renderCalendarView();
  } catch (err) {
    console.error("submitAvailabilityFromModal error:", err);
    if (typeof showToast === "function") showToast("Failed to save: " + err.message, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="bi bi-send-fill"></i> Save Availability`;
    }
  }
};

window.deleteBusySlot = async function(id, dateStr) {
  if (!confirm("Remove this unavailable/busy schedule entry?")) return;
  try {
    if (typeof dbDeleteAppointment === "function") {
      await dbDeleteAppointment(id);
    }
    if (typeof showToast === "function") showToast("Availability entry removed!");
    if (typeof closeDateScheduleModal === "function") closeDateScheduleModal();
    if (typeof renderCalendarView === "function") renderCalendarView();
  } catch (err) {
    console.error("deleteBusySlot error:", err);
  }
};

// ═══════════════════════════════════════════════════════════════
//  SYSTEM HEALTH & DIAGNOSTIC ENGINE
// ═══════════════════════════════════════════════════════════════
let systemHealthStatus = "healthy";

window.openDiagnosticModal = function() {
  const modal = document.getElementById("diagnostic-modal");
  if (!modal) return;
  modal.classList.remove("hidden");
  updateWorkspaceStatus(true);
};

window.closeDiagnosticModal = function() {
  const modal = document.getElementById("diagnostic-modal");
  if (modal) modal.classList.add("hidden");
};

async function updateWorkspaceStatus(manualRun = false) {
  const netBadge   = document.getElementById("diag-network-badge");
  const netSub     = document.getElementById("diag-network-sub");
  const dbBadge    = document.getElementById("diag-db-badge");
  const dbSub      = document.getElementById("diag-db-sub");
  const driveBadge = document.getElementById("diag-drive-badge");
  const driveSub   = document.getElementById("diag-drive-sub");

  const dot = document.getElementById("status-indicator-dot");
  const txt = document.getElementById("status-indicator-text");

  let isNetworkOk = navigator.onLine;
  let isDbOk = !localMode && !!window._db && dbReady;
  let isDriveOk = typeof hasValidToken === "function" ? hasValidToken() : false;

  const u = window._currentUser || window._auth?.currentUser;
  const myProf = u ? profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase())) : null;
  const hasDriveFolder = !!(myProf && myProf.driveFolderId);

  // 1. Network
  if (netBadge && netSub) {
    if (isNetworkOk) {
      netBadge.className = "badge badge-pass";
      netBadge.innerHTML = `<i class="bi bi-wifi" style="color:var(--green)"></i> Online`;
      netSub.textContent = "Active internet connection detected";
    } else {
      netBadge.className = "badge badge-fail";
      netBadge.innerHTML = `<i class="bi bi-wifi-off" style="color:var(--red)"></i> Offline`;
      netSub.textContent = "No network connection. Offline changes won't sync.";
    }
  }

  // 2. Database Sync
  if (dbBadge && dbSub) {
    if (isDbOk) {
      dbBadge.className = "badge badge-pass";
      dbBadge.innerHTML = `<i class="bi bi-database-check" style="color:var(--green)"></i> Connected`;
      dbSub.textContent = "Firestore real-time listeners synchronized (Long Polling)";
    } else if (localMode) {
      dbBadge.className = "badge badge-warn";
      dbBadge.innerHTML = `<i class="bi bi-hdd-network" style="color:var(--amber)"></i> Memory Mode`;
      dbSub.textContent = "Running in memory. Data will not persist on refresh.";
    } else {
      dbBadge.className = "badge badge-fail";
      dbBadge.innerHTML = `<i class="bi bi-arrow-repeat"></i> Connecting...`;
      dbSub.textContent = "Waiting for cloud database handshake.";
    }
  }

  // 3. Google Drive
  if (driveBadge && driveSub) {
    if (isDriveOk && hasDriveFolder) {
      driveBadge.className = "badge badge-pass";
      driveBadge.innerHTML = `<i class="bi bi-cloud-check-fill" style="color:var(--green)"></i> Linked`;
      driveSub.textContent = "OAuth active · Dedicated firm storage folder verified";
    } else if (isDriveOk && !hasDriveFolder) {
      driveBadge.className = "badge badge-warn";
      driveBadge.innerHTML = `<i class="bi bi-folder-x" style="color:var(--amber)"></i> No Folder`;
      driveSub.textContent = "Drive connected but no root case folder created yet.";
    } else {
      driveBadge.className = "badge badge-warn";
      driveBadge.innerHTML = `<i class="bi bi-cloud-slash" style="color:var(--amber)"></i> Not Connected`;
      driveSub.textContent = "Connect Google Account under My Settings to enable filing & docs.";
    }
  }

  if (!isNetworkOk || (!isDbOk && !localMode)) {
    systemHealthStatus = "danger";
    if (dot) dot.className = "status-dot danger";
    if (txt) {
      txt.textContent = "System Disconnected";
      txt.style.color = "var(--red)";
    }
  } else if (!isDriveOk || localMode || !hasDriveFolder) {
    systemHealthStatus = "warning";
    if (dot) dot.className = "status-dot warning";
    if (txt) {
      txt.textContent = !isDriveOk ? "Connect Drive" : "Memory Mode";
      txt.style.color = "var(--amber)";
    }
  } else {
    systemHealthStatus = "healthy";
    if (dot) dot.className = "status-dot healthy";
    if (txt) {
      txt.textContent = "Workspace Active";
      txt.style.color = "var(--green)";
    }
  }

  if (manualRun && typeof showToast === "function") {
    showToast(`Health check complete: ${systemHealthStatus === "healthy" ? "All systems healthy" : "Issues detected"}`, systemHealthStatus === "healthy" ? "success" : "error");
  }
}

window.updateWorkspaceStatus = updateWorkspaceStatus;

if (!window._healthIntervalId) {
  window._healthIntervalId = setInterval(() => {
    if (document.visibilityState === "visible") {
      updateWorkspaceStatus(false);
    }
  }, 25000);
}
window.addEventListener("online", () => updateWorkspaceStatus(false));
window.addEventListener("offline", () => updateWorkspaceStatus(false));

// ═══════════════════════════════════════════════════════════════
//  UNIVERSAL ACTION CONFIRMATION MODAL CONTROLLER
// ═══════════════════════════════════════════════════════════════
let pendingActionConfirmCallback = null;

window.openConfirmModal = function({ icon = "bi-shield-check", title = "Confirm Action", body = "Are you sure?", confirmText = "Confirm", confirmStyle = "btn-primary", onConfirm = null }) {
  const modal = document.getElementById("universal-confirm-modal");
  const iconEl = document.getElementById("ucm-icon");
  const titleEl = document.getElementById("ucm-title");
  const bodyEl = document.getElementById("ucm-body");
  const btn = document.getElementById("ucm-confirm-btn");

  if (!modal) return;

  if (iconEl) {
    const iconClass = icon.startsWith("bi-") ? icon : "bi-shield-check";
    iconEl.innerHTML = `<i class="bi ${iconClass}" style="color:var(--gold)"></i>`;
  }
  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.innerHTML = body;

  if (btn) {
    btn.textContent = confirmText;
    btn.className = `btn ${confirmStyle}`;
  }

  pendingActionConfirmCallback = onConfirm;
  modal.classList.remove("hidden");
};

window.closeConfirmModal = function() {
  const modal = document.getElementById("universal-confirm-modal");
  if (modal) modal.classList.add("hidden");
  pendingActionConfirmCallback = null;
};

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("ucm-confirm-btn");
  if (btn) {
    btn.addEventListener("click", () => {
      const cb = pendingActionConfirmCallback;
      window.closeConfirmModal();
      if (typeof cb === "function") {
        cb();
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════
//  CASE DETAIL BACK NAVIGATION
// ═══════════════════════════════════════════════════════════════
let caseDetailOrigin = "allcases";

window.handleCaseDetailBack = function() {
  if (caseDetailOrigin === "profileDetail" && selProfile) {
    showView("profileDetail");
    renderProfileDetail();
  } else if (caseDetailOrigin === "dashboard") {
    navTo("dashboard");
  } else {
    navTo("allcases");
  }
};

// ═══════════════════════════════════════════════════════════════
//  UNSAVED CASE FORM CHANGES INTERCEPTION & DISCARD GUARD
// ═══════════════════════════════════════════════════════════════
let pendingNavigationDestination = null;
let _isSubmittingCase = false;

function hasUnsavedCaseChanges() {
  if (_isSubmittingCase) return false;
  if (currentView !== "caseForm") return false;
  const title = (document.getElementById("cf-case-title")?.value || "").trim();
  const narrative = (document.getElementById("cf-narrative")?.value || "").trim();
  const caseNumber = (document.getElementById("cf-case-number")?.value || "").trim();
  const docDue = (document.getElementById("cf-due")?.value || "").trim();
  const docType = (document.getElementById("cf-doc-type")?.value || "").trim();
  const hasDocs = Array.isArray(pendingDocs) && pendingDocs.length > 0;
  const hasHearings = Array.isArray(window.cfHearings) && window.cfHearings.length > 0;
  
  return Boolean(title || narrative || caseNumber || docDue || docType || hasDocs || hasHearings);
}

window.hasUnsavedCaseChanges = hasUnsavedCaseChanges;

window.promptDiscardCase = function(destination) {
  pendingNavigationDestination = destination;
  const modal = document.getElementById("discard-case-modal");
  if (modal) modal.classList.remove("hidden");
};

window.cancelDiscardCase = function() {
  pendingNavigationDestination = null;
  const modal = document.getElementById("discard-case-modal");
  if (modal) modal.classList.add("hidden");
};

window.confirmDiscardCase = function() {
  const target = pendingNavigationDestination || caseFormOrigin || "allcases";
  pendingNavigationDestination = null;
  const modal = document.getElementById("discard-case-modal");
  if (modal) modal.classList.add("hidden");

  resetCaseFormFields();
  executeNavigation(target);
};

window.handleCaseCancelOrExit = function() {
  if (hasUnsavedCaseChanges()) {
    window.promptDiscardCase(caseFormOrigin || "allcases");
  } else {
    resetCaseFormFields();
    executeNavigation(caseFormOrigin || "allcases");
  }
};

function resetCaseFormFields() {
  setElVal("cf-case-title", "");
  setElVal("cf-narrative", "");
  setElVal("cf-filed", "");
  setElVal("cf-due", "");
  setElVal("cf-case-number", "");
  setElVal("cf-doc-type", "");
  setElVal("cf-type-input", "");
  
  if (typeof pendingDocs !== "undefined") pendingDocs = [];
  if (typeof window.cfHearings !== "undefined") window.cfHearings = [];
  if (typeof window.cfPetitioners !== "undefined") window.cfPetitioners = [];
  if (typeof window.cfRespondents !== "undefined") window.cfRespondents = [];

  clearCaseErrors();
}

window.addEventListener("beforeunload", (e) => {
  if (hasUnsavedCaseChanges()) {
    e.preventDefault();
    e.returnValue = "You have unsaved case changes. Are you sure you want to leave?";
    return e.returnValue;
  }
});

// ═══════════════════════════════════════════════════════════════
//  VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════
function isValidMobile(num) {
  if (!num) return true;
  const cleaned = String(num).replace(/\D/g, "");
  return cleaned.length === 11;
}
window.isValidMobile = isValidMobile;

function isValidEmail(email) {
  return /^[^\s@]+@(gmail\.com|outlook\.com)$/i.test(String(email || "").trim());
}
window.isValidEmail = isValidEmail;

// ═══════════════════════════════════════════════════════════════
//  DEVICE DETECTION
// ═══════════════════════════════════════════════════════════════
function autoDetectDevice() {
  const w = window.innerWidth;
  const ua = navigator.userAgent;
  const isTouch = navigator.maxTouchPoints > 0;
  
  document.body.classList.remove("device-mobile", "device-tablet", "device-desktop");

  let deviceLabel = "Desktop";
  let deviceIcon = "bi-laptop";

  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua) || (w >= 600 && w <= 1024 && isTouch)) {
    document.body.classList.add("device-tablet");
    window.deviceType = "tablet";
    deviceLabel = "Tablet";
    deviceIcon = "bi-tablet";
  } else if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile/i.test(ua) || w < 600) {
    document.body.classList.add("device-mobile");
    if (!document.body.classList.contains("sidebar-collapsed")) {
      document.body.classList.add("sidebar-collapsed");
    }
    window.deviceType = "mobile";
    deviceLabel = "Phone";
    deviceIcon = "bi-phone";
  } else {
    document.body.classList.add("device-desktop");
    window.deviceType = "desktop";
    deviceLabel = "Desktop";
    deviceIcon = "bi-laptop";
  }

  const chip = document.getElementById("settings-device-chip");
  if (chip) {
    chip.innerHTML = `<i class="bi ${deviceIcon}" style="color:var(--gold);margin-right:4px"></i> Connected as ${deviceLabel}`;
  }

  if (!window._deviceToastShown) {
    window._deviceToastShown = true;
    setTimeout(() => {
      if (typeof showToast === "function") {
        showToast(`Connected as ${deviceLabel}`, "success");
      }
    }, 1200);
  }
}

window.addEventListener("DOMContentLoaded", autoDetectDevice);
window.addEventListener("resize", autoDetectDevice);

// ═══════════════════════════════════════════════════════════════
//  PASSWORD STRENGTH CHECKER
// ═══════════════════════════════════════════════════════════════
function initPasswordStrengthChecker() {
  const passInput = document.getElementById("setting-password");
  const reqContainer = document.getElementById("password-requirements");

  if (!passInput || !reqContainer) return;

  const reqs = {
    length: { el: document.getElementById("req-length"), test: (val) => val.length >= 6 },
    upper: { el: document.getElementById("req-upper"), test: (val) => /[A-Z]/.test(val) },
    number: { el: document.getElementById("req-number"), test: (val) => /\d/.test(val) },
    special: { el: document.getElementById("req-special"), test: (val) => /[^A-Za-z0-9]/.test(val) }
  };

  passInput.addEventListener("focus", () => {
    reqContainer.style.display = "block";
  });

  passInput.addEventListener("input", () => {
    const val = passInput.value;
    if (!val) {
      reqContainer.style.display = "none";
      return;
    }
    reqContainer.style.display = "block";

    for (const key in reqs) {
      const rule = reqs[key];
      const passed = rule.test(val);
      if (rule.el) {
        const icon = rule.el.querySelector(".req-icon");
        if (passed) {
          rule.el.style.color = "var(--green, #22c55e)";
          if (icon) icon.innerHTML = `<i class="bi bi-check-circle-fill" style="color:var(--green)"></i>`;
        } else {
          rule.el.style.color = "var(--text-dim)";
          if (icon) icon.innerHTML = `<i class="bi bi-x-circle" style="color:var(--red)"></i>`;
        }
      }
    }
  });

  passInput.addEventListener("blur", () => {
    if (!passInput.value) {
      reqContainer.style.display = "none";
    }
  });
}

window.initPasswordStrengthChecker = initPasswordStrengthChecker;

// ═══════════════════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════════════════
function showView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
  const el = document.getElementById("view-" + name);
  if (el) el.classList.remove("hidden");
  currentView = name;
  
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".mobile-nav-item").forEach(b => b.classList.remove("active"));

  let primaryNavKey = name;
  if (name === "caseDetail" || name === "caseForm" || name === "allcases") {
    primaryNavKey = "allcases";
  } else if (name === "profileDetail" || name === "profileForm" || name === "profiles") {
    primaryNavKey = "profiles";
  } else if (name === "myprofile") {
    primaryNavKey = "myprofile";
  }

  const btn = document.querySelector(`.nav-btn[data-nav="${primaryNavKey}"]`);
  if (btn) btn.classList.add("active");
  const mBtn = document.querySelector(`.mobile-nav-item[data-nav="${primaryNavKey}"]`);
  if (mBtn) mBtn.classList.add("active");
}

function navTo(view) {
  if (currentView === "caseForm" && view !== "caseForm" && hasUnsavedCaseChanges()) {
    window.promptDiscardCase(view);
    return;
  }
  executeNavigation(view);
}

function executeNavigation(view) {
  const pd = document.getElementById("pd-search");
  const ac = document.getElementById("ac-search");
  if (pd) pd.value = "";
  if (ac) ac.value = "";
  ["pd-status","pd-category","pd-type","ac-status","ac-category","ac-type"].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = "All";
  });
  ["pd-sort","ac-sort"].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = "asc";
  });
  showView(view);
  if (view === "dashboard") renderDashboard();
  if (view === "profiles")  renderProfiles();
  if (view === "allcases")  renderAllCases();
  if (view === "myprofile") renderMyProfile();
  if (view === "calendar")  renderCalendarView();
  if (view === "notifications") renderNotificationsView();
  if (view === "mydrive") initDriveExplorer();
}

window.showView = showView;
window.navTo = navTo;
window.executeNavigation = executeNavigation;

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════════
let recentCasesExpanded = false;

window.toggleExpandRecentCases = function() {
  recentCasesExpanded = !recentCasesExpanded;
  const btn = document.getElementById("btn-toggle-expand-cases");
  if (btn) {
    btn.innerHTML = recentCasesExpanded ? `<i class="bi bi-arrows-collapse"></i> Collapse` : `<i class="bi bi-arrows-expand"></i> Expand View`;
  }
  renderDashboard();
};

function renderDashboard() {
  const todayDateEl = document.getElementById("today-date");
  if (todayDateEl) {
    todayDateEl.textContent = new Date().toLocaleDateString("en-PH",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
  }

  const userCases = getAccessibleCases();
  const u = window._currentUser || window._auth?.currentUser;
  const isAdmin = profiles.some(p => (p.ownerUid === u?.uid || (p.email && p.email.toLowerCase() === u?.email?.toLowerCase())) && p.role === "admin");

  const statProfilesCard = document.getElementById("stat-card-profiles");
  const statProfilesEl = document.getElementById("stat-profiles");
  const statTotalEl = document.getElementById("stat-total");
  const statOngoingEl = document.getElementById("stat-ongoing");
  const statCompletedEl = document.getElementById("stat-completed");

  if (statProfilesCard) {
    statProfilesCard.style.display = isAdmin ? "block" : "none";
  }
  if (statProfilesEl) statProfilesEl.textContent = profiles.length;
  if (statTotalEl) statTotalEl.textContent = userCases.length;
  if (statOngoingEl) statOngoingEl.textContent = userCases.filter(c => c.status === "On-going").length;
  if (statCompletedEl) statCompletedEl.textContent = userCases.filter(c => c.status === "Completed").length;

  renderDashProfiles();

  const dcEl = document.getElementById("dash-cases");
  if (!dcEl) return;

  const displayCases = recentCasesExpanded ? userCases : userCases.slice(0, 5);

  dcEl.innerHTML = displayCases.length === 0
    ? '<div class="empty-state"><div class="empty-state-icon" style="color:var(--gold)"><i class="bi bi-folder2-open"></i></div><div>No active cases yet.</div></div>'
    : displayCases.map(c => {
      const p = profiles.find(x => x.id === c.profileId);
      const daysLeft = c.dueDate ? Math.ceil((new Date(c.dueDate) - new Date()) / (1000 * 60 * 60 * 24)) : null;
      const urgency = daysLeft !== null
        ? (daysLeft < 0   ? {col:"var(--red)",   label:"Overdue"}
         : daysLeft === 0  ? {col:"var(--red)",   label:"Due today"}
         : daysLeft <= 7  ? {col:"var(--red)",   label:(daysLeft === 0 ? "Due today" : daysLeft + "d left")}
         : daysLeft <= 30 ? {col:"var(--amber)", label:daysLeft + "d left"}
         :                  {col:"var(--text-muted)", label:daysLeft + "d left"})
        : null;

      const categoryBadge = `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;background:rgba(201,165,92,0.12);color:var(--gold-light);border:1px solid var(--gold-border);white-space:nowrap;display:inline-block">${escHtml(c.category || "Case")}</span>`;

      return `<div class="flex-center gap-10" style="padding:11px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:9px;margin-bottom:8px;cursor:pointer;transition:all 0.2s" onclick="openCase('${c.id}')" onmouseenter="this.style.borderColor='var(--gold)'" onmouseleave="this.style.borderColor='var(--border)'">
        ${p ? avatarDiv(p.name, p.avatarColor, 30, p.photoUrl) : ""}
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(c.title)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            ${categoryBadge}
            <span>${p?.name || ""} · ${c.type || "Litigation"}</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
          ${badge(c.status, statusColor(c.status))}
          ${urgency ? '<span style="font-size:10px;font-weight:600;color:' + urgency.col + '">' + urgency.label + '</span>' : ""}
        </div>
      </div>`;
    }).join("");

  renderQuickAccess();
  if (typeof fetchAndRenderGoogleCalendarEvents === "function") {
    fetchAndRenderGoogleCalendarEvents();
  }
}

function renderDashProfiles() {
  const q = (document.getElementById("dash-profile-search")?.value || "").toLowerCase().trim();
  const dpEl = document.getElementById("dash-profiles");
  if (!dpEl) return;

  const userCases = getAccessibleCases();

  const filtered = profiles.filter(p =>
    !q || p.name.toLowerCase().includes(q) || (p.role || "").toLowerCase().includes(q)
  );

  if (profiles.length === 0) {
    dpEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon" style="color:var(--gold)"><i class="bi bi-bank"></i></div><div>No attorneys yet. Add your first attorney profile.</div></div>';
    return;
  }
  if (filtered.length === 0) {
    dpEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">No attorneys match your search.</div>';
    return;
  }

  dpEl.innerHTML = filtered.slice(0, 8).map(p => {
    const pc = userCases.filter(c => c.profileId === p.id);
    return `<div style="padding:12px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:11px;margin-bottom:10px;cursor:pointer;transition:all 0.2s" onclick="openProfile('${p.id}')" onmouseenter="this.style.borderColor='var(--gold-border)';this.style.background='var(--surface3)'" onmouseleave="this.style.borderColor='var(--border)';this.style.background='var(--surface2)'">
      <div style="display:flex;align-items:center;gap:12px">
        ${avatarDiv(p.name, p.avatarColor, 38, p.photoUrl)}
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px;color:var(--text)">${escHtml(p.name)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:1px">${escHtml(p.role || "Attorney")} · ${pc.length} case${pc.length !== 1 ? "s" : ""}</div>
        </div>
      </div>
    </div>`;
  }).join("");
}

window.renderDashboard = renderDashboard;
window.renderDashProfiles = renderDashProfiles;

// ═══════════════════════════════════════════════════════════════
//  PROFILES VIEW MODES
// ═══════════════════════════════════════════════════════════════
let profilesViewMode = localStorage.getItem("simando-profiles-view") || "tile";

window.setProfilesViewMode = function(mode) {
  profilesViewMode = mode;
  try {
    localStorage.setItem("simando-profiles-view", mode);
  } catch (e) { /* ignore */ }

  const tileBtn = document.getElementById("btn-view-tile");
  const listBtn = document.getElementById("btn-view-list");

  if (tileBtn && listBtn) {
    tileBtn.className = mode === "tile" ? "btn btn-sm btn-secondary active" : "btn btn-sm btn-ghost";
    listBtn.className = mode === "list" ? "btn btn-sm btn-secondary active" : "btn btn-sm btn-ghost";
  }

  renderProfiles();
};

function renderProfiles() {
  const u = window._currentUser;
  if (!u) return;

  const countEl = document.getElementById("profiles-count");
  if (countEl) countEl.textContent = `${profiles.length} profile${profiles.length !== 1 ? "s" : ""} total`;

  const el = document.getElementById("profiles-grid");
  if (!el) return;

  const userCases = getAccessibleCases();

  if (profiles.length === 0) {
    el.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon" style="color:var(--gold)"><i class="bi bi-people"></i></div><div style="font-size:13px;color:var(--text-muted)">No associate attorneys are currently registered.</div></div>`;
    return;
  }

  if (profilesViewMode === "list") {
    el.style.display = "flex";
    el.style.flexDirection = "column";
    el.style.gap = "8px";

    el.innerHTML = profiles.map(p => {
      const pc = userCases.filter(c => c.profileId === p.id);
      const ongoing = pc.filter(c => c.status === "On-going").length;
      const isMe = p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase());

      return `
        <div class="profile-list-row" onclick="openProfile('${p.id}')" style="${isMe ? 'border-color:var(--gold-border); background:rgba(201,165,92,0.03)' : ''}">
          <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:0">
            ${avatarDiv(p.name, p.avatarColor, 38, p.photoUrl)}
            <div style="min-width:0">
              <div style="font-weight:700;font-size:14.5px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                ${escHtml(p.name)} ${isMe ? '<span style="font-size:9.5px;color:var(--gold);background:rgba(201,168,76,0.12);padding:1px 5px;border-radius:4px;margin-left:6px;font-weight:700">YOU</span>' : ""}
              </div>
              <div style="font-size:12px;color:var(--text-muted)">${escHtml(p.role || "Attorney")} · ${escHtml(p.email || "No email")}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;flex-shrink:0">
            <span style="font-size:12px;color:var(--text-dim)">${pc.length} case${pc.length !== 1 ? 's' : ''}</span>
            ${ongoing > 0 ? badge(ongoing + " active", statusColor("On-going")) : ""}
            <span style="font-size:14px;color:var(--gold)"><i class="bi bi-arrow-right"></i></span>
          </div>
        </div>
      `;
    }).join("");
  } else {
    el.style.display = "grid";
    el.style.gridTemplateColumns = "repeat(auto-fill, minmax(280px, 1fr))";
    el.style.gap = "20px";

    el.innerHTML = profiles.map(p => {
      const pc = userCases.filter(c => c.profileId === p.id);
      const ongoing = pc.filter(c => c.status === "On-going").length;
      const isMe = p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase());
      
      return `
        <div class="profile-card" onclick="openProfile('${p.id}')" style="${isMe ? 'border-color:var(--gold-border); background:rgba(201,165,92,0.03)' : ''}">
          <div class="flex-center gap-14 mb-16">
            ${avatarDiv(p.name, p.avatarColor, 50, p.photoUrl)}
            <div>
              <div style="font-weight:700;font-size:16px;color:var(--text)">
                ${escHtml(p.name)} ${isMe ? '<span style="font-size:10px;color:var(--gold);background:rgba(201,168,76,0.1);padding:2px 6px;border-radius:4px;margin-left:6px;font-weight:600">YOU</span>' : ""}
              </div>
              <div style="font-size:13px;color:var(--text-muted)">${escHtml(p.role || "Attorney")}</div>
            </div>
          </div>
          <hr class="divider"/>
          ${p.email ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:5px"><i class="bi bi-envelope-fill" style="color:var(--gold);margin-right:6px"></i>${escHtml(p.email)}</div>` : ""}
          ${p.contact ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:12px"><i class="bi bi-telephone-fill" style="color:var(--gold);margin-right:6px"></i>${escHtml(p.contact)}</div>` : ""}
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:13px;color:var(--text-dim)">Cases Accessible (${pc.length})</span>
            ${ongoing > 0 ? badge(ongoing + " active", statusColor("On-going")) : ""}
          </div>
        </div>
      `;
    }).join("");
  }
}

window.renderProfiles = renderProfiles;

// ═══════════════════════════════════════════════════════════════
//  PROFILE DETAIL
// ═══════════════════════════════════════════════════════════════
function renderProfileDetail() {
  const p = selProfile;
  if (!p) return;

  const currentUid = window._currentUser?.uid;
  const isOwner = p.ownerUid === currentUid;

  let actionButtons = "";
  let driveChip = "";

  if (isOwner) {
    driveChip = p.driveFolderId
      ? `<a href="https://drive.google.com/drive/folders/${p.driveFolderId}" target="_blank" style="font-size:12px;color:var(--green);display:inline-flex;align-items:center;gap:6px;text-decoration:none;font-weight:500;padding:4px 10px;background:rgba(34,197,94,0.08);border-radius:6px;border:1px solid rgba(34,197,94,0.2)" title="Open Drive Folder"><i class="bi bi-google"></i> Drive Folder <i class="bi bi-arrow-right"></i></a>`
      : (accessToken
          ? `<button onclick="createProfileFolderManual()" style="background:transparent;border:1px solid var(--amber);color:var(--amber);font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-weight:500;padding:4px 10px;border-radius:6px;transition:all 0.2s"><i class="bi bi-folder-plus"></i> Create Drive Folder</button>`
          : `<span style="font-size:12px;color:var(--text-dim);display:inline-flex;align-items:center;gap:6px"><i class="bi bi-cloud-slash"></i> Drive not connected</span>`);

    actionButtons = `
      <button class="btn btn-secondary btn-sm" onclick="openEditProfile()"><i class="bi bi-pencil-square"></i> Edit</button>
      <button class="btn btn-danger btn-sm" onclick="confirmDeleteProfile()"><i class="bi bi-trash3"></i> Delete</button>
      <button class="btn btn-primary btn-sm" onclick="openAddCase()"><i class="bi bi-plus-circle"></i> Add Case</button>
    `;
  } else {
    driveChip = `<span style="font-size:12px;color:var(--text-dim)"><i class="bi bi-shield-lock"></i> Files Protected</span>`;
    actionButtons = `
      <button class="btn btn-primary btn-sm" onclick="openAppointmentModal('${p.id}')"><i class="bi bi-calendar-plus"></i> Request Schedule</button>
    `;
  }

  const headerCard = document.getElementById("profile-header-card");
  if (headerCard) {
    headerCard.innerHTML = `
      ${avatarDiv(p.name, p.avatarColor, 64, p.photoUrl)}
      <div style="flex:1">
        <div style="font-size:24px;font-weight:700;color:var(--text)">${escHtml(p.name)}</div>
        <div style="font-size:14px;color:var(--text-muted);margin-top:3px">${escHtml(p.role || "Attorney")}</div>
        <div style="display:flex;gap:18px;margin-top:10px;flex-wrap:wrap;align-items:center">
          ${p.email ? `<span style="font-size:12px;color:var(--text-muted)"><i class="bi bi-envelope-fill" style="color:var(--gold);margin-right:4px"></i>${escHtml(p.email)}</span>` : ""}
          ${p.contact ? `<span style="font-size:12px;color:var(--text-muted)"><i class="bi bi-telephone-fill" style="color:var(--gold);margin-right:4px"></i>${escHtml(p.contact)}</span>` : ""}
          <span style="font-size:12px;color:var(--text-dim)"><i class="bi bi-calendar-check" style="color:var(--gold);margin-right:4px"></i>Since ${p.createdAt || formatDate(new Date().toISOString())}</span>
          ${driveChip}
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${actionButtons}
      </div>
    `;
  }

  const noticeEl = document.getElementById("profile-restricted-notice");
  const sectionEl = document.getElementById("profile-cases-section");
  const statsEl = document.getElementById("profile-stats-row");

  const pc = getAccessibleCases().filter(c => c.profileId === p.id);

  if (isOwner || pc.length > 0) {
    if (noticeEl) noticeEl.style.display = "none";
    if (sectionEl) sectionEl.style.display = "block";
    if (statsEl) {
      statsEl.style.display = "grid";
      const docs = pc.reduce((a, c) => a + (c.documents?.length || 0), 0);

      statsEl.innerHTML = [
        ["Accessible Cases", pc.length, "var(--violet)"],
        ["Active", pc.filter(c => c.status === "On-going").length, "var(--amber)"],
        ["Resolved", pc.filter(c => c.status === "Completed").length, "var(--green)"],
        ["Documents", docs, "var(--gold)"]
      ].map(([l, n, c]) => `
        <div class="stat-card" style="--accent:${c};padding:16px 18px">
          <div class="stat-number" style="color:${c};font-size:32px">${n}</div>
          <div class="stat-label">${l}</div>
        </div>`).join("");
    }

    updateAllFilterDropdowns(); 
    renderProfileCases();
  } else {
    if (noticeEl) noticeEl.style.display = "block";
    if (sectionEl) sectionEl.style.display = "none";
    if (statsEl) statsEl.style.display = "none";
  }
}

function renderProfileCases() {
  const p = selProfile;
  if (!p) return;
  const q        = (document.getElementById("pd-search")?.value || "").toLowerCase();
  const status   = document.getElementById("pd-status")?.value || "All";
  const category = document.getElementById("pd-category")?.value || "All";
  const type     = document.getElementById("pd-type")?.value || "All";
  const sort     = document.getElementById("pd-sort")?.value || "asc";

  const pc = getAccessibleCases().filter(c => c.profileId === p.id);

  let filtered = pc.filter(c =>
    (c.title.toLowerCase().includes(q) || (c.parties || "").toLowerCase().includes(q) || (c.caseNumber || "").toLowerCase().includes(q)) &&
    (status === "All" || c.status === status) &&
    (category === "All" || c.category === category) &&
    (type === "All" || c.type === type)
  );
  filtered = sortCasesByDue(filtered, sort);

  const el = document.getElementById("profile-cases-list");
  if (!el) return;

  if (filtered.length === 0) {
    el.innerHTML = `<div class="empty-state">${pc.length === 0
      ? '<div class="empty-state-icon" style="color:var(--gold)"><i class="bi bi-bank"></i></div><div>No accessible cases yet</div>'
      : '<div class="empty-state-icon" style="color:var(--gold)"><i class="bi bi-search"></i></div><div>No cases match your filters.</div>'
    }</div>`;
    return;
  }
  el.innerHTML = filtered.map(c => `
    <div class="case-row" onclick="openCase('${c.id}')">
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:15px;color:var(--text);margin-bottom:4px">${escHtml(c.title)}</div>
        <div style="font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span style="font-size:9.5px;font-weight:700;padding:2px 6px;border-radius:4px;background:rgba(201,165,92,0.12);color:var(--gold-light);border:1px solid var(--gold-border)">${escHtml(c.category || "Case")}</span>
          <span>${c.type || "Litigation"} · ${c.venue || "No Venue"}</span>
        </div>
        <div style="font-size:13px;color:var(--text-dim);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(c.parties || "")}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">
        ${badge(c.status, statusColor(c.status))}
        ${dueBadge(c.dueDate)}
      </div>
    </div>`).join("");
}

window.renderProfileDetail = renderProfileDetail;
window.renderProfileCases = renderProfileCases;

// ═══════════════════════════════════════════════════════════════
//  ALL CASES VIEW
// ═══════════════════════════════════════════════════════════════
function renderAllCases() {
  updateAllFilterDropdowns(); 
  const q        = (document.getElementById("ac-search")?.value || "").toLowerCase().trim();
  const status   = document.getElementById("ac-status")?.value || "All";
  const category = document.getElementById("ac-category")?.value || "All";
  const type     = document.getElementById("ac-type")?.value || "All";
  const sort     = document.getElementById("ac-sort")?.value || "asc";

  const accessible = getAccessibleCases();

  let filtered = accessible.filter(c => {
    const p = profiles.find(x => x.id === c.profileId);
    const attorneyName = (p?.name || "").toLowerCase();
    const caseTitle = (c.title || "").toLowerCase();
    const parties = (c.parties || "").toLowerCase();
    const caseNumber = (c.caseNumber || "").toLowerCase();

    const matchesQuery = !q || 
      caseTitle.includes(q) || 
      attorneyName.includes(q) || 
      parties.includes(q) || 
      caseNumber.includes(q);

    return matchesQuery &&
      (status === "All" || c.status === status) &&
      (category === "All" || c.category === category) &&
      (type === "All" || c.type === type);
  });
  filtered = sortCasesByDue(filtered, sort);

  const countEl = document.getElementById("allcases-count");
  if (countEl) countEl.textContent = `${filtered.length} accessible case${filtered.length !== 1 ? "s" : ""} found`;

  const el = document.getElementById("all-cases-list");
  if (!el) return;

  if (filtered.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon" style="color:var(--gold)"><i class="bi bi-search"></i></div><div>No cases match your access permissions or filters.</div></div>';
    return;
  }
  el.innerHTML = filtered.map(c => {
    const p = profiles.find(x => x.id === c.profileId);
    return `<div class="case-row" onclick="openCase('${c.id}')">
      ${p ? avatarDiv(p.name, p.avatarColor, 40, p.photoUrl) : ""}
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:15px;color:var(--text);margin-bottom:4px">${escHtml(c.title)}</div>
        <div style="font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span style="font-size:9.5px;font-weight:700;padding:2px 6px;border-radius:4px;background:rgba(201,165,92,0.12);color:var(--gold-light);border:1px solid var(--gold-border)">${escHtml(c.category || "Case")}</span>
          <span>${p?.name || ""} · ${c.type || "Litigation"} · ${c.venue || "No Venue"}</span>
        </div>
        <div style="font-size:13px;color:var(--text-dim);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(c.parties || "")}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">
        ${badge(c.status, statusColor(c.status))}
        ${dueBadge(c.dueDate)}
      </div>
    </div>`;
  }).join("");
}

window.renderAllCases = renderAllCases;

// ═══════════════════════════════════════════════════════════════
//  CASE DETAIL
// ═══════════════════════════════════════════════════════════════
function renderCaseDetail() {
  const c = selCase;
  if (!c) return;

  const p = profiles.find(x => x.id === c.profileId);

  const titleEl = document.getElementById("cd-title");
  if (titleEl) titleEl.textContent = c.title;

  const currentUid = window._currentUser?.uid;
  const isOwner = c.ownerUid === currentUid;
  const isGroupAdmin = profiles.some(p => p.ownerUid === currentUid && p.role === "admin");
  const userPerm = isOwner || isGroupAdmin 
    ? "owner" 
    : ((c.permissions && c.permissions[currentUid]) || (c.sharedWith?.includes(currentUid) ? "viewer" : "none"));

  const canEdit = isOwner || isGroupAdmin || userPerm === "editor";
  const canShare = isOwner || isGroupAdmin;
  const canDelete = isOwner || isGroupAdmin;

  let actionButtons = "";
  if (canEdit) actionButtons += `<button class="btn btn-secondary btn-sm" onclick="openEditCase()"><i class="bi bi-pencil-square"></i> Edit</button>`;
  if (canShare) actionButtons += `<button class="btn btn-secondary btn-sm" onclick="openShareCaseModal()"><i class="bi bi-people"></i> Share</button>`;
  if (canDelete) actionButtons += `<button class="btn btn-danger btn-sm" onclick="confirmDeleteCase()"><i class="bi bi-trash3"></i> Delete</button>`;
  if (userPerm === "viewer") actionButtons += `<span class="badge" style="background:rgba(129,140,248,0.15);color:#818cf8;padding:6px 12px;font-size:12px"><i class="bi bi-eye-fill"></i> Viewer Access</span>`;

  const wrapEl = document.getElementById("cd-action-buttons-wrap");
  if (wrapEl) wrapEl.innerHTML = actionButtons;

  const backBtn = document.getElementById("cd-back-btn");
  if (backBtn) {
    backBtn.onclick = window.handleCaseDetailBack;
  }

  const chip = document.getElementById("cd-profile-chip");
  if (chip) {
    if (p) {
      chip.innerHTML = `${avatarDiv(p.name, p.avatarColor, 28, p.photoUrl)}<div><div style="font-size:14px;font-weight:600;color:var(--text)">${escHtml(p.name)}</div><div style="font-size:12px;color:var(--text-muted)">${escHtml(p.role || "Attorney")}</div></div><span style="font-size:12px;color:var(--text-dim);margin-left:8px"><i class="bi bi-arrow-right"></i> view profile</span>`;
      chip.style.display = "inline-flex";
    } else {
      chip.style.display = "none";
    }
  }

  const infoEl = document.getElementById("cd-info");
  if (infoEl) {
    infoEl.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        ${badge(c.status, statusColor(c.status))} ${badge(c.category || "Case", "#c9a55c")} ${badge(c.type || "Litigation", "#6366f1")}
      </div>
      <hr class="divider"/>
      ${[
        ["Parties Involved", c.parties || "None"],
        ["Venue / Court", c.venue || "N/A"],
        ["Date Case Filed", formatDate(c.filedDate)],
        ["Case / Docket Number", c.caseNumber || "Not indicated"],
        ["Date Added", c.createdAt || "N/A"]
      ].map(([l, v]) => `
        <div style="margin-bottom:16px">
          <div style="font-size:11px;color:var(--text-dim);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px;font-weight:600">${l}</div>
          <div style="font-size:14px;color:var(--text)">${escHtml(v)}</div>
        </div>`).join("")}
      <div>
        <div style="font-size:11px;color:var(--text-dim);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;font-weight:600">Case Narrative</div>
        <div style="font-size:14px;color:var(--text-muted);line-height:1.8">${escHtml(c.narrative || "")}</div>
      </div>`;
  }

  const hearingsEl = document.getElementById("cd-hearings");
  if (hearingsEl) {
    const hearingsList = Array.isArray(c.hearings) ? c.hearings : [];
    const todayStr = new Date().toISOString().split("T")[0];
    const sorted = [...hearingsList].sort((a, b) => new Date(a.date) - new Date(b.date));

    let hHtml = `
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">
        <span style="display:flex;align-items:center;gap:6px"><i class="bi bi-bank" style="color:var(--gold)"></i> Court Hearings &amp; History (${sorted.length})</span>
      </div>
    `;

    if (sorted.length === 0) {
      hHtml += `<div style="font-size:12px;color:var(--text-muted);padding:10px 0">No court appearances on record.</div>`;
    } else {
      hHtml += `<div style="display:flex;flex-direction:column;gap:8px">`;
      sorted.forEach(h => {
        const isPast = h.date < todayStr;
        const badgeMarkup = isPast
          ? `<span class="badge" style="background:rgba(255,255,200,0.06);color:var(--text-dim);font-size:9.5px"><i class="bi bi-clock-history"></i> Past Hearing</span>`
          : `<span class="badge" style="background:rgba(52,211,153,0.15);color:var(--green);font-size:9.5px"><i class="bi bi-calendar-event"></i> Upcoming Hearing</span>`;

        hHtml += `
          <div style="padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-left:4px solid ${isPast ? 'var(--text-dim)' : 'var(--green)'};border-radius:8px">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;flex-wrap:wrap">
              ${badgeMarkup}
              <span style="font-weight:700;font-size:12.5px;color:var(--text)">${formatDate(h.date)}</span>
              ${h.time ? `<span style="font-size:11px;color:var(--text-muted)"><i class="bi bi-clock"></i> ${h.time}</span>` : ''}
            </div>
            <div style="font-size:12.5px;font-weight:600;color:var(--gold-light)">${escHtml(h.purpose)}</div>
            ${h.notes ? `<div style="font-size:11.5px;color:var(--text-dim);margin-top:2px;font-style:italic">"${escHtml(h.notes)}"</div>` : ''}
          </div>
        `;
      });
      hHtml += `</div>`;
    }

    if (c.docDueDate) {
      hHtml += `
        <div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-size:10.5px;color:var(--text-dim);text-transform:uppercase;font-weight:700">Pleading Due Date</div>
            <div style="font-size:12.5px;color:var(--gold-light);font-weight:600">${formatDate(c.docDueDate)} ${c.docType ? `(${escHtml(c.docType)})` : ''}</div>
          </div>
          ${dueBadge(c.docDueDate)}
        </div>
      `;
    }

    hearingsEl.innerHTML = hHtml;
  }

  const docs = c.documents || [];
  let docsHtml = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:12px">
    <div style="font-size:15px;font-weight:700;color:var(--text)">Case Files</div>
    ${canEdit ? `
      <div style="display:inline-flex;align-items:center;gap:10px">
        <div style="display:inline-flex;align-items:center;gap:8px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:3px 10px">
          <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text);cursor:pointer;margin:0">
            <input type="radio" name="cd-file-type" value="Inbound" checked style="accent-color:var(--gold);margin:0"/> <i class="bi bi-box-arrow-in-down" style="color:var(--green)"></i> In
          </label>
          <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text);cursor:pointer;margin:0">
            <input type="radio" name="cd-file-type" value="Outbound" style="accent-color:var(--gold);margin:0"/> <i class="bi bi-box-arrow-up" style="color:var(--violet)"></i> Out
          </label>
        </div>
        <button class="btn btn-primary btn-sm" onclick="addDocToCase()"><i class="bi bi-cloud-arrow-up"></i> Upload Document</button>
      </div>` : `<span style="font-size:11px;color:var(--text-dim)"><i class="bi bi-shield-lock"></i> Protected File Repository</span>`
    }
  </div>`;

  if (docs.length === 0) {
    docsHtml += `<div class="upload-area" ${canEdit ? 'onclick="addDocToCase()"' : ''}><div style="font-size:26px;margin-bottom:4px;color:var(--gold)"><i class="bi bi-paperclip"></i></div><div>${canEdit ? 'Click to attach a document' : 'No document records uploaded'}</div></div>`;
  } else {
    const inboundDocs = docs.filter(d => d.fileType === "Inbound");
    const outboundDocs = docs.filter(d => d.fileType === "Outbound");
    const otherDocs = docs.filter(d => d.fileType !== "Inbound" && d.fileType !== "Outbound");

    const renderDocRow = (doc) => {
      const realIdx = docs.findIndex(x => x === doc || (x.driveFileId && x.driveFileId === doc.driveFileId && x.name === doc.name));
      const fileIcon = doc.name.toLowerCase().endsWith(".pdf") 
        ? `<i class="bi bi-file-earmark-pdf-fill" style="color:var(--red);margin-right:6px"></i>`
        : `<i class="bi bi-file-earmark-text-fill" style="color:var(--gold);margin-right:6px"></i>`;

      return `
        <div class="doc-item" style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%">
            <div>
              <div style="font-size:13px;color:var(--text);font-weight:600">
                <span onclick='openFilePreview(${JSON.stringify(doc).replace(/'/g, "&#39;")})' style="cursor:pointer;color:var(--gold);text-decoration:underline;text-underline-offset:3px">
                  ${fileIcon}${escHtml(doc.name)}
                </span>
              </div>
              <div style="font-size:12px;color:var(--text-muted)">
                ${doc.size} · ${doc.date}${doc.driveFileId ? ` · <span style="color:var(--green)"><i class="bi bi-check-circle-fill"></i> Drive</span>` : ""}
              </div>
            </div>
            ${canEdit ? `<button style="background:transparent;border:none;color:var(--red);font-size:15px;cursor:pointer;padding:2px 10px;flex-shrink:0" onclick="removeDocFromCase(${realIdx})" title="Delete File"><i class="bi bi-trash3-fill"></i></button>` : ""}
          </div>
        </div>
      `;
    };

    if (inboundDocs.length > 0) {
      docsHtml += `<div style="font-size:11px;font-weight:700;color:var(--text-dim);margin:14px 0 6px;text-transform:uppercase;letter-spacing:1px"><i class="bi bi-box-arrow-in-down" style="color:var(--green)"></i> Inbound Documents</div>`;
      inboundDocs.forEach(d => { docsHtml += renderDocRow(d); });
    }

    if (outboundDocs.length > 0) {
      docsHtml += `<div style="font-size:11px;font-weight:700;color:var(--text-dim);margin:14px 0 6px;text-transform:uppercase;letter-spacing:1px"><i class="bi bi-box-arrow-up" style="color:var(--violet)"></i> Outbound Documents</div>`;
      outboundDocs.forEach(d => { docsHtml += renderDocRow(d); });
    }

    if (otherDocs.length > 0) {
      docsHtml += `<div style="font-size:11px;font-weight:700;color:var(--text-dim);margin:14px 0 6px;text-transform:uppercase;letter-spacing:1px"><i class="bi bi-files" style="color:var(--gold)"></i> Other Files</div>`;
      otherDocs.forEach(d => { docsHtml += renderDocRow(d); });
    }
  }
  
  const docsEl = document.getElementById("cd-docs");
  if (docsEl) docsEl.innerHTML = docsHtml;

  const statusPanelEl = document.getElementById("cd-status-panel");
  if (statusPanelEl) {
    if (canEdit) {
      statusPanelEl.innerHTML = `
        <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:14px">Update Status</div>
        ${STATUS_OPTIONS.map(st => `
          <button onclick="confirmUpdateCaseStatus('${st}')" style="display:block;width:100%;margin-bottom:8px;padding:10px 16px;border-radius:10px;border:1px solid ${c.status === st ? statusColor(st) : "var(--border)"};background:${c.status === st ? statusColor(st) + "18" : "transparent"};color:${c.status === st ? statusColor(st) : "var(--text)"};text-align:left;cursor:pointer;font-size:13px;font-family:var(--font-body);font-weight:${c.status === st ? 700 : 500};transition:all 0.2s">
            ${c.status === st ? '<i class="bi bi-check-lg" style="margin-right:6px"></i>' : ""}${st}
          </button>`).join("")}`;
    } else {
      statusPanelEl.innerHTML = `
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:10px">Current Status</div>
        ${badge(c.status, statusColor(c.status))}
        <div style="font-size:11.5px;color:var(--text-muted);margin-top:8px">You have Viewer access for this case. Status modifications are restricted to Editors &amp; Owners.</div>
      `;
    }
  }
}

// 1. BRANDED CASE STATUS CONFIRMATION
window.confirmUpdateCaseStatus = function(st) {
  if (!selCase || selCase.status === st) return;

  window.openConfirmModal({
    icon: "bi-arrow-repeat",
    title: "Update Case Status?",
    body: `Are you sure you want to update the status of <strong>"${escHtml(selCase.title)}"</strong> to <strong style="color:${statusColor(st)}">"${st}"</strong>?`,
    confirmText: "Update Status",
    confirmStyle: "btn-primary",
    onConfirm: () => updateCaseStatus(st)
  });
};

async function updateCaseStatus(st) {
  try {
    const upd = { ...selCase, status: st };
    await dbUpdateCase(selCase.id, { status: st });
    selCase = upd;
    renderCaseDetail();
    showToast(`Status updated to "${st}"`);
  } catch (err) {
    console.error("updateCaseStatus error:", err);
    showToast("Failed to update status: " + (err.message || "Unknown error"), "error");
  }
}

// 2. BRANDED CASE DOCUMENT DELETION CONFIRMATION
async function removeDocFromCase(idx) {
  const docs = selCase.documents || [];
  const doc = docs[idx];
  if (!doc) return;

  window.openConfirmModal({
    icon: "bi-trash3",
    title: "Delete Case Document?",
    body: `Are you sure you want to delete <strong>"${escHtml(doc.name)}"</strong>?<br>This will permanently remove the document from this case and Google Drive.`,
    confirmText: "Delete Document",
    confirmStyle: "btn-danger",
    onConfirm: async () => {
      try {
        showToast("Deleting file...");
        if (doc.driveFileId && typeof deleteDriveFile === "function") {
          await deleteDriveFile(doc.driveFileId);
        }
        const updDocs = docs.filter((_, i) => i !== idx);
        await dbUpdateCase(selCase.id, { documents: updDocs });
        selCase = { ...selCase, documents: updDocs };
        renderCaseDetail();
        showToast("Document deleted successfully!");
      } catch (err) {
        console.error("removeDocFromCase error:", err);
        showToast("Failed to remove document: " + (err.message || "Unknown error"), "error");
      }
    }
  });
}

window.renderCaseDetail = renderCaseDetail;

// ═══════════════════════════════════════════════════════════════
//  QUICK ACCESS SIDEBAR
// ═══════════════════════════════════════════════════════════════
function renderQuickAccess() {
  const qa = document.getElementById("quick-access");
  const ql = document.getElementById("quick-list");
  if (!qa || !ql) return;
  
  if (profiles.length === 0) { qa.style.display = "none"; return; }
  qa.style.display = "block";
  ql.innerHTML = profiles.slice(0, 7).map(p => `
    <button class="nav-btn ${selProfile?.id === p.id ? 'active' : ''}" style="gap:10px;padding:10px 24px" onclick="openProfile('${p.id}')">
      ${p.photoUrl
        ? `<img src="${p.photoUrl}" alt="${initials(p.name)}" class="quick-avatar" style="object-fit:cover;border:2px solid ${p.avatarColor || '#c9a84c'}">`
        : `<span class="quick-avatar" style="background:${p.avatarColor}22;border:2px solid ${p.avatarColor};color:${p.avatarColor}">${initials(p.name)}</span>`
      }
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px">${escHtml(p.name)}</span>
    </button>`).join("");
}

function openProfile(id) {
  selProfile = profiles.find(p => p.id === id);
  if (!selProfile) return;
  showView("profileDetail");
  renderProfileDetail();
}

function openCase(id) {
  caseDetailOrigin = currentView;
  selCase = cases.find(c => c.id === id);
  if (!selCase) return;
  const p = profiles.find(x => x.id === selCase.profileId);
  if (p) selProfile = p;
  showView("caseDetail");
  renderCaseDetail();
}

window.openProfile = openProfile;
window.openCase = openCase;

function renderSidebarUser() {
  const chip = document.getElementById("sidebar-user-chip");
  const adminSection = document.getElementById("admin-sidebar-section");
  if (!chip) return;

  const u = window._currentUser;
  if (!u) {
    chip.style.display = "none";
    if (adminSection) adminSection.style.display = "none";
    return;
  }

  const myProf = profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase()));
  if (!myProf) {
    chip.style.display = "none";
    if (adminSection) adminSection.style.display = "none";
    return;
  }

  chip.innerHTML = `
    ${avatarDiv(myProf.name, myProf.avatarColor, 28, myProf.photoUrl)}
    <div style="flex:1;min-width:0;text-align:left">
      <div class="sidebar-user-name" style="font-size:12px;font-weight:700;color:#ffffff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(myProf.name)}</div>
      <div class="sidebar-user-role" style="font-size:10px;color:var(--gold);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(myProf.role || "Attorney")}</div>
    </div>
  `;
  chip.style.display = "flex";

  const isAdmin = myProf.role === "admin" || (typeof ADMIN_EMAILS !== "undefined" && ADMIN_EMAILS.some(e => e.toLowerCase() === (u.email||"").toLowerCase()));

  if (adminSection) {
    adminSection.style.display = isAdmin ? "block" : "none";
  }
}

window.renderSidebarUser = renderSidebarUser;

function openCurrentProfile() {
  if (selProfile) openProfile(selProfile.id);
}
window.openCurrentProfile = openCurrentProfile;

function sortCasesByDue(arr, dir) {
  if (dir === "none") return arr;
  return [...arr].sort((a, b) => {
    const da = a.dueDate ? new Date(a.dueDate) : null;
    const db = b.dueDate ? new Date(b.dueDate) : null;
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return dir === "asc" ? da - db : db - da;
  });
}

function dueBadge(dueDate) {
  if (!dueDate) return '<span style="font-size:11px;color:var(--text-dim)">No due date</span>';
  const days = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
  const formatted = formatDate(dueDate);
  if (days < 0)   return `<span style="font-size:11px;font-weight:700;color:var(--red)"><i class="bi bi-exclamation-circle-fill" style="margin-right:3px"></i>Overdue (${formatted})</span>`;
  if (days === 0) return `<span style="font-size:11px;font-weight:700;color:var(--red)"><i class="bi bi-exclamation-circle-fill" style="margin-right:3px"></i>Due today</span>`;
  if (days <= 7)  return `<span style="font-size:11px;font-weight:700;color:var(--amber)">${days}d left (${formatted})</span>`;
  if (days <= 30) return `<span style="font-size:11px;font-weight:600;color:var(--gold)">${days}d (${formatted})</span>`;
  return `<span style="font-size:11px;color:var(--text-muted)">Due ${formatted}</span>`;
}

// ═══════════════════════════════════════════════════════════════
//  FILTER DROPDOWNS
// ═══════════════════════════════════════════════════════════════
function updateAllFilterDropdowns() {
  ["pd", "ac"].forEach(prefix => {
    const statusSel = document.getElementById(prefix + "-status");
    const catSel = document.getElementById(prefix + "-category");
    if (!statusSel || !catSel) return;

    const curStatus = statusSel.value;
    const curCat = catSel.value;

    statusSel.innerHTML = `<option value="All">All Statuses</option>` + 
      STATUS_OPTIONS.map(s => `<option value="${s}">${s}</option>`).join("");
    statusSel.value = curStatus || "All";

    catSel.innerHTML = `<option value="All">All Categories</option>` + 
      CASE_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("");
    catSel.value = curCat || "All";

    refreshFilterTypes(prefix);
  });
}

function refreshFilterTypes(prefix) {
  const catSel = document.getElementById(prefix + "-category");
  const typeSel = document.getElementById(prefix + "-type");
  if (!catSel || !typeSel) return;

  const selectedCat = catSel.value;
  const curType = typeSel.value;

  let filteredTypes = [];
  if (selectedCat === "All") {
    filteredTypes = globalCaseTypes.map(t => t.name);
  } else {
    filteredTypes = globalCaseTypes
      .filter(t => t.category === selectedCat)
      .map(t => t.name);
  }

  const distinctTypes = [...new Set(filteredTypes)].sort();

  typeSel.innerHTML = `<option value="All">All Types</option>` + 
    distinctTypes.map(t => `<option value="${t}">${t}</option>`).join("");
  
  if (distinctTypes.includes(curType)) {
    typeSel.value = curType;
  } else {
    typeSel.value = "All";
  }
}

function onFilterCategoryChange(prefix) {
  refreshFilterTypes(prefix);
  if (prefix === "pd") renderProfileCases();
  if (prefix === "ac") renderAllCases();
}

window.updateAllFilterDropdowns = updateAllFilterDropdowns;
window.refreshFilterTypes = refreshFilterTypes;
window.onFilterCategoryChange = onFilterCategoryChange;

// ═══════════════════════════════════════════════════════════════
//  CALENDAR MONTH VIEW
// ═══════════════════════════════════════════════════════════════
let currentCalYear = new Date().getFullYear();
let currentCalMonth = new Date().getMonth();

function renderCalendarView() {
  const select = document.getElementById("calendar-filter-select");
  if (select) {
    const curVal = select.value;
    
    let optionsHtml = `<option value="Everyone">Everyone (Firm Overview)</option>`;
    
    profiles.forEach(p => {
      const designation = p.role ? ` (${p.role})` : "";
      optionsHtml += `<option value="${p.ownerUid}">${p.name}${designation}</option>`;
    });

    select.innerHTML = optionsHtml;
    select.value = curVal || "Everyone";
  }

  renderMonthlyCalendarGrid();
}

function prevCalMonth() {
  currentCalMonth--;
  if (currentCalMonth < 0) {
    currentCalMonth = 11;
    currentCalYear--;
  }
  renderMonthlyCalendarGrid();
}

function nextCalMonth() {
  currentCalMonth++;
  if (currentCalMonth > 11) {
    currentCalMonth = 0;
    currentCalYear++;
  }
  renderMonthlyCalendarGrid();
}

function todayCalMonth() {
  const now = new Date();
  modalCalYear = now.getFullYear();
  modalCalMonth = now.getMonth();
  renderMonthlyCalendarGrid();
}

window.renderCalendarView = renderCalendarView;
window.prevCalMonth = prevCalMonth;
window.nextCalMonth = nextCalMonth;
window.todayCalMonth = todayCalMonth;

function renderMonthlyCalendarGrid() {
  const titleEl = document.getElementById("cal-month-title");
  const gridEl = document.getElementById("calendar-grid-container");
  if (!gridEl) return;

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  if (titleEl) {
    titleEl.textContent = `${monthNames[currentCalMonth]} ${currentCalYear}`;
  }

  const filter = document.getElementById("calendar-filter-select")?.value || "Everyone";

  let activeCases = getAccessibleCases().filter(c => c.dueDate || (Array.isArray(c.hearings) && c.hearings.length > 0));
  let activeAppts = appointments.filter(a => a.status === "accepted");

  if (filter !== "Everyone") {
    const matchedProf = profiles.find(p => p.ownerUid === filter);
    activeCases = activeCases.filter(c => c.profileId === matchedProf?.id);
    activeAppts = activeAppts.filter(a => a.targetUid === filter || a.requesterUid === filter);
  }

  const eventsByDate = {};
  activeCases.forEach(c => {
    if (c.dueDate) {
      if (!eventsBy
