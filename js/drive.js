let gTokenClient = null;
let accessToken  = null;
let tokenExpiresAt = 0;
let pendingDriveAuthResolve = null;
let pendingDriveAuthReject  = null;
let driveInitAttempts = 0;
const MAX_DRIVE_INIT_ATTEMPTS = 10;

// ── User-Scoped Token Persistence ────────────────────────────
function getActiveUserUid() {
  return window._currentUser?.uid || window._auth?.currentUser?.uid || null;
}

function restoreTokenForUser(uid) {
  const targetUid = uid || getActiveUserUid();
  if (!targetUid) return false;
  try {
    const saved = localStorage.getItem(`gDriveToken_${targetUid}`);
    if (saved) {
      const { token, expiresAt } = JSON.parse(saved);
      if (token && expiresAt && Date.now() < expiresAt - 60000) {
        accessToken    = token;
        tokenExpiresAt = expiresAt;
        return true;
      }
    }
  } catch (e) {}
  return false;
}

function persistTokenForUser(token, expiresIn, uid) {
  const targetUid = uid || getActiveUserUid();
  tokenExpiresAt = Date.now() + (expiresIn || 3600) * 1000;
  accessToken = token;
  if (targetUid) {
    try {
      localStorage.setItem(`gDriveToken_${targetUid}`, JSON.stringify({ token, expiresAt: tokenExpiresAt }));
    } catch (e) {}
  }
}

function clearPersistedToken(uid) {
  const targetUid = uid || getActiveUserUid();
  accessToken    = null;
  tokenExpiresAt = 0;
  if (targetUid) {
    try { localStorage.removeItem(`gDriveToken_${targetUid}`); } catch (e) {}
  }
}

window.addEventListener("firebase-ready", () => {
  if (window._auth && typeof window._fbOnAuth === "function") {
    window._fbOnAuth(window._auth, (user) => {
      if (user) {
        restoreTokenForUser(user.uid);
        if (typeof updateWorkspaceStatus === "function") updateWorkspaceStatus(false);
        if (typeof window.renderGoogleStatusPopover === "function") window.renderGoogleStatusPopover();
      }
    });
  }
});

window.disconnectDriveAccount = function() {
  if (typeof window.openConfirmModal === "function") {
    window.openConfirmModal({
      icon: "bi-cloud-slash",
      title: "Disconnect Google Drive?",
      body: "Are you sure you want to unlink your Google Drive account from this profile?<br>You will need to re-authorize to store case documents.",
      confirmText: "Disconnect",
      confirmStyle: "btn-danger",
      onConfirm: () => executeDriveDisconnect()
    });
  } else {
    executeDriveDisconnect();
  }
};

function executeDriveDisconnect() {
  const activeUid = getActiveUserUid();
  if (typeof google !== "undefined" && google.accounts?.oauth2 && accessToken) {
    try { google.accounts.oauth2.revoke(accessToken, () => {}); } catch (e) {}
  }
  clearPersistedToken(activeUid);
  showToast("Google Drive disconnected successfully.");
  if (typeof renderMyProfile === "function") renderMyProfile();
  if (typeof renderSettingsView === "function") renderSettingsView();
  if (typeof updateWorkspaceStatus === "function") updateWorkspaceStatus(false);
  if (typeof window.renderGoogleStatusPopover === "function") window.renderGoogleStatusPopover();
}

