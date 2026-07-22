// ═══════════════════════════════════════════════════════════════
//  THEME TOGGLE
// ═══════════════════════════════════════════════════════════════
function initTheme() {
  const saved = localStorage.getItem('simando-theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
  }
}

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
  if (["dashboard","profiles","allcases","myprofile","calendar","notifications","mydrive"].includes(name)) {
    const btn = document.querySelector(`.nav-btn[data-nav="${name}"]`);
    if (btn) btn.classList.add("active");
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
//  DASHBOARD
// ═══════════════════════════════════════════════════════════════
function renderDashboard() {
  const todayDateEl = document.getElementById("today-date");
  if (todayDateEl) {
    todayDateEl.textContent = new Date().toLocaleDateString("en-PH",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
  }

  const statProfilesEl = document.getElementById("stat-profiles");
  const statTotalEl = document.getElementById("stat-total");
  const statOngoingEl = document.getElementById("stat-ongoing");
  const statCompletedEl = document.getElementById("stat-completed");

  if (statProfilesEl) statProfilesEl.textContent = profiles.length;
  if (statTotalEl) statTotalEl.textContent = cases.length;
  if (statOngoingEl) statOngoingEl.textContent = cases.filter(c => c.status === "On-going").length;
  if (statCompletedEl) statCompletedEl.textContent = cases.filter(c => c.status === "Completed").length;

  renderDashProfiles();

  const dcEl = document.getElementById("dash-cases");
  if (!dcEl) return;

  const displayCases = cases.slice(0, 6);

  dcEl.innerHTML = displayCases.length === 0
    ? '<div class="empty-state"><div class="empty-state-icon">📁</div><div>No cases yet.</div></div>'
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
      return `<div class="flex-center gap-10" style="padding:11px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:9px;margin-bottom:8px;cursor:pointer;transition:all 0.2s" onclick="openCase('${c.id}')" onmouseenter="this.style.borderColor='var(--gold)'" onmouseleave="this.style.borderColor='var(--border)'">
        ${p ? avatarDiv(p.name, p.avatarColor, 30, p.photoUrl) : ""}
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.title}</div>
          <div style="font-size:11px;color:var(--text-dim);margin-top:2px">${p?.name || ""} · ${c.type || c.category || "Case"}</div>
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
    const pc = cases.filter(c => c.profileId === p.id);
    return `<div style="padding:12px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:11px;margin-bottom:10px;cursor:pointer;transition:all 0.2s" onclick="openProfile('${p.id}')" onmouseenter="this.style.borderColor='var(--gold-border)';this.style.background='var(--surface3)'" onmouseleave="this.style.borderColor='var(--border)';this.style.background='var(--surface2)'">
      <div style="display:flex;align-items:center;gap:12px">
        ${avatarDiv(p.name, p.avatarColor, 38, p.photoUrl)}
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px;color:var(--text)">${p.name}</div>
          <div style="font-size:11px;color:var(--text-dim);margin-top:1px">${p.role || "Attorney"} · ${pc.length} case${pc.length !== 1 ? "s" : ""}</div>
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

  if (profiles.length === 0) {
    el.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">👥</div><div style="font-size:13px;color:var(--text-dim)">No associate attorneys are currently registered.</div></div>`;
    return;
  }

  el.innerHTML = profiles.map(p => {
    const pc = cases.filter(c => c.profileId === p.id);
    const ongoing = pc.filter(c => c.status === "On-going").length;
    const isMe = p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase());
    
    return `
      <div class="profile-card" onclick="openProfile('${p.id}')" style="${isMe ? 'border-color:var(--gold-border); background:rgba(201,168,76,0.03)' : ''}">
        <div class="flex-center gap-14 mb-16">
          ${avatarDiv(p.name, p.avatarColor, 50, p.photoUrl)}
          <div>
            <div style="font-weight:700;font-size:16px;color:var(--text)">
              ${p.name} ${isMe ? '<span style="font-size:10px;color:var(--gold);background:rgba(201,168,76,0.1);padding:2px 6px;border-radius:4px;margin-left:6px;font-weight:600">YOU</span>' : ""}
            </div>
            <div style="font-size:13px;color:var(--text-dim)">${p.role}</div>
          </div>
        </div>
        <hr class="divider"/>
        ${p.email ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:5px">✉ ${p.email}</div>` : ""}
        ${p.contact ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">📞 ${p.contact}</div>` : ""}
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:13px;color:var(--text-dim)">Private Files</span>
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

  const isOwner = p.ownerUid === window._currentUser?.uid;

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
        <div style="font-size:24px;font-weight:700;color:var(--text)">${p.name}</div>
        <div style="font-size:14px;color:var(--text-muted);margin-top:3px">${p.role}</div>
        <div style="display:flex;gap:18px;margin-top:10px;flex-wrap:wrap;align-items:center">
          ${p.email ? `<span style="font-size:12px;color:var(--text-dim)">✉ ${p.email}</span>` : ""}
          ${p.contact ? `<span style="font-size:12px;color:var(--text-dim)">📞 ${p.contact}</span>` : ""}
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

  if (isOwner) {
    if (noticeEl) noticeEl.style.display = "none";
    if (sectionEl) sectionEl.style.display = "block";
    if (statsEl) {
      statsEl.style.display = "grid";
      const pc = cases.filter(c => c.profileId === p.id);
      const docs = pc.reduce((a, c) => a + (c.documents?.length || 0), 0);

      statsEl.innerHTML = [
        ["Total Cases", pc.length, "var(--violet)"],
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
  const pc       = cases.filter(c => c.profileId === p.id);

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
      ? '<div class="empty-state-icon">⚖️</div><div>No cases yet</div>'
      : '<div class="empty-state-icon">🔍</div><div>No cases match your filters.</div>'
    }</div>`;
    return;
  }
  el.innerHTML = filtered.map(c => `
    <div class="case-row" onclick="openCase('${c.id}')">
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:15px;color:var(--text);margin-bottom:4px">${c.title}</div>
        <div style="font-size:13px;color:var(--text-dim)">${c.type || c.category || "Case"} · ${c.venue || "No Venue"}</div>
        <div style="font-size:13px;color:var(--text-dim);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.parties || ""}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">
        ${badge(c.status, statusColor(c.status))}
        ${dueBadge(c.dueDate)}
        <span style="font-size:11px;color:var(--text-dim)">${c.documents?.length || 0} doc${c.documents?.length !== 1 ? "s" : ""}</span>
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

  let filtered = cases.filter(c => {
    const p = profiles.find(x => x.id === c.profileId);
    return (c.title.toLowerCase().includes(q) || (c.parties || "").toLowerCase().includes(q) || (p && p.name.toLowerCase().includes(q))) &&
      (status === "All" || c.status === status) &&
      (category === "All" || c.category === category) &&
      (type === "All" || c.type === type);
  });
  filtered = sortCasesByDue(filtered, sort);

  const countEl = document.getElementById("allcases-count");
  if (countEl) countEl.textContent = `${filtered.length} case${filtered.length !== 1 ? "s" : ""} found`;

  const el = document.getElementById("all-cases-list");
  if (!el) return;

  if (filtered.length === 0) {
