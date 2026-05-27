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
  if (["dashboard","profiles","allcases"].includes(name)) {
    const btn = document.querySelector(`.nav-btn[data-nav="${name}"]`);
    if (btn) btn.classList.add("active");
  }
}

function navTo(view) {
  const pd = document.getElementById("pd-search");
  const ac = document.getElementById("ac-search");
  if (pd) pd.value = "";
  if (ac) ac.value = "";
  // Reset dropdowns to defaults
  ["pd-status","pd-type","ac-status","ac-type"].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value="All";
  });
  ["pd-sort","ac-sort"].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value="asc";
  });
  showView(view);
  if (view==="dashboard") renderDashboard();
  if (view==="profiles")  renderProfiles();
  if (view==="allcases")  renderAllCases();
}

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════════
function renderDashboard() {
  document.getElementById("today-date").textContent =
    new Date().toLocaleDateString("en-PH",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
  document.getElementById("stat-profiles").textContent  = profiles.length;
  document.getElementById("stat-total").textContent     = cases.length;
  document.getElementById("stat-ongoing").textContent   = cases.filter(c=>c.status==="On-going").length;
  document.getElementById("stat-completed").textContent = cases.filter(c=>c.status==="Completed").length;

  renderDashProfiles();

  const dcEl = document.getElementById("dash-cases");
  // Show upcoming due cases sorted by date
  const activeCases = cases
    .filter(c=>c.dueDate && !["Completed","Dismissed","Settled"].includes(c.status))
    .sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate));
  const displayCases = activeCases.length ? activeCases : cases.slice(0,6);

  dcEl.innerHTML = displayCases.length===0
    ? '<div class="empty-state"><div class="empty-state-icon">📁</div><div>No cases yet.</div></div>'
    : displayCases.slice(0,6).map(c=>{
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
}

// Helper: get the nearest due case per profile
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

    const nearestHtml = nearest
      ? `<div style="margin-top:9px;padding:8px 10px;background:${urgency?.bg||"var(--surface2)"};border:1px solid ${urgency?.col||"var(--border)"};border-radius:7px;border-left:2px solid ${urgency?.col||"var(--border)"}">
          <div style="font-size:10px;color:${urgency?.col||"var(--text-dim)"};font-weight:700;letter-spacing:0.5px;margin-bottom:2px">NEAREST DUE ${urgency?.label||""}</div>
          <div style="font-size:12px;color:var(--text);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nearest.title}</div>
          <div style="font-size:11px;color:var(--text-dim);margin-top:1px">${nearest.type} · Due ${formatDate(nearest.dueDate)}</div>
        </div>`
      : (pc.length > 0
          ? `<div style="margin-top:8px;font-size:11px;color:var(--text-dim);font-style:italic">All cases resolved</div>`
          : "");

    return `<div style="padding:12px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:11px;margin-bottom:10px;cursor:pointer;transition:all 0.2s" onclick="openProfile('${p.id}')" onmouseenter="this.style.borderColor='var(--gold-border)';this.style.background='var(--surface3)'" onmouseleave="this.style.borderColor='var(--border)';this.style.background='var(--surface2)'">
      <div style="display:flex;align-items:center;gap:12px">
        ${avatarDiv(p.name,p.avatarColor,38,p.photoUrl)}
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px;color:var(--text)">${p.name}</div>
          <div style="font-size:11px;color:var(--text-dim);margin-top:1px">${p.role||"Attorney"} · ${pc.length} case${pc.length!==1?"s":""} · ${active.length} active</div>
        </div>
        <div style="font-size:12px;color:var(--gold);font-weight:700;flex-shrink:0">${active.length > 0 ? active.length+" active" : "✓ clear"}</div>
      </div>
      ${nearestHtml}
    </div>`;
  }).join("");
}