function initGoogleDrive() {
  if (typeof google === "undefined" || !google.accounts?.oauth2) {
    driveInitAttempts++;
    if (driveInitAttempts < MAX_DRIVE_INIT_ATTEMPTS) setTimeout(initGoogleDrive, 400);
    return;
  }
  try {
    gTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly",
      callback: (response) => {
        if (response.access_token) {
          persistTokenForUser(response.access_token, response.expires_in, getActiveUserUid());
          if (pendingDriveAuthResolve) pendingDriveAuthResolve(accessToken);
          if (typeof fetchAndRenderGoogleCalendarEvents === "function" && currentView === "dashboard") fetchAndRenderGoogleCalendarEvents();
          if (typeof renderMyProfile === "function") renderMyProfile();
          if (typeof renderSettingsView === "function") renderSettingsView();
          if (typeof updateWorkspaceStatus === "function") updateWorkspaceStatus(false);
          if (typeof window.renderGoogleStatusPopover === "function") window.renderGoogleStatusPopover();
        } else if (pendingDriveAuthReject) {
          pendingDriveAuthReject(new Error(response.error_description || "Authorization failed."));
        }
        pendingDriveAuthResolve = pendingDriveAuthReject = null;
      },
      error_callback: (err) => {
        let errorMsg = "OAuth authorization cancelled or closed.";
        if (err?.type === "popup_closed") errorMsg = "Google Sign-In popup was closed before completing authorization.";
        else if (err?.type === "popup_blocked") errorMsg = "The authorization popup was blocked by your browser.";
        else if (err?.message) errorMsg = err.message;
        if (pendingDriveAuthReject) pendingDriveAuthReject(new Error(errorMsg));
        pendingDriveAuthResolve = pendingDriveAuthReject = null;
      }
    });
  } catch (err) {
    console.error("Failed to initialize Google Services Client:", err);
  }
}

function promptDriveAuth(interactive = true) {
  if (!gTokenClient) initGoogleDrive();
  if (!gTokenClient) return Promise.reject(new Error("Google Client is still initializing. Please tap Connect again."));

  return new Promise((resolve, reject) => {
    pendingDriveAuthResolve = resolve;
    pendingDriveAuthReject = reject;
    try {
      const u = window._currentUser || window._auth?.currentUser;
      const authParams = { prompt: interactive ? "select_account" : "none" };
      if (u?.email) authParams.hint = u.email;
      gTokenClient.requestAccessToken(authParams);
    } catch (e) {
      pendingDriveAuthResolve = pendingDriveAuthReject = null;
      reject(e);
    }
  });
}

function hasValidToken() {
  if (!accessToken) restoreTokenForUser();
  return !!(accessToken && Date.now() < tokenExpiresAt - 60000);
}

window.connectDriveDirectly = async function() {
  const btn = document.getElementById("drive-modal-connect-btn");
  const origHtml = btn ? btn.innerHTML : `<i class="bi bi-google"></i> Connect Google Account`;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" style="width:14px;height:14px;border-top-color:#040810;display:inline-block;vertical-align:middle;margin-right:6px"></span> Connecting...`;
  }
  try {
    showToast("Opening Google Sign-In...");
    await promptDriveAuth(true);
    if (typeof closeDriveWarningModal === "function") closeDriveWarningModal();
    showToast("Google Account connected successfully! ✅");

    const u = window._currentUser;
    const myProf = u && window.profiles ? window.profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase())) : null;
    if (myProf && !myProf.driveFolderId) {
      try {
        const folderId = await createDriveFolder(`Simando Law — ${myProf.name}`, DRIVE_FOLDER_ID || null);
        if (folderId && typeof dbUpdateProfile === "function") {
          await dbUpdateProfile(myProf.id, { driveFolderId: folderId });
          myProf.driveFolderId = folderId;
        }
      } catch (fErr) {}
    }

    if (typeof updateWorkspaceStatus === "function") updateWorkspaceStatus(false);
    if (typeof renderSettingsView === "function") renderSettingsView();
    if (typeof window.renderGoogleStatusPopover === "function") window.renderGoogleStatusPopover();
    if (typeof fetchAndRenderGoogleCalendarEvents === "function" && currentView === "dashboard") fetchAndRenderGoogleCalendarEvents();
  } catch (err) {
    showToast("Google connection failed: " + err.message, "error");
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
  }
};

// ── Folder Management ────────────────────────────────────────
async function createDriveFolder(name, parentId = null) {
  const metadata = { name, mimeType: "application/vnd.google-apps.folder" };
  if (parentId && parentId !== "root") metadata.parents = [parentId];

  const res = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(metadata)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if ((res.status === 404 || err.error?.code === 404) && parentId) {
      delete metadata.parents;
      const retryRes = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(metadata)
      });
      if (retryRes.ok) return (await retryRes.json()).id;
    }
    throw new Error(err.error?.message || "Failed to create Drive folder");
  }
  return (await res.json()).id;
}

