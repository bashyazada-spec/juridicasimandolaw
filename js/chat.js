// ═══════════════════════════════════════════════════════════════
//  SIMANDO LAW — REWORKED ULTRA-MINIMAL CHAT DOCK & CONVERSATIONS
//  Vertical Recent Chats List · Theme-Matched · Responsive Mobile Fullscreen
// ═══════════════════════════════════════════════════════════════

(function () {
  let isExpanded     = false;
  let activeChannel  = null; // null (list) | "group" | peerUid
  let activePeerName = "";
  let peersUnsub     = null;
  let groupUnsub     = null;
  let dmUnsubs       = {};
  let myUid          = null;
  let myName         = null;

  let groupMessages = [];
  let dmMessagesMap = {};
  let peersList     = [];
  let chatListFilter = "";
  const markingReadSet = new Set();

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

  function resolvePeerDisplayName(peer) {
    const prof = (window.profiles || []).find(pr => pr.ownerUid === peer.uid);
    return prof?.name || peer.name || "Counsel";
  }

  function isMsgReadBy(msg, uid) {
    return !!(msg && msg.readBy && msg.readBy[uid]);
  }

  async function markChannelMessagesAsRead(colName, msgs) {
    if (!window._db || !myUid || !Array.isArray(msgs)) return;
    const unreadMsgs = msgs.filter(m => m.id && m.uid && m.uid !== myUid && !isMsgReadBy(m, myUid) && !markingReadSet.has(colName + "::" + m.id));
    if (unreadMsgs.length === 0) return;

    for (const m of unreadMsgs) {
      const lockKey = colName + "::" + m.id;
      markingReadSet.add(lockKey);
      if (!m.readBy) m.readBy = {};
      m.readBy[myUid] = Date.now();
      try {
        await window._fbUpdate(window._fbDoc(window._db, colName, m.id), {
          [`readBy.${myUid}`]: Date.now()
        });
      } catch (e) {
        markingReadSet.delete(lockKey);
      }
    }
  }

  // ── Bootstrap ────────────────────────────────────────────────
  function init() {
    injectStyles();
    buildUI();

    if (window._fbOnAuth && window._auth) {
      window._fbOnAuth(window._auth, (user) => {
        if (user) {
          myUid = user.uid;
          const prof = (window.profiles || []).find(pr => pr.ownerUid === user.uid);
          myName = prof?.name || user.displayName || user.email?.split("@")[0] || "Counsel";
          announcePeer();
          subscribeGroup();
          subscribePeersAndAllDms();
        } else {
          myUid = null;
          myName = null;
          cleanupAllListeners();
        }
      });
    }
  }

  function cleanupAllListeners() {
    if (peersUnsub) { peersUnsub(); peersUnsub = null; }
    if (groupUnsub) { groupUnsub(); groupUnsub = null; }
    Object.values(dmUnsubs).forEach(fn => { try { fn(); } catch (_) {} });
    dmUnsubs = {};
  }

  if (window._fbReady) init();
  else document.addEventListener("firebase-ready", init);

  // ═══════════════════════════════════════════════════════════
  //  UI BUILD (REWORKED MINIMAL THEME-MATCHED SHELL)
  // ═══════════════════════════════════════════════════════════
  function buildUI() {
    if (document.getElementById("chat-panel")) return;
    const panel = document.createElement("div");
    panel.id = "chat-panel";
    panel.className = "chat-panel hidden";
    panel.innerHTML = `
      <div class="chat-header" id="chat-panel-header" onclick="window._chat.toggleDock(event)" title="Click header to minimize">
        <div class="chat-header-left" style="pointer-events:none;">
          <span class="chat-header-icon"><i class="bi bi-chat-square-text-fill"></i></span>
          <span class="chat-header-title" id="chat-header-title">Recent Chats</span>
          <span class="chat-header-pill">Firm</span>
        </div>
        <div class="chat-header-actions" style="pointer-events:auto;">
          <button class="chat-icon-btn" title="Minimize" type="button" onclick="window._chat.toggleDock(event)"><i class="bi bi-dash-lg"></i></button>
        </div>
      </div>

      <div id="chat-view-list" class="chat-view">
        <div class="chat-search-wrap">
          <i class="bi bi-search chat-search-icon"></i>
          <input id="chat-list-search" class="chat-search-inp" type="text" placeholder="Filter conversations…" oninput="window._chat.filterConversations(this.value)"/>
        </div>
        <div id="chat-recent-conversations" class="chat-conversations-list"></div>
      </div>

      <div id="chat-view-single" class="chat-view hidden">
        <div class="dm-conv-header">
          <button class="dm-back-btn" type="button" onclick="window._chat.backToList()"><i class="bi bi-arrow-left"></i> Chats</button>
          <span id="dm-conv-title" class="dm-conv-title"></span>
          <span class="dm-conv-meta">Encrypted</span>
        </div>

        <div id="chat-messages-container" class="chat-messages"></div>

        <div id="chat-avail-picker" class="chat-avail-picker hidden">
          <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
            <span style="display:flex;align-items:center;gap:6px"><i class="bi bi-bank" style="color:var(--gold)"></i> Schedule / Hearing Appearance</span>
            <button type="button" onclick="window._chat.toggleAvailPicker()" style="color:var(--text-dim);font-size:14px"><i class="bi bi-x-lg"></i></button>
          </div>

          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px" id="chat-purpose-chips">
            <button type="button" class="btn btn-secondary btn-sm active" style="font-size:10.5px;padding:3px 7px;width:auto!important" onclick="window._chat.setPurpose(this, 'present_hearing')"><i class="bi bi-bank"></i> Present Case</button>
            <button type="button" class="btn btn-secondary btn-sm" style="font-size:10.5px;padding:3px 7px;width:auto!important" onclick="window._chat.setPurpose(this, 'strategy')"><i class="bi bi-chat-square-text"></i> Strategy</button>
            <button type="button" class="btn btn-secondary btn-sm" style="font-size:10.5px;padding:3px 7px;width:auto!important" onclick="window._chat.setPurpose(this, 'pleading_review')"><i class="bi bi-file-earmark-check"></i> Review</button>
          </div>

          <div style="margin-bottom:8px">
            <label style="font-size:10px;text-transform:uppercase;color:var(--text-dim);font-weight:700;display:block;margin-bottom:3px">Attach Docket Case File *</label>
            <select class="chat-input" id="chat-case-select" onchange="window._chat.onCaseChange(this.value)" style="padding:6px 8px;font-size:11.5px;height:auto;width:100% !important;flex:none !important">
              <option value="">— Select Docket File —</option>
            </select>
          </div>

          <div id="chat-hearing-stage-wrap" style="background:var(--surface3);border:1px solid var(--border);border-radius:6px;padding:6px;margin-bottom:8px;display:none">
            <label style="font-size:9.5px;text-transform:uppercase;color:var(--text-dim);font-weight:700;display:block;margin-bottom:2px"><i class="bi bi-flag"></i> Scheduled Court Appearance Date</label>
            <select class="chat-input" id="chat-target-hearing-select" onchange="window._chat.onHearingSync(this.value)" style="padding:5px 6px;font-size:11px;height:auto;width:100% !important;flex:none !important">
              <option value="">— Select scheduled hearing date —</option>
            </select>
          </div>

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

          <div style="margin-bottom:8px">
            <input id="avail-venue-input" class="chat-input" placeholder="Courtroom / Venue (e.g. RTC Branch 20)" style="margin-bottom:6px;padding:6px 8px;font-size:11.5px;width:100% !important;flex:none !important"/>
            <textarea id="avail-notes-input" class="chat-input" rows="2" placeholder="Specific hearing goals or strategy notes..." style="padding:6px 8px;font-size:11.5px;resize:vertical;width:100% !important;flex:none !important"></textarea>
          </div>

          <div style="display:flex;gap:6px;justify-content:flex-end">
            <button class="btn btn-secondary btn-sm" type="button" onclick="window._chat.toggleAvailPicker()" style="font-size:11px;padding:4px 8px">Cancel</button>
            <button class="btn btn-primary btn-sm" type="button" onclick="window._chat.sendAvailRequest()" style="font-size:11px;padding:4px 10px"><i class="bi bi-send-fill"></i> Send Proposal</button>
          </div>
        </div>

        <input type="file" id="chat-file-input" style="display:none" onchange="window._chat.handleFileAttachment(event)"/>

        <div class="chat-input-row">
          <button class="chat-avail-btn" type="button" title="Attach Document / File" onclick="document.getElementById('chat-file-input').click()"><i class="bi bi-paperclip"></i></button>
          <button class="chat-avail-btn" type="button" title="Request Schedule / Hearing Appearance" onclick="window._chat.toggleAvailPicker()"><i class="bi bi-calendar-plus"></i></button>
          <input id="chat-msg-input" class="chat-input" type="text" placeholder="Write a message…" maxlength="1000"/>
          <button class="chat-send-btn" type="button" id="chat-send-btn"><i class="bi bi-send-fill"></i></button>
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

  function initChatTimeInputEngine() {
    const timeBox = document.getElementById("chat-custom-time");
    if (!timeBox) return;
    timeBox.addEventListener("keydown", function (e) {
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault(); this.value = "00:00"; chatTimeTypedCount = 0; return;
      }
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        const num = e.key;
        if (chatTimeTypedCount >= 4 || this.value === "00:00") {
          this.value = `0${num}:00`;
          chatTimeTypedCount = (num === "1" || num === "0") ? 1 : 2;
        } else if (chatTimeTypedCount === 1) {
          const firstHourDigit = this.value[1];
          const combined = parseInt(firstHourDigit + num, 10);
          if (combined <= 12) { this.value = `${firstHourDigit}${num}:00`; chatTimeTypedCount = 2; }
          else { this.value = `0${firstHourDigit}:${num}0`; chatTimeTypedCount = 3; }
        } else if (chatTimeTypedCount === 2) {
          this.value = `${this.value.slice(0, 2)}:${Math.min(5, parseInt(num, 10))}0`; chatTimeTypedCount = 3;
        } else if (chatTimeTypedCount === 3) {
          this.value = `${this.value.slice(0, 2)}:${this.value[3]}${num}`; chatTimeTypedCount = 4;
        }
      }
    });
    timeBox.addEventListener("blur", function () {
      if (!this.value || this.value.trim() === "" || this.value.length < 5) {
        this.value = "00:00"; chatTimeTypedCount = 0;
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

    if (typeof window.closeAllTopPopovers === "function") window.closeAllTopPopovers();
    const notifDropdown = document.getElementById("notif-dropdown");
    if (notifDropdown) notifDropdown.classList.add("hidden");

    isExpanded = true;
    document.body.classList.add("chat-open");
    const panel = document.getElementById("chat-panel");
    if (panel) panel.classList.remove("hidden");

    if (activeChannel === "group") {
      setSeenTimestamp("group");
      markChannelMessagesAsRead(COLLECTION_GROUP, groupMessages);
      renderMessages("chat-messages-container", groupMessages, false, true, "");
    } else if (activeChannel) {
      const channelId = dmChannelId(myUid, activeChannel);
      setSeenTimestamp(channelId);
      markChannelMessagesAsRead(COLLECTION_DM + "_" + channelId, dmMessagesMap[channelId] || []);
      renderMessages("chat-messages-container", dmMessagesMap[channelId] || [], true, false, channelId);
    } else {
      renderConversationsList();
    }

    updateGlobalDockBadge();
  }

  function minimizeDock() {
    isExpanded = false;
    document.body.classList.remove("chat-open");
    const panel = document.getElementById("chat-panel");
    if (panel) panel.classList.add("hidden");
  }

  function backToList() {
    activeChannel = null;
    document.getElementById("chat-view-list").classList.remove("hidden");
    document.getElementById("chat-view-single").classList.add("hidden");
    document.getElementById("chat-header-title").textContent = "Recent Chats";
    renderConversationsList();
  }

  function filterConversations(q) {
    chatListFilter = (q || "").toLowerCase().trim();
    renderConversationsList();
  }

  async function announcePeer() {
    if (!window._db || !myUid || !myName) return;
    try {
      const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
      await setDoc(window._fbDoc(window._db, "chat_peers", myUid), {
        uid: myUid, name: myName, lastSeen: window._fbServerTs()
      }, { merge: true });
    } catch (e) {}
  }

  // ═══════════════════════════════════════════════════════════
  //  AUTO-SUBSCRIBE TO PEERS + ALL DM CHANNELS
  // ═══════════════════════════════════════════════════════════
  function subscribePeersAndAllDms() {
    if (!window._db || !myUid) return;
    if (peersUnsub) { peersUnsub(); peersUnsub = null; }

    peersUnsub = window._fbOnSnapshot(window._fbCol(window._db, "chat_peers"), (snap) => {
      const rawPeers = snap.docs.map(d => d.data()).filter(p => p.uid && p.uid !== myUid && p.name);
      const allProfiles = window.profiles || [];
      const myProf = allProfiles.find(p => p.ownerUid === myUid);
      const isDeveloper = myProf && myProf.role === "developer";

      if (allProfiles.length > 0) {
        const devUids = allProfiles.filter(p => p.role === "developer").map(p => p.ownerUid);
        peersList = isDeveloper ? rawPeers.filter(p => devUids.includes(p.uid)) : rawPeers.filter(p => !devUids.includes(p.uid));
      } else {
        peersList = rawPeers;
      }

      peersList.forEach(p => subscribeDmChannel(p.uid));
      renderConversationsList();
    }, () => {});
  }

  function subscribeDmChannel(peerUid) {
    if (!window._db || !myUid || !peerUid) return;
    const channelId = dmChannelId(myUid, peerUid);
    if (dmUnsubs[channelId]) return;

    const q = window._fbQuery(
      window._fbCol(window._db, COLLECTION_DM + "_" + channelId),
      window._fbOrderBy("ts", "asc"),
      window._fbLimit(MSG_LIMIT)
    );

    dmUnsubs[channelId] = window._fbOnSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      dmMessagesMap[channelId] = msgs;
      window.dmMessagesMap = dmMessagesMap;

      if (activeChannel === peerUid && isExpanded) {
        setSeenTimestamp(channelId);
        markChannelMessagesAsRead(COLLECTION_DM + "_" + channelId, msgs);
        renderMessages("chat-messages-container", msgs, true, false, channelId);
      }

      const newFromOthers = snap.docChanges().filter(c => c.type === "added" && c.doc.data().uid !== myUid).length;
      if (newFromOthers > 0 && typeof window.playChatSound === "function") window.playChatSound();

      renderConversationsList();
    }, () => {});
  }

  // ═══════════════════════════════════════════════════════════
  //  RECENT CONVERSATIONS LIST
  // ═══════════════════════════════════════════════════════════
  function formatMsgPreview(msg, isGroup) {
    if (!msg) return "Start conversation…";
    let body = "";
    if (msg.cardType === "availability_request") {
      body = `<span style="color:var(--gold);font-weight:700"><i class="bi bi-bank"></i> Proposal: "${escHtml(msg.caseTitle || msg.reqTitle || 'Case')}"</span>`;
    } else if (msg.cardType === "file_attachment") {
      body = `<i class="bi bi-paperclip"></i> ${escHtml(msg.fileName || 'File')}`;
    } else {
      body = escHtml(msg.text || "");
    }
    if (msg.uid === myUid) return `You: ${body}`;
    if (isGroup) return `${escHtml(msg.name || 'Counsel')}: ${body}`;
    return body;
  }

  function renderConversationsList() {
    const listEl = document.getElementById("chat-recent-conversations");
    if (!listEl) return;

    const allProfiles = window.profiles || [];
    const myProf = allProfiles.find(p => p.ownerUid === myUid);
    const isDeveloper = myProf && myProf.role === "developer";

    const latestGroupMsg = groupMessages[groupMessages.length - 1];
    const groupTimeMs = latestGroupMsg?.ts?.toDate ? latestGroupMsg.ts.toDate().getTime() : 0;
    const groupUnread = !!(latestGroupMsg && latestGroupMsg.uid !== myUid && !isMsgReadBy(latestGroupMsg, myUid) && groupTimeMs > getSeenTimestamp("group"));
    const groupReadCount = latestGroupMsg?.readBy ? Object.keys(latestGroupMsg.readBy).filter(uid => uid !== myUid).length : 0;
    const groupSentStatus = (latestGroupMsg && latestGroupMsg.uid === myUid)
      ? (groupReadCount > 0 ? `<span class="chat-read-chip seen"><i class="bi bi-check2-all"></i> Seen (${groupReadCount})</span>` : `<span class="chat-read-chip sent"><i class="bi bi-check2"></i> Sent</span>`)
      : "";

    const conversations = [{
      id: "group",
      name: isDeveloper ? "Developer Sandbox Chat" : "Firm Group Chat",
      avatar: isDeveloper ? `<i class="bi bi-code-slash" style="color:var(--cyan)"></i>` : `<i class="bi bi-megaphone-fill" style="color:var(--gold)"></i>`,
      isGroup: true,
      isOnline: false,
      timeMs: groupTimeMs,
      preview: latestGroupMsg ? formatMsgPreview(latestGroupMsg, true) : "No messages yet",
      unread: groupUnread,
      statusChip: groupUnread ? `<span class="chat-read-chip unread">Unread</span>` : groupSentStatus
    }];

    const nowMs = Date.now();
    peersList.forEach(p => {
      const channelId = dmChannelId(myUid, p.uid);
      const msgs = dmMessagesMap[channelId] || [];
      const lastMsg = msgs[msgs.length - 1];
      const timeMs = lastMsg?.ts?.toDate ? lastMsg.ts.toDate().getTime() : 0;
      const displayName = resolvePeerDisplayName(p);
      const seenMs = p.lastSeen?.toDate ? p.lastSeen.toDate().getTime() : 0;
      const isOnline = (nowMs - seenMs) <= 5 * 60 * 1000;

      const unread = !!(lastMsg && lastMsg.uid !== myUid && !isMsgReadBy(lastMsg, myUid) && timeMs > getSeenTimestamp(channelId));
      let statusChip = "";
      if (unread) statusChip = `<span class="chat-read-chip unread">Unread</span>`;
      else if (lastMsg && lastMsg.uid === myUid) {
        statusChip = isMsgReadBy(lastMsg, p.uid)
          ? `<span class="chat-read-chip seen"><i class="bi bi-check2-all"></i> Read</span>`
          : `<span class="chat-read-chip sent"><i class="bi bi-check2"></i> Sent</span>`;
      }

      conversations.push({
        id: p.uid, name: displayName, avatar: initials(displayName),
        isGroup: false, isOnline, timeMs,
        preview: formatMsgPreview(lastMsg, false), unread, statusChip
      });
    });

    conversations.sort((a, b) => b.timeMs - a.timeMs);

    const visible = chatListFilter
      ? conversations.filter(c => c.name.toLowerCase().includes(chatListFilter))
      : conversations;

    listEl.innerHTML = visible.length === 0
      ? `<div class="chat-empty">No matching conversations.</div>`
      : visible.map(c => `
        <div class="chat-conv-item ${c.unread ? 'unread' : ''}" onclick="window._chat.openConversation('${c.id}', '${escHtml(c.name)}', ${c.isGroup})">
          <div class="chat-conv-avatar">
            ${c.avatar}
            ${!c.isGroup && c.isOnline ? '<span class="chat-plain-dot online" title="Online"></span>' : ''}
          </div>
          <div class="chat-conv-info">
            <div class="chat-conv-name-row">
              <span class="chat-conv-name ${c.unread ? 'bold' : ''}">${escHtml(c.name)}</span>
              ${c.timeMs ? '<span class="chat-conv-time">' + formatTime(new Date(c.timeMs)) + '</span>' : ''}
            </div>
            <div class="chat-conv-preview-row">
              <div class="chat-conv-preview ${c.unread ? 'bold' : ''}">${c.preview}</div>
              ${c.statusChip}
            </div>
          </div>
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
      markChannelMessagesAsRead(COLLECTION_GROUP, groupMessages);
      renderMessages("chat-messages-container", groupMessages, false, true, "");
    } else {
      const channelId = dmChannelId(myUid, id);
      setSeenTimestamp(channelId);
      subscribeDmChannel(id);
      const msgs = dmMessagesMap[channelId] || [];
      markChannelMessagesAsRead(COLLECTION_DM + "_" + channelId, msgs);
      renderMessages("chat-messages-container", msgs, true, false, channelId);
    }

    renderConversationsList();
    document.getElementById("chat-msg-input").focus();
  }

  async function handleFileAttachment(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (window.showToast) window.showToast("Attaching file to chat...");
    let driveLink = null, driveFileId = null;

    try {
      if (typeof window.hasValidToken === "function" && window.hasValidToken() && typeof window.uploadSingleFileToDrive === "function") {
        const myProf = window.profiles ? window.profiles.find(p => p.ownerUid === myUid) : null;
        const result = await window.uploadSingleFileToDrive(file, myProf?.driveFolderId || "root");
        if (result) { driveFileId = result.id; driveLink = result.webViewLink; }
      }
    } catch (err) {}

    const payload = {
      text: `Attached File: ${file.name}`,
      cardType: "file_attachment",
      fileName: file.name,
      fileSize: (file.size / 1024).toFixed(1) + " KB",
      driveLink, driveFileId,
      uid: myUid, name: myName,
      readBy: { [myUid]: Date.now() },
      ts: window._fbServerTs()
    };

    try {
      if (activeChannel === "group") {
        await window._fbAddDoc(window._fbCol(window._db, COLLECTION_GROUP), payload);
        setSeenTimestamp("group");
      } else if (activeChannel) {
        const channelId = dmChannelId(myUid, activeChannel);
        await window._fbAddDoc(window._fbCol(window._db, COLLECTION_DM + "_" + channelId), { ...payload, peerUid: activeChannel, peerName: activePeerName });
        setSeenTimestamp(channelId);
      }
      if (window.showToast) window.showToast("File sent to chat!");
    } catch (e) {
      if (window.showToast) window.showToast("Failed to send file: " + e.message, "error");
    } finally {
      event.target.value = "";
    }
  }

  function subscribeGroup() {
    if (groupUnsub || !window._db) return;
    const q = window._fbQuery(
      window._fbCol(window._db, COLLECTION_GROUP),
      window._fbOrderBy("ts", "asc"),
      window._fbLimit(MSG_LIMIT)
    );

    groupUnsub = window._fbOnSnapshot(q, snap => {
      groupMessages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      window.groupMessages = groupMessages;

      if (activeChannel === "group" && isExpanded) {
        setSeenTimestamp("group");
        markChannelMessagesAsRead(COLLECTION_GROUP, groupMessages);
        renderMessages("chat-messages-container", groupMessages, false, true, "");
      }

      const newFromOthers = snap.docChanges().filter(c => c.type === "added" && c.doc.data().uid !== myUid).length;
      if (newFromOthers > 0 && typeof window.playChatSound === "function") window.playChatSound();

      renderConversationsList();
    });
  }

  async function sendMessage() {
    const input = document.getElementById("chat-msg-input");
    const text = input.value.trim();
    if (!text || !window._db || !myUid || !myName) return;
    input.value = "";

    const basePayload = { text, uid: myUid, name: myName, readBy: { [myUid]: Date.now() }, ts: window._fbServerTs() };
    try {
      if (activeChannel === "group") {
        await window._fbAddDoc(window._fbCol(window._db, COLLECTION_GROUP), basePayload);
        setSeenTimestamp("group");
      } else if (activeChannel) {
        const channelId = dmChannelId(myUid, activeChannel);
        await window._fbAddDoc(window._fbCol(window._db, COLLECTION_DM + "_" + channelId), { ...basePayload, peerUid: activeChannel, peerName: activePeerName });
        setSeenTimestamp(channelId);
      }
    } catch (e) {}
  }

  function toggleAvailPicker() {
    const el = document.getElementById("chat-avail-picker");
    if (!el) return;
    el.classList.toggle("hidden");
    if (!el.classList.contains("hidden")) {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      const dateInp = document.getElementById("avail-date-input");
      if (dateInp) dateInp.value = tomorrow.toISOString().split("T")[0];
      const caseSel = document.getElementById("chat-case-select");
      if (caseSel) {
        const userCases = typeof window.getAccessibleCases === "function" ? window.getAccessibleCases() : (window.cases || []);
        caseSel.innerHTML = `<option value="">— Select Docket File (${userCases.length} available) —</option>` +
          userCases.map(c => `<option value="${c.id}">${escHtml(c.title)} (${c.caseNumber || 'No Docket'})</option>`).join("");
      }
    }
  }

  function setPurpose(btn, type) {
    document.querySelectorAll('#chat-purpose-chips button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    chatPurposeType = type;
    const wrap = document.getElementById("chat-hearing-stage-wrap");
    const caseId = document.getElementById("chat-case-select")?.value;
    const selC = getActiveCaseList().find(c => c.id === caseId);
    if (wrap) wrap.style.display = (type === "present_hearing" && selC) ? "block" : "none";
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
    const allCases = typeof window.getAccessibleCases === "function" ? window.getAccessibleCases() : getActiveCaseList();
    const selC = allCases.find(c => c.id === caseId);
    if (selC && vInp) vInp.value = selC.venue || "";
    if (!selC) { if (wrap) wrap.style.display = "none"; return; }

    const hearingsList = Array.isArray(selC.hearings) ? [...selC.hearings] : [];
    if (selC.dueDate && !hearingsList.some(h => h.date === selC.dueDate)) {
      hearingsList.push({ id: "h_due_legacy", date: selC.dueDate, time: "08:30", purpose: "Scheduled Court Appearance" });
    }
    if (hearingsList.length > 0 && hSel) {
      hSel.innerHTML = `<option value="">— Select scheduled hearing (${hearingsList.length} found) —</option>` +
        hearingsList.map(h => `<option value="${h.id || h.date}">${formatDate(h.date)} (${h.time || '08:30'}) — ${escHtml(h.purpose || 'Hearing Appearance')}</option>`).join("");
      if (wrap) wrap.style.display = "block";
    } else if (wrap) wrap.style.display = "none";
  }

  function onHearingSync(hId) {
    const caseId = document.getElementById("chat-case-select")?.value;
    const selC = getActiveCaseList().find(c => c.id === caseId);
    const h = (selC?.hearings || []).find(x => x.id === hId || x.date === hId);
    if (h) {
      const dInp = document.getElementById("avail-date-input");
      const tInp = document.getElementById("chat-custom-time");
      if (dInp && h.date) dInp.value = h.date;
      if (tInp && h.time) { tInp.value = h.time.slice(0, 5); chatTimeTypedCount = 4; }
    }
  }

  async function sendAvailRequest() {
    const caseId = document.getElementById("chat-case-select")?.value;
    const date = document.getElementById("avail-date-input")?.value;
    const time = (document.getElementById("chat-custom-time")?.value || "08:30").trim();
    const venue = (document.getElementById("avail-venue-input")?.value || "").trim();
    const notes = (document.getElementById("avail-notes-input")?.value || "").trim();
    if (!date) { if (window.showToast) window.showToast("Please pick a date.", "error"); return; }

    const allCases = typeof window.getAccessibleCases === "function" ? window.getAccessibleCases() : getActiveCaseList();
    const selC = allCases.find(c => c.id === caseId);
    const purposeLabel = chatPurposeType === "present_hearing" ? "Present Case in Court Hearing" : (chatPurposeType === "pleading_review" ? "Urgent Pleading Review" : "Case Strategy Meeting");

    let apptId = null;
    if (typeof window.dbAddAppointment === "function") {
      try {
        apptId = await window.dbAddAppointment({
          title: purposeLabel, date, time: `${time} ${chatAmPm}`, venue: venue || selC?.venue || "Firm Conference",
          description: notes, purposeType: chatPurposeType, caseId: selC?.id || null, caseTitle: selC?.title || null,
          requesterUid: myUid, requesterName: myName, targetUid: activeChannel !== "group" ? activeChannel : null,
          targetName: activePeerName || "Counsel", ownerUid: myUid, status: "pending"
        });
      } catch (e) {}
    }

    const payload = {
      text: `${purposeLabel}: ${selC ? selC.title : 'Consultation'} on ${date} at ${time} ${chatAmPm}`,
      cardType: "availability_request", apptId, reqTitle: purposeLabel, reqDate: date, reqTime: `${time} ${chatAmPm}`,
      date, time: `${time} ${chatAmPm}`, reqVenue: venue || selC?.venue || "Firm Conference Room", reqNotes: notes,
      purposeType: chatPurposeType, caseId: selC?.id || null, caseTitle: selC?.title || null,
      caseNumber: selC?.caseNumber || "Docket N/A", caseCategory: selC?.category || null,
      caseParties: selC?.parties || "N/A", caseVenue: selC?.venue || venue, caseFiledDate: selC?.filedDate || "",
      caseStatus: selC?.status || "On-going", caseNarrative: selC?.narrative || "",
      hearings: selC?.hearings || [], deadlines: selC?.deadlines || [], documents: selC?.documents || [],
      documentsCount: selC?.documents?.length || 0, reqStatus: "pending",
      uid: myUid, name: myName, readBy: { [myUid]: Date.now() }, ts: window._fbServerTs()
    };

    try {
      if (activeChannel === "group") {
        await window._fbAddDoc(window._fbCol(window._db, COLLECTION_GROUP), payload);
      } else if (activeChannel) {
        const channelId = dmChannelId(myUid, activeChannel);
        await window._fbAddDoc(window._fbCol(window._db, COLLECTION_DM + "_" + channelId), { ...payload, peerUid: activeChannel, peerName: activePeerName });
        if (typeof window.dbAddNotification === "function") {
          await window.dbAddNotification({
            toUid: activeChannel, fromUid: myUid, fromName: myName, title: purposeLabel,
            message: `${myName} requested you to ${purposeLabel.toLowerCase()} for "${selC ? selC.title : 'Court Consultation'}" on ${formatDate(date)} at ${time} ${chatAmPm}.`,
            type: "appointment_request", category: chatPurposeType === "present_hearing" ? "hearing" : "consultation",
            relatedId: apptId || selC?.id || null, caseId: selC?.id || null, caseTitle: selC?.title || null,
            date, time: `${time} ${chatAmPm}`, status: "unread", appointmentStatus: "pending"
          });
        }
      }
      toggleAvailPicker();
      if (window.showToast) window.showToast("Proposal sent to chat! 📅");
    } catch (err) {
      if (window.showToast) window.showToast("Failed to send request: " + err.message, "error");
    }
  }

  async function respondAvailCard(msgId, isGroup, channelId, status) {
    if (!window._db || !msgId) return;
    try {
      const colName = isGroup ? COLLECTION_GROUP : (COLLECTION_DM + "_" + channelId);
      const msgRef = window._fbDoc(window._db, colName, msgId);
      await window._fbUpdate(msgRef, { reqStatus: status, respondedByUid: myUid, respondedByName: myName });
      const snap = await window._fbGetDoc(msgRef).catch(() => null);
      const msgData = snap?.exists() ? snap.data() : null;

      if (status === "accepted" && msgData?.caseId) {
        const targetCase = getActiveCaseList().find(c => c.id === msgData.caseId);
        if (targetCase) {
          const allowed = Array.from(new Set([...(targetCase.allowedUids || [targetCase.ownerUid]), myUid]));
          const shared = Array.from(new Set([...(targetCase.sharedWith || []), myUid]));
          if (typeof window.dbUpdateCase === "function") await window.dbUpdateCase(targetCase.id, { allowedUids: allowed, sharedWith: shared }).catch(() => {});
          targetCase.allowedUids = allowed; targetCase.sharedWith = shared;
        }
        if (msgData.apptId && typeof window.dbUpdateAppointment === "function") await window.dbUpdateAppointment(msgData.apptId, { status: "accepted" }).catch(() => {});
        if (typeof window.renderAllCases === "function") window.renderAllCases();
        if (typeof window.renderDashboard === "function") window.renderDashboard();
        if (window.showToast) window.showToast("Appearance Accepted!");
      } else if (window.showToast) {
        window.showToast("Proposal declined.");
      }
    } catch (err) {
      if (window.showToast) window.showToast("Failed to respond: " + err.message, "error");
    }
  }

  function promptCancelAppearance(caseId, apptId, msgId, isGroup, channelId) {
    if (typeof window.openConfirmModal === "function") {
      window.openConfirmModal({
        icon: "bi-exclamation-octagon-fill", title: "Cancel Appearance Delegation?",
        body: "Cancel your appearance for this case and notify counsel?",
        confirmText: "Confirm", cancelText: "Keep", confirmStyle: "btn-danger",
        onConfirm: () => executeCancelAppearance(caseId, apptId, msgId, isGroup, channelId)
      });
    }
  }

  async function executeCancelAppearance(caseId, apptId, msgId, isGroup, channelId) {
    if (apptId && typeof window.dbUpdateAppointment === "function") await window.dbUpdateAppointment(apptId, { status: "cancelled" }).catch(() => {});
    if (msgId && window._db) {
      const colName = isGroup ? COLLECTION_GROUP : (COLLECTION_DM + "_" + channelId);
      await window._fbUpdate(window._fbDoc(window._db, colName, msgId), { reqStatus: "cancelled", cancelledByUid: myUid, cancelledByName: myName }).catch(() => {});
    }
    if (typeof window.renderAllCases === "function") window.renderAllCases();
    if (typeof window.renderDashboard === "function") window.renderDashboard();
  }

  function renderMessages(containerId, msgs, isDm, isGroup, channelId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (msgs.length === 0) {
      el.innerHTML = `<div class="chat-empty"><i class="bi bi-chat-square-text" style="font-size:24px;color:var(--gold);display:block;margin-bottom:6px"></i>No messages yet. Say hello!</div>`;
      return;
    }

    el.innerHTML = msgs.map((m, i) => {
      const isMine = m.uid === myUid;
      const ts = m.ts?.toDate ? formatTime(m.ts.toDate()) : "";
      const showName = !isMine && (i === 0 || msgs[i - 1].uid !== m.uid);

      let receiptMarkup = "";
      if (isMine) {
        if (isDm && activeChannel) {
          receiptMarkup = isMsgReadBy(m, activeChannel)
            ? `<span class="chat-msg-receipt seen"><i class="bi bi-check2-all"></i> Read</span>`
            : `<span class="chat-msg-receipt"><i class="bi bi-check2"></i> Sent</span>`;
        } else if (isGroup) {
          const readers = m.readBy ? Object.keys(m.readBy).filter(uid => uid !== myUid).length : 0;
          receiptMarkup = readers > 0
            ? `<span class="chat-msg-receipt seen"><i class="bi bi-check2-all"></i> Seen (${readers})</span>`
            : `<span class="chat-msg-receipt"><i class="bi bi-check2"></i> Sent</span>`;
        }
      }

      if (m.cardType === "availability_request") {
        const reqStatus = m.reqStatus || "pending";
        let statusBadge = `<span class="avail-badge pending"><i class="bi bi-clock"></i> Pending Acceptance</span>`;
        if (reqStatus === "accepted") statusBadge = `<span class="avail-badge" style="color:var(--green)"><i class="bi bi-check-circle-fill"></i> Accepted (${escHtml(m.respondedByName || 'Accepted')})</span>`;
        if (reqStatus === "declined") statusBadge = `<span class="avail-badge" style="color:var(--red)"><i class="bi bi-slash-circle-fill"></i> Declined</span>`;
        if (reqStatus === "cancelled") statusBadge = `<span class="avail-badge" style="color:var(--red)"><i class="bi bi-x-octagon-fill"></i> Cancelled</span>`;

        const actionBtns = (!isMine && reqStatus === "pending")
          ? `<div style="display:flex;gap:6px;margin-top:10px;align-items:center;flex-wrap:wrap">
              <button class="btn btn-secondary btn-sm" type="button" style="font-size:11px;padding:5px 10px" onclick="window.openProposalReviewModal('${m.caseId || ''}', '${m.apptId || m.id}', '${m.id}', ${isGroup}, '${channelId}')"><i class="bi bi-info-circle-fill"></i> Check Information</button>
              <button class="chat-card-btn confirm" type="button" onclick="window._chat.respondAvailCard('${m.id}', ${isGroup}, '${channelId}', 'accepted')"><i class="bi bi-check2"></i> Accept</button>
              <button class="chat-card-btn decline" type="button" onclick="window._chat.respondAvailCard('${m.id}', ${isGroup}, '${channelId}', 'declined')"><i class="bi bi-x"></i></button>
            </div>`
          : "";

        return `
          <div class="chat-msg-wrap ${isMine ? "mine" : "theirs"}">
            ${showName ? `<div class="chat-msg-sender">${escHtml(m.name || "Unknown")}</div>` : ""}
            <div class="chat-avail-card" style="border-left:3.5px solid var(--gold);max-width:92%">
              <div style="font-size:10.5px;font-weight:700;color:var(--gold);text-transform:uppercase"><i class="bi bi-bank"></i> ${escHtml(m.reqTitle || "Appearance Request")}</div>
              ${m.caseTitle ? `<div style="font-weight:700;font-size:12px;margin:4px 0">⚖️ ${escHtml(m.caseTitle)}</div>` : ''}
              <div style="font-size:11.5px;color:var(--text)">${m.reqDate || m.date || ''} · ${m.reqTime || m.time || ''}</div>
              <div style="margin-top:6px">${statusBadge}</div>
              ${actionBtns}
              <div class="chat-meta-line"><span class="chat-ts">${ts}</span>${receiptMarkup}</div>
            </div>
          </div>`;
      } else if (m.cardType === "file_attachment") {
        const linkMarkup = m.driveLink
          ? `<a href="${m.driveLink}" target="_blank" style="text-decoration:underline;font-weight:700"><i class="bi bi-file-earmark-text-fill"></i> ${escHtml(m.fileName)}</a>`
          : `<i class="bi bi-file-earmark-text-fill"></i> ${escHtml(m.fileName)}`;
        return `
          <div class="chat-msg-wrap ${isMine ? "mine" : "theirs"}">
            ${showName ? `<div class="chat-msg-sender">${escHtml(m.name || "Unknown")}</div>` : ""}
            <div class="chat-bubble-msg ${isMine ? "mine" : "theirs"}">
              <div style="font-size:10.5px;font-weight:700;margin-bottom:2px"><i class="bi bi-paperclip"></i> File Attachment</div>
              <div style="font-size:13px">${linkMarkup}</div>
              <div class="chat-meta-line"><span class="chat-ts">${ts}</span>${receiptMarkup}</div>
            </div>
          </div>`;
      }

      return `
        <div class="chat-msg-wrap ${isMine ? "mine" : "theirs"}">
          ${showName ? `<div class="chat-msg-sender">${escHtml(m.name || "Unknown")}</div>` : ""}
          <div class="chat-bubble-msg ${isMine ? "mine" : "theirs"}">
            ${escHtml(m.text)}
            <div class="chat-meta-line"><span class="chat-ts">${ts}</span>${receiptMarkup}</div>
          </div>
        </div>`;
    }).join("");

    el.scrollTop = el.scrollHeight;
  }

  function updateGlobalDockBadge() {
    let totalUnread = 0;
    const latestGroupMsg = groupMessages[groupMessages.length - 1];
    if (latestGroupMsg && latestGroupMsg.uid !== myUid && !isMsgReadBy(latestGroupMsg, myUid)) {
      const gTimeMs = latestGroupMsg.ts?.toDate ? latestGroupMsg.ts.toDate().getTime() : 0;
      if (gTimeMs > getSeenTimestamp("group")) totalUnread++;
    }
    peersList.forEach(p => {
      const channelId = dmChannelId(myUid, p.uid);
      const msgs = dmMessagesMap[channelId] || [];
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg && lastMsg.uid !== myUid && !isMsgReadBy(lastMsg, myUid)) {
        const timeMs = lastMsg.ts?.toDate ? lastMsg.ts.toDate().getTime() : 0;
        if (timeMs > getSeenTimestamp(channelId)) totalUnread++;
      }
    });
    [document.getElementById("chat-hdr-badge"), document.getElementById("chat-dock-badge")].forEach(b => {
      if (!b) return;
      b.textContent = totalUnread > 9 ? "9+" : totalUnread;
      b.classList.toggle("hidden", totalUnread === 0);
    });
  }

  function initials(name) { return (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase(); }
  function escHtml(str) { return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
  function formatTime(date) {
    const diff = Date.now() - date;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (date.toDateString() === new Date().toDateString()) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  function formatDate(d) { return d ? new Date(d + 'T00:00:00').toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "N/A"; }

  function injectStyles() {
    const s = document.createElement("style");
    s.textContent = `
      #chat-dock-bar { display: none !important; }
      .chat-badge {
        background: var(--red, #e53e3e); color: #fff; font-size: 10px; font-weight: 700;
        min-width: 18px; height: 18px; border-radius: 9px; display: flex; align-items: center; justify-content: center; padding: 0 5px;
      }
      .chat-badge.hidden { display: none; }
      
      /* Desktop Dock Style */
      .chat-panel {
        position: fixed !important; bottom: 24px !important; right: 24px !important;
        width: 376px !important; max-width: calc(100vw - 24px) !important; height: 520px !important;
        background: var(--surface) !important; border: 1px solid var(--gold-border) !important;
        border-radius: 18px !important; display: flex !important; flex-direction: column !important;
        z-index: 99998 !important; box-shadow: var(--shadow) !important; overflow: hidden !important;
      }
      .chat-panel.hidden { display: none !important; }

      /* Mobile & Small Tablet Fullscreen Override */
      @media (max-width: 680px) {
        .chat-panel {
          position: fixed !important;
          inset: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          height: 100dvh !important;
          margin: 0 !important;
          border-radius: 0 !important;
          border: none !important;
          box-shadow: none !important;
          z-index: 99999 !important;
        }
        .chat-header {
          padding-top: calc(12px + env(safe-area-inset-top, 0px)) !important;
        }
        .chat-input-row {
          padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px)) !important;
        }
      }

      .chat-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 13px 16px; background: var(--surface2); border-bottom: 1px solid var(--border); flex-shrink: 0; cursor: pointer;
      }
      .chat-header-left { display: flex; align-items: center; gap: 8px; }
      .chat-header-icon { color: var(--gold); font-size: 15px; }
      .chat-header-title { font-size: 13.5px; font-weight: 700; color: var(--text); }
      .chat-header-pill {
        font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 999px;
        background: var(--gold-dim); color: var(--gold-light); border: 1px solid var(--gold-border);
      }
      .chat-icon-btn { color: var(--text-dim); font-size: 14px; padding: 4px 8px; border-radius: 6px; }
      .chat-view { display: flex; flex-direction: column; flex: 1; overflow: hidden; width: 100% !important; }
      .chat-view.hidden { display: none; }
      .chat-search-wrap { position: relative; padding: 8px 10px 4px; }
      .chat-search-icon { position: absolute; left: 20px; top: 16px; color: var(--text-dim); font-size: 12px; pointer-events: none; }
      .chat-search-inp {
        width: 100%; background: var(--surface2); border: 1px solid var(--border); border-radius: 9px;
        padding: 7px 10px 7px 30px; font-size: 12px; color: var(--text); outline: none;
      }
      .chat-search-inp:focus { border-color: var(--gold-border); }
      .chat-conversations-list { flex: 1; overflow-y: auto; padding: 6px 10px 10px; display: flex; flex-direction: column; gap: 7px; }
      .chat-conv-item {
        display: flex; align-items: center; gap: 11px; padding: 10px 12px; border-radius: 12px;
        cursor: pointer; background: var(--surface2); border: 1px solid var(--border); transition: background 0.15s, border-color 0.15s;
      }
      .chat-conv-item:hover { background: var(--surface3); border-color: var(--gold-border); }
      .chat-conv-item.unread { border-left: 3px solid var(--gold); background: var(--gold-dim); }
      .chat-conv-avatar {
        width: 36px; height: 36px; border-radius: 50%; background: var(--surface3);
        border: 1.5px solid var(--gold-border); color: var(--gold-light); position: relative;
        font-size: 12.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .chat-plain-dot {
        position: absolute; bottom: -1px; right: -1px; width: 10px; height: 10px; border-radius: 50%;
        border: 2px solid var(--surface2); background: var(--green); box-shadow: none !important; animation: none !important;
      }
      .chat-conv-info { flex: 1; min-width: 0; }
      .chat-conv-name-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 2px; }
      .chat-conv-name { font-size: 13px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .chat-conv-name.bold { font-weight: 800; }
      .chat-conv-time { font-size: 10px; color: var(--text-dim); flex-shrink: 0; }
      .chat-conv-preview-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
      .chat-conv-preview { font-size: 11.5px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
      .chat-conv-preview.bold { color: var(--text); font-weight: 600; }
      .chat-read-chip { font-size: 10px; font-weight: 700; flex-shrink: 0; display: inline-flex; align-items: center; gap: 3px; padding: 1px 6px; border-radius: 999px; }
      .chat-read-chip.unread { background: var(--surface); color: var(--gold-light); border: 1px solid var(--gold-border); }
      .chat-read-chip.seen { color: var(--green); }
      .chat-read-chip.sent { color: var(--text-dim); }
      .chat-messages { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 6px; scroll-behavior: smooth; }
      .chat-empty { text-align: center; color: var(--text-muted); font-size: 12px; margin: auto; padding: 20px; }
      .chat-msg-wrap { display: flex; flex-direction: column; margin-bottom: 4px; }
      .chat-msg-wrap.mine { align-items: flex-end; }
      .chat-msg-wrap.theirs { align-items: flex-start; }
      .chat-msg-sender { font-size: 10px; color: var(--gold); margin-bottom: 2px; padding: 0 4px; font-weight: 600; }
      .chat-bubble-msg { max-width: 82%; padding: 9px 13px; border-radius: 14px; font-size: 13px; line-height: 1.45; word-break: break-word; }
      .chat-bubble-msg.mine { background: var(--gold-dim); color: var(--text); border: 1px solid var(--gold-border); border-bottom-right-radius: 4px; }
      .chat-bubble-msg.theirs { background: var(--surface2); color: var(--text); border: 1px solid var(--border); border-bottom-left-radius: 4px; }
      .chat-meta-line { display: flex; align-items: center; justify-content: flex-end; gap: 6px; margin-top: 3px; }
      .chat-ts { font-size: 9px; color: var(--text-dim); }
      .chat-msg-receipt { font-size: 9.5px; font-weight: 700; color: var(--text-dim); display: inline-flex; align-items: center; gap: 2px; }
      .chat-msg-receipt.seen { color: var(--green); }
      .chat-avail-card { max-width: 90%; padding: 10px 12px; border-radius: 10px; background: var(--surface2); border: 1px solid var(--border); }
      .chat-avail-picker { max-height: 360px; overflow-y: auto; padding: 12px; background: var(--surface2); border-top: 1px solid var(--border); }
      .avail-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px; }
      .avail-badge.pending { background: var(--amber-bg); color: var(--amber); }
      .chat-card-btn { flex: 1; padding: 5px 8px; border-radius: 6px; font-size: 10.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px; }
      .chat-card-btn.confirm { background: var(--green); color: #040810; }
      .chat-card-btn.decline { background: transparent; border: 1px solid var(--red); color: var(--red); }
      .chat-input-row { display: flex !important; gap: 6px !important; padding: 9px 10px !important; border-top: 1px solid var(--border) !important; align-items: center !important; background: var(--surface2) !important; }
      .chat-input { width: 0 !important; flex: 1 1 0px !important; min-width: 0 !important; background: var(--bg) !important; border: 1px solid var(--border) !important; border-radius: 9px !important; padding: 8px 10px !important; font-size: 12.5px !important; color: var(--text) !important; outline: none !important; }
      .chat-avail-btn { width: 32px !important; height: 32px !important; background: var(--surface3) !important; border: 1px solid var(--border-soft) !important; color: var(--gold) !important; border-radius: 8px !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; flex-shrink: 0 !important; }
      .chat-send-btn { background: var(--gold-solid, #c9a55c) !important; color: #060c13 !important; border-radius: 8px !important; padding: 0 12px !important; height: 32px !important; font-size: 12px !important; font-weight: 700 !important; flex-shrink: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; }
      .dm-conv-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 12px; border-bottom: 1px solid var(--border); background: var(--surface2); }
      .dm-back-btn { color: var(--gold); font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 4px; }
      .dm-conv-title { font-weight: 700; font-size: 13px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .dm-conv-meta { font-size: 10.5px; color: var(--text-dim); }
    `;
    document.head.appendChild(s);
  }

  window.toggleDock = toggleDock;
  window._chat = {
    toggleDock, openConversation, backToList, filterConversations, toggleAvailPicker,
    setPurpose, setAmPm, onCaseChange, onHearingSync, sendAvailRequest,
    respondAvailCard, promptCancelAppearance, executeCancelAppearance, handleFileAttachment
  };
})();
