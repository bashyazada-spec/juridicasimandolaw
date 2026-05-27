// ═══════════════════════════════════════════════════════════════
//  DELETE CONFIRMATION — TYPE VERIFICATION TO CONFIRM
//  CRITICAL: Store target in a closure variable, NOT global deleteTarget
// ═══════════════════════════════════════════════════════════════
let _pendingDeleteTarget = null;

function confirmDeleteProfile() {
  const cnt = cases.filter(c => c.profileId === selProfile.id).length;
  _pendingDeleteTarget = { type: "profile", id: selProfile.id, name: selProfile.name, caseCount: cnt };

  document.getElementById("del-title").textContent = "Delete Attorney Profile?";
  document.getElementById("del-body").innerHTML = 
    `You are about to permanently remove <strong style="color:var(--text)">${selProfile.name}</strong> and all ${cnt} associated case(s).<br>This action <strong>cannot</strong> be undone.`;

  const label = document.getElementById("del-confirm-target-text");
  label.textContent = "DELETE";
  label.style.color = "var(--red)";

  openDeleteModal();
}

function confirmDeleteCase() {
  _pendingDeleteTarget = { type: "case", id: selCase.id, title: selCase.title };

  document.getElementById("del-title").textContent = "Delete Case?";
  document.getElementById("del-body").innerHTML = 
    `You are about to permanently remove <strong style="color:var(--text)">${selCase.title}</strong>.<br>This action <strong>cannot</strong> be undone.`;

  const label = document.getElementById("del-confirm-target-text");
  label.textContent = "DELETE";
  label.style.color = "var(--red)";

  openDeleteModal();
}

function openDeleteModal() {
  const modal = document.getElementById("delete-modal");
  const input = document.getElementById("del-confirm-input");
  const btn = document.getElementById("del-confirm-btn");
  const err = document.getElementById("del-input-err");

  const targetText = document.getElementById("del-confirm-target-text").textContent.trim();

  input.value = "";
  btn.disabled = true;
  btn.style.opacity = "0.5";
  err.classList.add("hidden");

  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);

  input.oninput = () => {
    const val = input.value.trim();
    const expected = targetText;
    
    const isMatched = expected.includes("@") ? (val === expected) : (val.toUpperCase() === "DELETE");

    if (isMatched) {
      newBtn.disabled = false;
      newBtn.style.opacity = "1";
      err.classList.add("hidden");
    } else {
      newBtn.disabled = true;
      newBtn.style.opacity = "0.5";
    }
  };

  input.onkeydown = (e) => {
    if (e.key === "Enter" && !newBtn.disabled) {
      executeDelete();
    }
  };

  newBtn.onclick = () => executeDelete();

  modal.classList.remove("hidden");
  setTimeout(() => input.focus(), 50);
}