async function setupProfileDriveFolder(profile) {
  if (!profile) return null;
  if (!hasValidToken()) { showToast("Please connect Google Drive first", "error"); return null; }

  if (profile.driveFolderId) {
    try {
      const checkRes = await fetch(`https://www.googleapis.com/drive/v3/files/${profile.driveFolderId}?fields=id,trashed`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (!checkData.trashed) return profile.driveFolderId;
      }
    } catch (e) {}
  }

  try {
    const folderId = await createDriveFolder(`Simando Law — ${profile.name}`, null);
    await dbUpdateProfile(profile.id, { driveFolderId: folderId });
    profile.driveFolderId = folderId;
    showToast("Drive folder linked for profile");
    return folderId;
  } catch (err) {
    showToast("Drive folder creation failed: " + err.message, "error");
    return null;
  }
}

async function shareDriveFolderWithAssociate(folderId, associateEmail) {
  if (!folderId || !associateEmail || !hasValidToken()) return false;
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}/permissions?sendNotificationEmail=false`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ role: "writer", type: "user", emailAddress: associateEmail })
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}
window.shareDriveFolderWithAssociate = shareDriveFolderWithAssociate;

// ═══════════════════════════════════════════════════════════════
//  IN-APP FILE BLOB FETCHER & GOOGLE DOCS API ENGINE
// ═══════════════════════════════════════════════════════════════
function guessMimeFromFilename(name = "") {
  const ext = String(name).split(".").pop().toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "txt") return "text/plain";
  return "";
}

async function fetchDriveFileBlob(driveFileId, fileName = "") {
  if (!hasValidToken() || !driveFileId) throw new Error("Google Drive not connected.");
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Unable to fetch file from Google Drive.");
  }
  const rawBlob = await res.blob();
  const guessed = guessMimeFromFilename(fileName);
  const finalMime = (rawBlob.type && rawBlob.type !== "application/octet-stream") ? rawBlob.type : (guessed || rawBlob.type || "application/octet-stream");
  return new Blob([rawBlob], { type: finalMime });
}
window.fetchDriveFileBlob = fetchDriveFileBlob;

async function createInternalGoogleDoc(docTitle, initialPlainText = "", targetFolderId = null) {
  if (!hasValidToken()) throw new Error("Google account not connected.");

  const metadata = {
    name: (docTitle || "Untitled Legal Draft").trim(),
    mimeType: "application/vnd.google-apps.document"
  };
  if (targetFolderId && targetFolderId !== "root") {
    metadata.parents = [targetFolderId];
  }

  const createRes = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(metadata)
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to create Google Doc.");
  }

  const docMeta = await createRes.json();

  if (initialPlainText && initialPlainText.trim()) {
    await updateInternalGoogleDocText(docMeta.id, initialPlainText);
  }
  return docMeta;
}
window.createInternalGoogleDoc = createInternalGoogleDoc;

async function renameDriveFile(fileId, newName) {
  if (!hasValidToken() || !fileId || !newName) return null;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,webViewLink`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: newName.trim() })
  });
  if (!res.ok) return null;
  return await res.json();
}
window.renameDriveFile = renameDriveFile;