// ═══════════════════════════════════════════════════════════════
//  PROFILES
// ═══════════════════════════════════════════════════════════════
function renderProfiles() {
  document.getElementById("profiles-count").textContent = `${profiles.length} profile${profiles.length!==1?"s":""} total`;
  const el = document.getElementById("profiles-grid");
  if (profiles.length===0) {
    el.innerHTML='<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">👤</div><div style="font-size:16px;margin-bottom:8px">No profiles yet</div><div style="font-size:13px">Add your first attorney profile to get started.</div></div>';
    return;
  }
  el.innerHTML = profiles.map(p=>{
    const pc=cases.filter(c=>c.profileId===p.id);
    const ongoing=pc.filter(c=>c.status==="On-going").length;
    return `<div class="profile-card" onclick="openProfile('${p.id}')">
      <div class="flex-center gap-14 mb-16">
        ${avatarDiv(p.name,p.avatarColor,50,p.photoUrl)}
        <div>
          <div style="font-weight:700;font-size:16px;color:var(--text)">${p.name}</div>
          <div style="font-size:13px;color:var(--text-dim)">${p.role}</div>
        </div>
      </div>
      <hr class="divider"/>
      ${p.email?`<div style="font-size:12px;color:var(--text-muted);margin-bottom:5px">✉ ${p.email}</div>`:""}
      ${p.contact?`<div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">📞 ${p.contact}</div>`:""}
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:14px;color:var(--gold);font-weight:700">${pc.length} case${pc.length!==1?"s":""}</div>
        ${ongoing>0?badge(ongoing+" active","#f59e0b"):""}
      </div>
    </div>`;
  }).join("");
  renderQuickAccess();
}

// ═══════════════════════════════════════════════════════════════
//  PROFILE DETAIL
// ═══════════════════════════════════════════════════════════════
function renderProfileDetail() {
  const p = selProfile;
  if (!p) return;

  const driveChip = p.driveFolderId
    ? `<a href="https://drive.google.com/drive/folders/${p.driveFolderId}" target="_blank" style="font-size:12px;color:var(--green);display:inline-flex;align-items:center;gap:6px;text-decoration:none;font-weight:500;padding:4px 10px;background:rgba(34,197,94,0.08);border-radius:6px;border:1px solid rgba(34,197,94,0.2)" title="Open Drive Folder">📁 Drive Folder →</a>`
    : (accessToken
        ? `<button onclick="createProfileFolderManual()" style="background:transparent;border:1px solid var(--amber);color:var(--amber);font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-weight:500;padding:4px 10px;border-radius:6px;transition:all 0.2s" onmouseenter="this.style.background='rgba(245,158,11,0.08)'" onmouseleave="this.style.background='transparent'">📁 Create Drive Folder</button>`
        : `<span style="font-size:12px;color:var(--text-dim);display:inline-flex;align-items:center;gap:6px">📁 Drive not connected</span>`);

  document.getElementById("profile-header-card").innerHTML = `
    ${avatarDiv(p.name,p.avatarColor,64,p.photoUrl)}
    <div style="flex:1">
      <div style="font-size:24px;font-weight:700;color:var(--text)">${p.name}</div>
      <div style="font-size:14px;color:var(--text-muted);margin-top:3px">${p.role}</div>
      <div style="display:flex;gap:18px;margin-top:10px;flex-wrap:wrap;align-items:center">
        ${p.email?`<span style="font-size:12px;color:var(--text-dim)">✉ ${p.email}</span>`:""}
        ${p.contact?`<span style="font-size:12px;color:var(--text-dim)">📞 ${p.contact}</span>`:""}
        <span style="font-size:12px;color:var(--text-dim)">📅 Since ${p.createdAt}</span>
        ${driveChip}
      </div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn btn-secondary btn-sm" onclick="openEditProfile()">✏️ Edit</button>
      <button class="btn btn-danger btn-sm" onclick="confirmDeleteProfile()">🗑 Delete</button>
      <button class="btn btn-primary btn-sm" onclick="openAddCase()">+ Add Case</button>
    </div>
  `;

  const pc=cases.filter(c=>c.profileId===p.id);
  const docs=pc.reduce((a,c)=>a+(c.documents?.length||0),0);
  document.getElementById("profile-stats-row").innerHTML = [
    ["Total Cases",pc.length,"var(--violet)"],
    ["Active",pc.filter(c=>c.status==="On-going").length,"var(--amber)"],
    ["Resolved",pc.filter(c=>c.status==="Completed").length,"var(--green)"],
    ["Documents",docs,"var(--gold)"]
  ].map(([l,n,c])=>`
    <div class="stat-card" style="--accent:${c};padding:16px 18px">
      <div class="stat-number" style="color:${c};font-size:32px">${n}</div>
      <div class="stat-label">${l}</div>
    </div>`).join("");

  populateCaseFilterSelects("pd");
  renderProfileCases();
}

function renderProfileCases() {
  const p      = selProfile;
  const q      = (document.getElementById("pd-search")?.value||"").toLowerCase();
  const status = document.getElementById("pd-status")?.value || "All";
  const type   = document.getElementById("pd-type")?.value   || "All";
  const sort   = document.getElementById("pd-sort")?.value   || "asc";
  const pc     = cases.filter(c=>c.profileId===p.id);

  let filtered = pc.filter(c=>
    (c.title.toLowerCase().includes(q)||c.parties.toLowerCase().includes(q)) &&
    (status==="All"||c.status===status) &&
    (type==="All"||c.type===type)
  );
  filtered = sortCasesByDue(filtered, sort);

  const el = document.getElementById("profile-cases-list");
  if (filtered.length===0) {
    el.innerHTML=`<div class="empty-state">${pc.length===0
      ? '<div class="empty-state-icon">⚖️</div><div>No cases yet</div><div style="font-size:13px;margin-top:8px">Add the first case for this attorney.</div>'
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
  const type   = document.getElementById("ac-type")?.value   || "All";
  const sort   = document.getElementById("ac-sort")?.value   || "asc";

  let filtered = cases.filter(c=>{
    const p=profiles.find(x=>x.id===c.profileId);
    return (c.title.toLowerCase().includes(q)||c.parties.toLowerCase().includes(q)||(p&&p.name.toLowerCase().includes(q))) &&
      (status==="All"||c.status===status) &&
      (type==="All"||c.type===type);
  });
  filtered = sortCasesByDue(filtered, sort);

  document.getElementById("allcases-count").textContent = `${filtered.length} case${filtered.length!==1?"s":""} found`;
  const el = document.getElementById("all-cases-list");
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

  document.getElementById("cd-title").textContent = c.title;
  document.getElementById("cd-back-btn").onclick = ()=>{ showView("profileDetail"); renderProfileDetail(); };

  const chip = document.getElementById("cd-profile-chip");
  if (p) {
    chip.innerHTML = `${avatarDiv(p.name,p.avatarColor,28,p.photoUrl)}<div><div style="font-size:14px;font-weight:600;color:var(--text)">${p.name}</div><div style="font-size:12px;color:var(--text-dim)">${p.role}</div></div><span style="font-size:12px;color:var(--text-dim);margin-left:8px">→ view profile</span>`;
    chip.style.display="inline-flex";
  } else chip.style.display="none";

  document.getElementById("cd-info").innerHTML = `
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

  const docs = c.documents||[];
  let docsHtml = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
    <div style="font-size:15px;font-weight:700;color:var(--text)">Documents</div>
    <button class="btn btn-primary btn-sm" onclick="addDocToCase()">+ Upload</button>
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
            <div style="font-size:12px;color:var(--text-dim)">${doc.size} · ${doc.date}${doc.driveFileId?' · ✅ Drive':''}</div>
          </div>
          <button style="background:transparent;border:none;color:var(--red);font-size:18px;cursor:pointer;padding:2px 10px;flex-shrink:0" onclick="removeDocFromCase(${i})">×</button>
        </div>

      </div>`).join("");
    docsHtml+=`<div class="upload-area" style="margin-top:10px;border:1px dashed var(--border)" onclick="addDocToCase()">+ Add more documents</div>`;
  }
  document.getElementById("cd-docs").innerHTML = docsHtml;

  document.getElementById("cd-status-panel").innerHTML = `
    <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:14px">Update Status</div>
    ${STATUS_OPTIONS.map(st=>`
      <button onclick="updateCaseStatus('${st}')" style="display:block;width:100%;margin-bottom:8px;padding:10px 16px;border-radius:10px;border:1px solid ${c.status===st?statusColor(st):"var(--border)"};background:${c.status===st?statusColor(st)+"18":"transparent"};color:${c.status===st?statusColor(st):"var(--text-muted)"};text-align:left;cursor:pointer;font-size:13px;font-family:var(--font-body);font-weight:${c.status===st?700:500};transition:all 0.2s">
        ${c.status===st?"✓ ":""}${st}
      </button>`).join("")}`;
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
    // Delete from Drive if it has a drive file id
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
//  QUICK ACCESS SIDEBAR
// ═══════════════════════════════════════════════════════════════
function renderQuickAccess() {
  const qa = document.getElementById("quick-access");
  const ql = document.getElementById("quick-list");
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
  renderQuickAccess();
}

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
// ── Sort helper ──
function sortCasesByDue(arr, dir) {
  if (dir === "none") return arr; // preserve original (date-added) order
  return [...arr].sort((a, b) => {
    const da = a.dueDate ? new Date(a.dueDate) : null;
    const db = b.dueDate ? new Date(b.dueDate) : null;
    if (!da && !db) return 0;
    if (!da) return 1;   // no due date goes to the end
    if (!db) return -1;
    return dir === "asc" ? da - db : db - da;
  });
}

// ── Due-date urgency badge ──
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

// ── Populate the three selects for a given prefix (pd or ac) ──
// Avoids clobbering the user's current selection if options haven't changed
function populateCaseFilterSelects(prefix) {
  const statusSel = document.getElementById(prefix+"-status");
  const typeSel   = document.getElementById(prefix+"-type");
  if (!statusSel || !typeSel) return;

  // Status options
  const statusOpts = ["All", ...STATUS_OPTIONS];
  if (statusSel.options.length !== statusOpts.length) {
    const cur = statusSel.value;
    statusSel.innerHTML = statusOpts.map(s=>`<option value="${s}">${s==="All"?"All Statuses":s}</option>`).join("");
    if (statusOpts.includes(cur)) statusSel.value = cur;
  }

  // Type options — built from CASE_TYPES constant
  const typeOpts = ["All", ...CASE_TYPES];
  if (typeSel.options.length !== typeOpts.length) {
    const cur = typeSel.value;
    typeSel.innerHTML = typeOpts.map(t=>`<option value="${t}">${t==="All"?"All Types":t}</option>`).join("");
    if (typeOpts.includes(cur)) typeSel.value = cur;
  }
}

// ═══════════════════════════════════════════════════════════════
//  FILE PREVIEW MODAL
// ═══════════════════════════════════════════════════════════════

// Stores objectURLs created for local files so we can revoke them on close
let _previewObjectUrl = null;

/**
 * Open the preview modal for a document entry.
 * doc can come from pendingDocs (has _localTempId) or a saved case doc (has driveLink).
 */
function openFilePreview(doc) {
  // ── Case 1: local staged file — create a blob URL and open it ──
  if (doc._localTempId && pendingLocalFiles[doc._localTempId]) {
    const file = pendingLocalFiles[doc._localTempId];
    const url  = URL.createObjectURL(file);
    window.open(url, "_blank");
    // Revoke after a short delay to give the browser time to load it
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return;
  }

  // ── Case 2: Drive file — open the webViewLink directly ──
  if (doc.driveLink) {
    window.open(doc.driveLink, "_blank");
    return;
  }

  // ── Case 3: no source available ──
  showToast("No preview available — save the case first or sync to Drive.", "error");
}

function _renderPreviewContent(container, url, ext, name) {
  if (["jpg","jpeg","png","gif","webp","svg","bmp"].includes(ext)) {
    container.innerHTML = `<img src="${url}" style="max-width:95vw;max-height:calc(100vh - 80px);border-radius:8px;object-fit:contain"/>`;
  } else if (ext === "pdf") {
    container.innerHTML = `<iframe src="${url}" style="width:95vw;height:calc(100vh - 80px);border:none;border-radius:8px;background:#fff"></iframe>`;
  } else if (["txt","md","html","htm","csv"].includes(ext)) {
    // Read as text and display in a code block
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target.result;
      container.innerHTML = `<pre style="background:#1a1a2e;color:#e2e8f0;padding:24px;border-radius:8px;max-width:90vw;max-height:calc(100vh - 100px);overflow:auto;font-size:13px;line-height:1.7;white-space:pre-wrap;word-break:break-word">${escHtml(text.slice(0, 50000))}</pre>`;
    };
    // We need the actual file; fetch from the objectURL as blob
    fetch(url).then(r => r.blob()).then(b => reader.readAsText(b));
  } else {
    container.innerHTML = `<div style="color:#fff;text-align:center;padding:40px">
      <div style="font-size:40px;margin-bottom:12px">📎</div>
      <div style="font-size:15px;font-weight:600">${name}</div>
      <div style="font-size:13px;color:#aaa;margin-top:8px">Preview not available for this file type.<br/>Use the Download button above.</div>
    </div>`;
  }
}

function escHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function closeFilePreview() {
  const modal = document.getElementById("file-preview-modal");
  modal.style.display = "none";
  document.getElementById("fpm-body").innerHTML = "";
  if (_previewObjectUrl) { URL.revokeObjectURL(_previewObjectUrl); _previewObjectUrl = null; }
}

// Close on backdrop click
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("file-preview-modal");
  if (modal) {
    modal.addEventListener("click", e => { if (e.target === modal) closeFilePreview(); });
  }
});
