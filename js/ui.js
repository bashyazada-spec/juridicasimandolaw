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
//  SYSTEM HEALTH & DIAGNOSTIC ENGINE
// ═══════════════════════════════════════════════════════════════
let systemHealthStatus = "healthy"; // "healthy" | "warning" | "danger"

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
      netBadge.textContent = "Online";
      netSub.textContent = "Active internet connection detected";
    } else {
      netBadge.className = "badge badge-fail";
      netBadge.textContent = "Offline";
      netSub.textContent = "No network connection. Offline changes won't sync.";
    }
  }

  // 2. Database Sync
  if (dbBadge && dbSub) {
    if (isDbOk) {
      dbBadge.className = "badge badge-pass";
      dbBadge.textContent = "Connected";
      dbSub.textContent = "Firestore real-time listeners synchronized (Long Polling)";
    } else if (localMode) {
      dbBadge.className = "badge badge-warn";
      dbBadge.textContent = "Memory Mode";
      dbSub.textContent = "Running in memory. Data will not persist on refresh.";
    } else {
      dbBadge.className = "badge badge-fail";
      dbBadge.textContent = "Connecting...";
      dbSub.textContent = "Waiting for cloud database handshake.";
    }
  }

  // 3. Google Drive
  if (driveBadge && driveSub) {
    if (isDriveOk && hasDriveFolder) {
      driveBadge.className = "badge badge-pass";
      driveBadge.textContent = "Linked";
      driveSub.textContent = "OAuth active · Dedicated firm storage folder verified";
    } else if (isDriveOk && !hasDriveFolder) {
      driveBadge.className = "badge badge-warn";
      driveBadge.textContent = "No Folder";
      driveSub.textContent = "Drive connected but no root case folder created yet.";
    } else {
      driveBadge.className = "badge badge-warn";
      driveBadge.textContent = "Not Connected";
      driveSub.textContent = "Connect Google Account under My Settings to enable filing & docs.";
    }
  }

  // Overall workspace assessment
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

// Run automated health check every 25 seconds
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

