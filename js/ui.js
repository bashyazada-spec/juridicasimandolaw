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

window.initTheme = initTheme;

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
          rule.el.style.color = "var(--text-muted)";
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

  if (["dashboard","profiles","allcases","myprofile","calendar","notifications","mydrive"].includes(name)) {
    const btn = document.querySelector(`.nav-btn[data-nav="${name}"]`);
    if (btn) btn.classList.add("active");
    const mBtn = document.querySelector(`.mobile-nav-item[data-nav="${name}"]`);
    if (mBtn) mBtn.classList.add("active");
  }
}

function navTo(view) {
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

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD (CATEGORY HIGHLIGHTS & ADMIN STAT VISIBILITY)
// ═══════════════════════════════════════════════════════════════
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

  const displayCases = userCases.slice(0, 6);

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
         :                  {col:"var(--text-dim)",label:daysLeft + "d left"})
        : null;

      // Category Pill Highlight
      const categoryBadge = `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;background:rgba(201,165,92,0.12);color:var(--gold-light);border:1px solid var(--gold-border);white-space:nowrap;display:inline-block">${escHtml(c.category || "Case")}</span>`;

      return `<div class="flex-center gap-10" style="padding:11px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:9px;margin-bottom:8px;cursor:pointer;transition:all 0.2s" onclick="openCase('${c.id}')" onmouseenter="this.style.borderColor='var(--gold)'" onmouseleave="this.style.borderColor='var(--border)'">
        ${p ? avatarDiv(p.name, p.avatarColor, 30, p.photoUrl) : ""}
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(c.title)}</div>
          <div style="font-size:11px;color:var(--text-dim);margin-top:3px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
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
    dpEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚖️</div><div>No attorneys yet. Add your first attorney profile.</div></div>';
    return;
  }
  if (filtered.length === 0) {
    dpEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-dim);font-size:13px">No attorneys match your search.</div>';
    return;
  }

  dpEl.innerHTML = filtered.slice(0, 8).map(p => {
    const pc = userCases.filter(c => c.profileId === p.id);
    return `<div style="padding:12px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:11px;margin-bottom:10px;cursor:pointer;transition:all 0.2s" onclick="openProfile('${p.id}')" onmouseenter="this.style.borderColor='var(--gold-border)';this.style.background='var(--surface3)'" onmouseleave="this.style.borderColor='var(--border)';this.style.background='var(--surface2)'">
      <div style="display:flex;align-items:center;gap:12px">
        ${avatarDiv(p.name, p.avatarColor, 38, p.photoUrl)}
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px;color:var(--text)">${escHtml(p.name)}</div>
          <div style="font-size:11px;color:var(--text-dim);margin-top:1px">${escHtml(p.role || "Attorney")} · ${pc.length} case${pc.length !== 1 ? "s" : ""}</div>
        </div>
      </div>
    </div>`;
  }).join("");
}

// ═══════════════════════════════════════════════════════════════
//  PROFILES
// ═══════════════════════════════════════════════════════════════
function renderProfiles() {
  const u = window._currentUser;
  if (!u) return;

  const countEl = document.getElementById("profiles-count");
  if (countEl) countEl.textContent = `${profiles.length} profile${profiles.length !== 1 ? "s" : ""} total`;

  const el = document.getElementById("profiles-grid");
  if (!el) return;

  const userCases = getAccessibleCases();

  if (profiles.length === 0) {
    el.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">👥</div><div style="font-size:13px;color:var(--text-dim)">No associate attorneys are currently registered.</div></div>`;
    return;
  }

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
            <div style="font-size:13px;color:var(--text-dim)">${escHtml(p.role || "Attorney")}</div>
          </div>
        </div>
        <hr class="divider"/>
        ${p.email ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:5px">✉ ${escHtml(p.email)}</div>` : ""}
        ${p.contact ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">📞 ${escHtml(p.contact)}</div>` : ""}
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:13px;color:var(--text-dim)">Cases Accessible</span>
          ${ongoing > 0 ? badge(ongoing + " active", statusColor("On-going")) : ""}
        </div>
      </div>
    `;
  }).join("");
}

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
          ${p.email ? `<span style="font-size:12px;color:var(--text-dim)">✉ ${escHtml(p.email)}</span>` : ""}
          ${p.contact ? `<span style="font-size:12px;color:var(--text-dim)">📞 ${escHtml(p.contact)}</span>` : ""}
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
    (c.title.toLowerCase().includes(q) || (c.parties || "").toLowerCase().includes(q)) &&
    (status === "All" || c.status === status) &&
    (category === "All" || c.category === category) &&
    (type === "All" || c.type === type)
  );
  filtered = sortCasesByDue(filtered, sort);

  const el = document.getElementById("profile-cases-list");
  if (!el) return;

  if (filtered.length === 0) {
    el.innerHTML = `<div class="empty-state">${pc.length === 0
      ? '<div class="empty-state-icon">⚖️</div><div>No accessible cases yet</div>'
      : '<div class="empty-state-icon">🔍</div><div>No cases match your filters.</div>'
    }</div>`;
    return;
  }
  el.innerHTML = filtered.map(c => `
    <div class="case-row" onclick="openCase('${c.id}')">
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:15px;color:var(--text);margin-bottom:4px">${escHtml(c.title)}</div>
        <div style="font-size:12px;color:var(--text-dim);display:flex;align-items:center;gap:6px;flex-wrap:wrap">
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

// ═══════════════════════════════════════════════════════════════
//  ALL CASES
// ═══════════════════════════════════════════════════════════════
function renderAllCases() {
  updateAllFilterDropdowns(); 
  const q        = (document.getElementById("ac-search")?.value || "").toLowerCase();
  const status   = document.getElementById("ac-status")?.value || "All";
  const category = document.getElementById("ac-category")?.value || "All";
  const type     = document.getElementById("ac-type")?.value || "All";
  const sort     = document.getElementById("ac-sort")?.value || "asc";

  const accessible = getAccessibleCases();

  let filtered = accessible.filter(c => {
    const p = profiles.find(x => x.id === c.profileId);
    return (c.title.toLowerCase().includes(q) || (c.parties || "").toLowerCase().includes(q) || (p && p.name.toLowerCase().includes(q))) &&
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
        <div style="font-size:12px;color:var(--text-dim);display:flex;align-items:center;gap:6px;flex-wrap:wrap">
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

// ═══════════════════════════════════════════════════════════════
//  CASE DETAIL (DEDUPLICATED UPLOAD BUTTON)
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

  const detailHeaderActions = document.querySelector("#view-caseDetail .flex-center.gap-10");
  if (detailHeaderActions) {
    const backBtn = document.getElementById("cd-back-btn");
    if (backBtn) backBtn.onclick = () => { showView("profileDetail"); renderProfileDetail(); };
  }

  const chip = document.getElementById("cd-profile-chip");
  if (chip) {
    if (p) {
      chip.innerHTML = `${avatarDiv(p.name, p.avatarColor, 28, p.photoUrl)}<div><div style="font-size:14px;font-weight:600;color:var(--text)">${escHtml(p.name)}</div><div style="font-size:12px;color:var(--text-dim)">${escHtml(p.role || "Attorney")}</div></div><span style="font-size:12px;color:var(--text-dim);margin-left:8px">→ view profile</span>`;
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
        ["Parties", c.parties || "None"],
        ["Venue", c.venue || "N/A"],
        ["Date Case Filed", formatDate(c.filedDate)],
        ["Due Date", c.dueDate ? formatDate(c.dueDate) : "Not set"],
        ["Added", c.createdAt || "N/A"]
      ].map(([l, v]) => `
        <div style="margin-bottom:16px">
          <div style="font-size:11px;color:var(--text-dim);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px;font-weight:600">${l}</div>
          <div style="font-size:15px;color:var(--text)">${escHtml(v)}</div>
        </div>`).join("")}
      <div>
        <div style="font-size:11px;color:var(--text-dim);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;font-weight:600">Narrative</div>
        <div style="font-size:15px;color:var(--text-muted);line-height:1.8">${escHtml(c.narrative || "")}</div>
      </div>`;
  }

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
              <div style="font-size:12px;color:var(--text-dim)">
                ${doc.size} · ${doc.date}${doc.driveFileId ? " · ✅ Drive" : ""}
              </div>
            </div>
            ${canEdit ? `<button style="background:transparent;border:none;color:var(--red);font-size:18px;cursor:pointer;padding:2px 10px;flex-shrink:0" onclick="removeDocFromCase(${realIdx})">×</button>` : ""}
          </div>
        </div>
      `;
    };

    if (inboundDocs.length > 0) {
      docsHtml += `<div style="font-size:11px;font-weight:700;color:var(--text-dim);margin:14px 0 6px;text-transform:uppercase;letter-spacing:1px">📥 Inbound Documents</div>`;
      inboundDocs.forEach(d => { docsHtml += renderDocRow(d); });
    }

    if (outboundDocs.length > 0) {
      docsHtml += `<div style="font-size:11px;font-weight:700;color:var(--text-dim);margin:14px 0 6px;text-transform:uppercase;letter-spacing:1px">📤 Outbound Documents</div>`;
      outboundDocs.forEach(d => { docsHtml += renderDocRow(d); });
    }

    if (otherDocs.length > 0) {
      docsHtml += `<div style="font-size:11px;font-weight:700;color:var(--text-dim);margin:14px 0 6px;text-transform:uppercase;letter-spacing:1px">📋 Other Files</div>`;
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
          <button onclick="confirmUpdateCaseStatus('${st}')" style="display:block;width:100%;margin-bottom:8px;padding:10px 16px;border-radius:10px;border:1px solid ${c.status === st ? statusColor(st) : "var(--border)"};background:${c.status === st ? statusColor(st) + "18" : "transparent"};color:${c.status === st ? statusColor(st) : "var(--text-muted)"};text-align:left;cursor:pointer;font-size:13px;font-family:var(--font-body);font-weight:${c.status === st ? 700 : 500};transition:all 0.2s">
            ${c.status === st ? "✓ " : ""}${st}
          </button>`).join("")}`;
    } else {
      statusPanelEl.innerHTML = `
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:10px">Current Status</div>
        ${badge(c.status, statusColor(c.status))}
        <div style="font-size:11.5px;color:var(--text-dim);margin-top:8px">You have Viewer access for this case. Status modifications are restricted to Editors & Owners.</div>
      `;
    }
  }
}

// ── CONFIRMATION BOX FOR STATUS UPDATE ──
window.confirmUpdateCaseStatus = async function(st) {
  if (!selCase) return;
  if (selCase.status === st) return;
  
  if (!confirm(`Are you sure you want to update the status of "${selCase.title}" to "${st}"?`)) {
    return;
  }
  updateCaseStatus(st);
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

async function removeDocFromCase(idx) {
  try {
    const docs = selCase.documents || [];
    const doc = docs[idx];
    if (doc && doc.driveFileId && typeof deleteDriveFile === "function") {
      await deleteDriveFile(doc.driveFileId);
    }
    const updDocs = docs.filter((_, i) => i !== idx);
    await dbUpdateCase(selCase.id, { documents: updDocs });
    selCase = { ...selCase, documents: updDocs };
    renderCaseDetail();
    showToast("Document removed");
  } catch (err) {
    console.error("removeDocFromCase error:", err);
    showToast("Failed to remove document: " + (err.message || "Unknown error"), "error");
  }
}

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
  selCase = cases.find(c => c.id === id);
  if (!selCase) return;
  const p = profiles.find(x => x.id === selCase.profileId);
  if (p) selProfile = p;
  showView("caseDetail");
  renderCaseDetail();
}

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
      <div style="font-size:12px;font-weight:700;color:#ffffff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(myProf.name)}</div>
      <div style="font-size:10px;color:rgba(255,255,255,0.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(myProf.email)}</div>
    </div>
  `;
  chip.style.display = "flex";

  if (adminSection) {
    if (myProf.role === "admin") {
      adminSection.style.display = "block";
    } else {
      adminSection.style.display = "none";
    }
  }
}

function openCurrentProfile() {
  if (selProfile) openProfile(selProfile.id);
}

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
  if (days < 0)   return `<span style="font-size:11px;font-weight:700;color:var(--red)">⚠ Overdue (${formatted})</span>`;
  if (days === 0) return `<span style="font-size:11px;font-weight:700;color:var(--red)">⚠ Due today</span>`;
  if (days <= 7)  return `<span style="font-size:11px;font-weight:700;color:var(--amber)">⚡ ${days}d left (${formatted})</span>`;
  if (days <= 30) return `<span style="font-size:11px;font-weight:600;color:var(--gold)">📅 ${days}d (${formatted})</span>`;
  return `<span style="font-size:11px;color:var(--text-dim)">Due ${formatted}</span>`;
}

function updateAllFilterDropdowns() {
  ["pd", "ac"].forEach(prefix => {
    const statusSel = document.getElementById(prefix + "-status");
    const catSel = document.getElementById(prefix + "-category");
    if (!statusSel || !catSel) return;

    const curStatus = statusSel.value;
    const curCat = catSel.value;

    statusSel.innerHTML = `<option value="All">⚡ All Statuses</option>` + 
      STATUS_OPTIONS.map(s => `<option value="${s}">${s}</option>`).join("");
    statusSel.value = curStatus || "All";

    catSel.innerHTML = `<option value="All">📂 All Categories</option>` + 
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

  typeSel.innerHTML = `<option value="All">⚖️ All Types</option>` + 
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

// ═══════════════════════════════════════════════════════════════
//  FIRM SCHEDULE & REAL-TIME MONTHLY CALENDAR GRID
// ═══════════════════════════════════════════════════════════════
let currentCalYear = new Date().getFullYear();
let currentCalMonth = new Date().getMonth();

function renderCalendarView() {
  const select = document.getElementById("calendar-filter-select");
  if (select) {
    const curVal = select.value;
    
    let optionsHtml = `<option value="Everyone">🌐 Everyone (Firm Overview)</option>`;
    
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
  currentCalYear = now.getFullYear();
  currentCalMonth = now.getMonth();
  renderMonthlyCalendarGrid();
}

function renderMonthlyCalendarGrid() {
  const titleEl = document.getElementById("cal-month-title");
  const gridEl = document.getElementById("calendar-grid-container");
  if (!gridEl) return;

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  if (titleEl) {
    titleEl.textContent = `${monthNames[currentCalMonth]} ${currentCalYear}`;
  }

  const filter = document.getElementById("calendar-filter-select")?.value || "Everyone";

  let activeCases = getAccessibleCases().filter(c => c.dueDate);
  let activeAppts = appointments.filter(a => a.status === "accepted");

  if (filter !== "Everyone") {
    const matchedProf = profiles.find(p => p.ownerUid === filter);
    activeCases = activeCases.filter(c => c.profileId === matchedProf?.id);
    activeAppts = activeAppts.filter(a => a.targetUid === filter || a.requesterUid === filter);
  }

  const eventsByDate = {};
  activeCases.forEach(c => {
    if (!eventsByDate[c.dueDate]) eventsByDate[c.dueDate] = [];
    eventsByDate[c.dueDate].push({ 
      id: c.id, 
      type: "case", 
      title: c.title, 
      category: c.category || "Case", 
      typeName: c.type || "Case", 
      venue: c.venue || "N/A" 
    });
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
  const prevMonthDays = new Date(currentCalYear, currentCalMonth, 0).getDate();

  const todayObj = new Date();
  const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

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
    const dayEvents = eventsByDate[fullDateStr] || [];

    const hasBusy = dayEvents.some(e => e.type === "busy");
    const hasCase = dayEvents.some(e => e.type === "case");
    const hasAppt = dayEvents.some(e => e.type === "appt");

    let dotsHtml = "";
    if (dayEvents.length > 0) {
      dotsHtml = `<div style="display:flex;gap:4px;margin-top:auto;padding-top:4px;justify-content:center;flex-wrap:wrap">`;
      if (hasBusy) dotsHtml += `<span title="Unavailable / Out of Office" style="width:7px;height:7px;border-radius:50%;background:var(--red);display:inline-block"></span>`;
      if (hasCase) dotsHtml += `<span title="Case Deadline" style="width:7px;height:7px;border-radius:50%;background:var(--gold);display:inline-block"></span>`;
      if (hasAppt) dotsHtml += `<span title="Appointment / Meeting" style="width:7px;height:7px;border-radius:50%;background:var(--violet);display:inline-block"></span>`;
      dotsHtml += `</div>`;
    }

    html += `
      <div class="cal-day-cell ${isToday ? 'is-today' : ''}" 
           onclick="openDateScheduleModal('${fullDateStr}')" 
           title="Click to view events for ${fullDateStr}">
        <span class="cal-day-num">${day}</span>
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

// ═══════════════════════════════════════════════════════════════
//  DATE POPUP MODAL CONTROLLER
// ═══════════════════════════════════════════════════════════════
window.openDateScheduleModal = function(dateStr) {
  const modal = document.getElementById("date-schedule-modal");
  const titleEl = document.getElementById("dsm-title");
  const listEl = document.getElementById("dsm-events-list");

  if (!modal || !listEl) return;

  const formattedDate = formatDate(dateStr);
  if (titleEl) titleEl.textContent = `📅 Schedule for ${formattedDate}`;

  const u = window._currentUser || window._auth?.currentUser;
  const currentUid = u?.uid || "";

  const dateCases = getAccessibleCases().filter(c => c.dueDate === dateStr);
  const dateAppts = appointments.filter(a => a.date === dateStr && a.status === "accepted");

  const allItems = [];

  dateCases.forEach(c => {
    const p = profiles.find(x => x.id === c.profileId);
    allItems.push({
      id: c.id,
      kind: "case",
      badgeColor: "var(--gold)",
      badgeLabel: "⚖️ Case Deadline",
      title: c.title,
      sub: `${p?.name || "Attorney"} · ${c.type || c.category || "Case"} · ${c.venue || "Venue N/A"}`,
      desc: c.narrative || "No narrative available.",
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
      badgeLabel: isBusy ? "🚫 Out of Office / Busy" : "🤝 Approved Appointment",
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
        <div style="font-size:13px;color:var(--text-muted)">No schedules, appointments, or deadlines for this date.</div>
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
            ${item.time ? `<span style="font-size:11.5px;color:var(--text-dim);font-weight:600">⏰ ${item.time}</span>` : ""}
            ${item.canDelete ? `<button onclick="deleteBusySlot('${item.id}', '${item.dateStr}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:13px;padding:2px 6px;border-radius:4px" title="Delete your availability entry">🗑️ Remove</button>` : ""}
          </div>
        </div>
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px">${escHtml(item.title)}</div>
        <div style="font-size:12px;color:var(--text-dim);margin-bottom:6px">${escHtml(item.sub)}</div>
        ${item.desc ? `<div style="font-size:12px;color:var(--text-muted);background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:8px 10px;line-height:1.5;white-space:pre-wrap">${escHtml(item.desc)}</div>` : ""}
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
//  PERSONAL SETTINGS & 2FA MANAGEMENT
// ═══════════════════════════════════════════════════════════════
let settingsPhotoDataUrl = null;

function renderMyProfile() {
  const u = window._currentUser;
  if (!u) return;

  const myProf = profiles.find(p => p.ownerUid === u.uid);
  if (!myProf) return;

  const nameEl = document.getElementById("setting-name");
  const roleEl = document.getElementById("setting-role");
  const contactEl = document.getElementById("setting-contact");
  const emailEl = document.getElementById("setting-email");
  const passEl = document.getElementById("setting-password");
  const curPassEl = document.getElementById("setting-current-password");
  const reauthEl = document.getElementById("setting-reauth-panel");

  if (nameEl) nameEl.value = myProf.name || "";
  if (roleEl) roleEl.value = myProf.role || "Attorney";
  if (contactEl) contactEl.value = myProf.contact || "";
  if (emailEl) emailEl.value = u.email || "";
  if (passEl) passEl.value = "";
  if (curPassEl) curPassEl.value = "";
  if (reauthEl) reauthEl.style.display = "none";

  settingsPhotoDataUrl = myProf.photoUrl || null;
  if (settingsPhotoDataUrl) {
    showSettingsPhotoPreview(settingsPhotoDataUrl, myProf.name, myProf.role);
  } else {
    resetSettingsPhotoUpload();
  }

  const statusEl = document.getElementById("settings-drive-status");
  const btn = document.getElementById("settings-connect-drive-btn");
  const btnText = document.getElementById("settings-connect-drive-text");

  if (statusEl && btn && btnText) {
    if (hasValidToken()) {
      statusEl.className = "drive-status-chip connected";
      statusEl.textContent = "● Connected";
      btnText.textContent = "✓ Google Drive Connected";
      btn.classList.add("connected");
      btn.disabled = true;
    } else {
      statusEl.className = "drive-status-chip disconnected";
      statusEl.textContent = "● Not Connected";
      btnText.textContent = "Connect Google Drive";
      btn.classList.remove("connected");
      btn.disabled = false;
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
      tfaBadge.textContent = "● 2FA Enabled";

      tfaBtn.className = "btn btn-danger btn-sm";
      tfaBtn.textContent = "Disable 2FA";
      tfaBtn.onclick = disableTwoFactor;

      if (tfaBackupWrap) tfaBackupWrap.style.display = "block";
    } else {
      tfaBadge.className = "badge";
      tfaBadge.style.background = "rgba(251,191,36,0.15)";
      tfaBadge.style.color = "var(--amber)";
      tfaBadge.textContent = "● Not Enabled";

      tfaBtn.className = "btn btn-primary btn-sm";
      tfaBtn.textContent = "Enable 2FA";
      tfaBtn.onclick = openTwoFactorSetupModal;

      if (tfaBackupWrap) tfaBackupWrap.style.display = "none";
    }
  }
}

async function connectDriveFromSettings() {
  const btn = document.getElementById("settings-connect-drive-btn");
  const btnText = document.getElementById("settings-connect-drive-text");
  if (!btn) return;

  btn.disabled = true;
  if (btnText) btnText.textContent = "Connecting...";

  try {
    await waitForGoogleDriveReady();
    await promptDriveAuth();
    showToast("Google Drive connected successfully!");
    renderMyProfile();
    
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

async function saveUserSettings() {
  const u = window._currentUser;
  if (!u) return;

  const myProf = profiles.find(p => p.ownerUid === u.uid);
  if (!myProf) return;

  const name = (document.getElementById("setting-name")?.value || "").trim();
  const role = (document.getElementById("setting-role")?.value || "").trim();
  const contact = (document.getElementById("setting-contact")?.value || "").trim();

  if (!name || !role) {
    showToast("Name and Role are required.", "error");
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
    html += `<div style="text-align:center;padding:24px 12px;color:var(--text-dim);border:1px dashed var(--border);border-radius:10px">
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
      html += `<div style="text-align:center;padding:24px 12px;color:var(--text-dim);border:1px dashed var(--border);border-radius:10px;font-size:12px">
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
        
        const locationMarkup = ev.location ? `<div style="font-size:11.5px;color:var(--text-dim);margin-top:2px;display:flex;align-items:center;gap:4px">📍 ${escHtml(ev.location)}</div>` : "";
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
              <div style="font-size:11px;color:var(--text-dim);margin-top:2px">📅 ${dateStr} · ⏰ ${timeStr}</div>
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
        <strong style="color:var(--amber)">🔒 Google Calendar API Access Denied (403)</strong><br>
        Please ensure the <strong>Google Calendar API</strong> is enabled inside your Google Cloud Console for this project Client ID.
      </div>`;
    } else {
      html += `<div style="text-align:center;padding:20px;color:var(--red);font-size:12px">
        ⚠ Failed to load Google Calendar Agenda. Click refresh to try again.
      </div>`;
    }
  }
  card.innerHTML = html;
}

if (!window._calendarIntervalId) {
  window._calendarIntervalId = setInterval(() => {
    if (currentView === "dashboard" && hasValidToken() && document.visibilityState === "visible" && typeof fetchAndRenderGoogleCalendarEvents === "function") {
      fetchAndRenderGoogleCalendarEvents();
    }
  }, 15000); 
}

// ═══════════════════════════════════════════════════════════════
//  REAL-TIME NOTIFICATIONS SYSTEM & INTERACTIVE CLICK NAVIGATION
// ═══════════════════════════════════════════════════════════════
window.toggleNotifDropdown = function() {
  const dropdown = document.getElementById("notif-dropdown");
  if (!dropdown) return;
  dropdown.classList.toggle("hidden");
  if (!dropdown.classList.contains("hidden")) {
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
    listEl.innerHTML = `<div class="empty-state" style="padding:24px 10px"><div class="empty-state-icon" style="font-size:28px;margin-bottom:6px">🔔</div><div style="font-size:12px;color:var(--text-dim)">No notifications found.</div></div>`;
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

  const titleInp = document.getElementById("appt-title");
  const dateInp = document.getElementById("appt-date");
  const timeInp = document.getElementById("appt-time");
  const descInp = document.getElementById("appt-desc");
  const modalSub = document.getElementById("appointment-modal-sub");

  if (titleInp) titleInp.value = "";
  if (dateInp) dateInp.value = "";
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

  const u = window._currentUser;
  const myProf = profiles.find(p => p.ownerUid === u.uid);
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
//  CASE FORM INITIALIZATION & STATUS POPULATION
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

async function openAddCase() {
  caseFormOrigin = currentView;
  
  const u = window._currentUser || window._auth?.currentUser;
  if (!u) return;

  const myProf = profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase()));
  if (!myProf) {
    showToast("Your attorney profile is still loading. Please wait a moment.", "error");
    return;
  }

  if (typeof hasValidToken === "function" && !hasValidToken()) {
    openDriveWarningModal();
  }

  selProfile = myProf;
  caseFormMode = "add";
  pendingDocs = [];
  cfPetitioners = selProfile.name ? [selProfile.name] : [];
  cfRespondents = [];
  
  populateCaseSelects(false);

  setElText("cf-title", "New Case");
  setElText("cf-save-btn", "Add Case");
  setElVal("cf-case-title", "");
  setElVal("cf-narrative", "");
  setElVal("cf-filed", "");
  setElVal("cf-due", "");
  setElVal("cf-case-number", "");
  setElVal("cf-doc-type", "");
  setElVal("cf-type-input", "");
  setElVal("cf-status", "On-going");
  setVenueValue(VENUES[0]);
  setElText("drive-status", "");
  
  const backBtn = document.getElementById("cf-back-btn");
  if (backBtn) backBtn.onclick = () => navTo(caseFormOrigin);

  const cancelBtn = document.getElementById("cf-cancel-btn");
  if (cancelBtn) cancelBtn.onclick = () => navTo(caseFormOrigin);
  
  const firstCat = CASE_CATEGORIES[0];
  setElVal("cf-category", firstCat);
  await onCategoryChange(firstCat);
  renderPartyLists();
  serializeParties();
  renderPendingDocs();
  clearCaseErrors();
  updateCfChip();
  updateDriveFolderChip();
  showView("caseForm");
}

async function openEditCase() {
  const c = selCase;
  if (!c) return;
  caseFormMode = "edit";
  pendingDocs = [...(c.documents || [])];
  parsePartiesString(c.parties);
  
  populateCaseSelects(true);

  setElText("cf-title", "Edit Case");
  setElText("cf-save-btn", "Save Changes");
  setElVal("cf-case-title", c.title);
  setElVal("cf-narrative", c.narrative);
  setElVal("cf-filed", c.filedDate || "");
  setElVal("cf-due", c.dueDate || "");
  setElVal("cf-case-number", c.caseNumber || "");
  setElVal("cf-doc-type", c.docType || "");
  setVenueValue(c.venue);
  
  const cat = c.category || CASE_CATEGORIES[0];
  setElVal("cf-category", cat);
  await onCategoryChange(cat);
  setElVal("cf-type-input", c.type || "");
  
  setElText("drive-status", pendingDocs.length ? `${pendingDocs.length} file(s)` : "");

  const backBtn = document.getElementById("cf-back-btn");
  if (backBtn) backBtn.onclick = () => { showView("caseDetail"); renderCaseDetail(); };

  const cancelBtn = document.getElementById("cf-cancel-btn");
  if (cancelBtn) cancelBtn.onclick = () => { showView("caseDetail"); renderCaseDetail(); };

  renderPartyLists();
  serializeParties();
  renderPendingDocs();
  clearCaseErrors();
  updateCfChip();
  updateDriveFolderChip();
  showView("caseForm");
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
    listEl.innerHTML = `<div style="text-align:center;color:var(--text-dim);font-size:13px;padding:16px">No other associate attorneys are currently registered in the system.</div>`;
  } else {
    listEl.innerHTML = associates.map(p => {
      const isChecked = sharedUids.includes(p.ownerUid);
      const role = permissions[p.ownerUid] || "viewer";
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px 14px">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;flex:1;min-width:0;margin:0">
            <input type="checkbox" name="share-associate-checkbox" value="${p.ownerUid}" ${isChecked ? 'checked' : ''} onchange="toggleShareRoleSelect('${p.ownerUid}', this.checked)" style="accent-color:var(--gold);width:16px;height:16px;margin:0"/>
            ${avatarDiv(p.name, p.avatarColor, 30, p.photoUrl)}
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(p.name)}</div>
              <div style="font-size:11px;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(p.email)}</div>
            </div>
          </label>
          <select id="share-role-${p.ownerUid}" class="filter-select" style="width:105px;padding:4px 22px 4px 8px;font-size:11.5px;margin-left:8px;${!isChecked ? 'opacity:0.4;pointer-events:none' : ''}">
            <option value="viewer" ${role === 'viewer' ? 'selected' : ''}>👁 Viewer</option>
            <option value="editor" ${role === 'editor' ? 'selected' : ''}>✏️ Editor</option>
          </select>
        </div>
      `;
    }).join("");
  }

  const modal = document.getElementById("share-modal");
  if (modal) modal.classList.remove("hidden");
}

function toggleShareRoleSelect(uid, isChecked) {
  const select = document.getElementById(`share-role-${uid}`);
  if (select) {
    select.style.opacity = isChecked ? "1" : "0.4";
    select.style.pointerEvents = isChecked ? "all" : "none";
  }
}

async function saveShareSettings() {
  if (!selCase) return;
  const checkboxes = document.querySelectorAll('input[name="share-associate-checkbox"]');
  const selectedUids = [];
  const permissions = {};

  checkboxes.forEach(cb => {
    if (cb.checked) {
      const uid = cb.value;
      selectedUids.push(uid);
      const roleSel = document.getElementById(`share-role-${uid}`);
      permissions[uid] = roleSel ? roleSel.value : "viewer";
    }
  });

  const ownerUid = selCase.ownerUid || window._currentUser.uid;
  const allowedUids = [ownerUid, ...selectedUids];

  try {
    showToast("Updating share settings...");
    await dbUpdateCase(selCase.id, {
      sharedWith: selectedUids,
      allowedUids: allowedUids,
      permissions: permissions
    });

    const myProf = profiles.find(p => p.ownerUid === window._currentUser.uid);
    for (const sharedUid of selectedUids) {
      if (!selCase.sharedWith || !selCase.sharedWith.includes(sharedUid)) {
        const permRole = permissions[sharedUid] === "editor" ? "Editor ✏️" : "Viewer 👁";
        await dbAddNotification({
          toUid: sharedUid,
          fromUid: window._currentUser.uid,
          fromName: myProf?.name || "Attorney",
          title: "📁 Case Shared With You",
          message: `${myProf?.name || "An attorney"} granted you ${permRole} access to case "${selCase.title}".`,
          type: "case_share",
          relatedId: selCase.id,
          status: "unread"
        });
      }
    }

    selCase.sharedWith = selectedUids;
    selCase.allowedUids = allowedUids;
    selCase.permissions = permissions;

    closeShareModal();
    renderCaseDetail();
    showToast("Share settings & permissions saved!");
  } catch (err) {
    console.error("saveShareSettings error:", err);
    showToast("Failed to share case: " + err.message, "error");
  }
}

// ═══════════════════════════════════════════════════════════════
//  GOOGLE DRIVE EXPLORER REPLICA
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

    if (targetFolder) {
      nativeBtn.href = "https://drive.google.com/drive/folders/" + targetFolder;
      nativeBtn.style.display = "inline-flex";
    } else {
      nativeBtn.href = "https://drive.google.com";
      nativeBtn.style.display = "inline-flex";
    }
  }

  if (!hasValidToken()) {
    listEl.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-dim)">
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

    const q = encodeURIComponent("'" + currentExplorerFolderId + "' in parents and trashed = false");
    const url = "https://www.googleapis.com/drive/v3/files?q=" + q + "&fields=files(id,name,mimeType,size,webViewLink)&orderBy=folder,name";

    const res = await fetch(url, {
      headers: { Authorization: "Bearer " + accessToken }
    });

    if (!res.ok) throw new Error("Failed to load folder files");

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
        <div ${onClickAction} style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:16px;text-align:center;cursor:pointer;transition:all 0.2s" onmouseenter="this.style.borderColor='var(--gold-border)';this.style.background='var(--surface3)'" onmouseleave="this.style.borderColor='var(--border)';this.style.background='var(--surface2)'">
          <div style="font-size:32px;margin-bottom:8px">${icon}</div>
          <div style="font-size:12.5px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escHtml(f.name)}">${escHtml(f.name)}</div>
          ${sizeText ? '<div style="font-size:11px;color:var(--text-dim);margin-top:2px">' + sizeText + '</div>' : ""}
        </div>
      `;
    }).join("");

  } catch (err) {
    console.error("loadExplorerFiles error:", err);
    listEl.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--red);font-size:13px;padding:40px">⚠ Failed to load explorer directory items.</div>`;
  }
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
