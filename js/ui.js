// ═══════════════════════════════════════════════════════════════
//  THEME INITIALIZATION & TOGGLE
// ═══════════════════════════════════════════════════════════════
function initTheme() {
  const saved = localStorage.getItem('simando-theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
    if (typeof updateThemeIcon === "function") updateThemeIcon(saved);
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

window.initTheme = initTheme;
window.toggleTheme = toggleTheme;
window.updateThemeIcon = updateThemeIcon;

// ═══════════════════════════════════════════════════════════════
//  DOM HELPERS & ERROR CLEARING
// ═══════════════════════════════════════════════════════════════
function setElText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
window.setElText = setElText;

function setElVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}
window.setElVal = setElVal;

function clearCaseErrors() {
  ["cf-title-err", "cf-filed-err", "cf-parties-err", "cf-narrative-err", "cf-hearings-err"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });
  ["cf-case-title", "cf-filed", "cf-narrative"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("err");
  });
}
window.clearCaseErrors = clearCaseErrors;

// ═══════════════════════════════════════════════════════════════
//  INTERACTIVE MULTI-DATE AVAILABILITY PICKER (STRICTLY PERSONAL)
// ═══════════════════════════════════════════════════════════════
let selectedBusyDates = new Set();
let modalCalYear = new Date().getFullYear();
let modalCalMonth = new Date().getMonth();

window.openBusyModal = function() {
  const u = window._currentUser || window._auth?.currentUser;
  if (!u) {
    if (typeof showToast === "function") showToast("Please wait for your account to load.", "error");
    return;
  }

  let modal = document.getElementById("busy-modal");
  if (!modal) return;

  selectedBusyDates.clear();
  const now = new Date();
  modalCalYear = now.getFullYear();
  modalCalMonth = now.getMonth();

  renderModalCalendarUI();
  modal.classList.remove("hidden");
};

window.closeBusyModal = function() {
  const modal = document.getElementById("busy-modal");
  if (modal) modal.classList.add("hidden");
  selectedBusyDates.clear();
};

function renderModalCalendarUI() {
  const modal = document.getElementById("busy-modal");
  if (!modal) return;

  modal.innerHTML = `
    <div class="modal-box" style="max-width: 500px; padding: 22px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;border-bottom:1px solid var(--border);padding-bottom:10px">
        <div style="font-size:17px;font-weight:700;color:var(--gold-light);display:flex;align-items:center;gap:8px">
          <i class="bi bi-calendar2-range-fill"></i> Set Personal Schedule
        </div>
        <button onclick="window.closeBusyModal()" style="background:none;border:none;color:var(--text-dim);font-size:18px;cursor:pointer"><i class="bi bi-x-lg"></i></button>
      </div>

      <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px">
        Click dates to toggle your schedule.<br>
        <span style="color:var(--red)"><i class="bi bi-circle-fill" style="font-size:8px"></i> Red</span> = Out of Office / In Court. Click again to clear.
      </div>

      <!-- Quick Preset Buttons -->
      <div style="display:flex;gap:6px;overflow-x:auto;margin-bottom:12px;padding-bottom:4px">
        <button type="button" class="btn btn-secondary btn-sm" onclick="setBusyPreset('⚖️ In Court / Hearing')"><i class="bi bi-bank"></i> In Court</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="setBusyPreset('🚫 Out of Office / Leave')"><i class="bi bi-slash-circle"></i> Out of Office</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="setBusyPreset('🤝 Client Meeting')"><i class="bi bi-people"></i> Consultation</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="setBusyPreset('📝 Hearing Preparation')"><i class="bi bi-pencil-square"></i> Preparation</button>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px">
        <div>
          <label class="field-label">Schedule Label / Activity *</label>
          <input class="field-input" id="busy-title" value="In Court / Out of Office" autocomplete="off"/>
        </div>

        <!-- Interactive Calendar Container -->
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="font-size:13.5px;font-weight:700;color:var(--gold)" id="modal-cal-month-title">Month Year</div>
            <div style="display:flex;gap:4px">
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.prevModalCalMonth()"><i class="bi bi-chevron-left"></i></button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.todayModalCalMonth()">Today</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.nextModalCalMonth()"><i class="bi bi-chevron-right"></i></button>
              <button type="button" class="btn btn-secondary btn-sm" style="color:var(--amber)" onclick="window.resetBusySelection()" title="Reset selected dates"><i class="bi bi-arrow-counterclockwise"></i></button>
            </div>
          </div>

          <div class="cal-grid" id="modal-calendar-grid" style="display:grid !important;grid-template-columns:repeat(7, minmax(0, 1fr)) !important;gap:4px"></div>

          <!-- Removable Date Chips -->
          <div id="modal-busy-chips-wrap" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;padding-top:8px;border-top:1px dashed var(--border);min-height:28px;align-items:center"></div>
        </div>

        <!-- Time Settings -->
        <div style="display:flex;align-items:center;gap:12px">
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text);cursor:pointer">
            <input type="checkbox" id="busy-all-day" checked onchange="window.toggleBusyTimeInputs(this.checked)" style="accent-color:var(--gold)"/> All Day Block
          </label>
        </div>

        <div class="grid2" id="busy-time-container" style="display:none">
          <div>
            <label class="field-label">Start Time</label>
            <input type="time" class="field-input" id="busy-start-time" value="08:30"/>
          </div>
          <div>
            <label class="field-label">End Time</label>
            <input type="time" class="field-input" id="busy-end-time" value="17:00"/>
          </div>
        </div>

        <div>
          <label class="field-label">Description / Venue</label>
          <input class="field-input" id="busy-notes" placeholder="Enter schedule description or venue..."/>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border);padding-top:14px">
        <span style="font-size:11px;color:var(--text-dim)">Saves to your private account</span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost" type="button" onclick="window.closeBusyModal()">Cancel</button>
          <button class="btn btn-primary" type="button" id="busy-submit-btn" onclick="window.submitBusyDates()"><i class="bi bi-check2"></i> Save Schedule</button>
        </div>
      </div>
    </div>
  `;

  renderModalCalendarGrid();
}

window.setBusyPreset = function(text) {
  const inp = document.getElementById("busy-title");
  if (inp) inp.value = text;
};

window.toggleBusyTimeInputs = function(isAllDay) {
  const container = document.getElementById("busy-time-container");
  if (container) container.style.display = isAllDay ? "none" : "grid";
};

window.prevModalCalMonth = function() {
  modalCalMonth--;
  if (modalCalMonth < 0) {
    modalCalMonth = 11;
    modalCalYear--;
  }
  renderModalCalendarGrid();
};

window.nextModalCalMonth = function() {
  modalCalMonth++;
  if (modalCalMonth > 11) {
    modalCalMonth = 0;
    modalCalYear++;
  }
  renderModalCalendarGrid();
};

window.todayModalCalMonth = function() {
  const now = new Date();
  modalCalYear = now.getFullYear();
  modalCalMonth = now.getMonth();
  renderModalCalendarGrid();
};

window.resetBusySelection = function() {
  selectedBusyDates.clear();
  renderModalCalendarGrid();
};

window.toggleBusyDateSelection = function(dateStr) {
  const todayStr = new Date().toISOString().split("T")[0];
  if (dateStr < todayStr) {
    if (typeof showToast === "function") showToast("Cannot mark past dates as unavailable.", "error");
    return;
  }

  if (selectedBusyDates.has(dateStr)) {
    selectedBusyDates.delete(dateStr);
  } else {
    selectedBusyDates.add(dateStr);
  }

  renderModalCalendarGrid();
};

function renderModalCalendarGrid() {
  const titleEl = document.getElementById("modal-cal-month-title");
  const gridEl = document.getElementById("modal-calendar-grid");
  const chipsWrap = document.getElementById("modal-busy-chips-wrap");

  if (!gridEl) return;

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  if (titleEl) titleEl.textContent = `${monthNames[modalCalMonth]} ${modalCalYear}`;

  const firstDay = new Date(modalCalYear, modalCalMonth, 1).getDay();
  const daysInMonth = new Date(modalCalYear, modalCalMonth + 1, 0).getDate();
  const prevMonthDays = new Date(modalCalYear, modalCalMonth, 0).getDate();
  const todayStr = new Date().toISOString().split("T")[0];

  let html = `
    <div class="cal-day-header">Sun</div><div class="cal-day-header">Mon</div><div class="cal-day-header">Tue</div>
    <div class="cal-day-header">Wed</div><div class="cal-day-header">Thu</div><div class="cal-day-header">Fri</div><div class="cal-day-header">Sat</div>
  `;

  for (let i = firstDay - 1; i >= 0; i--) {
    const prevDayNum = prevMonthDays - i;
    html += `<div class="cal-day-cell other-month" style="min-height:36px;opacity:0.35;min-width:0;overflow:hidden"><span class="cal-day-num" style="white-space:nowrap">${prevDayNum}</span></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const mStr = String(modalCalMonth + 1).padStart(2, '0');
    const dStr = String(d).padStart(2, '0');
    const fullDate = `${modalCalYear}-${mStr}-${dStr}`;

    const isPast = fullDate < todayStr;
    const isSelected = selectedBusyDates.has(fullDate);

    let cellBg = "var(--surface)";
    let borderColor = "var(--border)";
    let numColor = "var(--text)";

    if (isSelected) {
      cellBg = "rgba(248, 113, 113, 0.24)";
      borderColor = "var(--red)";
      numColor = "var(--red)";
    } else if (isPast) {
      cellBg = "transparent";
      numColor = "var(--text-dim)";
    }

    html += `
      <div class="cal-day-cell ${isPast ? 'is-past' : ''}" 
           style="min-height:36px;padding:4px;background:${cellBg};border-color:${borderColor};cursor:${isPast ? 'not-allowed' : 'pointer'};min-width:0;overflow:hidden"
           onclick="${isPast ? '' : `window.toggleBusyDateSelection('${fullDate}')`}">
        <span class="cal-day-num" style="color:${numColor};font-size:11px;white-space:nowrap">${d}</span>
        ${isSelected ? `<span style="font-size:8px;font-weight:700;color:var(--red);text-align:right">BUSY</span>` : ''}
      </div>
    `;
  }

  const totalCells = firstDay + daysInMonth;
  const rem = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= rem; i++) {
    html += `<div class="cal-day-cell other-month" style="min-height:36px;opacity:0.35;min-width:0;overflow:hidden"><span class="cal-day-num" style="white-space:nowrap">${i}</span></div>`;
  }

  gridEl.innerHTML = html;

  if (chipsWrap) {
    if (selectedBusyDates.size === 0) {
      chipsWrap.innerHTML = `<span style="font-size:11px;color:var(--text-dim);font-style:italic">Click calendar dates above to select</span>`;
    } else {
      const sorted = [...selectedBusyDates].sort();
      chipsWrap.innerHTML = sorted.map(d => {
        const parts = d.split("-");
        const label = `${monthNames[parseInt(parts[1])-1].slice(0,3)} ${parseInt(parts[2])}`;
        return `
          <span style="display:inline-flex;align-items:center;gap:4px;background:rgba(248,113,113,0.15);border:1px solid rgba(248,113,113,0.35);color:#fca5a5;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600">
            ${label}
            <i class="bi bi-x" style="cursor:pointer" onclick="window.toggleBusyDateSelection('${d}')"></i>
          </span>
        `;
      }).join("");
    }
  }
}

window.submitBusyDates = async function() {
  if (selectedBusyDates.size === 0) {
    if (typeof showToast === "function") showToast("Please click at least one date on the calendar to mark as unavailable.", "error");
    return;
  }

  const title = (document.getElementById("busy-title")?.value || "").trim() || "In Court / Out of Office";
  const desc = (document.getElementById("busy-notes")?.value || "").trim();
  const allDay = document.getElementById("busy-all-day")?.checked;
  const startTime = document.getElementById("busy-start-time")?.value || "08:30";
  const endTime = document.getElementById("busy-end-time")?.value || "17:00";
  const timeStr = allDay ? "All Day" : `${startTime} - ${endTime}`;

  const u = window._currentUser || window._auth?.currentUser;
  const myProf = profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase()));

  const submitBtn = document.getElementById("busy-submit-btn");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";
  }

  try {
    if (typeof showToast === "function") showToast("Saving personal schedule...");

    for (const date of selectedBusyDates) {
      const busyData = {
        title: title,
        date: date,
        time: timeStr,
        description: desc,
        type: "busy",
        targetUid: u.uid,
        targetName: myProf?.name || u.displayName || u.email,
        requesterUid: u.uid,
        requesterName: myProf?.name || u.displayName || u.email,
        status: "accepted"
      };

      if (typeof dbAddAppointment === "function") {
        await dbAddAppointment(busyData);
      }
    }

    if (typeof showToast === "function") showToast(`Logged ${selectedBusyDates.size} date(s) to your personal schedule!`);
    window.closeBusyModal();
    if (typeof renderCalendarView === "function") renderCalendarView();
  } catch (err) {
    console.error("submitBusyDates error:", err);
    if (typeof showToast === "function") showToast("Failed to save schedule: " + err.message, "error");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i class="bi bi-check2"></i> Save Schedule`;
    }
  }
};

window.deleteBusySlot = async function(id) {
  if (!confirm("Remove this schedule entry?")) return;
  try {
    if (typeof dbDeleteAppointment === "function") {
      await dbDeleteAppointment(id);
    }
    if (typeof showToast === "function") showToast("Schedule entry removed!");
    if (typeof closeDateScheduleModal === "function") closeDateScheduleModal();
    if (typeof renderCalendarView === "function") renderCalendarView();
  } catch (err) {
    console.error("deleteBusySlot error:", err);
  }
};

// ═══════════════════════════════════════════════════════════════
//  CALENDAR MONTH VIEW (PROPORTIONATE 7-COLUMN FLUID GRID)
// ═══════════════════════════════════════════════════════════════
let currentCalYear = new Date().getFullYear();
let currentCalMonth = new Date().getMonth();

function renderCalendarView() {
  const select = document.getElementById("calendar-filter-select");
  const u = window._currentUser || window._auth?.currentUser;
  const myProf = profiles.find(p => p.ownerUid === u?.uid || (p.email && p.email.toLowerCase() === (u?.email || "").toLowerCase()));
  const isDeveloper = myProf && myProf.role === "developer";

  if (select) {
    if (isDeveloper) {
      select.innerHTML = `<option value="${u.uid}">My Test Schedule (Sandbox Mode)</option>`;
      select.value = u.uid;
      select.disabled = true;
    } else {
      select.disabled = false;
      const curVal = select.value;
      let optionsHtml = `<option value="Everyone">Everyone (Firm Overview)</option>`;
      
      profiles.filter(p => p.role !== "developer").forEach(p => {
        const designation = p.role ? ` (${p.role})` : "";
        optionsHtml += `<option value="${p.ownerUid}">${p.name}${designation}</option>`;
      });

      select.innerHTML = optionsHtml;
      select.value = curVal || "Everyone";
    }
  }

  let legendBar = document.getElementById("calendar-legend-bar");
  const calCard = document.getElementById("calendar-month-card");

  if (!legendBar && calCard) {
    legendBar = document.createElement("div");
    legendBar.id = "calendar-legend-bar";
    legendBar.style.cssText = "display:flex;align-items:center;gap:14px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:8px 14px;margin-bottom:14px;flex-wrap:wrap;font-size:11.5px;";
    calCard.parentNode.insertBefore(legendBar, calCard);
  }

  if (legendBar) {
    legendBar.innerHTML = `
      <span style="font-weight:700;color:var(--text);display:flex;align-items:center;gap:5px"><i class="bi bi-info-circle" style="color:var(--gold)"></i> Legend:</span>
      <span style="display:inline-flex;align-items:center;gap:4px;color:var(--gold-light)"><i class="bi bi-bank" style="color:var(--gold)"></i> Court Hearing</span>
      <span style="display:inline-flex;align-items:center;gap:4px;color:#c7d2fe"><i class="bi bi-file-earmark-text-fill" style="color:var(--violet)"></i> Pleading Deadline</span>
      <span style="display:inline-flex;align-items:center;gap:4px;color:#fca5a5"><i class="bi bi-slash-circle-fill" style="color:var(--red)"></i> Out of Office / In Court</span>
      <span style="display:inline-flex;align-items:center;gap:4px;color:#86efac"><i class="bi bi-people-fill" style="color:var(--green)"></i> Consultation</span>
      <span style="font-size:10.5px;color:var(--text-dim);margin-left:auto"><i class="bi bi-person-circle"></i> Counsel Badge</span>
    `;
  }

  renderMonthlyCalendarGrid();
}