async function moveDriveFileToFolder(fileId, targetFolderId) {
  if (!hasValidToken() || !fileId || !targetFolderId || targetFolderId === "root") return null;
  try {
    const getRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=parents`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!getRes.ok) return null;
    const data = await getRes.json();
    const prevParents = Array.isArray(data.parents) ? data.parents.join(",") : "";
    if (Array.isArray(data.parents) && data.parents.includes(targetFolderId)) return true;

    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${encodeURIComponent(targetFolderId)}${prevParents ? `&removeParents=${encodeURIComponent(prevParents)}` : ""}&fields=id,parents,webViewLink`;
    const patchRes = await fetch(url, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    return patchRes.ok;
  } catch (err) {
    console.warn("moveDriveFileToFolder notice:", err.message);
    return false;
  }
}
window.moveDriveFileToFolder = moveDriveFileToFolder;

async function updateInternalGoogleDocText(docId, plainText) {
  if (!hasValidToken() || !docId) throw new Error("Google account not connected.");

  let endIndex = 1;
  try {
    const getRes = await fetch(`https://docs.googleapis.com/v1/documents/${docId}?fields=body/content/endIndex`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (getRes.ok) {
      const docJson = await getRes.json();
      const content = docJson.body?.content || [];
      if (content.length > 0) {
        endIndex = content[content.length - 1].endIndex || 1;
      }
    }
  } catch (e) {}

  const requests = [];
  if (endIndex > 2) {
    requests.push({
      deleteContentRange: { range: { startIndex: 1, endIndex: endIndex - 1 } }
    });
  }
  if (plainText) {
    requests.push({
      insertText: { location: { index: 1 }, text: plainText }
    });
  }

  if (requests.length === 0) return true;

  const batchRes = await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests })
  });

  if (!batchRes.ok) {
    const err = await batchRes.json().catch(() => ({}));
    throw new Error(err.error?.message || "Google Docs API update failed.");
  }
  return true;
}
window.updateInternalGoogleDocText = updateInternalGoogleDocText;

async function loadInternalGoogleDocContent(docId) {
  if (!hasValidToken() || !docId) throw new Error("Google account not connected.");
  const res = await fetch(`https://docs.googleapis.com/v1/documents/${docId}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Unable to read Google Doc.");
  }
  const data = await res.json();
  const paragraphs = [];
  (data.body?.content || []).forEach(el => {
    if (el.paragraph?.elements) {
      const text = el.paragraph.elements.map(e => e.textRun?.content || "").join("");
      if (text) paragraphs.push(text);
    }
  });
  return { title: data.title || "Untitled Document", text: paragraphs.join("") };
}
window.loadInternalGoogleDocContent = loadInternalGoogleDocContent;

async function convertFileToGoogleDoc(fileOrDriveFileId, docTitle, targetFolderId) {
  if (!hasValidToken()) throw new Error("Google Drive access token expired.");
  showToast("Converting file to editable Google Doc...");
  const folder = (targetFolderId && targetFolderId !== "root") ? targetFolderId : null;
  const cleanTitle = (docTitle || "Document").replace(/\.[^/.]+$/, "") + " (Editable)";

  if (typeof fileOrDriveFileId === "string") {
    const copyMeta = {
      name: cleanTitle,
      mimeType: "application/vnd.google-apps.document"
    };
    if (folder) copyMeta.parents = [folder];

    const copyRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileOrDriveFileId}/copy?fields=id,name,webViewLink`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(copyMeta)
    });
    if (copyRes.ok) return await copyRes.json();

    let extractedText = "";
    try {
      const blob = await fetchDriveFileBlob(fileOrDriveFileId, docTitle);
      const tempFile = new File([blob], docTitle || "document.pdf", { type: blob.type });
      if (typeof extractTextFromFile === "function") {
        extractedText = await extractTextFromFile(tempFile);
      }
    } catch (e) {}
    return await createInternalGoogleDoc(cleanTitle, extractedText, folder);
  }

  let localText = "";
  if (fileOrDriveFileId instanceof File && typeof extractTextFromFile === "function") {
    try { localText = await extractTextFromFile(fileOrDriveFileId); } catch (e) {}
  }
  return await createInternalGoogleDoc(cleanTitle, localText, folder);
}
window.convertFileToGoogleDoc = convertFileToGoogleDoc;

async function updateDriveFileContent(driveFileId, newBlob, newName = null) {
  if (!hasValidToken() || !driveFileId) throw new Error("Google Drive access token expired.");
  const url = `https://www.googleapis.com/upload/drive/v3/files/${driveFileId}?uploadType=media&fields=id,name,size,webViewLink`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": newBlob.type || "application/pdf"
    },
    body: newBlob
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to update PDF content in Drive.");
  }

  const updatedMeta = await res.json();
  if (newName && newName !== updatedMeta.name) {
    await renameDriveFile(driveFileId, newName).catch(() => {});
    updatedMeta.name = newName;
  }
  return updatedMeta;
}
window.updateDriveFileContent = updateDriveFileContent;

