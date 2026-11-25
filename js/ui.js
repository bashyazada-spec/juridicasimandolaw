// ═══════════════════════════════════════════════════════════════
//  SIMANDO LAW — UI CONTROLLER (PART 1 OF 2)
// ═══════════════════════════════════════════════════════════════

// ── THEME, ACCESSIBILITY & NOTIFICATION SOUND PREFERENCES ────
function initTheme() {
  const saved = localStorage.getItem('simando-theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
    if (typeof updateThemeIcon === "function") updateThemeIcon(saved);
  }
  initAccessibilityAndSounds();
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('simando-theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  document.querySelectorAll('.theme-switch').forEach(sw => {
    sw.setAttribute('data-theme-active', theme);
    if (theme === 'light') sw.classList.add('is-light');
    else sw.classList.remove('is-light');
  });
}

function initAccessibilityAndSounds() {
  try {
    const scale = localStorage.getItem("simando_font_scale") || "default";
    const hc = localStorage.getItem("simando_high_contrast") === "true";
    const rm = localStorage.getItem("simando_reduce_motion") === "true";
    document.documentElement.setAttribute("data-font-scale", scale);
    document.documentElement.setAttribute("data-high-contrast", String(hc));
    document.documentElement.setAttribute("data-reduce-motion", String(rm));

    const scaleSel = document.getElementById("acc-font-scale");
    const hcCb = document.getElementById("acc-high-contrast");
    const rmCb = document.getElementById("acc-reduce-motion");
    if (scaleSel) scaleSel.value = scale;
    if (hcCb) hcCb.checked = hc;
    if (rmCb) rmCb.checked = rm;

    const notifSoundCb = document.getElementById("sound-notif-toggle");
    const chatSoundCb = document.getElementById("sound-chat-toggle");
    if (notifSoundCb) notifSoundCb.checked = localStorage.getItem("simando_sound_notif") !== "false";
    if (chatSoundCb) chatSoundCb.checked = localStorage.getItem("simando_sound_chat") !== "false";
  } catch (e) {}
}

window.setAccessibilityPref = function(key, val) {
  try {
    if (key === "fontScale") {
      localStorage.setItem("simando_font_scale", val);
      document.documentElement.setAttribute("data-font-scale", val);
      showToast(`Text scale: ${val}`);
    } else if (key === "highContrast") {
      localStorage.setItem("simando_high_contrast", String(!!val));
      document.documentElement.setAttribute("data-high-contrast", String(!!val));
    } else if (key === "reduceMotion") {
      localStorage.setItem("simando_reduce_motion", String(!!val));
      document.documentElement.setAttribute("data-reduce-motion", String(!!val));
    }
  } catch (e) {}
};

window.setSoundPref = function(kind, enabled) {
  try {
    localStorage.setItem(kind === "chat" ? "simando_sound_chat" : "simando_sound_notif", String(!!enabled));
    showToast(`${kind === "chat" ? "Chat" : "Alert"} sound ${enabled ? "enabled" : "muted"}`);
  } catch (e) {}
};

window.toggleSettingsAccordion = function(btn) {
  const acc = btn?.closest(".settings-accordion");
  if (acc) acc.classList.toggle("is-open");
};

window.initTheme = initTheme;
window.toggleTheme = toggleTheme;
window.updateThemeIcon = updateThemeIcon;

// ── TOP BAR POPOVERS: GOOGLE & ONLINE USERS ──────────────────
window.closeAllTopPopovers = function() {
  ["google-popover", "online-popover", "notif-dropdown"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });
};

window.toggleTopPopover = function(id, e) {
  if (e) e.stopPropagation();
  const el = document.getElementById(id);
  if (!el) return;
  const willOpen = el.classList.contains("hidden");
  window.closeAllTopPopovers();
  if (willOpen) {
    el.classList.remove("hidden");
    if (id === "google-popover") renderGoogleStatusPopover();
    if (id === "online-popover") renderOnlineUsersPopover();
  }
};

function renderGoogleStatusPopover() {
  const connected = typeof hasValidToken === "function" && hasValidToken();
  const dot = document.getElementById("google-status-dot");
  const badgeEl = document.getElementById("google-popover-badge");
  const driveSub = document.getElementById("gpop-drive-sub");
  const driveState = document.getElementById("gpop-drive-state");
  const docsState = document.getElementById("gpop-docs-state");
  const calState = document.getElementById("gpop-cal-state");
  const btn = document.getElementById("gpop-connect-btn");

  if (dot) dot.className = `plain-dot ${connected ? "green" : "amber"}`;
  if (badgeEl) {
    badgeEl.className = `badge ${connected ? "badge-pass" : "badge-warn"}`;
    badgeEl.textContent = connected ? "Connected" : "Action Needed";
  }
  if (driveSub) driveSub.textContent = connected ? "Scope: drive.file active" : "Not connected";
  if (driveState) { driveState.textContent = connected ? "Active" : "Pending"; driveState.style.color = connected ? "var(--green)" : "var(--amber)"; }
  if (docsState)  { docsState.textContent  = connected ? "Ready"  : "Standby"; docsState.style.color  = connected ? "var(--green)" : "var(--amber)"; }
  if (calState)   { calState.textContent   = connected ? "Synced" : "Standby"; calState.style.color   = connected ? "var(--green)" : "var(--amber)"; }
  if (btn) btn.innerHTML = connected ? `<i class="bi bi-arrow-clockwise"></i> Re-sync` : `<i class="bi bi-google"></i> Connect`;
}
window.renderGoogleStatusPopover = renderGoogleStatusPopover;

window.connectOrOpenGoogleAction = async function() {
  try {
    showToast("Connecting Google Workspace...");
    await promptDriveAuth(true);
    renderGoogleStatusPopover();
    if (typeof updateWorkspaceStatus === "function") updateWorkspaceStatus(false);
    showToast("Google Drive, Docs & Calendar connected!");
  } catch (err) {
    showToast("Google connection failed: " + err.message, "error");
  }
};

function renderOnlineUsersPopover() {
  const list = Array.isArray(window.onlineUsers) ? window.onlineUsers : [];
  const labelEl = document.getElementById("online-count-label");
  const countEl = document.getElementById("online-popover-count");
  const listEl = document.getElementById("online-users-list");

  if (labelEl) labelEl.textContent = `Online (${list.length})`;
  if (countEl) countEl.textContent = `${list.length} active`;
  if (!listEl) return;

  if (list.length === 0) {
    listEl.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text-dim);font-size:12px">No active users detected.</div>`;
    return;
  }

  listEl.innerHTML = list.map(u => `
    <div class="setting-row-item" style="margin:0;padding:8px 10px">
      <div style="display:flex;align-items:center;gap:9px;min-width:0">
        ${avatarDiv(u.name, u.avatarColor, 28, u.photoUrl)}
        <div style="min-width:0">
          <div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(u.name)} ${u.isMe ? '<span style="font-size:9px;color:var(--gold)">(You)</span>' : ''}</div>
          <div style="font-size:10.5px;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(u.role === 'superdev' ? 'Developer Admin' : (u.role || 'Attorney'))}</div>
        </div>
      </div>
      <span class="plain-dot green" title="Online"></span>
    </div>
  `).join("");
}
window.renderOnlineUsersPopover = renderOnlineUsersPopover;

// ═══════════════════════════════════════════════════════════════
//  INTERNAL PERSISTENT MOVABLE CASE RESEARCH WIDGET
// ═══════════════════════════════════════════════════════════════
let activeResearchTab = "similar";
let currentResearchWebUrl = "https://lawphil.net/";
window.activeResearchTab = activeResearchTab;

window.toggleResearchWidget = function(e) {
  if (e) e.stopPropagation();
  const w = document.getElementById("research-widget");
  if (!w) return;
  const isHidden = w.classList.contains("hidden");
  if (isHidden) {
    w.classList.remove("hidden");
    renderInternalSimilarCases();
  } else {
    w.classList.add("hidden");
  }
};

window.minimizeResearchWidget = function() {
  document.getElementById("research-widget")?.classList.add("hidden");
};

window.toggleResearchExpand = function() {
  const w = document.getElementById("research-widget");
  const icon = document.getElementById("research-expand-icon");
  if (!w) return;
  const expanded = w.classList.toggle("is-expanded");
  if (icon) icon.className = expanded ? "bi bi-arrows-angle-contract" : "bi bi-arrows-angle-expand";
};

window.switchResearchTab = function(tab) {
  activeResearchTab = tab;
  window.activeResearchTab = tab;
  document.getElementById("res-tab-similar")?.classList.toggle("active", tab === "similar");
  document.getElementById("res-tab-web")?.classList.toggle("active", tab === "web");
  document.getElementById("research-view-similar")?.classList.toggle("hidden", tab !== "similar");
  document.getElementById("research-view-web")?.classList.toggle("hidden", tab !== "web");

  if (tab === "similar") {
    renderInternalSimilarCases();
  } else {
    const frame = document.getElementById("research-internal-frame");
    if (frame && (!frame.src || frame.src === "about:blank")) {
      frame.src = currentResearchWebUrl;
    }
  }
};

window.loadInternalResearchSite = function(url, chipBtn) {
  currentResearchWebUrl = url;
  document.querySelectorAll(".research-site-chip").forEach(b => b.classList.remove("active"));
  if (chipBtn) chipBtn.classList.add("active");
  setElText("research-current-url", url);
  const frame = document.getElementById("research-internal-frame");
  if (frame) frame.src = url;
};

window.popOutCurrentResearchUrl = function() {
  const w = Math.min(1080, Math.max(820, Math.round(window.screen.availWidth * 0.72)));
  const h = Math.min(780, Math.max(600, Math.round(window.screen.availHeight * 0.80)));
  window.open(currentResearchWebUrl, "SimandoLegalResearchPopout", `popup=yes,width=${w},height=${h},resizable=yes,scrollbars=yes`);
};

function renderInternalSimilarCases() {
  const listEl = document.getElementById("research-similar-list");
  if (!listEl) return;

  const q = (document.getElementById("research-query-inp")?.value || "").toLowerCase().trim();
  const pool = typeof getAccessibleCases === "function" ? getAccessibleCases() : (cases || []);

  const matches = !q
    ? pool.slice(0, 12)
    : pool.filter(c =>
        (c.title || "").toLowerCase().includes(q) ||
        (c.category || "").toLowerCase().includes(q) ||
        (c.type || "").toLowerCase().includes(q) ||
        (c.parties || "").toLowerCase().includes(q) ||
        (c.venue || "").toLowerCase().includes(q) ||
        (c.narrative || "").toLowerCase().includes(q)
      );

  if (matches.length === 0) {
    listEl.innerHTML = `
      <div style="text-align:center;padding:24px 12px;color:var(--text-dim);font-size:12.5px">
        No firm cases match "<strong>${escHtml(q)}</strong>".<br/>
        <button type="button" class="btn btn-secondary btn-sm" style="margin-top:10px" onclick="switchResearchTab('web')">
          <i class="bi bi-globe2"></i> Search in Web Reader
        </button>
      </div>`;
    return;
  }

  listEl.innerHTML = matches.map(c => {
    const p = profiles.find(x => x.id === c.profileId);
    return `
      <div style="padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;cursor:pointer" onclick="openCaseKeepResearch('${c.id}')">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:3px">
          <span style="font-size:10.5px;font-weight:700;color:var(--gold)">${escHtml(c.category || "Case")}</span>
          ${badge(c.status || "On-going", statusColor(c.status))}
        </div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${escHtml(c.title)}</div>
        <div style="font-size:11.5px;color:var(--text-muted);margin-top:2px">${escHtml(c.type || "Litigation")} · ${escHtml(p?.name || "Counsel")}</div>
        ${c.narrative ? `<div style="font-size:11px;color:var(--text-dim);margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escHtml(c.narrative)}</div>` : ""}
      </div>`;
  }).join("");
}
window.renderInternalSimilarCases = renderInternalSimilarCases;

window.openCaseKeepResearch = function(caseId) {
  const widget = document.getElementById("research-widget");
  const wasOpen = widget && !widget.classList.contains("hidden");
  if (typeof openCase === "function") openCase(caseId);
  if (wasOpen && widget) widget.classList.remove("hidden");
};

window.searchSimilarCases = function() {
  const q = (document.getElementById("research-query-inp")?.value || "").trim();
  if (activeResearchTab === "similar") {
    renderInternalSimilarCases();
    return;
  }
  const url = q ? ("https://www.chanrobles.com/search.html?q=" + encodeURIComponent(q)) : currentResearchWebUrl;
  loadInternalResearchSite(url, null);
};

function initResearchWidgetDrag() {
  const widget = document.getElementById("research-widget");
  const handle = document.getElementById("research-drag-handle");
  if (!widget || !handle || handle._dragBound) return;
  handle._dragBound = true;

  let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;

  handle.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    dragging = true;
    const rect = widget.getBoundingClientRect();
    widget.style.left = rect.left + "px";
    widget.style.top  = rect.top + "px";
    widget.style.right = "auto";
    widget.style.bottom = "auto";
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left;
    startTop  = rect.top;
    handle.setPointerCapture(e.pointerId);
  });

  handle.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const maxLeft = Math.max(0, window.innerWidth - 140);
    const maxTop  = Math.max(0, window.innerHeight - 60);
    widget.style.left = Math.min(maxLeft, Math.max(0, startLeft + dx)) + "px";
    widget.style.top  = Math.min(maxTop, Math.max(0, startTop + dy)) + "px";
  });

  const stopDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  handle.addEventListener("pointerup", stopDrag);
  handle.addEventListener("pointercancel", stopDrag);
}

// ── INTERNAL GOOGLE DOCS WORKSPACE CONTROLLER ────────────────
let activeInternalDocId = null;

window.openGoogleDocModal = function(caseId = "", existingDocId = null) {
  const modal = document.getElementById("gdoc-modal");
  if (!modal) return;
  activeInternalDocId = existingDocId || null;

  const caseSel = document.getElementById("gdoc-case-select");
  if (caseSel) {
    const accessible = typeof getAccessibleCases === "function" ? getAccessibleCases() : (cases || []);
    caseSel.innerHTML = `<option value="">— Standalone Firm Draft —</option>` +
      accessible.map(c => `<option value="${c.id}" ${c.id === caseId ? "selected" : ""}>${escHtml(c.title)}</option>`).join("");
  }

  const titleInp = document.getElementById("gdoc-title-input");
  const iframeBtn = document.getElementById("gdoc-open-iframe-btn");
  const iframeWrap = document.getElementById("gdoc-iframe-wrap");
  const canvasEl = document.getElementById("gdoc-canvas");

  if (iframeWrap) iframeWrap.classList.add("hidden");
  if (canvasEl) canvasEl.classList.remove("hidden");
  if (iframeBtn) iframeBtn.style.display = activeInternalDocId ? "inline-flex" : "none";

  const connected = typeof hasValidToken === "function" && hasValidToken();
  const badgeEl = document.getElementById("gdoc-api-status-badge");
  if (badgeEl) {
    badgeEl.className = `badge ${connected ? "badge-pass" : "badge-warn"}`;
    badgeEl.innerHTML = connected ? `<i class="bi bi-cloud-check"></i> Google Docs API Ready` : `<i class="bi bi-exclamation-triangle"></i> Connect Google First`;
  }

  if (activeInternalDocId && connected && typeof loadInternalGoogleDocContent === "function") {
    loadInternalGoogleDocContent(activeInternalDocId).then(docData => {
      if (titleInp) titleInp.value = docData.title;
      if (canvasEl) canvasEl.innerText = docData.text;
    }).catch(() => {});
  } else if (titleInp && !existingDocId) {
    const targetCase = caseId ? (cases || []).find(c => c.id === caseId) : null;
    titleInp.value = targetCase ? `${targetCase.title} — Draft Pleading` : "Legal Memorandum Draft";
  }

  modal.classList.remove("hidden");
};

window.closeGoogleDocModal = function() {
  document.getElementById("gdoc-modal")?.classList.add("hidden");
};

window.execInternalDocFmt = function(cmd) {
  document.execCommand(cmd, false, null);
  document.getElementById("gdoc-canvas")?.focus();
};

window.insertInternalDocTemplate = function(type) {
  const c = document.getElementById("gdoc-canvas");
  if (!c) return;
  if (type === "caption") {
    c.innerHTML += `<p style="margin-top:12px"><strong>REPUBLIC OF THE PHILIPPINES</strong><br/>REGIONAL TRIAL COURT — BRANCH ___<br/>Case No. ____________</p>`;
  } else if (type === "prayer") {
    c.innerHTML += `<p style="margin-top:12px"><strong>WHEREFORE</strong>, premises considered, it is most respectfully prayed of this Honorable Court that this pleading be GRANTED. Other reliefs just and equitable are likewise prayed for.</p>`;
  } else if (type === "jurat") {
    c.innerHTML += `<p style="margin-top:12px"><strong>SUBSCRIBED AND SWORN</strong> to before me this ___ day of __________, 2026 in Naga City, Philippines, affiant exhibiting competent proof of identity.</p>`;
  }
  showToast("Inserted legal template block");
};

window.toggleInternalDocLiveFrame = function() {
  if (!activeInternalDocId) return;
  const wrap = document.getElementById("gdoc-iframe-wrap");
  const canvas = document.getElementById("gdoc-canvas");
  const frame = document.getElementById("gdoc-live-iframe");
  if (!wrap || !canvas || !frame) return;

  const showingFrame = !wrap.classList.contains("hidden");
  if (showingFrame) {
    wrap.classList.add("hidden");
    canvas.classList.remove("hidden");
  } else {
    frame.src = `https://docs.google.com/document/d/${activeInternalDocId}/edit?embedded=true`;
    canvas.classList.add("hidden");
    wrap.classList.remove("hidden");
  }
};

window.saveInternalGoogleDoc = async function(exportPdf = false) {
  if (typeof hasValidToken !== "function" || !hasValidToken()) {
    try { await promptDriveAuth(true); }
    catch (e) { showToast("Connect Google Account first.", "error"); return; }
  }

  const title = (document.getElementById("gdoc-title-input")?.value || "").trim() || "Untitled Legal Draft";
  const caseId = document.getElementById("gdoc-case-select")?.value || "";
  const plainText = (document.getElementById("gdoc-canvas")?.innerText || "").trim();

  const u = window._currentUser || window._auth?.currentUser;
  const myProf = u ? profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === (u.email || "").toLowerCase())) : null;
  let folderId = myProf?.driveFolderId || null;

  const targetCase = caseId ? cases.find(c => c.id === caseId) : null;
  if (targetCase && typeof getOrCreateCaseFolderHierarchy === "function") {
    folderId = await getOrCreateCaseFolderHierarchy(targetCase.category || "Other", targetCase.type || "Other", targetCase.title || "Untitled", "Outbound", folderId || "root");
  }

  const saveBtn = document.getElementById("gdoc-save-btn");
  const pdfBtn = document.getElementById("gdoc-pdf-btn");
  if (saveBtn) saveBtn.disabled = true;
  if (pdfBtn) pdfBtn.disabled = true;

  try {
    showToast(exportPdf ? "Compiling Google Doc & exporting PDF..." : "Saving to Google Docs...");
    let docMeta = null;

    if (activeInternalDocId) {
      await updateInternalGoogleDocText(activeInternalDocId, plainText);
      docMeta = { id: activeInternalDocId, name: title, webViewLink: `https://docs.google.com/document/d/${activeInternalDocId}/edit` };
    } else {
      docMeta = await createInternalGoogleDoc(title, plainText, folderId);
      activeInternalDocId = docMeta.id;
    }

    const iframeBtn = document.getElementById("gdoc-open-iframe-btn");
    if (iframeBtn) iframeBtn.style.display = "inline-flex";

    let attachedEntry = {
      name: `${title} (Google Doc)`,
      size: "Google Doc",
      date: new Date().toLocaleDateString(),
      fileType: "Outbound",
      version: "v1.0",
      driveFileId: docMeta.id,
      driveLink: docMeta.webViewLink || `https://docs.google.com/document/d/${docMeta.id}/edit`
    };

    if (exportPdf && typeof exportGoogleDocToPdf === "function") {
      const pdfName = title.replace(/\.pdf$/i, "") + ".pdf";
      const pdfMeta = await exportGoogleDocToPdf(docMeta.id, pdfName, folderId);
      attachedEntry = {
        name: pdfName,
        size: pdfMeta.size || "PDF",
        date: new Date().toLocaleDateString(),
        fileType: "Outbound",
        version: "v1.0",
        driveFileId: pdfMeta.id,
        driveLink: pdfMeta.webViewLink
      };
    }

    if (targetCase) {
      const updDocs = [...(targetCase.documents || []), attachedEntry];
      await dbUpdateCase(targetCase.id, { documents: updDocs });
      targetCase.documents = updDocs;
      if (selCase && selCase.id === targetCase.id) {
        selCase = { ...targetCase };
        if (typeof renderCaseDetail === "function") renderCaseDetail();
      }
    }

    if (currentView === "mydrive" && typeof loadExplorerFiles === "function") loadExplorerFiles();
    showToast(exportPdf ? `Exported & attached "${attachedEntry.name}"!` : `Saved "${title}" to Google Docs!`);
    if (exportPdf) closeGoogleDocModal();
  } catch (err) {
    console.error("saveInternalGoogleDoc error:", err);
    showToast("Google Docs error: " + err.message, "error");
  } finally {
    if (saveBtn) saveBtn.disabled = false;
    if (pdfBtn) pdfBtn.disabled = false;
  }
};