window.openConfirmModal = function({ icon = "⚖️", title = "Confirm Action", body = "Are you sure?", confirmText = "Confirm", confirmStyle = "btn-primary", onConfirm = null }) {
  const modal = document.getElementById("universal-confirm-modal");
  const iconEl = document.getElementById("ucm-icon");
  const titleEl = document.getElementById("ucm-title");
  const bodyEl = document.getElementById("ucm-body");
  const btn = document.getElementById("ucm-confirm-btn");

  if (!modal) return;

  if (iconEl) iconEl.textContent = icon;
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
//  CASE DETAIL BACK NAVIGATION (DYNAMIC ORIGIN TRACKING)
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

function hasUnsavedCaseChanges() {
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

  // Discard pending files and temporary hearings
  if (typeof pendingDocs !== "undefined") pendingDocs = [];
  if (typeof window.cfHearings !== "undefined") window.cfHearings = [];

  executeNavigation(target);
};

window.handleCaseCancelOrExit = function() {
  if (hasUnsavedCaseChanges()) {
    window.promptDiscardCase(caseFormOrigin || "allcases");
  } else {
    executeNavigation(caseFormOrigin || "allcases");
  }
};

// Guard against tab close or page reload when unsaved changes exist
window.addEventListener("beforeunload", (e) => {
  if (hasUnsavedCaseChanges()) {
    e.preventDefault();
    e.returnValue = "You have unsaved case changes. Are you sure you want to leave?";
    return e.returnValue;
  }
});

// ═══════════════════════════════════════════════════════════════
//  VALIDATION HELPERS (MOBILE & EMAIL)
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
//  AUTOMATIC DEVICE DETECTION & CONNECTION NOTIFICATION
// ═══════════════════════════════════════════════════════════════
function autoDetectDevice() {
  const w = window.innerWidth;
  const ua = navigator.userAgent;
  const isTouch = navigator.maxTouchPoints > 0;
  
  document.body.classList.remove("device-mobile", "device-tablet", "device-desktop");

  let deviceLabel = "Desktop";
  let deviceIcon = "💻";

  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua) || (w >= 600 && w <= 1024 && isTouch)) {
    document.body.classList.add("device-tablet");
    window.deviceType = "tablet";
    deviceLabel = "Tablet";
    deviceIcon = "📱";
  } else if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile/i.test(ua) || w < 600) {
    document.body.classList.add("device-mobile");
    if (!document.body.classList.contains("sidebar-collapsed")) {
      document.body.classList.add("sidebar-collapsed");
    }
    window.deviceType = "mobile";
    deviceLabel = "Phone";
    deviceIcon = "📱";
  } else {
    document.body.classList.add("device-desktop");
    window.deviceType = "desktop";
    deviceLabel = "Desktop";
    deviceIcon = "💻";
  }

  const chip = document.getElementById("settings-device-chip");
  if (chip) {
    chip.innerHTML = `${deviceIcon} Connected as ${deviceLabel}`;
  }

  if (!window._deviceToastShown) {
    window._deviceToastShown = true;
    setTimeout(() => {
      if (typeof showToast === "function") {
        showToast(`${deviceIcon} Connected as ${deviceLabel}`, "success");
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
          if (icon) icon.textContent = "✅";
        } else {
          rule.el.style.color = "var(--text-dim)";
          if (icon) icon.textContent = "❌";
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
//  NAVIGATION (ACTIVE TAB HIGHLIGHTING & SAFE GUARD)
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
//  DASHBOARD (STRICT 5 CASES LIMIT & EXPAND TOGGLE)
// ═══════════════════════════════════════════════════════════════
let recentCasesExpanded = false;

window.toggleExpandRecentCases = function() {
  recentCasesExpanded = !recentCasesExpanded;
  const btn = document.getElementById("btn-toggle-expand-cases");
  if (btn) {
    btn.textContent = recentCasesExpanded ? "▲ Collapse" : "↕ Expand View";
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
    ? '<div class="empty-state"><div class="empty-state-icon">📁</div><div>No active cases yet.</div></div>'
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
    dpEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🏛️</div><div>No attorneys yet. Add your first attorney profile.</div></div>';
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
//  PROFILES (LIST VIEW VS TILE VIEW CONTROLLER)
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
    el.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">👥</div><div style="font-size:13px;color:var(--text-muted)">No associate attorneys are currently registered.</div></div>`;
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
            <span style="font-size:14px;color:var(--gold)">→</span>
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
          ${p.email ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:5px">✉ ${escHtml(p.email)}</div>` : ""}
          ${p.contact ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">📞 ${escHtml(p.contact)}</div>` : ""}
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
      ? `<a href="https://drive.google.com/drive/folders/${p.driveFolderId}" target="_blank" style="font-size:12px;color:var(--green);display:inline-flex;align-items:center;gap:6px;text-decoration:none;font-weight:500;padding:4px 10px;background:rgba(34,197,94,0.08);border-radius:6px;border:1px solid rgba(34,197,94,0.2)" title="Open Drive Folder">📁 Drive Folder →</a>`
      : (accessToken
          ? `<button onclick="createProfileFolderManual()" style="background:transparent;border:1px solid var(--amber);color:var(--amber);font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-weight:500;padding:4px 10px;border-radius:6px;transition:all 0.2s">📁 Create Drive Folder</button>`
          : `<span style="font-size:12px;color:var(--text-dim);display:inline-flex;align-items:center;gap:6px">📁 Drive not connected</span>`);

    actionButtons = `
      <button class="btn btn-secondary btn-sm" onclick="openEditProfile()">✏️ Edit</button>
      <button class="btn btn-danger btn-sm" onclick="confirmDeleteProfile()">🗑 Delete</button>
      <button class="btn btn-primary btn-sm" onclick="openAddCase()">+ Add Case</button>
    `;
  } else {
    driveChip = `<span style="font-size:12px;color:var(--text-dim)">📁 Files Protected</span>`;
    actionButtons = `
      <button class="btn btn-primary btn-sm" onclick="openAppointmentModal('${p.id}')">📅 Request Schedule</button>
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
          ${p.email ? `<span style="font-size:12px;color:var(--text-muted)">✉ ${escHtml(p.email)}</span>` : ""}
          ${p.contact ? `<span style="font-size:12px;color:var(--text-muted)">📞 ${escHtml(p.contact)}</span>` : ""}
          <span style="font-size:12px;color:var(--text-dim)">📅 Since ${p.createdAt || formatDate(new Date().toISOString())}</span>
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
      ? '<div class="empty-state-icon">🏛️</div><div>No accessible cases yet</div>'
      : '<div class="empty-state-icon">🔍</div><div>No cases match your filters.</div>'
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
//  ALL CASES (WITH LIVE NAME & TITLE SEARCH FILTER)
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
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><div>No cases match your access permissions or filters.</div></div>';
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
//  CASE DETAIL (WITH LIVE HEARINGS & TIMELINE HISTORY)
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
  if (canEdit) actionButtons += `<button class="btn btn-secondary btn-sm" onclick="openEditCase()">✏️ Edit</button>`;
  if (canShare) actionButtons += `<button class="btn btn-secondary btn-sm" onclick="openShareCaseModal()">👥 Share</button>`;
  if (canDelete) actionButtons += `<button class="btn btn-danger btn-sm" onclick="confirmDeleteCase()">🗑 Delete</button>`;
  if (userPerm === "viewer") actionButtons += `<span class="badge" style="background:rgba(129,140,248,0.15);color:#818cf8;padding:6px 12px;font-size:12px">👁 Viewer Access</span>`;

  const wrapEl = document.getElementById("cd-action-buttons-wrap");
  if (wrapEl) wrapEl.innerHTML = actionButtons;

  const backBtn = document.getElementById("cd-back-btn");
  if (backBtn) {
    backBtn.onclick = window.handleCaseDetailBack;
  }

  const chip = document.getElementById("cd-profile-chip");
  if (chip) {
    if (p) {
      chip.innerHTML = `${avatarDiv(p.name, p.avatarColor, 28, p.photoUrl)}<div><div style="font-size:14px;font-weight:600;color:var(--text)">${escHtml(p.name)}</div><div style="font-size:12px;color:var(--text-muted)">${escHtml(p.role || "Attorney")}</div></div><span style="font-size:12px;color:var(--text-dim);margin-left:8px">→ view profile</span>`;
      chip.style.display = "inline-flex";
    } else {
      chip.style.display = "none";
    }
  }

  // 1. General Case Information Card
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

  // 2. Court Hearings & Schedule History Log Card
  const hearingsEl = document.getElementById("cd-hearings");
  if (hearingsEl) {
    const hearingsList = Array.isArray(c.hearings) ? c.hearings : [];
    const todayStr = new Date().toISOString().split("T")[0];
    const sorted = [...hearingsList].sort((a, b) => new Date(a.date) - new Date(b.date));

    let hHtml = `
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">
        <span style="display:flex;align-items:center;gap:6px">⚖️ Court Hearings &amp; History (${sorted.length})</span>
      </div>
    `;

    if (sorted.length === 0) {
      hHtml += `<div style="font-size:12px;color:var(--text-muted);padding:10px 0">No court appearances on record.</div>`;
    } else {
      hHtml += `<div style="display:flex;flex-direction:column;gap:8px">`;
      sorted.forEach(h => {
        const isPast = h.date < todayStr;
        const badgeMarkup = isPast
          ? `<span class="badge" style="background:rgba(255,255,255,0.06);color:var(--text-dim);font-size:9.5px">Past Hearing</span>`
          : `<span class="badge" style="background:rgba(52,211,153,0.15);color:var(--green);font-size:9.5px">Upcoming Hearing</span>`;

        hHtml += `
          <div style="padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-left:4px solid ${isPast ? 'var(--text-dim)' : 'var(--green)'};border-radius:8px">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;flex-wrap:wrap">
              ${badgeMarkup}
              <span style="font-weight:700;font-size:12.5px;color:var(--text)">${formatDate(h.date)}</span>
              ${h.time ? `<span style="font-size:11px;color:var(--text-muted)">⏰ ${h.time}</span>` : ''}
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

  // 3. Documents Card
  const docs = c.documents || [];
  let docsHtml = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:12px">
    <div style="font-size:15px;font-weight:700;color:var(--text)">Case Files</div>
    ${canEdit ? `
      <div style="display:inline-flex;align-items:center;gap:10px">
        <div style="display:inline-flex;align-items:center;gap:8px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:3px 10px">
          <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text);cursor:pointer;margin:0">
            <input type="radio" name="cd-file-type" value="Inbound" checked style="accent-color:var(--gold);margin:0"/> 📥 In
          </label>
          <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text);cursor:pointer;margin:0">
            <input type="radio" name="cd-file-type" value="Outbound" style="accent-color:var(--gold);margin:0"/> 📤 Out
          </label>
        </div>
        <button class="btn btn-primary btn-sm" onclick="addDocToCase()">+ Upload Document</button>
      </div>` : `<span style="font-size:11px;color:var(--text-dim)">Protected File Repository</span>`
    }
  </div>`;

  if (docs.length === 0) {
    docsHtml += `<div class="upload-area" ${canEdit ? 'onclick="addDocToCase()"' : ''}><div style="font-size:26px;margin-bottom:4px">📎</div><div>${canEdit ? 'Click to attach a document' : 'No document records uploaded'}</div></div>`;
  } else {
    const inboundDocs = docs.filter(d => d.fileType === "Inbound");
    const outboundDocs = docs.filter(d => d.fileType === "Outbound");
    const otherDocs = docs.filter(d => d.fileType !== "Inbound" && d.fileType !== "Outbound");

    const renderDocRow = (doc) => {
      const realIdx = docs.findIndex(x => x === doc || (x.driveFileId && x.driveFileId === doc.driveFileId && x.name === doc.name));
      return `
        <div class="doc-item" style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%">
            <div>
              <div style="font-size:13px;color:var(--text);font-weight:600">
                <span onclick='openFilePreview(${JSON.stringify(doc).replace(/'/g, "&#39;")})' style="cursor:pointer;color:var(--gold);text-decoration:underline;text-underline-offset:3px">
                  📄 ${escHtml(doc.name)}
                </span>
              </div>
              <div style="font-size:12px;color:var(--text-muted)">
                ${doc.size} · ${doc.date}${doc.driveFileId ? " · ✅ Drive" : ""}
              </div>
            </div>
            ${canEdit ? `<button style="background:transparent;border:none;color:var(--red);font-size:18px;cursor:pointer;padding:2px 10px;flex-shrink:0" onclick="removeDocFromCase(${realIdx})" title="Delete File">🗑️</button>` : ""}
          </div>
        </div>
      `;
    };

    if (inboundDocs.length > 0) {
      docsHtml += `<div style="font-size:11px;font-weight:700;color:var(--text-dim);margin-14px 0 6px;text-transform:uppercase;letter-spacing:1px">📥 Inbound Documents</div>`;
      inboundDocs.forEach(d => { docsHtml += renderDocRow(d); });
    }

    if (outboundDocs.length > 0) {
      docsHtml += `<div style="font-size:11px;font-weight:700;color:var(--text-dim);margin-14px 0 6px;text-transform:uppercase;letter-spacing:1px">📤 Outbound Documents</div>`;
      outboundDocs.forEach(d => { docsHtml += renderDocRow(d); });
    }

    if (otherDocs.length > 0) {
      docsHtml += `<div style="font-size:11px;font-weight:700;color:var(--text-dim);margin-14px 0 6px;text-transform:uppercase;letter-spacing:1px">📋 Other Files</div>`;
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
            ${c.status === st ? "✓ " : ""}${st}
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
    icon: "⚖️",
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
    icon: "📄",
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
  caseDetailOrigin = currentView; // Tracks exact origin: dashboard, allcases, or profileDetail
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
  if (days < 0)   return `<span style="font-size:11px;font-weight:700;color:var(--red)">Overdue (${formatted})</span>`;
  if (days === 0) return `<span style="font-size:11px;font-weight:700;color:var(--red)">Due today</span>`;
  if (days <= 7)  return `<span style="font-size:11px;font-weight:700;color:var(--amber)">${days}d left (${formatted})</span>`;
  if (days <= 30) return `<span style="font-size:11px;font-weight:600;color:var(--gold)">${days}d (${formatted})</span>`;
  return `<span style="font-size:11px;color:var(--text-muted)">Due ${formatted}</span>`;
}

// ═══════════════════════════════════════════════════════════════
//  FILTER DROPDOWNS (CLEAN LABELS, ZERO EMOJIS)
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
//  REAL-TIME MONTHLY CALENDAR GRID
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
      optionsHtml += `<option value="${p.ownerUid}">👤 ${p.name}${designation}</option>`;
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
    // Register primary due date / next hearing
    if (c.dueDate) {
      if (!eventsByDate[c.dueDate]) eventsByDate[c.dueDate] = [];
      eventsByDate[c.dueDate].push({ 
        id: c.id, 
        type: "case", 
        title: c.title, 
        category: c.category || "Case", 
        typeName: c.type || "Case", 
        venue: c.venue || "N/A" 
      });
    }

    // Register all logged court hearings on the calendar
    if (Array.isArray(c.hearings)) {
      c.hearings.forEach(h => {
        if (h.date && h.date !== c.dueDate) {
          if (!eventsByDate[h.date]) eventsByDate[h.date] = [];
          eventsByDate[h.date].push({ 
            id: c.id, 
            type: "case", 
            title: `Hearing: ${c.title}`, 
            category: c.category || "Case", 
            typeName: h.purpose || c.type || "Hearing", 
            venue: c.venue || "N/A" 
          });
        }
      });
    }
  });

  activeAppts.forEach(a => {
    if (!eventsByDate[a.date]) eventsByDate[a.date] = [];
    const isBusy = a.type === "busy";
    eventsByDate[a.date].push({ 
      id: a.id, 
      type: isBusy ? "busy" : "appt", 
      title: a.title || (isBusy ? "Out of Office" : "Appointment"), 
      time: a.time || "All Day",
      description: a.description || "",
      requesterName: a.requesterName || "",
      targetName: a.targetName || "",
      requesterUid: a.requesterUid || "",
      targetUid: a.targetUid || ""
    });
  });

  const firstDayObj = new Date(currentCalYear, currentCalMonth, 1);
  const startingDayOfWeek = firstDayObj.getDay();
  const daysInMonth = new Date(currentCalYear, currentCalMonth + 1, 0).getDate();
  const prevMonthDays = new Date(currentCalYear, currentCalMonth + 0).getDate();

  const todayObj = new Date();
  const todayY = todayObj.getFullYear();
  const todayM = String(todayObj.getMonth() + 1).padStart(2, '0');
  const todayD = String(todayObj.getDate()).padStart(2, '0');
  const todayStr = `${todayY}-${todayM}-${todayD}`;

  let html = `
    <div class="cal-day-header">Sun</div>
    <div class="cal-day-header">Mon</div>
    <div class="cal-day-header">Tue</div>
    <div class="cal-day-header">Wed</div>
    <div class="cal-day-header">Thu</div>
    <div class="cal-day-header">Fri</div>
    <div class="cal-day-header">Sat</div>
  `;

  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthDays - i;
    html += `<div class="cal-day-cell other-month"><span class="cal-day-num">${dayNum}</span></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const mStr = String(currentCalMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const fullDateStr = `${currentCalYear}-${mStr}-${dStr}`;

    const isToday = fullDateStr === todayStr;
    const isPast = fullDateStr < todayStr;
    const dayEvents = eventsByDate[fullDateStr] || [];

    const hasBusy = dayEvents.some(e => e.type === "busy");
    const hasCase = dayEvents.some(e => e.type === "case");
    const hasAppt = dayEvents.some(e => e.type === "appt");

    let dotsHtml = "";
    if (dayEvents.length > 0) {
      dotsHtml = `<div style="display:flex;gap:4px;margin-top:auto;padding-top:4px;justify-content:center;flex-wrap:wrap">`;
      if (hasBusy) dotsHtml += `<span title="Unavailable / Out of Office" style="width:7px;height:7px;border-radius:50%;background:var(--red);display:inline-block"></span>`;
      if (hasCase) dotsHtml += `<span title="Case Hearing / Deadline" style="width:7px;height:7px;border-radius:50%;background:var(--gold);display:inline-block"></span>`;
      if (hasAppt) dotsHtml += `<span title="Appointment / Meeting" style="width:7px;height:7px;border-radius:50%;background:var(--violet);display:inline-block"></span>`;
      dotsHtml += `</div>`;
    }

    const todayTag = isToday ? `<span style="font-size:8.5px;background:var(--gold);color:#060c13;font-weight:800;padding:1px 5px;border-radius:3px;letter-spacing:0.5px">TODAY</span>` : "";

    html += `
      <div class="cal-day-cell ${isToday ? 'is-today' : ''} ${isPast ? 'is-past' : ''}" 
           onclick="openDateScheduleModal('${fullDateStr}')" 
           title="${isToday ? "Today's Schedule" : isPast ? "Past Date (View Only)" : "Click to view schedule"}">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span class="cal-day-num">${day}</span>
          ${todayTag}
        </div>
        ${dotsHtml}
      </div>
    `;
  }

  const totalCells = startingDayOfWeek + daysInMonth;
  const remainingCells = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remainingCells; i++) {
    html += `<div class="cal-day-cell other-month"><span class="cal-day-num">${i}</span></div>`;
  }

  gridEl.innerHTML = html;
}

window.renderMonthlyCalendarGrid = renderMonthlyCalendarGrid;

// ═══════════════════════════════════════════════════════════════
//  DATE POPUP MODAL CONTROLLER
// ═══════════════════════════════════════════════════════════════
window.openDateScheduleModal = function(dateStr) {
  const modal = document.getElementById("date-schedule-modal");
  const titleEl = document.getElementById("dsm-title");
  const listEl = document.getElementById("dsm-events-list");

  if (!modal || !listEl) return;

  const formattedDate = formatDate(dateStr);
  const todayObj = new Date();
  const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
  const isPast = dateStr < todayStr;
  const isToday = dateStr === todayStr;

  let headerBadge = "";
  if (isToday) headerBadge = ` <span style="font-size:10px;background:var(--gold);color:#060c13;font-weight:800;padding:2px 6px;border-radius:4px">TODAY</span>`;
  else if (isPast) headerBadge = ` <span style="font-size:10px;background:var(--surface3);color:var(--text-dim);font-weight:600;padding:2px 6px;border-radius:4px">PAST DATE</span>`;

  if (titleEl) titleEl.innerHTML = `📅 Schedule for ${formattedDate}${headerBadge}`;

  const u = window._currentUser || window._auth?.currentUser;
  const currentUid = u?.uid || "";

  const dateCases = getAccessibleCases().filter(c => c.dueDate === dateStr || (Array.isArray(c.hearings) && c.hearings.some(h => h.date === dateStr)));
  const dateAppts = appointments.filter(a => a.date === dateStr && a.status === "accepted");

  const allItems = [];

  dateCases.forEach(c => {
    const p = profiles.find(x => x.id === c.profileId);
    const specificHearing = Array.isArray(c.hearings) ? c.hearings.find(h => h.date === dateStr) : null;
    
    allItems.push({
      id: c.id,
      kind: "case",
      badgeColor: "var(--gold)",
      badgeLabel: specificHearing ? "Court Hearing" : "Document Deadline",
      title: c.title,
      time: specificHearing?.time || "All Day",
      sub: `${p?.name || "Attorney"} · ${specificHearing?.purpose || c.type || c.category || "Case"} · ${c.venue || "Venue N/A"}`,
      desc: specificHearing?.notes || c.narrative || "No notes available.",
      canDelete: false
    });
  });

  dateAppts.forEach(a => {
    const isBusy = a.type === "busy";
    const isMyBusy = isBusy && (a.targetUid === currentUid || a.requesterUid === currentUid || a.ownerUid === currentUid);

    allItems.push({
      id: a.id,
      kind: isBusy ? "busy" : "appt",
      badgeColor: isBusy ? "var(--red)" : "var(--violet)",
      badgeLabel: isBusy ? "Out of Office / Busy" : "Approved Appointment",
      title: a.title,
      time: a.time,
      sub: isBusy 
        ? `Attorney: ${a.targetName || a.requesterName || "Firm Attorney"}`
        : `Proposer: ${a.requesterName} · Host: ${a.targetName}`,
      desc: a.description || "",
      canDelete: isMyBusy,
      dateStr: dateStr
    });
  });

  if (allItems.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state" style="padding:28px 14px">
        <div class="empty-state-icon" style="font-size:32px;margin-bottom:8px">☀️</div>
        <div style="font-size:13px;color:var(--text-muted)">
          ${isPast ? "No past events recorded for this date." : "No events, deadlines, or appearances scheduled for this date."}
        </div>
      </div>
    `;
  } else {
    listEl.innerHTML = allItems.map(item => `
      <div style="background:var(--surface2);border:1px solid var(--border);border-left:4px solid ${item.badgeColor};border-radius:10px;padding:14px;margin-bottom:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px">
          <span style="font-size:11px;font-weight:700;color:${item.badgeColor};background:${item.badgeColor}18;padding:2px 8px;border-radius:4px">
            ${item.badgeLabel}
          </span>
          <div style="display:flex;align-items:center;gap:8px">
            ${item.time ? `<span style="font-size:11.5px;color:var(--text-muted);font-weight:600">⏰ ${item.time}</span>` : ""}
            ${item.canDelete ? `<button onclick="deleteBusySlot('${item.id}', '${item.dateStr}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:13px;padding:2px 6px;border-radius:4px" title="Delete availability entry">Remove</button>` : ""}
          </div>
        </div>
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px">${escHtml(item.title)}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">${escHtml(item.sub)}</div>
        ${item.desc ? `<div style="font-size:12px;color:var(--text-dim);background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:8px 10px;line-height:1.5;white-space:pre-wrap">${escHtml(item.desc)}</div>` : ""}
      </div>
    `).join("");
  }

  modal.classList.remove("hidden");
};

window.closeDateScheduleModal = function() {
  const modal = document.getElementById("date-schedule-modal");
  if (modal) modal.classList.add("hidden");
};

// ═══════════════════════════════════════════════════════════════
//  PERSONAL SETTINGS & 2FA CLEAN BUTTON
// ═══════════════════════════════════════════════════════════════
let settingsPhotoDataUrl = null;

function renderMyProfile() {
  const u = window._currentUser;
  if (!u) return;

  const myProf = profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase()));
  if (!myProf) return;

  const nameEl = document.getElementById("setting-name");
  const roleEl = document.getElementById("setting-role");
  const contactEl = document.getElementById("setting-contact");
  const emailEl = document.getElementById("setting-email");
  const passEl = document.getElementById("setting-password");
  const curPassEl = document.getElementById("setting-current-password");
  const reauthEl = document.getElementById("setting-reauth-panel");

  if (nameEl) {
    nameEl.value = myProf.name || "";
    nameEl.classList.remove("err");
    nameEl.oninput = () => {
      nameEl.classList.remove("err");
      document.getElementById("lbl-setting-name")?.classList.remove("err");
    };
  }
  if (roleEl) {
    roleEl.value = myProf.role || "Attorney";
    roleEl.classList.remove("err");
    roleEl.oninput = () => {
      roleEl.classList.remove("err");
      document.getElementById("lbl-setting-role")?.classList.remove("err");
    };
  }
  if (contactEl) {
    contactEl.value = myProf.contact || "";
    contactEl.classList.remove("err");
    contactEl.oninput = () => {
      contactEl.value = contactEl.value.replace(/\D/g, "");
      contactEl.classList.remove("err");
    };
  }
  if (emailEl) emailEl.value = u.email || "";
  if (passEl) passEl.value = "";
  if (curPassEl) curPassEl.value = "";
  if (reauthEl) reauthEl.style.display = "none";

  const mobileAdminCard = document.getElementById("mobile-admin-portal-card");
  if (mobileAdminCard) {
    const isAdmin = myProf.role === "admin" || (typeof ADMIN_EMAILS !== "undefined" && ADMIN_EMAILS.some(e => e.toLowerCase() === (u.email||"").toLowerCase()));
    mobileAdminCard.style.display = isAdmin ? "block" : "none";
  }

  settingsPhotoDataUrl = myProf.photoUrl || null;
  if (settingsPhotoDataUrl) {
    showSettingsPhotoPreview(settingsPhotoDataUrl, myProf.name, myProf.role);
  } else {
    resetSettingsPhotoUpload();
  }

  const statusEl = document.getElementById("settings-drive-status");
  const btn = document.getElementById("settings-connect-drive-btn");
  const btnText = document.getElementById("settings-connect-drive-text");
  const disconnectBtn = document.getElementById("settings-disconnect-drive-btn");

  if (statusEl && btn && btnText) {
    if (hasValidToken()) {
      statusEl.className = "drive-status-chip connected";
      statusEl.textContent = "● Connected";
      btnText.textContent = "✓ Connected";
      btn.classList.add("connected");
      btn.disabled = true;
      if (disconnectBtn) disconnectBtn.classList.remove("hidden");
    } else {
      statusEl.className = "drive-status-chip disconnected";
      statusEl.textContent = "● Not Connected";
      btnText.textContent = "Connect Google Drive";
      btn.classList.remove("connected");
      btn.disabled = false;
      if (disconnectBtn) disconnectBtn.classList.add("hidden");
    }
  }

  const tfaBadge = document.getElementById("setting-2fa-status-badge");
  const tfaBtn = document.getElementById("setting-2fa-action-btn");
  const tfaBackupWrap = document.getElementById("setting-2fa-backup-wrap");

  if (tfaBadge && tfaBtn) {
    if (myProf.twoFactorEnabled) {
      tfaBadge.className = "badge";
      tfaBadge.style.background = "rgba(52,211,153,0.15)";
      tfaBadge.style.color = "var(--green)";
      tfaBadge.textContent = "● 2FA Active";

      tfaBtn.className = "btn btn-danger btn-sm";
      tfaBtn.textContent = "Disable 2FA";
      tfaBtn.onclick = disableTwoFactor;

      if (tfaBackupWrap) tfaBackupWrap.style.display = "block";
    } else {
      tfaBadge.className = "badge";
      tfaBadge.style.background = "rgba(251,191,36,0.15)";
      tfaBadge.style.color = "var(--amber)";
      tfaBadge.textContent = "● Not Configured";

      tfaBtn.className = "btn btn-primary btn-sm";
      tfaBtn.textContent = "Configure Authenticator";
      tfaBtn.onclick = openTwoFactorSetupModal;

      if (tfaBackupWrap) tfaBackupWrap.style.display = "none";
    }
  }
}

window.renderMyProfile = renderMyProfile;

async function connectDriveFromSettings() {
  const btn = document.getElementById("settings-connect-drive-btn");
  const btnText = document.getElementById("settings-connect-drive-text");
  if (!btn) return;

  btn.disabled = true;
  if (btnText) btnText.textContent = "Connecting...";

  try {
    await promptDriveAuth();
    showToast("Google Drive connected successfully!");
    renderMyProfile();
    updateWorkspaceStatus(false);
    
    const u = window._currentUser;
    const myProf = u ? profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase())) : null;
    if (myProf && !myProf.driveFolderId) {
      showToast("Initializing attorney Drive storage folder...");
      try {
        const folderId = await createDriveFolder(`Simando Law — ${myProf.name}`, DRIVE_FOLDER_ID || null);
        if (folderId) {
          await dbUpdateProfile(myProf.id, { driveFolderId: folderId }).catch(e => console.warn("Profile update note:", e));
          myProf.driveFolderId = folderId;
          showToast("Storage folder created!");
          updateWorkspaceStatus(false);
        }
      } catch (folderErr) {
        console.warn("Folder initialization notice:", folderErr);
      }
    }
  } catch (err) {
    console.error("Settings drive auth failed:", err);
    if (btnText) btnText.textContent = "Connect Google Drive";
    btn.disabled = false;
    showToast("Drive connection failed: " + err.message, "error");
  }
}

window.connectDriveFromSettings = connectDriveFromSettings;

function showSettingsPhotoPreview(url, name, role) {
  const dropzone = document.getElementById("setting-photo-dropzone");
  const wrap = document.getElementById("setting-photo-preview-wrap");
  const img = document.getElementById("setting-photo-preview-img");
  const namePrev = document.getElementById("setting-name-preview");
  const rolePrev = document.getElementById("setting-role-preview");

  if (dropzone) dropzone.style.display = "none";
  if (wrap) wrap.style.display = "flex";
  if (img) img.src = url;
  if (namePrev) namePrev.textContent = name || "Attorney Name";
  if (rolePrev) rolePrev.textContent = role || "Role";
}

function resetSettingsPhotoUpload() {
  const dropzone = document.getElementById("setting-photo-dropzone");
  const wrap = document.getElementById("setting-photo-preview-wrap");
  const input = document.getElementById("setting-photo-input");

  if (dropzone) dropzone.style.display = "block";
  if (wrap) wrap.style.display = "none";
  if (input) input.value = "";
  settingsPhotoDataUrl = null;
}

function handleSettingsPhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    showToast("Photo must be under 2MB", "error");
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    settingsPhotoDataUrl = e.target.result;
    const nameVal = document.getElementById("setting-name")?.value || "";
    const roleVal = document.getElementById("setting-role")?.value || "";
    showSettingsPhotoPreview(settingsPhotoDataUrl, nameVal, roleVal);
  };
  reader.readAsDataURL(file);
}

function removeSettingsPhoto() {
  resetSettingsPhotoUpload();
}

window.handleSettingsPhotoUpload = handleSettingsPhotoUpload;
window.removeSettingsPhoto = removeSettingsPhoto;

async function saveUserSettings() {
  const u = window._currentUser;
  if (!u) return;

  const myProf = profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase()));
  if (!myProf) return;

  const nameInput = document.getElementById("setting-name");
  const roleInput = document.getElementById("setting-role");
  const contactInput = document.getElementById("setting-contact");
  
  const nameLabel = document.getElementById("lbl-setting-name");
  const roleLabel = document.getElementById("lbl-setting-role");

  const name = (nameInput?.value || "").trim();
  const role = (roleInput?.value || "").trim();
  const contact = (contactInput?.value || "").trim();

  let hasError = false;

  if (!name) {
    if (nameInput) nameInput.classList.add("err");
    if (nameLabel) nameLabel.classList.add("err");
    hasError = true;
  }
  if (!role) {
    if (roleInput) roleInput.classList.add("err");
    if (roleLabel) roleLabel.classList.add("err");
    hasError = true;
  }
  if (contact && !isValidMobile(contact)) {
    if (contactInput) contactInput.classList.add("err");
    showToast("Contact number must be exactly 11 digits.", "error");
    return;
  } else if (contactInput) {
    contactInput.classList.remove("err");
  }

  if (hasError) {
    showToast("Please complete all required fields highlighted in red.", "error");
    return;
  }

  const upd = { name, role, contact };

  try {
    showToast("Saving settings...");

    if (settingsPhotoDataUrl && settingsPhotoDataUrl.startsWith("data:")) {
      if (myProf.photoFileId && hasValidToken()) {
        await deleteDriveFile(myProf.photoFileId).catch(() => {});
      }
      if (hasValidToken()) {
        const folderId = myProf.driveFolderId || null;
        const { fileId, thumbnailUrl } = await uploadProfilePhotoToDrive(settingsPhotoDataUrl, folderId, name);
        upd.photoFileId = fileId;
        upd.photoUrl = thumbnailUrl;
      } else {
        showToast("Drive not connected. Profile photo was not uploaded to storage.", "error");
      }
    } else if (!settingsPhotoDataUrl && myProf.photoFileId) {
      if (hasValidToken()) await deleteDriveFile(myProf.photoFileId).catch(() => {});
      upd.photoFileId = null;
      upd.photoUrl = null;
    }

    await dbUpdateProfile(myProf.id, upd);
    
    if (typeof window._fbUpdateProfile === "function") {
      await window._fbUpdateProfile(u, { displayName: name, photoURL: upd.photoUrl || null });
    }

    selProfile = { ...myProf, ...upd };
    showToast("Profile settings updated!");
    renderMyProfile();
    updateWorkspaceStatus(false);
  } catch (err) {
    console.error("saveUserSettings error:", err);
    showToast("Failed to save settings: " + err.message, "error");
  }
}

async function saveSecuritySettings() {
  const u = window._currentUser;
  if (!u) return;

  const email = (document.getElementById("setting-email")?.value || "").trim();
  const pass = document.getElementById("setting-password")?.value || "";
  const currentPass = document.getElementById("setting-current-password")?.value || "";

  if (email === u.email && !pass) {
    showToast("No security modifications requested.");
    return;
  }

  if (email && !isValidEmail(email)) {
    showToast("Email must be a valid @gmail.com or @outlook.com address.", "error");
    return;
  }

  if (pass) {
    const isLengthValid = pass.length >= 6;
    const isUpperValid = /[A-Z]/.test(pass);
    const isNumberValid = /\d/.test(pass);
    const isSpecialValid = /[^A-Za-z0-9]/.test(pass);

    if (!isLengthValid || !isUpperValid || !isNumberValid || !isSpecialValid) {
      showToast("Please ensure your new password meets all security requirements.", "error");
      return;
    }
  }

  const reauthPanel = document.getElementById("setting-reauth-panel");
  if (reauthPanel && reauthPanel.style.display === "none") {
    reauthPanel.style.display = "block";
    showToast("Enter your current password to verify identity.", "error");
    return;
  }

  if (!currentPass) {
    showToast("Please enter your current password to proceed.", "error");
    return;
  }

  try {
    showToast("Verifying credentials...");
    const credential = window._fbEmailCred(u.email, currentPass);
    await window._fbReauth(u, credential);

    if (email !== u.email) {
      await window._fbUpdateEmail(u, email);
      const myProf = profiles.find(p => p.ownerUid === u.uid);
      if (myProf) {
        await dbUpdateProfile(myProf.id, { email: email });
      }
    }

    if (pass) {
      await window._fbUpdatePassword(u, pass);
    }

    showToast("Credentials updated successfully!");
    if (reauthPanel) reauthPanel.style.display = "none";
    const passInp = document.getElementById("setting-password");
    const curPassInp = document.getElementById("setting-current-password");
    const reqsBox = document.getElementById("password-requirements");
    if (passInp) passInp.value = "";
    if (curPassInp) curPassInp.value = "";
    if (reqsBox) reqsBox.style.display = "none"; 
  } catch (err) {
    console.error("Credentials update failed:", err);
    showToast("Verification failed: " + err.message, "error");
  }
}

window.saveUserSettings = saveUserSettings;
window.saveSecuritySettings = saveSecuritySettings;

function confirmDeleteUserAccount() {
  const u = window._currentUser;
  if (!u) return;
  
  const pending = { type: "account_delete", email: u.email };
  _pendingDeleteTarget = pending;

  const delTitle = document.getElementById("del-title");
  const delBody = document.getElementById("del-body");
  const label = document.getElementById("del-confirm-target-text");

  if (delTitle) delTitle.textContent = "Delete Your Account?";
  if (delBody) {
    delBody.innerHTML = 
      `You are about to permanently delete your account, attorney profile, and all cases.<br>This cannot be undone. To proceed, please type your email address exactly:<br><strong>${u.email}</strong>`;
  }
  if (label) {
    label.textContent = u.email;
    label.style.color = "var(--red)";
  }

  openDeleteModal();
}

async function executeDeleteAccountWipe() {
  const u = window._currentUser;
  if (!u) return;

  try {
    showToast("Purging your files & database records...");

    const myProf = profiles.find(p => p.ownerUid === u.uid);
    const myCases = cases.filter(c => c.ownerUid === u.uid);

    for (const c of myCases) {
      if (c.documents) {
        for (const doc of c.documents) {
          if (doc.driveFileId && hasValidToken()) {
            await deleteDriveFile(doc.driveFileId).catch(() => {});
          }
        }
      }
      await dbDeleteCase(c.id).catch(() => {});
    }

    if (myProf) {
      if (myProf.photoFileId && hasValidToken()) {
        await deleteDriveFile(myProf.photoFileId).catch(() => {});
      }
      if (myProf.driveFolderId && hasValidToken()) {
        await deleteDriveFile(myProf.driveFolderId).catch(() => {});
      }
      await dbDeleteProfile(myProf.id).catch(() => {});
    }

    showToast("Deleting security credential...");
    await window._fbDeleteUser(u);
    
    showToast("Account deleted successfully.");
    window.location.replace("login.html");
  } catch (err) {
    console.error("Account wipe failure:", err);
    if (err.code === "auth/requires-recent-login") {
      showToast("Verification expired. Re-authenticate in My Settings and try again.", "error");
    } else {
      showToast("Cleanup finished with network warnings: " + err.message, "error");
    }
  }
}

window.confirmDeleteUserAccount = confirmDeleteUserAccount;
window.executeDeleteAccountWipe = executeDeleteAccountWipe;

async function handleLogout() {
  try {
    if (typeof dbUnsubscribe === "function") dbUnsubscribe();
    if (window._fbSignOut) {
      await window._fbSignOut(window._auth);
      clearPersistedToken();
      sessionStorage.removeItem("simando_2fa_verified");
      window.location.replace("login.html");
    }
  } catch (err) {
    console.error("Signout error:", err);
  }
}

window.handleLogout = handleLogout;

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseGoogleDateTime(isoString) {
  if (!isoString) return { dateStr: "", timeStr: "", dateObj: new Date(), isAllDay: false };

  if (isoString.length === 10 && !isoString.includes("T")) {
    const parts = isoString.split("-");
    const yr = parseInt(parts[0], 10);
    const mo = parseInt(parts[1], 10) - 1;
    const dy = parseInt(parts[2], 10);
    const dateObj = new Date(yr, mo, dy);
    const dateStr = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return { dateStr, timeStr: "All Day", dateObj, isAllDay: true };
  }

  const match = isoString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!match) {
    const d = new Date(isoString);
    return {
      dateStr: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      timeStr: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
      dateObj: d,
      isAllDay: false
    };
  }

  const yr = parseInt(match[1], 10);
  const mo = parseInt(match[2], 10) - 1;
  const dy = parseInt(match[3], 10);
  const hh = parseInt(match[4], 10);
  const mm = match[5];

  const dateObj = new Date(yr, mo, dy, hh, parseInt(mm, 10));
  const dateStr = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const ampm = hh >= 12 ? "PM" : "AM";
  const displayHour = hh % 12 === 0 ? 12 : hh % 12;
  const timeStr = `${displayHour}:${mm} ${ampm}`;

  return { dateStr, timeStr, dateObj, isAllDay: false };
}

window.openCalendarEventModal = function(index) {
  const events = window._fetchedCalendarEvents;
  if (!events || !events[index]) return;
  const ev = events[index];

  const modal = document.getElementById("calendar-event-modal");
  if (!modal) return;

  const titleEl    = document.getElementById("cem-title");
  const timeEl     = document.getElementById("cem-time");
  const locationEl = document.getElementById("cem-location");
  const descEl     = document.getElementById("cem-desc");
  const linkEl     = document.getElementById("cem-link");

  const start = ev.start.dateTime || ev.start.date;
  const end   = ev.end?.dateTime || ev.end?.date;
  
  const parsedStart = parseGoogleDateTime(start);
  const parsedEnd   = parseGoogleDateTime(end);

  let timeString = parsedStart.dateStr;
  if (!parsedStart.isAllDay) {
    timeString += ` · ${parsedStart.timeStr}`;
    if (end && parsedEnd.timeStr && !parsedEnd.isAllDay) {
      timeString += ` - ${parsedEnd.timeStr}`;
    }
  } else {
    timeString += " (All Day)";
  }

  if (titleEl) titleEl.innerHTML = `📅 ${escHtml(ev.summary || "No Title")}`;
  if (timeEl) timeEl.textContent = timeString;
  if (locationEl) locationEl.textContent = ev.location || "No venue/location specified";
  if (descEl) descEl.textContent = ev.description || "No description provided.";
  
  if (linkEl) {
    if (ev.htmlLink) {
      linkEl.href = ev.htmlLink;
      linkEl.style.display = "inline-flex";
    } else {
      linkEl.style.display = "none";
    }
  }

  modal.classList.remove("hidden");
};

window.closeCalendarModal = function() {
  const modal = document.getElementById("calendar-event-modal");
  if (modal) modal.classList.add("hidden");
};

async function fetchAndRenderGoogleCalendarEvents() {
  const card = document.getElementById("dash-calendar-card");
  if (!card) return;

  let html = `<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:18px;display:flex;align-items:center;gap:8px;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:20px">📅</span> Google Calendar Agenda
    </div>
    <button onclick="fetchAndRenderGoogleCalendarEvents()" class="btn btn-ghost" style="font-size:11px;padding:4px 8px" title="Refresh Agenda">↻ Refresh</button>
  </div>`;

  if (!hasValidToken()) {
    html += `<div style="text-align:center;padding:24px 12px;color:var(--text-muted);border:1px dashed var(--border);border-radius:10px">
      <div style="font-size:24px;margin-bottom:8px">☁️</div>
      <div style="font-size:12px;font-weight:600">Google Calendar Not Synced</div>
      <div style="font-size:11px;margin-top:4px">Authorize Google Calendar under <a href="#" onclick="navTo('myprofile'); return false;" style="color:var(--gold);text-decoration:underline">My Settings</a> to sync case deadlines and view your agenda live.</div>
    </div>`;
    card.innerHTML = html;
    return;
  }

  try {
    card.innerHTML = html + `<div style="text-align:center;padding:20px"><span class="spinner" style="border-top-color:var(--gold)"></span></div>`;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const timeMin = today.toISOString();
    
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&singleEvents=true&orderBy=startTime&maxResults=6`;
    
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errorObj = new Error(errData.error?.message || "Failed to load events");
      errorObj.status = res.status;
      throw errorObj;
    }

    const data = await res.json();
    const events = data.items || [];
    window._fetchedCalendarEvents = events;

    if (events.length === 0) {
      html += `<div style="text-align:center;padding:24px 12px;color:var(--text-muted);border:1px dashed var(--border);border-radius:10px;font-size:12px">
        No upcoming events found on your Google Calendar.
      </div>`;
    } else {
      html += `<div style="display:flex;flex-direction:column;gap:10px">`;
      events.forEach((ev, i) => {
        const start = ev.start.date || ev.start.dateTime;
        const parsedStart = parseGoogleDateTime(start);
        
        const dateStr   = parsedStart.dateStr;
        const timeStr   = parsedStart.timeStr;
        const eventDate = parsedStart.dateObj;
        
        const locationMarkup = ev.location ? `<div style="font-size:11.5px;color:var(--text-muted);margin-top:2px;display:flex;align-items:center;gap:4px">📍 ${escHtml(ev.location)}</div>` : "";
        const descriptionMarkup = ev.description ? `<div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-style:italic">"${escHtml(ev.description.slice(0, 50))}${ev.description.length > 50 ? '...' : ''}"</div>` : "";

        const weekdayStr = eventDate.toLocaleDateString("en-US", { weekday: "short" });

        html += `
          <div onclick="openCalendarEventModal(${i})" style="display:flex;gap:12px;align-items:center;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;cursor:pointer;transition:all 0.2s" onmouseenter="this.style.borderColor='var(--gold-border)';this.style.background='var(--surface3)'" onmouseleave="this.style.borderColor='var(--border)';this.style.background='var(--surface2)'">
            <div style="text-align:center;background:rgba(201,168,76,0.1);border:1px solid var(--gold-border);border-radius:8px;padding:6px;min-width:48px">
              <div style="font-size:10px;font-weight:700;color:var(--gold);text-transform:uppercase">${weekdayStr}</div>
              <div style="font-size:14px;font-weight:700;color:var(--text);margin-top:1px">${eventDate.getDate()}</div>
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escHtml(ev.summary || 'No Title')}">${escHtml(ev.summary || 'No Title')}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px">📅 ${dateStr} · ⏰ ${timeStr}</div>
              ${locationMarkup}
              ${descriptionMarkup}
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }
  } catch (err) {
    console.error("fetchAndRenderGoogleCalendarEvents error:", err);
    
    if (err.status === 401) {
      if (typeof clearPersistedToken === "function") {
        clearPersistedToken();
      }
      fetchAndRenderGoogleCalendarEvents();
      return;
    }

    if (err.status === 403) {
      html += `<div style="text-align:left;padding:16px;color:var(--text-muted);border:1px dashed var(--border);border-radius:10px;font-size:12px;line-height:1.5">
        <strong style="color:var(--amber)">Google Calendar API Access Denied (403)</strong><br>
        Please ensure the <strong>Google Calendar API</strong> is enabled inside your Google Cloud Console for this project Client ID.
      </div>`;
    } else {
      html += `<div style="text-align:center;padding:20px;color:var(--red);font-size:12px">
        Failed to load Google Calendar Agenda. Click refresh to try again.
      </div>`;
    }
  }
  card.innerHTML = html;
}

window.fetchAndRenderGoogleCalendarEvents = fetchAndRenderGoogleCalendarEvents;

if (!window._calendarIntervalId) {
  window._calendarIntervalId = setInterval(() => {
    if (currentView === "dashboard" && hasValidToken() && document.visibilityState === "visible" && typeof fetchAndRenderGoogleCalendarEvents === "function") {
      fetchAndRenderGoogleCalendarEvents();
    }
  }, 15000); 
}

// ═══════════════════════════════════════════════════════════════
//  MUTUALLY EXCLUSIVE NOTIFICATIONS & CHAT DROPDOWNS
// ═══════════════════════════════════════════════════════════════
window.toggleNotifDropdown = function() {
  const dropdown = document.getElementById("notif-dropdown");
  if (!dropdown) return;
  
  const willOpen = dropdown.classList.contains("hidden");
  dropdown.classList.toggle("hidden");

  if (willOpen) {
    const chatPanel = document.getElementById("chat-panel");
    if (chatPanel && !chatPanel.classList.contains("hidden")) {
      chatPanel.classList.add("hidden");
    }
    renderNotificationsView();
  }
};

document.addEventListener("click", (e) => {
  const container = document.getElementById("top-hdr-actions");
  const dropdown = document.getElementById("notif-dropdown");
  if (container && dropdown && !container.contains(e.target)) {
    dropdown.classList.add("hidden");
  }
});

function updateNotificationBadge() {
  const badgeEl = document.getElementById("global-notif-badge");
  if (!badgeEl) return;
  const unreadCount = notifications.filter(n => n.status === "unread").length;
  if (unreadCount > 0) {
    badgeEl.textContent = unreadCount;
    badgeEl.style.display = "inline-flex";
  } else {
    badgeEl.style.display = "none";
  }
}

window.updateNotificationBadge = updateNotificationBadge;

window.handleNotifClick = async function(notifId, type, relatedId, fromUid, fromName) {
  if (notifId) {
    markNotificationRead(notifId);
  }

  const dropdown = document.getElementById("notif-dropdown");
  if (dropdown) dropdown.classList.add("hidden");

  if ((type === "case_due" || type === "case_share") && relatedId) {
    openCase(relatedId);
  } else if (type === "availability_request" || type === "availability_confirmed") {
    if (window._chat) {
      if (typeof window._chat.toggleDock === "function" && !document.getElementById("chat-panel")?.classList.contains("open")) {
        window._chat.toggleDock();
      }
      if (fromUid && typeof window._chat.openConversation === "function") {
        window._chat.openConversation(fromUid, fromName || "Attorney", false);
      }
    }
  }
};

function renderNotificationsView() {
  const listEl = document.getElementById("notifications-list");
  if (!listEl) return;

  if (notifications.length === 0) {
    listEl.innerHTML = `<div class="empty-state" style="padding:24px 10px"><div class="empty-state-icon" style="font-size:28px;margin-bottom:6px">🔔</div><div style="font-size:12px;color:var(--text-muted)">No notifications found.</div></div>`;
    return;
  }

  listEl.innerHTML = notifications.map(n => {
    const isUnread = n.status === "unread";
    const dateStr = n.createdAt ? new Date(n.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "N/A";
    
    let actions = "";
    if (n.type === "appointment_request" && n.appointmentStatus === "pending") {
      actions = `
        <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" style="padding:4px 8px;font-size:10px" onclick="event.stopPropagation(); acceptAppointmentRequest('${n.id}', '${n.relatedId}')">Accept Proposal</button>
          <button class="btn btn-danger btn-sm" style="padding:4px 8px;font-size:10px" onclick="event.stopPropagation(); declineAppointmentRequest('${n.id}', '${n.relatedId}')">Decline</button>
          <button class="btn btn-secondary btn-sm" style="padding:4px 8px;font-size:10px" onclick="event.stopPropagation(); handleNotifClick('${n.id}', '${n.type}', '${n.relatedId}', '${n.fromUid}', '${escHtml(n.fromName)}')">💬 Go to Chat</button>
        </div>
      `;
    } else if (n.type === "appointment_request") {
      const statusText = (n.appointmentStatus || "").toUpperCase();
      const colorVal = n.appointmentStatus === "accepted" ? "var(--green)" : "var(--red)";
      actions = `<div style="font-size:10px;font-weight:700;color:${colorVal};margin-top:6px">● PROPOSAL ${statusText}</div>`;
    } else if (n.type === "availability_request" || n.type === "availability_confirmed") {
      actions = `
        <div style="margin-top:8px">
          <button class="btn btn-secondary btn-sm" style="padding:4px 8px;font-size:10px" onclick="event.stopPropagation(); handleNotifClick('${n.id}', '${n.type}', '${n.relatedId}', '${n.fromUid}', '${escHtml(n.fromName)}')">💬 Go to Chat Stream</button>
        </div>
      `;
    }

    return `
      <div class="doc-item" onclick="handleNotifClick('${n.id}', '${n.type}', '${n.relatedId}', '${n.fromUid}', '${escHtml(n.fromName)}')" style="border-left: 3px solid ${isUnread ? 'var(--gold)' : 'var(--border)'}; background: ${isUnread ? 'var(--surface2)' : 'transparent'}; margin-bottom: 8px; padding: 10px 12px; font-size: 12px; cursor: pointer;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%">
          <div style="flex:1;min-width:0;padding-right:6px">
            <div style="font-weight:700;font-size:12.5px;color:var(--text);margin-bottom:2px">${escHtml(n.title)}</div>
            <div style="font-size:11.5px;color:var(--text-muted);line-height:1.4">${escHtml(n.message)}</div>
            <div style="font-size:10px;color:var(--text-dim);margin-top:4px">${dateStr}</div>
            ${actions}
          </div>
          ${isUnread ? '<button class="btn btn-ghost" style="font-size:10px;padding:2px 6px;flex-shrink:0" onclick="event.stopPropagation(); markNotificationRead(\'' + n.id + '\')">Mark read</button>' : ""}
        </div>
      </div>
    `;
  }).join("");
}

window.renderNotificationsView = renderNotificationsView;

window.markNotificationRead = async function(id) {
  const notif = notifications.find(n => n.id === id);
  if (notif) {
    notif.status = "read";
    updateNotificationBadge();
    renderNotificationsView();
  }
  try {
    await dbUpdateNotification(id, { status: "read" });
  } catch (err) {
    console.error("markNotificationRead error:", err);
  }
};

window.markAllNotificationsAsRead = async function() {
  notifications.forEach(n => { n.status = "read"; });
  updateNotificationBadge();
  renderNotificationsView();

  try {
    showToast("Clearing alerts...");
    for (const n of notifications) {
      await dbUpdateNotification(n.id, { status: "read" });
    }
    showToast("All notifications cleared!");
  } catch (err) {
    console.error("markAllNotificationsAsRead error:", err);
  }
};

// ═══════════════════════════════════════════════════════════════
//  APPOINTMENTS / SCHEDULING SYSTEM CONTROLLERS
// ═══════════════════════════════════════════════════════════════
let targetApptProfile = null;

window.openAppointmentModal = function(profileId) {
  const p = profiles.find(x => x.id === profileId);
  if (!p) return;
  targetApptProfile = p;

  const todayObj = new Date();
  const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

  const titleInp = document.getElementById("appt-title");
  const dateInp = document.getElementById("appt-date");
  const timeInp = document.getElementById("appt-time");
  const descInp = document.getElementById("appt-desc");
  const modalSub = document.getElementById("appointment-modal-sub");

  if (titleInp) titleInp.value = "";
  if (dateInp) {
    dateInp.value = "";
    dateInp.min = todayStr;
  }
  if (timeInp) timeInp.value = "";
  if (descInp) descInp.value = "";
  if (modalSub) modalSub.textContent = `Propose an appointment or schedule date with ${p.name}`;
  
  const modal = document.getElementById("appointment-modal");
  if (modal) modal.classList.remove("hidden");
};

window.closeAppointmentModal = function() {
  const modal = document.getElementById("appointment-modal");
  if (modal) modal.classList.add("hidden");
  targetApptProfile = null;
};

window.submitAppointmentRequest = async function() {
  const title = (document.getElementById("appt-title")?.value || "").trim();
  const date = document.getElementById("appt-date")?.value || "";
  const time = document.getElementById("appt-time")?.value || "";
  const desc = (document.getElementById("appt-desc")?.value || "").trim();

  if (!title || !date || !time) {
    showToast("Please fill in all required fields.", "error");
    return;
  }

  const todayObj = new Date();
  const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
  if (date < todayStr) {
    showToast("Cannot propose appointments on past dates.", "error");
    return;
  }

  const u = window._currentUser;
  const myProf = profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase()));
  if (!myProf || !targetApptProfile) return;

  try {
    showToast("Sending request...");
    
    const apptData = {
      title,
      date,
      time,
      description: desc,
      requesterUid: u.uid,
      requesterName: myProf.name,
      targetUid: targetApptProfile.ownerUid,
      targetName: targetApptProfile.name,
      status: "pending"
    };
    const apptId = await dbAddAppointment(apptData);

    const notifData = {
      toUid: targetApptProfile.ownerUid,
      fromUid: u.uid,
      fromName: myProf.name,
      title: "New Appointment Proposal",
      message: `${myProf.name} proposed an appointment "${title}" on ${formatDate(date)} at ${time}.`,
      type: "appointment_request",
      relatedId: apptId,
      status: "unread",
      appointmentStatus: "pending"
    };
    await dbAddNotification(notifData);

    showToast("Schedule request sent!");
    closeAppointmentModal();
  } catch (err) {
    console.error("submitAppointmentRequest error:", err);
    showToast("Failed to request appointment: " + err.message, "error");
  }
};

window.acceptAppointmentRequest = async function(notifId, apptId) {
  try {
    showToast("Approving proposal...");
    await dbUpdateAppointment(apptId, { status: "accepted" });
    await dbUpdateNotification(notifId, { appointmentStatus: "accepted", status: "read" });
    
    const appt = appointments.find(a => a.id === apptId);
    if (appt) {
      await dbAddNotification({
        toUid: appt.requesterUid,
        fromUid: window._currentUser.uid,
        fromName: appt.targetName,
        title: "Appointment Approved ✅",
        message: `${appt.targetName} accepted your proposed date "${appt.title}" on ${formatDate(appt.date)} at ${appt.time}.`,
        type: "appointment_update",
        relatedId: apptId,
        status: "unread"
      });
    }
    showToast("Appointment confirmed!");
  } catch (err) {
    console.error("acceptAppointmentRequest error:", err);
  }
};

window.declineAppointmentRequest = async function(notifId, apptId) {
  try {
    showToast("Declining request...");
    await dbUpdateAppointment(apptId, { status: "declined" });
    await dbUpdateNotification(notifId, { appointmentStatus: "declined", status: "read" });
    
    const appt = appointments.find(a => a.id === apptId);
    if (appt) {
      await dbAddNotification({
        toUid: appt.requesterUid,
        fromUid: window._currentUser.uid,
        fromName: appt.targetName,
        title: "Appointment Declined ❌",
        message: `${appt.targetName} declined your proposed date "${appt.title}" on ${formatDate(a.date)}.`,
        type: "appointment_update",
        relatedId: apptId,
        status: "unread"
      });
    }
    showToast("Request declined.");
  } catch (err) {
    console.error("declineAppointmentRequest error:", err);
  }
};

// ═══════════════════════════════════════════════════════════════
//  CASE FORM INITIALIZATION
// ═══════════════════════════════════════════════════════════════
function populateCaseSelects(isEdit = false) {
  const catSel = document.getElementById("cf-category");
  const statusSel = document.getElementById("cf-status");
  const venueSel = document.getElementById("cf-venue");
  
  if (catSel) catSel.innerHTML = CASE_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("");
  
  const optionsToUse = isEdit ? STATUS_OPTIONS : (typeof NEW_CASE_STATUS_OPTIONS !== "undefined" ? NEW_CASE_STATUS_OPTIONS : ["On-going", "Pending"]);
  if (statusSel) statusSel.innerHTML = optionsToUse.map(t => `<option value="${t}">${t}</option>`).join("");
  
  if (venueSel) venueSel.innerHTML = VENUES.map(v => `<option value="${v}">${v}</option>`).join("");
}

window.populateCaseSelects = populateCaseSelects;

// ═══════════════════════════════════════════════════════════════
//  GOOGLE DRIVE EXPLORER REPLICA (WITH ZERO CELL OVERFLOW)
// ═══════════════════════════════════════════════════════════════
let currentExplorerFolderId = "root";
let explorerBreadcrumbs = [];

window.initDriveExplorer = function() {
  const u = window._currentUser;
  const myProf = u ? profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase())) : null;
  const startFolder = (myProf && myProf.driveFolderId) ? myProf.driveFolderId : (DRIVE_FOLDER_ID || "root");

  currentExplorerFolderId = startFolder;
  explorerBreadcrumbs = [{ id: currentExplorerFolderId, name: "Firm Drive" }];
  loadExplorerFiles();
};

window.loadExplorerFiles = async function() {
  const listEl = document.getElementById("mydrive-explorer-list");
  const emptyEl = document.getElementById("mydrive-empty-state");
  const nativeBtn = document.getElementById("mydrive-open-native-btn");

  if (!listEl) return;

  renderExplorerBreadcrumbs();

  if (nativeBtn) {
    const u = window._currentUser;
    const myProf = u ? profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase())) : null;
    const targetFolder = (currentExplorerFolderId && currentExplorerFolderId !== "root") 
      ? currentExplorerFolderId 
      : (myProf?.driveFolderId || DRIVE_FOLDER_ID || "");

    if (targetFolder && targetFolder !== "root") {
      nativeBtn.href = "https://drive.google.com/drive/folders/" + targetFolder;
      nativeBtn.style.display = "inline-flex";
    } else {
      nativeBtn.href = "https://drive.google.com";
      nativeBtn.style.display = "inline-flex";
    }
  }

  if (!hasValidToken()) {
    listEl.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)">
      <div style="font-size:24px;margin-bottom:8px">☁️</div>
      <div style="font-size:13px;font-weight:600">Google Drive Session Expired</div>
      <div style="font-size:11px;margin-top:4px">Please re-authenticate under My Settings to view file explorer records.</div>
    </div>`;
    if (emptyEl) emptyEl.classList.add("hidden");
    return;
  }

  try {
    listEl.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px"><span class="spinner" style="border-top-color:var(--gold)"></span></div>`;
    if (emptyEl) emptyEl.classList.add("hidden");

    let folderQueryId = currentExplorerFolderId;
    if (!folderQueryId || folderQueryId === "root") {
      folderQueryId = "root";
    }

    const q = encodeURIComponent("'" + folderQueryId + "' in parents and trashed = false");
    const url = "https://www.googleapis.com/drive/v3/files?q=" + q + "&fields=files(id,name,mimeType,size,webViewLink)&orderBy=folder,name";

    const res = await fetch(url, {
      headers: { Authorization: "Bearer " + accessToken }
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      if (res.status === 403 || res.status === 404) {
        if (folderQueryId !== "root") {
          console.warn("Folder query 403/404. Falling back to root drive view.");
          currentExplorerFolderId = "root";
          explorerBreadcrumbs = [{ id: "root", name: "Firm Drive" }];
          loadExplorerFiles();
          return;
        }
      }
      throw new Error(errBody.error?.message || `Google Drive API error (${res.status})`);
    }

    const data = await res.json();
    const files = data.files || [];

    if (files.length === 0) {
      listEl.innerHTML = "";
      if (emptyEl) emptyEl.classList.remove("hidden");
      return;
    }

    if (emptyEl) emptyEl.classList.add("hidden");

    listEl.innerHTML = files.map(f => {
      const isFolder = f.mimeType === "application/vnd.google-apps.folder";
      const icon = isFolder ? "📁" : "📄";
      const onClickAction = isFolder 
        ? "onclick=\"navigateIntoFolder('" + f.id + "', '" + f.name.replace(/'/g, "\\'") + "')\""
        : "onclick=\"window.open('" + f.webViewLink + "', '_blank')\"";
      
      const sizeText = f.size ? (f.size / (1024 * 1024)).toFixed(2) + " MB" : "";

      return `
        <div style="min-width:0;max-width:100%;overflow:hidden;position:relative;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:16px 10px;text-align:center;cursor:pointer;transition:all 0.2s" onmouseenter="this.style.borderColor='var(--gold-border)';this.style.background='var(--surface3)'" onmouseleave="this.style.borderColor='var(--border)';this.style.background='var(--surface2)'">
          <div ${onClickAction} style="min-width:0;max-width:100%;overflow:hidden">
            <div style="font-size:32px;margin-bottom:8px">${icon}</div>
            <div style="font-size:12.5px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;display:block" title="${escHtml(f.name)}">${escHtml(f.name)}</div>
            ${sizeText ? '<div style="font-size:11px;color:var(--text-dim);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + sizeText + '</div>' : ""}
          </div>
          <button onclick="event.stopPropagation(); adminDeleteDriveExplorerFile('${f.id}', '${f.name.replace(/'/g, "\\'")}')" style="position:absolute;top:6px;right:6px;background:none;border:none;color:var(--red);font-size:14px;cursor:pointer;padding:4px;border-radius:4px;opacity:0.6;transition:opacity 0.2s" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'" title="Delete file from Google Drive">
            🗑️
          </button>
        </div>
      `;
    }).join("");

  } catch (err) {
    console.warn("loadExplorerFiles notice:", err);
    listEl.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:30px 16px;color:var(--text-muted)">
        <div style="font-size:28px;margin-bottom:8px">⚠️</div>
        <div style="font-size:13px;font-weight:600;color:var(--text)">Google Drive API Notice (403)</div>
        <div style="font-size:11.5px;margin-top:6px;line-height:1.5">
          Unable to browse folder contents. Please ensure the <strong>Google Drive API</strong> is enabled in your Google Cloud Console for your project credentials, or click <strong>Open in Google Drive</strong> above to view your files directly.
        </div>
      </div>
    `;
  }
};

// 3. BRANDED FIRM DRIVE FILE DELETION CONFIRMATION
window.adminDeleteDriveExplorerFile = function(fileId, fileName) {
  window.openConfirmModal({
    icon: "📁",
    title: "Delete from Firm Drive?",
    body: `Are you sure you want to delete <strong>"${escHtml(fileName)}"</strong> directly from Google Drive?<br>This action cannot be undone.`,
    confirmText: "Delete from Drive",
    confirmStyle: "btn-danger",
    onConfirm: async () => {
      try {
        showToast("Deleting file from Drive...");
        await deleteDriveFile(fileId);
        showToast("File deleted from Google Drive.");
        loadExplorerFiles();
      } catch (err) {
        console.error("Delete explorer file error:", err);
        showToast("Failed to delete file: " + err.message, "error");
      }
    }
  });
};

window.navigateIntoFolder = function(id, name) {
  explorerBreadcrumbs.push({ id, name });
  currentExplorerFolderId = id;
  loadExplorerFiles();
};

window.navigateBreadcrumb = function(index) {
  explorerBreadcrumbs = explorerBreadcrumbs.slice(0, index + 1);
  currentExplorerFolderId = explorerBreadcrumbs[index].id;
  loadExplorerFiles();
};

function renderExplorerBreadcrumbs() {
  const el = document.getElementById("mydrive-breadcrumbs");
  if (!el) return;

  el.innerHTML = explorerBreadcrumbs.map((b, idx) => {
    const isLast = idx === explorerBreadcrumbs.length - 1;
    if (isLast) {
      return '<span style="color:var(--gold)">' + escHtml(b.name) + '</span>';
    }
    return '<span onclick="navigateBreadcrumb(' + idx + ')" style="cursor:pointer;color:var(--text-muted);text-decoration:underline" onmouseover="this.style.color=\'var(--text)\'" onmouseout="this.style.color=\'var(--text-muted)\'">' + escHtml(b.name) + '</span> <span style="font-size:11px;opacity:0.4">/</span>';
  }).join(" ");
}

function openMyDriveFolder() {
  const u = window._currentUser;
  if (!u) { showToast("Not logged in.", "error"); return; }
  const myProf = profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase()));
  if (myProf && myProf.driveFolderId) {
    window.open(`https://drive.google.com/drive/folders/${myProf.driveFolderId}`, "_blank");
  } else {
    showToast("No Drive folder linked. Please connect Google Drive in Settings first.", "error");
  }
}

window.openMyDriveFolder = openMyDriveFolder;

// ═══════════════════════════════════════════════════════════════
//  FILE PREVIEW CONTROLLER
// ═══════════════════════════════════════════════════════════════
window.openFilePreview = function(doc) {
  if (!doc) return;

  if (doc.driveLink) {
    window.open(doc.driveLink, "_blank");
    return;
  }

  if (doc._localTempId && typeof pendingLocalFiles !== "undefined") {
    const file = pendingLocalFiles[doc._localTempId];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      window.open(objectUrl, "_blank");
      return;
    }
  }

  showToast("File link not found.", "error");
};

window.closeFilePreview = function() {
  const modal = document.getElementById("file-preview-modal");
  if (modal) modal.style.display = "none";
};