async function exportGoogleDocToPdf(docId, pdfName, targetFolderId, existingDrivePdfId = null) {
  if (!hasValidToken()) throw new Error("Google Drive access token expired.");
  showToast("Compiling revisions directly into PDF...");

  const exportRes = await fetch(`https://www.googleapis.com/drive/v3/files/${docId}/export?mimeType=application/pdf`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!exportRes.ok) throw new Error("Failed to export Google Doc to PDF layout.");

  const pdfBlob = await exportRes.blob();

  // If a PDF already exists on this case, REPLACE ITS CONTENT directly in Google Drive!
  if (existingDrivePdfId) {
    try {
      const updatedMeta = await updateDriveFileContent(existingDrivePdfId, pdfBlob, pdfName);
      return {
        ...updatedMeta,
        name: pdfName,
        size: (pdfBlob.size / 1024).toFixed(1) + " KB",
        date: new Date().toLocaleDateString(),
        id: existingDrivePdfId
      };
    } catch (err) {
      console.warn("Direct PDF replacement failed, uploading fresh copy:", err.message);
    }
  }

  const pdfFile = new File([pdfBlob], pdfName, { type: "application/pdf" });
  pdfFile._isConvertedPdf = true;

  const uploadedMeta = await uploadSingleFileToDrive(pdfFile, targetFolderId);
  return {
    ...uploadedMeta,
    name: pdfName,
    size: (pdfBlob.size / 1024).toFixed(1) + " KB",
    date: new Date().toLocaleDateString()
  };
}
window.exportGoogleDocToPdf = exportGoogleDocToPdf;

// ── Word (.docx / .doc) to PDF Upload ──────────────────────────
async function convertWordToPdfAndUpload(file, folderId) {
  if (!hasValidToken()) throw new Error("Drive connection expired.");
  showToast("Converting Word document to PDF...");
  const targetFolder = (folderId && folderId !== "root") ? folderId : null;

  const metadata = { name: `temp_convert_${Date.now()}`, mimeType: "application/vnd.google-apps.document" };
  if (targetFolder) metadata.parents = [targetFolder];

  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  const arrayBuffer = await file.arrayBuffer();
  const encoder = new TextEncoder();
  const buildBody = (meta) => {
    const metaPart = delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + delimiter + 'Content-Type: ' + (file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') + '\r\n\r\n';
    const mBuf = encoder.encode(metaPart);
    const cBuf = encoder.encode(close_delim);
    const out = new Uint8Array(mBuf.byteLength + arrayBuffer.byteLength + cBuf.byteLength);
    out.set(mBuf, 0); out.set(new Uint8Array(arrayBuffer), mBuf.byteLength); out.set(cBuf, mBuf.byteLength + arrayBuffer.byteLength);
    return out;
  };

  let res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body: buildBody(metadata)
  });

  if (!res.ok && targetFolder) {
    delete metadata.parents;
    res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
      body: buildBody(metadata)
    });
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to upload document for conversion.");
  }

  const { id: tempDocId } = await res.json();
  const exportRes = await fetch(`https://www.googleapis.com/drive/v3/files/${tempDocId}/export?mimeType=application/pdf`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!exportRes.ok) {
    await deleteDriveFile(tempDocId).catch(() => {});
    throw new Error("Failed to export PDF layout.");
  }

  const pdfBlob = await exportRes.blob();
  const pdfFileName = file.name.replace(/\.[^/.]+$/, "") + ".pdf";
  const pdfFile = new File([pdfBlob], pdfFileName, { type: "application/pdf" });
  pdfFile._isConvertedPdf = true;

  const finalPdfMeta = await uploadSingleFileToDrive(pdfFile, targetFolder);
  await deleteDriveFile(tempDocId).catch(() => {});
  showToast(`Converted & saved: ${pdfFileName} ✅`);
  return finalPdfMeta;
}