function prevCalMonth() {
  currentCalMonth--;
  if (currentCalMonth < 0) {
    currentCalMonth = 11;
    currentCalYear--;
  }
  renderMonthlyCalendarGrid();
}

function nextCalMonth() {
  currentCalMonth++;
  if (currentCalMonth > 11) {
    currentCalMonth = 0;
    currentCalYear++;
  }
  renderMonthlyCalendarGrid();
}

function todayCalMonth() {
  const now = new Date();
  currentCalYear = now.getFullYear();
  currentCalMonth = now.getMonth();
  renderMonthlyCalendarGrid();
}

window.renderCalendarView = renderCalendarView;
window.prevCalMonth = prevCalMonth;
window.nextCalMonth = nextCalMonth;
window.todayCalMonth = todayCalMonth;

function renderMonthlyCalendarGrid() {
  const titleEl = document.getElementById("cal-month-title");
  const gridEl = document.getElementById("calendar-grid-container");
  if (!gridEl) return;

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  if (titleEl) {
    titleEl.textContent = `${monthNames[currentCalMonth]} ${currentCalYear}`;
  }

  const u = window._currentUser || window._auth?.currentUser;
  const currentUid = u?.uid || "";
  const myProf = profiles.find(p => p.ownerUid === currentUid || (p.email && p.email.toLowerCase() === (u?.email || "").toLowerCase()));
  const isDeveloper = myProf && myProf.role === "developer";

  const filter = isDeveloper ? currentUid : (document.getElementById("calendar-filter-select")?.value || "Everyone");

  let activeCases = cases.filter(c => c.dueDate || (Array.isArray(c.hearings) && c.hearings.length > 0));
  let activeAppts = appointments.filter(a => a.status === "accepted");

  if (isDeveloper) {
    activeCases = activeCases.filter(c => c.ownerUid === currentUid);
    activeAppts = activeAppts.filter(a => a.targetUid === currentUid || a.requesterUid === currentUid);
  } else if (filter !== "Everyone") {
    const matchedProf = profiles.find(p => p.ownerUid === filter);
    activeCases = activeCases.filter(c => c.profileId === matchedProf?.id);
    activeAppts = activeAppts.filter(a => a.targetUid === filter || a.requesterUid === filter);
  } else {
    activeAppts = activeAppts.filter(a => {
      const creatorProf = profiles.find(p => p.ownerUid === (a.targetUid || a.requesterUid));
      return creatorProf?.role !== "developer";
    });
  }

  const eventsByDate = {};
  activeCases.forEach(c => {
    const p = profiles.find(x => x.id === c.profileId);
    const isOwner = c.ownerUid === currentUid;
    const isExplicitlyShared = Array.isArray(c.sharedWith) && c.sharedWith.includes(currentUid);
    const isAllowed = Array.isArray(c.allowedUids) && c.allowedUids.includes(currentUid);
    const isFirmAdmin = myProf && myProf.role === "admin";
    const hasAccess = isOwner || isExplicitlyShared || isAllowed || isFirmAdmin;

    const attorneyInitials = p ? initials(p.name) : "AT";
    const attorneyColor = p?.avatarColor || "#c9a84c";

    if (c.dueDate) {
      if (!eventsByDate[c.dueDate]) eventsByDate[c.dueDate] = [];
      eventsByDate[c.dueDate].push({ 
        id: c.id, 
        type: "deadline",
        initials: attorneyInitials,
        avatarColor: attorneyColor,
        hasAccess: hasAccess,
        title: hasAccess ? c.title : "Pleading Due"
      });
    }

    if (Array.isArray(c.hearings)) {
      c.hearings.forEach(h => {
        if (h.date && h.date !== c.dueDate) {
          if (!eventsByDate[h.date]) eventsByDate[h.date] = [];
          eventsByDate[h.date].push({ 
            id: c.id, 
            type: "hearing",
            initials: attorneyInitials,
            avatarColor: attorneyColor,
            hasAccess: hasAccess,
            title: hasAccess ? c.title : "Court Appearance"
          });
        }
      });
    }
  });

  activeAppts.forEach(a => {
    if (!eventsByDate[a.date]) eventsByDate[a.date] = [];
    const isBusy = a.type === "busy";
    const targetProf = profiles.find(p => p.ownerUid === (a.targetUid || a.requesterUid));
    const attorneyInitials = targetProf ? initials(targetProf.name) : "AT";
    const attorneyColor = targetProf?.avatarColor || "#ef4444";

    eventsByDate[a.date].push({ 
      id: a.id, 
      type: isBusy ? "busy" : "appt",
      initials: attorneyInitials,
      avatarColor: attorneyColor,
      hasAccess: true,
      title: a.title || (isBusy ? "Out of Office" : "Meeting")
    });
  });

  const firstDayObj = new Date(currentCalYear, currentCalMonth, 1);
  const startingDayOfWeek = firstDayObj.getDay();
  const daysInMonth = new Date(currentCalYear, currentCalMonth + 1, 0).getDate();
  const prevMonthDays = new Date(currentCalYear, currentCalMonth, 0).getDate();

  const todayObj = new Date();
  const todayY = todayObj.getFullYear();
  const todayM = String(todayObj.getMonth() + 1).padStart(2, '0');
  const todayD = String(todayObj.getDate()).padStart(2, '0');
  const todayStr = `${todayY}-${todayM}-${todayD}`;

  gridEl.style.cssText = "display:grid !important;grid-template-columns:repeat(7, minmax(0, 1fr)) !important;gap:4px;width:100%;box-sizing:border-box;margin-bottom:28px";

  let html = `
    <div class="cal-day-header" style="text-align:center;font-size:11px;font-weight:700;color:var(--text-dim);padding:6px 0;text-transform:uppercase;letter-spacing:1px">Sun</div>
    <div class="cal-day-header" style="text-align:center;font-size:11px;font-weight:700;color:var(--text-dim);padding:6px 0;text-transform:uppercase;letter-spacing:1px">Mon</div>
    <div class="cal-day-header" style="text-align:center;font-size:11px;font-weight:700;color:var(--text-dim);padding:6px 0;text-transform:uppercase;letter-spacing:1px">Tue</div>
    <div class="cal-day-header" style="text-align:center;font-size:11px;font-weight:700;color:var(--text-dim);padding:6px 0;text-transform:uppercase;letter-spacing:1px">Wed</div>
    <div class="cal-day-header" style="text-align:center;font-size:11px;font-weight:700;color:var(--text-dim);padding:6px 0;text-transform:uppercase;letter-spacing:1px">Thu</div>
    <div class="cal-day-header" style="text-align:center;font-size:11px;font-weight:700;color:var(--text-dim);padding:6px 0;text-transform:uppercase;letter-spacing:1px">Fri</div>
    <div class="cal-day-header" style="text-align:center;font-size:11px;font-weight:700;color:var(--text-dim);padding:6px 0;text-transform:uppercase;letter-spacing:1px">Sat</div>
  `;

  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthDays - i;
    html += `
      <div class="cal-day-cell other-month" style="min-height:90px;opacity:0.35;min-width:0;overflow:hidden;box-sizing:border-box;padding:6px;border:1px solid var(--border);border-radius:10px;background:transparent">
        <span class="cal-day-num" style="font-size:12px;font-weight:700;color:var(--text-dim);white-space:nowrap">${dayNum}</span>
      </div>
    `;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const mStr = String(currentCalMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const fullDateStr = `${currentCalYear}-${mStr}-${dStr}`;

    const isToday = fullDateStr === todayStr;
    const isPast = fullDateStr < todayStr;
    const dayEvents = eventsByDate[fullDateStr] || [];

    let eventsMarkup = "";
    if (dayEvents.length > 0) {
      const topTwo = dayEvents.slice(0, 2);
      const remainingCount = dayEvents.length - 2;

      eventsMarkup = `<div style="display:flex;flex-direction:column;gap:3px;margin-top:4px;overflow:hidden;width:100%;min-width:0">`;
      
      topTwo.forEach(ev => {
        let bgStyle = "background:rgba(201,165,92,0.18);color:var(--gold-light);border:1px solid var(--gold-border);";
        let iconMarkup = `<i class="bi bi-bank" style="font-size:8.5px;flex-shrink:0"></i>`;

        if (ev.type === "deadline") {
          bgStyle = "background:rgba(129,140,248,0.18);color:#c7d2fe;border:1px solid rgba(129,140,248,0.3);";
          iconMarkup = `<i class="bi bi-file-earmark-text-fill" style="font-size:8.5px;flex-shrink:0"></i>`;
        } else if (ev.type === "busy") {
          bgStyle = "background:rgba(248,113,113,0.18);color:#fca5a5;border:1px solid rgba(248,113,113,0.3);";
          iconMarkup = `<i class="bi bi-slash-circle-fill" style="font-size:8.5px;flex-shrink:0"></i>`;
        } else if (ev.type === "appt") {
          bgStyle = "background:rgba(52,211,153,0.18);color:#86efac;border:1px solid rgba(52,211,153,0.3);";
          iconMarkup = `<i class="bi bi-people-fill" style="font-size:8.5px;flex-shrink:0"></i>`;
        }

        eventsMarkup += `
          <div style="display:flex;align-items:center;gap:3px;font-size:9.5px;font-weight:700;padding:2px 5px;border-radius:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;min-width:0;box-sizing:border-box;${bgStyle}" title="${escHtml(ev.title)}">
            <span style="width:13px;height:13px;border-radius:50%;background:${ev.avatarColor};font-size:7px;display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0">${ev.initials}</span>
            ${iconMarkup}
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0">${escHtml(ev.title)}</span>
          </div>
        `;
      });

      if (remainingCount > 0) {
        eventsMarkup += `
          <div style="font-size:8.5px;font-weight:700;color:var(--gold-light);background:rgba(255,255,255,0.06);border:1px solid var(--border);padding:1px 4px;border-radius:3px;text-align:center;margin-top:1px;white-space:nowrap">
            +${remainingCount} more
          </div>
        `;
      }

      eventsMarkup += `</div>`;
    }

    const todayTag = isToday ? `<span style="font-size:8.5px;background:var(--gold);color:#060c13;font-weight:800;padding:1px 4px;border-radius:3px;letter-spacing:0.5px;flex-shrink:0">TODAY</span>` : "";

    html += `
      <div class="cal-day-cell ${isToday ? 'is-today' : ''} ${isPast ? 'is-past' : ''}" 
           style="min-height:90px;padding:6px;display:flex;flex-direction:column;justify-content:flex-start;min-width:0;overflow:hidden;box-sizing:border-box;border:1px solid var(--border);border-radius:10px;background:var(--surface2);transition:all 0.2s"
           onclick="openDateScheduleModal('${fullDateStr}')" 
           title="${isToday ? "Today's Schedule" : isPast ? "Past Date (View Only)" : "Click to view schedule"}">
        <div style="display:flex;align-items:center;justify-content:space-between;width:100%;min-width:0">
          <span class="cal-day-num" style="font-size:12.5px;font-weight:700;color:var(--text);white-space:nowrap;word-break:normal;overflow-wrap:normal">${day}</span>
          ${todayTag}
        </div>
        ${eventsMarkup}
      </div>
    `;
  }

  const totalCells = startingDayOfWeek + daysInMonth;
  const remainingCells = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remainingCells; i++) {
    html += `
      <div class="cal-day-cell other-month" style="min-height:90px;opacity:0.35;min-width:0;overflow:hidden;box-sizing:border-box;padding:6px;border:1px solid var(--border);border-radius:10px;background:transparent">
        <span class="cal-day-num" style="font-size:12px;font-weight:700;color:var(--text-dim);white-space:nowrap">${i}</span>
      </div>
    `;
  }

  gridEl.innerHTML = html;
}

window.renderMonthlyCalendarGrid = renderMonthlyCalendarGrid;

