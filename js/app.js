// ═══════════════════════════════════════════════════════════════
//  DELETE CONFIRMATION & MODAL CONTROLLERS
// ═══════════════════════════════════════════════════════════════
let _pendingDeleteTarget = null;
let caseFormOrigin = "profileDetail"; // Router state to track form arrival

// Helper functions for safe DOM interaction
function setElText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setElVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

// Global Google Drive Disconnected Warning Modal helpers
window.openDriveWarningModal = function() {
  const modal = document.getElementById("drive-warning-modal");
  if (modal) modal.classList.remove("hidden");
};

window.closeDriveWarningModal = function() {
  const modal = document.getElementById("drive-warning-modal");
  if (modal) modal.classList.add("hidden");
};

// ═══════════════════════════════════════════════════════════════
//  BULK MARK BUSY / UNAVAILABLE DATES CONTROLLERS
// ═══════════════════════════════════════════════════════════════
window.openBusyModal = function() {
  const modal = document.getElementById("busy-modal");
  if (!modal) return;

  setElVal("busy-title", "In Court / Out of Office");
  setElVal("busy-start-date", "");
  setElVal("busy-end-date", "");
  setElVal("busy-notes", "");

  const allDayCb = document.getElementById("busy-all-day");
  if (allDayCb) {
    allDayCb.checked = true;
    toggleBusyTimeInputs(true);
  }

  modal.classList.remove("hidden");
};

window.closeBusyModal = function() {
  const modal = document.getElementById("busy-modal");
  if (modal) modal.classList.add("hidden");
};

window.toggleBusyTimeInputs = function(isAllDay) {
  const container = document.getElementById("busy-time-container");
  if (container) {
    container.style.display = isAllDay ? "none" : "grid";
  }
};

window.submitBusyDates = async function() {
  const title = (document.getElementById("busy-title")?.value || "").trim();
  const startDateStr = document.getElementById("busy-start-date")?.value || "";
  const endDateStr = document.getElementById("busy-end-date")?.value || "";
  const isAllDay = document.getElementById("busy-all-day")?.checked || false;
  const startTime = document.getElementById("busy-start-time")?.value || "08:00";
  const endTime = document.getElementById("busy-end-time")?.value || "17:00";
  const notes = (document.getElementById("busy-notes")?.value || "").trim();

  if (!title || !startDateStr || !endDateStr) {
    showToast("Please provide a title and valid start and end dates.", "error");
    return;
  }

  const u = window._currentUser;
  const myProf = profiles.find(p => p.ownerUid === u?.uid);
  if (!u || !myProf) {
    showToast("Unable to verify active attorney profile.", "error");
    return;
  }

  const startD = new Date(startDateStr + "T00:00:00");
  const endD = new Date(endDateStr + "T00:00:00");

  if (startD > endD) {
    showToast("End date must be on or after start date.", "error");
    return;
  }

  try {
    showToast("Blocking dates on schedule...");

    const cur = new Date(startD);
    let addedCount = 0;

    while (cur <= endD) {
      const year = cur.getFullYear();
      const month = String(cur.getMonth() + 1).padStart(2, "0");
      const day = String(cur.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;

      const timeLabel = isAllDay ? "All Day" : `${startTime} - ${endTime}`;

      const apptData = {
        title: "🚫 " + title,
        date: dateStr,
        time: timeLabel,
        description: notes || "Unavailable / Busy",
        requesterUid: u.uid,
        requesterName: myProf.name,
        targetUid: u.uid,
        targetName: myProf.name,
        status: "accepted",
        type: "busy"
      };

      const apptId = await dbAddAppointment(apptData);
      if (apptId) {
        apptData.id = apptId;
        appointments.push(apptData);
      } else {
        apptData.id = "local_busy_" + Date.now() + "_" + Math.random().toString(36).slice(2);
        appointments.push(apptData);
      }

      addedCount++;
      cur.setDate(cur.getDate() + 1);
    }

    showToast(`${addedCount} day(s) blocked as Busy!`);
    closeBusyModal();

    if (typeof renderCalendarView === "function") {
      renderCalendarView();
    }
  } catch (err) {
    console.error("submitBusyDates error:", err);
    showToast("Failed to save busy dates: " + err.message, "error");
  }
};

// Global function called on every keypress inside the delete input
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
//  PROFILE FORM — DRIVE AUTH REQUIRED
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
    console.error("saveProfile error:", e
