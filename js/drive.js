let gTokenClient = null;
let accessToken  = null;
let tokenExpiresAt = 0;
let pendingDriveAuthResolve = null;
let pendingDriveAuthReject  = null;
let driveInitAttempts = 0;
const MAX_DRIVE_INIT_ATTEMPTS = 10;

// ── Token persistence across page refreshes ──────────────────────────────────
(function restoreTokenFromSession() {
  try {
    const saved = sessionStorage.getItem("gDriveToken");
    if (saved) {
      const { token, expiresAt } = JSON.parse(saved);
      if (token && expiresAt && Date.now() < expiresAt - 60000) {
        accessToken    = token;
        tokenExpiresAt = expiresAt;
      } else {
        sessionStorage.removeItem("gDriveToken");
      }
    }
  } catch (e) { /* ignore */ }
})();

function persistToken(token, expiresIn) {
  tokenExpiresAt = Date.now() + (expiresIn || 3600) * 1000;
  try {
    sessionStorage.setItem("gDriveToken", JSON.stringify({ token, expiresAt: tokenExpiresAt }));
  } catch (e) { /* ignore */ }
}

function clearPersistedToken() {
  accessToken    = null;
  tokenExpiresAt = 0;
  try { sessionStorage.removeItem("gDriveToken"); } catch (e) { /* ignore */ }
}
// ─────────────────────────────────────────────────────────────────────────────

function initGoogleDrive() {
  if (typeof google === "undefined" || !google.accounts || !google.accounts.oauth2) {
    driveInitAttempts++;
    if (driveInitAttempts < MAX_DRIVE_INIT_ATTEMPTS) {
      setTimeout(initGoogleDrive, 500);
    } else {
      console.error("Google Identity Services failed to load after maximum retries.");
    }
    return;
  }
  try {
    gTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: (response) => {
        if (response.access_token) {
          accessToken = response.access_token;
          persistToken(response.access_token, response.expires_in);
          console.log("Drive auth success");
          if (pendingDriveAuthResolve) pendingDriveAuthResolve(accessToken);
        } else {
          console.error("Drive auth response:", response);
          if (pendingDriveAuthReject) pendingDriveAuthReject(new Error(response.error_description || "Drive auth failed"));
        }
        pendingDriveAuthResolve = pendingDriveAuthReject = null;
      },
      error_callback: (err) => {
        console.error("GIS error:", err);
        if (pendingDriveAuthReject) pendingDriveAuthReject(new Error(err.message || "OAuth error"));
        pendingDriveAuthResolve = pendingDriveAuthReject = null;
      }
    });
    console.log("Google Drive initialized");
  } catch (err) {
    console.error("Failed to initialize Google Drive:", err);
  }
}

// Interactive auth — shows account chooser (used only for explicit "Connect Drive" button)
function promptDriveAuth() {
  if (!gTokenClient) {
    return Promise.reject(new Error("Google Drive not ready. Reload the page."));
  }
  return new Promise((resolve, reject) => {
    pendingDriveAuthResolve = resolve;
    pendingDriveAuthReject = reject;
    try {
      gTokenClient.requestAccessToken({ prompt: '' });
    } catch (e) {
      reject(e);
    }
  });
}


/**
 * Show a modal asking the user to select file type (Inbound/Outbound)
 * Returns a promise that resolves with the selected type or null if cancelled
 */