// ═══════════════════════════════════════════════════════════════
//  DATE POPUP MODAL (CONFIDENTIALITY & STRICT 1-PERSON EDIT)
// ═══════════════════════════════════════════════════════════════
window.openDateScheduleModal = function(dateStr) {
  const modal = document.getElementById("date-schedule-modal");
  const titleEl = document.getElementById("dsm-title");
  const listEl = document.getElementById("dsm-events-list");

  if (!modal || !listEl) return;

  const formattedDate = formatDate(dateStr);
  const todayObj = new Date();
  const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
  const isPast = dateStr < todayStr;
  const isToday = dateStr === todayStr;

  let headerBadge = "";
  if (isToday) headerBadge = ` <span style="font-size:10px;background:var(--gold);color:#060c13;font-weight:800;padding:2px 6px;border-radius:4px">TODAY</span>`;
  else if (isPast) headerBadge = ` <span style="font-size:10px;background:var(--surface3);color:var(--text-dim);font-weight:600;padding:2px 6px;border-radius:4px">PAST DATE</span>`;

  if (titleEl) titleEl.innerHTML = `<i class="bi bi-calendar3" style="color:var(--gold);margin-right:6px"></i> Schedule for ${formattedDate}${headerBadge}`;

  const u = window._currentUser || window._auth?.currentUser;
  const currentUid = u?.uid || "";
  const myProf = profiles.find(p => p.ownerUid === currentUid || (p.email && p.email.toLowerCase() === u?.email?.toLowerCase()));
  const isDeveloper = myProf && myProf.role === "developer";

  let dateCases = cases.filter(c => c.dueDate === dateStr || (Array.isArray(c.hearings) && c.hearings.some(h => h.date === dateStr)));
  let dateAppts = appointments.filter(a => a.date === dateStr && a.status === "accepted");

  if (isDeveloper) {
    dateCases = dateCases.filter(c => c.ownerUid === currentUid);
    dateAppts = dateAppts.filter(a => a.targetUid === currentUid || a.requesterUid === currentUid);
  }

  const allItems = [];

  dateCases.forEach(c => {
    const p = profiles.find(x => x.id === c.profileId);
    const specificHearing = Array.isArray(c.hearings) ? c.hearings.find(h => h.date === dateStr) : null;
    
    const isOwner = c.ownerUid === currentUid;
    const isExplicitlyShared = Array.isArray(c.sharedWith) && c.sharedWith.includes(currentUid);
    const isAllowed = Array.isArray(c.allowedUids) && c.allowedUids.includes(currentUid);
    const isFirmAdmin = myProf && myProf.role === "admin";
    const hasAccess = isOwner || isExplicitlyShared || isAllowed || isFirmAdmin;

    const canEditDesc = isOwner;
    const currentDescription = specificHearing?.notes || specificHearing?.purpose || c.narrative || "";

    allItems.push({
      id: c.id,
      kind: "case",
      hasAccess: hasAccess,
      badgeColor: "var(--gold)",
      badgeLabel: specificHearing ? "Court Hearing" : "Pleading Deadline",
      title: hasAccess ? c.title : `Court Appearance (${p?.name || 'Associate Attorney'})`,
      time: specificHearing?.time || "8:30 AM",
      venue: c.venue || "Courtroom / Venue N/A",
      attorneyName: p?.name || "Attorney",
      attorneyColor: p?.avatarColor || "#c9a84c",
      photoUrl: p?.photoUrl || null,
      description: hasAccess ? currentDescription : "Confidential attorney-client information.",
      isOwner: isOwner,
      canEditDesc: canEditDesc
    });
  });

  dateAppts.forEach(a => {
    const isBusy = a.type === "busy";
    const isOwner = a.ownerUid === currentUid || a.requesterUid === currentUid;
    const targetProf = profiles.find(p => p.ownerUid === (a.targetUid || a.requesterUid));

    const canEditDesc = isOwner;

    allItems.push({
      id: a.id,
      kind: isBusy ? "busy" : "appt",
      hasAccess: true,
      badgeColor: isBusy ? "var(--red)" : "var(--violet)",
      badgeLabel: isBusy ? "Out of Office / Busy" : "Appointment",
      title: a.title,
      time: a.time || "All Day",
      venue: "",
      attorneyName: a.targetName || "Attorney",
      attorneyColor: targetProf?.avatarColor || "#ef4444",
      photoUrl: targetProf?.photoUrl || null,
      description: a.description || "",
      canDelete: isOwner,
      canEditDesc: canEditDesc
    });
  });

  if (allItems.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state" style="padding:28px 14px">
        <div class="empty-state-icon" style="font-size:32px;margin-bottom:8px;color:var(--gold)"><i class="bi bi-calendar-x"></i></div>
        <div style="font-size:13px;color:var(--text-muted)">
          ${isPast ? "No past events recorded for this date." : "No hearings or schedule blocks on this date."}
        </div>
      </div>
    `;
  } else {
    listEl.innerHTML = allItems.map(item => {
      let actionMarkup = "";

      if (item.kind === "case") {
        if (item.hasAccess) {
          actionMarkup = `
            <div style="display:flex;justify-content:flex-end;margin-top:10px">
              <button class="btn btn-secondary btn-sm" onclick="window.closeDateScheduleModal(); openCase('${item.id}')">
                Open Case File <i class="bi bi-arrow-right"></i>
              </button>
            </div>
          `;
        } else {
          actionMarkup = `
            <div style="margin-top:8px;font-size:11px;color:var(--text-dim);display:flex;align-items:center;gap:4px">
              <i class="bi bi-lock-fill" style="color:var(--amber)"></i> Case restricted. Only authorized attorneys may view full case files.
            </div>
          `;
        }
      } else if (item.canDelete) {
        actionMarkup = `
          <div style="display:flex;justify-content:flex-end;margin-top:8px">
            <button class="btn btn-ghost btn-sm" style="color:var(--red);padding:2px 6px" onclick="window.deleteBusySlot('${item.id}')">
              <i class="bi bi-trash3"></i> Remove
            </button>
          </div>
        `;
      }

      let descriptionBlock = "";
      if (item.canEditDesc) {
        descriptionBlock = `
          <div style="margin-top:10px;background:var(--surface3);border:1px solid var(--border);border-radius:9px;padding:10px 12px">
            <label style="font-size:11px;text-transform:uppercase;color:var(--gold-light);font-weight:700;display:flex;align-items:center;gap:5px;margin-bottom:6px">
              <i class="bi bi-card-text"></i> Description:
            </label>
            <textarea id="dsm-desc-${item.id}" class="field-input" style="font-size:12.5px;min-height:56px;padding:8px 10px;resize:vertical" placeholder="Enter schedule description...">${escHtml(item.description || "")}</textarea>
            <div style="display:flex;justify-content:flex-end;margin-top:8px">
              <button class="btn btn-primary btn-sm" type="button" onclick="saveEventInlineDescription('${item.kind}', '${item.id}', '${dateStr}')" style="font-size:11.5px;padding:4px 12px">
                <i class="bi bi-check2"></i> Save Description
              </button>
            </div>
          </div>
        `;
      } else if (item.description) {
        descriptionBlock = `
          <div style="margin-top:10px;background:var(--surface3);border:1px solid var(--border);border-radius:9px;padding:10px 12px">
            <div style="font-size:10.5px;text-transform:uppercase;color:var(--text-dim);font-weight:700;margin-bottom:4px">Description:</div>
            <div style="font-size:12.5px;color:var(--text);line-height:1.5;white-space:pre-wrap">${escHtml(item.description)}</div>
          </div>
        `;
      }

      return `
        <div style="background:var(--surface2);border:1px solid var(--border);border-left:4px solid ${item.badgeColor};border-radius:12px;padding:14px 16px;margin-bottom:12px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <span style="font-size:10.5px;font-weight:700;color:${item.badgeColor};background:${item.badgeColor}18;padding:2px 8px;border-radius:4px">
              ${item.badgeLabel}
            </span>
            <span style="font-size:11.5px;color:var(--gold-light);font-weight:700"><i class="bi bi-clock"></i> ${item.time}</span>
          </div>

          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            ${avatarDiv(item.attorneyName, item.attorneyColor, 32, item.photoUrl)}
            <div>
              <div style="font-size:14px;font-weight:700;color:var(--text)">${escHtml(item.title)}</div>
              <div style="font-size:11.5px;color:var(--text-muted)"><strong>Counsel:</strong> ${escHtml(item.attorneyName)}</div>
            </div>
          </div>
          
          ${item.venue ? `<div style="font-size:11.5px;color:var(--text-dim);margin-bottom:4px"><i class="bi bi-geo-alt-fill" style="color:var(--gold)"></i> ${escHtml(item.venue)}</div>` : ''}

          ${descriptionBlock}
          ${actionMarkup}
        </div>
      `;
    }).join("");
  }

  modal.classList.remove("hidden");
};

window.closeDateScheduleModal = function() {
  const modal = document.getElementById("date-schedule-modal");
  if (modal) modal.classList.add("hidden");
};

// ── STRICT 1-PERSON OWNERSHIP: SAVE INLINE DESCRIPTION ────────
window.saveEventInlineDescription = async function(kind, id, dateStr) {
  const descEl = document.getElementById(`dsm-desc-${id}`);
  if (!descEl) return;
  const newDesc = descEl.value.trim();

  const u = window._currentUser || window._auth?.currentUser;
  const currentUid = u?.uid || "";

  try {
    if (kind === "case") {
      const c = cases.find(x => x.id === id);
      if (!c) throw new Error("Case file not found.");

      if (c.ownerUid !== currentUid) {
        showToast("You can only edit descriptions on your own cases.", "error");
        return;
      }

      if (typeof showToast === "function") showToast("Saving description...");

      if (Array.isArray(c.hearings) && c.hearings.length > 0) {
        const hIdx = c.hearings.findIndex(h => h.date === dateStr);
        if (hIdx >= 0) {
          c.hearings[hIdx].notes = newDesc;
        } else {
          c.hearings.push({
            id: "h_" + Date.now(),
            date: dateStr,
            time: "08:30",
            purpose: "Court Appearance",
            notes: newDesc
          });
        }
        await dbUpdateCase(c.id, { hearings: c.hearings, narrative: newDesc });
      } else {
        await dbUpdateCase(c.id, { narrative: newDesc });
      }
    } else if (kind === "appt" || kind === "busy") {
      const a = appointments.find(x => x.id === id);
      if (!a) throw new Error("Appointment not found.");

      const isOwner = a.ownerUid === currentUid || a.requesterUid === currentUid;
      if (!isOwner) {
        showToast("You can only edit descriptions on your own schedule.", "error");
        return;
      }

      if (typeof showToast === "function") showToast("Saving schedule description...");
      await dbUpdateAppointment(id, { description: newDesc });
    }

    if (typeof showToast === "function") showToast("Description saved!");
    if (typeof renderCalendarView === "function") renderCalendarView();
  } catch (err) {
    console.error("saveEventInlineDescription error:", err);
    if (typeof showToast === "function") showToast("Failed to save description: " + err.message, "error");
  }
};

// ═══════════════════════════════════════════════════════════════
//  SYSTEM HEALTH & DIAGNOSTIC ENGINE
// ═══════════════════════════════════════════════════════════════
let systemHealthStatus = "healthy";

window.openDiagnosticModal = function() {
  const modal = document.getElementById("diagnostic-modal");
  if (!modal) return;
  modal.classList.remove("hidden");
  updateWorkspaceStatus(true);
};

window.closeDiagnosticModal = function() {
  const modal = document.getElementById("diagnostic-modal");
  if (modal) modal.classList.add("hidden");
};

async function updateWorkspaceStatus(manualRun = false) {
  const netBadge   = document.getElementById("diag-network-badge");
  const netSub     = document.getElementById("diag-network-sub");
  const dbBadge    = document.getElementById("diag-db-badge");
  const dbSub      = document.getElementById("diag-db-sub");
  const driveBadge = document.getElementById("diag-drive-badge");
  const driveSub   = document.getElementById("diag-drive-sub");

  const dot = document.getElementById("status-indicator-dot");
  const txt = document.getElementById("status-indicator-text");

  let isNetworkOk = navigator.onLine;
  let isDbOk = !localMode && !!window._db && dbReady;
  let isDriveOk = typeof hasValidToken === "function" ? hasValidToken() : false;

  const u = window._currentUser || window._auth?.currentUser;
  const myProf = u ? profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase())) : null;
  const hasDriveFolder = !!(myProf && myProf.driveFolderId);

  if (netBadge && netSub) {
    if (isNetworkOk) {
      netBadge.className = "badge badge-pass";
      netBadge.innerHTML = `<i class="bi bi-wifi" style="color:var(--green)"></i> Online`;
      netSub.textContent = "Active internet connection detected";
    } else {
      netBadge.className = "badge badge-fail";
      netBadge.innerHTML = `<i class="bi bi-wifi-off" style="color:var(--red)"></i> Offline`;
      netSub.textContent = "No network connection. Offline changes won't sync.";
    }
  }

  if (dbBadge && dbSub) {
    if (isDbOk) {
      dbBadge.className = "badge badge-pass";
      dbBadge.innerHTML = `<i class="bi bi-database-check" style="color:var(--green)"></i> Connected`;
      dbSub.textContent = "Firestore real-time listeners synchronized (Long Polling)";
    } else if (localMode) {
      dbBadge.className = "badge badge-warn";
      dbBadge.innerHTML = `<i class="bi bi-hdd-network" style="color:var(--amber)"></i> Memory Mode`;
      dbSub.textContent = "Running in memory. Data will not persist on refresh.";
    } else {
      dbBadge.className = "badge badge-fail";
      dbBadge.innerHTML = `<i class="bi bi-arrow-repeat"></i> Connecting...`;
      dbSub.textContent = "Waiting for cloud database handshake.";
    }
  }

  if (driveBadge && driveSub) {
    if (isDriveOk && hasDriveFolder) {
      driveBadge.className = "badge badge-pass";
      driveBadge.innerHTML = `<i class="bi bi-cloud-check-fill" style="color:var(--green)"></i> Linked`;
      driveSub.textContent = "OAuth active · Dedicated firm storage folder verified";
    } else if (isDriveOk && !hasDriveFolder) {
      driveBadge.className = "badge badge-warn";
      driveBadge.innerHTML = `<i class="bi bi-folder-x" style="color:var(--amber)"></i> No Folder`;
      driveSub.textContent = "Drive connected but no root case folder created yet.";
    } else {
      driveBadge.className = "badge badge-warn";
      driveBadge.innerHTML = `<i class="bi bi-cloud-slash" style="color:var(--amber)"></i> Not Connected`;
      driveSub.textContent = "Connect Google Account under My Settings to enable filing & docs.";
    }
  }

  if (!isNetworkOk || (!isDbOk && !localMode)) {
    systemHealthStatus = "danger";
    if (dot) dot.className = "status-dot danger";
    if (txt) {
      txt.textContent = "System Disconnected";
      txt.style.color = "var(--red)";
    }
  } else if (!isDriveOk || localMode || !hasDriveFolder) {
    systemHealthStatus = "warning";
    if (dot) dot.className = "status-dot warning";
    if (txt) {
      txt.textContent = !isDriveOk ? "Connect Drive" : "Memory Mode";
      txt.style.color = "var(--amber)";
    }
  } else {
    systemHealthStatus = "healthy";
    if (dot) dot.className = "status-dot healthy";
    if (txt) {
      txt.textContent = "Workspace Active";
      txt.style.color = "var(--green)";
    }
  }

  if (manualRun && typeof showToast === "function") {
    showToast(`Health check complete: ${systemHealthStatus === "healthy" ? "All systems healthy" : "Issues detected"}`, systemHealthStatus === "healthy" ? "success" : "error");
  }
}

window.updateWorkspaceStatus = updateWorkspaceStatus;

if (!window._healthIntervalId) {
  window._healthIntervalId = setInterval(() => {
    if (document.visibilityState === "visible") {
      updateWorkspaceStatus(false);
    }
  }, 25000);
}
window.addEventListener("online", () => updateWorkspaceStatus(false));
window.addEventListener("offline", () => updateWorkspaceStatus(false));

// ═══════════════════════════════════════════════════════════════
//  UNIVERSAL ACTION CONFIRMATION MODAL CONTROLLER
// ═══════════════════════════════════════════════════════════════
let pendingActionConfirmCallback = null;

window.openConfirmModal = function({ icon = "bi-shield-check", title = "Confirm Action", body = "Are you sure?", confirmText = "Confirm", confirmStyle = "btn-primary", onConfirm = null }) {
  const modal = document.getElementById("universal-confirm-modal");
  const iconEl = document.getElementById("ucm-icon");
  const titleEl = document.getElementById("ucm-title");
  const bodyEl = document.getElementById("ucm-body");
  const btn = document.getElementById("ucm-confirm-btn");

  if (!modal) return;

  if (iconEl) {
    const iconClass = icon.startsWith("bi-") ? icon : "bi-shield-check";
    iconEl.innerHTML = `<i class="bi ${iconClass}" style="color:var(--gold)"></i>`;
  }
  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.innerHTML = body;

  if (btn) {
    btn.textContent = confirmText;
    btn.className = `btn ${confirmStyle}`;
  }

  pendingActionConfirmCallback = onConfirm;
  modal.classList.remove("hidden");
};

window.closeConfirmModal = function() {
  const modal = document.getElementById("universal-confirm-modal");
  if (modal) modal.classList.add("hidden");
  pendingActionConfirmCallback = null;
};

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("ucm-confirm-btn");
  if (btn) {
    btn.addEventListener("click", () => {
      const cb = pendingActionConfirmCallback;
      window.closeConfirmModal();
      if (typeof cb === "function") {
        cb();
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════
//  CASE DETAIL BACK NAVIGATION
// ═══════════════════════════════════════════════════════════════
let caseDetailOrigin = "allcases";

window.handleCaseDetailBack = function() {
  if (caseDetailOrigin === "profileDetail" && selProfile) {
    showView("profileDetail");
    renderProfileDetail();
  } else if (caseDetailOrigin === "dashboard") {
    navTo("dashboard");
  } else {
    navTo("allcases");
  }
};

// ═══════════════════════════════════════════════════════════════
//  UNSAVED CASE FORM CHANGES INTERCEPTION & DISCARD GUARD
// ═══════════════════════════════════════════════════════════════
let pendingNavigationDestination = null;
let _isSubmittingCase = false;

function hasUnsavedCaseChanges() {
  if (_isSubmittingCase) return false;
  if (currentView !== "caseForm") return false;
  const title = (document.getElementById("cf-case-title")?.value || "").trim();
  const narrative = (document.getElementById("cf-narrative")?.value || "").trim();
  const caseNumber = (document.getElementById("cf-case-number")?.value || "").trim();
  const docDue = (document.getElementById("cf-due")?.value || "").trim();
  const docType = (document.getElementById("cf-doc-type")?.value || "").trim();
  const hasDocs = Array.isArray(pendingDocs) && pendingDocs.length > 0;
  const hasHearings = Array.isArray(window.cfHearings) && window.cfHearings.length > 0;
  
  return Boolean(title || narrative || caseNumber || docDue || docType || hasDocs || hasHearings);
}

window.hasUnsavedCaseChanges = hasUnsavedCaseChanges;

window.promptDiscardCase = function(destination) {
  pendingNavigationDestination = destination;
  const modal = document.getElementById("discard-case-modal");
  if (modal) modal.classList.remove("hidden");
};

window.cancelDiscardCase = function() {
  pendingNavigationDestination = null;
  const modal = document.getElementById("discard-case-modal");
  if (modal) modal.classList.add("hidden");
};

window.confirmDiscardCase = function() {
  const target = pendingNavigationDestination || caseFormOrigin || "allcases";
  pendingNavigationDestination = null;
  const modal = document.getElementById("discard-case-modal");
  if (modal) modal.classList.add("hidden");

  resetCaseFormFields();
  executeNavigation(target);
};

window.handleCaseCancelOrExit = function() {
  if (hasUnsavedCaseChanges()) {
    window.promptDiscardCase(caseFormOrigin || "allcases");
  } else {
    resetCaseFormFields();
    executeNavigation(caseFormOrigin || "allcases");
  }
};

function resetCaseFormFields() {
  setElVal("cf-case-title", "");
  setElVal("cf-narrative", "");
  setElVal("cf-filed", "");
  setElVal("cf-due", "");
  setElVal("cf-case-number", "");
  setElVal("cf-doc-type", "");
  setElVal("cf-type-input", "");
  
  if (typeof pendingDocs !== "undefined") pendingDocs = [];
  if (typeof window.cfHearings !== "undefined") window.cfHearings = [];
  if (typeof window.cfPetitioners !== "undefined") window.cfPetitioners = [];
  if (typeof window.cfRespondents !== "undefined") window.cfRespondents = [];

  clearCaseErrors();
}

window.addEventListener("beforeunload", (e) => {
  if (hasUnsavedCaseChanges()) {
    e.preventDefault();
    e.returnValue = "You have unsaved case changes. Are you sure you want to leave?";
    return e.returnValue;
  }
});

// ═══════════════════════════════════════════════════════════════
//  VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════
function isValidMobile(num) {
  if (!num) return true;
  const cleaned = String(num).replace(/\D/g, "");
  return cleaned.length === 11;
}
window.isValidMobile = isValidMobile;

function isValidEmail(email) {
  return /^[^\s@]+@(gmail\.com|outlook\.com)$/i.test(String(email || "").trim());
}
window.isValidEmail = isValidEmail;

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
          if (icon) icon.innerHTML = `<i class="bi bi-check-circle-fill" style="color:var(--green)"></i>`;
        } else {
          rule.el.style.color = "var(--text-dim)";
          if (icon) icon.innerHTML = `<i class="bi bi-x-circle" style="color:var(--red)"></i>`;
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

window.initPasswordStrengthChecker = initPasswordStrengthChecker;

// ═══════════════════════════════════════════════════════════════
//  NAVIGATION (WITH AUTO-CLOSE CHAT & NOTIFICATIONS)
// ═══════════════════════════════════════════════════════════════
function showView(name) {
  const chatPanel = document.getElementById("chat-panel");
  if (chatPanel && !chatPanel.classList.contains("hidden")) {
    chatPanel.classList.add("hidden");
  }

  const notifDropdown = document.getElementById("notif-dropdown");
  if (notifDropdown && !notifDropdown.classList.contains("hidden")) {
    notifDropdown.classList.add("hidden");
  }

  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
  const el = document.getElementById("view-" + name);
  if (el) el.classList.remove("hidden");
  currentView = name;
  
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".mobile-nav-item").forEach(b => b.classList.remove("active"));

  let primaryNavKey = name;
  if (name === "caseDetail" || name === "caseForm" || name === "allcases") {
    primaryNavKey = "allcases";
  } else if (name === "profileDetail" || name === "profileForm" || name === "profiles") {
    primaryNavKey = "profiles";
  } else if (name === "myprofile") {
    primaryNavKey = "myprofile";
  }

  const btn = document.querySelector(`.nav-btn[data-nav="${primaryNavKey}"]`);
  if (btn) btn.classList.add("active");
  const mBtn = document.querySelector(`.mobile-nav-item[data-nav="${primaryNavKey}"]`);
  if (mBtn) mBtn.classList.add("active");
}

function navTo(view) {
  if (currentView === "caseForm" && view !== "caseForm" && hasUnsavedCaseChanges()) {
    window.promptDiscardCase(view);
    return;
  }
  executeNavigation(view);
}

function executeNavigation(view) {
  const chatPanel = document.getElementById("chat-panel");
  if (chatPanel && !chatPanel.classList.contains("hidden")) {
    chatPanel.classList.add("hidden");
  }

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
  if (view === "allcases") {
    currentAllCasesPage = 1;
    renderAllCases();
  }
  if (view === "myprofile") renderMyProfile();
  if (view === "calendar")  renderCalendarView();
  if (view === "notifications") renderNotificationsView();
  if (view === "mydrive") initDriveExplorer();
}

window.showView = showView;
window.navTo = navTo;
window.executeNavigation = executeNavigation;

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD (STRICTLY 5 PER PAGE + ATTORNEY ROSTER CARD)
// ═══════════════════════════════════════════════════════════════
let currentDashPage = 1;
const dashPageSize = 5;

window.changeDashPage = function(delta) {
  currentDashPage += delta;
  renderDashboard();
};

function renderDashboard() {
  const todayDateEl = document.getElementById("today-date");
  if (todayDateEl) {
    todayDateEl.textContent = new Date().toLocaleDateString("en-PH",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
  }

  const userCases = getAccessibleCases();

  const statTotalEl = document.getElementById("stat-total");
  const statOngoingEl = document.getElementById("stat-ongoing");
  const statCompletedEl = document.getElementById("stat-completed");

  if (statTotalEl) statTotalEl.textContent = userCases.length;
  if (statOngoingEl) statOngoingEl.textContent = userCases.filter(c => c.status === "On-going").length;
  if (statCompletedEl) statCompletedEl.textContent = userCases.filter(c => c.status === "Completed").length;

  // Active cases for dashboard list
  const activeCasesList = userCases.filter(c => c.status === "On-going" || c.status === "Pending");
  const listToDisplay = activeCasesList.length > 0 ? activeCasesList : userCases;

  const total = listToDisplay.length;
  const totalPages = Math.max(1, Math.ceil(total / dashPageSize));

  if (currentDashPage > totalPages) currentDashPage = totalPages;
  if (currentDashPage < 1) currentDashPage = 1;

  const startIdx = (currentDashPage - 1) * dashPageSize;
  const pagedCases = listToDisplay.slice(startIdx, startIdx + dashPageSize);

  const dcEl = document.getElementById("dash-cases");
  const pageInfoEl = document.getElementById("dash-page-info");
  const pageNumEl = document.getElementById("dash-page-num");
  const prevBtn = document.getElementById("dash-btn-prev");
  const nextBtn = document.getElementById("dash-btn-next");

  if (dcEl) {
    dcEl.innerHTML = pagedCases.length === 0
      ? '<div class="empty-state"><div class="empty-state-icon" style="color:var(--gold)"><i class="bi bi-folder2-open"></i></div><div>No active cases yet.</div></div>'
      : pagedCases.map(c => {
        const p = profiles.find(x => x.id === c.profileId);
        const daysLeft = c.dueDate ? Math.ceil((new Date(c.dueDate) - new Date()) / (1000 * 60 * 60 * 24)) : null;
        const urgency = daysLeft !== null
          ? (daysLeft < 0   ? {col:"var(--red)",   label:"Overdue"}
           : daysLeft === 0  ? {col:"var(--red)",   label:"Due today"}
           : daysLeft <= 7  ? {col:"var(--red)",   label:(daysLeft === 0 ? "Due today" : daysLeft + "d left")}
           : daysLeft <= 30 ? {col:"var(--amber)", label:daysLeft + "d left"}
           :                  {col:"var(--text-muted)", label:daysLeft + "d left"})
          : null;

        const categoryBadge = `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;background:rgba(201,165,92,0.12);color:var(--gold-light);border:1px solid var(--gold-border);white-space:nowrap;display:inline-block">${escHtml(c.category || "Case")}</span>`;

        return `<div class="flex-center gap-10" style="padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:9px;margin-bottom:8px;cursor:pointer;transition:all 0.2s" onclick="openCase('${c.id}')" onmouseenter="this.style.borderColor='var(--gold)'" onmouseleave="this.style.borderColor='var(--border)'">
          ${p ? avatarDiv(p.name, p.avatarColor, 30, p.photoUrl) : ""}
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(c.title)}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              ${categoryBadge}
              <span>${p?.name || ""} · ${c.type || "Litigation"}</span>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0">
            ${badge(c.status, statusColor(c.status))}
            ${urgency ? '<span style="font-size:10px;font-weight:700;color:' + urgency.col + '">' + urgency.label + '</span>' : ""}
          </div>
        </div>`;
      }).join("");
  }

  if (pageInfoEl) {
    pageInfoEl.textContent = total === 0 ? "Showing 0 cases" : `Showing ${startIdx + 1}–${Math.min(startIdx + dashPageSize, total)} of ${total} cases`;
  }
  if (pageNumEl) {
    pageNumEl.textContent = `Page ${currentDashPage} of ${totalPages}`;
  }
  if (prevBtn) prevBtn.disabled = currentDashPage <= 1;
  if (nextBtn) nextBtn.disabled = currentDashPage >= totalPages;

  renderDashProfiles();
  renderQuickAccess();
  if (typeof fetchAndRenderGoogleCalendarEvents === "function") {
    fetchAndRenderGoogleCalendarEvents();
  }
}