// ── CAPSULE SIDEBAR SYNC, EDGE HANDLE & FLOATING TOOLTIPS ────
function syncSidebarHandleUI() {
  const collapsed = document.body.classList.contains("sidebar-collapsed");
  const icon = document.getElementById("sidebar-toggle-icon");
  const btn = document.getElementById("sidebar-toggle-btn");
  const label = collapsed ? "Expand Sidebar" : "Collapse Sidebar";
  if (icon) icon.className = collapsed ? "bi bi-chevron-right" : "bi bi-chevron-left";
  if (btn) {
    btn.title = label;
    btn.setAttribute("data-tooltip", label);
    btn.setAttribute("aria-expanded", String(!collapsed));
  }
  const tip = document.getElementById("capsule-tooltip");
  if (tip) tip.classList.remove("show");
}

function initSidebarEnhancements() {
  syncSidebarHandleUI();
  if (typeof MutationObserver !== "undefined" && document.body) {
    const obs = new MutationObserver(() => syncSidebarHandleUI());
    obs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }
  const sidebarEl = document.getElementById("sidebar");
  const tooltipEl = document.getElementById("capsule-tooltip");
  if (sidebarEl && tooltipEl) {
    sidebarEl.addEventListener("mouseover", (e) => {
      const target = e.target.closest("[data-tooltip]");
      if (!target) return;
      const isToggle = target.id === "sidebar-toggle-btn";
      if (!isToggle && !document.body.classList.contains("sidebar-collapsed")) return;
      const rect = target.getBoundingClientRect();
      tooltipEl.textContent = target.getAttribute("data-tooltip");
      tooltipEl.style.left = `${rect.right + 10}px`;
      tooltipEl.style.top = `${rect.top + rect.height / 2}px`;
      tooltipEl.classList.add("show");
    });
    sidebarEl.addEventListener("mouseout", (e) => {
      if (e.target.closest("[data-tooltip]")) tooltipEl.classList.remove("show");
    });
  }
}

window.dismissBanner = function(btn, key) {
  const banner = btn?.closest(".helper-banner");
  if (banner) banner.classList.add("hidden");
  try { localStorage.setItem("simando_hide_banner_" + key, "1"); } catch (_) {}
};

function restoreDismissedBanners() {
  document.querySelectorAll(".helper-banner[data-banner]").forEach(el => {
    try {
      if (localStorage.getItem("simando_hide_banner_" + el.getAttribute("data-banner")) === "1") {
        el.classList.add("hidden");
      }
    } catch (_) {}
  });
}

// Note: #research-widget stays open persistently when clicking outside—only closes via Minimize!
document.addEventListener("click", (e) => {
  if (!e.target.closest("#top-hdr-actions")) window.closeAllTopPopovers();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    window.closeAllTopPopovers();
    document.getElementById("diagnostic-modal")?.classList.add("hidden");
    document.getElementById("date-schedule-modal")?.classList.add("hidden");
    document.getElementById("gdoc-modal")?.classList.add("hidden");
    if (typeof closeAllSheets === "function") closeAllSheets();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  initSidebarEnhancements();
  restoreDismissedBanners();
  initAccessibilityAndSounds();
  initResearchWidgetDrag();
});

// ── DOM HELPERS & ERROR CLEARING ─────────────────────────────
function setElText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
function setElVal(id, val)   { const el = document.getElementById(id); if (el) el.value = val; }
window.setElText = setElText;
window.setElVal  = setElVal;

function clearCaseErrors() {
  ["cf-title-err", "cf-filed-err", "cf-parties-err", "cf-narrative-err", "cf-hearings-err"].forEach(id => document.getElementById(id)?.classList.add("hidden"));
  ["cf-case-title", "cf-filed", "cf-narrative"].forEach(id => document.getElementById(id)?.classList.remove("err"));
}
window.clearCaseErrors = clearCaseErrors;

// ── STANDALONE WEB CRYPTO TOTP ENGINE FOR 2FA ────────────────
function generateRandomBase32(length = 16) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let result = "";
  for (let i = 0; i < length; i++) result += alphabet[bytes[i] % 32];
  return result;
}
window.generateRandomBase32 = generateRandomBase32;

function generateBackupRecoveryCodes(count = 5) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
    codes.push(`${hex.slice(0, 4)}-${hex.slice(4, 8)}`);
  }
  return codes;
}
window.generateBackupRecoveryCodes = generateBackupRecoveryCodes;

function base32Decode(base32) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let cleaned = (base32 || "").toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0, value = 0, output = [];
  for (let i = 0; i < cleaned.length; i++) {
    const idx = alphabet.indexOf(cleaned.charAt(i));
    if (idx === -1) continue;
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { output.push((value >>> (bits - 8)) & 255); bits -= 8; value &= (1 << bits) - 1; }
  }
  return new Uint8Array(output);
}
window.base32Decode = base32Decode;

async function generateTOTPCode(secretBase32, timeStepOffset = 0) {
  const key = await crypto.subtle.importKey("raw", base32Decode(secretBase32), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const timeStep = Math.floor(Math.floor(Date.now() / 1000) / 30) + timeStepOffset;
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setUint32(4, timeStep, false);
  const hmacBytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, buffer));
  const offset = hmacBytes[hmacBytes.length - 1] & 0xf;
  const binary = ((hmacBytes[offset] & 0x7f) << 24) | ((hmacBytes[offset + 1] & 0xff) << 16) | ((hmacBytes[offset + 2] & 0xff) << 8) | (hmacBytes[offset + 3] & 0xff);
  return String(binary % 1000000).padStart(6, "0");
}
window.generateTOTPCode = generateTOTPCode;

async function verifyClientTOTP(token, secretBase32) {
  const cleanedToken = String(token || "").trim().replace(/\D/g, "");
  if (cleanedToken.length !== 6 || !secretBase32) return false;
  for (const offset of [0, -1, 1, -2, 2, -3, 3]) {
    try { if (cleanedToken === await generateTOTPCode(secretBase32, offset)) return true; } catch (e) {}
  }
  return false;
}
window.verifyClientTOTP = verifyClientTOTP;

// ── ONBOARDING SETUP & 2FA / DRIVE MODAL CONTROLLER ──────────
let onboardingGeneratedSecret = null;
let onboardingGeneratedBackupCodes = [];
let onboardingModalDismissedThisSession = false;
let _obCheckRetryCount = 0;

window.checkOnboardingSecurityStatus = function() {
  if (onboardingModalDismissedThisSession) return;
  const u = window._currentUser || window._auth?.currentUser;
  if (!u) {
    if (_obCheckRetryCount < 15) { _obCheckRetryCount++; setTimeout(window.checkOnboardingSecurityStatus, 400); }
    return;
  }
  const userEmail = (u.email || "").toLowerCase();
  const myProf = profiles.find(p => (p.ownerUid && p.ownerUid === u.uid) || (p.email && p.email.toLowerCase() === userEmail));
  if (!myProf) {
    if (_obCheckRetryCount < 15) { _obCheckRetryCount++; setTimeout(window.checkOnboardingSecurityStatus, 400); }
    return;
  }
  const is2FaEnabled = !!myProf.twoFactorEnabled;
  const isDriveConnected = typeof hasValidToken === "function" ? hasValidToken() : false;
  if (is2FaEnabled && isDriveConnected) { dismissOnboardingModal(); return; }

  const modal = document.getElementById("onboarding-modal");
  if (!modal) return;
  const card2Fa = document.getElementById("ob-card-2fa");
  const cardDrive = document.getElementById("ob-card-drive");
  const titleEl = document.getElementById("ob-modal-title");
  const subEl = document.getElementById("ob-modal-sub");
  const iconEl = document.getElementById("ob-modal-icon");
  const driveTitle = document.getElementById("ob-drive-title-text");

  if (is2FaEnabled && !isDriveConnected) {
    if (card2Fa) card2Fa.style.display = "none";
    if (cardDrive) cardDrive.style.display = "block";
    if (driveTitle) driveTitle.textContent = "Google Account & Drive Storage Required";
    if (titleEl) titleEl.textContent = "Google Account Required";
    if (subEl) subEl.textContent = "Your Two-Factor Authentication is active, but a connected Google Account is required for case storage and deadline sync.";
    if (iconEl) iconEl.innerHTML = `<i class="bi bi-cloud-arrow-up-fill" style="color:var(--gold)"></i>`;
    updateOnboardingDriveStatus(false);
    modal.classList.remove("hidden"); modal.style.display = "flex";
    return;
  }

  if (!is2FaEnabled) {
    if (card2Fa) card2Fa.style.display = "block";
    if (cardDrive) cardDrive.style.display = "block";
    if (driveTitle) driveTitle.textContent = "2. Google Account & Drive Storage";
    if (titleEl) titleEl.textContent = "Account Security & Setup";
    if (subEl) subEl.textContent = "Please complete the required security setup below.";
    if (iconEl) iconEl.innerHTML = `<i class="bi bi-shield-lock-fill" style="color:var(--gold)"></i>`;
    initOnboarding2FAQrCodes(myProf, u);
    updateOnboardingDriveStatus(isDriveConnected);
    modal.classList.remove("hidden"); modal.style.display = "flex";
  }
};

function initOnboarding2FAQrCodes(myProf, u) {
  if (!onboardingGeneratedSecret) {
    const saved = sessionStorage.getItem("simando_temp_2fa_secret");
    if (saved) {
      onboardingGeneratedSecret = saved;
      try { onboardingGeneratedBackupCodes = JSON.parse(sessionStorage.getItem("simando_temp_2fa_backups") || "[]"); }
      catch (e) { onboardingGeneratedBackupCodes = generateBackupRecoveryCodes(5); }
    } else {
      onboardingGeneratedSecret = generateRandomBase32(16);
      onboardingGeneratedBackupCodes = generateBackupRecoveryCodes(5);
      sessionStorage.setItem("simando_temp_2fa_secret", onboardingGeneratedSecret);
      sessionStorage.setItem("simando_temp_2fa_backups", JSON.stringify(onboardingGeneratedBackupCodes));
    }
  }

  const keyDisplay = document.getElementById("ob-pairing-secret-key");
  if (keyDisplay) {
    keyDisplay.innerHTML = `<span style="font-weight:700;color:var(--text)">KEY:</span> ${onboardingGeneratedSecret.match(/.{1,4}/g)?.join(" ") || onboardingGeneratedSecret} <button type="button" onclick="copyOnboardingSecretKey()" style="color:var(--gold);margin-left:6px;font-size:11px;font-weight:600;text-decoration:underline"><i class="bi bi-clipboard"></i> Copy</button>`;
  }

  const userEmail = myProf?.email || u?.email || "attorney@simandolaw.com";
  const otpAuthUrl = `otpauth://totp/Simando%20Law:${encodeURIComponent(userEmail)}?secret=${onboardingGeneratedSecret}&issuer=Simando%20Law`;

  const pairingContainer = document.getElementById("ob-qr-pairing-container");
  if (pairingContainer) {
    pairingContainer.innerHTML = "";
    if (typeof QRCode !== "undefined") {
      new QRCode(pairingContainer, { text: otpAuthUrl, width: 135, height: 135, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M });
      const extraCanvas = pairingContainer.querySelector("canvas");
      if (extraCanvas) extraCanvas.style.display = "none";
    }
  }

  const appLinkContainer = document.getElementById("ob-qr-applink-container");
  if (appLinkContainer) {
    appLinkContainer.innerHTML = "";
    if (typeof QRCode !== "undefined") {
      new QRCode(appLinkContainer, { text: "https://aka.ms/authapp", width: 135, height: 135, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M });
      const extraCanvas = appLinkContainer.querySelector("canvas");
      if (extraCanvas) extraCanvas.style.display = "none";
    }
  }

  const otpInp = document.getElementById("ob-otp-input");
  if (otpInp) {
    otpInp.value = "";
    const cleanInp = otpInp.cloneNode(true);
    otpInp.parentNode.replaceChild(cleanInp, otpInp);
    cleanInp.addEventListener("input", async (e) => {
      e.target.value = e.target.value.replace(/\D/g, "");
      if (e.target.value.length === 6) await window.onboardingActivate2FA(e.target.value);
    });
  }
}

window.copyOnboardingSecretKey = function() {
  if (onboardingGeneratedSecret) navigator.clipboard.writeText(onboardingGeneratedSecret).then(() => showToast("Secret key copied!"));
};

window.switchOnboardingQrType = function(type) {
  const isPairing = type === "pairing";
  document.getElementById("tab-ob-pairing-qr").className = isPairing ? "ob-qr-tab-btn active" : "ob-qr-tab-btn";
  document.getElementById("tab-ob-app-qr").className = !isPairing ? "ob-qr-tab-btn active" : "ob-qr-tab-btn";
  document.getElementById("ob-view-pairing-qr").style.display = isPairing ? "block" : "none";
  document.getElementById("ob-view-app-qr").style.display = !isPairing ? "block" : "none";
};

window.dismissOnboardingModal = function() {
  const modal = document.getElementById("onboarding-modal");
  if (modal) { modal.classList.add("hidden"); modal.style.display = "none"; }
  onboardingModalDismissedThisSession = true;
};

function updateOnboardingDriveStatus(isConnected) {
  const tag = document.getElementById("ob-tag-drive");
  const btn = document.getElementById("btn-ob-connect-drive");
  const card = document.getElementById("ob-card-drive");
  if (tag) { tag.className = isConnected ? "onboarding-status-tag active" : "onboarding-status-tag pending"; tag.innerHTML = isConnected ? `<i class="bi bi-check-circle-fill"></i> Connected` : `<i class="bi bi-clock"></i> Action Needed`; }
  if (card) card.classList.toggle("completed", isConnected);
  if (btn) { btn.className = isConnected ? "btn btn-success" : "btn btn-primary"; btn.innerHTML = isConnected ? `<i class="bi bi-check2"></i> Google Account Linked` : `<i class="bi bi-google"></i> Connect Google Account`; btn.disabled = isConnected; }
}

window.onboardingConnectDrive = async function() {
  const btn = document.getElementById("btn-ob-connect-drive");
  if (btn) { btn.disabled = true; btn.textContent = "Connecting..."; }
  try {
    await promptDriveAuth(true);
    updateOnboardingDriveStatus(true);
    renderGoogleStatusPopover();
    if (typeof updateWorkspaceStatus === "function") updateWorkspaceStatus(false);
    checkOnboardingBothComplete();
  } catch (err) {
    showToast("Google connection failed: " + err.message, "error");
    updateOnboardingDriveStatus(false);
  }
};

window.onboardingActivate2FA = async function(manualCode) {
  const code = (manualCode || document.getElementById("ob-otp-input")?.value || "").trim().replace(/\D/g, "");
  if (code.length !== 6) return showToast("Please enter all 6 digits.", "error");
  if (!onboardingGeneratedSecret) onboardingGeneratedSecret = sessionStorage.getItem("simando_temp_2fa_secret") || generateRandomBase32(16);

  if (!(await verifyClientTOTP(code, onboardingGeneratedSecret))) return showToast("Incorrect 6-digit code.", "error");
  const u = window._currentUser || window._auth?.currentUser;
  const myProf = u ? profiles.find(p => (p.ownerUid && p.ownerUid === u.uid) || (p.email && p.email.toLowerCase() === (u.email || "").toLowerCase())) : null;
  if (!myProf) return;

  const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  await setDoc(window._fbDoc(window._db, "profiles", myProf.id, "private", "security"), {
    twoFactorEnabled: true, twoFactorSecret: onboardingGeneratedSecret, twoFactorBackupCodes: onboardingGeneratedBackupCodes
  }, { merge: true }).catch(() => {});
  await dbUpdateProfile(myProf.id, { twoFactorEnabled: true });
  myProf.twoFactorEnabled = true;
  sessionStorage.setItem("simando_2fa_verified", "true");
  document.getElementById("ob-card-2fa")?.classList.add("completed");
  showToast("Two-Factor Authentication is now active! 🛡️");
  if (typeof renderSettingsView === "function") renderSettingsView();
  checkOnboardingBothComplete();
};

function checkOnboardingBothComplete() {
  const u = window._currentUser || window._auth?.currentUser;
  const myProf = u ? profiles.find(p => (p.ownerUid && p.ownerUid === u.uid) || (p.email && p.email.toLowerCase() === (u.email || "").toLowerCase())) : null;
  if (myProf?.twoFactorEnabled && hasValidToken()) setTimeout(dismissOnboardingModal, 1000);
}

// ── MULTI-DATE AVAILABILITY PICKER ───────────────────────────
let selectedBusyDates = new Set();
let modalCalYear = new Date().getFullYear();
let modalCalMonth = new Date().getMonth();

window.openBusyModal = function() {
  const u = window._currentUser || window._auth?.currentUser;
  if (!u) return showToast("Please wait for your account to load.", "error");
  const modal = document.getElementById("busy-modal");
  if (!modal) return;
  selectedBusyDates.clear();
  modalCalYear = new Date().getFullYear(); modalCalMonth = new Date().getMonth();
  renderModalCalendarUI();
  modal.classList.remove("hidden");
};
window.closeBusyModal = function() { document.getElementById("busy-modal")?.classList.add("hidden"); selectedBusyDates.clear(); };

