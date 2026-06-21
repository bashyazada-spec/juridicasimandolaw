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
      scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly",
      callback: (response) => {
        if (response.access_token) {
          accessToken = response.access_token;
          persistToken(response.access_token, response.expires_in);
          console.log("Drive & Calendar auth success");
          if (pendingDriveAuthResolve) pendingDriveAuthResolve(accessToken);
          
          // Auto-trigger calendar refresh immediately upon successful connection
          if (typeof fetchAndRenderGoogleCalendarEvents === "function" && currentView === "dashboard") {
            fetchAndRenderGoogleCalendarEvents();
          }
        } else {
          console.error("Drive & Calendar auth response error:", response);
          if (pendingDriveAuthReject) pendingDriveAuthReject(new Error(response.error_description || "Auth failed"));
        }
        pendingDriveAuthResolve = pendingDriveAuthReject = null;
      },
      error_callback: (err) => {
        console.error("GIS error:", err);
        if (pendingDriveAuthReject) pendingDriveAuthReject(new Error(err.message || "OAuth error"));
        pendingDriveAuthResolve = pendingDriveAuthReject = null;
      }
    });
    console.log("Google Drive & Calendar APIs initialized");
  } catch (err) {
    console.error("Failed to initialize Google Services Client:", err);
  }
}

function promptDriveAuth() {
  if (!gTokenClient) {
    return Promise.reject(new Error("Google Client not ready. Reload the page."));
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

function hasValidToken() {
  return accessToken && Date.now() < tokenExpiresAt - 60000;
}

async function createDriveFolder(name, parentId = null) {
  const metadata = {
    name: name,
    mimeType: "application/vnd.google-apps.folder"
  };
  if (parentId && parentId !== "root") {
    metadata.parents = [parentId];
  }

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

// ── Automatically converts DOCX/DOC to PDF on Google Servers ──────────
async function convertWordToPdfAndUpload(file, folderId) {
  if (!hasValidToken()) throw new Error("Drive connection expired.");

  showToast("Processing document structure...");

  // Step 1: Upload raw Word file as a Google Doc
  const metadata = {
    name: `temp_convert_${Date.now()}`,
    mimeType: "application/vnd.google-apps.document"
  };
  if (folderId && folderId !== "root") {
    metadata.parents = [folderId];
  }

  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  const fileReader = new FileReader();
  const arrayBuffer = await new Promise((resolve, reject) => {
    fileReader.onload = () => resolve(fileReader.result);
    fileReader.onerror = () => reject(fileReader.error);
    fileReader.readAsArrayBuffer(file);
  });

  const metadataPart = delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: ' + (file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') + '\r\n\r\n';

  const encoder = new TextEncoder();
  const metadataBuffer = encoder.encode(metadataPart);
  const closeBuffer = encoder.encode(close_delim);

  const bodyBuffer = new Uint8Array(metadataBuffer.byteLength + arrayBuffer.byteLength + closeBuffer.byteLength);
  bodyBuffer.set(metadataBuffer, 0);
  bodyBuffer.set(new Uint8Array(arrayBuffer), metadataBuffer.byteLength);
  bodyBuffer.set(closeBuffer, metadataBuffer.byteLength + arrayBuffer.byteLength);

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`
    },
    body: bodyBuffer
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to initiate document conversion.");
  }

  const { id: tempDocId } = await res.json();

  // Step 2: Download the converted document as a high-fidelity PDF Blob
  showToast("Compiling PDF document layout...");
  const exportRes = await fetch(`https://www.googleapis.com/drive/v3/files/${tempDocId}/export?mimeType=application/pdf`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!exportRes.ok) {
    await deleteDriveFile(tempDocId).catch(() => {});
    throw new Error("Failed to compile layout into PDF.");
  }

  const pdfBlob = await exportRes.blob();

  // Step 3: Upload compiled PDF Blob back into your folder
  const pdfFileName = file.name.replace(/\.[^/.]+$/, "") + ".pdf";
  const pdfFile = new File([pdfBlob], pdfFileName, { type: "application/pdf" });
  pdfFile._isConvertedPdf = true; // Flag to prevent infinite loop recursion

  const finalPdfMeta = await uploadSingleFileToDrive(pdfFile, folderId);

  // Step 4: Delete the temporary workspace Google Doc
  await deleteDriveFile(tempDocId).catch(() => {});

  return finalPdfMeta;
}

async function uploadSingleFileToDrive(file, folderId) {
  if (!hasValidToken()) {
    throw new Error("Missing or invalid Google Drive access token.");
  }

  // Intercept and convert Microsoft Word files automatically
  const ext = file.name.split('.').pop().toLowerCase();
  if ((ext === 'docx' || ext === 'doc') && !file._isConvertedPdf) {
    try {
      return await convertWordToPdfAndUpload(file, folderId);
    } catch (err) {
      console.error("Word layout conversion failed, uploading original file:", err);
      showToast("Conversion failed — uploading original Word file instead.", "error");
    }
  }

  const metadata = {
    name: file.name,
    mimeType: file.type || "application/octet-stream"
  };
  if (folderId && folderId !== "root") {
    metadata.parents = [folderId];
  }

  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  const fileReader = new FileReader();
  const arrayBuffer = await new Promise((resolve, reject) => {
    fileReader.onload = () => resolve(fileReader.result);
    fileReader.onerror = () => reject(fileReader.error);
    fileReader.readAsArrayBuffer(file);
  });

  const metadataPart = delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: ' + (file.type || 'application/octet-stream') + '\r\n\r\n';

  const encoder = new TextEncoder();
  const metadataBuffer = encoder.encode(metadataPart);
  const closeBuffer = encoder.encode(close_delim);

  const bodyBuffer = new Uint8Array(metadataBuffer.byteLength + arrayBuffer.byteLength + closeBuffer.byteLength);
  bodyBuffer.set(metadataBuffer, 0);
  bodyBuffer.set(new Uint8Array(arrayBuffer), metadataBuffer.byteLength);
  bodyBuffer.set(closeBuffer, metadataBuffer.byteLength + arrayBuffer.byteLength);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      },
      body: bodyBuffer
    }
  );

  if (res.ok) {
    return await res.json();
  } else {
    const err = await res.json().catch(() => ({}));
    if (res.status === 401 || err.error?.code === 401) {
      clearPersistedToken();
      showToast("Drive session expired. Re-authenticate and try again.", "error");
    } else {
      showToast(`Drive upload failed: ${err.error?.message || "Unknown error"}`, "error");
    }
    return null;
  }
}