function showFileTypeModal() {
  return new Promise((resolve) => {
    // Create modal HTML
    const modalHTML = `
      <div id="file-type-modal" style="
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); display: flex; align-items: center; 
        justify-content: center; z-index: 10000;
      ">
        <div style="
          background: var(--surface); border-radius: var(--radius);
          padding: 24px; box-shadow: var(--shadow-lg); max-width: 400px;
          width: 90%;
        ">
          <h2 style="margin: 0 0 16px 0; color: var(--text);">Document Type</h2>
          <p style="margin: 0 0 20px 0; color: var(--text-muted);">
            Is this document inbound or outbound?
          </p>
          <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button onclick="this.closest('#file-type-modal').remove(); window._fileTypeResolve?.(null)" style="
              padding: 8px 16px; border: 1px solid var(--border);
              background: var(--surface); color: var(--text);
              border-radius: var(--radius); cursor: pointer;
            ">Cancel</button>
            <button onclick="this.closest('#file-type-modal').remove(); window._fileTypeResolve?.('Inbound')" style="
              padding: 8px 16px; background: #3b82f6; color: white;
              border: none; border-radius: var(--radius); cursor: pointer;
            ">📥 Inbound</button>
            <button onclick="this.closest('#file-type-modal').remove(); window._fileTypeResolve?.('Outbound')" style="
              padding: 8px 16px; background: #10b981; color: white;
              border: none; border-radius: var(--radius); cursor: pointer;
            ">📤 Outbound</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Store the resolve function so buttons can call it
    window._fileTypeResolve = (type) => {
      resolve(type);
      window._fileTypeResolve = null;
    };
  });
}

function hasValidToken() {
  return accessToken && Date.now() < tokenExpiresAt - 60000;
}


async function createDriveFolder(name, parentId = null) {
  const metadata = {
    name: name,
    mimeType: "application/vnd.google-apps.folder",
    ...(parentId && { parents: [parentId] })
  };
  const res = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(metadata)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to create Drive folder");
  }
  return (await res.json()).id;
}

async function setupProfileDriveFolder(profile) {
  if (!profile) return null;
  if (profile.driveFolderId) return profile.driveFolderId;
  if (!hasValidToken()) {
    showToast("Please connect Google Drive first", "error");
    return null;
  }
  try {
    const folderName = `Simando Law — ${profile.name}`;
    const folderId = await createDriveFolder(folderName, DRIVE_FOLDER_ID || null);
    await dbUpdateProfile(profile.id, { driveFolderId: folderId });
    profile.driveFolderId = folderId;
    showToast("Drive folder created for client");
    return folderId;
  } catch (err) {
    console.error("Folder creation error:", err);
    showToast("Drive folder creation failed: " + err.message, "error");
    return null;
  }
}

async function uploadFilesToDrive(files, folderId = null) {
  const targetFolder = folderId || DRIVE_FOLDER_ID || null;
  const statusEl = document.getElementById("drive-status");
  if (statusEl) statusEl.textContent = `Uploading ${files.length} file(s)…`;

  for (const file of files) {
    try {
      const meta = { name: file.name, mimeType: file.type };
      if (targetFolder) meta.parents = [targetFolder];
      const form = new FormData();
      form.append("metadata", new Blob([JSON.stringify(meta)], {type:"application/json"}));
      form.append("file", file);
      const res = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
        { method:"POST", headers:{Authorization:`Bearer ${accessToken}`}, body:form }
      );
      if (res.ok) {
        const data = await res.json();
        pendingDocs.push({
          name: file.name,
          size: (file.size/1024).toFixed(1)+" KB",
          date: new Date().toLocaleDateString(),
          driveFileId: data.id,
          driveLink: data.webViewLink
        });
        renderPendingDocs();
      } else {
        const err = await res.json();
        if (err.error?.code === 401) {
          clearPersistedToken();
          showToast("Drive session expired. Click upload again to re-authenticate.", "error");
          return;
        }
        showToast(`Upload failed: ${err.error?.message}`,"error");
      }
    } catch(e) {
      showToast("Drive upload error — check console","error");
      console.error(e);
    }
  }
  if (statusEl) statusEl.textContent = `${pendingDocs.length} file(s) ready`;
}




async function addDocToCase() {
  // Show modal to select inbound/outbound
  showFileTypeModal().then(async (fileType) => {
    if (!fileType) return; // User cancelled
    
    const inp = document.createElement("input");
    inp.type = "file";
    inp.multiple = true;
    inp.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length) return;

      // Determine Drive folder: category > type > title > inbound/outbound
      const caseCategory = selCase?.category || "Other";
      const caseType = selCase?.type || "Other";
      const caseTitle = selCase?.title || "Untitled";
      const profileFolderId = selProfile?.driveFolderId || null;
      let targetFolderId = null;

      if (profileFolderId && hasValidToken()) {
        targetFolderId = await getOrCreateCaseFolderHierarchy(caseCategory, caseType, caseTitle, fileType, profileFolderId);
      }

      const newDocs = [];
      for (const f of files) {
        let driveFileId = null, driveLink = null;
        if (hasValidToken()) {
          const result = await uploadSingleFileToDrive(f, targetFolderId);
          if (result) {
            driveFileId = result.id;
            driveLink   = result.webViewLink;
          }
        }

        newDocs.push({
          name: f.name,
          size: (f.size / 1024).toFixed(1) + " KB",
          date: new Date().toLocaleDateString(),
          fileType: fileType,
          ...(driveFileId && { driveFileId, driveLink })
        });
      }

      const updDocs = [...(selCase.documents || []), ...newDocs];
      await dbUpdateCase(selCase.id, { documents: updDocs });
      selCase = { ...selCase, documents: updDocs };
      renderCaseDetail();
      showToast(`${newDocs.length} doc(s) attached as ${fileType}${newDocs[0]?.driveFileId ? " & synced to Drive" : " (locally)"}`);
    };
    inp.click();
  });
}

function renderPendingDocs() {
  const el = document.getElementById("cf-docs-list");
  if (!el) return;
  el.innerHTML = pendingDocs.map((doc, i) => `
    <div class="doc-item">
      <div>
        <div style="font-size:12px;color:var(--text);font-weight:600">
          <span onclick="openFilePreview(pendingDocs[${i}])" style="cursor:pointer;color:var(--gold);text-decoration:underline;text-underline-offset:3px">
            📎 ${doc.name}
          </span>
        </div>
        <div style="font-size:11px;color:var(--text-dim);margin-top:2px;display:flex;align-items:center;gap:8px">
          <span>${doc.size} · ${doc.date}${doc.driveFileId ? ' · ✅ Drive' : ' · 📋 Local'}</span>
          ${doc.fileType ? `<span style="background:${doc.fileType==='Inbound'?'#3b82f644':'#10b98144'};color:${doc.fileType==='Inbound'?'#3b82f6':'#10b981'};padding:2px 6px;border-radius:3px;font-size:10px;font-weight:600">${doc.fileType==='Inbound'?'📥 Inbound':'📤 Outbound'}</span>` : ''}
        </div>
      </div>
      <button style="background:transparent;border:none;color:var(--red);font-size:18px;cursor:pointer;padding:2px 8px;flex-shrink:0" onclick="removePendingDoc(${i})">×</button>
    </div>
  `).join("");
}

function removePendingDoc(i) {
  const doc = pendingDocs[i];
  if (doc && doc._localTempId) {
    delete pendingLocalFiles[doc._localTempId];
  }
  pendingDocs.splice(i,1);
  renderPendingDocs();
  const statusEl = document.getElementById("drive-status");
  if (statusEl) statusEl.textContent = pendingDocs.length ? `${pendingDocs.length} file(s) attached` : "";
}

function updateDriveFolderChip() {
  const chip = document.getElementById("drive-folder-chip");
  if (!chip) return;
  if (selProfile?.driveFolderId) {
    if (hasValidToken()) {
      chip.className = "drive-status-chip connected";
      chip.textContent = "● Drive Folder Linked";
      chip.title = "";
      chip.style.cursor = "default";
      chip.onclick = null;
    } else {
      // Folder linked but token expired — prompt user to re-auth with one click
      chip.className = "drive-status-chip disconnected";
      chip.textContent = "⚠ Drive Session Expired — Click to Re-connect";
      chip.title = "Click to refresh your Drive connection";
      chip.style.cursor = "pointer";
      chip.onclick = async () => {
        chip.textContent = "Connecting...";
        chip.onclick = null;
        try {
          await promptDriveAuth();
          updateDriveFolderChip();
          showToast("Drive re-connected! You can now save with file upload.");
        } catch (e) {
          chip.className = "drive-status-chip disconnected";
          chip.textContent = "⚠ Drive Session Expired — Click to Re-connect";
          chip.onclick = updateDriveFolderChip; // reset
          showToast("Drive re-connect failed.", "error");
        }
      };
    }
    chip.style.display = "inline-flex";
  } else if (accessToken) {
    chip.className = "drive-status-chip disconnected";
    chip.textContent = "● No Drive Folder";
    chip.style.display = "inline-flex";
    chip.style.cursor = "default";
    chip.onclick = null;
  } else {
    chip.style.display = "none";
  }
}


// ═══════════════════════════════════════════════════════════════
//  LOCAL ATTACHMENT — files staged locally, synced to Drive on save
// ═══════════════════════════════════════════════════════════════

// Map of pending local File objects keyed by a temp id so we can upload them on save
const pendingLocalFiles = {};

function triggerLocalAttach() {
  document.getElementById("local-file-input").click();
}

async function handleLocalAttach(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  for (const file of files) {
    const tempId = "local_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    pendingLocalFiles[tempId] = file;

    const docEntry = {
      name: file.name,
      size: (file.size / 1024).toFixed(1) + " KB",
      date: new Date().toLocaleDateString(),
      _localTempId: tempId,
    };
    pendingDocs.push(docEntry);
    renderPendingDocs();

    // Analysis removed — no auto brief
  }

  const statusEl = document.getElementById("drive-status");
  if (statusEl) statusEl.textContent = `${pendingDocs.length} file(s) attached`;
  e.target.value = "";
}

// ═══════════════════════════════════════════════════════════════
//  DRIVE FOLDER RESOLUTION — auto-create per case type
// ═══════════════════════════════════════════════════════════════

// Cache: hierarchical paths → Drive folder id
const caseFolderCache = {};

/**
 * Get (or create) the Drive subfolder for a given case with full hierarchy
 * under the profile's drive folder.
 *
 * Hierarchy:
 *   Simando Law (root DRIVE_FOLDER_ID)
 *     └─ Simando Law — <Profile Name>  (profile folder)
 *           └─ <Case Category>         (auto-created by this fn)
 *                 └─ <Case Type>       (auto-created by this fn)
 *                       └─ <Case Title> (auto-created by this fn)
 *                             ├─ Inbound
 *                             └─ Outbound
 *
 * @param {string} caseCategory   e.g. "Civil"
 * @param {string} caseType       e.g. "Staffa"
 * @param {string} caseTitle      e.g. "Case Title"
 * @param {string} fileType       "Inbound" or "Outbound"
 * @param {string} profileFolderId  the profile's Drive folder id
 * @returns {Promise<string|null>} the folder id, or null on failure
 */
async function getOrCreateCaseFolderHierarchy(caseCategory, caseType, caseTitle, fileType, profileFolderId) {
  const cacheKey = `${profileFolderId}::${caseCategory}::${caseType}::${caseTitle}::${fileType}`.toLowerCase();
  if (caseFolderCache[cacheKey]) return caseFolderCache[cacheKey];

  try {
    // Step 1: Get or create Category folder
    let categoryFolderId = await getOrCreateFolderInParent(caseCategory, profileFolderId);
    if (!categoryFolderId) return null;

    // Step 2: Get or create Type folder under Category
    let typeFolderId = await getOrCreateFolderInParent(caseType, categoryFolderId);
    if (!typeFolderId) return null;

    // Step 3: Get or create Title folder under Type
    let titleFolderId = await getOrCreateFolderInParent(caseTitle, typeFolderId);
    if (!titleFolderId) return null;

    // Step 4: Get or create Inbound/Outbound folder under Title
    let fileTypeFolderId = await getOrCreateFolderInParent(fileType, titleFolderId);
    if (!fileTypeFolderId) return null;

    caseFolderCache[cacheKey] = fileTypeFolderId;
    return fileTypeFolderId;
  } catch (err) {
    console.error("getOrCreateCaseFolderHierarchy error:", err);
    return null;
  }
}

/**
 * Helper: Get or create a folder with given name under a parent folder
 * @param {string} folderName
 * @param {string} parentFolderId
 * @returns {Promise<string|null>} folder id or null
 */
async function getOrCreateFolderInParent(folderName, parentFolderId) {
  try {
    // Search for existing folder
    const q = encodeURIComponent(
      `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${parentFolderId}' in parents and trashed=false`
    );
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    }
    // Not found — create it
    const folderId = await createDriveFolder(folderName, parentFolderId);
    return folderId;
  } catch (err) {
    console.error(`getOrCreateFolderInParent error for "${folderName}":`, err);
    return null;
  }
}