function renderModalCalendarUI() {
  const modal = document.getElementById("busy-modal");
  if (!modal) return;
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 500px; padding: 22px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;border-bottom:1px solid var(--border);padding-bottom:10px">
        <div style="font-size:17px;font-weight:700;color:var(--gold-light);display:flex;align-items:center;gap:8px"><i class="bi bi-calendar2-range-fill"></i> Set Personal Schedule</div>
        <button onclick="window.closeBusyModal()" style="color:var(--text-dim);font-size:18px"><i class="bi bi-x-lg"></i></button>
      </div>
      <div style="display:flex;gap:6px;overflow-x:auto;margin-bottom:12px;padding-bottom:4px">
        <button type="button" class="btn btn-secondary btn-sm" onclick="setBusyPreset('⚖️ In Court / Hearing')"><i class="bi bi-bank"></i> In Court</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="setBusyPreset('🚫 Out of Office / Leave')"><i class="bi bi-slash-circle"></i> Out of Office</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="setBusyPreset('🤝 Client Meeting')"><i class="bi bi-people"></i> Consultation</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px">
        <div><label class="field-label">Schedule Label *</label><input class="field-input" id="busy-title" value="In Court / Out of Office"/></div>
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="font-size:13.5px;font-weight:700;color:var(--gold)" id="modal-cal-month-title">Month Year</div>
            <div style="display:flex;gap:4px">
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.prevModalCalMonth()"><i class="bi bi-chevron-left"></i></button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.todayModalCalMonth()">Today</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.nextModalCalMonth()"><i class="bi bi-chevron-right"></i></button>
            </div>
          </div>
          <div class="cal-grid" id="modal-calendar-grid" style="display:grid !important;grid-template-columns:repeat(7, minmax(0, 1fr)) !important;gap:4px"></div>
          <div id="modal-busy-chips-wrap" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;padding-top:8px;border-top:1px dashed var(--border)"></div>
        </div>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="checkbox" id="busy-all-day" checked onchange="window.toggleBusyTimeInputs(this.checked)" style="accent-color:var(--gold)"/> All Day Block</label>
        <div class="grid2" id="busy-time-container" style="display:none">
          <div><label class="field-label">Start</label><input type="time" class="field-input" id="busy-start-time" value="08:30"/></div>
          <div><label class="field-label">End</label><input type="time" class="field-input" id="busy-end-time" value="17:00"/></div>
        </div>
        <div><label class="field-label">Description / Venue</label><input class="field-input" id="busy-notes" placeholder="Enter venue or notes..."/></div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;border-top:1px solid var(--border);padding-top:14px">
        <button class="btn btn-ghost" type="button" onclick="window.closeBusyModal()">Cancel</button>
        <button class="btn btn-primary" type="button" id="busy-submit-btn" onclick="window.submitBusyDates()"><i class="bi bi-check2"></i> Save Schedule</button>
      </div>
    </div>`;
  renderModalCalendarGrid();
}

window.setBusyPreset = (t) => { const inp = document.getElementById("busy-title"); if (inp) inp.value = t; };
window.toggleBusyTimeInputs = (allDay) => { const el = document.getElementById("busy-time-container"); if (el) el.style.display = allDay ? "none" : "grid"; };
window.prevModalCalMonth = () => { modalCalMonth--; if (modalCalMonth < 0) { modalCalMonth = 11; modalCalYear--; } renderModalCalendarGrid(); };
window.nextModalCalMonth = () => { modalCalMonth++; if (modalCalMonth > 11) { modalCalMonth = 0; modalCalYear++; } renderModalCalendarGrid(); };
window.todayModalCalMonth = () => { modalCalYear = new Date().getFullYear(); modalCalMonth = new Date().getMonth(); renderModalCalendarGrid(); };
window.toggleBusyDateSelection = (dateStr) => {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (dateStr < todayStr) return showToast("Cannot mark past dates.", "error");
  if (selectedBusyDates.has(dateStr)) selectedBusyDates.delete(dateStr);
  else selectedBusyDates.add(dateStr);
  renderModalCalendarGrid();
};

function renderModalCalendarGrid() {
  const gridEl = document.getElementById("modal-calendar-grid");
  if (!gridEl) return;
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  setElText("modal-cal-month-title", `${monthNames[modalCalMonth]} ${modalCalYear}`);
  const firstDay = new Date(modalCalYear, modalCalMonth, 1).getDay();
  const daysInMonth = new Date(modalCalYear, modalCalMonth + 1, 0).getDate();
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  let html = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => `<div class="cal-day-header">${d}</div>`).join("");
  for (let i = 0; i < firstDay; i++) html += `<div class="cal-day-cell other-month" style="min-height:36px"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const fullDate = `${modalCalYear}-${String(modalCalMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isPast = fullDate < todayStr;
    const isSel = selectedBusyDates.has(fullDate);
    html += `<div class="cal-day-cell" style="min-height:36px;padding:4px;background:${isSel ? 'var(--red-bg)' : 'var(--surface)'};border-color:${isSel ? 'var(--red)' : 'var(--border)'};cursor:${isPast ? 'not-allowed' : 'pointer'}" onclick="${isPast ? '' : `window.toggleBusyDateSelection('${fullDate}')`}"><span style="font-size:11px;font-weight:700;color:${isSel ? 'var(--red)' : (isPast ? 'var(--text-dim)' : 'var(--text)')}">${d}</span></div>`;
  }
  gridEl.innerHTML = html;
}

window.submitBusyDates = async function() {
  if (selectedBusyDates.size === 0) return showToast("Select at least one date.", "error");
  const title = (document.getElementById("busy-title")?.value || "").trim() || "In Court / Out of Office";
  const desc = (document.getElementById("busy-notes")?.value || "").trim();
  const allDay = document.getElementById("busy-all-day")?.checked;
  const timeStr = allDay ? "All Day" : `${document.getElementById("busy-start-time")?.value || "08:30"} - ${document.getElementById("busy-end-time")?.value || "17:00"}`;
  const u = window._currentUser || window._auth?.currentUser;
  const myProf = profiles.find(p => (p.ownerUid && p.ownerUid === u.uid) || (p.email && p.email.toLowerCase() === (u.email || "").toLowerCase()));

  for (const date of selectedBusyDates) {
    await dbAddAppointment({
      title, date, time: timeStr, description: desc, type: "busy",
      targetUid: u.uid, targetName: myProf?.name || u.email,
      requesterUid: u.uid, requesterName: myProf?.name || u.email, ownerUid: u.uid, status: "accepted"
    });
  }
  showToast(`Saved ${selectedBusyDates.size} date(s)!`);
  window.closeBusyModal();
  renderCalendarView();
  if (typeof renderDashboard === "function") renderDashboard();
};

window.deleteBusySlot = function(id) {
  window.openConfirmModal({
    icon: "bi-calendar-x-fill", title: "Remove Schedule Entry?",
    body: "Remove this schedule entry permanently?",
    confirmText: "Remove Entry", confirmStyle: "btn-danger",
    onConfirm: async () => {
      await dbDeleteAppointment(id);
      if (typeof closeDateScheduleModal === "function") closeDateScheduleModal();
      renderCalendarView();
      if (typeof renderDashboard === "function") renderDashboard();
      showToast("Schedule entry removed!");
    }
  });
};

// ── CALENDAR MONTH VIEW + FIXED ATTORNEY FILTER + STEALTH ────
let currentCalYear = new Date().getFullYear();
let currentCalMonth = new Date().getMonth();
let selectedCalDateStr = (() => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
})();

function getCalendarFilteredData() {
  const u = window._currentUser || window._auth?.currentUser;
  const currentUid = u?.uid || "";
  const userEmail = (u?.email || "").toLowerCase();
  const myProf = profiles.find(p => (p.ownerUid && p.ownerUid === currentUid) || (p.email && p.email.toLowerCase() === userEmail));
  const isDeveloper = myProf && myProf.role === "developer";
  const isSuperDev = myProf && myProf.role === "superdev";
  const filterVal = document.getElementById("calendar-filter-select")?.value || "Everyone";

  let filteredCases = cases.filter(c => c.dueDate || c.docDueDate || (Array.isArray(c.hearings) && c.hearings.length > 0) || (Array.isArray(c.deadlines) && c.deadlines.length > 0));
  let filteredAppts = appointments.filter(a => a.status === "accepted");

  if (isDeveloper) {
    const devUids = profiles.filter(p => p.role === "developer" && p.ownerUid).map(p => p.ownerUid);
    if (currentUid && !devUids.includes(currentUid)) devUids.push(currentUid);
    if (filterVal === "Everyone") {
      filteredCases = filteredCases.filter(c => devUids.includes(c.ownerUid));
    } else {
      const matchedProf = profiles.find(p => p.ownerUid === filterVal || p.id === filterVal);
      filteredCases = filteredCases.filter(c => c.ownerUid === filterVal || (matchedProf && c.profileId === matchedProf.id));
      filteredAppts = filteredAppts.filter(a => a.targetUid === filterVal || a.requesterUid === filterVal || a.ownerUid === filterVal);
    }
  } else if (filterVal !== "Everyone") {
    const matchedProf = profiles.find(p => p.ownerUid === filterVal || p.id === filterVal);
    const targetOwnerUid = matchedProf?.ownerUid || filterVal;
    filteredCases = filteredCases.filter(c =>
      c.ownerUid === targetOwnerUid ||
      (matchedProf && c.profileId === matchedProf.id) ||
      (Array.isArray(c.sharedWith) && c.sharedWith.includes(targetOwnerUid))
    );
    filteredAppts = filteredAppts.filter(a =>
      a.targetUid === targetOwnerUid || a.requesterUid === targetOwnerUid || a.ownerUid === targetOwnerUid
    );
  } else {
    filteredAppts = filteredAppts.filter(a => {
      const creatorProf = profiles.find(p => p.ownerUid === (a.targetUid || a.requesterUid || a.ownerUid));
      if (!isSuperDev && creatorProf?.role === "superdev") return false;
      return creatorProf?.role !== "developer";
    });
  }

  return { filteredCases, filteredAppts, currentUid, myProf, isDeveloper, isSuperDev, filterVal };
}

function renderCalendarView() {
  const select = document.getElementById("calendar-filter-select");
  const u = window._currentUser || window._auth?.currentUser;
  const myProf = profiles.find(p => p.ownerUid === u?.uid || (p.email && p.email.toLowerCase() === (u?.email || "").toLowerCase()));
  const isDeveloper = myProf && myProf.role === "developer";
  const isSuperDev = myProf && myProf.role === "superdev";

  if (select) {
    const curVal = select.value || "Everyone";
    const pool = isDeveloper
      ? profiles.filter(p => p.role === "developer")
      : (isSuperDev ? profiles : profiles.filter(p => p.role !== "developer" && p.role !== "superdev"));
    let optionsHtml = `<option value="Everyone">${isDeveloper ? "All Developers (Sandbox Overview)" : "Everyone (Firm Overview)"}</option>`;
    pool.forEach(p => {
      const valKey = p.ownerUid || p.id;
      const designation = p.role ? ` (${p.role === 'superdev' ? 'Developer Admin' : p.role})` : "";
      optionsHtml += `<option value="${escHtml(valKey)}">${escHtml(p.name)}${escHtml(designation)}</option>`;
    });
    select.innerHTML = optionsHtml;
    const stillExists = Array.from(select.options).some(o => o.value === curVal);
    select.value = stillExists ? curVal : "Everyone";
  }

  renderMonthlyCalendarGrid();
}

function prevCalMonth() { currentCalMonth--; if (currentCalMonth < 0) { currentCalMonth = 11; currentCalYear--; } renderMonthlyCalendarGrid(); }
function nextCalMonth() { currentCalMonth++; if (currentCalMonth > 11) { currentCalMonth = 0; currentCalYear++; } renderMonthlyCalendarGrid(); }
function todayCalMonth() {
  const now = new Date();
  currentCalYear = now.getFullYear(); currentCalMonth = now.getMonth();
  selectedCalDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  renderMonthlyCalendarGrid();
}
window.renderCalendarView = renderCalendarView;
window.prevCalMonth = prevCalMonth;
window.nextCalMonth = nextCalMonth;
window.todayCalMonth = todayCalMonth;

window.onCalendarDayClick = function(dateStr) {
  selectedCalDateStr = dateStr;
  if (document.getElementById("cal-day-panel")) renderMonthlyCalendarGrid();
  else openDateScheduleModal(dateStr);
};

function buildScheduleItemsForDate(dateStr) {
  const { filteredCases, filteredAppts, currentUid, myProf, isDeveloper } = getCalendarFilteredData();

  const dateCases = filteredCases.filter(c =>
    c.dueDate === dateStr || c.docDueDate === dateStr ||
    (Array.isArray(c.hearings) && c.hearings.some(h => h.date === dateStr)) ||
    (Array.isArray(c.deadlines) && c.deadlines.some(d => d.date === dateStr))
  );
  const dateAppts = filteredAppts.filter(a => a.date === dateStr);

  const allItems = [];
  dateCases.forEach(c => {
    const p = profiles.find(x => x.id === c.profileId || (c.ownerUid && x.ownerUid === c.ownerUid));
    const specificHearing = Array.isArray(c.hearings) ? c.hearings.find(h => h.date === dateStr) : null;
    const specificDeadline = Array.isArray(c.deadlines) ? c.deadlines.find(d => d.date === dateStr) : null;
    const isOwner = c.ownerUid === currentUid;
    const hasAccess = isOwner || (Array.isArray(c.sharedWith) && c.sharedWith.includes(currentUid)) || (Array.isArray(c.allowedUids) && c.allowedUids.includes(currentUid)) || (myProf && (myProf.role === "admin" || myProf.role === "superdev"));

    if (specificHearing) {
      allItems.push({
        id: c.id, subId: specificHearing.id || "h_default", kind: "hearing", hasAccess,
        badgeColor: "var(--gold)", badgeBg: "var(--gold-dim)", badgeLabel: "Court Hearing",
        title: hasAccess ? (specificHearing.purpose || c.title) : `Court Appearance (${p?.name || 'Counsel'})`,
        time: specificHearing.time || "8:30 AM", venue: c.venue || "Courtroom / Venue N/A",
        attorneyName: p?.name || "Attorney", attorneyColor: p?.avatarColor || "#8a6210", photoUrl: p?.photoUrl || null,
        description: hasAccess ? (specificHearing.notes || specificHearing.purpose || c.narrative || "") : "Confidential attorney-client information.",
        canEditDesc: isOwner, isDeveloper
      });
    }

    if (specificDeadline || c.docDueDate === dateStr) {
      const dSubtype = specificDeadline ? (specificDeadline.subtype || specificDeadline.title) : (c.docType || "Formal Pleading");
      allItems.push({
        id: c.id, subId: specificDeadline?.id || "d_default", kind: "deadline", hasAccess,
        badgeColor: "var(--violet)", badgeBg: "var(--violet-bg)", badgeLabel: "Pleading Deadline",
        title: hasAccess ? `${c.title} — ${dSubtype}` : `Filing Deadline (${p?.name || 'Counsel'})`,
        time: "Filing Deadline", venue: c.venue || "Courtroom / Venue N/A",
        attorneyName: p?.name || "Attorney", attorneyColor: p?.avatarColor || "#4338ca", photoUrl: p?.photoUrl || null,
        description: hasAccess ? (specificDeadline?.notes || "") : "Confidential attorney-client filing deadline.",
        canEditDesc: isOwner, isDeveloper
      });
    }
  });

  dateAppts.forEach(a => {
    const isBusy = a.type === "busy";
    const isOwner = a.ownerUid === currentUid || a.requesterUid === currentUid || a.targetUid === currentUid;
    const targetProf = profiles.find(p => p.ownerUid === (a.targetUid || a.requesterUid || a.ownerUid));
    allItems.push({
      id: a.id, kind: isBusy ? "busy" : "appt", hasAccess: true,
      badgeColor: isBusy ? "var(--red)" : "var(--green)", badgeBg: isBusy ? "var(--red-bg)" : "var(--green-bg)",
      badgeLabel: isBusy ? "Out of Office / Busy" : "Appointment",
      title: a.title, time: a.time || "All Day", venue: "",
      attorneyName: targetProf?.name || a.targetName || "Attorney",
      attorneyColor: targetProf?.avatarColor || "#991b1b", photoUrl: targetProf?.photoUrl || null,
      description: a.description || "", canDelete: isOwner, canEditDesc: isOwner, isDeveloper
    });
  });

  return allItems;
}

function renderCalendarDayPanel(dateStr) {
  const heading = document.getElementById("cal-selected-heading");
  const listEl = document.getElementById("cal-selected-events");
  if (!heading || !listEl) return;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  heading.innerHTML = `${formatDate(dateStr)} ${dateStr === todayStr ? '<span class="badge" style="background:var(--gold-dim);color:var(--gold-light);margin-left:6px;font-size:10px">TODAY</span>' : ''}`;

  const allItems = buildScheduleItemsForDate(dateStr);
  if (allItems.length === 0) {
    listEl.innerHTML = `
      <div style="text-align:center;padding:32px 16px;background:var(--surface2);border-radius:12px;border:1px dashed var(--border-soft)">
        <i class="bi bi-calendar-check" style="font-size:28px;color:var(--text-dim)"></i>
        <div style="font-weight:700;margin-top:8px;color:var(--text)">No hearings or deadlines</div>
        <div style="font-size:12.5px;color:var(--text-dim);margin-top:4px">No scheduled entries match this date and filter.</div>
      </div>`;
    return;
  }

  listEl.innerHTML = allItems.map(item => `
    <div style="padding:13px;background:var(--surface2);border:1px solid var(--border);border-left:4px solid ${item.badgeColor};border-radius:10px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span class="badge" style="background:${item.badgeBg};color:${item.badgeColor}">${item.badgeLabel}</span>
        <span style="font-size:11.5px;font-weight:700;color:var(--text-muted)"><i class="bi bi-clock"></i> ${escHtml(item.time)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        ${avatarDiv(item.attorneyName, item.attorneyColor, 26, item.photoUrl)}
        <div style="min-width:0">
          <div style="font-size:13.5px;font-weight:700;color:var(--text)">${escHtml(item.title)}</div>
          <div style="font-size:11.5px;color:var(--text-dim)">${escHtml(item.attorneyName)}</div>
        </div>
      </div>
      ${item.venue ? `<div style="font-size:11.5px;color:var(--text-dim);margin-top:4px"><i class="bi bi-geo-alt" style="color:var(--gold)"></i> ${escHtml(item.venue)}</div>` : ''}
      ${item.description ? `<div style="font-size:12px;color:var(--text-muted);margin-top:6px;padding:8px;background:var(--surface);border-radius:6px;border:1px solid var(--border)">${escHtml(item.description)}</div>` : ''}
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
        ${(item.kind === "hearing" || item.kind === "deadline") && item.hasAccess
          ? `<button class="btn btn-secondary btn-sm" onclick="openCase('${item.id}')">Open Case File →</button>`
          : (item.canDelete ? `<button class="btn btn-danger btn-sm" onclick="window.deleteBusySlot('${item.id}')"><i class="bi bi-trash3"></i> Remove</button>` : '')}
        ${item.canEditDesc ? `<button class="btn btn-ghost btn-sm" onclick="openDateScheduleModal('${dateStr}')"><i class="bi bi-pencil-square"></i> Edit Note</button>` : ''}
      </div>
    </div>
  `).join("");
}

function renderMonthlyCalendarGrid() {
  const titleEl = document.getElementById("cal-month-title");
  const gridEl = document.getElementById("calendar-grid-container");
  if (!gridEl) return;

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  if (titleEl) titleEl.textContent = `${monthNames[currentCalMonth]} ${currentCalYear}`;

  const { filteredCases, filteredAppts, currentUid, myProf } = getCalendarFilteredData();
  const eventsByDate = {};

  filteredCases.forEach(c => {
    const p = profiles.find(x => x.id === c.profileId || (c.ownerUid && x.ownerUid === c.ownerUid));
    const hasAccess = c.ownerUid === currentUid || (Array.isArray(c.sharedWith) && c.sharedWith.includes(currentUid)) || (Array.isArray(c.allowedUids) && c.allowedUids.includes(currentUid)) || (myProf && (myProf.role === "admin" || myProf.role === "superdev"));
    const attorneyInitials = p ? initials(p.name) : "AT";
    const attorneyColor = p?.avatarColor || "#8a6210";

    if (c.docDueDate) {
      if (!eventsByDate[c.docDueDate]) eventsByDate[c.docDueDate] = [];
      eventsByDate[c.docDueDate].push({ id: c.id, type: "deadline", initials: attorneyInitials, avatarColor: attorneyColor, title: hasAccess ? (c.docType || c.title) : "Pleading Due" });
    }
    if (Array.isArray(c.deadlines)) {
      c.deadlines.forEach(d => {
        if (d.date && d.date !== c.docDueDate) {
          if (!eventsByDate[d.date]) eventsByDate[d.date] = [];
          eventsByDate[d.date].push({ id: c.id, type: "deadline", initials: attorneyInitials, avatarColor: attorneyColor, title: hasAccess ? (d.subtype || d.title || c.title) : "Pleading Due" });
        }
      });
    }
    if (Array.isArray(c.hearings)) {
      c.hearings.forEach(h => {
        if (h.date) {
          if (!eventsByDate[h.date]) eventsByDate[h.date] = [];
          eventsByDate[h.date].push({ id: c.id, type: "hearing", initials: attorneyInitials, avatarColor: attorneyColor, title: hasAccess ? (h.purpose || c.title) : "Court Appearance" });
        }
      });
    }
  });

  filteredAppts.forEach(a => {
    if (!eventsByDate[a.date]) eventsByDate[a.date] = [];
    const isBusy = a.type === "busy";
    const targetProf = profiles.find(p => p.ownerUid === (a.targetUid || a.requesterUid || a.ownerUid));
    eventsByDate[a.date].push({
      id: a.id, type: isBusy ? "busy" : "appt",
      initials: targetProf ? initials(targetProf.name) : "AT",
      avatarColor: targetProf?.avatarColor || "#991b1b",
      title: a.title || (isBusy ? "Out of Office" : "Meeting")
    });
  });

  const startingDayOfWeek = new Date(currentCalYear, currentCalMonth, 1).getDay();
  const daysInMonth = new Date(currentCalYear, currentCalMonth + 1, 0).getDate();
  const prevMonthDays = new Date(currentCalYear, currentCalMonth, 0).getDate();
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const hasDayPanel = !!document.getElementById("cal-day-panel");

  gridEl.style.cssText = "display:grid !important;grid-template-columns:repeat(7, minmax(0, 1fr)) !important;gap:6px;width:100%;box-sizing:border-box;";
  let html = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(dh => `<div class="cal-day-header">${dh}</div>`).join("");

  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    html += `<div class="cal-day-cell other-month"><span class="cal-day-num">${prevMonthDays - i}</span></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const fullDateStr = `${currentCalYear}-${String(currentCalMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = fullDateStr === todayStr;
    const isPast = fullDateStr < todayStr;
    const isSelected = hasDayPanel && fullDateStr === selectedCalDateStr;
    const dayEvents = eventsByDate[fullDateStr] || [];

    let eventsMarkup = "";
    if (dayEvents.length > 0) {
      eventsMarkup = `<div style="display:flex;flex-direction:column;gap:3px;margin-top:4px;overflow:hidden;width:100%;min-width:0">`;
      dayEvents.slice(0, 2).forEach(ev => {
        let bgStyle = "background:var(--gold-dim);color:var(--gold-light);border:1px solid var(--gold-border);";
        if (ev.type === "deadline") bgStyle = "background:var(--violet-bg);color:var(--violet);border:1px solid rgba(129,140,248,0.3);";
        else if (ev.type === "busy") bgStyle = "background:var(--red-bg);color:var(--red);border:1px solid rgba(248,113,113,0.3);";
        else if (ev.type === "appt") bgStyle = "background:var(--green-bg);color:var(--green);border:1px solid rgba(52,211,153,0.3);";
        eventsMarkup += `<div style="display:flex;align-items:center;gap:3px;font-size:9.5px;font-weight:700;padding:2px 5px;border-radius:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;${bgStyle}" title="${escHtml(ev.title)}"><span style="width:13px;height:13px;border-radius:50%;background:${ev.avatarColor};font-size:7px;display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0">${ev.initials}</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${escHtml(ev.title)}</span></div>`;
      });
      if (dayEvents.length > 2) eventsMarkup += `<div style="font-size:8.5px;font-weight:700;color:var(--gold-light);background:var(--surface3);padding:1px 4px;border-radius:3px;text-align:center">+${dayEvents.length - 2} more</div>`;
      eventsMarkup += `</div>`;
    }

    html += `
      <div class="cal-day-cell ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''} ${isPast ? 'is-past' : ''}" onclick="onCalendarDayClick('${fullDateStr}')">
        <div style="display:flex;align-items:center;justify-content:space-between;width:100%">
          <span class="cal-day-num">${day}</span>
          ${isToday ? `<span style="font-size:8.5px;background:var(--gold-solid);color:#060c13;font-weight:800;padding:1px 4px;border-radius:3px">TODAY</span>` : ""}
        </div>
        ${eventsMarkup}
      </div>`;
  }

  const rem = (7 - ((startingDayOfWeek + daysInMonth) % 7)) % 7;
  for (let i = 1; i <= rem; i++) html += `<div class="cal-day-cell other-month"><span class="cal-day-num">${i}</span></div>`;

  gridEl.innerHTML = html;
  if (hasDayPanel) renderCalendarDayPanel(selectedCalDateStr);
}
window.renderMonthlyCalendarGrid = renderMonthlyCalendarGrid;

window.openDateScheduleModal = function(dateStr) {
  const modal = document.getElementById("date-schedule-modal");
  const listEl = document.getElementById("dsm-events-list");
  if (!modal || !listEl) return;
  setElText("dsm-title", `Schedule for ${formatDate(dateStr)}`);
  const allItems = buildScheduleItemsForDate(dateStr);
  listEl.innerHTML = allItems.length === 0
    ? `<div class="empty-state" style="padding:28px"><div style="font-size:13px;color:var(--text-muted)">No events recorded for this date.</div></div>`
    : allItems.map(item => `
      <div style="background:var(--surface2);border:1px solid var(--border);border-left:4px solid ${item.badgeColor};border-radius:12px;padding:14px 16px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span class="badge" style="background:${item.badgeBg};color:${item.badgeColor}">${item.badgeLabel}</span>
          <span style="font-size:11.5px;color:var(--gold-light);font-weight:700">${item.time}</span>
        </div>
        <div style="font-size:14px;font-weight:700;margin-bottom:4px">${escHtml(item.title)}</div>
        <div style="font-size:11.5px;color:var(--text-muted)">${escHtml(item.attorneyName)}</div>
        ${item.description ? `<div style="font-size:12px;color:var(--text-muted);margin-top:8px">${escHtml(item.description)}</div>` : ''}
      </div>`).join("");
  modal.classList.remove("hidden");
};
window.closeDateScheduleModal = () => document.getElementById("date-schedule-modal")?.classList.add("hidden");

// ── SYSTEM HEALTH & DIAGNOSTICS ──────────────────────────────
window.openDiagnosticModal = function() {
  document.getElementById("diagnostic-modal")?.classList.remove("hidden");
  updateWorkspaceStatus(true);
};
window.closeDiagnosticModal = () => document.getElementById("diagnostic-modal")?.classList.add("hidden");

async function updateWorkspaceStatus(manualRun = false) {
  const netBadge = document.getElementById("diag-network-badge");
  const dbBadge = document.getElementById("diag-db-badge");
  const driveBadge = document.getElementById("diag-drive-badge");

  const isNetworkOk = navigator.onLine;
  const isDbOk = !localMode && !!window._db && dbReady;
  const isDriveOk = typeof hasValidToken === "function" ? hasValidToken() : false;

  if (netBadge) {
    netBadge.className = isNetworkOk ? "badge badge-pass" : "badge badge-fail";
    netBadge.textContent = isNetworkOk ? "Online" : "Offline";
  }
  if (dbBadge) {
    dbBadge.className = isDbOk ? "badge badge-pass" : "badge badge-warn";
    dbBadge.textContent = isDbOk ? "Connected" : "Memory Mode";
  }
  if (driveBadge) {
    driveBadge.className = isDriveOk ? "badge badge-pass" : "badge badge-warn";
    driveBadge.textContent = isDriveOk ? "Linked" : "Not Connected";
  }

  renderGoogleStatusPopover();
  if (manualRun && typeof showToast === "function") showToast("Health check complete");
}
window.updateWorkspaceStatus = updateWorkspaceStatus;

// ── UNIVERSAL CONFIRMATION & NAVIGATION ──────────────────────
let pendingActionConfirmCallback = null;
window.openConfirmModal = function({ icon = "bi-shield-check", title = "Confirm Action", body = "Are you sure?", confirmText = "Confirm", cancelText = "Keep", confirmStyle = "btn-primary", onConfirm = null }) {
  const modal = document.getElementById("universal-confirm-modal");
  if (!modal) return;
  document.getElementById("ucm-icon").innerHTML = `<i class="bi ${icon}" style="color:var(--gold)"></i>`;
  setElText("ucm-title", title);
  document.getElementById("ucm-body").innerHTML = body;
  const btn = document.getElementById("ucm-confirm-btn");
  btn.textContent = confirmText; btn.className = `btn ${confirmStyle}`;
  pendingActionConfirmCallback = onConfirm;
  modal.classList.remove("hidden");
};
window.closeConfirmModal = () => { document.getElementById("universal-confirm-modal")?.classList.add("hidden"); pendingActionConfirmCallback = null; };

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("ucm-confirm-btn")?.addEventListener("click", () => {
    const cb = pendingActionConfirmCallback;
    window.closeConfirmModal();
    if (typeof cb === "function") cb();
  });
});

let pendingNavigationDestination = null;
let caseDetailOrigin = "allcases";

const DESKTOP_PAGE_META = {
  dashboard:     ["Law Office Dashboard", "Quick overview of your cases, hearings, and deadlines"],
  calendar:      ["Firm Schedule & Court Calendar", "View upcoming hearings, pleading deadlines, and attorney availability"],
  mydrive:       ["Firm Drive — Case Files & Folders", "Direct, secure access to your system Google Drive folders & Docs"],
  profiles:      ["Office Attorneys", "Directory of partners and associates in the firm"],
  profileDetail: ["Attorney Profile", "Assigned caseload, practice bio, and contact details"],
  profileForm:   ["Attorney Profile Setup", "Create or edit attorney profile information"],
  allcases:      ["All Cases", "Search, filter, and open any case record"],
  caseDetail:    ["Case File Details", "Full summary, hearing schedule, and attached documents"],
  caseForm:      ["Add / Edit Case", "Follow the 4 steps below to save your case record"],
  myprofile:     ["Profile Settings", "Manage your display name, contact number, profile photo, and practice bio"],
  settings:      ["Settings", "Accessibility, notification sounds, security credentials, and firm policies"]
};

function hasUnsavedCaseChanges() {
  if (window._isSubmittingCase || currentView !== "caseForm") return false;
  const title = (document.getElementById("cf-case-title")?.value || "").trim();
  const narrative = (document.getElementById("cf-narrative")?.value || "").trim();
  return Boolean(title || narrative || (Array.isArray(pendingDocs) && pendingDocs.length > 0));
}
window.hasUnsavedCaseChanges = hasUnsavedCaseChanges;
window.promptDiscardCase = (dest) => { pendingNavigationDestination = dest; document.getElementById("discard-case-modal")?.classList.remove("hidden"); };
window.cancelDiscardCase = () => { pendingNavigationDestination = null; document.getElementById("discard-case-modal")?.classList.add("hidden"); };
window.confirmDiscardCase = () => { const t = pendingNavigationDestination || "allcases"; pendingNavigationDestination = null; document.getElementById("discard-case-modal")?.classList.add("hidden"); executeNavigation(t); };
window.handleCaseCancelOrExit = () => hasUnsavedCaseChanges() ? window.promptDiscardCase("allcases") : executeNavigation("allcases");
window.handleCaseDetailBack = () => caseDetailOrigin === "profileDetail" && selProfile ? (showView("profileDetail"), renderProfileDetail()) : navTo(caseDetailOrigin === "dashboard" ? "dashboard" : "allcases");

function isValidMobile(num) { return !num || String(num).replace(/\D/g, "").length === 11; }
function isValidEmail(email) { return /^[^\s@]+@(gmail\.com|outlook\.com|yahoo\.com)$/i.test(String(email || "").trim()); }
window.isValidMobile = isValidMobile;
window.isValidEmail  = isValidEmail;

function initPasswordStrengthChecker() {
  const passInput = document.getElementById("setting-password");
  const reqContainer = document.getElementById("password-requirements");
  if (!passInput || !reqContainer) return;
  const reqs = {
    length: { el: document.getElementById("req-length"), test: v => v.length >= 6 },
    upper:  { el: document.getElementById("req-upper"),  test: v => /[A-Z]/.test(v) },
    number: { el: document.getElementById("req-number"), test: v => /\d/.test(v) },
    special:{ el: document.getElementById("req-special"),test: v => /[^A-Za-z0-9]/.test(v) }
  };
  passInput.addEventListener("input", () => {
    const val = passInput.value;
    reqContainer.style.display = val ? "block" : "none";
    for (const k in reqs) {
      const ok = reqs[k].test(val);
      if (reqs[k].el) {
        reqs[k].el.style.color = ok ? "var(--green)" : "var(--text-dim)";
        const ic = reqs[k].el.querySelector(".req-icon");
        if (ic) ic.innerHTML = ok ? `<i class="bi bi-check-circle-fill" style="color:var(--green)"></i>` : `<i class="bi bi-x-circle" style="color:var(--red)"></i>`;
      }
    }
  });
}
window.initPasswordStrengthChecker = initPasswordStrengthChecker;

function showView(name) {
  document.getElementById("chat-panel")?.classList.add("hidden");
  document.body.classList.remove("chat-open");
  window.closeAllTopPopovers();

  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
  document.getElementById("view-" + name)?.classList.remove("hidden");
  currentView = name;

  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  let key = name;
  if (name === "caseDetail" || name === "caseForm") key = "allcases";
  else if (name === "profileDetail" || name === "profileForm") key = "profiles";
  document.querySelector(`.nav-btn[data-nav="${key}"]`)?.classList.add("active");

  const meta = DESKTOP_PAGE_META[name];
  if (meta) {
    setElText("main-page-title", meta[0]);
    setElText("main-page-sub", meta[1]);
  }
}

function navTo(view) {
  if (currentView === "caseForm" && view !== "caseForm" && hasUnsavedCaseChanges()) return window.promptDiscardCase(view);
  executeNavigation(view);
}

function executeNavigation(view) {
  showView(view);
  if (view === "dashboard")     renderDashboard();
  if (view === "profiles")      renderProfiles();
  if (view === "allcases")      { if (typeof currentAllCasesPage !== "undefined") currentAllCasesPage = 1; renderAllCases(); }
  if (view === "myprofile")     renderMyProfile();
  if (view === "settings" && typeof renderSettingsView === "function") renderSettingsView();
  if (view === "calendar")      renderCalendarView();
  if (view === "notifications") renderNotificationsView();
  if (view === "mydrive")       initDriveExplorer();
}

window.quickFilterCases = (status) => { navTo("allcases"); if (typeof setAllCasesStatusTab === "function") setAllCasesStatusTab(status); };
window.showView = showView;
window.navTo = navTo;
window.executeNavigation = executeNavigation;
// ═══════════════════════════════════════════════════════════════
//  SIMANDO LAW — UI CONTROLLER (PART 2 OF 2)
// ═══════════════════════════════════════════════════════════════

// ── DASHBOARD & COMPACT ACTIVE CASES ─────────────────────────
let currentDashPage = 1;
let dashCasesFilter = "all";
const dashPageSize = 5;

window.changeDashPage = function(delta) { currentDashPage += delta; renderDashboard(); };
window.setDashCasesFilter = function(kind) { dashCasesFilter = kind; currentDashPage = 1; renderDashboard(); };

function renderDashboard() {
  const todayDateEl = document.getElementById("today-date");
  if (todayDateEl) {
    todayDateEl.textContent = new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }

  const userCases = getAccessibleCases();
  setElText("stat-total", userCases.length);
  setElText("stat-ongoing", userCases.filter(c => c.status === "On-going").length);
  setElText("stat-completed", userCases.filter(c => c.status === "Completed").length);

  const activePool = userCases.filter(c => c.status === "On-going" || c.status === "Pending");
  const baseList = activePool.length > 0 ? activePool : userCases;

  const pillsEl = document.getElementById("dash-cases-pills");
  if (pillsEl) {
    const ongoingCount = baseList.filter(c => c.status === "On-going").length;
    const pendingCount = baseList.filter(c => c.status === "Pending").length;
    pillsEl.innerHTML = `
      <button class="pill-tab ${dashCasesFilter === 'all' ? 'active' : ''}" onclick="setDashCasesFilter('all')">All (${baseList.length})</button>
      <button class="pill-tab ${dashCasesFilter === 'On-going' ? 'active' : ''}" onclick="setDashCasesFilter('On-going')">On-going (${ongoingCount})</button>
      <button class="pill-tab ${dashCasesFilter === 'Pending' ? 'active' : ''}" onclick="setDashCasesFilter('Pending')">Pending (${pendingCount})</button>
    `;
  }

  const listToDisplay = dashCasesFilter === "all" ? baseList : baseList.filter(c => c.status === dashCasesFilter);
  const total = listToDisplay.length;
  const totalPages = Math.max(1, Math.ceil(total / dashPageSize));
  if (currentDashPage > totalPages) currentDashPage = totalPages;
  if (currentDashPage < 1) currentDashPage = 1;

  const startIdx = (currentDashPage - 1) * dashPageSize;
  const pagedCases = listToDisplay.slice(startIdx, startIdx + dashPageSize);

  const dcEl = document.getElementById("dash-cases");
  if (dcEl) {
    dcEl.innerHTML = pagedCases.length === 0
      ? '<div class="empty-state" style="padding:36px 16px"><div class="empty-state-icon" style="color:var(--gold);font-size:32px"><i class="bi bi-folder2-open"></i></div><div>No active cases match this filter.</div></div>'
      : pagedCases.map(c => {
        const p = profiles.find(x => x.id === c.profileId);
        const targetDue = c.dueDate || c.docDueDate;
        const daysLeft = targetDue ? Math.ceil((new Date(targetDue) - new Date()) / (1000 * 60 * 60 * 24)) : null;
        const urgency = daysLeft !== null
          ? (daysLeft < 0   ? { col: "var(--red)",      label: "Overdue" }
           : daysLeft === 0 ? { col: "var(--red)",      label: "Due today" }
           : daysLeft <= 7  ? { col: "var(--red)",      label: daysLeft + "d left" }
           : daysLeft <= 30 ? { col: "var(--amber)",    label: daysLeft + "d left" }
           :                  { col: "var(--text-dim)", label: daysLeft + "d left" })
          : null;

        return `
          <button class="case-item" onclick="openCase('${c.id}')">
            ${p ? avatarDiv(p.name, p.avatarColor, 30, p.photoUrl) : ""}
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(c.title)}</div>
              <div style="font-size:11.5px;color:var(--text-dim);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(c.category || "Case")} · ${escHtml(p?.name || c.type || "Litigation")}</div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <span class="badge" style="background:var(--amber-bg);color:var(--amber);padding:2px 8px;font-size:10.5px">${escHtml(c.status)}</span>
              ${urgency ? `<div style="font-size:10.5px;font-weight:700;color:${urgency.col};margin-top:2px">${urgency.label}</div>` : ""}
            </div>
          </button>`;
      }).join("");
  }

  setElText("dash-page-info", total === 0 ? "Showing 0 cases" : `Showing ${startIdx + 1}–${Math.min(startIdx + dashPageSize, total)} of ${total}`);
  setElText("dash-page-num", `Page ${currentDashPage} of ${totalPages}`);
  const prevBtn = document.getElementById("dash-btn-prev");
  const nextBtn = document.getElementById("dash-btn-next");
  if (prevBtn) prevBtn.disabled = currentDashPage <= 1;
  if (nextBtn) nextBtn.disabled = currentDashPage >= totalPages;

  renderDashProfiles();
  renderQuickAccess();
  if (typeof renderDashboardCalendarAgenda === "function") renderDashboardCalendarAgenda();
  if (typeof renderOnlineUsersPopover === "function") renderOnlineUsersPopover();
  if (typeof renderGoogleStatusPopover === "function") renderGoogleStatusPopover();
  if (typeof checkOnboardingSecurityStatus === "function") checkOnboardingSecurityStatus();
}
window.renderDashboard = renderDashboard;

function renderDashProfiles() {
  const el = document.getElementById("dash-profiles");
  if (!el) return;
  const u = window._currentUser || window._auth?.currentUser;
  const userEmail = (u?.email || "").toLowerCase();
  const myProf = u ? profiles.find(p => (p.ownerUid && p.ownerUid === u.uid) || (p.email && p.email.toLowerCase() === userEmail)) : null;
  const isDeveloper = myProf && myProf.role === "developer";
  const isSuperDev = myProf && myProf.role === "superdev";

  // Stealth rule: superdev is only visible if current user is superdev
  let visible = isDeveloper
    ? profiles.filter(p => p.role === "developer")
    : (isSuperDev ? profiles : profiles.filter(p => p.role !== "developer" && p.role !== "superdev"));

  const userCases = getAccessibleCases();

  el.innerHTML = visible.map(p => {
    const caseCount = userCases.filter(c => c.profileId === p.id).length;
    return `
      <div class="dash-roster-item" onclick="openProfile('${p.id}')">
        ${avatarDiv(p.name, p.avatarColor, 32, p.photoUrl)}
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:12.5px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(p.name)}</div>
          <div style="font-size:11px;color:var(--text-muted)">${escHtml(p.role === 'superdev' ? 'Developer Admin' : (p.role || 'Attorney'))}</div>
        </div>
        <span class="badge" style="background:var(--surface3);color:var(--text-dim);font-size:10px">${caseCount} case${caseCount !== 1 ? 's' : ''}</span>
      </div>`;
  }).join("");
}
window.renderDashProfiles = renderDashProfiles;

// ── PROFILES DIRECTORY (STEALTH HIDES SUPERDEV FROM NON-SUPERDEV) ──
let profilesViewMode = localStorage.getItem("simando-profiles-view") || "tile";

window.setProfilesViewMode = function(mode) {
  profilesViewMode = mode;
  try { localStorage.setItem("simando-profiles-view", mode); } catch (e) {}
  const tileBtn = document.getElementById("btn-view-tile");
  const listBtn = document.getElementById("btn-view-list");
  if (tileBtn && listBtn) {
    tileBtn.className = mode === "tile" ? "btn btn-sm btn-secondary active" : "btn btn-sm btn-ghost";
    listBtn.className = mode === "list" ? "btn btn-sm btn-secondary active" : "btn btn-sm btn-ghost";
  }
  renderProfiles();
};

function renderProfiles() {
  const u = window._currentUser || window._auth?.currentUser;
  if (!u) return;
  const userEmail = (u.email || "").toLowerCase();
  const myProf = profiles.find(p => (p.ownerUid && p.ownerUid === u.uid) || (p.email && p.email.toLowerCase() === userEmail));
  const isDeveloper = myProf && myProf.role === "developer";
  const isSuperDev = myProf && myProf.role === "superdev";

  // Stealth rule: superdev accounts are never shown to admin or attorney or regular dev users
  const visibleProfiles = isDeveloper
    ? profiles.filter(p => p.role === "developer")
    : (isSuperDev ? profiles : profiles.filter(p => p.role !== "developer" && p.role !== "superdev"));

  setElText("profiles-count", isDeveloper ? `${visibleProfiles.length} developer profile(s)` : `${visibleProfiles.length} attorney${visibleProfiles.length !== 1 ? "s" : ""}`);

  const el = document.getElementById("profiles-grid");
  if (!el) return;
  const userCases = getAccessibleCases();

  if (visibleProfiles.length === 0) {
    el.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon" style="color:var(--gold)"><i class="bi bi-people"></i></div><div>No profiles found.</div></div>`;
    return;
  }

  if (profilesViewMode === "list") {
    el.style.display = "flex"; el.style.flexDirection = "column"; el.style.gap = "8px";
    el.innerHTML = visibleProfiles.map(p => {
      const pc = userCases.filter(c => c.profileId === p.id);
      const isMe = p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === userEmail);
      return `
        <div class="profile-list-row" onclick="openProfile('${p.id}')" style="${isMe ? 'border-color:var(--gold-border)' : ''}">
          <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:0">
            ${avatarDiv(p.name, p.avatarColor, 38, p.photoUrl)}
            <div style="min-width:0">
              <div style="font-weight:700;font-size:14.5px;color:var(--text)">${escHtml(p.name)} ${isMe ? '<span style="font-size:9.5px;color:var(--gold);background:var(--gold-dim);padding:1px 5px;border-radius:4px;margin-left:6px">YOU</span>' : ""}</div>
              <div style="font-size:12px;color:var(--text-muted)">${escHtml(p.role === 'superdev' ? 'Developer Admin' : (p.role || 'Attorney'))} · ${escHtml(p.email || "No email")}</div>
              ${p.description ? `<div style="font-size:11.5px;color:var(--text-dim);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(p.description)}</div>` : ""}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;flex-shrink:0">
            <span style="font-size:12px;color:var(--text-dim)">${pc.length} case${pc.length !== 1 ? 's' : ''}</span>
            <span style="font-size:14px;color:var(--gold)"><i class="bi bi-arrow-right"></i></span>
          </div>
        </div>`;
    }).join("");
  } else {
    el.style.display = "grid";
    el.style.gridTemplateColumns = "repeat(auto-fill, minmax(280px, 1fr))";
    el.style.gap = "18px";
    el.innerHTML = visibleProfiles.map(p => {
      const pc = userCases.filter(c => c.profileId === p.id);
      const ongoing = pc.filter(c => c.status === "On-going").length;
      const isMe = p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === userEmail);
      return `
        <div class="profile-card" onclick="openProfile('${p.id}')" style="${isMe ? 'border-color:var(--gold-border)' : ''}">
          <div class="flex-center gap-14 mb-16">
            ${avatarDiv(p.name, p.avatarColor, 48, p.photoUrl)}
            <div>
              <div style="font-weight:700;font-size:15.5px;color:var(--text)">${escHtml(p.name)} ${isMe ? '<span style="font-size:10px;color:var(--gold);background:var(--gold-dim);padding:2px 6px;border-radius:4px;margin-left:6px">YOU</span>' : ""}</div>
              <div style="font-size:13px;color:var(--text-muted)">${escHtml(p.role === 'superdev' ? 'Developer Admin' : (p.role || 'Attorney'))}</div>
            </div>
          </div>
          ${p.description ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;line-height:1.45">${escHtml(p.description)}</div>` : ""}
          <hr class="divider"/>
          ${p.email ? `<div style="font-size:12px;color:var(--text-muted)"><i class="bi bi-envelope-fill" style="color:var(--gold);margin-right:6px"></i>${escHtml(p.email)}</div>` : ""}
          ${p.contact ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px"><i class="bi bi-telephone-fill" style="color:var(--gold);margin-right:6px"></i>${escHtml(p.contact)}</div>` : ""}
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:10px;border-top:1px solid var(--border)">
            <span style="font-size:12.5px;color:var(--text-dim)">${pc.length} Case${pc.length !== 1 ? 's' : ''}</span>
            ${ongoing > 0 ? badge(ongoing + " active", statusColor("On-going")) : ""}
          </div>
        </div>`;
    }).join("");
  }
}
window.renderProfiles = renderProfiles;

// ── CASE SHARING SYSTEM (STEALTH HIDES SUPERDEV FROM ASSOCIATES) ──
window.openShareCaseModal = function() {
  if (!selCase) return;
  const listEl = document.getElementById("share-modal-list");
  if (!listEl) return;
  const sharedUids = selCase.sharedWith || [];
  const currentUid = window._currentUser?.uid || window._auth?.currentUser?.uid;
  const userEmail = (window._currentUser?.email || window._auth?.currentUser?.email || "").toLowerCase();
  const myProf = profiles.find(p => (p.ownerUid && p.ownerUid === currentUid) || (p.email && p.email.toLowerCase() === userEmail));
  const isDeveloper = myProf && myProf.role === "developer";
  const isSuperDev = myProf && myProf.role === "superdev";

  const associates = isDeveloper
    ? profiles.filter(p => p.ownerUid && p.ownerUid !== currentUid && p.role === "developer")
    : (isSuperDev
        ? profiles.filter(p => p.ownerUid && p.ownerUid !== currentUid)
        : profiles.filter(p => p.ownerUid && p.ownerUid !== currentUid && p.role !== "developer" && p.role !== "superdev"));

  listEl.innerHTML = associates.length === 0
    ? `<div style="text-align:center;color:var(--text-dim);font-size:13px;padding:12px">No other attorneys available for sharing.</div>`
    : associates.map(p => `
      <label style="display:flex;align-items:center;gap:12px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px 14px;cursor:pointer;margin:0">
        <input type="checkbox" name="share-associate-checkbox" value="${p.ownerUid}" ${sharedUids.includes(p.ownerUid) ? "checked" : ""} style="accent-color:var(--gold);width:16px;height:16px;margin:0"/>
        ${avatarDiv(p.name, p.avatarColor, 28, p.photoUrl)}
        <div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--text)">${escHtml(p.name)}</div><div style="font-size:11px;color:var(--text-muted)">${escHtml(p.email)}</div></div>
      </label>`).join("");

  document.getElementById("share-modal")?.classList.remove("hidden");
};
window.closeShareModal = () => document.getElementById("share-modal")?.classList.add("hidden");

async function saveShareSettings() {
  if (!selCase) return;
  const selectedUids = [];
  document.querySelectorAll('input[name="share-associate-checkbox"]').forEach(cb => { if (cb.checked) selectedUids.push(cb.value); });
  const ownerUid = selCase.ownerUid || window._currentUser.uid;
  const allowedUids = Array.from(new Set([ownerUid, ...selectedUids]));
  try {
    showToast("Updating share settings...");
    if (typeof dbUpdateCase === "function") await dbUpdateCase(selCase.id, { sharedWith: selectedUids, allowedUids });
    selCase.sharedWith = selectedUids; selCase.allowedUids = allowedUids;
    if (typeof dbLogAuditAction === "function") dbLogAuditAction("CASE_SHARED", { caseId: selCase.id, sharedWith: selectedUids });
    closeShareModal();
    showToast("Case shared successfully!");
  } catch (err) {
    showToast("Failed to share case: " + err.message, "error");
  }
}
window.saveShareSettings = saveShareSettings;

// ── PROFILE DETAIL ───────────────────────────────────────────
function renderProfileDetail() {
  const p = selProfile;
  if (!p) return;
  const currentUid = window._currentUser?.uid || window._auth?.currentUser?.uid;
  const userEmail = (window._currentUser?.email || window._auth?.currentUser?.email || "").toLowerCase();
  const isOwner = p.ownerUid === currentUid || (p.email && p.email.toLowerCase() === userEmail);

  const driveChip = isOwner
    ? (p.driveFolderId
        ? `<a href="https://drive.google.com/drive/folders/${p.driveFolderId}" target="_blank" style="font-size:12px;color:var(--green);display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:var(--green-bg);border-radius:6px"><i class="bi bi-google"></i> Drive Folder <i class="bi bi-arrow-right"></i></a>`
        : `<span style="font-size:12px;color:var(--text-dim)"><i class="bi bi-cloud-slash"></i> Drive not linked</span>`)
    : `<span style="font-size:12px;color:var(--text-dim)"><i class="bi bi-shield-lock"></i> Files Protected</span>`;

  const actionButtons = isOwner
    ? `<button class="btn btn-secondary btn-sm" onclick="navTo('myprofile')"><i class="bi bi-pencil-square"></i> Profile Settings</button><button class="btn btn-primary btn-sm" onclick="openAddCase()"><i class="bi bi-plus-circle"></i> Add Case</button>`
    : `<button class="btn btn-primary btn-sm" onclick="openAppointmentModal('${p.id}')"><i class="bi bi-calendar-plus"></i> Request Schedule</button>`;

  const headerCard = document.getElementById("profile-header-card");
  if (headerCard) {
    headerCard.innerHTML = `
      ${avatarDiv(p.name, p.avatarColor, 64, p.photoUrl)}
      <div style="flex:1">
        <div style="font-size:22px;font-weight:700;color:var(--text)">${escHtml(p.name)}</div>
        <div style="font-size:13.5px;color:var(--text-muted);margin-top:2px">${escHtml(p.role === 'superdev' ? 'Developer Admin' : (p.role || "Attorney"))}</div>
        ${p.description ? `<div style="font-size:12.5px;color:var(--text-muted);margin-top:8px;line-height:1.5">${escHtml(p.description)}</div>` : ""}
        <div style="display:flex;gap:16px;margin-top:10px;flex-wrap:wrap;align-items:center">
          ${p.email ? `<span style="font-size:12px;color:var(--text-muted)"><i class="bi bi-envelope-fill" style="color:var(--gold);margin-right:4px"></i>${escHtml(p.email)}</span>` : ""}
          ${p.contact ? `<span style="font-size:12px;color:var(--text-muted)"><i class="bi bi-telephone-fill" style="color:var(--gold);margin-right:4px"></i>${escHtml(p.contact)}</span>` : ""}
          ${driveChip}
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">${actionButtons}</div>`;
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
        ["Accessible Cases", pc.length],
        ["Active", pc.filter(c => c.status === "On-going").length],
        ["Resolved", pc.filter(c => c.status === "Completed").length],
        ["Documents", docs]
      ].map(([l, n]) => `<div class="stat-card" style="padding:16px 18px"><div class="stat-number" style="font-size:32px">${n}</div><div class="stat-label">${l}</div></div>`).join("");
    }
    updateAllFilterDropdowns();
    renderProfileCases();
  } else {
    if (noticeEl) noticeEl.style.display = "block";
    if (sectionEl) sectionEl.style.display = "none";
    if (statsEl) statsEl.style.display = "none";
  }
}
window.renderProfileDetail = renderProfileDetail;

