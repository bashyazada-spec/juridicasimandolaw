// ═══════════════════════════════════════════════════════════════
//  SIMANDO LAW — MESSENGER-STYLE CHAT DOCK & CONVERSATIONS
//  Clean Floating Trigger on Desktop · Top Header Bar on Mobile
//  Mutually Exclusive with Notification Dropdown Popup
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

  // ── Bootstrap ────────────────────────────────────────────────
  function init() {
    injectStyles();
    buildUI();

    if (window._fbOnAuth && window._auth) {
      window._fbOnAuth(window._auth, (user) => {
        if (user) {
          myUid = user.uid;
          myName = user.displayName || user.email;
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
  //  UI BUILD — EXPANDABLE PANEL (TRIGGERED FROM TOP BAR ICON)
  // ═══════════════════════════════════════════════════════════
  function buildUI() {
    // Chat Panel (Expanded State)
    const panel = document.createElement("div");
    panel.id = "chat-panel";
    panel.className = "chat-panel hidden";
    panel.innerHTML = `
      <!-- Header -->
      <div class="chat-header" id="chat-panel-header" onclick="window._chat.toggleDock(event)" style="cursor:pointer;" title="Click header to minimize">
        <div class="chat-header-left" style="pointer-events:none;">
          <span class="chat-header-icon">⚖️</span>
          <span class="chat-header-title" id="chat-header-title">Recent Chats</span>
        </div>
        <div class="chat-header-actions" style="pointer-events:auto;">
          <button class="chat-icon-btn" title="Minimize" type="button" onclick="window._chat.toggleDock(event)">─</button>
        </div>
      </div>

      <!-- Conversations List View -->
      <div id="chat-view-list" class="chat-view">
        <div id="chat-recent-conversations" class="chat-conversations-list"></div>
      </div>

      <!-- Single Chat Messages View -->
      <div id="chat-view-single" class="chat-view hidden">
        <div class="dm-conv-header">
          <button class="dm-back-btn" type="button" onclick="window._chat.backToList()">← Back to Chats</button>
          <span id="dm-conv-title" style="font-weight:700;font-size:13px;color:var(--text)"></span>
        </div>

        <div id="chat-messages-container" class="chat-messages"></div>

        <!-- Inline Availability Picker -->
        <div id="chat-avail-picker" class="chat-avail-picker hidden">
          <div style="font-size:12px;font-weight:700;color:var(--gold,#c9a84c);margin-bottom:8px">📅 Ask Availability</div>
          <input id="avail-title-input" class="chat-input" style="margin-bottom:6px" placeholder="Purpose (e.g. Case Strategy Sync)" autocomplete="off"/>
          <div style="display:flex;gap:6px;margin-bottom:8px">
            <input id="avail-date-input" type="date" class="chat-input"/>
            <input id="avail-time-input" type="time" class="chat-input" value="14:00"/>
          </div>
          <div style="display:flex;gap:6px;justify-content:flex-end">
            <button class="chat-icon-btn" type="button" onclick="window._chat.toggleAvailPicker()">Cancel</button>
            <button class="chat-send-btn" type="button" onclick="window._chat.sendAvailRequest()">Send Card</button>
          </div>
        </div>

        <!-- Hidden File Input for Chat Attachments -->
        <input type="file" id="chat-file-input" style="display:none" onchange="window._chat.handleFileAttachment(event)"/>

        <!-- Input Row -->
        <div class="chat-input-row">
          <button class="chat-avail-btn" type="button" title="Attach Document / File" onclick="document.getElementById('chat-file-input').click()">📎</button>
          <button class="chat-avail-btn" type="button" title="Ask Availability" onclick="window._chat.toggleAvailPicker()">📅</button>
          <input id="chat-msg-input" class="chat-input" type="text" placeholder="Type a message…" maxlength="1000"/>
          <button class="chat-send-btn" type="button" id="chat-send-btn">Send</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    document.getElementById("chat-send-btn").addEventListener("click", sendMessage);
    document.getElementById("chat-msg-input").addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  DOCK TOGGLE (MUTUALLY EXCLUSIVE WITH NOTIFICATIONS)
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
  //  RECENT CONVERSATIONS LIST
  // ═══════════════════════════════════════════════════════════
  async function loadPeerList() {
    if (!window._db || !myUid) return;

    try {
      const db   = window._db;
      const snap = await window._fbGetDocs(window._fbCol(db, "chat_peers"));
      peersList = snap.docs
        .map(d => d.data())
        .filter(p => p.uid && p.uid !== myUid && p.name);

      renderConversationsList();
    } catch (e) {
      console.error("loadPeerList error:", e);
    }
  }

  function renderConversationsList() {
    const listEl = document.getElementById("chat-recent-conversations");
    if (!listEl) return;

    const latestGroupMsg = groupMessages[groupMessages.length - 1];
    const groupTimeMs = latestGroupMsg?.ts?.toDate ? latestGroupMsg.ts.toDate().getTime() : 0;
    const groupLastSeen = getSeenTimestamp("group");
    const groupUnread = latestGroupMsg && latestGroupMsg.uid !== myUid && groupTimeMs > groupLastSeen;

    let groupPreview = "No messages yet";
    if (latestGroupMsg) {
      if (latestGroupMsg.cardType === "availability_request") {
        groupPreview = `<span style="color:var(--gold,#c9a84c);font-weight:700">📅 Availability Request: "${escHtml(latestGroupMsg.reqTitle || 'Meeting')}"</span>`;
      } else if (latestGroupMsg.cardType === "file_attachment") {
        groupPreview = `📎 Attached File: ${escHtml(latestGroupMsg.fileName || 'File')}`;
      } else {
        groupPreview = `${escHtml(latestGroupMsg.name || 'User')}: ${escHtml(latestGroupMsg.text)}`;
      }
    }

    const conversations = [
      {
        id: "group",
        name: "📢 Firm Group Chat",
        avatar: "⚖️",
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
          preview = `<span style="color:var(--gold,#c9a84c);font-weight:700">📅 Availability Request: "${escHtml(lastMsg.reqTitle || 'Meeting')}"</span>`;
        } else if (lastMsg.cardType === "file_attachment") {
          preview = `📎 Attached File: ${escHtml(lastMsg.fileName || 'File')}`;
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
        ${c.unread ? '<span class="chat-unseen-dot" title="Unread message">●</span>' : ''}
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
      text: `📎 Attached File: ${file.name}`,
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
      if (window.showToast) window.showToast("File sent to chat! 📄");
    } catch (e) {
      console.error("handleFileAttachment error:", e);
      if (window.showToast) window.showToast("Failed to send file: " + e.message, "error");
    } finally {
      event.target.value = "";
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  MESSAGES & REAL-TIME LISTENERS
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
  //  AVAILABILITY CARDS & NOTIFICATIONS
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
    }
  }

  async function sendAvailRequest() {
    const titleInp = document.getElementById("avail-title-input");
    const dateInp  = document.getElementById("avail-date-input");
    const timeInp  = document.getElementById("avail-time-input");

    const title = (titleInp?.value || "").trim() || "Case Sync Meeting";
    const date  = dateInp?.value || "";
    const time  = timeInp?.value || "14:00";

    if (!date) {
      if (window.showToast) window.showToast("Please pick a date.", "error");
      return;
    }

    const payload = {
      text: `📅 Availability Request: "${title}" on ${date} at ${time}`,
      cardType: "availability_request",
      reqTitle: title,
      reqDate: date,
      reqTime: time,
      reqStatus: "pending",
      uid: myUid,
      name: myName,
      ts: window._fbServerTs()
    };

    try {
      if (activeChannel === "group") {
        await window._fbAddDoc(window._fbCol(window._db, COLLECTION_GROUP), payload);

        if (typeof window.profiles !== "undefined" && typeof window.dbAddNotification === "function") {
          const others = window.profiles.filter(p => p.ownerUid && p.ownerUid !== myUid);
          for (const p of others) {
            await window.dbAddNotification({
              toUid: p.ownerUid,
              fromUid: myUid,
              fromName: myName,
              title: "📅 Availability Request",
              message: `${myName} requested availability for "${title}" on ${date} at ${time}.`,
              type: "availability_request",
              status: "unread"
            });
          }
        }
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
            title: "📅 Direct Availability Request",
            message: `${myName} sent you an availability request for "${title}" on ${date} at ${time}.`,
            type: "availability_request",
            status: "unread"
          });
        }
      }

      toggleAvailPicker();
      if (titleInp) titleInp.value = "";
      if (window.showToast) window.showToast("Availability request card sent & notified! 📅");
    } catch (err) {
      console.error("sendAvailRequest error:", err);
      if (window.showToast) window.showToast("Failed to send request: " + err.message, "error");
    }
  }

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

      if (status === "accepted") {
        let msgData = null;
        if (typeof window._fbGetDoc === "function") {
          const docSnap = await window._fbGetDoc(msgRef);
          if (docSnap && docSnap.exists()) {
            msgData = docSnap.data();
          }
        }

        if (msgData) {
          const apptData = {
            title: "🤝 " + (msgData.reqTitle || "Chat Meeting"),
            date: msgData.reqDate,
            time: msgData.reqTime || "All Day",
            description: `Confirmed in Chat by ${myName}`,
            requesterUid: msgData.uid,
            requesterName: msgData.name,
            targetUid: myUid,
            targetName: myName,
            status: "accepted"
          };
          if (typeof window.dbAddAppointment === "function") {
            await window.dbAddAppointment(apptData);
          }

          if (typeof window.dbAddNotification === "function") {
            await window.dbAddNotification({
              toUid: msgData.uid,
              fromUid: myUid,
              fromName: myName,
              title: "Availability Confirmed ✅",
              message: `${myName} confirmed availability for "${msgData.reqTitle || 'Meeting'}" on ${msgData.reqDate}.`,
              type: "availability_confirmed",
              status: "unread"
            });
          }
        }
        if (window.showToast) window.showToast("Confirmed & added to Firm Calendar! 📅");
      } else {
        if (window.showToast) window.showToast("Marked as Unavailable.");
      }
    } catch (err) {
      console.error("respondAvailCard error:", err);
      if (window.showToast) window.showToast("Failed to respond: " + err.message, "error");
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  RENDER MESSAGES & UNSEEN BADGES
  // ═══════════════════════════════════════════════════════════
  function renderMessages(containerId, msgs, isDm, isGroup, channelId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (msgs.length === 0) {
      el.innerHTML = `<div class="chat-empty">No messages yet. Say hello! 👋</div>`;
      return;
    }

    el.innerHTML = msgs.map((m, i) => {
      const isMine   = m.uid === myUid;
      const ts       = m.ts?.toDate ? formatTime(m.ts.toDate()) : "";
      const showName = !isMine && (i === 0 || msgs[i - 1].uid !== m.uid);

      if (m.cardType === "availability_request") {
        const reqStatus = m.reqStatus || "pending";
        let statusBadge = `<span class="avail-badge pending">⏳ Pending</span>`;
        if (reqStatus === "accepted") statusBadge = `<span class="avail-badge accepted">✅ Confirmed (${escHtml(m.respondedByName || 'Available')})</span>`;
        if (reqStatus === "declined") statusBadge = `<span class="avail-badge declined">🚫 Busy (${escHtml(m.respondedByName || 'Unavailable')})</span>`;

        let actionBtns = "";
        if (!isMine && reqStatus === "pending") {
          actionBtns = `
            <div style="display:flex;gap:6px;margin-top:10px">
              <button class="chat-card-btn confirm" type="button" onclick="window._chat.respondAvailCard('${m.id}', ${isGroup}, '${channelId}', 'accepted')">✅ Confirm Available</button>
              <button class="chat-card-btn decline" type="button" onclick="window._chat.respondAvailCard('${m.id}', ${isGroup}, '${channelId}', 'declined')">🚫 Busy</button>
            </div>
          `;
        }

        return `
          <div class="chat-msg-wrap ${isMine ? "mine" : "theirs"}">
            ${showName ? `<div class="chat-msg-sender">${escHtml(m.name || "Unknown")}</div>` : ""}
            <div class="chat-avail-card ${isMine ? "mine" : "theirs"}">
              <div style="font-size:11px;font-weight:700;color:var(--gold,#c9a84c);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">📅 Availability Request</div>
              <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px">${escHtml(m.reqTitle || "Meeting")}</div>
              <div style="font-size:11.5px;color:var(--text-muted)">📆 ${m.reqDate || ''} · ⏰ ${m.reqTime || ''}</div>
              <div style="margin-top:8px">${statusBadge}</div>
              ${actionBtns}
              <span class="chat-ts">${ts}</span>
            </div>
          </div>
        `;
      } else if (m.cardType === "file_attachment") {
        const linkMarkup = m.driveLink 
          ? `<a href="${m.driveLink}" target="_blank" style="color:var(--gold,#c9a84c);text-decoration:underline;font-weight:700">📄 ${escHtml(m.fileName)}</a>`
          : `📄 ${escHtml(m.fileName)}`;

        return `
          <div class="chat-msg-wrap ${isMine ? "mine" : "theirs"}">
            ${showName ? `<div class="chat-msg-sender">${escHtml(m.name || "Unknown")}</div>` : ""}
            <div class="chat-bubble-msg ${isMine ? "mine" : "theirs"}" style="border:1px solid var(--gold-border, rgba(201,165,92,0.3))">
              <div style="font-size:11px;font-weight:700;color:var(--gold,#c9a84c);margin-bottom:2px">📎 File Attachment</div>
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

  // ═══════════════════════════════════════════════════════════
  //  STYLES INJECTION
  // ═══════════════════════════════════════════════════════════
  function injectStyles() {
    const s = document.createElement("style");
    s.textContent = `
      #chat-dock-bar {
        display: none !important;
      }

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
        width: 360px !important;
        height: 500px !important;
        background: var(--surface, #0c1826) !important;
        border: 1px solid var(--gold-border, rgba(201,165,92,0.3)) !important;
        border-radius: 14px !important;
        display: flex !important;
        flex-direction: column !important;
        z-index: 99998 !important;
        box-shadow: 0 12px 48px rgba(0,0,0,0.7) !important;
        overflow: hidden !important;
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
      .chat-header:hover {
        background: var(--surface3, #10202e);
      }
      .chat-header-left { display: flex; align-items: center; gap: 8px; }
      .chat-header-icon { font-size: 16px; }
      .chat-header-title { font-size: 13px; font-weight: 700; color: var(--text); }
      .chat-header-actions { display: flex; gap: 6px; }
      .chat-icon-btn {
        background: transparent; border: none; color: var(--text-dim);
        font-size: 13px; cursor: pointer; padding: 4px 8px; border-radius: 6px;
        transition: background .15s, color .15s;
      }
      .chat-icon-btn:hover { background: var(--border, #162033); color: var(--text); }

      .chat-view { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
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

      .chat-unseen-dot { color: var(--gold, #c9a84c); font-size: 12px; margin-left: 4px; flex-shrink: 0; }

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
        max-width: 88%; padding: 12px 14px; border-radius: 12px;
        background: var(--surface2, #091422); border: 1px solid var(--gold-border, rgba(201,168,76,0.3));
        box-shadow: 0 4px 14px rgba(0,0,0,0.3); position: relative;
      }
      .avail-badge {
        display: inline-block; font-size: 10px; font-weight: 700;
        padding: 2px 8px; border-radius: 4px;
      }
      .avail-badge.pending  { background: rgba(251,191,36,0.15); color: #fbbf24; }
      .avail-badge.accepted { background: rgba(52,211,153,0.15); color: #34d399; }
      .avail-badge.declined { background: rgba(248,113,113,0.15); color: #f87171; }

      .chat-card-btn {
        flex: 1; padding: 6px 8px; border-radius: 6px; border: none;
        font-size: 11px; font-weight: 700; cursor: pointer; transition: opacity .15s;
      }
      .chat-card-btn.confirm { background: #34d399; color: #040810; }
      .chat-card-btn.decline { background: transparent; border: 1px solid rgba(248,113,113,0.3); color: #f87171; }
      .chat-card-btn:hover { opacity: .85; }

      .chat-avail-picker {
        background: var(--surface2, #091422); border-top: 1px solid var(--gold-border, rgba(201,168,76,0.3));
        padding: 12px; border-radius: 10px 10px 0 0;
      }

      .chat-avail-btn {
        background: transparent; border: 1px solid var(--border, #162033);
        color: var(--gold, #c9a84c); font-size: 15px; border-radius: 10px;
        padding: 6px 10px; cursor: pointer; transition: background .15s;
      }
      .chat-avail-btn:hover { background: rgba(201,168,76,0.1); }

      .chat-input-row { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--border, #162033); flex-shrink: 0; }
      .chat-input {
        flex: 1; background: var(--bg, #060c13); border: 1px solid var(--border, #162033);
        border-radius: 10px; padding: 8px 12px; font-size: 13px; color: var(--text); outline: none;
      }
      .chat-input:focus { border-color: var(--gold, #c9a84c); }

      .chat-send-btn {
        background: var(--gold, #c9a84c); color: #111; border: none;
        border-radius: 10px; padding: 8px 14px; font-size: 12px; font-weight: 700;
        cursor: pointer; flex-shrink: 0;
      }
      .chat-send-btn:hover { opacity: .85; }

      .dm-conv-header { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid var(--border, #162033); }
      .dm-back-btn { background: transparent; border: none; color: var(--gold, #c9a84c); font-size: 12px; cursor: pointer; padding: 4px 8px; font-weight: 600; }
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
    sendAvailRequest, 
    respondAvailCard,
    handleFileAttachment
  };

})();