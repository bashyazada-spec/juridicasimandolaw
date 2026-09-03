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

// ── Resilient Folder Creation with Stale Parent ID Recovery ──
async function createDriveFolder(name, parentId = null) {
  const metadata = {
    name: name,
    mimeType: "application/vnd.google-apps.folder"
  };
  if (parentId && parentId !== "root") {
    metadata.parents = [parentId];
  }

  try {
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
      // If parent ID is invalid or deleted (404), self-heal by creating in root
      if ((res.status === 404 || err.error?.code === 404) && parentId) {
        console.warn(`Parent folder ${parentId} was deleted or not found. Self-healing to root.`);
        delete metadata.parents;
        const retryRes = await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(metadata)
        });
        if (retryRes.ok) {
          return (await retryRes.json()).id;
        }
      }
      throw new Error(err.error?.message || "Failed to create Drive folder");
    }
    return (await res.json()).id;
  } catch (e) {
    console.error("createDriveFolder error:", e);
    throw e;
  }
}

async function setupProfileDriveFolder(profile) {
  if (!profile) return null;
  if (!hasValidToken()) {
    showToast("Please connect Google Drive first", "error");
    return null;
  }

  // Verify existing folder ID is actually accessible
  if (profile.driveFolderId) {
    try {
      const checkRes = await fetch(`https://www.googleapis.com/drive/v3/files/${profile.driveFolderId}?fields=id,trashed`, {
        headers: { "Authorization": `Bearer ${accessToken}` }
      });
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (!checkData.trashed) {
          return profile.driveFolderId;
        }
      }
    } catch (e) { /* stale ID */ }
  }

  try {
    const folderName = `Simando Law — ${profile.name}`;
    const folderId = await createDriveFolder(folderName, null);
    await dbUpdateProfile(profile.id, { driveFolderId: folderId });
    profile.driveFolderId = folderId;
    showToast("Drive folder linked for profile");
    return folderId;
  } catch (err) {
    console.error("Folder creation error:", err);
    showToast("Drive folder creation failed: " + err.message, "error");
    return null;
  }
}

// ── Robust Word (.docx / .doc) to PDF Conversion ──────────────
async function convertWordToPdfAndUpload(file, folderId) {
  if (!hasValidToken()) throw new Error("Drive connection expired.");

  showToast("Converting Word document to PDF...");

  const targetFolder = (folderId && folderId !== "root") ? folderId : null;

  // Step 1: Upload Word file as a Google Doc (triggers Google server conversion)
  const metadata = {
    name: `temp_convert_${Date.now()}`,
    mimeType: "application/vnd.google-apps.document"
  };
  if (targetFolder) {
    metadata.parents = [targetFolder];
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

  let res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`
    },
    body: bodyBuffer
  });

  // Self-heal if targetFolder returned 404
  if (!res.ok && targetFolder) {
    delete metadata.parents;
    const retryMetadataPart = delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: ' + (file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') + '\r\n\r\n';
    
    const retryMetaBuf = encoder.encode(retryMetadataPart);
    const retryBodyBuf = new Uint8Array(retryMetaBuf.byteLength + arrayBuffer.byteLength + closeBuffer.byteLength);
    retryBodyBuf.set(retryMetaBuf, 0);
    retryBodyBuf.set(new Uint8Array(arrayBuffer), retryMetaBuf.byteLength);
    retryBodyBuf.set(closeBuffer, retryMetaBuf.byteLength + arrayBuffer.byteLength);

    res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      },
      body: retryBodyBuf
    });
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to upload document for conversion.");
  }

  const { id: tempDocId } = await res.json();

  // Step 2: Export Google Doc as a PDF Blob
  showToast("Compiling layout into PDF...");
  const exportRes = await fetch(`https://www.googleapis.com/drive/v3/files/${tempDocId}/export?mimeType=application/pdf`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!exportRes.ok) {
    await deleteDriveFile(tempDocId).catch(() => {});
    throw new Error("Failed to export PDF layout.");
  }

  const pdfBlob = await exportRes.blob();

  // Step 3: Save the converted PDF directly into the target folder
  const pdfFileName = file.name.replace(/\.[^/.]+$/, "") + ".pdf";
  const pdfFile = new File([pdfBlob], pdfFileName, { type: "application/pdf" });
  pdfFile._isConvertedPdf = true;

  const finalPdfMeta = await uploadSingleFileToDrive(pdfFile, targetFolder);

  // Step 4: Delete the temporary workspace file
  await deleteDriveFile(tempDocId).catch(() => {});

  showToast(`Converted & saved: ${pdfFileName} ✅`);
  return finalPdfMeta;
}