window.renderDashboard = renderDashboard;

// ═══════════════════════════════════════════════════════════════
//  ATTORNEY ROSTER ON DASHBOARD
// ═══════════════════════════════════════════════════════════════
function renderDashProfiles() {
  const el = document.getElementById("dash-profiles");
  const countBadge = document.getElementById("dash-roster-count-badge");
  const searchInp = document.getElementById("dash-profile-search");
  if (!el) return;

  const q = (searchInp?.value || "").toLowerCase().trim();
  const u = window._currentUser;
  const myProf = u ? profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === (u.email || "").toLowerCase())) : null;
  const isFirmAdmin = myProf && myProf.role === "admin";

  let visible = profiles.filter(p => p.role !== "developer" || isFirmAdmin || p.ownerUid === u?.uid);

  if (q) {
    visible = visible.filter(p => (p.name || "").toLowerCase().includes(q) || (p.role || "").toLowerCase().includes(q));
  }

  if (countBadge) {
    countBadge.textContent = `${visible.length} Counsel`;
  }

  if (visible.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:24px 10px;color:var(--text-muted);font-size:12px">No attorneys found.</div>`;
    return;
  }

  const userCases = getAccessibleCases();

  el.innerHTML = visible.map(p => {
    const caseCount = userCases.filter(c => c.profileId === p.id).length;
    const isMe = p.ownerUid === u?.uid || (p.email && p.email.toLowerCase() === (u?.email || "").toLowerCase());

    return `
      <div class="dash-roster-item" onclick="openProfile('${p.id}')">
        ${avatarDiv(p.name, p.avatarColor, 32, p.photoUrl)}
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:12.5px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${escHtml(p.name)} ${isMe ? '<span style="font-size:9px;color:var(--gold);background:rgba(201,168,76,0.12);padding:1px 4px;border-radius:3px">YOU</span>' : ''}
          </div>
          <div style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(p.role || 'Attorney')}</div>
        </div>
        <span class="badge" style="background:var(--surface3);color:var(--text-dim);font-size:10px">${caseCount} case${caseCount !== 1 ? 's' : ''}</span>
      </div>
    `;
  }).join("");
}

window.renderDashProfiles = renderDashProfiles;

// ═══════════════════════════════════════════════════════════════
//  PROFILES VIEW MODES & ATTORNEY DIRECTORY (DEVELOPERS EXCLUDED)
// ═══════════════════════════════════════════════════════════════
let profilesViewMode = localStorage.getItem("simando-profiles-view") || "tile";

window.setProfilesViewMode = function(mode) {
  profilesViewMode = mode;
  try {
    localStorage.setItem("simando-profiles-view", mode);
  } catch (e) { /* ignore */ }

  const tileBtn = document.getElementById("btn-view-tile");
  const listBtn = document.getElementById("btn-view-list");

  if (tileBtn && listBtn) {
    tileBtn.className = mode === "tile" ? "btn btn-sm btn-secondary active" : "btn btn-sm btn-ghost";
    listBtn.className = mode === "list" ? "btn btn-sm btn-secondary active" : "btn btn-sm btn-ghost";
  }

  renderProfiles();
};