function renderProfileCases() {
  const p = selProfile;
  if (!p) return;
  const q = (document.getElementById("pd-search")?.value || "").toLowerCase();
  const status = document.getElementById("pd-status")?.value || "All";
  const category = document.getElementById("pd-category")?.value || "All";
  const type = document.getElementById("pd-type")?.value || "All";
  const sort = document.getElementById("pd-sort")?.value || "asc";

  const pc = getAccessibleCases().filter(c => c.profileId === p.id);
  const filtered = sortCasesByDue(pc.filter(c =>
    (c.title.toLowerCase().includes(q) || (c.parties || "").toLowerCase().includes(q) || (c.caseNumber || "").toLowerCase().includes(q)) &&
    (status === "All" || c.status === status) && (category === "All" || c.category === category) && (type === "All" || c.type === type)
  ), sort);

  const el = document.getElementById("profile-cases-list");
  if (!el) return;
  el.innerHTML = filtered.length === 0
    ? `<div class="empty-state"><div class="empty-state-icon" style="color:var(--gold)"><i class="bi bi-search"></i></div><div>No cases match your filters.</div></div>`
    : filtered.map(c => `
      <div class="case-row" onclick="openCase('${c.id}')">
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:15px;color:var(--text);margin-bottom:4px">${escHtml(c.title)}</div>
          <div style="font-size:12px;color:var(--text-muted)">${escHtml(c.category || "Case")} · ${escHtml(c.type || "Litigation")} · ${escHtml(c.venue || "No Venue")}</div>
          <div style="font-size:12.5px;color:var(--text-dim);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(c.parties || "")}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">${badge(c.status, statusColor(c.status))}${dueBadge(c.dueDate || c.docDueDate)}</div>
      </div>`).join("");
}
window.renderProfileCases = renderProfileCases;

