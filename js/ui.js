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
  document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));
  const el = document.getElementById("view-"+name);
  if (el) el.classList.remove("hidden");
  currentView = name;
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
  if (["dashboard","profiles","allcases","myprofile"].includes(name)) {
    const btn = document.querySelector(`.nav-btn[data-nav="${name}"]`);
    if (btn) btn.classList.add("active");
  }
}

function navTo(view) {
  const pd = document.getElementById("pd-search");
  const ac = document.getElementById("ac-search");
  if (pd) pd.value = "";
  if (ac) ac.value = "";
  ["pd-status","pd-category","pd-type","ac-status","ac-category","ac-type"].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value="All";
  });
  ["pd-sort","ac-sort"].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value="asc";
  });
  showView(view);
  if (view==="dashboard") renderDashboard();
  if (view==="profiles")  renderProfiles();
  if (view==="allcases")  renderAllCases();
  if (view==="myprofile") renderMyProfile();
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
  if (statOngoingEl) statOngoingEl.textContent = cases.filter(c=>c.status==="On-going").length;
  if (statCompletedEl) statCompletedEl.textContent = cases.filter(c=>c.status==="Completed").length;

  renderDashProfiles();

  const dcEl = document.getElementById("dash-cases");
  if (!dcEl) return;

  const displayCases = cases.slice(0,6);

  dcEl.innerHTML = displayCases.length===0
    ? '<div class="empty-state"><div class="empty-state-icon">📁</div><div>No cases yet.</div></div>'
    : displayCases.map(c=>{
      const p = profiles.find(x=>x.id===c.profileId);
      const daysLeft = c.dueDate ? Math.ceil((new Date(c.dueDate)-new Date())/(1000*60*60*24)) : null;
      const urgency = daysLeft !== null
        ? (daysLeft < 0   ? {col:"var(--red)",   label:"Overdue"}
         : daysLeft <= 7  ? {col:"var(--red)",   label:daysLeft===0?"Due today":`${daysLeft}d left`}
         : daysLeft <= 30 ? {col:"var(--amber)", label:`${daysLeft}d left`}
         :                  {col:"var(--text-dim)",label:`${daysLeft}d left`})
        : null;
      return `<div class="flex-center gap-10" style="padding:11px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:9px;margin-bottom:8px;cursor:pointer;transition:all 0.2s" onclick="openCase('${c.id}')" onmouseenter="this.style.borderColor='var(--gold)'" onmouseleave="this.style.borderColor='var(--border)'">
        ${p?avatarDiv(p.name,p.avatarColor,30,p.photoUrl):""}
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.title}</div>
          <div style="font-size:11px;color:var(--text-dim);margin-top:2px">${p?.name||""} · ${c.type}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
          ${badge(c.status,statusColor(c.status))}
          ${urgency?`<span style="font-size:10px;font-weight:600;color:${urgency.col}">${urgency.label}</span>`:""}
        </div>
      </div>`;
    }).join("");

  renderQuickAccess();
  fetchAndRenderGoogleCalendarEvents();
}

function getNearestDueCase(profileId) {
  const active = cases.filter(c=>
    c.profileId===profileId && c.dueDate &&
    !["Completed","Dismissed","Settled"].includes(c.status)
  ).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate));
  return active[0] || null;
}

