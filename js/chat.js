// ═══════════════════════════════════════════════════════════════
//  LEX FIRMA — INTERNAL CHAT WITH INTERACTIVE AVAILABILITY CARDS
//  Group chat + Direct Messages + Availability Requests
// ═══════════════════════════════════════════════════════════════

(function () {
  // ── State ────────────────────────────────────────────────────
  let chatOpen       = false;
  let activeTab      = "group";   // "group" | "dm"
  let activeDmPeer   = null;      // { uid, name } of selected DM peer
  let groupUnsub     = null;      // Firestore listener unsubscribe fn
  let dmUnsub        = null;
  let unreadGroup    = 0;
  let unreadDm       = 0;
  let myUid          = null;      
  let myName         = null;

  const COLLECTION_GROUP = "chat_group";
  const COLLECTION_DM    = "chat_dm";
  const MSG_LIMIT        = 80;

  function dmChannelId(uidA, uidB) {
    return [uidA, uidB].sort().join("__");
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
  //  UI BUILD
  // ═══════════════════════════════════════════════════════════
  function buildUI() {
    const bubble = document.createElement("div");
    bubble.id = "chat-bubble";
    bubble.innerHTML = `
      💬
      <span id="chat-badge" class="chat-badge hidden">0</span>
    `;
    bubble.addEventListener("click", toggleChat);
    document.body.appendChild(bubble);

    const panel = document.createElement("div");
    panel.id = "chat-panel";
    panel.className = "chat-panel hidden";
    panel.innerHTML = `
      <div class="chat-header">
        <div class="chat-header-left">
          <span class="chat-header-icon">⚖️</span>
          <span class="chat-header-title">Internal Chat</span>
        </div>
        <div class="chat-header-actions">
          <button class="chat-icon-btn" id="chat-close-btn" title="Close">✕</button>
        </div>
      </div>

      <div class="chat-tabs">
        <button class="chat-tab active" id="tab-group" onclick="window._chat.switchTab('group')">
          Group
          <span id="tab-group-badge" class="tab-badge hidden"></span>
        </button>
        <button class="chat-tab" id="tab-dm" onclick="window._chat.switchTab('dm')">
          Direct
          <span id="tab-dm-badge" class="tab-badge hidden"></span>
        </button>
      </div>

      <!-- Group pane -->
      <div id="chat-pane-group" class="chat-pane">
        <div id="chat-messages-group" class="chat-messages"></div>
        
        <!-- Inline Availability Picker (Hidden by default) -->
        <div id="chat-avail-picker-group" class="chat-avail-picker hidden">
          <div style="font-size:12px;font-weight:700;color:var(--gold,#c9a84c);margin-bottom:8px">📅 Ask Availability</div>
          <input id="avail-title-group" class="chat-input" style="margin-bottom:6px" placeholder="Purpose (e.g. Case Strategy Sync)" autocomplete="off"/>
          <div style="display:flex;gap:6px;margin-bottom:8px">
            <input id="avail-date-group" type="date" class="chat-input"/>
            <input id="avail-time-group" type="time" class="chat-input" value="14:00"/>
          </div>
          <div style="display:flex;gap:6px;justify-content:flex-end">
            <button class="chat-icon-btn" onclick="window._chat.toggleAvailPicker('group')">Cancel</button>
            <button class="chat-send-btn" onclick="window._chat.sendAvailRequest('group')">Send Card</button>
          </div>
        </div>

        <div class="chat-input-row">
          <button class="chat-avail-btn" title="Ask Availability" onclick="window._chat.toggleAvailPicker('group')">📅</button>
          <input id="chat-input-group" class="chat-input" type="text" placeholder="Message the team…" maxlength="1000"/>
          <button class="chat-send-btn" id="chat-send-group">Send</button>
        </div>
      </div>

      <!-- DM pane -->
      <div id="chat-pane-dm" class="chat-pane hidden">
        <div id="dm-peer-list" class="dm-peer-list"></div>
        <div id="dm-conversation" class="dm-conversation hidden">
          <div class="dm-conv-header">
            <button class="dm-back-btn" onclick="window._chat.backToPeerList()">← Back</button>
            <span id="dm-conv-title"></span>
          </div>
          <div id="chat-messages-dm" class="chat-messages"></div>

          <!-- Inline Availability Picker for DM -->
          <div id="chat-avail-picker-dm" class="chat-avail-picker hidden">
            <div style="font-size:12px;font-weight:700;color:var(--gold,#c9a84c);margin-bottom:8px">📅 Ask Availability</div>
            <input id="avail-title-dm" class="chat-input" style="margin-bottom:6px" placeholder="Purpose (e.g. Case Strategy Sync)" autocomplete="off"/>
            <div style="display:flex;gap:6px;margin-bottom:8px">
              <input id="avail-date-dm" type="date" class="chat-input"/>
              <input id="avail-time-dm" type="time" class="chat-input" value="14:00"/>
            </div>
            <div style="display:flex;gap:6px;justify-content:flex-end">
              <button class="chat-icon-btn" onclick="window._chat.toggleAvailPicker('dm')">Cancel</button>
              <button class="chat-send-btn" onclick="window._chat.sendAvailRequest('dm')">Send Card</button>
            </div>
          </div>

          <div class="chat-input-row">
            <button class="chat-avail-btn" title="Ask Availability" onclick="window._chat.toggleAvailPicker('dm')">📅</button>
            <input id="chat-input-dm" class="chat-input" type="text" placeholder="Direct message…" maxlength="1000"/>
            <button class="chat-send-btn" id="chat-send-dm">Send</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    document.getElementById("chat-close-btn").addEventListener("click", toggleChat);
    document.getElementById("chat-send-group").addEventListener("click", sendGroup);
    document.getElementById("chat-send-dm").addEventListener("click", sendDm);

    document.getElementById("chat-input-group").addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendGroup(); }
    });
    document.getElementById("chat-input-dm").addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendDm(); }
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  TOGGLE / OPEN / CLOSE
  // ═══════════════════════════════════════════════════════════
  function toggleChat() {
    chatOpen ? closeChat() : openChat();
  }

  function openChat() {
    if (!myUid || !myName) {
      if (window.showToast) window.showToast("Please wait for account authorization to load.", "error");
      return;
    }
    chatOpen = true;
    document.getElementById("chat-panel").classList.remove("hidden");
    document.getElementById("chat-panel").classList.add("open");

    if (activeTab === "group") {
      subscribeGroup();
      unreadGroup = 0;
      updateBadge();
    } else {
      if (activeDmPeer) {
        subscribeDm(activeDmPeer.uid);
        unreadDm = 0;
        updateBadge();
      }
      loadPeerList();
    }
  }

  function closeChat() {
    chatOpen = false;
    document.getElementById("chat-panel").classList.add("hidden");
    document.getElementById("chat-panel").classList.remove("open");
  }

  function switchTab(tab) {
    activeTab = tab;
    document.getElementById("tab-group").classList.toggle("active", tab === "group");
    document.getElementById("tab-dm").classList.toggle("active", tab === "dm");
    document.getElementById("chat-pane-group").classList.toggle("hidden", tab !== "group");
    document.getElementById("chat-pane-dm").classList.toggle("hidden", tab !== "dm");

    if (tab === "group") {
      subscribeGroup();
      unreadGroup = 0;
      updateBadge();
    } else {
      loadPeerList();
      if (activeDmPeer) subscribeDm(activeDmPeer.uid);
    }
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
  //  AVAILABILITY PICKER TOGGLE & SEND
  // ═══════════════════════════════════════════════════════════
  function toggleAvailPicker(target) {
    const el = document.getElementById(`chat-avail-picker-${target}`);
    if (!el) return;
    el.classList.toggle("hidden");
    
    // Set default tomorrow date
    if (!el.classList.contains("hidden")) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateInp = document.getElementById(`avail-date-${target}`);
      if (dateInp) dateInp.value = tomorrow.toISOString().split("T")[0];
    }
  }

  async function sendAvailRequest(target) {
    const titleInp = document.getElementById(`avail-title-${target}`);
    const dateInp  = document.getElementById(`avail-date-${target}`);
    const timeInp  = document.getElementById(`avail-time-${target}`);

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
      if (target === "group") {
        await window._fbAddDoc(window._fbCol(window._db, COLLECTION_GROUP), payload);
      } else if (target === "dm" && activeDmPeer) {
        payload.peerUid  = activeDmPeer.uid;
        payload.peerName = activeDmPeer.name;
        const channelId = dmChannelId(myUid, activeDmPeer.uid);
        await window._fbAddDoc(window._fbCol(window._db, COLLECTION_DM + "_" + channelId), payload);
      }

      toggleAvailPicker(target);
      if (titleInp) titleInp.value = "";
      if (window.showToast) window.showToast("Availability request card sent!");
    } catch (err) {
      console.error("sendAvailRequest error:", err);
      if (window.showToast) window.showToast("Failed to send request: " + err.message, "error");
    }
  }

  // Respond to availability request card inside chat stream
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

      // If accepted, automatically sync to calendar appointments
      if (status === "accepted") {
        const snap = await window._fbGetDocs(window._fbQuery(window._fbCol(db, colName), window._fbWhere("__name__", "==", msgId)));
        if (!snap.empty) {
          const m = snap.docs[0].data();
          const apptData = {
            title: "🤝 " + (m.reqTitle || "Chat Meeting"),
            date: m.reqDate,
            time: m.reqTime || "All Day",
            description: `Confirmed in Chat by ${myName}`,
            requesterUid: m.uid,
            requesterName: m.name,
            targetUid: myUid,
            targetName: myName,
            status: "accepted"
          };
          if (typeof window.dbAddAppointment === "function") {
            await window.dbAddAppointment(apptData);
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
  //  GROUP & DM LISTENERS
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
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderMessages("chat-messages-group", msgs, false, true, "");

      if (!chatOpen || activeTab !== "group") {
        const newFromOthers = snap.docChanges()
          .filter(c => c.type === "added" && c.doc.data().uid !== myUid).length;
        if (newFromOthers > 0) {
          unreadGroup += newFromOthers;
          updateBadge();
        }
      } else {
        unreadGroup = 0;
        updateBadge();
      }
    });
  }

  async function sendGroup() {
    const input = document.getElementById("chat-input-group");
    const text  = input.value.trim();
    if (!text || !window._db || !myUid || !myName) return;
    input.value = "";
    try {
      await window._fbAddDoc(window._fbCol(window._db, COLLECTION_GROUP), {
        text,
        uid:  myUid,
        name: myName,
        ts:   window._fbServerTs()
      });
      announcePeer();
    } catch (e) {
      console.error("Group send error:", e);
    }
  }

  async function loadPeerList() {
    if (!window._db || !myUid) return;
    announcePeer();

    try {
      const db   = window._db;
      const snap = await window._fbGetDocs(window._fbCol(db, "chat_peers"));
      const peers = snap.docs
        .map(d => d.data())
        .filter(p => p.uid && p.uid !== myUid && p.name);

      const el = document.getElementById("dm-peer-list");
      if (!el) return;

      if (peers.length === 0) {
        el.innerHTML = `<div class="dm-empty">No other attorneys online yet.<br><span style="font-size:11px;opacity:.6">They appear here once they log in.</span></div>`;
        return;
      }

      el.innerHTML = peers.map(p => `
        <div class="dm-peer-item" onclick="window._chat.openDm('${p.uid}', '${escHtml(p.name)}')">
          <div class="dm-peer-avatar">${initials(p.name)}</div>
          <div class="dm-peer-name">${escHtml(p.name)}</div>
          <div class="dm-peer-arrow">→</div>
        </div>
      `).join("");
    } catch (e) {
      console.error("loadPeerList error:", e);
    }
  }

  function openDm(peerUid, peerName) {
    activeDmPeer = { uid: peerUid, name: peerName };
    document.getElementById("dm-peer-list").classList.add("hidden");
    document.getElementById("dm-conversation").classList.remove("hidden");
    document.getElementById("dm-conv-title").textContent = peerName;
    document.getElementById("chat-input-dm").placeholder = `Message ${peerName}…`;
    subscribeDm(peerUid);
    document.getElementById("chat-input-dm").focus();
  }

  function backToPeerList() {
    if (dmUnsub) { dmUnsub(); dmUnsub = null; }
    activeDmPeer = null;
    document.getElementById("dm-peer-list").classList.remove("hidden");
    document.getElementById("dm-conversation").classList.add("hidden");
    document.getElementById("chat-messages-dm").innerHTML = "";
    loadPeerList();
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
      renderMessages("chat-messages-dm", msgs, true, false, channelId);

      if (!chatOpen || activeTab !== "dm" || !activeDmPeer) {
        const newFromOthers = snap.docChanges()
          .filter(c => c.type === "added" && c.doc.data().uid !== myUid).length;
        if (newFromOthers > 0) {
          unreadDm += newFromOthers;
          updateBadge();
        }
      } else {
        unreadDm = 0;
        updateBadge();
      }
    });
  }

  async function sendDm() {
    if (!activeDmPeer) return;
    const input = document.getElementById("chat-input-dm");
    const text  = input.value.trim();
    if (!text || !window._db || !myUid || !myName) return;
    input.value = "";

    const channelId = dmChannelId(myUid, activeDmPeer.uid);
    try {
      await window._fbAddDoc(window._fbCol(window._db, COLLECTION_DM + "_" + channelId), {
        text,
        uid:      myUid,
        name:     myName,
        peerUid:  activeDmPeer.uid,
        peerName: activeDmPeer.name,
        ts:       window._fbServerTs()
      });
    } catch (e) {
      console.error("DM send error:", e);
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  RENDER MESSAGES & AVAILABILITY CARDS
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

      // Render Interactive Availability Card
      if (m.cardType === "availability_request") {
        const reqStatus = m.reqStatus || "pending";
        let statusBadge = `<span class="avail-badge pending">⏳ Pending</span>`;
        if (reqStatus === "accepted") statusBadge = `<span class="avail-badge accepted">✅ Confirmed (${escHtml(m.respondedByName || 'Available')})</span>`;
        if (reqStatus === "declined") statusBadge = `<span class="avail-badge declined">🚫 Busy (${escHtml(m.respondedByName || 'Unavailable')})</span>`;

        let actionBtns = "";
        if (!isMine && reqStatus === "pending") {
          actionBtns = `
            <div style="display:flex;gap:6px;margin-top:10px">
              <button class="chat-card-btn confirm" onclick="window._chat.respondAvailCard('${m.id}', ${isGroup}, '${channelId}', 'accepted')">✅ Confirm Available</button>
              <button class="chat-card-btn decline" onclick="window._chat.respondAvailCard('${m.id}', ${isGroup}, '${channelId}', 'declined')">🚫 Busy</button>
            </div>
          `;
        }

        return `
          <div class="chat-msg-wrap ${isMine ? "mine" : "theirs"}">
            ${showName ? `<div class="chat-msg-sender">${escHtml(m.name || "Unknown")}</div>` : ""}
            <div class="chat-avail-card ${isMine ? "mine" : "theirs"}">
              <div style="font-size:11px;font-weight:700;color:var(--gold,#c9a84c);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">📅 Availability Request</div>
              <div style="font-size:13px;font-weight:700;color:var(--text,#eee);margin-bottom:4px">${escHtml(m.reqTitle || "Meeting")}</div>
              <div style="font-size:11.5px;color:var(--text-muted,#aaa)">📆 ${m.reqDate || ''} · ⏰ ${m.reqTime || ''}</div>
              <div style="margin-top:8px">${statusBadge}</div>
              ${actionBtns}
              <span class="chat-ts">${ts}</span>
            </div>
          </div>
        `;
      }

      // Standard Text Bubble
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

  function updateBadge() {
    const total  = unreadGroup + unreadDm;
    const badge  = document.getElementById("chat-badge");
    const gBadge = document.getElementById("tab-group-badge");
    const dBadge = document.getElementById("tab-dm-badge");

    if (badge) {
      badge.textContent = total > 9 ? "9+" : total;
      badge.classList.toggle("hidden", total === 0);
    }
    if (gBadge) {
      gBadge.textContent = unreadGroup;
      gBadge.classList.toggle("hidden", unreadGroup === 0);
    }
    if (dBadge) {
      dBadge.textContent = unreadDm;
      dBadge.classList.toggle("hidden", unreadDm === 0);
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
      .replace(/"/g, "&quot;");
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
    return date.toLocaleDateString([], { month: "short", day: "numeric" }) + " " +
           date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // ═══════════════════════════════════════════════════════════
  //  STYLES INJECTION
  // ═══════════════════════════════════════════════════════════
  function injectStyles() {
    const s = document.createElement("style");
    s.textContent = `
      #chat-bubble {
        position: fixed; bottom: 24px; right: 24px;
        width: 52px; height: 52px; border-radius: 50%;
        background: var(--gold, #c9a84c); color: #1a1a1a;
        font-size: 22px; display: flex; align-items: center; justify-content: center;
        cursor: pointer; z-index: 9000; box-shadow: 0 4px 20px rgba(0,0,0,0.45);
        transition: transform .15s, box-shadow .15s; user-select: none;
      }
      #chat-bubble:hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(0,0,0,0.55); }

      .chat-badge {
        position: absolute; top: -4px; right: -4px; background: #e53e3e; color: #fff;
        font-size: 10px; font-weight: 700; min-width: 18px; height: 18px;
        border-radius: 9px; display: flex; align-items: center; justify-content: center;
        padding: 0 4px; border: 2px solid var(--bg, #111);
      }
      .chat-badge.hidden { display: none; }

      .chat-panel {
        position: fixed; bottom: 88px; right: 24px;
        width: 350px; height: 500px; background: var(--surface, #1c1c1c);
        border: 1px solid var(--border, #2a2a2a); border-radius: 16px;
        display: flex; flex-direction: column; z-index: 8999;
        box-shadow: 0 8px 40px rgba(0,0,0,0.6); overflow: hidden; animation: chatSlideIn .2s ease;
      }
      .chat-panel.hidden { display: none; }
      @keyframes chatSlideIn {
        from { opacity: 0; transform: translateY(16px) scale(.97); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }

      .chat-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 12px 14px; background: var(--surface-raised, #222);
        border-bottom: 1px solid var(--border, #2a2a2a); flex-shrink: 0;
      }
      .chat-header-left { display: flex; align-items: center; gap: 8px; }
      .chat-header-icon { font-size: 16px; }
      .chat-header-title { font-size: 13px; font-weight: 700; color: var(--text, #eee); letter-spacing: .3px; }
      .chat-header-actions { display: flex; gap: 6px; }
      .chat-icon-btn {
        background: transparent; border: none; color: var(--text-dim, #888);
        font-size: 13px; cursor: pointer; padding: 4px 8px; border-radius: 6px;
        transition: background .15s, color .15s;
      }
      .chat-icon-btn:hover { background: var(--border, #2a2a2a); color: var(--text, #eee); }

      .chat-tabs { display: flex; border-bottom: 1px solid var(--border, #2a2a2a); flex-shrink: 0; }
      .chat-tab {
        flex: 1; padding: 9px 0; background: transparent; border: none;
        font-size: 12px; font-weight: 600; color: var(--text-dim, #888);
        cursor: pointer; position: relative; letter-spacing: .4px; transition: color .15s;
      }
      .chat-tab.active { color: var(--gold, #c9a84c); border-bottom: 2px solid var(--gold, #c9a84c); }
      
      .tab-badge {
        display: inline-flex; align-items: center; justify-content: center;
        background: #e53e3e; color: #fff; font-size: 9px; font-weight: 700;
        min-width: 15px; height: 15px; border-radius: 8px; padding: 0 3px; margin-left: 4px;
      }
      .tab-badge.hidden { display: none; }

      .chat-pane { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
      .chat-pane.hidden { display: none; }

      .chat-messages {
        flex: 1; overflow-y: auto; padding: 12px 12px 6px;
        display: flex; flex-direction: column; gap: 4px; scroll-behavior: smooth;
      }
      .chat-empty { text-align: center; color: var(--text-dim, #888); font-size: 12px; margin: auto; padding: 20px; }

      .chat-msg-wrap { display: flex; flex-direction: column; margin-bottom: 4px; }
      .chat-msg-wrap.mine  { align-items: flex-end; }
      .chat-msg-wrap.theirs { align-items: flex-start; }
      .chat-msg-sender { font-size: 10px; color: var(--text-dim, #888); margin-bottom: 2px; padding: 0 4px; font-weight: 600; }

      .chat-bubble-msg {
        max-width: 82%; padding: 8px 12px; border-radius: 14px;
        font-size: 13px; line-height: 1.45; word-break: break-word; position: relative;
      }
      .chat-bubble-msg.mine { background: var(--gold, #c9a84c); color: #111; border-bottom-right-radius: 4px; }
      .chat-bubble-msg.theirs { background: var(--surface-raised, #2a2a2a); color: var(--text, #eee); border-bottom-left-radius: 4px; border: 1px solid var(--border, #333); }

      /* ── AVAILABILITY CARD STYLES ── */
      .chat-avail-card {
        max-width: 88%; padding: 12px 14px; border-radius: 12px;
        background: var(--surface2, #181818); border: 1px solid var(--gold-border, rgba(201,168,76,0.3));
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
        background: var(--surface2, #222); border-top: 1px solid var(--gold-border, rgba(201,168,76,0.3));
        padding: 12px; border-radius: 10px 10px 0 0;
      }

      .chat-avail-btn {
        background: transparent; border: 1px solid var(--border, #2a2a2a);
        color: var(--gold, #c9a84c); font-size: 15px; border-radius: 10px;
        padding: 6px 10px; cursor: pointer; transition: background .15s;
      }
      .chat-avail-btn:hover { background: rgba(201,168,76,0.1); }

      .chat-input-row { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--border, #2a2a2a); flex-shrink: 0; }
      .chat-input {
        flex: 1; background: var(--input-bg, #111); border: 1px solid var(--border, #2a2a2a);
        border-radius: 10px; padding: 8px 12px; font-size: 13px; color: var(--text, #eee); outline: none;
      }
      .chat-input:focus { border-color: var(--gold, #c9a84c); }

      .chat-send-btn {
        background: var(--gold, #c9a84c); color: #111; border: none;
        border-radius: 10px; padding: 8px 14px; font-size: 12px; font-weight: 700;
        cursor: pointer; flex-shrink: 0;
      }
      .chat-send-btn:hover { opacity: .85; }

      .dm-peer-list { flex: 1; overflow-y: auto; padding: 10px; }
      .dm-peer-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; cursor: pointer; }
      .dm-peer-item:hover { background: var(--surface-raised, #2a2a2a); }
      .dm-peer-avatar {
        width: 36px; height: 36px; border-radius: 50%; background: var(--gold, #c9a84c);
        color: #111; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center;
      }
      .dm-peer-name { flex: 1; font-size: 13px; font-weight: 600; color: var(--text, #eee); }
      .dm-peer-arrow { color: var(--text-dim, #888); font-size: 14px; }
      .dm-empty { text-align: center; color: var(--text-dim, #888); font-size: 12px; padding: 30px 16px; line-height: 1.6; }

      .dm-conversation { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
      .dm-conv-header { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid var(--border, #2a2a2a); }
      .dm-back-btn { background: transparent; border: none; color: var(--gold, #c9a84c); font-size: 12px; cursor: pointer; padding: 4px 8px; font-weight: 600; }
      #dm-conv-title { font-size: 13px; font-weight: 700; color: var(--text, #eee); }
      .chat-ts { font-size: 9px; opacity: .55; margin-left: 8px; vertical-align: bottom; }
    `;
    document.head.appendChild(s);
  }

  // ── Expose Public API ─────────────────────────────────────────
  window._chat = { 
    switchTab, 
    openDm, 
    backToPeerList, 
    toggleAvailPicker, 
    sendAvailRequest, 
    respondAvailCard 
  };

})();