// ── ALL CASES VIEW ───────────────────────────────────────────
let currentAllCasesPage = 1;
const allCasesPageSize = 10;

window.changeAllCasesPage = (delta) => { currentAllCasesPage += delta; renderAllCases(); };
window.goToAllCasesPage = (pageNum) => { currentAllCasesPage = pageNum; renderAllCases(); };
window.setAllCasesStatusTab = (status) => { setElVal("ac-status", status); currentAllCasesPage = 1; renderAllCases(); };
window.resetAllCaseFilters = () => { setElVal("ac-search", ""); setElVal("ac-category", "All"); setElVal("ac-status", "All"); setElVal("ac-type", "All"); setElVal("ac-sort", "asc"); currentAllCasesPage = 1; renderAllCases(); };

function renderAllCasesStatusTabs(accessible, activeStatus) {
  const tabsEl = document.getElementById("ac-status-tabs");
  if (!tabsEl) return;
  const counts = {
    All: accessible.length,
    "On-going": accessible.filter(c => c.status === "On-going").length,
    Pending: accessible.filter(c => c.status === "Pending").length,
    Completed: accessible.filter(c => c.status === "Completed").length
  };
  tabsEl.innerHTML = Object.entries(counts).map(([k, n]) => `
    <button class="pill-tab ${activeStatus === k ? 'active' : ''}" onclick="setAllCasesStatusTab('${k}')">${k === 'All' ? 'All Cases' : k} (${n})</button>
  `).join("");
}