function closeDeleteModal() {
  document.getElementById("delete-modal").classList.add("hidden");
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
      await dbDeleteCase(target.id);
      cases = cases.filter(c => c.id !== target.id);
      selCase = null;
      showToast("Case deleted successfully", "error");
      showView("profileDetail");
      renderProfileDetail();
    } else if (target.type === "profile") {
      const toDelete = cases.filter(c => c.profileId === target.id);
      for (const c of toDelete) {
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
//  PROFILE FORM — DRIVE AUTH REQUIRED
// ═══════════════════════════════════════════════════════════════
let pfDriveConnected = false;

function openAddProfile() {
  profFormMode="add";
  pfColor=AVATAR_COLORS[0];
  pfDriveConnected = false;
  pfPhotoDataUrl = null;

  document.getElementById("pf-title").textContent="New Attorney Profile";
  document.getElementById("pf-name").value="";
  document.getElementById("pf-role").value="";
  document.getElementById("pf-contact").value="";
  document.getElementById("pf-email").value="";
  document.getElementById("pf-cancel-btn").onclick=()=>navTo("profiles");
  document.getElementById("pf-back-btn").onclick=()=>navTo("profiles");

  resetDriveAuthUI();
  setDetailsEnabled(false);
  clearProfileErrors();
  resetPhotoUpload();
  updateAvatarPreview();
  showView("profileForm");
}

function openEditProfile() {
  const p=selProfile;
  profFormMode="edit";
  pfColor=p.avatarColor || AVATAR_COLORS[0];
  pfPhotoDataUrl = p.photoUrl || null;
  pfDriveConnected = true;

  document.getElementById("pf-title").textContent="Edit Profile";
  document.getElementById("pf-name").value=p.name;
  document.getElementById("pf-role").value=p.role;
  document.getElementById("pf-contact").value=p.contact||"";
  document.getElementById("pf-email").value=p.email||"";
  document.getElementById("pf-cancel-btn").onclick=()=>{ showView("profileDetail"); renderProfileDetail(); };
  document.getElementById("pf-back-btn").onclick=()=>{ showView("profileDetail"); renderProfileDetail(); };

  const driveSection = document.getElementById("pf-drive-section");
  if (driveSection) driveSection.style.display = "none";

  setDetailsEnabled(true);
  document.getElementById("pf-save-btn").disabled = false;
  document.getElementById("pf-save-btn").style.opacity = "1";
  document.getElementById("pf-save-btn").style.cursor = "pointer";
  document.getElementById("pf-save-btn-text").textContent = "Save Changes";

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

  btn.disabled = true;
  btnText.textContent = "Connecting...";
  errorEl.classList.add("hidden");

  try {
    await waitForGoogleDriveReady();
    await promptDriveAuth();

    pfDriveConnected = true;

    const statusEl = document.getElementById("pf-drive-status");
    statusEl.className = "drive-status-chip connected";
    statusEl.textContent = "● Connected";

    btn.classList.add("connected");
    btnText.textContent = "✓ Google Drive Connected";

    setDetailsEnabled(true);

    const saveBtn = document.getElementById("pf-save-btn");
    saveBtn.disabled = false;
    saveBtn.style.opacity = "1";
    saveBtn.style.cursor = "pointer";
    document.getElementById("pf-save-btn-text").textContent = profFormMode === "add" ? "Create Profile" : "Save Changes";

    showToast("Google Drive connected successfully");
  } catch (err) {
    console.error("Drive auth failed:", err);
    btn.disabled = false;
    btnText.textContent = "Connect Google Drive Account";
    errorEl.textContent = err.message || "Failed to connect. Please try again.";
    errorEl.classList.remove("hidden");
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
  const name=document.getElementById("pf-name")?.value||"Preview";
  const role=document.getElementById("pf-role")?.value||"Role";

  const av=document.getElementById("pf-avatar-preview");
  if (av) av.textContent=initials(name);

  const namePreviewInitials = document.getElementById("pf-name-preview-initials");
  const rolePreviewInitials = document.getElementById("pf-role-preview-initials");
  if (namePreviewInitials) namePreviewInitials.textContent=name==="Preview"?"Attorney Name":name;
  if (rolePreviewInitials) rolePreviewInitials.textContent=role==="Role"?"Role":role;

  const namePreview = document.getElementById("pf-name-preview");
  const rolePreview = document.getElementById("pf-role-preview");
  if (namePreview) namePreview.textContent=name==="Preview"?"Attorney Name":name;
  if (rolePreview) rolePreview.textContent=role==="Role"?"Role":role;
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
  ["pf-name-err","pf-role-err","pf-drive-error"].forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });
  ["pf-name","pf-role"].forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.classList.remove("err");
  });
}