async function addDocToCase() {
  const fileTypeEl = document.querySelector('input[name="cd-file-type"]:checked');
  const fileType = fileTypeEl ? fileTypeEl.value : "Inbound";

  const inp = document.createElement("input");
  inp.type = "file";
  inp.multiple = true;
  inp.onchange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (!hasValidToken()) {
      showToast("Session expired — reconnecting…");
      try {
        await waitForGoogleDriveReady(6000);
        await promptDriveAuth();
        showToast("Reconnected — uploading files…");
      } catch (authErr) {
        console.warn("Re-auth failed:", authErr);
        showToast("Could not connect — saving locally only.", "error");
      }
    }

    let profileFolderId = selProfile?.driveFolderId || null;
    if (!profileFolderId && selProfile && hasValidToken()) {
      showToast("Creating missing profile folder…");
      profileFolderId = await setupProfileDriveFolder(selProfile);
    }

    const caseCategory = selCase?.category || "Other";
    const caseType     = selCase?.type     || "Other";
    const caseTitle    = selCase?.title    || "Untitled";
    let targetFolderId = null;

    if (hasValidToken()) {
      const rootFolder = profileFolderId || DRIVE_FOLDER_ID || "root";
      console.log("Creating folder hierarchy for:", {caseCategory, caseType, caseTitle, fileType});
      targetFolderId = await getOrCreateCaseFolderHierarchy(caseCategory, caseType, caseTitle, fileType, rootFolder);
    }

    const newDocs = [];
    for (const f of files) {
      let driveFileId = null, driveLink = null;
      if (hasValidToken() && targetFolderId) {
        console.log("Uploading file to Drive:", f.name);
        const result = await uploadSingleFileToDrive(f, targetFolderId);
        if (result) {
          driveFileId = result.id;
          driveLink   = result.webViewLink;
        }
      }

      // Rename extension output to .pdf in dashboard UI for Word conversions
      const isWord = f.name.endsWith(".docx") || f.name.endsWith(".doc");
      const displayName = (isWord && driveFileId) ? f.name.replace(/\.[^/.]+$/, "") + ".pdf" : f.name;

      newDocs.push({
        name: displayName,
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

    const uploadedToDrive = newDocs.filter(d => d.driveFileId).length;
    const savedLocally    = newDocs.length - uploadedToDrive;
    if (uploadedToDrive && !savedLocally) {
      showToast(`${uploadedToDrive} doc(s) attached as ${fileType} & synced to Drive ✅`);
    } else if (uploadedToDrive && savedLocally) {
      showToast(`${uploadedToDrive} sent to Drive, ${savedLocally} saved locally (Drive unavailable)`, "error");
    } else {
      showToast(`${newDocs.length} doc(s) attached locally (Drive not connected)`);
    }

    if (typeof updateDriveFolderChip === "function") updateDriveFolderChip();
  };
  inp.click();
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
      chip.className = "drive-status-chip disconnected";
      chip.textContent = "⚠ Drive Session Expired — Click to Reconnect";
      chip.title = "Click to refresh your Drive connection";
      chip.style.cursor = "pointer";
      chip.onclick = async () => {
        chip.textContent = "Reconnecting…";
        chip.onclick = null;
        try {
          await waitForGoogleDriveReady(6000);
          await promptDriveAuth();
          updateDriveFolderChip();
          showToast("Drive reconnected ✅");
        } catch (e) {
          chip.className = "drive-status-chip disconnected";
          chip.textContent = "⚠ Drive Session Expired — Click to Reconnect";
          chip.onclick = () => updateDriveFolderChip();
          showToast("Drive reconnect failed — try again.", "error");
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

const pendingLocalFiles = {};

function triggerLocalAttach() {
  document.getElementById("local-file-input").click();
}

async function handleLocalAttach(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  const fileTypeEl = document.querySelector('input[name="cf-file-type"]:checked');
  const fileType = fileTypeEl ? fileTypeEl.value : "Inbound";

  for (const file of files) {
    const tempId = "local_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    pendingLocalFiles[tempId] = file;

    const docEntry = {
      name: file.name,
      size: (file.size / 1024).toFixed(1) + " KB",
      date: new Date().toLocaleDateString(),
      fileType: fileType,
      _localTempId: tempId,
    };
    pendingDocs.push(docEntry);
    renderPendingDocs();
  }

  const statusEl = document.getElementById("drive-status");
  if (statusEl) statusEl.textContent = `${pendingDocs.length} file(s) attached`;
  e.target.value = "";
}

// ═══════════════════════════════════════════════════════════════
//  DRIVE FOLDER RESOLUTION — auto-create per case type
// ═══════════════════════════════════════════════════════════════

const caseFolderCache = {};

async function getOrCreateCaseFolderHierarchy(caseCategory, caseType, caseTitle, fileType, profileFolderId) {
  const rootId = profileFolderId || DRIVE_FOLDER_ID || "root";
  const cacheKey = `${rootId}::${caseCategory}::${caseType}::${caseTitle}::${fileType}`.toLowerCase();
  if (caseFolderCache[cacheKey]) return caseFolderCache[cacheKey];

  try {
    let categoryFolderId = await getOrCreateFolderInParent(caseCategory, rootId);
    if (!categoryFolderId) return null;

    let typeFolderId = await getOrCreateFolderInParent(caseType, categoryFolderId);
    if (!typeFolderId) return null;

    let titleFolderId = await getOrCreateFolderInParent(caseTitle, typeFolderId);
    if (!titleFolderId) return null;

    let fileTypeFolderId = await getOrCreateFolderInParent(fileType, titleFolderId);
    if (!fileTypeFolderId) return null;

    caseFolderCache[cacheKey] = fileTypeFolderId;
    return fileTypeFolderId;
  } catch (err) {
    console.error("getOrCreateCaseFolderHierarchy error:", err);
    return null;
  }
}

async function getOrCreateFolderInParent(folderName, parentFolderId) {
  const pid = parentFolderId || "root";
  try {
    const q = encodeURIComponent(
      `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${pid}' in parents and trashed=false`
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
    const folderId = await createDriveFolder(folderName, pid);
    return folderId;
  } catch (err) {
    console.error(`getOrCreateFolderInParent error for "${folderName}":`, err);
    return null;
  }
}

async function syncPendingFilesToDrive(caseCategory, caseType, caseTitle, profileFolderId) {
  const localDocs = pendingDocs.filter(d => d._localTempId);
  if (!localDocs.length) return pendingDocs;

  if (!hasValidToken()) return pendingDocs;

  let activeProfileFolderId = profileFolderId;
  if (!activeProfileFolderId && selProfile && hasValidToken()) {
    activeProfileFolderId = await setupProfileDriveFolder(selProfile);
  }

  const rootFolder = activeProfileFolderId || DRIVE_FOLDER_ID || "root";

  for (const doc of localDocs) {
    const tempId = doc._localTempId;
    const file = pendingLocalFiles[tempId];
    if (!file) continue;
    
    const fileType = doc.fileType || "Inbound";
    let targetFolderId = await getOrCreateCaseFolderHierarchy(caseCategory, caseType, caseTitle, fileType, rootFolder);
    
    if (targetFolderId) {
      const result = await uploadSingleFileToDrive(file, targetFolderId);
      if (result) {
        doc.driveFileId = result.id;
        doc.driveLink   = result.webViewLink;

        // Change extension in pending display arrays to .pdf
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'docx' || ext === 'doc') {
          doc.name = file.name.replace(/\.[^/.]+$/, "") + ".pdf";
        }

        delete pendingLocalFiles[tempId];
        delete doc._localTempId;
      }
    }
  }

  Object.keys(pendingLocalFiles).forEach(k => {
    if (!pendingDocs.some(d => d._localTempId === k)) delete pendingLocalFiles[k];
  });

  return pendingDocs;
}

async function uploadProfilePhotoToDrive(dataUrl, folderId, profileName) {
  if (!hasValidToken()) throw new Error("Drive not connected");

  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)[1];
  const byteChars = atob(base64);
  const byteArr = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
  const blob = new Blob([byteArr], { type: mime });
  const ext = mime.split("/")[1] || "jpg";

  const metadata = {
    name: `profile-photo-${profileName.replace(/\s+/g,"-")}.${ext}`,
    mimeType: mime
  };
  if (folderId && folderId !== "root") {
    metadata.parents = [folderId];
  }

  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  const arrayBuffer = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });

  const metadataPart = delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: ' + mime + '\r\n\r\n';

  const encoder = new TextEncoder();
  const metadataBuffer = encoder.encode(metadataPart);
  const closeBuffer = encoder.encode(close_delim);

  const bodyBuffer = new Uint8Array(metadataBuffer.byteLength + arrayBuffer.byteLength + closeBuffer.byteLength);
  bodyBuffer.set(metadataBuffer, 0);
  bodyBuffer.set(new Uint8Array(arrayBuffer), metadataBuffer.byteLength);
  bodyBuffer.set(closeBuffer, metadataBuffer.byteLength + arrayBuffer.byteLength);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      },
      body: bodyBuffer
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Photo upload failed");
  }
  const { id: fileId } = await res.json();

  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ role: "reader", type: "anyone" })
  });

  const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w200`;
  return { fileId, thumbnailUrl };
}

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

// ═══════════════════════════════════════════════════════════════
//  GOOGLE CALENDAR EVENT SYNCHRONIZATION
// ═══════════════════════════════════════════════════════════════
async function createOrUpdateCalendarEvent(caseData) {
  if (!hasValidToken() || !caseData.dueDate) return null;

  const summary = `⚖️ Simando Law: ${caseData.title}`;
  const description = `Case Number: ${caseData.caseNumber || "N/A"}\nCategory: ${caseData.category || "N/A"}\nType: ${caseData.type || "N/A"}\nVenue: ${caseData.venue || "N/A"}\nParties: ${caseData.parties || "N/A"}\n\nNarrative:\n${caseData.narrative || ""}`;
  
  const startDate = caseData.dueDate;
  const startDateTime = new Date(startDate + "T00:00:00");
  startDateTime.setDate(startDateTime.getDate() + 1);
  const endDate = startDateTime.toISOString().split("T")[0];

  const eventBody = {
    summary: summary,
    description: description,
    start: { date: startDate },
    end: { date: endDate },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 1440 }, 
        { method: 'popup', minutes: 10080 } 
      ]
    }
  };

  try {
    let url = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
    let method = "POST";

    if (caseData.calendarEventId) {
      url += `/${caseData.calendarEventId}`;
      method = "PUT";
    }

    const res = await fetch(url, {
      method: method,
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(eventBody)
    });

    if (res.ok) {
      const data = await res.json();
      return data.id;
    } else if (res.status === 404 && caseData.calendarEventId) {
      const fallbackRes = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(eventBody)
      });
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        return fallbackData.id;
      }
    }
  } catch (err) {
    console.error("Calendar sync error:", err);
  }
  return null;
}

async function deleteCalendarEvent(eventId) {
  if (!eventId || !hasValidToken()) return;
  try {
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${accessToken}` }
    });
  } catch (err) {
    console.error("deleteCalendarEvent error:", err);
  }
}

window.onGoogleLibraryLoad = function() {
  initGoogleDrive();
};

window.addEventListener("load", () => {
  if (typeof google !== "undefined" && google.accounts && google.accounts.oauth2) {
    initGoogleDrive();
  } else {
    setTimeout(initGoogleDrive, 1000);
  }
});

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
          "Google Drive failed to initialize. Make sure your domain is added to " +
          "Authorized JavaScript Origins in your Google Cloud Console OAuth client settings."
        ));
      }
    }, 200);
  });
}