function renderAllCases() {
  updateAllFilterDropdowns();
  const q = (document.getElementById("ac-search")?.value || "").toLowerCase().trim();
  const status = document.getElementById("ac-status")?.value || "All";
  const category = document.getElementById("ac-category")?.value || "All";
  const type = document.getElementById("ac-type")?.value || "All";
  const sort = document.getElementById("ac-sort")?.value || "asc";

  const accessible = getAccessibleCases();
  renderAllCasesStatusTabs(accessible, status);

  const filtered = sortCasesByDue(accessible.filter(c => {
    const p = profiles.find(x => x.id === c.profileId);
    const matchesQ = !q || (c.title || "").toLowerCase().includes(q) || (p?.name || "").toLowerCase().includes(q) || (c.parties || "").toLowerCase().includes(q) || (c.caseNumber || "").toLowerCase().includes(q);
    return matchesQ && (status === "All" || c.status === status) && (category === "All" || c.category === category) && (type === "All" || c.type === type);
  }), sort);

  setElText("allcases-count", `${filtered.length} accessible case${filtered.length !== 1 ? "s" : ""} found`);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / allCasesPageSize));
  if (currentAllCasesPage > totalPages) currentAllCasesPage = totalPages;
  if (currentAllCasesPage < 1) currentAllCasesPage = 1;

  const startIdx = (currentAllCasesPage - 1) * allCasesPageSize;
  const pagedCases = filtered.slice(startIdx, startIdx + allCasesPageSize);

  const el = document.getElementById("all-cases-list");
  const paginationBar = document.getElementById("allcases-pagination-bar");
  if (!el) return;

  if (filtered.length === 0) {
    el.innerHTML = `<div class="card" style="text-align:center;padding:36px"><div style="font-size:15px;font-weight:700;margin-bottom:8px">No cases match your filters</div><button class="btn btn-secondary btn-sm" onclick="resetAllCaseFilters()">Clear Filters</button></div>`;
    if (paginationBar) paginationBar.style.display = "none";
    return;
  }

  if (paginationBar) paginationBar.style.display = "flex";
  el.innerHTML = pagedCases.map(c => {
    const p = profiles.find(x => x.id === c.profileId);
    return `<div class="case-row" onclick="openCase('${c.id}')">
      ${p ? avatarDiv(p.name, p.avatarColor, 40, p.photoUrl) : ""}
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:15px;color:var(--text);margin-bottom:3px">${escHtml(c.title)}</div>
        <div style="font-size:12px;color:var(--text-muted)">${escHtml(c.category || "Case")} · ${escHtml(p?.name || "")} · ${escHtml(c.type || "Litigation")} · ${escHtml(c.venue || "No Venue")}</div>
        <div style="font-size:12.5px;color:var(--text-dim);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(c.parties || "")}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">${badge(c.status, statusColor(c.status))}${dueBadge(c.dueDate || c.docDueDate)}</div>
    </div>`;
  }).join("");

  setElText("allcases-page-info", `Showing ${startIdx + 1}–${Math.min(startIdx + allCasesPageSize, total)} of ${total} cases`);
  const prevBtn = document.getElementById("allcases-btn-prev");
  const nextBtn = document.getElementById("allcases-btn-next");
  if (prevBtn) prevBtn.disabled = currentAllCasesPage <= 1;
  if (nextBtn) nextBtn.disabled = currentAllCasesPage >= totalPages;
  const buttonsWrap = document.getElementById("allcases-page-buttons");
  if (buttonsWrap) {
    let btnsHtml = "";
    for (let p = 1; p <= totalPages; p++) btnsHtml += `<button class="page-btn ${p === currentAllCasesPage ? 'active' : ''}" onclick="goToAllCasesPage(${p})">${p}</button>`;
    buttonsWrap.innerHTML = btnsHtml;
  }
}
window.renderAllCases = renderAllCases;