function renderProfiles() {
  const u = window._currentUser;
  if (!u) return;

  const myProf = profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === (u.email || "").toLowerCase()));
  const isFirmAdmin = myProf && myProf.role === "admin";

  const visibleProfiles = profiles.filter(p => p.role !== "developer" || isFirmAdmin || p.ownerUid === u.uid);

  const countEl = document.getElementById("profiles-count");
  if (countEl) countEl.textContent = `${visibleProfiles.length} profile${visibleProfiles.length !== 1 ? "s" : ""} total`;

  const el = document.getElementById("profiles-grid");
  if (!el) return;

  const userCases = getAccessibleCases();

  if (visibleProfiles.length === 0) {
    el.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon" style="color:var(--gold)"><i class="bi bi-people"></i></div><div style="font-size:13px;color:var(--text-muted)">No attorney profiles found.</div></div>`;
    return;
  }

  if (profilesViewMode === "list") {
    el.style.display = "flex";
    el.style.flexDirection = "column";
    el.style.gap = "8px";

    el.innerHTML = visibleProfiles.map(p => {
      const pc = userCases.filter(c => c.profileId === p.id);
      const ongoing = pc.filter(c => c.status === "On-going").length;
      const isMe = p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase());
      const isDev = p.role === "developer";

      return `
        <div class="profile-list-row" onclick="openProfile('${p.id}')" style="${isMe ? 'border-color:var(--gold-border); background:rgba(201,165,92,0.03)' : ''}">
          <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:0">
            ${avatarDiv(p.name, p.avatarColor, 38, p.photoUrl)}
            <div style="min-width:0">
              <div style="font-weight:700;font-size:14.5px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                ${escHtml(p.name)} 
                ${isMe ? '<span style="font-size:9.5px;color:var(--gold);background:rgba(201,168,76,0.12);padding:1px 5px;border-radius:4px;margin-left:6px;font-weight:700">YOU</span>' : ""}
                ${isDev ? '<span style="font-size:9.5px;color:var(--cyan);background:rgba(34,211,238,0.12);padding:1px 5px;border-radius:4px;margin-left:6px;font-weight:700">DEV</span>' : ""}
              </div>
              <div style="font-size:12px;color:var(--text-muted)">${escHtml(p.role || "Attorney")} · ${escHtml(p.email || "No email")}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;flex-shrink:0">
            <span style="font-size:12px;color:var(--text-dim)">${pc.length} case${pc.length !== 1 ? 's' : ''}</span>
            ${ongoing > 0 ? badge(ongoing + " active", statusColor("On-going")) : ""}
            <span style="font-size:14px;color:var(--gold)"><i class="bi bi-arrow-right"></i></span>
          </div>
        </div>
      `;
    }).join("");
  } else {
    el.style.display = "grid";
    el.style.gridTemplateColumns = "repeat(auto-fill, minmax(280px, 1fr))";
    el.style.gap = "20px";

    el.innerHTML = visibleProfiles.map(p => {
      const pc = userCases.filter(c => c.profileId === p.id);
      const ongoing = pc.filter(c => c.status === "On-going").length;
      const isMe = p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase());
      const isDev = p.role === "developer";
      
      return `
        <div class="profile-card" onclick="openProfile('${p.id}')" style="${isMe ? 'border-color:var(--gold-border); background:rgba(201,165,92,0.03)' : ''}">
          <div class="flex-center gap-14 mb-16">
            ${avatarDiv(p.name, p.avatarColor, 50, p.photoUrl)}
            <div>
              <div style="font-weight:700;font-size:16px;color:var(--text)">
                ${escHtml(p.name)} 
                ${isMe ? '<span style="font-size:10px;color:var(--gold);background:rgba(201,168,76,0.1);padding:2px 6px;border-radius:4px;margin-left:6px;font-weight:600">YOU</span>' : ""}
                ${isDev ? '<span style="font-size:10px;color:var(--cyan);background:rgba(34,211,238,0.1);padding:2px 6px;border-radius:4px;margin-left:6px;font-weight:600">DEV</span>' : ""}
              </div>
              <div style="font-size:13px;color:var(--text-muted)">${escHtml(p.role || "Attorney")}</div>
            </div>
          </div>
          <hr class="divider"/>
          ${p.email ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:5px"><i class="bi bi-envelope-fill" style="color:var(--gold);margin-right:6px"></i>${escHtml(p.email)}</div>` : ""}
          ${p.contact ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:12px"><i class="bi bi-telephone-fill" style="color:var(--gold);margin-right:6px"></i>${escHtml(p.contact)}</div>` : ""}
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:13px;color:var(--text-dim)">Cases Accessible (${pc.length})</span>
            ${ongoing > 0 ? badge(ongoing + " active", statusColor("On-going")) : ""}
          </div>
        </div>
      `;
    }).join("");
  }
}

window.renderProfiles = renderProfiles;

// ═══════════════════════════════════════════════════════════════
//  CASE SHARING SYSTEM (DEVELOPERS OMITTED)
// ═══════════════════════════════════════════════════════════════
window.openShareCaseModal = function() {
  if (!selCase) return;
  const listEl = document.getElementById("share-modal-list");
  if (!listEl) return;

  const sharedUids = selCase.sharedWith || [];
  const currentUid = window._currentUser?.uid;

  const associates = profiles.filter(p => p.ownerUid && p.ownerUid !== currentUid && p.role !== "developer");

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
};

window.closeShareModal = function() {
  const modal = document.getElementById("share-modal");
  if (modal) modal.classList.add("hidden");
};

// ═══════════════════════════════════════════════════════════════
//  PROFILE DETAIL
// ═══════════════════════════════════════════════════════════════
function renderProfileDetail() {
  const p = selProfile;
  if (!p) return;

  const currentUid = window._currentUser?.uid;
  const isOwner = p.ownerUid === currentUid;

  let actionButtons = "";
  let driveChip = "";

  if (isOwner) {
    driveChip = p.driveFolderId
      ? `<a href="https://drive.google.com/drive/folders/${p.driveFolderId}" target="_blank" style="font-size:12px;color:var(--green);display:inline-flex;align-items:center;gap:6px;text-decoration:none;font-weight:500;padding:4px 10px;background:rgba(34,197,94,0.08);border-radius:6px;border:1px solid rgba(34,197,94,0.2)" title="Open Drive Folder"><i class="bi bi-google"></i> Drive Folder <i class="bi bi-arrow-right"></i></a>`
      : (accessToken
          ? `<button onclick="createProfileFolderManual()" style="background:transparent;border:1px solid var(--amber);color:var(--amber);font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-weight:500;padding:4px 10px;border-radius:6px;transition:all 0.2s"><i class="bi bi-folder-plus"></i> Create Drive Folder</button>`
          : `<span style="font-size:12px;color:var(--text-dim);display:inline-flex;align-items:center;gap:6px"><i class="bi bi-cloud-slash"></i> Drive not connected</span>`);

    actionButtons = `
      <button class="btn btn-secondary btn-sm" onclick="navTo('myprofile')"><i class="bi bi-pencil-square"></i> Edit Profile</button>
      <button class="btn btn-primary btn-sm" onclick="openAddCase()"><i class="bi bi-plus-circle"></i> Add Case</button>
    `;
  } else {
    driveChip = `<span style="font-size:12px;color:var(--text-dim)"><i class="bi bi-shield-lock"></i> Files Protected</span>`;
    actionButtons = `
      <button class="btn btn-primary btn-sm" onclick="openAppointmentModal('${p.id}')"><i class="bi bi-calendar-plus"></i> Request Schedule</button>
    `;
  }

  const headerCard = document.getElementById("profile-header-card");
  if (headerCard) {
    headerCard.innerHTML = `
      ${avatarDiv(p.name, p.avatarColor, 64, p.photoUrl)}
      <div style="flex:1">
        <div style="font-size:24px;font-weight:700;color:var(--text)">${escHtml(p.name)}</div>
        <div style="font-size:14px;color:var(--text-muted);margin-top:3px">${escHtml(p.role || "Attorney")}</div>
        <div style="display:flex;gap:18px;margin-top:10px;flex-wrap:wrap;align-items:center">
          ${p.email ? `<span style="font-size:12px;color:var(--text-muted)"><i class="bi bi-envelope-fill" style="color:var(--gold);margin-right:4px"></i>${escHtml(p.email)}</span>` : ""}
          ${p.contact ? `<span style="font-size:12px;color:var(--text-muted)"><i class="bi bi-telephone-fill" style="color:var(--gold);margin-right:4px"></i>${escHtml(p.contact)}</span>` : ""}
          <span style="font-size:12px;color:var(--text-dim)"><i class="bi bi-calendar-check" style="color:var(--gold);margin-right:4px"></i>Since ${p.createdAt || formatDate(new Date().toISOString())}</span>
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

  const pc = getAccessibleCases().filter(c => c.profileId === p.id);

  if (isOwner || pc.length > 0) {
    if (noticeEl) noticeEl.style.display = "none";
    if (sectionEl) sectionEl.style.display = "block";
    if (statsEl) {
      statsEl.style.display = "grid";
      const docs = pc.reduce((a, c) => a + (c.documents?.length || 0), 0);

      statsEl.innerHTML = [
        ["Accessible Cases", pc.length, "var(--violet)"],
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

  const pc = getAccessibleCases().filter(c => c.profileId === p.id);

  let filtered = pc.filter(c =>
    (c.title.toLowerCase().includes(q) || (c.parties || "").toLowerCase().includes(q) || (c.caseNumber || "").toLowerCase().includes(q)) &&
    (status === "All" || c.status === status) &&
    (category === "All" || c.category === category) &&
    (type === "All" || c.type === type)
  );
  filtered = sortCasesByDue(filtered, sort);

  const el = document.getElementById("profile-cases-list");
  if (!el) return;

  if (filtered.length === 0) {
    el.innerHTML = `<div class="empty-state">${pc.length === 0
      ? '<div class="empty-state-icon" style="color:var(--gold)"><i class="bi bi-bank"></i></div><div>No accessible cases yet</div>'
      : '<div class="empty-state-icon" style="color:var(--gold)"><i class="bi bi-search"></i></div><div>No cases match your filters.</div>'
    }</div>`;
    return;
  }
  el.innerHTML = filtered.map(c => `
    <div class="case-row" onclick="openCase('${c.id}')">
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:15px;color:var(--text);margin-bottom:4px">${escHtml(c.title)}</div>
        <div style="font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span style="font-size:9.5px;font-weight:700;padding:2px 6px;border-radius:4px;background:rgba(201,165,92,0.12);color:var(--gold-light);border:1px solid var(--gold-border)">${escHtml(c.category || "Case")}</span>
          <span>${c.type || "Litigation"} · ${c.venue || "No Venue"}</span>
        </div>
        <div style="font-size:13px;color:var(--text-dim);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(c.parties || "")}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">
        ${badge(c.status, statusColor(c.status))}
        ${dueBadge(c.dueDate)}
      </div>
    </div>`).join("");
}

window.renderProfileDetail = renderProfileDetail;
window.renderProfileCases = renderProfileCases;

// ═══════════════════════════════════════════════════════════════
//  ALL CASES VIEW (STRICTLY 10 PER PAGE PAGINATION)
// ═══════════════════════════════════════════════════════════════
let currentAllCasesPage = 1;
const allCasesPageSize = 10;

window.changeAllCasesPage = function(delta) {
  currentAllCasesPage += delta;
  renderAllCases();
};

window.goToAllCasesPage = function(pageNum) {
  currentAllCasesPage = pageNum;
  renderAllCases();
};

function renderAllCases() {
  updateAllFilterDropdowns(); 
  const q        = (document.getElementById("ac-search")?.value || "").toLowerCase().trim();
  const status   = document.getElementById("ac-status")?.value || "All";
  const category = document.getElementById("ac-category")?.value || "All";
  const type     = document.getElementById("ac-type")?.value || "All";
  const sort     = document.getElementById("ac-sort")?.value || "asc";

  const accessible = getAccessibleCases();

  let filtered = accessible.filter(c => {
    const p = profiles.find(x => x.id === c.profileId);
    const attorneyName = (p?.name || "").toLowerCase();
    const caseTitle = (c.title || "").toLowerCase();
    const parties = (c.parties || "").toLowerCase();
    const caseNumber = (c.caseNumber || "").toLowerCase();

    const matchesQuery = !q || 
      caseTitle.includes(q) || 
      attorneyName.includes(q) || 
      parties.includes(q) || 
      caseNumber.includes(q);

    return matchesQuery &&
      (status === "All" || c.status === status) &&
      (category === "All" || c.category === category) &&
      (type === "All" || c.type === type);
  });
  filtered = sortCasesByDue(filtered, sort);

  const countEl = document.getElementById("allcases-count");
  if (countEl) countEl.textContent = `${filtered.length} accessible case${filtered.length !== 1 ? "s" : ""} found`;

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / allCasesPageSize));

  if (currentAllCasesPage > totalPages) currentAllCasesPage = totalPages;
  if (currentAllCasesPage < 1) currentAllCasesPage = 1;

  const startIdx = (currentAllCasesPage - 1) * allCasesPageSize;
  const pagedCases = filtered.slice(startIdx, startIdx + allCasesPageSize);

  const el = document.getElementById("all-cases-list");
  const pageInfoEl = document.getElementById("allcases-page-info");
  const buttonsWrap = document.getElementById("allcases-page-buttons");
  const prevBtn = document.getElementById("allcases-btn-prev");
  const nextBtn = document.getElementById("allcases-btn-next");
  const paginationBar = document.getElementById("allcases-pagination-bar");

  if (!el) return;

  if (filtered.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon" style="color:var(--gold)"><i class="bi bi-search"></i></div><div>No cases match your access permissions or filters.</div></div>';
    if (paginationBar) paginationBar.style.display = "none";
    return;
  }

  if (paginationBar) paginationBar.style.display = "flex";

  el.innerHTML = pagedCases.map(c => {
    const p = profiles.find(x => x.id === c.profileId);
    return `<div class="case-row" onclick="openCase('${c.id}')">
      ${p ? avatarDiv(p.name, p.avatarColor, 40, p.photoUrl) : ""}
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:15px;color:var(--text);margin-bottom:4px">${escHtml(c.title)}</div>
        <div style="font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span style="font-size:9.5px;font-weight:700;padding:2px 6px;border-radius:4px;background:rgba(201,165,92,0.12);color:var(--gold-light);border:1px solid var(--gold-border)">${escHtml(c.category || "Case")}</span>
          <span>${p?.name || ""} · ${c.type || "Litigation"} · ${c.venue || "No Venue"}</span>
        </div>
        <div style="font-size:13px;color:var(--text-dim);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(c.parties || "")}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">
        ${badge(c.status, statusColor(c.status))}
        ${dueBadge(c.dueDate)}
      </div>
    </div>`;
  }).join("");

  if (pageInfoEl) {
    pageInfoEl.textContent = `Showing ${startIdx + 1}–${Math.min(startIdx + allCasesPageSize, total)} of ${total} cases`;
  }
  if (prevBtn) prevBtn.disabled = currentAllCasesPage <= 1;
  if (nextBtn) nextBtn.disabled = currentAllCasesPage >= totalPages;

  if (buttonsWrap) {
    let btnsHtml = "";
    for (let p = 1; p <= totalPages; p++) {
      btnsHtml += `<button class="page-btn ${p === currentAllCasesPage ? 'active' : ''}" onclick="goToAllCasesPage(${p})">${p}</button>`;
    }
    buttonsWrap.innerHTML = btnsHtml;
  }
}

window.renderAllCases = renderAllCases;

// ═══════════════════════════════════════════════════════════════
//  CASE DETAIL (WITH FULL PERMISSION FOR SHARED USERS)
// ═══════════════════════════════════════════════════════════════
function renderCaseDetail() {
  const c = selCase;
  if (!c) return;

  const p = profiles.find(x => x.id === c.profileId);

  const titleEl = document.getElementById("cd-title");
  if (titleEl) titleEl.textContent = c.title;

  const currentUid = window._currentUser?.uid;
  const isOwner = c.ownerUid === currentUid;
  const isGroupAdmin = profiles.some(p => p.ownerUid === currentUid && p.role === "admin");
  
  const isShared = (Array.isArray(c.sharedWith) && c.sharedWith.includes(currentUid)) ||
                   (Array.isArray(c.allowedUids) && c.allowedUids.includes(currentUid));

  const canEdit = isOwner || isGroupAdmin || isShared;
  const canShare = isOwner || isGroupAdmin;
  const canDelete = isOwner || isGroupAdmin;

  let actionButtons = "";
  if (canEdit) actionButtons += `<button class="btn btn-secondary btn-sm" onclick="openEditCase()"><i class="bi bi-pencil-square"></i> Edit Case</button>`;
  if (canShare) actionButtons += `<button class="btn btn-secondary btn-sm" onclick="openShareCaseModal()"><i class="bi bi-people"></i> Share</button>`;
  if (canDelete) actionButtons += `<button class="btn btn-danger btn-sm" onclick="confirmDeleteCase()"><i class="bi bi-trash3"></i> Delete</button>`;
  if (isShared && !isOwner && !isGroupAdmin) actionButtons += `<span class="badge" style="background:rgba(52,211,153,0.15);color:var(--green);padding:6px 12px;font-size:11.5px"><i class="bi bi-shield-check"></i> Shared Associate (Editor)</span>`;

  const wrapEl = document.getElementById("cd-action-buttons-wrap");
  if (wrapEl) wrapEl.innerHTML = actionButtons;

  const backBtn = document.getElementById("cd-back-btn");
  if (backBtn) {
    backBtn.onclick = window.handleCaseDetailBack;
  }

  const chip = document.getElementById("cd-profile-chip");
  if (chip) {
    if (p) {
      chip.innerHTML = `${avatarDiv(p.name, p.avatarColor, 28, p.photoUrl)}<div><div style="font-size:14px;font-weight:600;color:var(--text)">${escHtml(p.name)}</div><div style="font-size:12px;color:var(--text-muted)">${escHtml(p.role || "Attorney")}</div></div><span style="font-size:12px;color:var(--text-dim);margin-left:8px"><i class="bi bi-arrow-right"></i> view profile</span>`;
      chip.style.display = "inline-flex";
    } else {
      chip.style.display = "none";
    }
  }

  const infoEl = document.getElementById("cd-info");
  if (infoEl) {
    infoEl.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        ${badge(c.status, statusColor(c.status))} ${badge(c.category || "Case", "#c9a55c")} ${badge(c.type || "Litigation", "#6366f1")}
      </div>
      <hr class="divider"/>
      ${[
        ["Parties Involved", c.parties || "None"],
        ["Venue / Court", c.venue || "N/A"],
        ["Date Case Filed", formatDate(c.filedDate)],
        ["Case / Docket Number", c.caseNumber || "Not indicated"],
        ["Date Added", c.createdAt || "N/A"]
      ].map(([l, v]) => `
        <div style="margin-bottom:16px">
          <div style="font-size:11px;color:var(--text-dim);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px;font-weight:600">${l}</div>
          <div style="font-size:14px;color:var(--text)">${escHtml(v)}</div>
        </div>`).join("")}
      <div>
        <div style="font-size:11px;color:var(--text-dim);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;font-weight:600">Case Narrative</div>
        <div style="font-size:14px;color:var(--text-muted);line-height:1.8">${escHtml(c.narrative || "")}</div>
      </div>`;
  }

  const hearingsEl = document.getElementById("cd-hearings");
  if (hearingsEl) {
    const hearingsList = Array.isArray(c.hearings) ? c.hearings : [];
    const todayStr = new Date().toISOString().split("T")[0];
    const sorted = [...hearingsList].sort((a, b) => new Date(a.date) - new Date(b.date));

    let hHtml = `
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">
        <span style="display:flex;align-items:center;gap:6px"><i class="bi bi-bank" style="color:var(--gold)"></i> Court Hearings &amp; History (${sorted.length})</span>
      </div>
    `;

    if (sorted.length === 0) {
      hHtml += `<div style="font-size:12px;color:var(--text-muted);padding:10px 0">No court appearances on record.</div>`;
    } else {
      hHtml += `<div style="display:flex;flex-direction:column;gap:8px">`;
      sorted.forEach(h => {
        const isPast = h.date < todayStr;
        const badgeMarkup = isPast
          ? `<span class="badge" style="background:rgba(255,255,200,0.06);color:var(--text-dim);font-size:9.5px"><i class="bi bi-clock-history"></i> Past Hearing</span>`
          : `<span class="badge" style="background:rgba(52,211,153,0.15);color:var(--green);font-size:9.5px"><i class="bi bi-calendar-event"></i> Upcoming Hearing</span>`;

        hHtml += `
          <div style="padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-left:4px solid ${isPast ? 'var(--text-dim)' : 'var(--green)'};border-radius:8px">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;flex-wrap:wrap">
              ${badgeMarkup}
              <span style="font-weight:700;font-size:12.5px;color:var(--text)">${formatDate(h.date)}</span>
              ${h.time ? `<span style="font-size:11px;color:var(--text-muted)"><i class="bi bi-clock"></i> ${h.time}</span>` : ''}
            </div>
            <div style="font-size:12.5px;font-weight:600;color:var(--gold-light)">${escHtml(h.purpose)}</div>
            ${h.notes ? `<div style="font-size:11.5px;color:var(--text-dim);margin-top:2px;font-style:italic">"${escHtml(h.notes)}"</div>` : ''}
          </div>
        `;
      });
      hHtml += `</div>`;
    }

    if (c.docDueDate) {
      hHtml += `
        <div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-size:10.5px;color:var(--text-dim);text-transform:uppercase;font-weight:700">Pleading Due Date</div>
            <div style="font-size:12.5px;color:var(--gold-light);font-weight:600">${formatDate(c.docDueDate)} ${c.docType ? `(${escHtml(c.docType)})` : ''}</div>
          </div>
          ${dueBadge(c.docDueDate)}
        </div>
      `;
    }

    hearingsEl.innerHTML = hHtml;
  }

  const docs = c.documents || [];
  let docsHtml = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:12px">
    <div style="font-size:15px;font-weight:700;color:var(--text)">Case Files</div>
    ${canEdit ? `
      <div style="display:inline-flex;align-items:center;gap:10px">
        <div style="display:inline-flex;align-items:center;gap:8px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:3px 10px">
          <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text);cursor:pointer;margin:0">
            <input type="radio" name="cd-file-type" value="Inbound" checked style="accent-color:var(--gold);margin:0"/> <i class="bi bi-box-arrow-in-down" style="color:var(--green)"></i> In
          </label>
          <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text);cursor:pointer;margin:0">
            <input type="radio" name="cd-file-type" value="Outbound" style="accent-color:var(--gold);margin:0"/> <i class="bi bi-box-arrow-up" style="color:var(--violet)"></i> Out
          </label>
        </div>
        <button class="btn btn-primary btn-sm" onclick="addDocToCase()"><i class="bi bi-cloud-arrow-up"></i> Upload Document</button>
      </div>` : `<span style="font-size:11px;color:var(--text-dim)"><i class="bi bi-shield-lock"></i> Protected File Repository</span>`
    }
  </div>`;

  if (docs.length === 0) {
    docsHtml += `<div class="upload-area" ${canEdit ? 'onclick="addDocToCase()"' : ''}><div style="font-size:26px;margin-bottom:4px;color:var(--gold)"><i class="bi bi-paperclip"></i></div><div>${canEdit ? 'Click to attach a document' : 'No document records uploaded'}</div></div>`;
  } else {
    const inboundDocs = docs.filter(d => d.fileType === "Inbound");
    const outboundDocs = docs.filter(d => d.fileType === "Outbound");
    const otherDocs = docs.filter(d => d.fileType !== "Inbound" && d.fileType !== "Outbound");

    const renderDocRow = (doc) => {
      const realIdx = docs.findIndex(x => x === doc || (x.driveFileId && x.driveFileId === doc.driveFileId && x.name === doc.name));
      const fileIcon = doc.name.toLowerCase().endsWith(".pdf") 
        ? `<i class="bi bi-file-earmark-pdf-fill" style="color:var(--red);margin-right:6px"></i>`
        : `<i class="bi bi-file-earmark-text-fill" style="color:var(--gold);margin-right:6px"></i>`;

      return `
        <div class="doc-item" style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%">
            <div>
              <div style="font-size:13px;color:var(--text);font-weight:600">
                <span onclick='openFilePreview(${JSON.stringify(doc).replace(/'/g, "&#39;")})' style="cursor:pointer;color:var(--gold);text-decoration:underline;text-underline-offset:3px">
                  ${fileIcon}${escHtml(doc.name)}
                </span>
              </div>
              <div style="font-size:12px;color:var(--text-muted)">
                ${doc.size} · ${doc.date}${doc.driveFileId ? ` · <span style="color:var(--green)"><i class="bi bi-check-circle-fill"></i> Drive</span>` : ""}
              </div>
            </div>
            ${canEdit ? `<button style="background:transparent;border:none;color:var(--red);font-size:15px;cursor:pointer;padding:2px 10px;flex-shrink:0" onclick="removeDocFromCase(${realIdx})" title="Delete File"><i class="bi bi-trash3-fill"></i></button>` : ""}
          </div>
        </div>
      `;
    };

    if (inboundDocs.length > 0) {
      docsHtml += `<div style="font-size:11px;font-weight:700;color:var(--text-dim);margin:14px 0 6px;text-transform:uppercase;letter-spacing:1px"><i class="bi bi-box-arrow-in-down" style="color:var(--green)"></i> Inbound Documents</div>`;
      inboundDocs.forEach(d => { docsHtml += renderDocRow(d); });
    }

    if (outboundDocs.length > 0) {
      docsHtml += `<div style="font-size:11px;font-weight:700;color:var(--text-dim);margin:14px 0 6px;text-transform:uppercase;letter-spacing:1px"><i class="bi bi-box-arrow-up" style="color:var(--violet)"></i> Outbound Documents</div>`;
      outboundDocs.forEach(d => { docsHtml += renderDocRow(d); });
    }

    if (otherDocs.length > 0) {
      docsHtml += `<div style="font-size:11px;font-weight:700;color:var(--text-dim);margin:14px 0 6px;text-transform:uppercase;letter-spacing:1px"><i class="bi bi-files" style="color:var(--gold)"></i> Other Files</div>`;
      otherDocs.forEach(d => { docsHtml += renderDocRow(d); });
    }
  }
  
  const docsEl = document.getElementById("cd-docs");
  if (docsEl) docsEl.innerHTML = docsHtml;

  const statusPanelEl = document.getElementById("cd-status-panel");
  if (statusPanelEl) {
    if (canEdit) {
      statusPanelEl.innerHTML = `
        <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:14px">Update Status</div>
        ${STATUS_OPTIONS.map(st => `
          <button onclick="confirmUpdateCaseStatus('${st}')" style="display:block;width:100%;margin-bottom:8px;padding:10px 16px;border-radius:10px;border:1px solid ${c.status === st ? statusColor(st) : "var(--border)"};background:${c.status === st ? statusColor(st) + "18" : "transparent"};color:${c.status === st ? statusColor(st) : "var(--text)"};text-align:left;cursor:pointer;font-size:13px;font-family:var(--font-body);font-weight:${c.status === st ? 700 : 500};transition:all 0.2s">
            ${c.status === st ? '<i class="bi bi-check-lg" style="margin-right:6px"></i>' : ""}${st}
          </button>`).join("")}`;
    } else {
      statusPanelEl.innerHTML = `
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:10px">Current Status</div>
        ${badge(c.status, statusColor(c.status))}
      `;
    }
  }
}

// CASE STATUS CONFIRMATION
window.confirmUpdateCaseStatus = function(st) {
  if (!selCase || selCase.status === st) return;

  window.openConfirmModal({
    icon: "bi-arrow-repeat",
    title: "Update Case Status?",
    body: `Are you sure you want to update the status of <strong>"${escHtml(selCase.title)}"</strong> to <strong style="color:${statusColor(st)}">"${st}"</strong>?`,
    confirmText: "Update Status",
    confirmStyle: "btn-primary",
    onConfirm: () => updateCaseStatus(st)
  });
};

async function updateCaseStatus(st) {
  try {
    const upd = { ...selCase, status: st };
    await dbUpdateCase(selCase.id, { status: st });
    selCase = upd;
    renderCaseDetail();
    showToast(`Status updated to "${st}"`);
  } catch (err) {
    console.error("updateCaseStatus error:", err);
    showToast("Failed to update status: " + (err.message || "Unknown error"), "error");
  }
}

// CASE DOCUMENT DELETION CONFIRMATION
async function removeDocFromCase(idx) {
  const docs = selCase.documents || [];
  const doc = docs[idx];
  if (!doc) return;

  window.openConfirmModal({
    icon: "bi-trash3",
    title: "Delete Case Document?",
    body: `Are you sure you want to delete <strong>"${escHtml(doc.name)}"</strong>?<br>This will permanently remove the document from this case and Google Drive.`,
    confirmText: "Delete Document",
    confirmStyle: "btn-danger",
    onConfirm: async () => {
      try {
        showToast("Deleting file...");
        if (doc.driveFileId && typeof deleteDriveFile === "function") {
          await deleteDriveFile(doc.driveFileId);
        }
        const updDocs = docs.filter((_, i) => i !== idx);
        await dbUpdateCase(selCase.id, { documents: updDocs });
        selCase = { ...selCase, documents: updDocs };
        renderCaseDetail();
        showToast("Document deleted successfully!");
      } catch (err) {
        console.error("removeDocFromCase error:", err);
        showToast("Failed to remove document: " + (err.message || "Unknown error"), "error");
      }
    }
  });
}

window.renderCaseDetail = renderCaseDetail;

// ═══════════════════════════════════════════════════════════════
//  QUICK ACCESS SIDEBAR
// ═══════════════════════════════════════════════════════════════
function renderQuickAccess() {
  const qa = document.getElementById("quick-access");
  const ql = document.getElementById("quick-list");
  if (!qa || !ql) return;
  
  if (profiles.length === 0) { qa.style.display = "none"; return; }
  qa.style.display = "block";
  ql.innerHTML = profiles.slice(0, 7).map(p => `
    <button class="nav-btn ${selProfile?.id === p.id ? 'active' : ''}" style="gap:10px;padding:10px 24px" onclick="openProfile('${p.id}')">
      ${p.photoUrl
        ? `<img src="${p.photoUrl}" alt="${initials(p.name)}" class="quick-avatar" style="object-fit:cover;border:2px solid ${p.avatarColor || '#c9a84c'}">`
        : `<span class="quick-avatar" style="background:${p.avatarColor}22;border:2px solid ${p.avatarColor};color:${p.avatarColor}">${initials(p.name)}</span>`
      }
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px">${escHtml(p.name)}</span>
    </button>`).join("");
}

function openProfile(id) {
  selProfile = profiles.find(p => p.id === id);
  if (!selProfile) return;
  showView("profileDetail");
  renderProfileDetail();
}

function openCase(id) {
  caseDetailOrigin = currentView;
  selCase = cases.find(c => c.id === id);
  if (!selCase) return;
  const p = profiles.find(x => x.id === selCase.profileId);
  if (p) selProfile = p;
  showView("caseDetail");
  renderCaseDetail();
}

window.openProfile = openProfile;
window.openCase = openCase;

function renderSidebarUser() {
  const chip = document.getElementById("sidebar-user-chip");
  const adminSection = document.getElementById("admin-sidebar-section");
  if (!chip) return;

  const u = window._currentUser;
  if (!u) {
    chip.style.display = "none";
    if (adminSection) adminSection.style.display = "none";
    return;
  }

  const myProf = profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase()));
  if (!myProf) {
    chip.style.display = "none";
    if (adminSection) adminSection.style.display = "none";
    return;
  }

  chip.innerHTML = `
    ${avatarDiv(myProf.name, myProf.avatarColor, 28, myProf.photoUrl)}
    <div style="flex:1;min-width:0;text-align:left">
      <div class="sidebar-user-name" style="font-size:12px;font-weight:700;color:#ffffff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(myProf.name)}</div>
      <div class="sidebar-user-role" style="font-size:10px;color:var(--gold);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(myProf.role || "Attorney")}</div>
    </div>
  `;
  chip.style.display = "flex";

  const isAdmin = myProf.role === "admin" || (typeof ADMIN_EMAILS !== "undefined" && ADMIN_EMAILS.some(e => e.toLowerCase() === (u.email||"").toLowerCase()));
  const isDev = myProf.role === "developer";

  if (adminSection) {
    adminSection.style.display = (isAdmin || isDev) ? "block" : "none";
  }
}