function renderDashProfiles() {
  const q = (document.getElementById("dash-profile-search")?.value||"").toLowerCase().trim();
  const dpEl = document.getElementById("dash-profiles");
  if (!dpEl) return;

  const filtered = profiles.filter(p=>
    !q || p.name.toLowerCase().includes(q) || (p.role||"").toLowerCase().includes(q)
  );

  if (profiles.length===0) {
    dpEl.innerHTML='<div class="empty-state"><div class="empty-state-icon">⚖️</div><div>No attorneys yet. Add your first attorney profile.</div></div>';
    return;
  }
  if (filtered.length===0) {
    dpEl.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-dim);font-size:13px">No attorneys match your search.</div>';
    return;
  }

  dpEl.innerHTML = filtered.slice(0,8).map(p=>{
    const pc = cases.filter(c=>c.profileId===p.id);
    const active = pc.filter(c=>!["Completed","Dismissed","Settled"].includes(c.status));
    const nearest = getNearestDueCase(p.id);
    const daysLeft = nearest?.dueDate ? Math.ceil((new Date(nearest.dueDate)-new Date())/(1000*60*60*24)) : null;
    const urgency = daysLeft !== null
      ? (daysLeft < 0   ? {col:"var(--red)",    label:"⚠ Overdue",       bg:"rgba(248,113,113,0.08)"}
       : daysLeft === 0 ? {col:"var(--red)",    label:"⚠ Due today",     bg:"rgba(248,113,113,0.08)"}
       : daysLeft <= 7  ? {col:"var(--amber)",  label:`⚡ ${daysLeft}d`, bg:"rgba(251,191,36,0.08)"}
       : daysLeft <= 30 ? {col:"var(--gold)",   label:`📅 ${daysLeft}d`, bg:""}
       :                  {col:"var(--text-dim)",label:`${daysLeft}d`,   bg:""})
      : null;

    return `<div style="padding:12px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:11px;margin-bottom:10px;cursor:pointer;transition:all 0.2s" onclick="openProfile('${p.id}')" onmouseenter="this.style.borderColor='var(--gold-border)';this.style.background='var(--surface3)'" onmouseleave="this.style.borderColor='var(--border)';this.style.background='var(--surface2)'">
      <div style="display:flex;align-items:center;gap:12px">
        ${avatarDiv(p.name, p.avatarColor, 38, p.photoUrl)}
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px;color:var(--text)">${p.name}</div>
          <div style="font-size:11px;color:var(--text-dim);margin-top:1px">${p.role||"Attorney"} · ${pc.length} case${pc.length!==1?"s":""}</div>
        </div>
      </div>
    </div>`;
  }).join("");
}