async function saveProfile() {
  if (profFormMode === "add" && !pfDriveConnected) {
    showToast("Please connect Google Drive before creating a profile", "error");
    return;
  }

  const name=document.getElementById("pf-name").value.trim();
  const role=document.getElementById("pf-role").value.trim();
  let valid=true;
  if(!name){document.getElementById("pf-name-err").classList.remove("hidden");document.getElementById("pf-name").classList.add("err");valid=false;}
  if(!role){document.getElementById("pf-role-err").classList.remove("hidden");document.getElementById("pf-role").classList.add("err");valid=false;}
  if(!valid) return;

  const data={
    name, role,
    contact: document.getElementById("pf-contact").value.trim(),
    email: document.getElementById("pf-email").value.trim(),
    avatarColor: pfColor,
    photoDataUrl: null
  };

  try {
    if(profFormMode==="add"){
      data.createdAt = new Date().toISOString().slice(0,10);
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
      selProfile = {...selProfile, ...data};
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

  document.getElementById("cf-petitioners-list").innerHTML =
    cfPetitioners.length === 0
      ? `<div style="font-size:12px;color:var(--text-dim);font-style:italic;padding:2px 0">None added yet</div>`
      : cfPetitioners.map((n,i) => `<span style="${chipStyle("var(--gold)","rgba(201,165,92,0.1)")}">${n} ${removeBtn("petitioner",i)}</span>`).join("");

  document.getElementById("cf-respondents-list").innerHTML =
    cfRespondents.length === 0
      ? `<div style="font-size:12px;color:var(--text-dim);font-style:italic;padding:2px 0">None added yet</div>`
      : cfRespondents.map((n,i) => `<span style="${chipStyle("var(--violet)","rgba(129,140,248,0.1)")}">${n} ${removeBtn("respondent",i)}</span>`).join("");
}

function serializeParties() {
  const parts = [];
  if (cfPetitioners.length) parts.push("Petitioner: " + cfPetitioners.join(", "));
  if (cfRespondents.length) parts.push("Respondent: " + cfRespondents.join(", "));
  document.getElementById("cf-parties").value = parts.join(" | ");
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
  if (sel.value === "Other (specify)") {
    return document.getElementById("cf-venue-manual").value.trim() || "Other";
  }
  return sel.value;
}

function setVenueValue(val) {
  const sel = document.getElementById("cf-venue");
  const manual = document.getElementById("cf-venue-manual");
  const match = VENUES.find(v => v === val);
  if (match) {
    sel.value = match;
    manual.style.display = "none";
  } else if (val) {
    sel.value = "Other (specify)";
    manual.style.display = "block";
    manual.value = val;
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
  const q = val.trim().toLowerCase();
  const filtered = q ? _caseTypeSuggestions.filter(s => s.toLowerCase().includes(q)) : _caseTypeSuggestions;
  if (!filtered.length) { dd.style.display = "none"; return; }
  dd.innerHTML = filtered.map(s =>
    `<div onclick="selectCaseType('${s.replace(/'/g,"\'")}')" style="padding:9px 14px;cursor:pointer;font-size:13px;color:var(--text);transition:background 0.1s" onmouseover="this.style.background='rgba(201,165,92,0.08)'" onmouseout="this.style.background=''">${s}</div>`
  ).join("");
  dd.style.display = "block";
}

function showCaseTypeSuggestions() {
  filterCaseTypeSuggestions(document.getElementById("cf-type-input").value);
}

function hideCaseTypeSuggestions() {
  const dd = document.getElementById("cf-type-dropdown");
  if (dd) dd.style.display = "none";
}

function selectCaseType(name) {
  document.getElementById("cf-type-input").value = name;
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
  document.getElementById("cf-type-input").value = "";
  hideCaseTypeSuggestions();
}

function populateCaseSelects() {
  document.getElementById("cf-category").innerHTML = CASE_CATEGORIES.map(c=>`<option>${c}</option>`).join("");
  document.getElementById("cf-status").innerHTML = STATUS_OPTIONS.map(t=>`<option>${t}</option>`).join("");
  document.getElementById("cf-venue").innerHTML = VENUES.map(v=>`<option>${v}</option>`).join("");
}

async function openAddCase() {
  if (!selProfile) return;
  caseFormMode="add";
  pendingDocs=[];
  cfPetitioners = selProfile.name ? [selProfile.name] : [];
  cfRespondents = [];
  populateCaseSelects();
  document.getElementById("cf-title").textContent="New Case";
  document.getElementById("cf-save-btn").textContent="Add Case";
  document.getElementById("cf-case-title").value="";
  document.getElementById("cf-narrative").value="";
  document.getElementById("cf-due").value="";
  document.getElementById("cf-case-number").value="";
  document.getElementById("cf-doc-type").value="";
  document.getElementById("cf-type-input").value="";
  document.getElementById("cf-status").value=STATUS_OPTIONS[0];
  setVenueValue(VENUES[0]);
  document.getElementById("drive-status").textContent="";
  document.getElementById("cf-back-btn").onclick=()=>{ showView("profileDetail"); renderProfileDetail(); };
  document.getElementById("cf-cancel-btn").onclick=()=>{ showView("profileDetail"); renderProfileDetail(); };
  
  const firstCat = CASE_CATEGORIES[0];
  document.getElementById("cf-category").value = firstCat;
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
  const c=selCase;
  caseFormMode="edit";
  pendingDocs=[...(c.documents||[])];
  parsePartiesString(c.parties);
  populateCaseSelects();
  document.getElementById("cf-title").textContent="Edit Case";
  document.getElementById("cf-save-btn").textContent="Save Changes";
  document.getElementById("cf-case-title").value=c.title;
  document.getElementById("cf-narrative").value=c.narrative;
  document.getElementById("cf-due").value=c.dueDate;
  document.getElementById("cf-case-number").value=c.caseNumber||"";
  document.getElementById("cf-doc-type").value=c.docType||"";
  document.getElementById("cf-status").value=c.status;
  setVenueValue(c.venue);
  
  const cat = c.category || CASE_CATEGORIES[0];
  document.getElementById("cf-category").value = cat;
  await onCategoryChange(cat);
  document.getElementById("cf-type-input").value = c.type||"";
  
  document.getElementById("drive-status").textContent=pendingDocs.length?`${pendingDocs.length} file(s)`:"";
  document.getElementById("cf-back-btn").onclick=()=>{ showView("caseDetail"); renderCaseDetail(); };
  document.getElementById("cf-cancel-btn").onclick=()=>{ showView("caseDetail"); renderCaseDetail(); };
  renderPartyLists();
  serializeParties();
  renderPendingDocs();
  clearCaseErrors();
  updateCfChip();
  updateDriveFolderChip();
  showView("caseForm");
}

function updateCfChip() {
  const chip=document.getElementById("cf-profile-chip");
  if(selProfile){
    chip.innerHTML=`${avatarDiv(selProfile.name,selProfile.avatarColor,24,selProfile.photoUrl)}<span style="font-size:13px;color:var(--text-muted)">${selProfile.name}</span>`;
    chip.style.display="flex";
  } else chip.style.display="none";
}

function clearCaseErrors() {
  ["cf-title-err","cf-due-err","cf-parties-err","cf-narrative-err"].forEach(id=>{document.getElementById(id).classList.add("hidden");});
  ["cf-case-title","cf-due","cf-narrative"].forEach(id=>{document.getElementById(id).classList.remove("err");});
}

async function saveCase() {
  serializeParties();
  const title=document.getElementById("cf-case-title").value.trim();
  const due=document.getElementById("cf-due").value;
  const parties=document.getElementById("cf-parties").value.trim();
  const narrative=document.getElementById("cf-narrative").value.trim();
  let valid=true;
  if(!title){document.getElementById("cf-title-err").classList.remove("hidden");document.getElementById("cf-case-title").classList.add("err");valid=false;}
  if(!due){document.getElementById("cf-due-err").classList.remove("hidden");document.getElementById("cf-due").classList.add("err");valid=false;}
  if(cfPetitioners.length===0||cfRespondents.length===0){document.getElementById("cf-parties-err").classList.remove("hidden");valid=false;}
  if(!narrative){document.getElementById("cf-narrative-err").classList.remove("hidden");document.getElementById("cf-narrative").classList.add("err");valid=false;}
  if(!valid) return;

  const category = document.getElementById("cf-category").value;
  const caseType = document.getElementById("cf-type-input").value.trim();
  if (caseType) await saveCaseTypeIfNew(category, caseType);
  const data={
    title,dueDate:due,parties,narrative,
    category,
    type: caseType,
    caseNumber: document.getElementById("cf-case-number").value.trim(),
    docType: document.getElementById("cf-doc-type").value.trim(),
    status:document.getElementById("cf-status").value,
    venue:getVenueValue(),
    documents:pendingDocs,
  };
  try {
    const caseCategory = data.category || "Other";
    const caseType = data.type || "Other";
    const caseTitle = data.title || "Untitled";
    const profileFolderId = selProfile?.driveFolderId || null;
    const hadLocalFiles = pendingDocs.some(d => d._localTempId);
    if (typeof syncPendingFilesToDrive === "function") {
      const syncedDocs = await syncPendingFilesToDrive(caseCategory, caseType, caseTitle, profileFolderId);
      data.documents = syncedDocs.map(d => {
        const clean = {...d};
        delete clean._localTempId;
        return clean;
      });
      const stillLocal = data.documents.some(d => !d.driveFileId && d.name);
      if (hadLocalFiles && stillLocal) {
        showToast("Case saved locally — Drive session expired.", "error");
      }
    }
    if(caseFormMode==="add"){
      data.profileId=selProfile.id;
      data.createdAt=new Date().toISOString().slice(0,10);
      await dbAddCase(data);
      showToast("Case added!");
      showView("profileDetail");
      renderProfileDetail();
    } else {
      await dbUpdateCase(selCase.id,data);
      selCase={...selCase,...data};
      showToast("Case updated!");
      showView("caseDetail");
      renderCaseDetail();
    }
    pendingDocs=[];
  } catch (err) {
    console.error("saveCase error:", err);
    showToast("Failed to save case: " + (err.message || "Unknown error"), "error");
  }
}

// ═══════════════════════════════════════════════════════════════
//  BOOT
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
  initTheme();
  bindProfileInputs();
  showView("dashboard");
  renderDashboard();
}

async function connectDatabase() {
  if (typeof window._fbReady !== "undefined" && window._fbReady && window._db) {
    localMode = false;
    const banner = document.getElementById("config-banner");
    if (banner) banner.classList.remove("show");

    if (!window._currentUser) {
      window.location.replace("login.html");
      return;
    }

    try {
      await dbLoad();
    } catch (err) {
      console.error("Database load failed:", err);
      enterLocalMode("Database connection failed.");
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
  if (!dbConnected) {
    dbConnected = true;
    connectDatabase();
  }
});

setTimeout(() => {
  if (!uiBooted) {
    uiBooted = true;
    initAppUI();
  }
}, 2000);

setTimeout(() => {
  if (!dbConnected) {
    dbConnected = true;
    enterLocalMode("Firebase failed to load. Check your config and network.");
  }
}, 6000);