window.renderSidebarUser = renderSidebarUser;

function openCurrentProfile() {
  if (selProfile) openProfile(selProfile.id);
}
window.openCurrentProfile = openCurrentProfile;

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
  const days = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
  const formatted = formatDate(dueDate);
  if (days < 0)   return `<span style="font-size:11px;font-weight:700;color:var(--red)"><i class="bi bi-exclamation-circle-fill" style="margin-right:3px"></i>Overdue (${formatted})</span>`;
  if (days === 0) return `<span style="font-size:11px;font-weight:700;color:var(--red)"><i class="bi bi-exclamation-circle-fill" style="margin-right:3px"></i>Due today</span>`;
  if (days <= 7)  return `<span style="font-size:11px;font-weight:700;color:var(--amber)">${days}d left (${formatted})</span>`;
  if (days <= 30) return `<span style="font-size:11px;font-weight:600;color:var(--gold)">${days}d (${formatted})</span>`;
  return `<span style="font-size:11px;color:var(--text-muted)">Due ${formatted}</span>`;
}

// ═══════════════════════════════════════════════════════════════
//  FILTER DROPDOWNS
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
  if (prefix === "ac") {
    currentAllCasesPage = 1;
    renderAllCases();
  }
}

window.updateAllFilterDropdowns = updateAllFilterDropdowns;
window.refreshFilterTypes = refreshFilterTypes;
window.onFilterCategoryChange = onFilterCategoryChange;

// ═══════════════════════════════════════════════════════════════
//  PERSONAL SETTINGS (ZERO ACCOUNT DELETION)
// ═══════════════════════════════════════════════════════════════
let settingsPhotoDataUrl = null;

function renderMyProfile() {
  const u = window._currentUser;
  if (!u) return;

  const myProf = profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase()));
  if (!myProf) return;

  const nameEl = document.getElementById("setting-name");
  const roleEl = document.getElementById("setting-role");
  const contactEl = document.getElementById("setting-contact");
  const emailEl = document.getElementById("setting-email");
  const passEl = document.getElementById("setting-password");
  const curPassEl = document.getElementById("setting-current-password");
  const reauthEl = document.getElementById("setting-reauth-panel");

  if (nameEl) {
    nameEl.value = myProf.name || "";
    nameEl.classList.remove("err");
  }
  if (roleEl) {
    roleEl.value = myProf.role || "Attorney";
    roleEl.classList.remove("err");
  }
  if (contactEl) {
    contactEl.value = myProf.contact || "";
    contactEl.classList.remove("err");
  }
  if (emailEl) emailEl.value = u.email || "";
  if (passEl) passEl.value = "";
  if (curPassEl) curPassEl.value = "";
  if (reauthEl) reauthEl.style.display = "none";

  settingsPhotoDataUrl = myProf.photoUrl || null;
  if (settingsPhotoDataUrl) {
    showSettingsPhotoPreview(settingsPhotoDataUrl, myProf.name, myProf.role);
  } else {
    resetSettingsPhotoUpload();
  }

  const statusEl = document.getElementById("settings-drive-status");
  const btn = document.getElementById("settings-connect-drive-btn");
  const btnText = document.getElementById("settings-connect-drive-text");
  const disconnectBtn = document.getElementById("settings-disconnect-drive-btn");

  if (statusEl && btn && btnText) {
    if (hasValidToken()) {
      statusEl.className = "drive-status-chip connected";
      statusEl.innerHTML = `<i class="bi bi-check-circle-fill" style="color:var(--green)"></i> Connected`;
      btnText.textContent = "✓ Connected";
      btn.classList.add("connected");
      btn.disabled = true;
      if (disconnectBtn) disconnectBtn.classList.remove("hidden");
    } else {
      statusEl.className = "drive-status-chip disconnected";
      statusEl.innerHTML = `<i class="bi bi-circle-fill" style="color:var(--amber)"></i> Not Connected`;
      btnText.textContent = "Connect Google Drive";
      btn.classList.remove("connected");
      btn.disabled = false;
      if (disconnectBtn) disconnectBtn.classList.add("hidden");
    }
  }

  const tfaBadge = document.getElementById("setting-2fa-status-badge");
  const tfaBtn = document.getElementById("setting-2fa-action-btn");
  const tfaBackupWrap = document.getElementById("setting-2fa-backup-wrap");

  if (tfaBadge && tfaBtn) {
    if (myProf.twoFactorEnabled) {
      tfaBadge.className = "badge";
      tfaBadge.style.background = "rgba(52,211,153,0.15)";
      tfaBadge.style.color = "var(--green)";
      tfaBadge.innerHTML = `<i class="bi bi-shield-check"></i> 2FA Active`;

      tfaBtn.className = "btn btn-danger btn-sm";
      tfaBtn.innerHTML = `<i class="bi bi-shield-x"></i> Disable 2FA`;
      tfaBtn.onclick = disableTwoFactor;

      if (tfaBackupWrap) tfaBackupWrap.style.display = "block";
    } else {
      tfaBadge.className = "badge";
      tfaBadge.style.background = "rgba(251,191,36,0.15)";
      tfaBadge.style.color = "var(--amber)";
      tfaBadge.innerHTML = `<i class="bi bi-circle-fill" style="font-size:8px"></i> Not Configured`;

      tfaBtn.className = "btn btn-primary btn-sm";
      tfaBtn.innerHTML = `<i class="bi bi-qr-code-scan"></i> Configure Authenticator`;
      tfaBtn.onclick = openTwoFactorSetupModal;

      if (tfaBackupWrap) tfaBackupWrap.style.display = "none";
    }
  }
}