async function uploadSingleFileToDrive(file, folderId) {
  if (!hasValidToken()) {
    try { await promptDriveAuth(false); }
    catch (silentErr) { throw new Error("Missing or expired Google Drive access token."); }
  }

  const ext = file.name.split('.').pop().toLowerCase();
  if ((ext === 'docx' || ext === 'doc') && !file._isConvertedPdf) {
    try { return await convertWordToPdfAndUpload(file, folderId); }
    catch (err) { showToast("Conversion skipped — saving original Word file.", "error"); }
  }

  const metadata = { name: file.name, mimeType: file.type || "application/octet-stream" };
  if (folderId && folderId !== "root") metadata.parents = [folderId];

  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";
  const arrayBuffer = await file.arrayBuffer();
  const encoder = new TextEncoder();

  const buildBody = (meta) => {
    const metaPart = delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + delimiter + 'Content-Type: ' + (file.type || 'application/octet-stream') + '\r\n\r\n';
    const mBuf = encoder.encode(metaPart);
    const cBuf = encoder.encode(close_delim);
    const out = new Uint8Array(mBuf.byteLength + arrayBuffer.byteLength + cBuf.byteLength);
    out.set(mBuf, 0); out.set(new Uint8Array(arrayBuffer), mBuf.byteLength); out.set(cBuf, mBuf.byteLength + arrayBuffer.byteLength);
    return out;
  };

  let res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body: buildBody(metadata)
  });

  if (!res.ok && metadata.parents) {
    delete metadata.parents;
    res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
      body: buildBody(metadata)
    });
  }

  if (res.ok) return await res.json();
  const err = await res.json().catch(() => ({}));
  showToast(res.status === 401 ? "Drive session expired. Auto-refreshing..." : `Upload warning: ${err.error?.message || "Saved locally"}`, "error");
  return null;
}