async function uploadSingleFileToDrive(file, folderId) {
  if (!hasValidToken()) {
    throw new Error("Missing or invalid Google Drive access token.");
  }

  // Intercept and convert Microsoft Word files (.docx / .doc)
  const ext = file.name.split('.').pop().toLowerCase();
  if ((ext === 'docx' || ext === 'doc') && !file._isConvertedPdf) {
    try {
      return await convertWordToPdfAndUpload(file, folderId);
    } catch (err) {
      console.warn("Word to PDF conversion notice, uploading original file:", err);
      showToast("Conversion skipped — saving original Word file.", "error");
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

  let res = await fetch(
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

  // Self-heal if target parent folder returned 404
  if (!res.ok && metadata.parents) {
    delete metadata.parents;
    const retryMetaPart = delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: ' + (file.type || 'application/octet-stream') + '\r\n\r\n';
    
    const retryMetaBuf = encoder.encode(retryMetaPart);
    const retryBodyBuf = new Uint8Array(retryMetaBuf.byteLength + arrayBuffer.byteLength + closeBuffer.byteLength);
    retryBodyBuf.set(retryMetaBuf, 0);
    retryBodyBuf.set(new Uint8Array(arrayBuffer), retryMetaBuf.byteLength);
    retryBodyBuf.set(closeBuffer, retryMetaBuf.byteLength + arrayBuffer.byteLength);

    res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`
        },
        body: retryBodyBuf
      }
    );
  }

  if (res.ok) {
    return await res.json();
  } else {
    const err = await res.json().catch(() => ({}));
    if (res.status === 401 || err.error?.code === 401) {
      clearPersistedToken();
      showToast("Drive session expired. Please re-authenticate.", "error");
    } else {
      showToast(`Upload warning: ${err.error?.message || "Saved locally"}`, "error");
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

    const u = window._currentUser || window._auth?.currentUser;
    const myProf = profiles.find(p => p.ownerUid === u?.uid || (p.email && p.email.toLowerCase() === u?.email?.toLowerCase())) || selProfile;
    
    let profileFolderId = myProf?.driveFolderId || selProfile?.driveFolderId || null;
    if (!profileFolderId && myProf && hasValidToken()) {
      profileFolderId = await setupProfileDriveFolder(myProf);
    }

    const caseCategory = selCase?.category || "Other";
    const caseType     = selCase?.type     || "Other";
    const caseTitle    = selCase?.title    || "Untitled";
    let targetFolderId = null;

    if (hasValidToken()) {
      const rootFolder = profileFolderId || "root";
      targetFolderId = await getOrCreateCaseFolderHierarchy(caseCategory, caseType, caseTitle, fileType, rootFolder);
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
    if (uploadedToDrive) {
      showToast(`${uploadedToDrive} file(s) synced & saved ✅`);
    } else {
      showToast(`${newDocs.length} file(s) attached locally`);
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
      chip.style.display = "inline-flex";
    } else {
      chip.className = "drive-status-chip disconnected";
      chip.textContent = "⚠ Drive Expired — Click to Reconnect";
      chip.style.display = "inline-flex";
      chip.onclick = async () => {
        try {
          await waitForGoogleDriveReady(6000);
          await promptDriveAuth();
          updateDriveFolderChip();
          showToast("Drive reconnected ✅");
        } catch (e) {
          showToast("Drive reconnect failed.", "error");
        }
      };
    }
  } else {
    chip.style.display = "none";
  }
}

// ═══════════════════════════════════════════════════════════════
//  LOCAL ATTACHMENT
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
//  DRIVE FOLDER HIERARCHY RESOLUTION (SELF-HEALING)
// ═══════════════════════════════════════════════════════════════
const caseFolderCache = {};

async function getOrCreateCaseFolderHierarchy(caseCategory, caseType, caseTitle, fileType, profileFolderId) {
  const rootId = (profileFolderId && profileFolderId !== "root") ? profileFolderId : "root";
  const cacheKey = `${rootId}::${caseCategory}::${caseType}::${caseTitle}::${fileType}`.toLowerCase();
  if (caseFolderCache[cacheKey]) return caseFolderCache[cacheKey];

  try {
    let categoryFolderId = await getOrCreateFolderInParent(caseCategory, rootId);
    let typeFolderId = await getOrCreateFolderInParent(caseType, categoryFolderId);
    let titleFolderId = await getOrCreateFolderInParent(caseTitle, typeFolderId);
    let fileTypeFolderId = await getOrCreateFolderInParent(fileType, titleFolderId);

    if (fileTypeFolderId) {
      caseFolderCache[cacheKey] = fileTypeFolderId;
      return fileTypeFolderId;
    }
  } catch (err) {
    console.warn("Folder hierarchy resolution notice:", err);
  }
  return rootId !== "root" ? rootId : null;
}

async function getOrCreateFolderInParent(folderName, parentFolderId) {
  const pid = (parentFolderId && parentFolderId !== "root") ? parentFolderId : "root";
  try {
    const q = encodeURIComponent(
      `mimeType='application/vnd.google-apps.folder' and name='${folderName.replace(/'/g, "\\'")}' and '${pid}' in parents and trashed=false`
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
    console.warn(`getOrCreateFolderInParent retry for "${folderName}":`, err);
    try {
      return await createDriveFolder(folderName, null);
    } catch (e) {
      return null;
    }
  }
}

async function syncPendingFilesToDrive(caseCategory, caseType, caseTitle, profileFolderId) {
  const localDocs = pendingDocs.filter(d => d._localTempId);
  if (!localDocs.length || !hasValidToken()) return pendingDocs;

  const u = window._currentUser || window._auth?.currentUser;
  const myProf = profiles.find(p => p.ownerUid === u?.uid || (p.email && p.email.toLowerCase() === u?.email?.toLowerCase())) || selProfile;

  let activeProfileFolderId = profileFolderId || myProf?.driveFolderId;
  if (!activeProfileFolderId && myProf && hasValidToken()) {
    activeProfileFolderId = await setupProfileDriveFolder(myProf);
  }

  const rootFolder = activeProfileFolderId || "root";

  for (const doc of localDocs) {
    const tempId = doc._localTempId;
    const file = pendingLocalFiles[tempId];
    if (!file) continue;
    
    const fileType = doc.fileType || "Inbound";
    let targetFolderId = await getOrCreateCaseFolderHierarchy(caseCategory, caseType, caseTitle, fileType, rootFolder);
    
    const result = await uploadSingleFileToDrive(file, targetFolderId);
    if (result) {
      doc.driveFileId = result.id;
      doc.driveLink   = result.webViewLink;

      const ext = file.name.split('.').pop().toLowerCase();
      if (ext === 'docx' || ext === 'doc') {
        doc.name = file.name.replace(/\.[^/.]+$/, "") + ".pdf";
      }

      delete pendingLocalFiles[tempId];
      delete doc._localTempId;
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

  let res = await fetch(
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

  if (!res.ok && metadata.parents) {
    delete metadata.parents;
    const retryMeta = encoder.encode(delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + delimiter + 'Content-Type: ' + mime + '\r\n\r\n');
    const retryBuf = new Uint8Array(retryMeta.byteLength + arrayBuffer.byteLength + closeBuffer.byteLength);
    retryBuf.set(retryMeta, 0);
    retryBuf.set(new Uint8Array(arrayBuffer), retryMeta.byteLength);
    retryBuf.set(closeBuffer, retryMeta.byteLength + arrayBuffer.byteLength);

    res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      },
      body: retryBuf
    });
  }

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
    console.warn("deleteDriveFile warning:", err);
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
    }
  } catch (err) {
    console.warn("Calendar sync notice:", err);
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
    console.warn("deleteCalendarEvent notice:", err);
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
        reject(new Error("Google Drive failed to initialize."));
      }
    }, 200);
  });
}