window.renderMyProfile = renderMyProfile;

async function connectDriveFromSettings() {
  const btn = document.getElementById("settings-connect-drive-btn");
  const btnText = document.getElementById("settings-connect-drive-text");
  if (!btn) return;

  btn.disabled = true;
  if (btnText) btnText.textContent = "Connecting...";

  try {
    await promptDriveAuth(true);
    showToast("Google Drive connected successfully!");
    renderMyProfile();
    updateWorkspaceStatus(false);
    
    const u = window._currentUser;
    const myProf = u ? profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase())) : null;
    if (myProf && !myProf.driveFolderId) {
      showToast("Initializing attorney Drive storage folder...");
      try {
        const folderId = await createDriveFolder(`Simando Law — ${myProf.name}`, DRIVE_FOLDER_ID || null);
        if (folderId) {
          await dbUpdateProfile(myProf.id, { driveFolderId: folderId }).catch(e => console.warn("Profile update note:", e));
          myProf.driveFolderId = folderId;
          showToast("Storage folder created!");
          updateWorkspaceStatus(false);
        }
      } catch (folderErr) {
        console.warn("Folder initialization notice:", folderErr);
      }
    }
  } catch (err) {
    console.error("Settings drive auth failed:", err);
    if (btnText) btnText.textContent = "Connect Google Drive";
    btn.disabled = false;
    showToast("Drive connection failed: " + err.message, "error");
  }
}

window.connectDriveFromSettings = connectDriveFromSettings;

function showSettingsPhotoPreview(url, name, role) {
  const dropzone = document.getElementById("setting-photo-dropzone");
  const wrap = document.getElementById("setting-photo-preview-wrap");
  const img = document.getElementById("setting-photo-preview-img");
  const namePrev = document.getElementById("setting-name-preview");
  const rolePrev = document.getElementById("setting-role-preview");

  if (dropzone) dropzone.style.display = "none";
  if (wrap) wrap.style.display = "flex";
  if (img) img.src = url;
  if (namePrev) namePrev.textContent = name || "Attorney Name";
  if (rolePrev) rolePrev.textContent = role || "Role";
}

function resetSettingsPhotoUpload() {
  const dropzone = document.getElementById("setting-photo-dropzone");
  const wrap = document.getElementById("setting-photo-preview-wrap");
  const input = document.getElementById("setting-photo-input");

  if (dropzone) dropzone.style.display = "block";
  if (wrap) wrap.style.display = "none";
  if (input) input.value = "";
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
    const nameVal = document.getElementById("setting-name")?.value || "";
    const roleVal = document.getElementById("setting-role")?.value || "";
    showSettingsPhotoPreview(settingsPhotoDataUrl, nameVal, roleVal);
  };
  reader.readAsDataURL(file);
}

function removeSettingsPhoto() {
  resetSettingsPhotoUpload();
}

window.handleSettingsPhotoUpload = handleSettingsPhotoUpload;
window.removeSettingsPhoto = removeSettingsPhoto;

async function saveUserSettings() {
  const u = window._currentUser;
  if (!u) return;

  const myProf = profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase()));
  if (!myProf) return;

  const name = (document.getElementById("setting-name")?.value || "").trim();
  const role = (document.getElementById("setting-role")?.value || "").trim();
  const contact = (document.getElementById("setting-contact")?.value || "").trim();

  if (!name || !role) {
    showToast("Display Name and Role are required.", "error");
    return;
  }
  if (contact && !isValidMobile(contact)) {
    showToast("Contact number must be exactly 11 digits.", "error");
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
    updateWorkspaceStatus(false);
  } catch (err) {
    console.error("saveUserSettings error:", err);
    showToast("Failed to save settings: " + err.message, "error");
  }
}

async function saveSecuritySettings() {
  const u = window._currentUser;
  if (!u) return;

  const email = (document.getElementById("setting-email")?.value || "").trim();
  const pass = document.getElementById("setting-password")?.value || "";
  const currentPass = document.getElementById("setting-current-password")?.value || "";

  if (email === u.email && !pass) {
    showToast("No security modifications requested.");
    return;
  }

  if (email && !isValidEmail(email)) {
    showToast("Email must be a valid @gmail.com or @outlook.com address.", "error");
    return;
  }

  if (pass && pass.length < 6) {
    showToast("Password must be at least 6 characters.", "error");
    return;
  }

  const reauthPanel = document.getElementById("setting-reauth-panel");
  if (reauthPanel && reauthPanel.style.display === "none") {
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
    if (reauthPanel) reauthPanel.style.display = "none";
  } catch (err) {
    console.error("Credentials update failed:", err);
    showToast("Verification failed: " + err.message, "error");
  }
}

window.saveUserSettings = saveUserSettings;
window.saveSecuritySettings = saveSecuritySettings;

// ═══════════════════════════════════════════════════════════════
//  SIGN OUT
// ═══════════════════════════════════════════════════════════════
async function handleLogout() {
  try {
    if (typeof dbUnsubscribe === "function") dbUnsubscribe();
    if (window._fbSignOut) {
      sessionStorage.removeItem("simando_2fa_verified");
      await window._fbSignOut(window._auth);
      window.location.replace("login.html");
    }
  } catch (err) {
    console.error("Signout error:", err);
  }
}

window.handleLogout = handleLogout;

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseGoogleDateTime(isoString) {
  if (!isoString) return { dateStr: "", timeStr: "", dateObj: new Date(), isAllDay: false };

  if (isoString.length === 10 && !isoString.includes("T")) {
    const parts = isoString.split("-");
    const yr = parseInt(parts[0], 10);
    const mo = parseInt(parts[1], 10) - 1;
    const dy = parseInt(parts[2], 10);
    const dateObj = new Date(yr, mo, dy);
    const dateStr = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return { dateStr, timeStr: "All Day", dateObj, isAllDay: true };
  }

  const match = isoString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!match) {
    const d = new Date(isoString);
    return {
      dateStr: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      timeStr: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
      dateObj: d,
      isAllDay: false
    };
  }

  const yr = parseInt(match[1], 10);
  const mo = parseInt(match[2], 10) - 1;
  const dy = parseInt(match[3], 10);
  const hh = parseInt(match[4], 10);
  const mm = match[5];

  const dateObj = new Date(yr, mo, dy, hh, parseInt(mm, 10));
  const dateStr = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const ampm = hh >= 12 ? "PM" : "AM";
  const displayHour = hh % 12 === 0 ? 12 : hh % 12;
  const timeStr = `${displayHour}:${mm} ${ampm}`;

  return { dateStr, timeStr, dateObj, isAllDay: false };
}

window.openCalendarEventModal = function(index) {
  const events = window._fetchedCalendarEvents;
  if (!events || !events[index]) return;
  const ev = events[index];

  const modal = document.getElementById("calendar-event-modal");
  if (!modal) return;

  const titleEl    = document.getElementById("cem-title");
  const timeEl     = document.getElementById("cem-time");
  const locationEl = document.getElementById("cem-location");
  const descEl     = document.getElementById("cem-desc");
  const linkEl     = document.getElementById("cem-link");

  const start = ev.start.dateTime || ev.start.date;
  const end   = ev.end?.dateTime || ev.end?.date;
  
  const parsedStart = parseGoogleDateTime(start);
  const parsedEnd   = parseGoogleDateTime(end);

  let timeString = parsedStart.dateStr;
  if (!parsedStart.isAllDay) {
    timeString += ` · ${parsedStart.timeStr}`;
    if (end && parsedEnd.timeStr && !parsedEnd.isAllDay) {
      timeString += ` - ${parsedEnd.timeStr}`;
    }
  } else {
    timeString += " (All Day)";
  }

  if (titleEl) titleEl.innerHTML = `<i class="bi bi-calendar-event" style="color:var(--gold);margin-right:6px"></i> ${escHtml(ev.summary || "No Title")}`;
  if (timeEl) timeEl.textContent = timeString;
  if (locationEl) locationEl.textContent = ev.location || "No venue/location specified";
  if (descEl) descEl.textContent = ev.description || "No description provided.";
  
  if (linkEl) {
    if (ev.htmlLink) {
      linkEl.href = ev.htmlLink;
      linkEl.style.display = "inline-flex";
    } else {
      linkEl.style.display = "none";
    }
  }

  modal.classList.remove("hidden");
};

window.closeCalendarModal = function() {
  const modal = document.getElementById("calendar-event-modal");
  if (modal) modal.classList.add("hidden");
};