async function addDocToCase() {
  const fileTypeEl = document.querySelector('input[name="cd-file-type"]:checked');
  const fileType = fileTypeEl ? fileTypeEl.value : "Inbound";
  const inp = document.createElement("input");
  inp.type = "file"; inp.multiple = true;
  inp.onchange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    if (!hasValidToken()) {
      try { await promptDriveAuth(true); }
      catch (authErr) { showToast("Could not connect — saving locally only.", "error"); }
    }
    const u = window._currentUser || window._auth?.currentUser;
    const myProf = profiles.find(p => p.ownerUid === u?.uid || (p.email && p.email.toLowerCase() === u?.email?.toLowerCase())) || selProfile;
    let profileFolderId = myProf?.driveFolderId || selProfile?.driveFolderId || null;
    if (!profileFolderId && myProf && hasValidToken()) profileFolderId = await setupProfileDriveFolder(myProf);

    let targetFolderId = null;
    if (hasValidToken()) {
      targetFolderId = await getOrCreateCaseFolderHierarchy(selCase?.category || "Other", selCase?.type || "Other", selCase?.title || "Untitled", fileType, profileFolderId || "root");
    }

    const newDocs = [];
    for (const f of files) {
      let driveFileId = null, driveLink = null;
      if (hasValidToken()) {
        const result = await uploadSingleFileToDrive(f, targetFolderId);
        if (result) { driveFileId = result.id; driveLink = result.webViewLink; }
      }
      const isWord = f.name.endsWith(".docx") || f.name.endsWith(".doc");
      newDocs.push({
        name: (isWord && driveFileId) ? f.name.replace(/\.[^/.]+$/, "") + ".pdf" : f.name,
        size: (f.size / 1024).toFixed(1) + " KB",
        date: new Date().toLocaleDateString(),
        fileType, version: "v1.0", history: [],
        lastEditedBy: myProf?.name || "Counsel",
        ...(driveFileId && { driveFileId, driveLink })
      });
    }

    const updDocs = [...(selCase.documents || []), ...newDocs];
    await dbUpdateCase(selCase.id, { documents: updDocs });
    selCase = { ...selCase, documents: updDocs };
    renderCaseDetail();
    showToast(`${newDocs.filter(d => d.driveFileId).length || newDocs.length} file(s) saved ✅`);
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
          <span onclick="openFilePreview(pendingDocs[${i}])" style="cursor:pointer;color:var(--gold);text-decoration:underline">📎 ${doc.name}</span>
        </div>
        <div style="font-size:11px;color:var(--text-dim);margin-top:2px">
          ${doc.size} · ${doc.date}${doc.driveFileId ? ' · ✅ Drive' : ' · 📋 Local'}
        </div>
      </div>
      <button style="background:transparent;border:none;color:var(--red);font-size:18px;cursor:pointer;padding:2px 8px" onclick="removePendingDoc(${i})">×</button>
    </div>`).join("");
}

function removePendingDoc(i) {
  const doc = pendingDocs[i];
  if (doc && doc._localTempId) delete pendingLocalFiles[doc._localTempId];
  pendingDocs.splice(i, 1);
  renderPendingDocs();
  const statusEl = document.getElementById("drive-status");
  if (statusEl) statusEl.textContent = pendingDocs.length ? `${pendingDocs.length} file(s) attached` : "";
}

function updateDriveFolderChip() {
  const chip = document.getElementById("drive-folder-chip");
  if (!chip) return;
  if (selProfile?.driveFolderId) {
    chip.className = hasValidToken() ? "drive-status-chip connected" : "drive-status-chip disconnected";
    chip.textContent = hasValidToken() ? "● Drive Folder Linked" : "⚠ Drive Expired — Click to Reconnect";
    chip.style.display = "inline-flex";
  } else chip.style.display = "none";
}

const pendingLocalFiles = {};
function triggerLocalAttach() { document.getElementById("local-file-input").click(); }

async function handleLocalAttach(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  const fileType = document.querySelector('input[name="cf-file-type"]:checked')?.value || "Inbound";
  for (const file of files) {
    const tempId = "local_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    pendingLocalFiles[tempId] = file;
    pendingDocs.push({ name: file.name, size: (file.size / 1024).toFixed(1) + " KB", date: new Date().toLocaleDateString(), fileType, version: "v1.0", history: [], _localTempId: tempId });
    renderPendingDocs();
  }
  const statusEl = document.getElementById("drive-status");
  if (statusEl) statusEl.textContent = `${pendingDocs.length} file(s) attached`;
  e.target.value = "";
}

const caseFolderCache = {};
async function getOrCreateCaseFolderHierarchy(caseCategory, caseType, caseTitle, fileType, profileFolderId) {
  const rootId = (profileFolderId && profileFolderId !== "root") ? profileFolderId : "root";
  const cacheKey = `${rootId}::${caseCategory}::${caseType}::${caseTitle}::${fileType}`.toLowerCase();
  if (caseFolderCache[cacheKey]) return caseFolderCache[cacheKey];

  try {
    const catId = await getOrCreateFolderInParent(caseCategory, rootId);
    const typeId = await getOrCreateFolderInParent(caseType, catId);
    const titleId = await getOrCreateFolderInParent(caseTitle, typeId);
    const ftId = await getOrCreateFolderInParent(fileType, titleId);
    if (ftId) { caseFolderCache[cacheKey] = ftId; return ftId; }
  } catch (err) {}
  return rootId !== "root" ? rootId : null;
}

async function getOrCreateFolderInParent(folderName, parentFolderId) {
  const pid = (parentFolderId && parentFolderId !== "root") ? parentFolderId : "root";
  try {
    const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${folderName.replace(/'/g, "\\'")}' and '${pid}' in parents and trashed=false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.ok) {
      const data = await res.json();
      if (data.files?.length > 0) return data.files[0].id;
    }
    return await createDriveFolder(folderName, pid);
  } catch (err) {
    try { return await createDriveFolder(folderName, null); } catch (e) { return null; }
  }
}

async function syncPendingFilesToDrive(caseCategory, caseType, caseTitle, profileFolderId) {
  const localDocs = pendingDocs.filter(d => d._localTempId);
  if (!localDocs.length || !hasValidToken()) return pendingDocs;
  const u = window._currentUser || window._auth?.currentUser;
  const myProf = profiles.find(p => p.ownerUid === u?.uid || (p.email && p.email.toLowerCase() === u?.email?.toLowerCase())) || selProfile;
  let activeProfileFolderId = profileFolderId || myProf?.driveFolderId;
  if (!activeProfileFolderId && myProf && hasValidToken()) activeProfileFolderId = await setupProfileDriveFolder(myProf);
  const rootFolder = activeProfileFolderId || "root";

  for (const doc of localDocs) {
    const file = pendingLocalFiles[doc._localTempId];
    if (!file) continue;
    const targetFolderId = await getOrCreateCaseFolderHierarchy(caseCategory, caseType, caseTitle, doc.fileType || "Inbound", rootFolder);
    const result = await uploadSingleFileToDrive(file, targetFolderId);
    if (result) {
      doc.driveFileId = result.id; doc.driveLink = result.webViewLink;
      const ext = file.name.split('.').pop().toLowerCase();
      if (ext === 'docx' || ext === 'doc') doc.name = file.name.replace(/\.[^/.]+$/, "") + ".pdf";
      delete pendingLocalFiles[doc._localTempId]; delete doc._localTempId;
    }
  }
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
  const metadata = { name: `profile-photo-${profileName.replace(/\s+/g, "-")}.${ext}`, mimeType: mime };
  if (folderId && folderId !== "root") metadata.parents = [folderId];

  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";
  const arrayBuffer = await blob.arrayBuffer();
  const encoder = new TextEncoder();

  const buildBody = (meta) => {
    const metaPart = delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + delimiter + 'Content-Type: ' + mime + '\r\n\r\n';
    const mBuf = encoder.encode(metaPart);
    const cBuf = encoder.encode(close_delim);
    const out = new Uint8Array(mBuf.byteLength + arrayBuffer.byteLength + cBuf.byteLength);
    out.set(mBuf, 0); out.set(new Uint8Array(arrayBuffer), mBuf.byteLength); out.set(cBuf, mBuf.byteLength + arrayBuffer.byteLength);
    return out;
  };

  let res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body: buildBody(metadata)
  });
  if (!res.ok && metadata.parents) {
    delete metadata.parents;
    res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
      method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body: buildBody(metadata)
    });
  }
  if (!res.ok) throw new Error("Photo upload failed");
  const { id: fileId } = await res.json();

  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" })
  });
  return { fileId, thumbnailUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w200` };
}