// ── CASE DETAIL (SUPERDEV HAS FULL ADMIN ACCESS) ─────────────
function renderCaseDetail() {
  const c = selCase;
  if (!c) return;
  const p = profiles.find(x => x.id === c.profileId);
  setElText("cd-title", c.title);

  const currentUid = window._currentUser?.uid || window._auth?.currentUser?.uid;
  const userEmail = (window._currentUser?.email || window._auth?.currentUser?.email || "").toLowerCase();
  const isOwner = c.ownerUid === currentUid || (p && p.email && p.email.toLowerCase() === userEmail);
  const isGroupAdmin = profiles.some(pr => pr.ownerUid === currentUid && (pr.role === "admin" || pr.role === "superdev"));
  const isShared = (Array.isArray(c.sharedWith) && c.sharedWith.includes(currentUid)) || (Array.isArray(c.allowedUids) && c.allowedUids.includes(currentUid));
  const canEdit = isOwner || isGroupAdmin || isShared;

  let actionButtons = "";
  if (canEdit) {
    actionButtons += `<button class="btn btn-primary btn-sm" onclick="openGoogleDocModal('${c.id}')"><i class="bi bi-file-earmark-richtext"></i> New Google Doc</button>`;
    actionButtons += `<button class="btn btn-secondary btn-sm" onclick="openEditCase()"><i class="bi bi-pencil-square"></i> Edit Case</button>`;
  }
  if (isOwner || isGroupAdmin) {
    actionButtons += `<button class="btn btn-secondary btn-sm" onclick="openShareCaseModal()"><i class="bi bi-people"></i> Share</button><button class="btn btn-danger btn-sm" onclick="confirmDeleteCase()"><i class="bi bi-trash3"></i> Delete</button>`;
  }
  if (isShared && !isOwner && !isGroupAdmin) actionButtons += `<span class="badge" style="background:var(--green-bg);color:var(--green);padding:6px 12px"><i class="bi bi-shield-check"></i> Shared Associate</span>`;

  const wrapEl = document.getElementById("cd-action-buttons-wrap");
  if (wrapEl) wrapEl.innerHTML = actionButtons;

  const chip = document.getElementById("cd-profile-chip");
  if (chip) {
    if (p) {
      chip.innerHTML = `${avatarDiv(p.name, p.avatarColor, 28, p.photoUrl)}<div><div style="font-size:14px;font-weight:600;color:var(--text)">${escHtml(p.name)}</div><div style="font-size:12px;color:var(--text-muted)">${escHtml(p.role === 'superdev' ? 'Developer Admin' : (p.role || "Attorney"))}</div></div><span style="font-size:12px;color:var(--text-dim);margin-left:8px"><i class="bi bi-arrow-right"></i> view profile</span>`;
      chip.style.display = "inline-flex";
    } else chip.style.display = "none";
  }

  const infoEl = document.getElementById("cd-info");
  if (infoEl) {
    infoEl.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        ${badge(c.status, statusColor(c.status))} ${badge(c.category || "Case", "var(--gold)")} ${badge(c.type || "Litigation", "var(--violet)")}
      </div>
      <hr class="divider"/>
      ${[
        ["Parties Involved", c.parties || "None"],
        ["Venue / Court", c.venue || "N/A"],
        ["Date Case Filed", formatDate(c.filedDate)],
        ["Case / Docket Number", c.caseNumber || "Not indicated"],
        ["Date Added", c.createdAt || "N/A"]
      ].map(([l, v]) => `<div style="margin-bottom:14px"><div class="field-label">${l}</div><div style="font-size:14px;color:var(--text)">${escHtml(v)}</div></div>`).join("")}
      <div><div class="field-label">Case Narrative</div><div style="font-size:14px;color:var(--text-muted);line-height:1.75">${escHtml(c.narrative || "")}</div></div>`;
  }

  const hearingsEl = document.getElementById("cd-hearings");
  if (hearingsEl) {
    const hearingsList = Array.isArray(c.hearings) ? c.hearings : [];
    const deadlinesList = Array.isArray(c.deadlines) ? c.deadlines : [];
    const sortedHearings = [...hearingsList].sort((a, b) => new Date(a.date) - new Date(b.date));
    const sortedDeadlines = [...deadlinesList].sort((a, b) => new Date(a.date) - new Date(b.date));
    const todayStr = new Date().toISOString().split("T")[0];

    let hHtml = `<div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:12px"><i class="bi bi-calendar-event" style="color:var(--gold)"></i> Schedule &amp; Timelines</div>`;
    hHtml += `<div style="font-size:11px;text-transform:uppercase;color:var(--text-dim);font-weight:700;margin-bottom:6px"><i class="bi bi-bank" style="color:var(--green)"></i> Court Hearings (${sortedHearings.length})</div>`;
    hHtml += sortedHearings.length === 0 ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">No court appearances on record.</div>`
      : `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">` + sortedHearings.map(h => `<div style="padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-left:4px solid ${h.date < todayStr ? 'var(--text-dim)' : 'var(--green)'};border-radius:8px"><div style="font-weight:700;font-size:12.5px;color:var(--text)">${formatDate(h.date)} ${h.time ? '· ' + h.time : ''}</div><div style="font-size:12px;font-weight:600;color:var(--gold-light)">${escHtml(h.purpose)}</div>${h.notes ? `<div style="font-size:11.5px;color:var(--text-dim);font-style:italic">"${escHtml(h.notes)}"</div>` : ''}</div>`).join("") + `</div>`;

    hHtml += `<div style="font-size:11px;text-transform:uppercase;color:var(--text-dim);font-weight:700;margin-bottom:6px"><i class="bi bi-file-earmark-text-fill" style="color:var(--gold)"></i> Document Deadlines (${sortedDeadlines.length})</div>`;
    hHtml += sortedDeadlines.length === 0 ? `<div style="font-size:12px;color:var(--text-muted)">No filing deadlines logged.</div>`
      : `<div style="display:flex;flex-direction:column;gap:8px">` + sortedDeadlines.map(d => `<div style="padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-left:4px solid var(--gold);border-radius:8px"><div style="font-weight:700;font-size:12.5px">${formatDate(d.date)}</div><div style="font-size:12px;color:var(--gold-light)">${escHtml(d.subtype || d.title || 'Pleading')}</div>${d.notes ? `<div style="font-size:11.5px;color:var(--text-dim);font-style:italic">"${escHtml(d.notes)}"</div>` : ''}</div>`).join("") + `</div>`;
    hearingsEl.innerHTML = hHtml;
  }

  const docs = c.documents || [];
  let docsHtml = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">
    <div style="font-size:15px;font-weight:700;color:var(--text)">Case Files</div>
    ${canEdit ? `<div style="display:inline-flex;align-items:center;gap:8px"><label style="font-size:11px;cursor:pointer"><input type="radio" name="cd-file-type" value="Inbound" checked style="accent-color:var(--gold)"/> In</label><label style="font-size:11px;cursor:pointer"><input type="radio" name="cd-file-type" value="Outbound" style="accent-color:var(--gold)"/> Out</label><button class="btn btn-primary btn-sm" onclick="addDocToCase()"><i class="bi bi-cloud-arrow-up"></i> Upload</button></div>` : `<span style="font-size:11px;color:var(--text-dim)"><i class="bi bi-shield-lock"></i> Protected</span>`}
  </div>`;
  if (docs.length === 0) {
    docsHtml += `<div class="upload-area" ${canEdit ? 'onclick="addDocToCase()"' : ''}><div style="font-size:24px;color:var(--gold)"><i class="bi bi-paperclip"></i></div><div>${canEdit ? 'Click to attach a document' : 'No documents uploaded'}</div></div>`;
  } else {
    docsHtml += docs.map((doc, idx) => `
      <div class="doc-item">
        <div>
          <span onclick='openFilePreview(${JSON.stringify(doc).replace(/'/g, "&#39;")})' style="cursor:pointer;color:var(--gold);font-weight:600;text-decoration:underline">${escHtml(doc.name)}</span>
          <div style="font-size:11.5px;color:var(--text-dim)">${doc.size} · ${doc.date} ${doc.fileType ? '· ' + doc.fileType : ''}</div>
        </div>
        ${canEdit ? `<button style="color:var(--red);font-size:15px" onclick="removeDocFromCase(${idx})" title="Delete File"><i class="bi bi-trash3-fill"></i></button>` : ""}
      </div>`).join("");
  }
  const docsEl = document.getElementById("cd-docs");
  if (docsEl) docsEl.innerHTML = docsHtml;

  const statusPanelEl = document.getElementById("cd-status-panel");
  if (statusPanelEl) {
    statusPanelEl.innerHTML = canEdit
      ? `<div style="font-size:15px;font-weight:700;margin-bottom:12px">Update Status</div>` + STATUS_OPTIONS.map(st => `<button onclick="confirmUpdateCaseStatus('${st}')" style="display:block;width:100%;margin-bottom:8px;padding:9px 14px;border-radius:9px;border:1px solid ${c.status === st ? statusColor(st) : 'var(--border)'};background:${c.status === st ? 'var(--gold-dim)' : 'transparent'};color:${c.status === st ? statusColor(st) : 'var(--text)'};text-align:left;font-weight:${c.status === st ? 700 : 500}">${c.status === st ? '<i class="bi bi-check-lg" style="margin-right:6px"></i>' : ''}${st}</button>`).join("")
      : `<div style="font-size:14px;font-weight:700;margin-bottom:8px">Current Status</div>${badge(c.status, statusColor(c.status))}`;
  }
}
window.renderCaseDetail = renderCaseDetail;

window.confirmUpdateCaseStatus = function(st) {
  if (!selCase || selCase.status === st) return;
  window.openConfirmModal({
    icon: "bi-arrow-repeat", title: "Update Case Status?",
    body: `Update status of <strong>"${escHtml(selCase.title)}"</strong> to <strong>"${st}"</strong>?`,
    confirmText: "Update Status", confirmStyle: "btn-primary",
    onConfirm: async () => {
      await dbUpdateCase(selCase.id, { status: st });
      selCase = { ...selCase, status: st };
      renderCaseDetail();
      showToast(`Status updated to "${st}"`);
    }
  });
};

async function removeDocFromCase(idx) {
  const docs = selCase.documents || [];
  const doc = docs[idx];
  if (!doc) return;
  window.openConfirmModal({
    icon: "bi-trash3", title: "Delete Case Document?",
    body: `Delete <strong>"${escHtml(doc.name)}"</strong> permanently from this case and Google Drive?`,
    confirmText: "Delete Document", confirmStyle: "btn-danger",
    onConfirm: async () => {
      showToast("Deleting file...");
      if (doc.driveFileId && typeof deleteDriveFile === "function") await deleteDriveFile(doc.driveFileId);
      const updDocs = docs.filter((_, i) => i !== idx);
      await dbUpdateCase(selCase.id, { documents: updDocs });
      selCase = { ...selCase, documents: updDocs };
      renderCaseDetail();
      showToast("Document deleted successfully!");
    }
  });
}

// ── SIDEBAR CHIP, QUICK ACCESS & HELPERS (SUPERDEV STEALTH) ──
function renderQuickAccess() {
  const qa = document.getElementById("quick-access");
  const ql = document.getElementById("quick-list");
  if (!qa || !ql) return;
  const u = window._currentUser || window._auth?.currentUser;
  const myProf = u ? profiles.find(p => (p.ownerUid && p.ownerUid === u.uid) || (p.email && p.email.toLowerCase() === (u.email || "").toLowerCase())) : null;
  const isDeveloper = myProf && myProf.role === "developer";
  const isSuperDev = myProf && myProf.role === "superdev";

  const visible = isDeveloper
    ? profiles.filter(p => p.role === "developer")
    : (isSuperDev ? profiles : profiles.filter(p => p.role !== "developer" && p.role !== "superdev"));

  if (visible.length === 0) { qa.style.display = "none"; return; }
  qa.style.display = "block";
  ql.innerHTML = visible.slice(0, 7).map(p => `<button class="nav-btn ${selProfile?.id === p.id ? 'active' : ''}" onclick="openProfile('${p.id}')">${avatarDiv(p.name, p.avatarColor, 24, p.photoUrl)}<span>${escHtml(p.name)}</span></button>`).join("");
}

function openProfile(id) { selProfile = profiles.find(p => p.id === id); if (!selProfile) return; showView("profileDetail"); renderProfileDetail(); }
function openCase(id) { caseDetailOrigin = currentView; selCase = cases.find(c => c.id === id); if (!selCase) return; const p = profiles.find(x => x.id === selCase.profileId); if (p) selProfile = p; showView("caseDetail"); renderCaseDetail(); }
window.openProfile = openProfile;
window.openCase = openCase;

function renderSidebarUser() {
  const chip = document.getElementById("sidebar-user-chip");
  const adminSection = document.getElementById("admin-sidebar-section");
  const u = window._currentUser || window._auth?.currentUser;
  if (!u) {
    if (chip) chip.style.display = "none";
    if (adminSection) adminSection.style.display = "none";
    return;
  }

  const userEmail = (u.email || "").toLowerCase();
  const myProf = profiles.find(p => (p.ownerUid && p.ownerUid === u.uid) || (p.email && p.email.toLowerCase() === userEmail));
  const displayName = myProf?.name || u.displayName || u.email?.split("@")[0] || "Counsel";
  const displayRole = myProf?.role === "superdev" ? "Developer Admin" : (myProf?.role || "Attorney");

  if (chip) {
    chip.innerHTML = `
      ${avatarDiv(displayName, myProf?.avatarColor || "#c9a84c", 30, myProf?.photoUrl || u.photoURL || null)}
      <div class="user-meta" style="min-width:0;flex:1">
        <div style="font-size:12px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(displayName)}</div>
        <div style="font-size:10px;color:var(--gold);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(displayRole)}</div>
      </div>`;
    chip.style.display = "flex";
    chip.setAttribute("data-tooltip", `${displayName} · Profile Settings`);
  }

  const isAdmin = (myProf && (myProf.role === "admin" || myProf.role === "superdev")) || (typeof ADMIN_EMAILS !== "undefined" && ADMIN_EMAILS.some(e => e.toLowerCase() === userEmail));
  const isDev = myProf && myProf.role === "developer";
  if (adminSection) adminSection.style.display = (isAdmin || isDev) ? "block" : "none";
}
window.renderSidebarUser = renderSidebarUser;

function openCurrentProfile() { if (selProfile) openProfile(selProfile.id); }
window.openCurrentProfile = openCurrentProfile;

function sortCasesByDue(arr, dir) {
  if (dir === "none") return arr;
  return [...arr].sort((a, b) => {
    const da = (a.dueDate || a.docDueDate) ? new Date(a.dueDate || a.docDueDate) : null;
    const db = (b.dueDate || b.docDueDate) ? new Date(b.dueDate || b.docDueDate) : null;
    if (!da && !db) return 0; if (!da) return 1; if (!db) return -1;
    return dir === "asc" ? da - db : db - da;
  });
}

function dueBadge(dueDate) {
  if (!dueDate) return '<span style="font-size:11px;color:var(--text-dim)">No due date</span>';
  const days = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
  const formatted = formatDate(dueDate);
  if (days < 0) return `<span style="font-size:11px;font-weight:700;color:var(--red)">Overdue (${formatted})</span>`;
  if (days === 0) return `<span style="font-size:11px;font-weight:700;color:var(--red)">Due today</span>`;
  if (days <= 7) return `<span style="font-size:11px;font-weight:700;color:var(--amber)">${days}d left (${formatted})</span>`;
  if (days <= 30) return `<span style="font-size:11px;font-weight:600;color:var(--gold)">${days}d (${formatted})</span>`;
  return `<span style="font-size:11px;color:var(--text-muted)">Due ${formatted}</span>`;
}

function updateAllFilterDropdowns() {
  ["pd", "ac"].forEach(prefix => {
    const statusSel = document.getElementById(prefix + "-status");
    const catSel = document.getElementById(prefix + "-category");
    if (!statusSel || !catSel) return;
    const curStatus = statusSel.value; const curCat = catSel.value;
    statusSel.innerHTML = `<option value="All">All Statuses</option>` + STATUS_OPTIONS.map(s => `<option value="${s}">${s}</option>`).join("");
    statusSel.value = curStatus || "All";
    catSel.innerHTML = `<option value="All">All Categories</option>` + CASE_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("");
    catSel.value = curCat || "All";
    refreshFilterTypes(prefix);
  });
}

function refreshFilterTypes(prefix) {
  const catSel = document.getElementById(prefix + "-category");
  const typeSel = document.getElementById(prefix + "-type");
  if (!catSel || !typeSel) return;
  const selectedCat = catSel.value; const curType = typeSel.value;
  const filteredTypes = selectedCat === "All" ? globalCaseTypes.map(t => t.name) : globalCaseTypes.filter(t => t.category === selectedCat).map(t => t.name);
  const distinctTypes = [...new Set(filteredTypes)].sort();
  typeSel.innerHTML = `<option value="All">All Types</option>` + distinctTypes.map(t => `<option value="${t}">${t}</option>`).join("");
  typeSel.value = distinctTypes.includes(curType) ? curType : "All";
}

function onFilterCategoryChange(prefix) {
  refreshFilterTypes(prefix);
  if (prefix === "pd") renderProfileCases();
  if (prefix === "ac") { currentAllCasesPage = 1; renderAllCases(); }
}
window.updateAllFilterDropdowns = updateAllFilterDropdowns;
window.refreshFilterTypes = refreshFilterTypes;
window.onFilterCategoryChange = onFilterCategoryChange;

// ── SEPARATED PROFILE SETTINGS (Name, Number, Pfp, Description) ──
let settingsPhotoDataUrl = null;

function renderMyProfile() {
  const u = window._currentUser || window._auth?.currentUser;
  if (!u) return;
  const userEmail = (u.email || "").toLowerCase();
  const myProf = profiles.find(p => (p.ownerUid && p.ownerUid === u.uid) || (p.email && p.email.toLowerCase() === userEmail));
  if (!myProf) return;

  setElVal("setting-name", myProf.name || "");
  setElVal("setting-role", myProf.role === "superdev" ? "Developer Admin" : (myProf.role || "Attorney"));
  setElVal("setting-contact", myProf.contact || "");
  setElVal("setting-description", myProf.description || "");

  settingsPhotoDataUrl = myProf.photoUrl || null;
  if (settingsPhotoDataUrl) showSettingsPhotoPreview(settingsPhotoDataUrl, myProf.name, myProf.role);
  else resetSettingsPhotoUpload();
}
window.renderMyProfile = renderMyProfile;

// ── SETTINGS ACCORDIONS (Accessibility, Sounds, Security & Update Credentials) ──
function renderSettingsView() {
  initAccessibilityAndSounds();
  const u = window._currentUser || window._auth?.currentUser;
  if (!u) return;
  const userEmail = (u.email || "").toLowerCase();
  const myProf = profiles.find(p => (p.ownerUid && p.ownerUid === u.uid) || (p.email && p.email.toLowerCase() === userEmail));

  setElVal("setting-email", u.email || "");
  setElVal("setting-password", "");
  setElVal("setting-confirm-password", "");
  setElVal("setting-current-password", "");

  const statusEl = document.getElementById("settings-drive-status");
  const btn = document.getElementById("settings-connect-drive-btn");
  const btnText = document.getElementById("settings-connect-drive-text");
  const disconnectBtn = document.getElementById("settings-disconnect-drive-btn");

  if (statusEl && btn && btnText) {
    if (hasValidToken()) {
      statusEl.className = "drive-status-chip connected";
      statusEl.innerHTML = `<i class="bi bi-check-circle-fill" style="color:var(--green)"></i> Connected`;
      btnText.textContent = "✓ Connected"; btn.classList.add("connected"); btn.disabled = true;
      if (disconnectBtn) disconnectBtn.classList.remove("hidden");
    } else {
      statusEl.className = "drive-status-chip disconnected";
      statusEl.innerHTML = `<i class="bi bi-circle-fill" style="color:var(--amber)"></i> Not Connected`;
      btnText.textContent = "Connect Google Account"; btn.classList.remove("connected"); btn.disabled = false;
      if (disconnectBtn) disconnectBtn.classList.add("hidden");
    }
  }

  const tfaBadge = document.getElementById("setting-2fa-status-badge");
  const tfaBtn = document.getElementById("setting-2fa-action-btn");
  const tfaBackupWrap = document.getElementById("setting-2fa-backup-wrap");
  if (tfaBadge && tfaBtn && myProf) {
    if (myProf.twoFactorEnabled) {
      tfaBadge.className = "badge"; tfaBadge.style.background = "var(--green-bg)"; tfaBadge.style.color = "var(--green)";
      tfaBadge.innerHTML = `<i class="bi bi-shield-check"></i> 2FA Active`;
      tfaBtn.className = "btn btn-danger btn-sm"; tfaBtn.innerHTML = `<i class="bi bi-shield-x"></i> Disable 2FA`;
      tfaBtn.onclick = disableTwoFactor;
      if (tfaBackupWrap) tfaBackupWrap.style.display = "block";
    } else {
      tfaBadge.className = "badge"; tfaBadge.style.background = "var(--amber-bg)"; tfaBadge.style.color = "var(--amber)";
      tfaBadge.innerHTML = `<i class="bi bi-circle-fill" style="font-size:8px"></i> Not Configured`;
      tfaBtn.className = "btn btn-primary btn-sm"; tfaBtn.innerHTML = `<i class="bi bi-qr-code-scan"></i> Configure Authenticator`;
      tfaBtn.onclick = openTwoFactorSetupModal;
      if (tfaBackupWrap) tfaBackupWrap.style.display = "none";
    }
  }
}
window.renderSettingsView = renderSettingsView;

async function connectDriveFromSettings() {
  const btn = document.getElementById("settings-connect-drive-btn");
  const btnText = document.getElementById("settings-connect-drive-text");
  if (!btn) return;
  btn.disabled = true; if (btnText) btnText.textContent = "Connecting...";
  try {
    await promptDriveAuth(true);
    showToast("Google Drive connected successfully!");
    renderSettingsView(); updateWorkspaceStatus(false);
    const u = window._currentUser || window._auth?.currentUser;
    const myProf = u ? profiles.find(p => (p.ownerUid && p.ownerUid === u.uid) || (p.email && p.email.toLowerCase() === (u.email || "").toLowerCase())) : null;
    if (myProf && !myProf.driveFolderId) {
      const folderId = await createDriveFolder(`Simando Law — ${myProf.name}`, DRIVE_FOLDER_ID || null);
      if (folderId && typeof dbUpdateProfile === "function") {
        await dbUpdateProfile(myProf.id, { driveFolderId: folderId });
        myProf.driveFolderId = folderId;
        updateWorkspaceStatus(false);
      }
    }
  } catch (err) {
    if (btnText) btnText.textContent = "Connect Google Account";
    btn.disabled = false;
    showToast("Drive connection failed: " + err.message, "error");
  }
}
window.connectDriveFromSettings = connectDriveFromSettings;

function showSettingsPhotoPreview(url, name, role) {
  const dz = document.getElementById("setting-photo-dropzone");
  const wrap = document.getElementById("setting-photo-preview-wrap");
  const img = document.getElementById("setting-photo-preview-img");
  if (dz) dz.style.display = "none";
  if (wrap) wrap.style.display = "flex";
  if (img) img.src = url;
  setElText("setting-name-preview", name || "Attorney Name");
  setElText("setting-role-preview", role || "Attorney");
}
function resetSettingsPhotoUpload() {
  const dz = document.getElementById("setting-photo-dropzone");
  const wrap = document.getElementById("setting-photo-preview-wrap");
  const inp = document.getElementById("setting-photo-input");
  if (dz) dz.style.display = "block"; if (wrap) wrap.style.display = "none"; if (inp) inp.value = "";
  settingsPhotoDataUrl = null;
}
function handleSettingsPhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast("Photo must be under 2MB", "error"); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    settingsPhotoDataUrl = e.target.result;
    showSettingsPhotoPreview(settingsPhotoDataUrl, document.getElementById("setting-name")?.value, document.getElementById("setting-role")?.value);
  };
  reader.readAsDataURL(file);
}
function removeSettingsPhoto() { resetSettingsPhotoUpload(); }
window.handleSettingsPhotoUpload = handleSettingsPhotoUpload;
window.removeSettingsPhoto = removeSettingsPhoto;

async function saveUserSettings() {
  const u = window._currentUser || window._auth?.currentUser;
  if (!u) return;
  const myProf = profiles.find(p => (p.ownerUid && p.ownerUid === u.uid) || (p.email && p.email.toLowerCase() === (u.email || "").toLowerCase()));
  if (!myProf) return;

  const name = (document.getElementById("setting-name")?.value || "").trim();
  const contact = (document.getElementById("setting-contact")?.value || "").trim();
  const description = (document.getElementById("setting-description")?.value || "").trim();
  const role = (document.getElementById("setting-role")?.value || myProf.role || "Attorney").trim();

  if (!name) { showToast("Display Name is required.", "error"); return; }
  if (contact && !isValidMobile(contact)) { showToast("Contact number must be exactly 11 digits.", "error"); return; }

  const upd = { name, contact, description, role };
  try {
    showToast("Saving profile settings...");
    if (settingsPhotoDataUrl && settingsPhotoDataUrl.startsWith("data:") && hasValidToken()) {
      if (myProf.photoFileId) await deleteDriveFile(myProf.photoFileId).catch(() => {});
      const { fileId, thumbnailUrl } = await uploadProfilePhotoToDrive(settingsPhotoDataUrl, myProf.driveFolderId || null, name);
      upd.photoFileId = fileId; upd.photoUrl = thumbnailUrl;
    } else if (!settingsPhotoDataUrl && myProf.photoFileId) {
      if (hasValidToken()) await deleteDriveFile(myProf.photoFileId).catch(() => {});
      upd.photoFileId = null; upd.photoUrl = null;
    }
    await dbUpdateProfile(myProf.id, upd);
    if (typeof window._fbUpdateProfile === "function") await window._fbUpdateProfile(u, { displayName: name, photoURL: upd.photoUrl || null });
    selProfile = { ...myProf, ...upd };
    showToast("Profile settings updated!");
    renderMyProfile(); renderSidebarUser(); updateWorkspaceStatus(false);
  } catch (err) {
    showToast("Failed to save profile settings: " + err.message, "error");
  }
}

// ── FIXED UPDATE CREDENTIALS (ALWAYS-VISIBLE CURRENT PASSWORD + CONFIRM) ──
async function saveSecuritySettings() {
  const u = window._currentUser || window._auth?.currentUser;
  if (!u) return;

  const currentPass = document.getElementById("setting-current-password")?.value || "";
  const email = (document.getElementById("setting-email")?.value || "").trim();
  const pass = document.getElementById("setting-password")?.value || "";
  const confirmPass = document.getElementById("setting-confirm-password")?.value || "";

  if (!email) { showToast("Sign-In Email is required.", "error"); return; }
  if (!isValidEmail(email)) { showToast("Email must be @gmail.com, @outlook.com, or @yahoo.com.", "error"); return; }

  const emailChanged = email.toLowerCase() !== (u.email || "").toLowerCase();
  if (!emailChanged && !pass) { showToast("No email or password changes entered."); return; }

  if (pass) {
    if (pass.length < 6) { showToast("New password must be at least 6 characters.", "error"); return; }
    if (confirmPass !== pass) { showToast("New password and confirmation do not match.", "error"); return; }
  }

  if (!currentPass) {
    showToast("Enter your Current Password to verify identity before updating credentials.", "error");
    document.getElementById("setting-current-password")?.focus();
    return;
  }

  try {
    showToast("Verifying credentials...");
    await window._fbReauth(u, window._fbEmailCred(u.email, currentPass));
    if (emailChanged) {
      await window._fbUpdateEmail(u, email);
      const myProf = profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === (u.email || "").toLowerCase()));
      if (myProf) await dbUpdateProfile(myProf.id, { email });
    }
    if (pass) await window._fbUpdatePassword(u, pass);
    showToast("Credentials updated successfully!");
    setElVal("setting-current-password", "");
    setElVal("setting-password", "");
    setElVal("setting-confirm-password", "");
    document.getElementById("password-requirements").style.display = "none";
  } catch (err) {
    showToast("Credential update failed: " + err.message, "error");
  }
}
window.saveUserSettings = saveUserSettings;
window.saveSecuritySettings = saveSecuritySettings;

async function handleLogout() {
  try {
    if (typeof dbUnsubscribe === "function") dbUnsubscribe();
    if (window._fbSignOut) {
      sessionStorage.removeItem("simando_2fa_verified");
      await window._fbSignOut(window._auth);
      window.location.replace("login.html");
    }
  } catch (err) {}
}
window.handleLogout = handleLogout;

function escHtml(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function parseGoogleDateTime(isoString) {
  if (!isoString) return { dateStr: "", timeStr: "", dateObj: new Date(), isAllDay: false };
  if (isoString.length === 10 && !isoString.includes("T")) {
    const [y, m, d] = isoString.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    return { dateStr: dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), timeStr: "All Day", dateObj, isAllDay: true };
  }
  const d = new Date(isoString);
  return { dateStr: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), timeStr: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }), dateObj: d, isAllDay: false };
}

window.openCalendarEventModal = function(index) {
  const ev = window._fetchedCalendarEvents?.[index];
  if (!ev) return;
  const modal = document.getElementById("calendar-event-modal");
  if (!modal) return;
  const parsedStart = parseGoogleDateTime(ev.start.dateTime || ev.start.date);
  setElText("cem-title", ev.summary || "No Title");
  setElText("cem-time", parsedStart.dateStr + (parsedStart.isAllDay ? " (All Day)" : ` · ${parsedStart.timeStr}`));
  setElText("cem-location", ev.location || "No venue specified");
  setElText("cem-desc", ev.description || "No description provided.");
  const linkEl = document.getElementById("cem-link");
  if (linkEl) { linkEl.href = ev.htmlLink || "#"; linkEl.style.display = ev.htmlLink ? "inline-flex" : "none"; }
  modal.classList.remove("hidden");
};
window.closeCalendarModal = () => document.getElementById("calendar-event-modal")?.classList.add("hidden");

// ── DASHBOARD UPCOMING SCHEDULE ──────────────────────────────
let activeDashboardAgendaFilter = "all";
let dashSchedulePage = 1;
const dashSchedulePageSize = 5;

window.filterDashboardAgenda = (type) => { activeDashboardAgendaFilter = type; dashSchedulePage = 1; renderDashboardCalendarAgenda(); };
window.changeDashSchedulePage = (delta) => { dashSchedulePage += delta; renderDashboardCalendarAgenda(); };

async function renderDashboardCalendarAgenda() {
  const card = document.getElementById("dash-calendar-card");
  if (!card) return;
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const accessibleCases = typeof getAccessibleCases === "function" ? getAccessibleCases() : (cases || []);
  const acceptedAppts = (appointments || []).filter(a => a.status === "accepted" && a.date >= todayStr);
  const agendaItems = [];

  accessibleCases.forEach(c => {
    (c.hearings || []).forEach(h => {
      if (h.date && h.date >= todayStr) agendaItems.push({ id: c.id, type: "hearing", date: h.date, time: h.time || "08:30 AM", title: h.purpose || "Court Hearing", sub: `${c.title} · ${c.venue || "Courtroom"}`, isCase: true, caseId: c.id });
    });
    (c.deadlines || []).forEach(d => {
      if (d.date && d.date >= todayStr) agendaItems.push({ id: c.id, type: "deadline", date: d.date, time: "Filing Deadline", title: d.subtype || d.title || "Formal Pleading", sub: c.title, isCase: true, caseId: c.id });
    });
  });

  acceptedAppts.forEach(a => {
    agendaItems.push({ id: a.id, type: a.type === "busy" ? "busy" : "appt", date: a.date, time: a.time || "All Day", title: a.title || "Appearance", sub: a.venue || a.description || "Firm Schedule", isCase: Boolean(a.caseId), caseId: a.caseId || null });
  });

  if (hasValidToken()) {
    try {
      const todayFilter = new Date(); todayFilter.setHours(0, 0, 0, 0);
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(todayFilter.toISOString())}&singleEvents=true&orderBy=startTime&maxResults=8`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (res.ok) {
        const gItems = (await res.json()).items || [];
        window._fetchedCalendarEvents = gItems;
        gItems.forEach((ev, idx) => {
          const parsed = parseGoogleDateTime(ev.start.dateTime || ev.start.date);
          agendaItems.push({ id: `g_${idx}`, type: "google", date: parsed.dateObj.toISOString().split("T")[0], time: parsed.isAllDay ? "All Day" : parsed.timeStr, title: ev.summary || "Google Event", sub: ev.location || "Google Calendar", isCase: false, googleIdx: idx });
        });
      }
    } catch (e) {}
  }

  agendaItems.sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : (a.time || "").localeCompare(b.time || ""));
  const totalHearings = agendaItems.filter(i => i.type === "hearing").length;
  const totalDeadlines = agendaItems.filter(i => i.type === "deadline").length;
  const filtered = activeDashboardAgendaFilter === "all" ? agendaItems : agendaItems.filter(i => i.type === activeDashboardAgendaFilter);
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / dashSchedulePageSize));
  if (dashSchedulePage > totalPages) dashSchedulePage = totalPages;
  if (dashSchedulePage < 1) dashSchedulePage = 1;
  const startIdx = (dashSchedulePage - 1) * dashSchedulePageSize;
  const paged = filtered.slice(startIdx, startIdx + dashSchedulePageSize);
  const dayNames = ["SUN","MON","TUE","WED","THU","FRI","SAT"];

  const rowsHtml = paged.length === 0
    ? `<div class="empty-state" style="padding:36px 16px"><div class="empty-state-icon" style="color:var(--gold);font-size:32px"><i class="bi bi-calendar-check"></i></div><div>No upcoming hearings or deadlines.</div></div>`
    : paged.map(item => {
      const [y, m, d] = item.date.split("-").map(Number);
      const dObj = new Date(y, m - 1, d);
      let boxStyle = "background:var(--gold-dim);border:1px solid var(--gold-border);color:var(--gold-light);";
      let labelColor = "var(--gold-light)";
      let kindLabel = `Court Hearing · ${escHtml(item.time)}`;
      if (item.type === "deadline") { boxStyle = "background:var(--violet-bg);border:1px solid rgba(129,140,248,0.35);color:var(--violet);"; labelColor = "var(--amber)"; kindLabel = "Filing Deadline"; }
      else if (item.type === "google") { boxStyle = "background:var(--green-bg);border:1px solid rgba(52,211,153,0.35);color:var(--green);"; labelColor = "var(--green)"; kindLabel = `Google Calendar · ${escHtml(item.time)}`; }
      else if (item.type === "busy") { boxStyle = "background:var(--red-bg);border:1px solid rgba(248,113,113,0.35);color:var(--red);"; labelColor = "var(--red)"; kindLabel = `Out of Office · ${escHtml(item.time)}`; }
      const clickAttr = item.isCase && item.caseId ? `onclick="openCase('${item.caseId}')"` : (item.type === "google" ? `onclick="openCalendarEventModal(${item.googleIdx})"` : `onclick="navTo('calendar')"`);

      return `
        <button class="case-item" ${clickAttr}>
          <div style="text-align:center;border-radius:7px;padding:4px 7px;min-width:40px;flex-shrink:0;${boxStyle}">
            <div style="font-size:8.5px;font-weight:700;line-height:1.1">${dayNames[dObj.getDay()]}</div>
            <div style="font-size:13.5px;font-weight:800;line-height:1.15">${dObj.getDate()}</div>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:10.5px;font-weight:700;color:${labelColor}">${kindLabel}</div>
            <div style="font-size:12.5px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(item.title)}</div>
            <div style="font-size:11px;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(item.sub)}</div>
          </div>
        </button>`;
    }).join("");

  const endIdx = Math.min(startIdx + dashSchedulePageSize, total);
  card.innerHTML = `
    <div class="dash-panel-header">
      <div style="font-size:15px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:8px"><i class="bi bi-calendar3" style="color:var(--gold)"></i> Upcoming Schedule</div>
      <button class="btn btn-secondary btn-sm" onclick="navTo('calendar')">Full Calendar →</button>
    </div>
    <div class="dash-panel-pills">
      <button class="pill-tab ${activeDashboardAgendaFilter === 'all' ? 'active' : ''}" onclick="filterDashboardAgenda('all')">All (${agendaItems.length})</button>
      <button class="pill-tab ${activeDashboardAgendaFilter === 'hearing' ? 'active' : ''}" onclick="filterDashboardAgenda('hearing')">Court Hearings (${totalHearings})</button>
      <button class="pill-tab ${activeDashboardAgendaFilter === 'deadline' ? 'active' : ''}" onclick="filterDashboardAgenda('deadline')">Deadlines (${totalDeadlines})</button>
    </div>
    <div class="dash-panel-list">${rowsHtml}</div>
    <div class="pagination-bar">
      <span>${total ? `Showing ${startIdx + 1}–${endIdx} of ${total}` : '0 items'}</span>
      ${totalPages > 1 ? `<div class="pagination-controls"><button class="page-btn" onclick="changeDashSchedulePage(-1)" ${dashSchedulePage <= 1 ? 'disabled' : ''}><i class="bi bi-chevron-left"></i></button><span style="padding:0 6px;font-weight:600">Page ${dashSchedulePage} of ${totalPages}</span><button class="page-btn" onclick="changeDashSchedulePage(1)" ${dashSchedulePage >= totalPages ? 'disabled' : ''}><i class="bi bi-chevron-right"></i></button></div>` : `<span>All items shown</span>`}
    </div>`;
}
window.renderDashboardCalendarAgenda = renderDashboardCalendarAgenda;
window.fetchAndRenderGoogleCalendarEvents = renderDashboardCalendarAgenda;

