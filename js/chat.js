// ═══════════════════════════════════════════════════════════════
//  SIMANDO LAW — MESSENGER-STYLE CHAT DOCK & CONVERSATIONS
//  Advanced Schedule & Hearing Presentation Delegation Engine
// ═══════════════════════════════════════════════════════════════

(function () {
  let isExpanded     = false;
  let activeChannel  = "group"; // "group" | peerUid
  let activePeerName = "";
  let groupUnsub     = null;
  let dmUnsub        = null;
  let myUid          = null;      
  let myName         = null;

  let groupMessages = [];
  let dmMessagesMap = {}; // channelId -> msgs array
  let peersList     = [];

  // Expose chat messages globally so ui.js can look up proposal details by message ID
  window.groupMessages = groupMessages;
  window.dmMessagesMap = dmMessagesMap;

  let chatAmPm = "AM";
  let chatPurposeType = "present_hearing";
  let chatTimeTypedCount = 4;

  const COLLECTION_GROUP = "chat_group";
  const COLLECTION_DM    = "chat_dm";
  const MSG_LIMIT        = 60;

  function dmChannelId(uidA, uidB) {
    return [uidA, uidB].sort().join("__");
  }

  function getSeenTimestamp(channelId) {
    if (!myUid) return 0;
    const val = localStorage.getItem(`chat_seen_${myUid}_${channelId}`);
    return val ? parseInt(val, 10) : 0;
  }

  function setSeenTimestamp(channelId) {
    if (!myUid) return;
    localStorage.setItem(`chat_seen_${myUid}_${channelId}`, Date.now().toString());
  }

  function getActiveCaseList() {
    if (typeof window.cases !== "undefined" && Array.isArray(window.cases)) return window.cases;
    if (typeof cases !== "undefined" && Array.isArray(cases)) return cases;
    return [];
  }

  // ── Bootstrap ────────────────────────────────────────────────
  function init() {
    injectStyles();
    buildUI();

    if (window._fbOnAuth && window._auth) {
      window._fbOnAuth(window._auth, (user) => {
        if (user) {
          myUid = user.uid;
          myName = user.displayName || user.email?.split("@")[0] || "Counsel";
          announcePeer();
          subscribeGroup();
          loadPeerList();
        } else {
          myUid = null;
          myName = null;
          if (groupUnsub) { groupUnsub(); groupUnsub = null; }
          if (dmUnsub) { dmUnsub(); dmUnsub = null; }
        }
      });
    }
  }

  if (window._fbReady) {
    init();
  } else {
    document.addEventListener("firebase-ready", init);
  }

  // ═══════════════════════════════════════════════════════════
  //  UI BUILD — EXPANDABLE PANEL WITH ADVANCED SCHEDULER
  // ═══════════════════════════════════════════════════════════
  function buildUI() {
    const panel = document.createElement("div");
    panel.id = "chat-panel";
    panel.className = "chat-panel hidden";
    panel.innerHTML = `
      <!-- Header -->
      <div class="chat-header" id="chat-panel-header" onclick="window._chat.toggleDock(event)" style="cursor:pointer;" title="Click header to minimize">
        <div class="chat-header-left" style="pointer-events:none;">
          <span class="chat-header-icon" style="color:var(--gold)"><i class="bi bi-chat-square-text-fill"></i></span>
          <span class="chat-header-title" id="chat-header-title">Recent Chats</span>
        </div>
        <div class="chat-header-actions" style="pointer-events:auto;">
          <button class="chat-icon-btn" title="Minimize" type="button" onclick="window._chat.toggleDock(event)"><i class="bi bi-dash-lg"></i></button>
        </div>
      </div>

      <!-- Conversations List View -->
      <div id="chat-view-list" class="chat-view">
        <div id="chat-recent-conversations" class="chat-conversations-list"></div>
      </div>

      <!-- Single Chat Messages View -->
      <div id="chat-view-single" class="chat-view hidden">
        <div class="dm-conv-header">
          <button class="dm-back-btn" type="button" onclick="window._chat.backToList()"><i class="bi bi-arrow-left"></i> Back to Chats</button>
          <span id="dm-conv-title" style="font-weight:700;font-size:13px;color:var(--text)"></span>
        </div>

        <div id="chat-messages-container" class="chat-messages"></div>

        <!-- ── ADVANCED IN-CHAT SCHEDULE & APPEARANCE DRAWER ── -->
        <div id="chat-avail-picker" class="chat-avail-picker hidden" style="max-height:360px;overflow-y:auto;padding:12px;background:var(--surface2);border-top:1px solid var(--border)">
          <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
            <span style="display:flex;align-items:center;gap:6px"><i class="bi bi-bank" style="color:var(--gold)"></i> Schedule / Hearing Appearance</span>
            <button type="button" onclick="window._chat.toggleAvailPicker()" style="background:none;border:none;color:var(--text-dim);font-size:14px;cursor:pointer"><i class="bi bi-x-lg"></i></button>
          </div>

          <!-- Purpose Options -->
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px" id="chat-purpose-chips">
            <button type="button" class="btn btn-secondary btn-sm active" style="font-size:10.5px;padding:3px 7px;width:auto!important" onclick="window._chat.setPurpose(this, 'present_hearing')"><i class="bi bi-bank"></i> Present Case</button>
            <button type="button" class="btn btn-secondary btn-sm" style="font-size:10.5px;padding:3px 7px;width:auto!important" onclick="window._chat.setPurpose(this, 'strategy')"><i class="bi bi-chat-square-text"></i> Strategy</button>
            <button type="button" class="btn btn-secondary btn-sm" style="font-size:10.5px;padding:3px 7px;width:auto!important" onclick="window._chat.setPurpose(this, 'pleading_review')"><i class="bi bi-file-earmark-check"></i> Review</button>
          </div>

          <!-- Case File Picker -->
          <div style="margin-bottom:8px">
            <label style="font-size:10px;text-transform:uppercase;color:var(--text-dim);font-weight:700;display:block;margin-bottom:3px">Attach Docket Case File *</label>
            <select class="chat-input" id="chat-case-select" onchange="window._chat.onCaseChange(this.value)" style="padding:6px 8px;font-size:11.5px;height:auto;width:100% !important;flex:none !important">
              <option value="">— Select Docket File —</option>
            </select>
          </div>

          <!-- Hearing Stage Sync (If Presenting Case) -->
          <div id="chat-hearing-stage-wrap" style="background:var(--surface3);border:1px solid var(--border);border-radius:6px;padding:6px;margin-bottom:8px;display:none">
            <label style="font-size:9.5px;text-transform:uppercase;color:var(--text-dim);font-weight:700;display:block;margin-bottom:2px"><i class="bi bi-flag"></i> Scheduled Court Appearance Date</label>
            <select class="chat-input" id="chat-target-hearing-select" onchange="window._chat.onHearingSync(this.value)" style="padding:5px 6px;font-size:11px;height:auto;width:100% !important;flex:none !important">
              <option value="">— Select scheduled hearing date —</option>
            </select>
          </div>

          <!-- Date & Custom Time with AM/PM -->
          <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:6px;margin-bottom:8px">
            <div>
              <label style="font-size:10px;text-transform:uppercase;color:var(--text-dim);font-weight:700;display:block;margin-bottom:3px">Date *</label>
              <input id="avail-date-input" type="date" class="chat-input" style="padding:5px 8px;font-size:11.5px;width:100% !important;flex:none !important"/>
            </div>
            <div>
              <label style="font-size:10px;text-transform:uppercase;color:var(--text-dim);font-weight:700;display:block;margin-bottom:3px">Time (AM/PM) *</label>
              <div class="custom-time-wrap" style="display:flex;align-items:center;gap:4px">
                <input id="chat-custom-time" type="text" class="time-input-box" value="08:30" maxlength="5" autocomplete="off" placeholder="00:00" style="padding:5px 6px;font-size:11.5px;text-align:center;width:100% !important;flex:1 !important"/>
                <div class="ampm-toggle" style="display:inline-flex;background:var(--surface3);border:1px solid var(--border);border-radius:6px;padding:2px;gap:2px;flex-shrink:0">
                  <button type="button" class="ampm-btn active" id="chat-btn-am" onclick="window._chat.setAmPm('AM')" style="padding:3px 6px;font-size:10px">AM</button>
                  <button type="button" class="ampm-btn" id="chat-btn-pm" onclick="window._chat.setAmPm('PM')" style="padding:3px 6px;font-size:10px">PM</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Venue & Objective -->
          <div style="margin-bottom:8px">
            <input id="avail-venue-input" class="chat-input" placeholder="Courtroom / Venue (e.g. RTC Branch 20)" style="margin-bottom:6px;padding:6px 8px;font-size:11.5px;width:100% !important;flex:none !important"/>
            <textarea id="avail-notes-input" class="chat-input" rows="2" placeholder="Specific hearing goals or strategy notes..." style="padding:6px 8px;font-size:11.5px;resize:vertical;width:100% !important;flex:none !important"></textarea>
          </div>

          <div style="display:flex;gap:6px;justify-content:flex-end">
            <button class="btn btn-secondary btn-sm" type="button" onclick="window._chat.toggleAvailPicker()" style="font-size:11px;padding:4px 8px">Cancel</button>
            <button class="btn btn-primary btn-sm" type="button" onclick="window._chat.sendAvailRequest()" style="font-size:11px;padding:4px 10px"><i class="bi bi-send-fill"></i> Send Proposal</button>
          </div>
        </div>

        <!-- Hidden File Input for Chat Attachments -->
        <input type="file" id="chat-file-input" style="display:none" onchange="window._chat.handleFileAttachment(event)"/>

        <!-- Input Row -->
        <div class="chat-input-row">
          <button class="chat-avail-btn" type="button" title="Attach Document / File" onclick="document.getElementById('chat-file-input').click()"><i class="bi bi-paperclip"></i></button>
          <button class="chat-avail-btn" type="button" title="Request Schedule / Hearing Appearance" onclick="window._chat.toggleAvailPicker()"><i class="bi bi-calendar-plus"></i></button>
          <input id="chat-msg-input" class="chat-input" type="text" placeholder="Type a message…" maxlength="1000"/>
          <button class="chat-send-btn" type="button" id="chat-send-btn"><i class="bi bi-send-fill"></i> Send</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    document.getElementById("chat-send-btn").addEventListener("click", sendMessage);
    document.getElementById("chat-msg-input").addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });

    initChatTimeInputEngine();
  }

  // ═══════════════════════════════════════════════════════════
  //  DIGITAL TIME ENGINE (00:00 BACKSPACE & HOUR-FIRST ENTRY)
  // ═══════════════════════════════════════════════════════════
  function initChatTimeInputEngine() {
    const timeBox = document.getElementById("chat-custom-time");
    if (!timeBox) return;

    timeBox.addEventListener("keydown", function(e) {
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        this.value = "00:00";
        chatTimeTypedCount = 0;
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        const num = e.key;

        if (chatTimeTypedCount >= 4 || this.value === "00:00") {
          if (num === "1" || num === "0") {
            this.value = `0${num}:00`;
            chatTimeTypedCount = 1;
          } else {
            this.value = `0${num}:00`;
            chatTimeTypedCount = 2;
          }
        } else if (chatTimeTypedCount === 1) {
          const firstHourDigit = this.value[1];
          const combined = parseInt(firstHourDigit + num, 10);
          if (combined <= 12) {
            this.value = `${firstHourDigit}${num}:00`;
            chatTimeTypedCount = 2;
          } else {
            this.value = `0${firstHourDigit}:${num}0`;
            chatTimeTypedCount = 3;
          }
        } else if (chatTimeTypedCount === 2) {
          const hourPart = this.value.slice(0, 2);
          let minTen = parseInt(num, 10);
          if (minTen > 5) minTen = 5;
          this.value = `${hourPart}:${minTen}0`;
          chatTimeTypedCount = 3;
        } else if (chatTimeTypedCount === 3) {
          const hourPart = this.value.slice(0, 2);
          const minTen = this.value[3];
          this.value = `${hourPart}:${minTen}${num}`;
          chatTimeTypedCount = 4;
        }
      }
    });

    timeBox.addEventListener("blur", function() {
      if (!this.value || this.value.trim() === "" || this.value.length < 5) {
        this.value = "00:00";
        chatTimeTypedCount = 0;
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  DOCK CONTROLS
  // ═══════════════════════════════════════════════════════════
  function toggleDock(e) {
    if (e) {
      if (e.stopPropagation) e.stopPropagation();
      if (e.preventDefault && e.type === "submit") e.preventDefault();
    }
    isExpanded ? minimizeDock() : expandDock();
  }

  function expandDock() {
    if (!myUid || !myName) {
      if (window.showToast) window.showToast("Please wait for account authorization to load.", "error");
      return;
    }

    const notifDropdown = document.getElementById("notif-dropdown");
    if (notifDropdown && !notifDropdown.classList.contains("hidden")) {
      notifDropdown.classList.add("hidden");
    }

    isExpanded = true;
    const panel = document.getElementById("chat-panel");
    if (panel) panel.classList.remove("hidden");

    renderConversationsList();
    setTimeout(loadPeerList, 50);

    if (activeChannel !== "group" && activeChannel) {
      setSeenTimestamp(dmChannelId(myUid, activeChannel));
    } else if (activeChannel === "group") {
      setSeenTimestamp("group");
    }
    updateGlobalDockBadge();
  }

  function minimizeDock() {
    isExpanded = false;
    const panel = document.getElementById("chat-panel");
    if (panel) panel.classList.add("hidden");
  }

  function backToList() {
    activeChannel = null;
    document.getElementById("chat-view-list").classList.remove("hidden");
    document.getElementById("chat-view-single").classList.add("hidden");
    document.getElementById("chat-header-title").textContent = "Recent Chats";
    renderConversationsList();
    setTimeout(loadPeerList, 50);
  }

  async function announcePeer() {
    if (!window._db || !myUid || !myName) return;
    try {
      const db = window._db;
      const peerRef = window._fbDoc(db, "chat_peers", myUid);
      const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
      await setDoc(peerRef, { uid: myUid, name: myName, lastSeen: window._fbServerTs() });
    } catch (e) {
      try {
        const db = window._db;
        const snap = await window._fbGetDocs(
          window._fbQuery(window._fbCol(db, "chat_peers"), window._fbWhere("uid", "==", myUid))
        );
        if (snap.empty) {
          await window._fbAddDoc(window._fbCol(db, "chat_peers"), { uid: myUid, name: myName, lastSeen: window._fbServerTs() });
        } else {
          await window._fbUpdate(window._fbDoc(db, "chat_peers", snap.docs[0].id), { name: myName, lastSeen: window._fbServerTs() });
        }
      } catch (err) {
        console.warn("chat peer announce error:", err);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  PEER LIST & RECENT CONVERSATIONS
  // ═══════════════════════════════════════════════════════════
  async function loadPeerList() {
    if (!window._db || !myUid) return;

    try {
      const db = window._db;
      const snap = await window._fbGetDocs(window._fbCol(db, "chat_peers"));
      let allPeers = snap.docs
        .map(d => d.data())
        .filter(p => p.uid && p.uid !== myUid && p.name);

      const allProfiles = window.profiles || [];
      const myProf = allProfiles.find(p => p.ownerUid === myUid);
      const isDeveloper = myProf && myProf.role === "developer";

      if (isDeveloper) {
        const devUids = allProfiles.filter(p => p.role === "developer").map(p => p.ownerUid);
        peersList = allPeers.filter(p => devUids.includes(p.uid));
      } else {
        const devUids = allProfiles.filter(p => p.role === "developer").map(p => p.ownerUid);
        peersList = allPeers.filter(p => !devUids.includes(p.uid));
      }

      renderConversationsList();
    } catch (e) {
      console.error("loadPeerList error:", e);
    }
  }

  function renderConversationsList() {
    const listEl = document.getElementById("chat-recent-conversations");
    if (!listEl) return;

    const allProfiles = window.profiles || [];
    const myProf = allProfiles.find(p => p.ownerUid === myUid);
    const isDeveloper = myProf && myProf.role === "developer";

    const latestGroupMsg = groupMessages[groupMessages.length - 1];
    const groupTimeMs = latestGroupMsg?.ts?.toDate ? latestGroupMsg.ts.toDate().getTime() : 0;
    const groupLastSeen = getSeenTimestamp("group");
    const groupUnread = latestGroupMsg && latestGroupMsg.uid !== myUid && groupTimeMs > groupLastSeen;

    let groupPreview = "No messages yet";
    if (latestGroupMsg) {
      if (latestGroupMsg.cardType === "availability_request") {
        groupPreview = `<span style="color:var(--gold,#c9a84c);font-weight:700"><i class="bi bi-bank"></i> Proposal: "${escHtml(latestGroupMsg.caseTitle || latestGroupMsg.reqTitle || 'Case')}"</span>`;
      } else if (latestGroupMsg.cardType === "file_attachment") {
        groupPreview = `<i class="bi bi-paperclip"></i> Attached: ${escHtml(latestGroupMsg.fileName || 'File')}`;
      } else {
        groupPreview = `${escHtml(latestGroupMsg.name || 'User')}: ${escHtml(latestGroupMsg.text)}`;
      }
    }

    const groupTitle = isDeveloper ? "Developer Sandbox Chat" : "Firm Group Chat";
    const groupIcon = isDeveloper ? `<i class="bi bi-code-slash" style="color:var(--cyan)"></i>` : `<i class="bi bi-megaphone-fill" style="color:var(--gold)"></i>`;

    const conversations = [
      {
        id: "group",
        name: groupTitle,
        avatar: groupIcon,
        isGroup: true,
        timeMs: groupTimeMs,
        preview: groupPreview,
        unread: groupUnread
      }
    ];

    peersList.forEach(p => {
      const channelId = dmChannelId(myUid, p.uid);
      const msgs = dmMessagesMap[channelId] || [];
      const lastMsg = msgs[msgs.length - 1];
      const timeMs = lastMsg?.ts?.toDate ? lastMsg.ts.toDate().getTime() : 0;
      const lastSeen = getSeenTimestamp(channelId);
      const unread = lastMsg && lastMsg.uid !== myUid && timeMs > lastSeen;

      let preview = "Start conversation…";
      if (lastMsg) {
        if (lastMsg.cardType === "availability_request") {
          preview = `<span style="color:var(--gold,#c9a84c);font-weight:700"><i class="bi bi-bank"></i> Proposal: "${escHtml(lastMsg.caseTitle || lastMsg.reqTitle || 'Case')}"</span>`;
        } else if (lastMsg.cardType === "file_attachment") {
          preview = `<i class="bi bi-paperclip"></i> Attached: ${escHtml(lastMsg.fileName || 'File')}`;
        } else {
          preview = escHtml(lastMsg.text);
        }
      }

      conversations.push({
        id: p.uid,
        name: p.name,
        avatar: initials(p.name),
        isGroup: false,
        timeMs: timeMs,
        preview: preview,
        unread: unread
      });
    });

    conversations.sort((a, b) => b.timeMs - a.timeMs);

    listEl.innerHTML = conversations.map(c => `
      <div class="chat-conv-item ${c.unread ? 'unread' : ''}" onclick="window._chat.openConversation('${c.id}', '${escHtml(c.name)}', ${c.isGroup})">
        <div class="chat-conv-avatar">${c.avatar}</div>
        <div class="chat-conv-info">
          <div class="chat-conv-name-row">
            <span class="chat-conv-name ${c.unread ? 'bold' : ''}">${escHtml(c.name)}</span>
            ${c.timeMs ? '<span class="chat-conv-time">' + formatTime(new Date(c.timeMs)) + '</span>' : ''}
          </div>
          <div class="chat-conv-preview ${c.unread ? 'bold' : ''}">${c.preview}</div>
        </div>
        ${c.unread ? '<span class="chat-unseen-dot" title="Unread message"><i class="bi bi-circle-fill" style="color:var(--gold);font-size:8px"></i></span>' : ''}
      </div>
    `).join("");

    updateGlobalDockBadge();
  }

  function openConversation(id, name, isGroup) {
    activeChannel = id;
    activePeerName = name;

    document.getElementById("chat-view-list").classList.add("hidden");
    document.getElementById("chat-view-single").classList.remove("hidden");
    document.getElementById("dm-conv-title").textContent = name;
    document.getElementById("chat-header-title").textContent = name;
    document.getElementById("chat-msg-input").placeholder = `Message ${name}…`;

    if (isGroup) {
      setSeenTimestamp("group");
      subscribeGroup();
    } else {
      setSeenTimestamp(dmChannelId(myUid, id));
      subscribeDm(id);
    }

    renderConversationsList();
    document.getElementById("chat-msg-input").focus();
  }

  // ═══════════════════════════════════════════════════════════
  //  CHAT FILE ATTACHMENT HANDLER
  // ═══════════════════════════════════════════════════════════
  async function handleFileAttachment(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (window.showToast) window.showToast("Attaching file to chat...");

    let driveLink = null;
    let driveFileId = null;

    try {
      if (typeof window.hasValidToken === "function" && window.hasValidToken() && typeof window.uploadSingleFileToDrive === "function") {
        const myProf = window.profiles ? window.profiles.find(p => p.ownerUid === myUid) : null;
        const targetFolder = myProf?.driveFolderId || "root";
        const result = await window.uploadSingleFileToDrive(file, targetFolder);
        if (result) {
          driveFileId = result.id;
          driveLink = result.webViewLink;
        }
      }
    } catch (err) {
      console.warn("Drive chat upload warning:", err);
    }

    const payload = {
      text: `Attached File: ${file.name}`,
      cardType: "file_attachment",
      fileName: file.name,
      fileSize: (file.size / 1024).toFixed(1) + " KB",
      driveLink: driveLink,
      driveFileId: driveFileId,
      uid: myUid,
      name: myName,
      ts: window._fbServerTs()
    };

    try {
      if (activeChannel === "group") {
        await window._fbAddDoc(window._fbCol(window._db, COLLECTION_GROUP), payload);
        setSeenTimestamp("group");
      } else if (activeChannel) {
        payload.peerUid = activeChannel;
        payload.peerName = activePeerName;
        const channelId = dmChannelId(myUid, activeChannel);
        await window._fbAddDoc(window._fbCol(window._db, COLLECTION_DM + "_" + channelId), payload);
        setSeenTimestamp(channelId);
      }
      if (window.showToast) window.showToast("File sent to chat!");
    } catch (e) {
      console.error("handleFileAttachment error:", e);
      if (window.showToast) window.showToast("Failed to send file: " + e.message, "error");
    } finally {
      event.target.value = "";
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  REAL-TIME LISTENERS
  // ═══════════════════════════════════════════════════════════
  function subscribeGroup() {
    if (groupUnsub) return;
    if (!window._db) return;

    const db = window._db;
    const q  = window._fbQuery(
      window._fbCol(db, COLLECTION_GROUP),
      window._fbOrderBy("ts", "asc"),
      window._fbLimit(MSG_LIMIT)
    );

    groupUnsub = window._fbOnSnapshot(q, snap => {
      groupMessages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      window.groupMessages = groupMessages;

      if (activeChannel === "group" && isExpanded) {
        setSeenTimestamp("group");
        renderMessages("chat-messages-container", groupMessages, false, true, "");
      }

      const newFromOthers = snap.docChanges()
        .filter(c => c.type === "added" && c.doc.data().uid !== myUid).length;

      if (newFromOthers > 0 && typeof window.playChatSound === "function") {
        window.playChatSound();
      }

      renderConversationsList();
    });
  }

  function subscribeDm(peerUid) {
    if (dmUnsub) { dmUnsub(); dmUnsub = null; }
    if (!window._db) return;

    const channelId = dmChannelId(myUid, peerUid);
    const db = window._db;
    const q  = window._fbQuery(
      window._fbCol(db, COLLECTION_DM + "_" + channelId),
      window._fbOrderBy("ts", "asc"),
      window._fbLimit(MSG_LIMIT)
    );

    dmUnsub = window._fbOnSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      dmMessagesMap[channelId] = msgs;
      window.dmMessagesMap = dmMessagesMap;

      if (activeChannel === peerUid && isExpanded) {
        setSeenTimestamp(channelId);
        renderMessages("chat-messages-container", msgs, true, false, channelId);
      }

      const newFromOthers = snap.docChanges()
        .filter(c => c.type === "added" && c.doc.data().uid !== myUid).length;

      if (newFromOthers > 0 && typeof window.playChatSound === "function") {
        window.playChatSound();
      }

      renderConversationsList();
    });
  }

  async function sendMessage() {
    const input = document.getElementById("chat-msg-input");
    const text  = input.value.trim();
    if (!text || !window._db || !myUid || !myName) return;
    input.value = "";

    try {
      if (activeChannel === "group") {
        await window._fbAddDoc(window._fbCol(window._db, COLLECTION_GROUP), {
          text,
          uid:  myUid,
          name: myName,
          ts:   window._fbServerTs()
        });
        setSeenTimestamp("group");
      } else if (activeChannel) {
        const channelId = dmChannelId(myUid, activeChannel);
        await window._fbAddDoc(window._fbCol(window._db, COLLECTION_DM + "_" + channelId), {
          text,
          uid:      myUid,
          name:     myName,
          peerUid:  activeChannel,
          peerName: activePeerName,
          ts:       window._fbServerTs()
        });
        setSeenTimestamp(channelId);
      }
    } catch (e) {
      console.error("sendMessage error:", e);
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  SCHEDULE REQUEST DRAWER
  // ═══════════════════════════════════════════════════════════
  function toggleAvailPicker() {
    const el = document.getElementById("chat-avail-picker");
    if (!el) return;
    el.classList.toggle("hidden");

    if (!el.classList.contains("hidden")) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateInp = document.getElementById("avail-date-input");
      if (dateInp) dateInp.value = tomorrow.toISOString().split("T")[0];

      const caseSel = document.getElementById("chat-case-select");
      if (caseSel) {
        const userCases = typeof window.getAccessibleCases === "function" 
          ? window.getAccessibleCases() 
          : (window.cases || []);

        let opts = `<option value="">— Select Docket File (${userCases.length} available) —</option>`;
        userCases.forEach(c => {
          opts += `<option value="${c.id}">${escHtml(c.title)} (${c.caseNumber || 'No Docket'})</option>`;
        });
        caseSel.innerHTML = opts;
      }
    }
  }

  function setPurpose(btn, type) {
    document.querySelectorAll('#chat-purpose-chips button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    chatPurposeType = type;

    const wrap = document.getElementById("chat-hearing-stage-wrap");
    const caseId = document.getElementById("chat-case-select")?.value;
    const allCases = typeof window.getAccessibleCases === "function" ? window.getAccessibleCases() : (window.cases || []);
    const selC = allCases.find(c => c.id === caseId);

    if (wrap) {
      wrap.style.display = (type === "present_hearing" && selC) ? "block" : "none";
    }
  }

  function setAmPm(val) {
    chatAmPm = val;
    document.getElementById("chat-btn-am").className = val === "AM" ? "ampm-btn active" : "ampm-btn";
    document.getElementById("chat-btn-pm").className = val === "PM" ? "ampm-btn active" : "ampm-btn";
  }

  function onCaseChange(caseId) {
    const wrap = document.getElementById("chat-hearing-stage-wrap");
    const hSel = document.getElementById("chat-target-hearing-select");
    const vInp = document.getElementById("avail-venue-input");

    const allCases = typeof window.getAccessibleCases === "function" ? window.getAccessibleCases() : (window.cases || []);
    const selC = allCases.find(c => c.id === caseId);

    if (selC && vInp) {
      vInp.value = selC.venue || "";
    }

    if (!selC) {
      if (wrap) wrap.style.display = "none";
      return;
    }

    const hearingsList = Array.isArray(selC.hearings) ? [...selC.hearings] : [];
    if (selC.dueDate && !hearingsList.some(h => h.date === selC.dueDate)) {
      hearingsList.push({
        id: "h_due_legacy",
        date: selC.dueDate,
        time: "08:30",
        purpose: "Scheduled Court Appearance"
      });
    }

    if (hearingsList.length > 0 && hSel) {
      let opts = `<option value="">— Select scheduled hearing (${hearingsList.length} found) —</option>`;
      hearingsList.forEach(h => {
        opts += `<option value="${h.id || h.date}">${formatDate(h.date)} (${h.time || '08:30'}) — ${escHtml(h.purpose || 'Hearing Appearance')}</option>`;
      });
      hSel.innerHTML = opts;
      if (wrap) wrap.style.display = "block";

      const todayStr = new Date().toISOString().split("T")[0];
      const upcomingH = hearingsList.find(h => h.date >= todayStr) || hearingsList[0];
      if (upcomingH) {
        hSel.value = upcomingH.id || upcomingH.date;
        const dInp = document.getElementById("avail-date-input");
        const tInp = document.getElementById("chat-custom-time");
        if (dInp && upcomingH.date) dInp.value = upcomingH.date;
        if (tInp && upcomingH.time) {
          tInp.value = upcomingH.time.slice(0, 5);
          chatTimeTypedCount = 4;
        }
      }
    } else {
      if (hSel) hSel.innerHTML = `<option value="">— No court hearings logged for this case —</option>`;
      if (wrap) wrap.style.display = (chatPurposeType === "present_hearing") ? "block" : "none";
    }
  }

  function onHearingSync(hId) {
    const caseId = document.getElementById("chat-case-select")?.value;
    const allCases = typeof window.getAccessibleCases === "function" ? window.getAccessibleCases() : (window.cases || []);
    const selC = allCases.find(c => c.id === caseId);
    if (!selC) return;

    const hearingsList = Array.isArray(selC.hearings) ? [...selC.hearings] : [];
    if (selC.dueDate && !hearingsList.some(h => h.date === selC.dueDate)) {
      hearingsList.push({ id: "h_due_legacy", date: selC.dueDate, time: "08:30", purpose: "Hearing Appearance" });
    }

    const h = hearingsList.find(x => x.id === hId || x.date === hId);
    if (h) {
      const dInp = document.getElementById("avail-date-input");
      const tInp = document.getElementById("chat-custom-time");
      if (dInp && h.date) dInp.value = h.date;
      if (tInp && h.time) {
        tInp.value = h.time.slice(0, 5);
        chatTimeTypedCount = 4;
      }
    }
  }

  // ── SEND PROPOSAL (DOES NOT ADD TO RECIPIENT'S CASE LIST UNTIL ACCEPTED) ──
  async function sendAvailRequest() {
    const caseId   = document.getElementById("chat-case-select")?.value;
    const date     = document.getElementById("avail-date-input")?.value;
    const time     = (document.getElementById("chat-custom-time")?.value || "08:30").trim();
    const venue    = (document.getElementById("avail-venue-input")?.value || "").trim();
    const notes    = (document.getElementById("avail-notes-input")?.value || "").trim();

    if (!date) {
      if (window.showToast) window.showToast("Please pick a date.", "error");
      return;
    }

    const allCases = typeof window.getAccessibleCases === "function" ? window.getAccessibleCases() : (window.cases || []);
    const selC = allCases.find(c => c.id === caseId);

    let purposeLabel = "Case Strategy Meeting";
    if (chatPurposeType === "present_hearing") purposeLabel = "Present Case in Court Hearing";
    else if (chatPurposeType === "pleading_review") purposeLabel = "Urgent Pleading Review";

    let apptId = null;
    if (typeof window.dbAddAppointment === "function") {
      try {
        apptId = await window.dbAddAppointment({
          title: purposeLabel,
          date: date,
          time: `${time} ${chatAmPm}`,
          venue: venue || (selC?.venue || "Firm Conference"),
          description: notes || "",
          purposeType: chatPurposeType,
          caseId: selC ? selC.id : null,
          caseTitle: selC ? selC.title : null,
          requesterUid: myUid,
          requesterName: myName,
          targetUid: activeChannel !== "group" ? activeChannel : null,
          targetName: activePeerName || "Counsel",
          ownerUid: myUid,
          status: "pending",
          caseCategory: selC ? (selC.category || "Case") : null,
          caseNumber: selC ? (selC.caseNumber || "Docket N/A") : null,
          caseParties: selC ? (selC.parties || "N/A") : null,
          caseVenue: selC ? (selC.venue || venue) : venue,
          caseFiledDate: selC ? (selC.filedDate || "") : "",
          caseStatus: selC ? (selC.status || "On-going") : "On-going",
          caseNarrative: selC ? (selC.narrative || "") : "",
          hearings: selC?.hearings || [],
          deadlines: selC?.deadlines || [],
          documents: selC?.documents || [],
          documentsCount: selC?.documents?.length || 0
        });
      } catch (e) {
        console.warn("dbAddAppointment chat sync warning:", e);
      }
    }

    const payload = {
      text: `${purposeLabel}: ${selC ? selC.title : 'Consultation'} on ${date} at ${time} ${chatAmPm}`,
      cardType: "availability_request",
      apptId: apptId,
      reqTitle: purposeLabel,
      reqDate: date,
      reqTime: `${time} ${chatAmPm}`,
      date: date, // dual-key compatibility for robust date resolution
      time: `${time} ${chatAmPm}`,
      reqVenue: venue || (selC?.venue || "Firm Conference Room"),
      reqNotes: notes,
      purposeType: chatPurposeType,
      caseId: selC ? selC.id : null,
      caseTitle: selC ? selC.title : null,
      caseNumber: selC ? (selC.caseNumber || "Docket N/A") : null,
      caseCategory: selC ? (selC.category || "Case") : null,
      caseParties: selC ? (selC.parties || "N/A") : null,
      caseVenue: selC ? (selC.venue || venue) : venue,
      caseFiledDate: selC ? (selC.filedDate || "") : "",
      caseStatus: selC ? (selC.status || "On-going") : "On-going",
      caseNarrative: selC ? (selC.narrative || "") : "",
      hearings: selC?.hearings || [],
      deadlines: selC?.deadlines || [],
      documents: selC?.documents || [],
      documentsCount: selC?.documents?.length || 0,
      reqStatus: "pending",
      uid: myUid,
      name: myName,
      ts: window._fbServerTs()
    };

    try {
      if (activeChannel === "group") {
        await window._fbAddDoc(window._fbCol(window._db, COLLECTION_GROUP), payload);
      } else if (activeChannel) {
        payload.peerUid  = activeChannel;
        payload.peerName = activePeerName;
        const channelId  = dmChannelId(myUid, activeChannel);
        await window._fbAddDoc(window._fbCol(window._db, COLLECTION_DM + "_" + channelId), payload);

        if (typeof window.dbAddNotification === "function") {
          await window.dbAddNotification({
            toUid: activeChannel,
            fromUid: myUid,
            fromName: myName,
            title: purposeLabel,
            message: `${myName} requested you to ${purposeLabel.toLowerCase()} for "${selC ? selC.title : 'Court Consultation'}" on ${formatDate(date)} at ${time} ${chatAmPm}.`,
            type: "appointment_request",
            category: chatPurposeType === "present_hearing" ? "hearing" : "consultation",
            relatedId: apptId || (selC ? selC.id : null),
            caseId: selC ? selC.id : null,
            caseTitle: selC ? selC.title : null,
            caseNumber: selC ? (selC.caseNumber || "Docket N/A") : null,
            caseCategory: selC ? (selC.category || "Case") : null,
            caseParties: selC ? (selC.parties || "N/A") : null,
            caseVenue: selC ? (selC.venue || venue) : venue,
            caseFiledDate: selC ? (selC.filedDate || "") : "",
            caseStatus: selC ? (selC.status || "On-going") : "On-going",
            caseNarrative: selC ? (selC.narrative || "") : "",
            hearings: selC?.hearings || [],
            deadlines: selC?.deadlines || [],
            documents: selC?.documents || [],
            documentsCount: selC?.documents?.length || 0,
            date: date,
            time: `${time} ${chatAmPm}`,
            status: "unread",
            appointmentStatus: "pending"
          });
        }
      }

      toggleAvailPicker();
      if (window.showToast) window.showToast("Proposal sent to chat! 📅");
    } catch (err) {
      console.error("sendAvailRequest error:", err);
      if (window.showToast) window.showToast("Failed to send request: " + err.message, "error");
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  ACCEPT / DECLINE & SYNC TO CASE LIST (SAFE AGAINST UNDEFINED)
  // ═══════════════════════════════════════════════════════════
  async function respondAvailCard(msgId, isGroup, channelId, status) {
    if (!window._db || !msgId) return;

    try {
      const db = window._db;
      const colName = isGroup ? COLLECTION_GROUP : (COLLECTION_DM + "_" + channelId);
      const msgRef = window._fbDoc(db, colName, msgId);

      await window._fbUpdate(msgRef, {
        reqStatus: status,
        respondedByUid: myUid,
        respondedByName: myName
      });

      let msgData = null;
      if (typeof window._fbGetDoc === "function") {
        try {
          const docSnap = await window._fbGetDoc(msgRef);
          if (docSnap && docSnap.exists()) msgData = docSnap.data();
        } catch (e) { /* ignore */ }
      }

      const caseList = getActiveCaseList();

      if (status === "accepted") {
        // 1. ADD ATTORNEY TO CASE PERMISSIONS & ACTIVE CASE LIST ONLY UPON ACCEPTANCE
        if (msgData && msgData.caseId) {
          let targetCase = caseList.find(c => c.id === msgData.caseId);

          if (!targetCase && typeof window._fbGetDoc === "function") {
            try {
              const snap = await window._fbGetDoc(window._fbDoc(window._db, "cases", msgData.caseId));
              if (snap && snap.exists()) {
                targetCase = { id: snap.id, ...snap.data() };
              }
            } catch (e) {
              console.warn("Direct lookup permission notice:", e.message);
            }
          }

          // If still null, reconstruct from snapshot stored directly inside msgData
          if (!targetCase && msgData.caseTitle) {
            targetCase = {
              id: msgData.caseId,
              title: msgData.caseTitle,
              caseNumber: msgData.caseNumber || "Docket N/A",
              category: msgData.caseCategory || "Case",
              parties: msgData.caseParties || "N/A",
              venue: msgData.caseVenue || "Courtroom / Venue N/A",
              filedDate: msgData.caseFiledDate || "",
              status: msgData.caseStatus || "On-going",
              narrative: msgData.caseNarrative || "",
              hearings: msgData.hearings || [],
              deadlines: msgData.deadlines || [],
              documents: msgData.documents || [],
              ownerUid: msgData.uid,
              allowedUids: [msgData.uid, myUid],
              sharedWith: [myUid]
            };
          }

          if (targetCase) {
            const currentAllowed = Array.isArray(targetCase.allowedUids) ? [...targetCase.allowedUids] : [targetCase.ownerUid];
            const currentShared  = Array.isArray(targetCase.sharedWith)  ? [...targetCase.sharedWith]  : [];

            if (!currentAllowed.includes(myUid)) currentAllowed.push(myUid);
            if (!currentShared.includes(myUid)) currentShared.push(myUid);

            if (typeof window.dbUpdateCase === "function") {
              try {
                await window.dbUpdateCase(targetCase.id, {
                  allowedUids: currentAllowed,
                  sharedWith: currentShared
                });
              } catch (updErr) {
                console.warn("Remote case update fallback:", updErr.message);
              }
            }
            targetCase.allowedUids = currentAllowed;
            targetCase.sharedWith = currentShared;

            // Safe unshift into active case list
            if (Array.isArray(caseList) && !caseList.some(c => c.id === targetCase.id)) {
              caseList.unshift(targetCase);
            }
            if (Array.isArray(window.cases) && !window.cases.some(c => c.id === targetCase.id)) {
              window.cases.unshift(targetCase);
            }

            if (typeof window.renderAllCases === "function") window.renderAllCases();
            if (typeof window.renderDashboard === "function") window.renderDashboard();
          }
        }

        // 2. UPDATE APPOINTMENT
        if (msgData && msgData.apptId && typeof window.dbUpdateAppointment === "function") {
          try {
            await window.dbUpdateAppointment(msgData.apptId, { status: "accepted" });
          } catch (e) { /* ignore */ }
        }

        // 3. SEND CONFIRMATION NOTIFICATION
        if (msgData && typeof window.dbAddNotification === "function") {
          try {
            await window.dbAddNotification({
              toUid: msgData.uid,
              fromUid: myUid,
              fromName: myName,
              title: "Appearance Confirmed & Case Added",
              message: `${myName} accepted the appearance request for "${msgData.caseTitle || msgData.reqTitle}". The case has been added to their case list.`,
              type: "availability_confirmed",
              relatedId: msgData.caseId || null,
              status: "unread"
            });
          } catch (e) { /* ignore */ }
        }

        if (window.showToast) window.showToast("Appearance Accepted! Case added to your active case list. 🏛️");
      } else {
        // DECLINED / REJECTED: Ensure case is completely removed from recipient's case list
        if (msgData && msgData.caseId) {
          if (Array.isArray(caseList)) {
            const idx = caseList.findIndex(c => c.id === msgData.caseId && c.ownerUid !== myUid);
            if (idx >= 0) caseList.splice(idx, 1);
          }
          if (Array.isArray(window.cases)) {
            window.cases = window.cases.filter(c => c.id !== msgData.caseId || c.ownerUid === myUid);
          }
          if (typeof window.renderAllCases === "function") window.renderAllCases();
          if (typeof window.renderDashboard === "function") window.renderDashboard();
        }
        if (window.showToast) window.showToast("Proposal declined.");
      }
    } catch (err) {
      console.error("respondAvailCard error:", err);
      if (window.showToast) window.showToast("Failed to respond: " + err.message, "error");
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  CANCEL / RELINQUISH APPEARANCE WITH CONFIRMATION
  // ═══════════════════════════════════════════════════════════
  function promptCancelAppearance(caseId, apptId, msgId, isGroup, channelId) {
    if (typeof window.openConfirmModal === "function") {
      window.openConfirmModal({
        icon: "bi-exclamation-octagon-fill",
        title: "Cancel Appearance Delegation?",
        body: "Are you sure you want to cancel your appearance for this case?<br><br>This will remove the case from your active roster and notify counsel so they can reassign it.",
        confirmText: "Confirm",
        cancelText: "Keep",
        confirmStyle: "btn-danger",
        onConfirm: () => executeCancelAppearance(caseId, apptId, msgId, isGroup, channelId)
      });
    } else {
      if (confirm("Are you sure you want to cancel this appearance? This will remove the case from your active roster.")) {
        executeCancelAppearance(caseId, apptId, msgId, isGroup, channelId);
      }
    }
  }

  async function executeCancelAppearance(caseId, apptId, msgId, isGroup, channelId) {
    try {
      if (window.showToast) window.showToast("Cancelling appearance...");

      const caseList = getActiveCaseList();

      // 1. Remove user from case allowedUids & sharedWith
      if (caseId && typeof window.dbUpdateCase === "function") {
        const targetCase = caseList.find(c => c.id === caseId);

        if (targetCase && targetCase.ownerUid !== myUid) {
          const currentAllowed = (targetCase.allowedUids || []).filter(u => u !== myUid);
          const currentShared  = (targetCase.sharedWith || []).filter(u => u !== myUid);

          try {
            await window.dbUpdateCase(targetCase.id, {
              allowedUids: currentAllowed,
              sharedWith: currentShared
            });
          } catch (e) { /* ignore */ }
          targetCase.allowedUids = currentAllowed;
          targetCase.sharedWith = currentShared;

          // Evict from active array
          if (Array.isArray(caseList)) {
            const idx = caseList.findIndex(c => c.id === caseId);
            if (idx >= 0) caseList.splice(idx, 1);
          }
          if (Array.isArray(window.cases)) {
            window.cases = window.cases.filter(c => c.id !== caseId);
          }
        }
      }

      // 2. Reset appointment status
      if (apptId && typeof window.dbUpdateAppointment === "function") {
        try {
          await window.dbUpdateAppointment(apptId, { status: "cancelled" });
        } catch (e) { /* ignore */ }
      }

      // 3. Update Chat Card
      if (msgId && window._db) {
        const db = window._db;
        const colName = isGroup ? COLLECTION_GROUP : (COLLECTION_DM + "_" + channelId);
        const msgRef = window._fbDoc(db, colName, msgId);

        try {
          await window._fbUpdate(msgRef, {
            reqStatus: "cancelled",
            cancelledByUid: myUid,
            cancelledByName: myName
          });
        } catch (e) { /* ignore */ }
      }

      // 4. Refresh UI Views
      if (typeof window.renderAllCases === "function") window.renderAllCases();
      if (typeof window.renderDashboard === "function") window.renderDashboard();
      if (typeof window.renderCalendarView === "function") window.renderCalendarView();

      if (window.showToast) window.showToast("Appearance cancelled and removed from your case list.");
    } catch (err) {
      console.error("executeCancelAppearance error:", err);
      if (window.showToast) window.showToast("Failed to cancel appearance: " + err.message, "error");
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  MESSAGE CARD RENDERING
  // ═══════════════════════════════════════════════════════════
  function renderMessages(containerId, msgs, isDm, isGroup, channelId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (msgs.length === 0) {
      el.innerHTML = `<div class="chat-empty"><i class="bi bi-chat-square-text" style="font-size:24px;color:var(--gold);display:block;margin-bottom:6px"></i>No messages yet. Say hello!</div>`;
      return;
    }

    el.innerHTML = msgs.map((m, i) => {
      const isMine   = m.uid === myUid;
      const ts       = m.ts?.toDate ? formatTime(m.ts.toDate()) : "";
      const showName = !isMine && (i === 0 || msgs[i - 1].uid !== m.uid);

      if (m.cardType === "availability_request") {
        const reqStatus = m.reqStatus || "pending";
        let statusBadge = `<span class="avail-badge pending"><i class="bi bi-clock"></i> Pending Acceptance</span>`;
        if (reqStatus === "accepted") statusBadge = `<span class="avail-badge accepted" style="color:var(--green)"><i class="bi bi-check-circle-fill"></i> Appearance Accepted &amp; Added to Cases (${escHtml(m.respondedByName || 'Accepted')})</span>`;
        if (reqStatus === "declined") statusBadge = `<span class="avail-badge declined" style="color:var(--red)"><i class="bi bi-slash-circle-fill"></i> Declined</span>`;
        if (reqStatus === "cancelled") statusBadge = `<span class="avail-badge declined" style="color:var(--red)"><i class="bi bi-x-octagon-fill"></i> Appearance Cancelled</span>`;

        let actionBtns = "";

        // PENDING STATE: Show "Check Information" button + Accept + Decline
        if (!isMine && reqStatus === "pending") {
          actionBtns = `
            <div style="display:flex;gap:6px;margin-top:10px;align-items:center;flex-wrap:wrap">
              <button class="btn btn-secondary btn-sm" type="button" style="font-size:11px;padding:5px 10px;border-color:var(--gold-border);color:var(--gold-light)" onclick="window.openProposalReviewModal('${m.caseId || ''}', '${m.apptId || m.id}', '${m.id}', ${isGroup}, '${channelId}')">
                <i class="bi bi-info-circle-fill"></i> Check Information
              </button>
              <button class="chat-card-btn confirm" type="button" onclick="window._chat.respondAvailCard('${m.id}', ${isGroup}, '${channelId}', 'accepted')">
                <i class="bi bi-check2"></i> Accept
              </button>
              <button class="chat-card-btn decline" type="button" onclick="window._chat.respondAvailCard('${m.id}', ${isGroup}, '${channelId}', 'declined')">
                <i class="bi bi-x"></i>
              </button>
            </div>
          `;
        } 
        // ACCEPTED STATE: Allow recipient to inspect case or cancel appearance
        else if (reqStatus === "accepted") {
          const isAssignee = m.respondedByUid === myUid || (!isMine && m.reqStatus === "accepted");
          actionBtns = `
            <div style="display:flex;gap:6px;margin-top:10px;align-items:center;flex-wrap:wrap">
              <button class="btn btn-secondary btn-sm" type="button" style="font-size:11px;padding:5px 10px" onclick="window.openProposalReviewModal('${m.caseId || ''}', '${m.apptId || m.id}', '${m.id}', ${isGroup}, '${channelId}')">
                <i class="bi bi-folder2-open"></i> Check Information
              </button>
              ${isAssignee ? `
                <button class="btn btn-danger btn-sm" type="button" style="font-size:11px;padding:5px 10px;border-color:rgba(248,113,113,0.4)" onclick="window._chat.promptCancelAppearance('${m.caseId || ''}', '${m.apptId || m.id}', '${m.id}', ${isGroup}, '${channelId}')">
                  <i class="bi bi-x-circle"></i> Cancel Appearance
                </button>
              ` : ''}
            </div>
          `;
        }

        const caseBadgeMarkup = m.caseTitle ? `
          <div style="background:var(--surface3);border:1px solid var(--border);border-radius:6px;padding:6px 8px;margin:6px 0;font-size:11px">
            <div style="font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">⚖️ ${escHtml(m.caseTitle)}</div>
            <div style="color:var(--text-muted);font-size:10.5px;margin-top:1px">${escHtml(m.caseNumber || 'Docket N/A')} · ${m.documentsCount || 0} file(s) attached</div>
          </div>
        ` : '';

        return `
          <div class="chat-msg-wrap ${isMine ? "mine" : "theirs"}">
            ${showName ? `<div class="chat-msg-sender">${escHtml(m.name || "Unknown")}</div>` : ""}
            <div class="chat-avail-card ${isMine ? "mine" : "theirs"}" style="border-left:3.5px solid var(--gold);max-width:92%">
              <div style="font-size:10.5px;font-weight:700;color:var(--gold,#c9a84c);letter-spacing:0.5px;text-transform:uppercase;margin-bottom:2px">
                <i class="bi bi-bank"></i> ${escHtml(m.reqTitle || "Appearance Request")}
              </div>
              ${caseBadgeMarkup}
              <div style="font-size:11.5px;color:var(--text);font-weight:600">
                <i class="bi bi-calendar3"></i> ${m.reqDate || m.date || ''} · <i class="bi bi-clock"></i> ${m.reqTime || m.time || ''}
              </div>
              ${m.reqVenue ? `<div style="font-size:11px;color:var(--text-dim);margin-top:2px"><i class="bi bi-geo-alt"></i> ${escHtml(m.reqVenue)}</div>` : ''}
              ${m.reqNotes ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px;font-style:italic">"${escHtml(m.reqNotes)}"</div>` : ''}
              <div style="margin-top:6px">${statusBadge}</div>
              ${actionBtns}
              <span class="chat-ts">${ts}</span>
            </div>
          </div>
        `;
      } else if (m.cardType === "file_attachment") {
        const linkMarkup = m.driveLink 
          ? `<a href="${m.driveLink}" target="_blank" style="color:var(--gold,#c9a84c);text-decoration:underline;font-weight:700"><i class="bi bi-file-earmark-text-fill"></i> ${escHtml(m.fileName)}</a>`
          : `<i class="bi bi-file-earmark-text-fill"></i> ${escHtml(m.fileName)}`;

        return `
          <div class="chat-msg-wrap ${isMine ? "mine" : "theirs"}">
            ${showName ? `<div class="chat-msg-sender">${escHtml(m.name || "Unknown")}</div>` : ""}
            <div class="chat-bubble-msg ${isMine ? "mine" : "theirs"}">
              <div style="font-size:11px;font-weight:700;color:var(--gold,#c9a84c);margin-bottom:2px"><i class="bi bi-paperclip"></i> File Attachment</div>
              <div style="font-size:13px">${linkMarkup}</div>
              <div style="font-size:10px;opacity:.85;margin-top:2px">${m.fileSize || ''}</div>
              <span class="chat-ts">${ts}</span>
            </div>
          </div>
        `;
      }

      return `
        <div class="chat-msg-wrap ${isMine ? "mine" : "theirs"}">
          ${showName ? `<div class="chat-msg-sender">${escHtml(m.name || "Unknown")}</div>` : ""}
          <div class="chat-bubble-msg ${isMine ? "mine" : "theirs"}">
            ${escHtml(m.text)}
            <span class="chat-ts">${ts}</span>
          </div>
        </div>
      `;
    }).join("");

    el.scrollTop = el.scrollHeight;
  }

  function updateGlobalDockBadge() {
    let totalUnread = 0;

    const latestGroupMsg = groupMessages[groupMessages.length - 1];
    if (latestGroupMsg && latestGroupMsg.uid !== myUid) {
      const gTimeMs = latestGroupMsg.ts?.toDate ? latestGroupMsg.ts.toDate().getTime() : 0;
      if (gTimeMs > getSeenTimestamp("group")) totalUnread++;
    }

    peersList.forEach(p => {
      const channelId = dmChannelId(myUid, p.uid);
      const msgs = dmMessagesMap[channelId] || [];
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg && lastMsg.uid !== myUid) {
        const timeMs = lastMsg.ts?.toDate ? lastMsg.ts.toDate().getTime() : 0;
        if (timeMs > getSeenTimestamp(channelId)) totalUnread++;
      }
    });

    const hdrBadge = document.getElementById("chat-hdr-badge");
    if (hdrBadge) {
      hdrBadge.textContent = totalUnread > 9 ? "9+" : totalUnread;
      hdrBadge.classList.toggle("hidden", totalUnread === 0);
    }
  }

  function initials(name) {
    return (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  }

  function escHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatTime(date) {
    const now  = new Date();
    const diff = now - date;
    if (diff < 60000)  return "just now";
    if (diff < 3600000) {
      const m = Math.floor(diff / 60000);
      return `${m}m ago`;
    }
    const sameDay = date.toDateString() === now.toDateString();
    if (sameDay) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  function formatDate(d) {
    return d ? new Date(d + 'T00:00:00').toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "N/A";
  }

  // ═══════════════════════════════════════════════════════════
  //  STYLES
  // ═══════════════════════════════════════════════════════════
  function injectStyles() {
    const s = document.createElement("style");
    s.textContent = `
      #chat-dock-bar { display: none !important; }

      .chat-badge {
        background: #e53e3e; color: #fff;
        font-size: 10px; font-weight: 700; min-width: 18px; height: 18px;
        border-radius: 9px; display: flex; align-items: center; justify-content: center;
        padding: 0 5px; line-height: 1;
      }
      .chat-badge.hidden { display: none; }

      .chat-panel {
        position: fixed !important;
        bottom: 24px !important;
        right: 24px !important;
        width: 380px !important;
        max-width: calc(100vw - 20px) !important;
        height: 520px !important;
        background: var(--surface, #0c1826) !important;
        border: 1px solid var(--gold-border, rgba(201,165,92,0.3)) !important;
        border-radius: 14px !important;
        display: flex !important;
        flex-direction: column !important;
        z-index: 99998 !important;
        box-shadow: 0 12px 48px rgba(0,0,0,0.7) !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
        animation: chatDockExpand .22s cubic-bezier(0.4, 0, 0.2, 1) !important;
      }
      .chat-panel.hidden { display: none !important; }

      @keyframes chatDockExpand {
        from { opacity: 0; transform: translateY(20px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      .chat-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 12px 16px; background: var(--surface2, #091422);
        border-bottom: 1px solid var(--border, #162033); flex-shrink: 0;
        cursor: pointer; user-select: none;
      }
      .chat-header:hover { background: var(--surface3, #10202e); }
      .chat-header-left { display: flex; align-items: center; gap: 8px; }
      .chat-header-icon { font-size: 16px; }
      .chat-header-title { font-size: 13px; font-weight: 700; color: var(--text); }
      .chat-header-actions { display: flex; gap: 6px; }
      .chat-icon-btn {
        background: transparent; border: none; color: var(--text-dim);
        font-size: 14px; cursor: pointer; padding: 4px 8px; border-radius: 6px;
        transition: background .15s, color .15s;
      }
      .chat-icon-btn:hover { background: var(--border, #162033); color: var(--text); }

      .chat-view { display: flex; flex-direction: column; flex: 1; overflow: hidden; width: 100% !important; box-sizing: border-box !important; }
      .chat-view.hidden { display: none; }

      .chat-conversations-list { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 4px; }
      
      .chat-conv-item {
        display: flex; align-items: center; gap: 12px;
        padding: 10px 12px; border-radius: 10px; cursor: pointer;
        transition: background .15s; background: var(--surface2, #091422);
        border: 1px solid var(--border, #162033); position: relative;
      }
      .chat-conv-item:hover { background: var(--surface3, #10202e); border-color: var(--gold-border, rgba(201,165,92,0.3)); }
      .chat-conv-item.unread { border-left: 3px solid var(--gold, #c9a84c); background: rgba(201,165,92,0.06); }

      .chat-conv-avatar {
        width: 36px; height: 36px; border-radius: 50%; background: rgba(201,165,92,0.15);
        border: 1.5px solid var(--gold, #c9a84c); color: var(--gold-light, #e0c080);
        font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }

      .chat-conv-info { flex: 1; min-width: 0; }
      .chat-conv-name-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 2px; }
      .chat-conv-name { font-size: 13px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .chat-conv-name.bold { font-weight: 800; color: var(--text); }
      .chat-conv-time { font-size: 10px; color: var(--text-dim); flex-shrink: 0; }
      .chat-conv-preview { font-size: 11.5px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .chat-conv-preview.bold { color: var(--text); font-weight: 600; }

      .chat-unseen-dot { margin-left: 4px; flex-shrink: 0; }

      .chat-messages {
        flex: 1; overflow-y: auto; padding: 12px 12px 6px;
        display: flex; flex-direction: column; gap: 4px; scroll-behavior: smooth;
      }
      .chat-empty { text-align: center; color: var(--text-muted); font-size: 12px; margin: auto; padding: 20px; }

      .chat-msg-wrap { display: flex; flex-direction: column; margin-bottom: 4px; }
      .chat-msg-wrap.mine  { align-items: flex-end; }
      .chat-msg-wrap.theirs { align-items: flex-start; }
      .chat-msg-sender { font-size: 10px; color: var(--text-dim); margin-bottom: 2px; padding: 0 4px; font-weight: 600; }

      .chat-bubble-msg {
        max-width: 82%; padding: 8px 12px; border-radius: 14px;
        font-size: 13px; line-height: 1.45; word-break: break-word; position: relative;
      }
      .chat-bubble-msg.mine { background: var(--gold, #c9a84c); color: #111; border-bottom-right-radius: 4px; }
      .chat-bubble-msg.theirs { background: var(--surface2, #091422); color: var(--text); border-bottom-left-radius: 4px; border: 1px solid var(--border, #162033); }

      .chat-avail-card {
        max-width: 90%; padding: 10px 12px; border-radius: 10px;
        background: var(--surface2, #091422); border: 1px solid var(--border, #162033);
        box-shadow: 0 4px 14px rgba(0,0,0,0.3); position: relative;
      }
      .avail-badge {
        display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 700;
        padding: 2px 7px; border-radius: 4px;
      }
      .avail-badge.pending  { background: rgba(251,191,36,0.15); color: #fbbf24; }
      .avail-badge.accepted { background: rgba(52,211,153,0.15); color: #34d399; }
      .avail-badge.declined { background: rgba(248,113,113,0.15); color: #f87171; }

      .chat-card-btn {
        flex: 1; padding: 5px 8px; border-radius: 6px; border: none;
        font-size: 10.5px; font-weight: 700; cursor: pointer; transition: opacity .15s;
        display: inline-flex; align-items: center; justify-content: center; gap: 4px;
      }
      .chat-card-btn.confirm { background: #34d399; color: #040810; }
      .chat-card-btn.decline { background: transparent; border: 1px solid rgba(248,113,113,0.3); color: #f87171; }
      .chat-card-btn:hover { opacity: .85; }

      .chat-input-row {
        display: flex !important;
        gap: 6px !important;
        padding: 8px 10px !important;
        border-top: 1px solid var(--border, #162033) !important;
        flex-shrink: 0 !important;
        align-items: center !important;
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        background: var(--surface2, #091422) !important;
        overflow: hidden !important;
      }

      .chat-input {
        width: 0 !important;
        flex: 1 1 0px !important;
        min-width: 0 !important;
        background: var(--bg, #060c13) !important;
        border: 1px solid var(--border, #162033) !important;
        border-radius: 8px !important;
        padding: 8px 10px !important;
        font-size: 12.5px !important;
        color: var(--text) !important;
        outline: none !important;
        box-sizing: border-box !important;
      }
      .chat-input:focus { border-color: var(--gold, #c9a84c) !important; }

      .chat-avail-btn {
        width: 32px !important;
        height: 32px !important;
        background: var(--surface3, #10202e) !important;
        border: 1px solid var(--border-soft, #1c2d3f) !important;
        color: var(--gold-light, #e0c080) !important;
        font-size: 15px !important;
        border-radius: 7px !important;
        padding: 0 !important;
        cursor: pointer !important;
        transition: all .15s ease !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        flex-shrink: 0 !important;
        box-sizing: border-box !important;
      }
      .chat-avail-btn i {
        color: var(--gold-light, #e0c080) !important;
        font-size: 15px !important;
      }
      .chat-avail-btn:hover {
        background: var(--surface2, #091422) !important;
        border-color: var(--gold-border, rgba(201,165,92,0.3)) !important;
      }
      .chat-avail-btn:hover i { color: #ffffff !important; }

      .chat-send-btn {
        background: var(--gold, #c9a84c) !important;
        color: #060c13 !important;
        border: none !important;
        border-radius: 7px !important;
        padding: 0 12px !important;
        height: 32px !important;
        font-size: 12px !important;
        font-weight: 700 !important;
        cursor: pointer !important;
        flex-shrink: 0 !important;
        white-space: nowrap !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 4px !important;
        box-sizing: border-box !important;
        margin: 0 !important;
      }
      .chat-send-btn:hover { opacity: .9 !important; background: var(--gold-light, #e0c080) !important; }

      .dm-conv-header { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid var(--border, #162033); }
      .dm-back-btn { background: transparent; border: none; color: var(--gold, #c9a84c); font-size: 12px; cursor: pointer; padding: 4px 8px; font-weight: 600; display: flex; align-items: center; gap: 4px; }
      .chat-ts { font-size: 9px; opacity: .85; margin-left: 8px; vertical-align: bottom; }

      @media (max-width: 600px) {
        .chat-panel { 
          left: 0 !important; 
          right: 0 !important; 
          width: 100vw !important; 
          bottom: 60px !important; 
          height: calc(100vh - 120px) !important; 
          max-height: 520px !important;
          border-radius: 16px 16px 0 0 !important;
        }
      }
    `;
    document.head.appendChild(s);
  }

  // ── Expose Global API ─────────────────────────────────────────
  window.toggleDock = toggleDock;
  window._chat = { 
    toggleDock,
    openConversation, 
    backToList, 
    toggleAvailPicker, 
    setPurpose,
    setAmPm,
    onCaseChange,
    onHearingSync,
    sendAvailRequest, 
    respondAvailCard,
    promptCancelAppearance,
    executeCancelAppearance,
    handleFileAttachment
  };

})();
