// ═══════════════════════════════════════════════════════════════
//  LEX FIRMA — INTERNAL CHAT
//  Group chat + Direct Messages, backed by Firestore
//  Sender identity stored in localStorage (set once on first open)
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
  let myUid          = null;      // stable random id stored in localStorage
  let myName         = null;

  const COLLECTION_GROUP = "chat_group";
  const COLLECTION_DM    = "chat_dm";
  const MSG_LIMIT        = 80;

  // ── Identity ─────────────────────────────────────────────────
  function loadIdentity() {
    myUid  = localStorage.getItem("chatUid");
    myName = localStorage.getItem("chatName");
    if (!myUid) {
      myUid = "uid_" + Date.now() + "_" + Math.random().toString(36).slice(2);
      localStorage.setItem("chatUid", myUid);
    }
  }

  function dmChannelId(uidA, uidB) {
    return [uidA, uidB].sort().join("__");
  }

  // ── Bootstrap ────────────────────────────────────────────────
  function init() {
    loadIdentity();
    injectStyles();
    buildUI();
    if (!myName) {
      // Show name prompt right away (non-blocking)
      setTimeout(openNamePrompt, 600);
    }
  }

  // ── Wait for Firebase then run ───────────────────────────────
  if (window._fbReady) {
    init();
  } else {
    document.addEventListener("firebase-ready", init);
  }

  // ═══════════════════════════════════════════════════════════
  //  UI BUILD
  // ═══════════════════════════════════════════════════════════
  function buildUI() {
    // Bubble
    const bubble = document.createElement("div");
    bubble.id = "chat-bubble";
    bubble.innerHTML = `
      💬
      <span id="chat-badge" class="chat-badge hidden">0</span>
    `;
    bubble.addEventListener("click", toggleChat);
    document.body.appendChild(bubble);

    // Panel
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
          <button class="chat-icon-btn" id="chat-name-btn" title="Change display name">✏️</button>
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
        <div class="chat-input-row">
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
          <div class="chat-input-row">
            <input id="chat-input-dm" class="chat-input" type="text" placeholder="Direct message…" maxlength="1000"/>
            <button class="chat-send-btn" id="chat-send-dm">Send</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    // Wire buttons
    document.getElementById("chat-close-btn").addEventListener("click", toggleChat);
    document.getElementById("chat-name-btn").addEventListener("click", openNamePrompt);
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

  // ═══════════════════════════════════════════════════════════
  //  TABS
  // ═══════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════
  //  NAME PROMPT
  // ═══════════════════════════════════════════════════════════
  function openNamePrompt() {
    const existing = document.getElementById("chat-name-modal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "chat-name-modal";
    modal.className = "chat-name-modal";
    modal.innerHTML = `
      <div class="chat-name-box">
        <div class="chat-name-title">Your display name</div>
        <div class="chat-name-sub">This is how you appear in chat to other attorneys.</div>
        <input id="chat-name-input" class="chat-name-input" type="text" placeholder="e.g. Atty. Santos" maxlength="40"
               value="${myName || ""}" />
        <div style="display:flex;gap:8px;margin-top:12px">
          ${myName ? `<button class="chat-name-cancel" onclick="document.getElementById('chat-name-modal').remove()">Cancel</button>` : ""}
          <button class="chat-name-save" id="chat-name-save-btn">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const input = document.getElementById("chat-name-input");
    input.focus();
    input.select();

    document.getElementById("chat-name-save-btn").addEventListener("click", saveName);
    input.addEventListener("keydown", e => { if (e.key === "Enter") saveName(); });
  }

  function saveName() {
    const val = document.getElementById("chat-name-input")?.value?.trim();
    if (!val) return;
    myName = val;
    localStorage.setItem("chatName", myName);
    document.getElementById("chat-name-modal")?.remove();
    // Announce presence in peer list
    announcePeer();
  }

  // ── Announce this user in the peers collection so DM list works ──
  async function announcePeer() {
    if (!window._db || !myUid || !myName) return;
    try {
      const db = window._db;
      const peerRef = window._fbDoc(db, "chat_peers", myUid);
      await window._fbUpdate(peerRef, { uid: myUid, name: myName, lastSeen: window._fbServerTs() })
        .catch(async () => {
          // Doc doesn't exist yet — create it
          await window._fbAddDoc
            ? null
            : null;
          const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
          await setDoc(peerRef, { uid: myUid, name: myName, lastSeen: window._fbServerTs() });
        });
    } catch (e) {
      // Use addDoc fallback: store in a simpler peers collection
      try {
        // Check if peer doc already exists via getDocs
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
  //  GROUP CHAT
  // ═══════════════════════════════════════════════════════════
  function subscribeGroup() {
    if (groupUnsub) return; // already subscribed
    if (!window._db) return;

    const db = window._db;
    const q  = window._fbQuery(
      window._fbCol(db, COLLECTION_GROUP),
      window._fbOrderBy("ts", "asc"),
      window._fbLimit(MSG_LIMIT)
    );

    groupUnsub = window._fbOnSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderMessages("chat-messages-group", msgs, false);

      if (!chatOpen || activeTab !== "group") {
        const added = snap.docChanges().filter(c => c.type === "added").length;
        // Only count new messages not from self
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
    if (!myName) { openNamePrompt(); return; }
    const input = document.getElementById("chat-input-group");
    const text  = input.value.trim();
    if (!text || !window._db) return;
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

  // ═══════════════════════════════════════════════════════════
  //  DIRECT MESSAGES
  // ═══════════════════════════════════════════════════════════
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
        el.innerHTML = `<div class="dm-empty">No other attorneys online yet.<br><span style="font-size:11px;opacity:.6">They appear here once they open chat.</span></div>`;
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
      renderMessages("chat-messages-dm", msgs, false);

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
    if (!myName) { openNamePrompt(); return; }
    if (!activeDmPeer) return;
    const input = document.getElementById("chat-input-dm");
    const text  = input.value.trim();
    if (!text || !window._db) return;
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
  //  RENDER MESSAGES
  // ═══════════════════════════════════════════════════════════
  function renderMessages(containerId, msgs, isDm) {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (msgs.length === 0) {
      el.innerHTML = `<div class="chat-empty">No messages yet. Say hello! 👋</div>`;
      return;
    }

    el.innerHTML = msgs.map((m, i) => {
      const isMine  = m.uid === myUid;
      const ts      = m.ts?.toDate ? formatTime(m.ts.toDate()) : "";
      const showName = !isMine && (i === 0 || msgs[i - 1].uid !== m.uid);
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

    // Scroll to bottom
    el.scrollTop = el.scrollHeight;
  }

  // ═══════════════════════════════════════════════════════════
  //  BADGE
  // ═══════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════════
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
  //  STYLES
  // ═══════════════════════════════════════════════════════════
  function injectStyles() {
    const s = document.createElement("style");
    s.textContent = `
      /* ── Bubble ────────────────────────────────────────── */
      #chat-bubble {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: var(--gold, #c9a84c);
        color: #1a1a1a;
        font-size: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 9000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.45);
        transition: transform .15s, box-shadow .15s;
        user-select: none;
      }
      #chat-bubble:hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(0,0,0,0.55); }

      .chat-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        background: #e53e3e;
        color: #fff;
        font-size: 10px;
        font-weight: 700;
        min-width: 18px;
        height: 18px;
        border-radius: 9px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 4px;
        border: 2px solid var(--bg, #111);
      }
      .chat-badge.hidden { display: none; }

      /* ── Panel ─────────────────────────────────────────── */
      .chat-panel {
        position: fixed;
        bottom: 88px;
        right: 24px;
        width: 340px;
        height: 480px;
        background: var(--surface, #1c1c1c);
        border: 1px solid var(--border, #2a2a2a);
        border-radius: 16px;
        display: flex;
        flex-direction: column;
        z-index: 8999;
        box-shadow: 0 8px 40px rgba(0,0,0,0.6);
        overflow: hidden;
        animation: chatSlideIn .2s ease;
      }
      .chat-panel.hidden { display: none; }
      @keyframes chatSlideIn {
        from { opacity: 0; transform: translateY(16px) scale(.97); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }

      /* ── Header ────────────────────────────────────────── */
      .chat-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px;
        background: var(--surface-raised, #222);
        border-bottom: 1px solid var(--border, #2a2a2a);
        flex-shrink: 0;
      }
      .chat-header-left { display: flex; align-items: center; gap: 8px; }
      .chat-header-icon { font-size: 16px; }
      .chat-header-title { font-size: 13px; font-weight: 700; color: var(--text, #eee); letter-spacing: .3px; }
      .chat-header-actions { display: flex; gap: 6px; }
      .chat-icon-btn {
        background: transparent;
        border: none;
        color: var(--text-dim, #888);
        font-size: 14px;
        cursor: pointer;
        padding: 4px 6px;
        border-radius: 6px;
        transition: background .15s, color .15s;
      }
      .chat-icon-btn:hover { background: var(--border, #2a2a2a); color: var(--text, #eee); }

      /* ── Tabs ──────────────────────────────────────────── */
      .chat-tabs {
        display: flex;
        border-bottom: 1px solid var(--border, #2a2a2a);
        flex-shrink: 0;
      }
      .chat-tab {
        flex: 1;
        padding: 9px 0;
        background: transparent;
        border: none;
        font-size: 12px;
        font-weight: 600;
        color: var(--text-dim, #888);
        cursor: pointer;
        position: relative;
        letter-spacing: .4px;
        transition: color .15s;
      }
      .chat-tab.active {
        color: var(--gold, #c9a84c);
        border-bottom: 2px solid var(--gold, #c9a84c);
      }
      .tab-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #e53e3e;
        color: #fff;
        font-size: 9px;
        font-weight: 700;
        min-width: 15px;
        height: 15px;
        border-radius: 8px;
        padding: 0 3px;
        margin-left: 4px;
        vertical-align: middle;
      }
      .tab-badge.hidden { display: none; }

      /* ── Pane / Messages ───────────────────────────────── */
      .chat-pane {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow: hidden;
      }
      .chat-pane.hidden { display: none; }

      .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 12px 12px 6px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        scroll-behavior: smooth;
      }
      .chat-messages::-webkit-scrollbar { width: 4px; }
      .chat-messages::-webkit-scrollbar-thumb { background: var(--border, #2a2a2a); border-radius: 4px; }

      .chat-empty {
        text-align: center;
        color: var(--text-dim, #888);
        font-size: 12px;
        margin: auto;
        padding: 20px;
      }

      /* ── Message bubbles ───────────────────────────────── */
      .chat-msg-wrap { display: flex; flex-direction: column; margin-bottom: 4px; }
      .chat-msg-wrap.mine  { align-items: flex-end; }
      .chat-msg-wrap.theirs { align-items: flex-start; }

      .chat-msg-sender {
        font-size: 10px;
        color: var(--text-dim, #888);
        margin-bottom: 2px;
        padding: 0 4px;
        font-weight: 600;
      }

      .chat-bubble-msg {
        max-width: 82%;
        padding: 8px 12px;
        border-radius: 14px;
        font-size: 13px;
        line-height: 1.45;
        word-break: break-word;
        position: relative;
      }
      .chat-bubble-msg.mine {
        background: var(--gold, #c9a84c);
        color: #111;
        border-bottom-right-radius: 4px;
      }
      .chat-bubble-msg.theirs {
        background: var(--surface-raised, #2a2a2a);
        color: var(--text, #eee);
        border-bottom-left-radius: 4px;
        border: 1px solid var(--border, #333);
      }
      .chat-ts {
        font-size: 9px;
        opacity: .55;
        margin-left: 8px;
        white-space: nowrap;
        vertical-align: bottom;
      }

      /* ── Input row ─────────────────────────────────────── */
      .chat-input-row {
        display: flex;
        gap: 8px;
        padding: 10px 12px;
        border-top: 1px solid var(--border, #2a2a2a);
        flex-shrink: 0;
      }
      .chat-input {
        flex: 1;
        background: var(--input-bg, #111);
        border: 1px solid var(--border, #2a2a2a);
        border-radius: 10px;
        padding: 8px 12px;
        font-size: 13px;
        color: var(--text, #eee);
        outline: none;
        transition: border-color .15s;
      }
      .chat-input:focus { border-color: var(--gold, #c9a84c); }
      .chat-send-btn {
        background: var(--gold, #c9a84c);
        color: #111;
        border: none;
        border-radius: 10px;
        padding: 8px 14px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        transition: opacity .15s;
        flex-shrink: 0;
      }
      .chat-send-btn:hover { opacity: .85; }

      /* ── DM peer list ──────────────────────────────────── */
      .dm-peer-list {
        flex: 1;
        overflow-y: auto;
        padding: 10px;
      }
      .dm-peer-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 10px;
        cursor: pointer;
        transition: background .15s;
      }
      .dm-peer-item:hover { background: var(--surface-raised, #2a2a2a); }
      .dm-peer-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: var(--gold, #c9a84c);
        color: #111;
        font-size: 12px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .dm-peer-name { flex: 1; font-size: 13px; font-weight: 600; color: var(--text, #eee); }
      .dm-peer-arrow { color: var(--text-dim, #888); font-size: 14px; }
      .dm-empty {
        text-align: center;
        color: var(--text-dim, #888);
        font-size: 12px;
        padding: 30px 16px;
        line-height: 1.6;
      }

      /* ── DM conversation ───────────────────────────────── */
      .dm-conversation {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow: hidden;
      }
      .dm-conversation.hidden { display: none; }
      .dm-conv-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        border-bottom: 1px solid var(--border, #2a2a2a);
        flex-shrink: 0;
      }
      .dm-back-btn {
        background: transparent;
        border: none;
        color: var(--gold, #c9a84c);
        font-size: 12px;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 6px;
        font-weight: 600;
      }
      .dm-back-btn:hover { background: var(--surface-raised, #2a2a2a); }
      #dm-conv-title { font-size: 13px; font-weight: 700; color: var(--text, #eee); }

      /* ── Name prompt modal ─────────────────────────────── */
      .chat-name-modal {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.65);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      }
      .chat-name-box {
        background: var(--surface, #1c1c1c);
        border: 1px solid var(--border, #2a2a2a);
        border-radius: 14px;
        padding: 24px;
        width: 300px;
        box-shadow: 0 8px 40px rgba(0,0,0,0.6);
      }
      .chat-name-title { font-size: 15px; font-weight: 700; color: var(--text, #eee); margin-bottom: 6px; }
      .chat-name-sub { font-size: 12px; color: var(--text-dim, #888); margin-bottom: 14px; line-height: 1.5; }
      .chat-name-input {
        width: 100%;
        box-sizing: border-box;
        background: var(--input-bg, #111);
        border: 1px solid var(--border, #2a2a2a);
        border-radius: 10px;
        padding: 10px 14px;
        font-size: 14px;
        color: var(--text, #eee);
        outline: none;
      }
      .chat-name-input:focus { border-color: var(--gold, #c9a84c); }
      .chat-name-save {
        flex: 1;
        background: var(--gold, #c9a84c);
        color: #111;
        border: none;
        border-radius: 10px;
        padding: 10px 18px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
      }
      .chat-name-cancel {
        background: transparent;
        border: 1px solid var(--border, #2a2a2a);
        color: var(--text-dim, #888);
        border-radius: 10px;
        padding: 10px 14px;
        font-size: 13px;
        cursor: pointer;
      }
    `;
    document.head.appendChild(s);
  }

  // ── Expose public API ─────────────────────────────────────────
  window._chat = { switchTab, openDm, backToPeerList };

})();