async function fetchAndRenderGoogleCalendarEvents() {
  const card = document.getElementById("dash-calendar-card");
  if (!card) return;

  let html = `<div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:18px;display:flex;align-items:center;gap:8px;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:8px">
      <i class="bi bi-calendar3" style="color:var(--gold);font-size:18px"></i> Google Calendar Agenda
    </div>
    <button onclick="fetchAndRenderGoogleCalendarEvents()" class="btn btn-ghost" style="font-size:11px;padding:4px 8px" title="Refresh Agenda"><i class="bi bi-arrow-clockwise"></i> Refresh</button>
  </div>`;

  if (!hasValidToken()) {
    html += `<div style="text-align:center;padding:24px 12px;color:var(--text-muted);border:1px dashed var(--border);border-radius:10px">
      <div style="font-size:24px;margin-bottom:8px;color:var(--gold)"><i class="bi bi-cloud-slash"></i></div>
      <div style="font-size:12px;font-weight:600">Google Calendar Not Synced</div>
      <div style="font-size:11px;margin-top:4px">Authorize Google Calendar under <a href="#" onclick="navTo('myprofile'); return false;" style="color:var(--gold);text-decoration:underline">My Settings</a> to sync case deadlines and view your agenda live.</div>
    </div>`;
    card.innerHTML = html;
    return;
  }

  try {
    card.innerHTML = html + `<div style="text-align:center;padding:20px"><span class="spinner" style="border-top-color:var(--gold)"></span></div>`;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const timeMin = today.toISOString();
    
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&singleEvents=true&orderBy=startTime&maxResults=6`;
    
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errorObj = new Error(errData.error?.message || "Failed to load events");
      errorObj.status = res.status;
      throw errorObj;
    }

    const data = await res.json();
    const events = data.items || [];
    window._fetchedCalendarEvents = events;

    if (events.length === 0) {
      html += `<div style="text-align:center;padding:24px 12px;color:var(--text-muted);border:1px dashed var(--border);border-radius:10px;font-size:12px">
        No upcoming events found on your Google Calendar.
      </div>`;
    } else {
      html += `<div style="display:flex;flex-direction:column;gap:10px">`;
      events.forEach((ev, i) => {
        const start = ev.start.date || ev.start.dateTime;
        const parsedStart = parseGoogleDateTime(start);
        
        const dateStr   = parsedStart.dateStr;
        const timeStr   = parsedStart.timeStr;
        const eventDate = parsedStart.dateObj;
        
        const locationMarkup = ev.location ? `<div style="font-size:11.5px;color:var(--text-muted);margin-top:2px;display:flex;align-items:center;gap:4px"><i class="bi bi-geo-alt-fill" style="color:var(--gold)"></i> ${escHtml(ev.location)}</div>` : "";
        const descriptionMarkup = ev.description ? `<div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-style:italic">"${escHtml(ev.description.slice(0, 50))}${ev.description.length > 50 ? '...' : ''}"</div>` : "";

        const weekdayStr = eventDate.toLocaleDateString("en-US", { weekday: "short" });

        html += `
          <div onclick="openCalendarEventModal(${i})" style="display:flex;gap:12px;align-items:center;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;cursor:pointer;transition:all 0.2s" onmouseenter="this.style.borderColor='var(--gold-border)';this.style.background='var(--surface3)'" onmouseleave="this.style.borderColor='var(--border)';this.style.background='var(--surface2)'">
            <div style="text-align:center;background:rgba(201,168,76,0.1);border:1px solid var(--gold-border);border-radius:8px;padding:6px;min-width:48px">
              <div style="font-size:10px;font-weight:700;color:var(--gold);text-transform:uppercase">${weekdayStr}</div>
              <div style="font-size:14px;font-weight:700;color:var(--text);margin-top:1px">${eventDate.getDate()}</div>
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escHtml(ev.summary || 'No Title')}">${escHtml(ev.summary || 'No Title')}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px"><i class="bi bi-calendar-event" style="color:var(--gold);margin-right:2px"></i> ${dateStr} · <i class="bi bi-clock" style="color:var(--gold);margin-right:2px"></i> ${timeStr}</div>
              ${locationMarkup}
              ${descriptionMarkup}
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }
  } catch (err) {
    console.error("fetchAndRenderGoogleCalendarEvents error:", err);
    if (err.status === 401) {
      fetchAndRenderGoogleCalendarEvents();
      return;
    }
  }
  card.innerHTML = html;
}

window.fetchAndRenderGoogleCalendarEvents = fetchAndRenderGoogleCalendarEvents;

// ═══════════════════════════════════════════════════════════════
//  NOTIFICATIONS & CHAT DROPDOWNS
// ═══════════════════════════════════════════════════════════════
window.toggleNotifDropdown = function() {
  const dropdown = document.getElementById("notif-dropdown");
  if (!dropdown) return;
  
  const willOpen = dropdown.classList.contains("hidden");
  dropdown.classList.toggle("hidden");

  if (willOpen) {
    const chatPanel = document.getElementById("chat-panel");
    if (chatPanel && !chatPanel.classList.contains("hidden")) {
      chatPanel.classList.add("hidden");
    }
    renderNotificationsView();
  }
};

document.addEventListener("click", (e) => {
  const container = document.getElementById("top-hdr-actions");
  const dropdown = document.getElementById("notif-dropdown");
  if (container && dropdown && !container.contains(e.target)) {
    dropdown.classList.add("hidden");
  }
});

function updateNotificationBadge() {
  const badgeEl = document.getElementById("global-notif-badge");
  if (!badgeEl) return;
  const unreadCount = notifications.filter(n => n.status === "unread").length;
  if (unreadCount > 0) {
    badgeEl.textContent = unreadCount;
    badgeEl.style.display = "inline-flex";
  } else {
    badgeEl.style.display = "none";
  }
}

window.updateNotificationBadge = updateNotificationBadge;

window.handleNotifClick = async function(notifId, type, relatedId, fromUid, fromName) {
  if (notifId) {
    markNotificationRead(notifId);
  }

  const dropdown = document.getElementById("notif-dropdown");
  if (dropdown) dropdown.classList.add("hidden");

  if ((type === "case_due" || type === "case_share") && relatedId) {
    openCase(relatedId);
  } else if (type === "availability_request" || type === "availability_confirmed") {
    if (window._chat) {
      if (typeof window._chat.toggleDock === "function" && !document.getElementById("chat-panel")?.classList.contains("open")) {
        window._chat.toggleDock();
      }
      if (fromUid && typeof window._chat.openConversation === "function") {
        window._chat.openConversation(fromUid, fromName || "Attorney", false);
      }
    }
  }
};

function renderNotificationsView() {
  const listEl = document.getElementById("notifications-list");
  if (!listEl) return;

  if (notifications.length === 0) {
    listEl.innerHTML = `<div class="empty-state" style="padding:24px 10px"><div class="empty-state-icon" style="font-size:28px;margin-bottom:6px;color:var(--gold)"><i class="bi bi-bell-slash"></i></div><div style="font-size:12px;color:var(--text-muted)">No notifications found.</div></div>`;
    return;
  }

  listEl.innerHTML = notifications.map(n => {
    const isUnread = n.status === "unread";
    const dateStr = n.createdAt ? new Date(n.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "N/A";
    
    let actions = "";
    if (n.type === "appointment_request" && n.appointmentStatus === "pending") {
      actions = `
        <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" style="padding:4px 8px;font-size:10px" onclick="event.stopPropagation(); acceptAppointmentRequest('${n.id}', '${n.relatedId}')"><i class="bi bi-check2"></i> Accept</button>
          <button class="btn btn-danger btn-sm" style="padding:4px 8px;font-size:10px" onclick="event.stopPropagation(); declineAppointmentRequest('${n.id}', '${n.relatedId}')"><i class="bi bi-x"></i> Decline</button>
          <button class="btn btn-secondary btn-sm" style="padding:4px 8px;font-size:10px" onclick="event.stopPropagation(); handleNotifClick('${n.id}', '${n.type}', '${n.relatedId}', '${n.fromUid}', '${escHtml(n.fromName)}')"><i class="bi bi-chat-dots-fill" style="color:var(--gold)"></i> Chat</button>
        </div>
      `;
    } else if (n.type === "appointment_request") {
      const statusText = (n.appointmentStatus || "").toUpperCase();
      const colorVal = n.appointmentStatus === "accepted" ? "var(--green)" : "var(--red)";
      actions = `<div style="font-size:10px;font-weight:700;color:${colorVal};margin-top:6px"><i class="bi bi-circle-fill" style="font-size:7px;margin-right:3px"></i>PROPOSAL ${statusText}</div>`;
    } else if (n.type === "availability_request" || n.type === "availability_confirmed") {
      actions = `
        <div style="margin-top:8px">
          <button class="btn btn-secondary btn-sm" style="padding:4px 8px;font-size:10px" onclick="event.stopPropagation(); handleNotifClick('${n.id}', '${n.type}', '${n.relatedId}', '${n.fromUid}', '${escHtml(n.fromName)}')"><i class="bi bi-chat-dots-fill" style="color:var(--gold)"></i> Go to Chat Stream</button>
        </div>
      `;
    }

    return `
      <div class="doc-item" onclick="handleNotifClick('${n.id}', '${n.type}', '${n.relatedId}', '${n.fromUid}', '${escHtml(n.fromName)}')" style="border-left: 3px solid ${isUnread ? 'var(--gold)' : 'var(--border)'}; background: ${isUnread ? 'var(--surface2)' : 'transparent'}; margin-bottom: 8px; padding: 10px 12px; font-size: 12px; cursor: pointer;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%">
          <div style="flex:1;min-width:0;padding-right:6px">
            <div style="font-weight:700;font-size:12.5px;color:var(--text);margin-bottom:2px">${escHtml(n.title)}</div>
            <div style="font-size:11.5px;color:var(--text-muted);line-height:1.4">${escHtml(n.message)}</div>
            <div style="font-size:10px;color:var(--text-dim);margin-top:4px">${dateStr}</div>
            ${actions}
          </div>
          ${isUnread ? '<button class="btn btn-ghost" style="font-size:10px;padding:2px 6px;flex-shrink:0" onclick="event.stopPropagation(); markNotificationRead(\'' + n.id + '\')">Mark read</button>' : ""}
        </div>
      </div>
    `;
  }).join("");
}

window.renderNotificationsView = renderNotificationsView;

window.markNotificationRead = async function(id) {
  const notif = notifications.find(n => n.id === id);
  if (notif) {
    notif.status = "read";
    updateNotificationBadge();
    renderNotificationsView();
  }
  try {
    await dbUpdateNotification(id, { status: "read" });
  } catch (err) {
    console.error("markNotificationRead error:", err);
  }
};

window.markAllNotificationsAsRead = async function() {
  notifications.forEach(n => { n.status = "read"; });
  updateNotificationBadge();
  renderNotificationsView();

  try {
    showToast("Clearing alerts...");
    for (const n of notifications) {
      await dbUpdateNotification(n.id, { status: "read" });
    }
    showToast("All notifications cleared!");
  } catch (err) {
    console.error("markAllNotificationsAsRead error:", err);
  }
};

// ═══════════════════════════════════════════════════════════════
//  APPOINTMENTS
// ═══════════════════════════════════════════════════════════════
let targetApptProfile = null;

window.openAppointmentModal = function(profileId) {
  const p = profiles.find(x => x.id === profileId);
  if (!p) return;
  targetApptProfile = p;

  const todayStr = new Date().toISOString().split("T")[0];

  const titleInp = document.getElementById("appt-title");
  const dateInp = document.getElementById("appt-date");
  const timeInp = document.getElementById("appt-time");
  const descInp = document.getElementById("appt-desc");
  const modalSub = document.getElementById("appointment-modal-sub");

  if (titleInp) titleInp.value = "";
  if (dateInp) {
    dateInp.value = "";
    dateInp.min = todayStr;
  }
  if (timeInp) timeInp.value = "";
  if (descInp) descInp.value = "";
  if (modalSub) modalSub.textContent = `Propose an appointment with ${p.name}`;
  
  const modal = document.getElementById("appointment-modal");
  if (modal) modal.classList.remove("hidden");
};

window.closeAppointmentModal = function() {
  const modal = document.getElementById("appointment-modal");
  if (modal) modal.classList.add("hidden");
  targetApptProfile = null;
};

window.submitAppointmentRequest = async function() {
  const title = (document.getElementById("appt-title")?.value || "").trim();
  const date = document.getElementById("appt-date")?.value || "";
  const time = document.getElementById("appt-time")?.value || "";
  const desc = (document.getElementById("appt-desc")?.value || "").trim();

  if (!title || !date || !time) {
    showToast("Please fill in all required fields.", "error");
    return;
  }

  const todayObj = new Date();
  const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
  if (date < todayStr) {
    showToast("Cannot propose appointments on past dates.", "error");
    return;
  }

  const u = window._currentUser;
  const myProf = profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase()));
  if (!myProf || !targetApptProfile) return;

  try {
    showToast("Sending request...");
    
    const apptData = {
      title,
      date,
      time,
      description: desc,
      requesterUid: u.uid,
      requesterName: myProf.name,
      targetUid: targetApptProfile.ownerUid,
      targetName: targetApptProfile.name,
      status: "pending"
    };
    const apptId = await dbAddAppointment(apptData);

    const notifData = {
      toUid: targetApptProfile.ownerUid,
      fromUid: u.uid,
      fromName: myProf.name,
      title: "New Appointment Proposal",
      message: `${myProf.name} proposed an appointment "${title}" on ${formatDate(date)} at ${time}.`,
      type: "appointment_request",
      relatedId: apptId,
      status: "unread",
      appointmentStatus: "pending"
    };
    await dbAddNotification(notifData);

    showToast("Schedule request sent!");
    closeAppointmentModal();
  } catch (err) {
    console.error("submitAppointmentRequest error:", err);
    showToast("Failed to request appointment: " + err.message, "error");
  }
};

window.acceptAppointmentRequest = async function(notifId, apptId) {
  try {
    showToast("Approving proposal...");
    await dbUpdateAppointment(apptId, { status: "accepted" });
    await dbUpdateNotification(notifId, { appointmentStatus: "accepted", status: "read" });
    showToast("Appointment confirmed!");
  } catch (err) {
    console.error("acceptAppointmentRequest error:", err);
  }
};

window.declineAppointmentRequest = async function(notifId, apptId) {
  try {
    showToast("Declining request...");
    await dbUpdateAppointment(apptId, { status: "declined" });
    await dbUpdateNotification(notifId, { appointmentStatus: "declined", status: "read" });
    showToast("Request declined.");
  } catch (err) {
    console.error("declineAppointmentRequest error:", err);
  }
};

// ═══════════════════════════════════════════════════════════════
//  CASE FORM INITIALIZATION
// ═══════════════════════════════════════════════════════════════
function populateCaseSelects(isEdit = false) {
  const catSel = document.getElementById("cf-category");
  const statusSel = document.getElementById("cf-status");
  const venueSel = document.getElementById("cf-venue");
  
  if (catSel) catSel.innerHTML = CASE_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("");
  
  const optionsToUse = isEdit ? STATUS_OPTIONS : (typeof NEW_CASE_STATUS_OPTIONS !== "undefined" ? NEW_CASE_STATUS_OPTIONS : ["On-going", "Pending"]);
  if (statusSel) statusSel.innerHTML = optionsToUse.map(t => `<option value="${t}">${t}</option>`).join("");
  
  if (venueSel) venueSel.innerHTML = VENUES.map(v => `<option value="${v}">${v}</option>`).join("");
}

window.populateCaseSelects = populateCaseSelects;

// ═══════════════════════════════════════════════════════════════
//  GOOGLE DRIVE EXPLORER
// ═══════════════════════════════════════════════════════════════
let currentExplorerFolderId = "root";
let explorerBreadcrumbs = [];

window.initDriveExplorer = function() {
  const u = window._currentUser;
  const myProf = u ? profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase())) : null;
  const startFolder = (myProf && myProf.driveFolderId) ? myProf.driveFolderId : (DRIVE_FOLDER_ID || "root");

  currentExplorerFolderId = startFolder;
  explorerBreadcrumbs = [{ id: currentExplorerFolderId, name: "Firm Drive" }];
  loadExplorerFiles();
};

window.loadExplorerFiles = async function() {
  const listEl = document.getElementById("mydrive-explorer-list");
  const emptyEl = document.getElementById("mydrive-empty-state");
  const nativeBtn = document.getElementById("mydrive-open-native-btn");

  if (!listEl) return;

  renderExplorerBreadcrumbs();

  if (nativeBtn) {
    const u = window._currentUser;
    const myProf = u ? profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase())) : null;
    const targetFolder = (currentExplorerFolderId && currentExplorerFolderId !== "root") 
      ? currentExplorerFolderId 
      : (myProf?.driveFolderId || DRIVE_FOLDER_ID || "");

    nativeBtn.href = (targetFolder && targetFolder !== "root") 
      ? "https://drive.google.com/drive/folders/" + targetFolder 
      : "https://drive.google.com";
  }

  if (!hasValidToken()) {
    listEl.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)">
      <div style="font-size:28px;margin-bottom:8px;color:var(--gold)"><i class="bi bi-cloud-slash"></i></div>
      <div style="font-size:13px;font-weight:600">Google Drive Session Expired</div>
      <div style="font-size:11px;margin-top:4px">Please re-authenticate under My Settings to view file explorer records.</div>
    </div>`;
    if (emptyEl) emptyEl.classList.add("hidden");
    return;
  }

  try {
    listEl.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px"><span class="spinner" style="border-top-color:var(--gold)"></span></div>`;
    if (emptyEl) emptyEl.classList.add("hidden");

    let folderQueryId = currentExplorerFolderId || "root";
    const q = encodeURIComponent("'" + folderQueryId + "' in parents and trashed = false");
    const url = "https://www.googleapis.com/drive/v3/files?q=" + q + "&fields=files(id,name,mimeType,size,webViewLink)&orderBy=folder,name";

    const res = await fetch(url, { headers: { Authorization: "Bearer " + accessToken } });

    if (!res.ok) {
      if (res.status === 403 || res.status === 404) {
        if (folderQueryId !== "root") {
          currentExplorerFolderId = "root";
          explorerBreadcrumbs = [{ id: "root", name: "Firm Drive" }];
          loadExplorerFiles();
          return;
        }
      }
      throw new Error("Google Drive API response error");
    }

    const data = await res.json();
    const files = data.files || [];

    if (files.length === 0) {
      listEl.innerHTML = "";
      if (emptyEl) emptyEl.classList.remove("hidden");
      return;
    }

    if (emptyEl) emptyEl.classList.add("hidden");

    listEl.innerHTML = files.map(f => {
      const isFolder = f.mimeType === "application/vnd.google-apps.folder";
      const icon = isFolder 
        ? `<i class="bi bi-folder-fill" style="color:var(--gold);font-size:32px"></i>` 
        : (f.name.toLowerCase().endsWith(".pdf") 
          ? `<i class="bi bi-file-earmark-pdf-fill" style="color:var(--red);font-size:32px"></i>`
          : `<i class="bi bi-file-earmark-text-fill" style="color:var(--gold);font-size:32px"></i>`);

      const onClickAction = isFolder 
        ? `onclick="navigateIntoFolder('${f.id}', '${f.name.replace(/'/g, "\\'")}')"`
        : `onclick="window.open('${f.webViewLink}', '_blank')"`;
      
      const sizeText = f.size ? (f.size / (1024 * 1024)).toFixed(2) + " MB" : "";

      return `
        <div style="min-width:0;max-width:100%;overflow:hidden;position:relative;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:16px 10px;text-align:center;cursor:pointer;transition:all 0.2s" onmouseenter="this.style.borderColor='var(--gold-border)';this.style.background='var(--surface3)'" onmouseleave="this.style.borderColor='var(--border)';this.style.background='var(--surface2)'">
          <div ${onClickAction} style="min-width:0;max-width:100%;overflow:hidden">
            <div style="margin-bottom:8px">${icon}</div>
            <div style="font-size:12.5px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;display:block" title="${escHtml(f.name)}">${escHtml(f.name)}</div>
            ${sizeText ? '<div style="font-size:11px;color:var(--text-dim);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + sizeText + '</div>' : ""}
          </div>
          <button onclick="event.stopPropagation(); adminDeleteDriveExplorerFile('${f.id}', '${f.name.replace(/'/g, "\\'")}')" style="position:absolute;top:6px;right:6px;background:none;border:none;color:var(--red);font-size:14px;cursor:pointer;padding:4px;border-radius:4px;opacity:0.6;transition:opacity 0.2s" title="Delete file from Google Drive">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      `;
    }).join("");

  } catch (err) {
    listEl.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:30px 16px;color:var(--text-muted)">
        <div style="font-size:28px;margin-bottom:8px;color:var(--amber)"><i class="bi bi-exclamation-triangle-fill"></i></div>
        <div style="font-size:13px;font-weight:600;color:var(--text)">Google Drive API Notice</div>
        <div style="font-size:11.5px;margin-top:6px;line-height:1.5">Click Open in Google Drive to view files directly.</div>
      </div>
    `;
  }
};

window.adminDeleteDriveExplorerFile = function(fileId, fileName) {
  window.openConfirmModal({
    icon: "bi-trash3",
    title: "Delete from Firm Drive?",
    body: `Are you sure you want to delete <strong>"${escHtml(fileName)}"</strong> directly from Google Drive?<br>This action cannot be undone.`,
    confirmText: "Delete from Drive",
    confirmStyle: "btn-danger",
    onConfirm: async () => {
      try {
        showToast("Deleting file from Drive...");
        await deleteDriveFile(fileId);
        showToast("File deleted from Google Drive.");
        loadExplorerFiles();
      } catch (err) {
        showToast("Failed to delete file: " + err.message, "error");
      }
    }
  });
};

window.navigateIntoFolder = function(id, name) {
  explorerBreadcrumbs.push({ id, name });
  currentExplorerFolderId = id;
  loadExplorerFiles();
};

window.navigateBreadcrumb = function(index) {
  explorerBreadcrumbs = explorerBreadcrumbs.slice(0, index + 1);
  currentExplorerFolderId = explorerBreadcrumbs[index].id;
  loadExplorerFiles();
};

function renderExplorerBreadcrumbs() {
  const el = document.getElementById("mydrive-breadcrumbs");
  if (!el) return;

  el.innerHTML = explorerBreadcrumbs.map((b, idx) => {
    const isLast = idx === explorerBreadcrumbs.length - 1;
    if (isLast) {
      return '<span style="color:var(--gold)"><i class="bi bi-folder-fill" style="margin-right:4px"></i>' + escHtml(b.name) + '</span>';
    }
    return `<span onclick="navigateBreadcrumb(${idx})" style="cursor:pointer;color:var(--text-muted);text-decoration:underline">${escHtml(b.name)}</span> <span style="font-size:11px;opacity:0.4">/</span>`;
  }).join(" ");
}

function openMyDriveFolder() {
  const u = window._currentUser;
  if (!u) { showToast("Not logged in.", "error"); return; }
  const myProf = profiles.find(p => p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === u.email.toLowerCase()));
  if (myProf && myProf.driveFolderId) {
    window.open(`https://drive.google.com/drive/folders/${myProf.driveFolderId}`, "_blank");
  } else {
    showToast("No Drive folder linked. Please connect Google Drive in Settings first.", "error");
  }
}

window.openMyDriveFolder = openMyDriveFolder;

// ═══════════════════════════════════════════════════════════════
//  FILE PREVIEW CONTROLLER
// ═══════════════════════════════════════════════════════════════
window.openFilePreview = function(doc) {
  if (!doc) return;

  if (doc.driveLink) {
    window.open(doc.driveLink, "_blank");
    return;
  }

  if (doc._localTempId && typeof pendingLocalFiles !== "undefined") {
    const file = pendingLocalFiles[doc._localTempId];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      window.open(objectUrl, "_blank");
      return;
    }
  }

  showToast("File link not found.", "error");
};

window.closeFilePreview = function() {
  const modal = document.getElementById("file-preview-modal");
  if (modal) modal.style.display = "none";
};