// ═══════════════════════════════════════════════════════════════
//  PROFILES (RESTRUCTURED FOR DUAL-SECTION DIR LAYOUT)
// ═══════════════════════════════════════════════════════════════
function renderProfiles() {
  const u = window._currentUser;
  if (!u) return;

  const countEl = document.getElementById("profiles-count");
  if (countEl) countEl.textContent = `${profiles.length} profile${profiles.length!==1?"s":""} total`;

  // Find logged-in user profile by ownerUid OR registered email address
  const myProf = profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase()));
  const otherProfs = profiles.filter(p => p.id !== (myProf ? myProf.id : ""));

  // 1. Render User's Personal Card
  const myContainer = document.getElementById("profiles-my-profile-container");
  if (myContainer && myProf) {
    const pc = cases.filter(c => c.profileId === myProf.id);
    const ongoing = pc.filter(c => c.status === "On-going").length;

    myContainer.innerHTML = `
      <div style="font-size:11px;color:var(--text-dim);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;font-weight:700">My Profile</div>
      <div class="profile-card" style="max-width:100%; display:flex; gap:20px; align-items:center; flex-wrap:wrap; cursor:pointer; border-color:var(--gold-border); background:rgba(201,168,76,0.03)" onclick="openProfile('${myProf.id}')">
        ${avatarDiv(myProf.name, myProf.avatarColor, 56, myProf.photoUrl)}
        <div style="flex:1; min-width:200px">
          <div style="font-weight:700;font-size:18px;color:var(--text)">${myProf.name} <span style="font-size:11px;color:var(--gold);background:rgba(201,168,76,0.1);padding:2px 8px;border-radius:4px;margin-left:8px;font-weight:600">YOU</span></div>
          <div style="font-size:13px;color:var(--text-dim);margin-top:2px">${myProf.role}</div>
          <div style="display:flex;gap:16px;margin-top:6px;flex-wrap:wrap;font-size:12px;color:var(--text-muted)">
            ${myProf.email?`<span>✉ ${myProf.email}</span>`:""}
            ${myProf.contact?`<span>📞 ${myProf.contact}</span>`:""}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;flex-shrink:0">
          <div style="text-align:right">
            <div style="font-size:14px;color:var(--gold);font-weight:700">${pc.length} case${pc.length!==1?"s":""}</div>
            <div style="font-size:11px;color:var(--text-dim);margin-top:2px">${ongoing} active</div>
          </div>
          <div style="font-size:16px;color:var(--text-dim)">→</div>
        </div>
      </div>
    `;
  } else if (myContainer) {
    myContainer.innerHTML = "";
  }

  // 2. Render Associate Directory List
  const el = document.getElementById("profiles-grid");
  if (!el) return;

  if (otherProfs.length === 0) {
    el.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">👥</div><div style="font-size:13px;color:var(--text-dim)">No other associate attorneys are currently registered.</div></div>`;
    return;
  }

  el.innerHTML = otherProfs.map(p => {
    const pc = cases.filter(c => c.profileId === p.id);
    const ongoing = pc.filter(c => c.status === "On-going").length;
    return `
      <div class="profile-card" onclick="openProfile('${p.id}')">
        <div class="flex-center gap-14 mb-16">
          ${avatarDiv(p.name, p.avatarColor, 50, p.photoUrl)}
          <div>
            <div style="font-weight:700;font-size:16px;color:var(--text)">${p.name}</div>
            <div style="font-size:13px;color:var(--text-dim)">${p.role}</div>
          </div>
        </div>
        <hr class="divider"/>
        ${p.email?`<div style="font-size:12px;color:var(--text-muted);margin-bottom:5px">✉ ${p.email}</div>`:""}
        ${p.contact?`<div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">📞 ${p.contact}</div>`:""}
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:13px;color:var(--text-dim)">Private Files</span>
          ${p.ownerUid === window._currentUser?.uid && ongoing>0?badge(ongoing+" active","#f59e0b"):""}
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
  }

  const headerCard = document.getElementById("profile-header-card");
  if (headerCard) {
    headerCard.innerHTML = `
      ${avatarDiv(p.name, p.avatarColor, 64, p.photoUrl)}
      <div style="flex:1">
        <div style="font-size:24px;font-weight:700;color:var(--text)">${p.name}</div>
        <div style="font-size:14px;color:var(--text-muted);margin-top:3px">${p.role}</div>
        <div style="display:flex;gap:18px;margin-top:10px;flex-wrap:wrap;align-items:center">
          ${p.email?`<span style="font-size:12px;color:var(--text-dim)">✉ ${p.email}</span>`:""}
          ${p.contact?`<span style="font-size:12px;color:var(--text-dim)">📞 ${p.contact}</span>`:""}
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
      const pc=cases.filter(c=>c.profileId===p.id);
      const docs=pc.reduce((a,c)=>a+(c.documents?.length||0),0);

      statsEl.innerHTML = [
        ["Total Cases",pc.length,"var(--violet)"],
        ["Active",pc.filter(c=>c.status==="On-going").length,"var(--amber)"],
        ["Resolved",pc.filter(c=>c.status==="Completed").length,"var(--green)"],
        ["Documents",docs,"var(--gold)"]
      ].map(([l,n,c])=>`
        <div class="stat-card" style="--accent:${c};padding:16px 18px">
          <div class="stat-number" style="color:${c};font-size:32px">${n}</div>
          <div class="stat-label">${l}</div>
        </div>`).join("");
    }

    populateCaseFilterSelects("pd");
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
  const q      = (document.getElementById("pd-search")?.value||"").toLowerCase();
  const status = document.getElementById("pd-status")?.value || "All";
  const category = document.getElementById("pd-category")?.value || "All";
  const type   = document.getElementById("pd-type")?.value   || "All";
  const sort   = document.getElementById("pd-sort")?.value   || "asc";
  const pc     = cases.filter(c=>c.profileId===p.id);

  let filtered = pc.filter(c=>
    (c.title.toLowerCase().includes(q)||c.parties.toLowerCase().includes(q)) &&
    (status==="All"||c.status===status) &&
    (category==="All"||c.category===category) &&
    (type==="All"||c.type===type)
  );
  filtered = sortCasesByDue(filtered, sort);

  const el = document.getElementById("profile-cases-list");
  if (!el) return;

  if (filtered.length===0) {
    el.innerHTML=`<div class="empty-state">${pc.length===0
      ? '<div class="empty-state-icon">⚖️</div><div>No cases yet</div>'
      : '<div class="empty-state-icon">🔍</div><div>No cases match your filters.</div>'
    }</div>`;
    return;
  }
  el.innerHTML = filtered.map(c=>`
    <div class="case-row" onclick="openCase('${c.id}')">
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:15px;color:var(--text);margin-bottom:4px">${c.title}</div>
        <div style="font-size:13px;color:var(--text-dim)">${c.type} · ${c.venue}</div>
        <div style="font-size:13px;color:var(--text-dim);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.parties}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">
        ${badge(c.status,statusColor(c.status))}
        ${dueBadge(c.dueDate)}
        <span style="font-size:11px;color:var(--text-dim)">${c.documents?.length||0} doc${c.documents?.length!==1?"s":""}</span>
      </div>
    </div>`).join("");
}

// ═══════════════════════════════════════════════════════════════
//  ALL CASES
// ═══════════════════════════════════════════════════════════════
function renderAllCases() {
  populateCaseFilterSelects("ac");
  const q      = (document.getElementById("ac-search")?.value||"").toLowerCase();
  const status = document.getElementById("ac-status")?.value || "All";
  const category = document.getElementById("ac-category")?.value || "All";
  const type   = document.getElementById("ac-type")?.value   || "All";
  const sort   = document.getElementById("ac-sort")?.value   || "asc";

  let filtered = cases.filter(c=>{
    const p=profiles.find(x=>x.id===c.profileId);
    return (c.title.toLowerCase().includes(q)||c.parties.toLowerCase().includes(q)||(p&&p.name.toLowerCase().includes(q))) &&
      (status==="All"||c.status===status) &&
      (category==="All"||c.category===category) &&
      (type==="All"||c.type===type);
  });
  filtered = sortCasesByDue(filtered, sort);

  const countEl = document.getElementById("allcases-count");
  if (countEl) countEl.textContent = `${filtered.length} case${filtered.length!==1?"s":""} found`;

  const el = document.getElementById("all-cases-list");
  if (!el) return;

  if (filtered.length===0) {
    el.innerHTML='<div class="empty-state"><div class="empty-state-icon">🔍</div><div>No cases match your filters.</div></div>';
    return;
  }
  el.innerHTML = filtered.map(c=>{
    const p=profiles.find(x=>x.id===c.profileId);
    return `<div class="case-row" onclick="openCase('${c.id}')">
      ${p?avatarDiv(p.name,p.avatarColor,40,p.photoUrl):""}
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:15px;color:var(--text);margin-bottom:4px">${c.title}</div>
        <div style="font-size:13px;color:var(--text-dim)">${p?.name||""} · ${c.type} · ${c.venue}</div>
        <div style="font-size:13px;color:var(--text-dim);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.parties}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">
        ${badge(c.status,statusColor(c.status))}
        ${dueBadge(c.dueDate)}
      </div>
    </div>`;
  }).join("");
}

// ═══════════════════════════════════════════════════════════════
//  CASE DETAIL
// ═══════════════════════════════════════════════════════════════
function renderCaseDetail() {
  const c = selCase;
  const p = profiles.find(x=>x.id===c.profileId);

  const titleEl = document.getElementById("cd-title");
  if (titleEl) titleEl.textContent = c.title;

  const backBtn = document.getElementById("cd-back-btn");
  if (backBtn) {
    backBtn.onclick = ()=>{ showView("profileDetail"); renderProfileDetail(); };
  }

  const isOwner = c.ownerUid === window._currentUser?.uid;

  let actionButtons = `<button class="btn btn-secondary btn-sm" onclick="openEditCase()">✏️ Edit</button>`;
  if (isOwner) {
    actionButtons += `
      <button class="btn btn-secondary btn-sm" onclick="openShareCaseModal()">👥 Share</button>
      <button class="btn btn-danger btn-sm" onclick="confirmDeleteCase()">🗑 Delete</button>
    `;
  }

  const detailHeaderActions = document.querySelector("#view-caseDetail .flex-center.gap-10");
  if (detailHeaderActions) {
    detailHeaderActions.innerHTML = `
      <button class="btn btn-ghost" id="cd-back-btn">← Back</button>
      <div style="flex:1;font-weight:700;font-size:22px;color:var(--text)" id="cd-title">${c.title}</div>
      ${actionButtons}
    `;
    const reBoundBackBtn = document.getElementById("cd-back-btn");
    if (reBoundBackBtn) reBoundBackBtn.onclick = ()=>{ showView("profileDetail"); renderProfileDetail(); };
  }

  const chip = document.getElementById("cd-profile-chip");
  if (chip) {
    if (p) {
      chip.innerHTML = `${avatarDiv(p.name,p.avatarColor,28,p.photoUrl)}<div><div style="font-size:14px;font-weight:600;color:var(--text)">${p.name}</div><div style="font-size:12px;color:var(--text-dim)">${p.role}</div></div><span style="font-size:12px;color:var(--text-dim);margin-left:8px">→ view profile</span>`;
      chip.style.display="inline-flex";
    } else {
      chip.style.display="none";
    }
  }

  const infoEl = document.getElementById("cd-info");
  if (infoEl) {
    infoEl.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        ${badge(c.status,statusColor(c.status))} ${badge(c.type,"#6366f1")}
      </div>
      <hr class="divider"/>
      ${[["Parties",c.parties],["Venue",c.venue],["Due Date",c.dueDate||"Not set"],["Added",c.createdAt]].map(([l,v])=>`
        <div style="margin-bottom:16px">
          <div style="font-size:11px;color:var(--text-dim);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px;font-weight:600">${l}</div>
          <div style="font-size:15px;color:var(--text)">${v}</div>
        </div>`).join("")}
      <div>
        <div style="font-size:11px;color:var(--text-dim);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;font-weight:600">Narrative</div>
        <div style="font-size:15px;color:var(--text-muted);line-height:1.8">${c.narrative}</div>
      </div>`;
  }

  const docs = c.documents||[];
  let docsHtml = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:12px">
    <div style="font-size:15px;font-weight:700;color:var(--text)">Documents</div>
    
    <!-- Instant upload Type selector -->
    <div style="display:inline-flex;align-items:center;gap:12px">
      <div style="display:inline-flex;align-items:center;gap:10px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:4px 12px">
        <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text);cursor:pointer;margin:0">
          <input type="radio" name="cd-file-type" value="Inbound" checked style="accent-color:var(--gold);margin:0"/> 📥 In
        </label>
        <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text);cursor:pointer;margin:0">
          <input type="radio" name="cd-file-type" value="Outbound" style="accent-color:var(--gold);margin:0"/> 📤 Out
        </label>
      </div>
      <button class="btn btn-primary btn-sm" onclick="addDocToCase()">+ Upload</button>
    </div>
  </div>`;

  if (docs.length===0) {
    docsHtml+=`<div class="upload-area" onclick="addDocToCase()"><div style="font-size:28px;margin-bottom:6px">📎</div><div>Click to attach a document</div></div>`;
  } else {
    docsHtml+=docs.map((doc,i)=>`
      <div class="doc-item">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%">
          <div>
            <div style="font-size:13px;color:var(--text);font-weight:600">
              <span onclick='openFilePreview(${JSON.stringify(doc).replace(/'/g,"&#39;")})' style="cursor:pointer;color:var(--gold);text-decoration:underline;text-underline-offset:3px">
                📄 ${doc.name}
              </span>
            </div>
            <div style="font-size:12px;color:var(--text-dim);display:flex;align-items:center;gap:8px">
              <span>${doc.size} · ${doc.date}${doc.driveFileId?' · ✅ Drive':''}</span>
              ${doc.fileType ? `<span style="background:${doc.fileType==='Inbound'?'#3b82f644':'#10b98144'};color:${doc.fileType==='Inbound'?'#3b82f6':'#10b981'};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${doc.fileType==='Inbound'?'📥 Inbound':'📤 Outbound'}</span>` : ''}
            </div>
          </div>
          <button style="background:transparent;border:none;color:var(--red);font-size:18px;cursor:pointer;padding:2px 10px;flex-shrink:0" onclick="removeDocFromCase(${i})">×</button>
        </div>
      </div>`).join("");
    docsHtml+=`<div class="upload-area" style="margin-top:10px;border:1px dashed var(--border)" onclick="addDocToCase()">+ Add more documents</div>`;
  }
  
  const docsEl = document.getElementById("cd-docs");
  if (docsEl) docsEl.innerHTML = docsHtml;

  const statusPanelEl = document.getElementById("cd-status-panel");
  if (statusPanelEl) {
    statusPanelEl.innerHTML = `
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:14px">Update Status</div>
      ${STATUS_OPTIONS.map(st=>`
        <button onclick="updateCaseStatus('${st}')" style="display:block;width:100%;margin-bottom:8px;padding:10px 16px;border-radius:10px;border:1px solid ${c.status===st?statusColor(st):"var(--border)"};background:${c.status===st?statusColor(st)+"18":"transparent"};color:${c.status===st?statusColor(st):"var(--text-muted)"};text-align:left;cursor:pointer;font-size:13px;font-family:var(--font-body);font-weight:${c.status===st?700:500};transition:all 0.2s">
          ${c.status===st?"✓ ":""}${st}
        </button>`).join("")}`;
  }
}

async function updateCaseStatus(st) {
  try {
    const upd = {...selCase, status:st};
    await dbUpdateCase(selCase.id, {status:st});
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
    const updDocs = docs.filter((_,i) => i !== idx);
    await dbUpdateCase(selCase.id, {documents: updDocs});
    selCase = {...selCase, documents: updDocs};
    renderCaseDetail();
    showToast("Document removed");
  } catch (err) {
    console.error("removeDocFromCase error:", err);
    showToast("Failed to remove document: " + (err.message || "Unknown error"), "error");
  }
}

// ═══════════════════════════════════════════════════════════════
//  QUICK ACCESS SIDEBAR (SAFEGUARDED)
// ═══════════════════════════════════════════════════════════════
function renderQuickAccess() {
  const qa = document.getElementById("quick-access");
  const ql = document.getElementById("quick-list");
  if (!qa || !ql) return; // Safeguard if the element is removed from HTML
  
  if (profiles.length===0) { qa.style.display="none"; return; }
  qa.style.display="block";
  ql.innerHTML = profiles.slice(0,7).map(p=>`
    <button class="nav-btn ${selProfile?.id===p.id?'active':''}" style="gap:10px;padding:10px 24px" onclick="openProfile('${p.id}')">
      ${p.photoUrl
        ? `<img src="${p.photoUrl}" alt="${initials(p.name)}" class="quick-avatar" style="object-fit:cover;border:2px solid ${p.avatarColor||'#c9a84c'}">`
        : `<span class="quick-avatar" style="background:${p.avatarColor}22;border:2px solid ${p.avatarColor};color:${p.avatarColor}">${initials(p.name)}</span>`
      }
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px">${p.name}</span>
    </button>`).join("");
}

// ═══════════════════════════════════════════════════════════════
//  OPEN HELPERS
// ═══════════════════════════════════════════════════════════════
function openProfile(id) {
  selProfile = profiles.find(p=>p.id===id);
  if (!selProfile) return;
  showView("profileDetail");
  renderProfileDetail();
}

// ═══════════════════════════════════════════════════════════════
//  OPEN CASE DETAILS ROUTER
// ═══════════════════════════════════════════════════════════════
function openCase(id) {
  selCase = cases.find(c=>c.id===id);
  if (!selCase) return;
  const p=profiles.find(x=>x.id===selCase.profileId);
  if (p) selProfile=p;
  showView("caseDetail");
  renderCaseDetail();
}

function openCurrentProfile() {
  if (selProfile) openProfile(selProfile.id);
}

// ═══════════════════════════════════════════════════════════════
//  STATUS FILTER PILLS
// ═══════════════════════════════════════════════════════════════
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
  const days = Math.ceil((new Date(dueDate) - new Date()) / (1000*60*60*24));
  const formatted = formatDate(dueDate);
  if (days < 0)  return `<span style="font-size:11px;font-weight:700;color:var(--red)">⚠ Overdue (${formatted})</span>`;
  if (days === 0) return `<span style="font-size:11px;font-weight:700;color:var(--red)">⚠ Due today</span>`;
  if (days <= 7)  return `<span style="font-size:11px;font-weight:700;color:var(--amber)">⚡ ${days}d left (${formatted})</span>`;
  if (days <= 30) return `<span style="font-size:11px;font-weight:600;color:var(--gold)">📅 ${days}d (${formatted})</span>`;
  return `<span style="font-size:11px;color:var(--text-dim)">Due ${formatted}</span>`;
}

// ═══════════════════════════════════════════════════════════════
//  FILTER DROPDOWNS POPULATOR
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

// ═══════════════════════════════════════════════════════════════
//  PERSONAL SETTINGS MANAGEMENT
// ═══════════════════════════════════════════════════════════════
let settingsPhotoDataUrl = null;

function renderMyProfile() {
  const u = window._currentUser;
  if (!u) return;

  const myProf = profiles.find(p => p.ownerUid === u.uid);
  if (!myProf) return;

  document.getElementById("setting-name").value    = myProf.name || "";
  document.getElementById("setting-role").value    = myProf.role || "Attorney";
  document.getElementById("setting-contact").value = myProf.contact || "";
  document.getElementById("setting-email").value   = u.email || "";
  document.getElementById("setting-password").value = "";
  document.getElementById("setting-current-password").value = "";
  document.getElementById("setting-reauth-panel").style.display = "none";

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
    const myProf = profiles.find(p => p.ownerUid === u.uid);
    if (myProf && !myProf.driveFolderId) {
      showToast("Initializing attorney Drive storage folder...");
      const folderId = await createDriveFolder(`Simando Law — ${myProf.name}`, DRIVE_FOLDER_ID || null);
      if (folderId) {
        await dbUpdateProfile(myProf.id, { driveFolderId: folderId });
        myProf.driveFolderId = folderId;
        showToast("Storage folder created!");
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
  document.getElementById("setting-photo-dropzone").style.display = "none";
  const wrap = document.getElementById("setting-photo-preview-wrap");
  wrap.style.display = "flex";
  document.getElementById("setting-photo-preview-img").src = url;
  document.getElementById("setting-name-preview").textContent = name || "Attorney Name";
  document.getElementById("setting-role-preview").textContent = role || "Role";
}

function resetSettingsPhotoUpload() {
  document.getElementById("setting-photo-dropzone").style.display = "block";
  document.getElementById("setting-photo-preview-wrap").style.display = "none";
  document.getElementById("setting-photo-input").value = "";
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
    showSettingsPhotoPreview(settingsPhotoDataUrl, document.getElementById("setting-name").value, document.getElementById("setting-role").value);
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

  const name = document.getElementById("setting-name").value.trim();
  const role = document.getElementById("setting-role").value.trim();
  const contact = document.getElementById("setting-contact").value.trim();

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

  const email = document.getElementById("setting-email").value.trim();
  const pass = document.getElementById("setting-password").value;
  const currentPass = document.getElementById("setting-current-password").value;

  if (email === u.email && !pass) {
    showToast("No security modifications requested.");
    return;
  }

  const reauthPanel = document.getElementById("setting-reauth-panel");
  if (reauthPanel.style.display === "none") {
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
    reauthPanel.style.display = "none";
    document.getElementById("setting-password").value = "";
    document.getElementById("setting-current-password").value = "";
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

  document.getElementById("del-title").textContent = "Delete Your Account?";
  document.getElementById("del-body").innerHTML = 
    `You are about to permanently delete your account, attorney profile, and all cases.<br>This cannot be undone. To proceed, please type your email address exactly:<br><strong>${u.email}</strong>`;
  
  const label = document.getElementById("del-confirm-target-text");
  label.textContent = u.email;
  label.style.color = "var(--red)";

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
      window.location.replace("login.html");
    }
  } catch (err) {
    console.error("Signout error:", err);
  }
}

// ═══════════════════════════════════════════════════════════════
//  DYNAMIC AGENDA LOADER FROM GOOGLE CALENDAR API
// ═══════════════════════════════════════════════════════════════
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
    
    const timeMin = new Date().toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&singleEvents=true&orderBy=startTime&maxResults=4`;
    
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok) {
      throw new Error("Failed to load events");
    }

    const data = await res.json();
    const events = data.items || [];

    if (events.length === 0) {
      html += `<div style="text-align:center;padding:24px 12px;color:var(--text-dim);border:1px dashed var(--border);border-radius:10px;font-size:12px">
        No upcoming events found on your Google Calendar.
      </div>`;
    } else {
      html += `<div style="display:flex;flex-direction:column;gap:10px">`;
      events.forEach(ev => {
        const start = ev.start.date || ev.start.dateTime;
        const eventDate = new Date(start);
        const dateStr = eventDate.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
        const isAllDay = !!ev.start.date;
        const timeStr = isAllDay ? "All Day" : eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        html += `
          <div style="display:flex;gap:12px;align-items:center;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:10px">
            <div style="text-align:center;background:rgba(201,168,76,0.1);border:1px solid var(--gold-border);border-radius:8px;padding:6px;min-width:48px">
              <div style="font-size:10px;font-weight:700;color:var(--gold);text-transform:uppercase">${eventDate.toLocaleDateString("en-PH", { weekday: "short" })}</div>
              <div style="font-size:14px;font-weight:700;color:var(--text);margin-top:1px">${eventDate.getDate()}</div>
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escHtml(ev.summary)}">${escHtml(ev.summary)}</div>
              <div style="font-size:11px;color:var(--text-dim);margin-top:2px">📅 ${dateStr} · ⏰ ${timeStr}</div>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }
  } catch (err) {
    console.error("fetchAndRenderGoogleCalendarEvents error:", err);
    html += `<div style="text-align:center;padding:20px;color:var(--red);font-size:12px">
      ⚠ Failed to load Google Calendar Agenda. Click refresh to try again.
    </div>`;
  }
  card.innerHTML = html;
}