// ── NOTIFICATIONS CENTER ─────────────────────────────────────
let currentNotifFilter = "all";
window.filterNotifications = (cat) => { currentNotifFilter = cat; renderNotificationsView(); };

window.toggleNotifDropdown = function() {
  const dropdown = document.getElementById("notif-dropdown");
  if (!dropdown) return;
  const willOpen = dropdown.classList.contains("hidden");
  window.closeAllTopPopovers();
  if (willOpen) {
    dropdown.classList.remove("hidden");
    document.getElementById("chat-panel")?.classList.add("hidden");
    document.body.classList.remove("chat-open");
    renderNotificationsView();
  }
};

function updateNotificationBadge() {
  const badgeEl = document.getElementById("global-notif-badge");
  if (!badgeEl) return;
  const unreadCount = notifications.filter(n => n.status === "unread").length;
  badgeEl.textContent = unreadCount;
  badgeEl.style.display = unreadCount > 0 ? "inline-flex" : "none";
}
window.updateNotificationBadge = updateNotificationBadge;

window.handleNotifClick = async function(notifId, type, relatedId, fromUid, fromName) {
  if (notifId) markNotificationRead(notifId);
  document.getElementById("notif-dropdown")?.classList.add("hidden");
  if ((type === "case_due" || type === "case_share") && relatedId) openCase(relatedId);
  else if (type === "appointment_request") {
    const notif = notifications.find(n => n.id === notifId);
    window.openProposalReviewModal(notif?.caseId || relatedId, notif?.relatedId || relatedId, notifId, false, "");
  } else if ((type === "availability_request" || type === "availability_confirmed") && window._chat) {
    window._chat.toggleDock();
    if (fromUid) window._chat.openConversation(fromUid, fromName || "Attorney", false);
  }
};

function renderNotificationsView() {
  const listEl = document.getElementById("notifications-list");
  if (!listEl) return;
  const filtered = currentNotifFilter === "all" ? notifications
    : (currentNotifFilter === "appt" ? notifications.filter(n => n.type === "appointment_request" || n.type === "availability_request")
    : notifications.filter(n => n.category === currentNotifFilter));

  const tabsHtml = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;padding-bottom:10px;margin-bottom:8px;border-bottom:1px solid var(--border)">
      <button onclick="event.stopPropagation();filterNotifications('all')" class="pill-tab ${currentNotifFilter==='all'?'active':''}" style="justify-content:center">All (${notifications.length})</button>
      <button onclick="event.stopPropagation();filterNotifications('deadline')" class="pill-tab ${currentNotifFilter==='deadline'?'active':''}" style="justify-content:center">Deadlines</button>
      <button onclick="event.stopPropagation();filterNotifications('hearing')" class="pill-tab ${currentNotifFilter==='hearing'?'active':''}" style="justify-content:center">Hearings</button>
      <button onclick="event.stopPropagation();filterNotifications('appt')" class="pill-tab ${currentNotifFilter==='appt'?'active':''}" style="justify-content:center">Proposals</button>
    </div>`;

  if (filtered.length === 0) { listEl.innerHTML = tabsHtml + `<div class="empty-state" style="padding:20px"><div style="font-size:12px">No notifications found.</div></div>`; return; }
  listEl.innerHTML = tabsHtml + filtered.map(n => `
    <div class="doc-item" onclick="handleNotifClick('${n.id}','${n.type}','${n.relatedId}','${n.fromUid}','${escHtml(n.fromName)}')" style="border-left:3.5px solid ${n.status==='unread'?'var(--gold)':'var(--border)'};cursor:pointer;padding:10px 12px;font-size:12px">
      <div style="flex:1;min-width:0"><div style="font-weight:700;color:var(--text)">${escHtml(n.title)}</div><div style="font-size:11.5px;color:var(--text-muted)">${escHtml(n.message)}</div></div>
      ${n.status==='unread' ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();markNotificationRead('${n.id}')">Read</button>` : ""}
    </div>`).join("");
}
window.renderNotificationsView = renderNotificationsView;

window.markNotificationRead = async (id) => {
  const notif = notifications.find(n => n.id === id);
  if (notif) { notif.status = "read"; updateNotificationBadge(); renderNotificationsView(); }
  await dbUpdateNotification(id, { status: "read" }).catch(() => {});
};
window.markAllNotificationsAsRead = async () => {
  notifications.forEach(n => { n.status = "read"; });
  updateNotificationBadge(); renderNotificationsView();
  for (const n of notifications) await dbUpdateNotification(n.id, { status: "read" }).catch(() => {});
  showToast("All notifications cleared!");
};

// ── PROPOSAL DOSSIER & APPOINTMENT MODALS ────────────────────
let currentDossierContext = { caseId: null, apptId: null, notifId: null, msgId: null, isGroup: false, channelId: "" };

window.openProposalReviewModal = async function(caseId, apptId, notifId, isGroup = false, channelId = "", chatMsgObj = null) {
  currentDossierContext = { caseId, apptId, notifId, msgId: notifId, isGroup, channelId };
  const modal = document.getElementById("proposal-review-modal");
  if (!modal) return;
  const u = window._currentUser || window._auth?.currentUser;
  const currentUid = u?.uid || "";
  const appt = appointments.find(a => a.id === apptId) || null;
  const notif = notifications.find(n => n.id === notifId) || null;
  let targetCase = cases.find(c => c.id === caseId);
  if (!targetCase && caseId && window._db && typeof window._fbGetDoc === "function") {
    try {
      const snap = await window._fbGetDoc(window._fbDoc(window._db, "cases", caseId));
      if (snap?.exists()) targetCase = await decryptCaseRecordFromFirestore({ id: snap.id, ...snap.data() });
    } catch (e) {}
  }

  setElText("pr-case-title", targetCase?.title || chatMsgObj?.caseTitle || appt?.caseTitle || notif?.caseTitle || "Case Title");
  setElText("pr-case-docket", targetCase?.caseNumber || chatMsgObj?.caseNumber || appt?.caseNumber || "Docket N/A");
  setElText("pr-case-cat", targetCase?.category || chatMsgObj?.caseCategory || "Case");
  setElText("pr-case-parties", targetCase?.parties || chatMsgObj?.caseParties || "N/A");
  setElText("pr-case-venue", targetCase?.venue || chatMsgObj?.caseVenue || appt?.venue || "Courtroom N/A");
  setElText("pr-case-narrative", targetCase?.narrative || chatMsgObj?.caseNarrative || appt?.description || notif?.message || "No briefing.");
  const docs = targetCase?.documents || chatMsgObj?.documents || appt?.documents || [];
  setElText("pr-vault-count", docs.length);
  const isAccepted = (appt && appt.status === "accepted") || (targetCase && (targetCase.ownerUid === currentUid || (targetCase.allowedUids || []).includes(currentUid)));
  const vaultListEl = document.getElementById("pr-vault-files-list");
  if (vaultListEl) {
    vaultListEl.innerHTML = docs.length === 0 ? `<div style="font-size:12px;color:var(--text-dim)">No documents attached.</div>`
      : docs.map(d => isAccepted
        ? `<div style="padding:8px;background:var(--surface);border-radius:6px;margin-bottom:4px"><span onclick='openFilePreview(${JSON.stringify(d).replace(/'/g,"&#39;")})' style="cursor:pointer;color:var(--gold);text-decoration:underline">${escHtml(d.name)}</span></div>`
        : `<div style="padding:8px;background:var(--surface);border-radius:6px;filter:blur(3px);margin-bottom:4px">${escHtml(d.name)}</div>`).join("");
  }
  modal.classList.remove("hidden");
};
window.closeProposalReviewModal = () => document.getElementById("proposal-review-modal")?.classList.add("hidden");
window.acceptProposalFromDossier = async () => {
  const { apptId, notifId, msgId, isGroup, channelId } = currentDossierContext;
  if (apptId) await dbUpdateAppointment(apptId, { status: "accepted" }).catch(() => {});
  if (notifId) await dbUpdateNotification(notifId, { appointmentStatus: "accepted", status: "read" }).catch(() => {});
  if (window._chat && msgId) await window._chat.respondAvailCard(msgId, isGroup, channelId, "accepted");
  closeProposalReviewModal(); renderAllCases(); renderDashboard();
};
window.declineProposalFromDossier = async () => {
  const { apptId, notifId, msgId, isGroup, channelId } = currentDossierContext;
  if (apptId) await dbUpdateAppointment(apptId, { status: "declined" }).catch(() => {});
  if (notifId) await dbUpdateNotification(notifId, { appointmentStatus: "declined", status: "read" }).catch(() => {});
  if (window._chat && msgId) await window._chat.respondAvailCard(msgId, isGroup, channelId, "declined");
  closeProposalReviewModal();
};

let targetApptProfile = null, apptAmPm = "AM", apptPurposeType = "present_hearing";
window.openAppointmentModal = function(profileId) {
  const p = profiles.find(x => x.id === profileId || x.ownerUid === profileId) || selProfile;
  if (!p) return;
  targetApptProfile = p;
  document.getElementById("appt-recipient-avatar").innerHTML = avatarDiv(p.name, p.avatarColor, 36, p.photoUrl);
  setElText("appt-recipient-name", p.name);
  setElText("appt-recipient-role", p.role || "Associate Counsel");
  const accessible = getAccessibleCases();
  document.getElementById("appt-case-select").innerHTML = `<option value="">— Select an active docket file (${accessible.length}) —</option>` + accessible.map(c => `<option value="${c.id}">${escHtml(c.title)}</option>`).join("");
  document.getElementById("appointment-modal")?.classList.remove("hidden");
};
window.closeAppointmentModal = () => { document.getElementById("appointment-modal")?.classList.add("hidden"); targetApptProfile = null; };
window.setApptPurpose = (btn, type) => { apptPurposeType = type; document.querySelectorAll("#appt-purpose-chips button").forEach(b => b.classList.remove("active")); btn.classList.add("active"); };
window.onApptCaseSelectChange = (caseId) => { const c = getAccessibleCases().find(x => x.id === caseId); if (c) setElVal("appt-venue", c.venue || ""); };
window.onApptHearingStageSync = () => {};
window.setApptAmPm = (val) => { apptAmPm = val; };
window.submitAppointmentRequest = async () => {
  const date = document.getElementById("appt-date")?.value;
  const time = document.getElementById("appt-custom-time")?.value || "08:30";
  if (!date) return showToast("Please pick a date.", "error");
  const u = window._currentUser || window._auth?.currentUser;
  if (!u || !targetApptProfile) return;
  await dbAddAppointment({ title: "Case Appearance Request", date, time: `${time} ${apptAmPm}`, venue: document.getElementById("appt-venue")?.value || "", description: document.getElementById("appt-desc")?.value || "", requesterUid: u.uid, targetUid: targetApptProfile.ownerUid || targetApptProfile.id, ownerUid: u.uid, status: "pending" });
  showToast("Schedule proposal sent!");
  closeAppointmentModal();
};

// ── CASE FORM SELECTS & DRIVE EXPLORER (SUPPORTS GOOGLE DOCS) ──
function populateCaseSelects(isEdit = false) {
  const catSel = document.getElementById("cf-category");
  const statusSel = document.getElementById("cf-status");
  const venueSel = document.getElementById("cf-venue");
  if (catSel) catSel.innerHTML = CASE_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("");
  const opts = isEdit ? STATUS_OPTIONS : (typeof NEW_CASE_STATUS_OPTIONS !== "undefined" ? NEW_CASE_STATUS_OPTIONS : ["On-going", "Pending"]);
  if (statusSel) statusSel.innerHTML = opts.map(t => `<option value="${t}">${t}</option>`).join("");
  if (venueSel) venueSel.innerHTML = VENUES.map(v => `<option value="${v}">${v}</option>`).join("");
}
window.populateCaseSelects = populateCaseSelects;

let currentExplorerFolderId = "root", explorerBreadcrumbs = [];
window.initDriveExplorer = function() {
  const u = window._currentUser || window._auth?.currentUser;
  const myProf = u ? profiles.find(p => (p.ownerUid && p.ownerUid === u.uid) || (p.email && p.email.toLowerCase() === (u.email || "").toLowerCase())) : null;
  currentExplorerFolderId = (myProf && myProf.driveFolderId) ? myProf.driveFolderId : (DRIVE_FOLDER_ID || "root");
  explorerBreadcrumbs = [{ id: currentExplorerFolderId, name: "Firm Drive" }];
  loadExplorerFiles();
};

window.loadExplorerFiles = async function() {
  const listEl = document.getElementById("mydrive-explorer-list");
  const emptyEl = document.getElementById("mydrive-empty-state");
  const nativeBtn = document.getElementById("mydrive-open-native-btn");
  if (!listEl) return;
  renderExplorerBreadcrumbs();
  if (nativeBtn) nativeBtn.href = (currentExplorerFolderId && currentExplorerFolderId !== "root") ? `https://drive.google.com/drive/folders/${currentExplorerFolderId}` : "https://drive.google.com";
  if (!hasValidToken()) {
    listEl.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)"><div style="font-size:28px;color:var(--gold)"><i class="bi bi-cloud-slash"></i></div><div style="font-size:13px;font-weight:600;margin-top:6px">Google Drive Not Connected</div><div style="font-size:11.5px;margin-top:4px">Connect Google Account in Settings or the top Google button.</div></div>`;
    if (emptyEl) emptyEl.classList.add("hidden");
    return;
  }
  try {
    listEl.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px"><span class="spinner"></span></div>`;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${currentExplorerFolderId || "root"}' in parents and trashed = false`)}&fields=files(id,name,mimeType,size,webViewLink)&orderBy=folder,name`, { headers: { Authorization: "Bearer " + accessToken } });
    if (!res.ok) throw new Error("Drive API error");
    const files = (await res.json()).files || [];
    if (files.length === 0) { listEl.innerHTML = ""; if (emptyEl) emptyEl.classList.remove("hidden"); return; }
    if (emptyEl) emptyEl.classList.add("hidden");
    listEl.innerHTML = files.map(f => {
      const isFolder = f.mimeType === "application/vnd.google-apps.folder";
      const isGDoc   = f.mimeType === "application/vnd.google-apps.document";
      const icon = isFolder
        ? `<i class="bi bi-folder-fill" style="color:var(--gold);font-size:32px"></i>`
        : (isGDoc ? `<i class="bi bi-file-earmark-richtext-fill" style="color:var(--gold);font-size:32px"></i>` : `<i class="bi bi-file-earmark-text-fill" style="color:var(--gold);font-size:32px"></i>`);
      const action = isFolder
        ? `onclick="navigateIntoFolder('${f.id}','${f.name.replace(/'/g,"\\'")}')"`
        : (isGDoc ? `onclick="openGoogleDocModal('', '${f.id}')"` : `onclick="window.open('${f.webViewLink}','_blank')"`);
      return `<div style="position:relative;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:16px 10px;text-align:center;cursor:pointer"><div ${action}><div style="margin-bottom:8px">${icon}</div><div style="font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(f.name)}</div></div><button onclick="event.stopPropagation();adminDeleteDriveExplorerFile('${f.id}','${f.name.replace(/'/g,"\\'")}')" style="position:absolute;top:6px;right:6px;color:var(--red);font-size:13px"><i class="bi bi-trash3"></i></button></div>`;
    }).join("");
  } catch (err) {
    listEl.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--text-muted)">Click Open Google Drive above to view files directly.</div>`;
  }
};

window.adminDeleteDriveExplorerFile = (fileId, fileName) => {
  window.openConfirmModal({ icon: "bi-trash3", title: "Delete from Firm Drive?", body: `Delete <strong>"${escHtml(fileName)}"</strong> from Google Drive?`, confirmText: "Delete", confirmStyle: "btn-danger", onConfirm: async () => { await deleteDriveFile(fileId); loadExplorerFiles(); } });
};
window.navigateIntoFolder = (id, name) => { explorerBreadcrumbs.push({ id, name }); currentExplorerFolderId = id; loadExplorerFiles(); };
window.navigateBreadcrumb = (index) => { explorerBreadcrumbs = explorerBreadcrumbs.slice(0, index + 1); currentExplorerFolderId = explorerBreadcrumbs[index].id; loadExplorerFiles(); };
function renderExplorerBreadcrumbs() {
  const el = document.getElementById("mydrive-breadcrumbs");
  if (el) el.innerHTML = explorerBreadcrumbs.map((b, i) => i === explorerBreadcrumbs.length - 1 ? `<span style="color:var(--gold)"><i class="bi bi-folder-fill"></i> ${escHtml(b.name)}</span>` : `<span onclick="navigateBreadcrumb(${i})" style="cursor:pointer;text-decoration:underline">${escHtml(b.name)}</span> / `).join("");
}

window.openFilePreview = function(doc) {
  if (!doc) return;
  if (doc.driveFileId && ((doc.name || "").includes("(Google Doc)") || (doc.driveLink || "").includes("docs.google.com/document"))) {
    openGoogleDocModal(selCase?.id || "", doc.driveFileId);
    return;
  }
  if (doc.driveLink) { window.open(doc.driveLink, "_blank"); return; }
  if (doc._localTempId && typeof pendingLocalFiles !== "undefined" && pendingLocalFiles[doc._localTempId]) {
    window.open(URL.createObjectURL(pendingLocalFiles[doc._localTempId]), "_blank");
    return;
  }
  showToast("File link not found.", "error");
};
window.closeFilePreview = () => { const m = document.getElementById("file-preview-modal"); if (m) m.style.display = "none"; };

window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (typeof renderSidebarUser === "function") renderSidebarUser();
    if (typeof renderGoogleStatusPopover === "function") renderGoogleStatusPopover();
    if (typeof renderOnlineUsersPopover === "function") renderOnlineUsersPopover();
    if (typeof checkOnboardingSecurityStatus === "function") checkOnboardingSecurityStatus();
  }, 300);
});