/**
 * Upload a single File object to Drive inside the given folder.
 * Returns the drive file metadata {id, webViewLink} or null on failure.
 */
async function uploadSingleFileToDrive(file, folderId) {
  const meta = { name: file.name, mimeType: file.type || "application/octet-stream" };
  if (folderId) meta.parents = [folderId];
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
  form.append("file", file);
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body: form }
  );
  if (res.ok) return await res.json();
  const err = await res.json().catch(() => ({}));
  if (err.error?.code === 401) {
    clearPersistedToken();
    showToast("Drive session expired. Re-authenticate and try again.", "error");
  } else {
    showToast(`Drive upload failed: ${err.error?.message || "Unknown error"}`, "error");
  }
  return null;
}

/**
 * Called from saveCase (in app.js) BEFORE the case is persisted.
 * Syncs any locally-staged files up to Drive under the correct folder hierarchy:
 * Category > Type > Title > Inbound/Outbound
 *
 * @param {string} caseCategory e.g. "Civil"
 * @param {string} caseType e.g. "Staffa"
 * @param {string} caseTitle e.g. "Case Title"
 * @param {string} profileFolderId  selProfile.driveFolderId
 * @returns {Promise<Array>} the updated pendingDocs array (local markers resolved to drive refs)
 */
async function syncPendingFilesToDrive(caseCategory, caseType, caseTitle, profileFolderId) {
  const localDocs = pendingDocs.filter(d => d._localTempId);
  if (!localDocs.length) return pendingDocs;

  // If no valid token, skip Drive upload entirely and save files as local-only.
  // The user can re-sync from the case detail view after re-authenticating Drive.
  if (!hasValidToken()) return pendingDocs;

  // Upload each staged local file with its associated fileType (Inbound/Outbound)
  for (const doc of localDocs) {
    const tempId = doc._localTempId;
    const file = pendingLocalFiles[tempId];
    if (!file) continue;
    
    // Get file type or default to "Inbound"
    const fileType = doc.fileType || "Inbound";
    
    // Resolve the target folder using the full hierarchy
    let targetFolderId = null;
    if (profileFolderId) {
      targetFolderId = await getOrCreateCaseFolderHierarchy(caseCategory, caseType, caseTitle, fileType, profileFolderId);
    } else if (DRIVE_FOLDER_ID) {
      targetFolderId = await getOrCreateCaseFolderHierarchy(caseCategory, caseType, caseTitle, fileType, DRIVE_FOLDER_ID);
    }
    
    if (targetFolderId) {
      const result = await uploadSingleFileToDrive(file, targetFolderId);
      if (result) {
        doc.driveFileId = result.id;
        doc.driveLink   = result.webViewLink;
        delete pendingLocalFiles[tempId]; // delete from store BEFORE clearing the key
        delete doc._localTempId;
      }
    }
  }

  // Clean up any orphaned local file refs
  Object.keys(pendingLocalFiles).forEach(k => {
    if (!pendingDocs.some(d => d._localTempId === k)) delete pendingLocalFiles[k];
  });

  return pendingDocs;
}