async function deleteDriveFile(driveFileId) {
  if (!driveFileId || !hasValidToken()) return;
  try { await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }); } catch (err) {}
}

async function createOrUpdateCalendarEvent(caseData) {
  if (!hasValidToken() || !caseData.dueDate) return null;
  const startDateTime = new Date(caseData.dueDate + "T00:00:00");
  startDateTime.setDate(startDateTime.getDate() + 1);
  const eventBody = {
    summary: `⚖️ Simando Law: ${caseData.title}`,
    description: `Case Number: ${caseData.caseNumber || "N/A"}\nCategory: ${caseData.category || "N/A"}\nVenue: ${caseData.venue || "N/A"}\nParties: ${caseData.parties || "N/A"}\n\n${caseData.narrative || ""}`,
    start: { date: caseData.dueDate },
    end: { date: startDateTime.toISOString().split("T")[0] },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 1440 }, { method: 'popup', minutes: 10080 }] }
  };
  try {
    let url = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
    let method = "POST";
    if (caseData.calendarEventId) { url += `/${caseData.calendarEventId}`; method = "PUT"; }
    const res = await fetch(url, { method, headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(eventBody) });
    if (res.ok) return (await res.json()).id;
  } catch (err) {}
  return null;
}

async function deleteCalendarEvent(eventId) {
  if (!eventId || !hasValidToken()) return;
  try { await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }); } catch (err) {}
}

window.onGoogleLibraryLoad = function() { initGoogleDrive(); };
window.addEventListener("load", () => {
  if (typeof google !== "undefined" && google.accounts?.oauth2) initGoogleDrive();
  else setTimeout(initGoogleDrive, 600);
});