/**
 * Upload a profile photo (base64 dataUrl) to the attorney's Drive folder,
 * set it as publicly readable, and return { fileId, thumbnailUrl }.
 * The thumbnailUrl uses Google's thumbnail endpoint — no token needed for display.
 */
async function uploadProfilePhotoToDrive(dataUrl, folderId, profileName) {
  if (!hasValidToken()) throw new Error("Drive not connected");

  // Convert base64 dataUrl → Blob
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)[1];
  const byteChars = atob(base64);
  const byteArr = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
  const blob = new Blob([byteArr], { type: mime });
  const ext = mime.split("/")[1] || "jpg";

  // Upload via multipart
  const meta = {
    name: `profile-photo-${profileName.replace(/\s+/g,"-")}.${ext}`,
    mimeType: mime,
    ...(folderId && { parents: [folderId] })
  };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
  form.append("file", blob);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body: form }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Photo upload failed");
  }
  const { id: fileId } = await res.json();

  // Make it publicly readable so we can display it without a token
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ role: "reader", type: "anyone" })
  });

  // Use Google's direct thumbnail URL (works publicly after permission set above)
  const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w200`;

  return { fileId, thumbnailUrl };
}

/**
 * Delete a file from Drive by its id.
 */
async function deleteDriveFile(driveFileId) {
  if (!driveFileId || !hasValidToken()) return;
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  } catch (err) {
    console.error("deleteDriveFile error:", err);
  }
}

// Called by the GIS script itself once it's ready (via onload attribute)
window.onGoogleLibraryLoad = function() {
  initGoogleDrive();
};

window.addEventListener("load", () => {
  // Fallback: if GIS already loaded before this listener ran, init now
  if (typeof google !== "undefined" && google.accounts && google.accounts.oauth2) {
    initGoogleDrive();
  } else {
    setTimeout(initGoogleDrive, 1000);
  }
});

/**
 * Returns a promise that resolves when gTokenClient is ready,
 * or rejects after a timeout. Used by connectDriveForProfile.
 */
function waitForGoogleDriveReady(timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    if (gTokenClient) { resolve(); return; }
    const start = Date.now();
    const interval = setInterval(() => {
      if (gTokenClient) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(new Error(
          "Google Drive failed to initialize. Make sure your new site domain is added to " +
          "Authorized JavaScript Origins in your Google Cloud Console OAuth client settings."
        ));
      }
    }, 200);
  });
}
