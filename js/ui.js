// ═══════════════════════════════════════════════════════════════
//  SIMANDO LAW — UI CONTROLLER (PART 1 OF 2)
// ═══════════════════════════════════════════════════════════════

// ── THEME INITIALIZATION & TOGGLE ────────────────────────────
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
  document.querySelectorAll('.theme-switch').forEach(sw => {
    sw.setAttribute('data-theme-active', theme);
    if (theme === 'light') sw.classList.add('is-light');
    else sw.classList.remove('is-light');
  });
}

window.initTheme = initTheme;
window.toggleTheme = toggleTheme;
window.updateThemeIcon = updateThemeIcon;

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

// ── DISMISSIBLE HELPER BANNERS & ESCAPE KEY ──────────────────
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

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const dd = document.getElementById("notif-dropdown");
    if (dd) dd.classList.add("hidden");
    const diag = document.getElementById("diagnostic-modal");
    if (diag) diag.classList.add("hidden");
    const dsm = document.getElementById("date-schedule-modal");
    if (dsm) dsm.classList.add("hidden");
  }
});

document.addEventListener("DOMContentLoaded", () => {
  initSidebarEnhancements();
  restoreDismissedBanners();
});

// ── DOM HELPERS & ERROR CLEARING ─────────────────────────────
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

// ── STANDALONE WEB CRYPTO TOTP ENGINE FOR 2FA ────────────────
function generateRandomBase32(length = 16) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += alphabet[bytes[i] % 32];
  }
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
  let bits = 0;
  let value = 0;
  let output = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = alphabet.indexOf(cleaned.charAt(i));
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
      value &= (1 << bits) - 1;
    }
  }
  return new Uint8Array(output);
}
window.base32Decode = base32Decode;

async function generateTOTPCode(secretBase32, timeStepOffset = 0) {
  const keyBytes = base32Decode(secretBase32);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );

  const epoch = Math.floor(Date.now() / 1000);
  const timeStep = Math.floor(epoch / 30) + timeStepOffset;

  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(0, 0, false);
  view.setUint32(4, timeStep, false);

  const hmacResult = await crypto.subtle.sign("HMAC", key, buffer);
  const hmacBytes = new Uint8Array(hmacResult);

  const offset = hmacBytes[hmacBytes.length - 1] & 0xf;
  const binary =
    ((hmacBytes[offset] & 0x7f) << 24) |
    ((hmacBytes[offset + 1] & 0xff) << 16) |
    ((hmacBytes[offset + 2] & 0xff) << 8) |
    (hmacBytes[offset + 3] & 0xff);

  const code = binary % 1000000;
  return String(code).padStart(6, "0");
}
window.generateTOTPCode = generateTOTPCode;

async function verifyClientTOTP(token, secretBase32) {
  if (!token || !secretBase32) return false;
  const cleanedToken = String(token).trim().replace(/\D/g, "");
  if (cleanedToken.length !== 6) return false;

  for (const offset of [0, -1, 1, -2, 2, -3, 3]) {
    try {
      const valid = await generateTOTPCode(secretBase32, offset);
      if (cleanedToken === valid) return true;
    } catch (e) {
      console.warn("TOTP calculation notice:", e);
    }
  }
  return false;
}
window.verifyClientTOTP = verifyClientTOTP;

// ── ONBOARDING SETUP & 2FA / DRIVE MODAL CONTROLLER ───────────
let onboardingGeneratedSecret = null;
let onboardingGeneratedBackupCodes = [];
let onboardingModalDismissedThisSession = false;
let _obCheckRetryCount = 0;

window.checkOnboardingSecurityStatus = function() {
  if (onboardingModalDismissedThisSession) return;

  const u = window._currentUser || window._auth?.currentUser;
  if (!u) {
    if (_obCheckRetryCount < 15) {
      _obCheckRetryCount++;
      setTimeout(window.checkOnboardingSecurityStatus, 400);
    }
    return;
  }

  const userEmail = (u.email || "").toLowerCase();
  const myProf = profiles.find(p => (p.ownerUid && p.ownerUid === u.uid) || (p.email && p.email.toLowerCase() === userEmail));
  if (!myProf) {
    if (_obCheckRetryCount < 15) {
      _obCheckRetryCount++;
      setTimeout(window.checkOnboardingSecurityStatus, 400);
    }
    return;
  }

  const is2FaEnabled = !!myProf.twoFactorEnabled;
  const isDriveConnected = typeof hasValidToken === "function" ? hasValidToken() : false;

  if (is2FaEnabled && isDriveConnected) {
    dismissOnboardingModal();
    return;
  }

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
    if (subEl) subEl.textContent = "Your Two-Factor Authentication is active, but a connected Google Account is required to manage cases, store client court documents, and synchronize deadlines.";
    if (iconEl) iconEl.innerHTML = `<i class="bi bi-cloud-arrow-up-fill" style="color:var(--gold)"></i>`;

    updateOnboardingDriveStatus(false);
    modal.classList.remove("hidden");
    modal.style.display = "flex";
    return;
  }

  if (!is2FaEnabled) {
    if (card2Fa) card2Fa.style.display = "block";
    if (cardDrive) cardDrive.style.display = "block";
    if (driveTitle) driveTitle.textContent = "2. Google Account & Drive Storage";
    if (titleEl) titleEl.textContent = "Account Security & Setup";
    if (subEl) subEl.textContent = "To maintain strict attorney-client privilege and document storage, please complete the required security setup below.";
    if (iconEl) iconEl.innerHTML = `<i class="bi bi-shield-lock-fill" style="color:var(--gold)"></i>`;

    initOnboarding2FAQrCodes(myProf, u);
    updateOnboardingDriveStatus(isDriveConnected);
    modal.classList.remove("hidden");
    modal.style.display = "flex";
  }
};

function initOnboarding2FAQrCodes(myProf, u) {
  if (!onboardingGeneratedSecret) {
    const saved = sessionStorage.getItem("simando_temp_2fa_secret");
    if (saved) {
      onboardingGeneratedSecret = saved;
      try {
        onboardingGeneratedBackupCodes = JSON.parse(sessionStorage.getItem("simando_temp_2fa_backups") || "[]");
      } catch (e) {
        onboardingGeneratedBackupCodes = generateBackupRecoveryCodes(5);
      }
    } else {
      onboardingGeneratedSecret = generateRandomBase32(16);
      onboardingGeneratedBackupCodes = generateBackupRecoveryCodes(5);
      sessionStorage.setItem("simando_temp_2fa_secret", onboardingGeneratedSecret);
      sessionStorage.setItem("simando_temp_2fa_backups", JSON.stringify(onboardingGeneratedBackupCodes));
    }
  }

  const keyDisplay = document.getElementById("ob-pairing-secret-key");
  if (keyDisplay) {
    keyDisplay.innerHTML = `<span style="font-weight:700;color:var(--text)">KEY:</span> ${onboardingGeneratedSecret.match(/.{1,4}/g)?.join(" ") || onboardingGeneratedSecret} <button type="button" onclick="copyOnboardingSecretKey()" style="background:none;border:none;color:var(--gold);cursor:pointer;margin-left:6px;font-size:11px;font-weight:600;text-decoration:underline" title="Copy Key"><i class="bi bi-clipboard"></i> Copy</button>`;
  }

  const userEmail = myProf?.email || u?.email || "attorney@simandolaw.com";
  const otpAuthUrl = `otpauth://totp/Simando%20Law:${encodeURIComponent(userEmail)}?secret=${onboardingGeneratedSecret}&issuer=Simando%20Law`;

  const pairingContainer = document.getElementById("ob-qr-pairing-container");
  if (pairingContainer) {
    pairingContainer.innerHTML = "";
    if (typeof QRCode !== "undefined") {
      new QRCode(pairingContainer, {
        text: otpAuthUrl,
        width: 135,
        height: 135,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
      const extraCanvas = pairingContainer.querySelector("canvas");
      if (extraCanvas) extraCanvas.style.display = "none";
    } else {
      pairingContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=135x135&data=${encodeURIComponent(otpAuthUrl)}" alt="QR" style="border-radius:6px;width:135px;height:135px;display:block"/>`;
    }
  }

  const appLinkContainer = document.getElementById("ob-qr-applink-container");
  if (appLinkContainer) {
    appLinkContainer.innerHTML = "";
    const appStoreUrl = "https://aka.ms/authapp";
    if (typeof QRCode !== "undefined") {
      new QRCode(appLinkContainer, {
        text: appStoreUrl,
        width: 135,
        height: 135,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
      const extraCanvas = appLinkContainer.querySelector("canvas");
      if (extraCanvas) extraCanvas.style.display = "none";
    } else {
      appLinkContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=135x135&data=${encodeURIComponent(appStoreUrl)}" alt="QR" style="border-radius:6px;width:135px;height:135px;display:block"/>`;
    }
  }

  const otpInp = document.getElementById("ob-otp-input");
  if (otpInp) {
    otpInp.value = "";
    const cleanInp = otpInp.cloneNode(true);
    otpInp.parentNode.replaceChild(cleanInp, otpInp);

    cleanInp.addEventListener("input", async (e) => {
      const cleaned = e.target.value.replace(/\D/g, "");
      e.target.value = cleaned;
      const statusMsg = document.getElementById("ob-otp-status-msg");

      if (cleaned.length === 6) {
        if (statusMsg) {
          statusMsg.innerHTML = `<span style="color:var(--gold);font-size:12px;font-weight:600"><span class="spinner" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px"></span> Verifying code...</span>`;
          statusMsg.style.display = "block";
        }
        await window.onboardingActivate2FA(cleaned);
      } else if (statusMsg) {
        statusMsg.style.display = "none";
      }
    });

    cleanInp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        window.onboardingActivate2FA();
      }
    });
  }
}

window.copyOnboardingSecretKey = function() {
  if (!onboardingGeneratedSecret) return;
  navigator.clipboard.writeText(onboardingGeneratedSecret).then(() => {
    showToast("Secret key copied to clipboard! Paste into Authenticator.");
  }).catch(() => {
    showToast("Key: " + onboardingGeneratedSecret);
  });
};

window.switchOnboardingQrType = function(type) {
  const isPairing = type === "pairing";
  const tabPairing = document.getElementById("tab-ob-pairing-qr");
  const tabApp = document.getElementById("tab-ob-app-qr");
  const viewPairing = document.getElementById("ob-view-pairing-qr");
  const viewApp = document.getElementById("ob-view-app-qr");

  if (tabPairing) tabPairing.className = isPairing ? "ob-qr-tab-btn active" : "ob-qr-tab-btn";
  if (tabApp) tabApp.className = !isPairing ? "ob-qr-tab-btn active" : "ob-qr-tab-btn";

  if (viewPairing) viewPairing.style.display = isPairing ? "block" : "none";
  if (viewApp) viewApp.style.display = !isPairing ? "block" : "none";
};

window.dismissOnboardingModal = function() {
  const modal = document.getElementById("onboarding-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.style.display = "none";
  }
  onboardingModalDismissedThisSession = true;
};

function updateOnboardingDriveStatus(isConnected) {
  const tag = document.getElementById("ob-tag-drive");
  const btn = document.getElementById("btn-ob-connect-drive");
  const card = document.getElementById("ob-card-drive");

  if (isConnected) {
    if (tag) {
      tag.className = "onboarding-status-tag active";
      tag.innerHTML = `<i class="bi bi-check-circle-fill"></i> Connected`;
    }
    if (card) card.classList.add("completed");
    if (btn) {
      btn.className = "btn btn-success";
      btn.innerHTML = `<i class="bi bi-check2"></i> Google Account Linked`;
      btn.disabled = true;
    }
  } else {
    if (tag) {
      tag.className = "onboarding-status-tag pending";
      tag.innerHTML = `<i class="bi bi-clock"></i> Action Needed`;
    }
    if (card) card.classList.remove("completed");
    if (btn) {
      btn.className = "btn btn-primary";
      btn.innerHTML = `<i class="bi bi-google"></i> Connect Google Account`;
      btn.disabled = false;
    }
  }
}

window.onboardingConnectDrive = async function() {
  const btn = document.getElementById("btn-ob-connect-drive");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" style="width:14px;height:14px;border-top-color:#040810;display:inline-block;vertical-align:middle;margin-right:6px"></span> Connecting Google OAuth...`;
  }

  try {
    showToast("Opening Google Sign-In...");
    await promptDriveAuth(true);

    showToast("Google Account connected successfully! ✅");
    updateOnboardingDriveStatus(true);

    const u = window._currentUser || window._auth?.currentUser;
    const userEmail = (u?.email || "").toLowerCase();
    const myProf = u && profiles ? profiles.find(p => (p.ownerUid && p.ownerUid === u.uid) || (p.email && p.email.toLowerCase() === userEmail)) : null;
    if (myProf && !myProf.driveFolderId && typeof createDriveFolder === "function") {
      try {
        const folderId = await createDriveFolder(`Simando Law — ${myProf.name}`, DRIVE_FOLDER_ID || null);
        if (folderId && typeof dbUpdateProfile === "function") {
          await dbUpdateProfile(myProf.id, { driveFolderId: folderId });
          myProf.driveFolderId = folderId;
        }
      } catch (e) { /* ignore */ }
    }

    if (typeof updateWorkspaceStatus === "function") updateWorkspaceStatus(false);
    if (typeof renderMyProfile === "function") renderMyProfile();

    checkOnboardingBothComplete();
  } catch (err) {
    console.error("onboardingConnectDrive error:", err);
    showToast("Google connection failed: " + err.message, "error");
    updateOnboardingDriveStatus(false);
  }
};

window.onboardingActivate2FA = async function(manualCode) {
  const codeInp = document.getElementById("ob-otp-input");
  const code = (manualCode || codeInp?.value || "").trim().replace(/\D/g, "");
  const btn = document.getElementById("btn-ob-activate-2fa");
  let statusMsg = document.getElementById("ob-otp-status-msg");

  if (!statusMsg && codeInp) {
    statusMsg = document.createElement("div");
    statusMsg.id = "ob-otp-status-msg";
    statusMsg.style.cssText = "text-align:center;margin-top:6px;min-height:18px;";
    codeInp.parentNode.appendChild(statusMsg);
  }

  if (code.length !== 6) {
    if (statusMsg) {
      statusMsg.innerHTML = `<span style="color:var(--amber);font-size:11.5px">Please enter all 6 digits.</span>`;
      statusMsg.style.display = "block";
    } else {
      showToast("Please enter all 6 digits from Microsoft Authenticator.", "error");
    }
    if (codeInp) codeInp.focus();
    return;
  }

  if (!onboardingGeneratedSecret) {
    onboardingGeneratedSecret = sessionStorage.getItem("simando_temp_2fa_secret") || generateRandomBase32(16);
  }

  if (statusMsg) {
    statusMsg.innerHTML = `<span style="color:var(--gold);font-size:12px;font-weight:600"><span class="spinner" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px"></span> Verifying code...</span>`;
    statusMsg.style.display = "block";
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" style="width:14px;height:14px;border-top-color:#040810;display:inline-block;vertical-align:middle;margin-right:6px"></span> Verifying...`;
  }

  try {
    const isValid = await verifyClientTOTP(code, onboardingGeneratedSecret);
    if (!isValid) {
      if (statusMsg) {
        statusMsg.innerHTML = `<span style="color:var(--red);font-size:12px;font-weight:600"><i class="bi bi-x-circle"></i> Incorrect code. Please check Authenticator.</span>`;
        statusMsg.style.display = "block";
      }
      showToast("Incorrect code. Check Authenticator and try again.", "error");
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="bi bi-shield-check"></i> Verify &amp; Activate 2FA`;
      }
      return;
    }

    if (statusMsg) {
      statusMsg.innerHTML = `<span style="color:var(--green);font-size:12.5px;font-weight:700"><i class="bi bi-check-circle-fill"></i> Code confirmed! Activating 2FA...</span>`;
      statusMsg.style.display = "block";
    }

    const u = window._currentUser || window._auth?.currentUser;
    if (!u) throw new Error("User session expired. Please sign in again.");

    const userEmail = (u.email || "").toLowerCase();
    const myProf = profiles.find(p => (p.ownerUid && p.ownerUid === u.uid) || (p.email && p.email.toLowerCase() === userEmail));
    if (!myProf) throw new Error("Profile record not found.");

    showToast("Code confirmed! Activating 2FA...");

    try {
      const secRef = window._fbDoc(window._db, "profiles", myProf.id, "private", "security");
      const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
      await setDoc(secRef, {
        twoFactorEnabled: true,
        twoFactorSecret: onboardingGeneratedSecret,
        twoFactorBackupCodes: onboardingGeneratedBackupCodes
      }, { merge: true });
    } catch (subColErr) {
      console.warn("Security subcollection notice:", subColErr);
    }

    await dbUpdateProfile(myProf.id, {
      twoFactorEnabled: true,
      twoFactorSecret: onboardingGeneratedSecret,
      twoFactorBackupCodes: onboardingGeneratedBackupCodes
    });

    myProf.twoFactorEnabled = true;
    myProf.twoFactorSecret = onboardingGeneratedSecret;
    myProf.twoFactorBackupCodes = onboardingGeneratedBackupCodes;
    sessionStorage.setItem("simando_2fa_verified", "true");

    const card = document.getElementById("ob-card-2fa");
    const tag = document.getElementById("ob-tag-2fa");
    const content = document.getElementById("ob-content-2fa-body");

    if (card) card.classList.add("completed");
    if (tag) {
      tag.className = "onboarding-status-tag active";
      tag.innerHTML = `<i class="bi bi-check-circle-fill"></i> Activated`;
    }
    if (content) {
      content.innerHTML = `
        <div style="font-size:12.5px;color:var(--green);font-weight:700;display:flex;align-items:center;gap:8px;padding:12px;background:var(--green-bg);border:1px solid rgba(52,211,153,0.3);border-radius:10px">
          <i class="bi bi-shield-fill-check" style="font-size:18px"></i> 2FA Active: Protected by Microsoft Authenticator.
        </div>
      `;
    }

    showToast("Two-Factor Authentication is now active! 🛡️");
    if (typeof renderMyProfile === "function") renderMyProfile();

    checkOnboardingBothComplete();
  } catch (err) {
    console.error("onboardingActivate2FA error:", err);
    if (statusMsg) {
      statusMsg.innerHTML = `<span style="color:var(--red);font-size:11.5px">${err.message}</span>`;
      statusMsg.style.display = "block";
    }
    showToast("Activation failed: " + err.message, "error");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="bi bi-shield-check"></i> Verify &amp; Activate 2FA`;
    }
  }
};
window.onboardingActivate2FA = onboardingActivate2FA;

function checkOnboardingBothComplete() {
  const u = window._currentUser || window._auth?.currentUser;
  const userEmail = (u?.email || "").toLowerCase();
  const myProf = u ? profiles.find(p => (p.ownerUid && p.ownerUid === u.uid) || (p.email && p.email.toLowerCase() === userEmail)) : null;
  const is2Fa = !!myProf?.twoFactorEnabled;
  const isDrive = typeof hasValidToken === "function" ? hasValidToken() : false;

  if (is2Fa && isDrive) {
    const titleEl = document.getElementById("ob-modal-title");
    const subEl = document.getElementById("ob-modal-sub");
    const iconEl = document.getElementById("ob-modal-icon");

    if (titleEl) titleEl.textContent = "Setup Complete!";
    if (subEl) subEl.textContent = "Security credentials and Google Drive are verified. Launching dashboard...";
    if (iconEl) iconEl.innerHTML = `<i class="bi bi-check-circle-fill" style="color:var(--green)"></i>`;

    setTimeout(() => {
      dismissOnboardingModal();
    }, 1200);
  }
}

// ── MULTI-DATE AVAILABILITY PICKER (STRICTLY PERSONAL) ────────
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
          <div id="modal-busy-chips-wrap" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;padding-top:8px;border-top:1px dashed var(--border);min-height:28px;align-items:center"></div>
        </div>

        <div style="display:flex;align-items:center;gap:12px">
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text);cursor:pointer">
            <input type="checkbox" id="busy-all-day" checked onchange="window.toggleBusyTimeInputs(this.checked)" style="accent-color:var(--gold)"/> All Day Block
          </label>
        </div>

        <div class="grid2" id="busy-time-container" style="display:none">
          <div><label class="field-label">Start Time</label><input type="time" class="field-input" id="busy-start-time" value="08:30"/></div>
          <div><label class="field-label">End Time</label><input type="time" class="field-input" id="busy-end-time" value="17:00"/></div>
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
  if (modalCalMonth < 0) { modalCalMonth = 11; modalCalYear--; }
  renderModalCalendarGrid();
};

window.nextModalCalMonth = function() {
  modalCalMonth++;
  if (modalCalMonth > 11) { modalCalMonth = 0; modalCalYear++; }
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
  const now = new Date();
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (dateStr < localToday) {
    if (typeof showToast === "function") showToast("Cannot mark past dates as unavailable.", "error");
    return;
  }
  if (selectedBusyDates.has(dateStr)) selectedBusyDates.delete(dateStr);
  else selectedBusyDates.add(dateStr);
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
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  let html = `
    <div class="cal-day-header">Sun</div><div class="cal-day-header">Mon</div><div class="cal-day-header">Tue</div>
    <div class="cal-day-header">Wed</div><div class="cal-day-header">Thu</div><div class="cal-day-header">Fri</div><div class="cal-day-header">Sat</div>
  `;

  for (let i = firstDay - 1; i >= 0; i--) {
    html += `<div class="cal-day-cell other-month" style="min-height:36px;opacity:0.35;min-width:0;overflow:hidden"><span class="cal-day-num" style="white-space:nowrap">${prevMonthDays - i}</span></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const fullDate = `${modalCalYear}-${String(modalCalMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isPast = fullDate < todayStr;
    const isSelected = selectedBusyDates.has(fullDate);

    let cellBg = "var(--surface)";
    let borderColor = "var(--border)";
    let numColor = "var(--text)";

    if (isSelected) { cellBg = "var(--red-bg)"; borderColor = "var(--red)"; numColor = "var(--red)"; }
    else if (isPast) { cellBg = "transparent"; numColor = "var(--text-dim)"; }

    html += `
      <div class="cal-day-cell ${isPast ? 'is-past' : ''}"
           style="min-height:36px;padding:4px;background:${cellBg};border-color:${borderColor};cursor:${isPast ? 'not-allowed' : 'pointer'};min-width:0;overflow:hidden"
           onclick="${isPast ? '' : `window.toggleBusyDateSelection('${fullDate}')`}">
        <span class="cal-day-num" style="color:${numColor};font-size:11px;white-space:nowrap">${d}</span>
        ${isSelected ? `<span style="font-size:8px;font-weight:700;color:var(--red);text-align:right">BUSY</span>` : ''}
      </div>
    `;
  }

  const rem = (7 - ((firstDay + daysInMonth) % 7)) % 7;
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
        const label = `${monthNames[parseInt(parts[1], 10) - 1].slice(0,3)} ${parseInt(parts[2], 10)}`;
        return `<span style="display:inline-flex;align-items:center;gap:4px;background:var(--red-bg);border:1px solid var(--red);color:var(--red);padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600">${label}<i class="bi bi-x" style="cursor:pointer" onclick="window.toggleBusyDateSelection('${d}')"></i></span>`;
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
  const userEmail = (u?.email || "").toLowerCase();
  const myProf = profiles.find(p => (p.ownerUid && p.ownerUid === u.uid) || (p.email && p.email.toLowerCase() === userEmail));

  const submitBtn = document.getElementById("busy-submit-btn");
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Saving..."; }

  try {
    if (typeof showToast === "function") showToast("Saving personal schedule...");
    for (const date of selectedBusyDates) {
      const busyData = {
        title, date, time: timeStr, description: desc, type: "busy",
        targetUid: u.uid, targetName: myProf?.name || u.displayName || u.email,
        requesterUid: u.uid, requesterName: myProf?.name || u.displayName || u.email,
        ownerUid: u.uid, status: "accepted"
      };
      if (typeof dbAddAppointment === "function") {
        await dbAddAppointment(busyData);
      } else {
        busyData.id = "local_appt_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
        appointments.push(busyData);
        window.appointments = appointments;
      }
    }
    if (typeof showToast === "function") showToast(`Logged ${selectedBusyDates.size} date(s) to your personal schedule!`);
    window.closeBusyModal();
    if (typeof renderCalendarView === "function") renderCalendarView();
    if (typeof renderDashboard === "function") renderDashboard();
  } catch (err) {
    console.error("submitBusyDates error:", err);
    if (typeof showToast === "function") showToast("Failed to save schedule: " + err.message, "error");
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = `<i class="bi bi-check2"></i> Save Schedule`; }
  }
};

window.deleteBusySlot = function(id) {
  const a = appointments.find(x => x.id === id);
  const title = a ? a.title : "this schedule entry";
  window.openConfirmModal({
    icon: "bi-calendar-x-fill",
    title: "Remove Schedule Entry?",
    body: `Are you sure you want to remove <strong>"${escHtml(title)}"</strong> from your schedule? This action cannot be undone.`,
    confirmText: "Remove Entry",
    confirmStyle: "btn-danger",
    onConfirm: async () => {
      try {
        if (typeof dbDeleteAppointment === "function") await dbDeleteAppointment(id);
        else { appointments = appointments.filter(x => x.id !== id); window.appointments = appointments; }
        if (typeof showToast === "function") showToast("Schedule entry removed!");
        if (typeof closeDateScheduleModal === "function") closeDateScheduleModal();
        if (typeof renderCalendarView === "function") renderCalendarView();
        if (typeof renderDashboard === "function") renderDashboard();
      } catch (err) {
        console.error("deleteBusySlot error:", err);
        if (typeof showToast === "function") showToast("Failed to remove entry: " + err.message, "error");
      }
    }
  });
};

// ── CALENDAR MONTH VIEW + SELECTED DAY SIDE PANEL ────────────
let currentCalYear = new Date().getFullYear();
let currentCalMonth = new Date().getMonth();
let selectedCalDateStr = (() => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
})();

function renderCalendarView() {
  const select = document.getElementById("calendar-filter-select");
  const u = window._currentUser || window._auth?.currentUser;
  const myProf = profiles.find(p => p.ownerUid === u?.uid || (p.email && p.email.toLowerCase() === (u?.email || "").toLowerCase()));
  const isDeveloper = myProf && myProf.role === "developer";

  if (select) {
    if (isDeveloper) {
      const devProfiles = profiles.filter(p => p.role === "developer");
      let devOptionsHtml = `<option value="Everyone">All Developers (Sandbox Overview)</option>`;
      devProfiles.forEach(p => { devOptionsHtml += `<option value="${p.ownerUid}">${p.name} (Developer Sandbox)</option>`; });
      select.innerHTML = devOptionsHtml;
      select.disabled = false;
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
      <span style="display:inline-flex;align-items:center;gap:4px;color:var(--violet)"><i class="bi bi-file-earmark-text-fill" style="color:var(--violet)"></i> Pleading Deadline</span>
      <span style="display:inline-flex;align-items:center;gap:4px;color:var(--red)"><i class="bi bi-slash-circle-fill" style="color:var(--red)"></i> Out of Office / In Court</span>
      <span style="display:inline-flex;align-items:center;gap:4px;color:var(--green)"><i class="bi bi-people-fill" style="color:var(--green)"></i> Consultation</span>
    `;
  }

  renderMonthlyCalendarGrid();
}

function prevCalMonth() { currentCalMonth--; if (currentCalMonth < 0) { currentCalMonth = 11; currentCalYear--; } renderMonthlyCalendarGrid(); }
function nextCalMonth() { currentCalMonth++; if (currentCalMonth > 11) { currentCalMonth = 0; currentCalYear++; } renderMonthlyCalendarGrid(); }
function todayCalMonth() {
  const now = new Date();
  currentCalYear = now.getFullYear();
  currentCalMonth = now.getMonth();
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
  const u = window._currentUser || window._auth?.currentUser;
  const currentUid = u?.uid || "";
  const userEmail = (u?.email || "").toLowerCase();
  const myProf = profiles.find(p => (p.ownerUid && p.ownerUid === currentUid) || (p.email && p.email.toLowerCase() === userEmail));
  const isDeveloper = myProf && myProf.role === "developer";

  let dateCases = cases.filter(c =>
    c.dueDate === dateStr || c.docDueDate === dateStr ||
    (Array.isArray(c.hearings) && c.hearings.some(h => h.date === dateStr)) ||
    (Array.isArray(c.deadlines) && c.deadlines.some(d => d.date === dateStr))
  );
  let dateAppts = appointments.filter(a => a.date === dateStr && a.status === "accepted");

  if (isDeveloper) {
    const devUids = profiles.filter(p => p.role === "developer" && p.ownerUid).map(p => p.ownerUid);
    if (currentUid && !devUids.includes(currentUid)) devUids.push(currentUid);
    dateCases = dateCases.filter(c => devUids.includes(c.ownerUid));
    dateAppts = dateAppts.filter(a => {
      if (a.targetUid === currentUid || a.requesterUid === currentUid || a.ownerUid === currentUid) return true;
      const targetProf = profiles.find(p => p.ownerUid === a.targetUid);
      const reqProf = profiles.find(p => p.ownerUid === a.requesterUid);
      return (targetProf?.role === "developer" || reqProf?.role === "developer");
    });
  } else {
    dateAppts = dateAppts.filter(a => {
      const creatorProf = profiles.find(p => p.ownerUid === (a.targetUid || a.requesterUid || a.ownerUid));
      return creatorProf?.role !== "developer";
    });
  }

  const allItems = [];
  dateCases.forEach(c => {
    const p = profiles.find(x => x.id === c.profileId);
    const specificHearing = Array.isArray(c.hearings) ? c.hearings.find(h => h.date === dateStr) : null;
    const specificDeadline = Array.isArray(c.deadlines) ? c.deadlines.find(d => d.date === dateStr) : null;
    const isOwner = c.ownerUid === currentUid;
    const hasAccess = isOwner || (Array.isArray(c.sharedWith) && c.sharedWith.includes(currentUid)) || (Array.isArray(c.allowedUids) && c.allowedUids.includes(currentUid)) || (myProf && myProf.role === "admin");

    if (specificHearing) {
      allItems.push({
        id: c.id, subId: specificHearing.id || "h_default", kind: "hearing", hasAccess,
        badgeColor: "var(--gold)", badgeBg: "var(--gold-dim)", badgeLabel: "Court Hearing",
        title: hasAccess ? (specificHearing.purpose || c.title) : `Court Appearance (${p?.name || 'Associate Attorney'})`,
        time: specificHearing.time || "8:30 AM", venue: c.venue || "Courtroom / Venue N/A",
        attorneyName: p?.name || "Attorney", attorneyColor: p?.avatarColor || "#8a6210", photoUrl: p?.photoUrl || null,
        description: hasAccess ? (specificHearing.notes || specificHearing.purpose || c.narrative || "") : "Confidential attorney-client information.",
        isOwner, canEditDesc: isOwner, isDeveloper
      });
    }

    if (specificDeadline || c.docDueDate === dateStr) {
      const dSubtype = specificDeadline ? (specificDeadline.subtype || specificDeadline.title) : (c.docType || "Formal Pleading");
      const dNotes = specificDeadline ? (specificDeadline.notes || "") : "";
      allItems.push({
        id: c.id, subId: specificDeadline?.id || "d_default", kind: "deadline", hasAccess,
        badgeColor: "var(--violet)", badgeBg: "var(--violet-bg)", badgeLabel: "Pleading Deadline",
        title: hasAccess ? `${c.title} — ${dSubtype}` : `Filing Deadline (${p?.name || 'Associate Attorney'})`,
        time: "Filing Deadline", venue: c.venue || "Courtroom / Venue N/A",
        attorneyName: p?.name || "Attorney", attorneyColor: p?.avatarColor || "#4338ca", photoUrl: p?.photoUrl || null,
        description: hasAccess ? dNotes : "Confidential attorney-client filing deadline.",
        isOwner, canEditDesc: isOwner, isDeveloper
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
      attorneyName: a.targetName || (isDeveloper ? "Developer" : "Attorney"),
      attorneyColor: targetProf?.avatarColor || (isDeveloper ? "var(--cyan)" : "#991b1b"), photoUrl: targetProf?.photoUrl || null,
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
  const isToday = dateStr === todayStr;
  const isPast = dateStr < todayStr;
  heading.innerHTML = `${formatDate(dateStr)} ${isToday ? '<span class="badge" style="background:var(--gold-dim);color:var(--gold-light);margin-left:6px;font-size:10px">TODAY</span>' : (isPast ? '<span class="badge" style="background:var(--surface2);color:var(--text-dim);margin-left:6px;font-size:10px">PAST</span>' : '')}`;

  const allItems = buildScheduleItemsForDate(dateStr);
  if (allItems.length === 0) {
    listEl.innerHTML = `
      <div style="text-align:center;padding:32px 16px;background:var(--surface2);border-radius:12px;border:1px dashed var(--border-soft)">
        <i class="bi bi-calendar-check" style="font-size:28px;color:var(--text-dim)"></i>
        <div style="font-weight:700;margin-top:8px;color:var(--text)">No hearings or deadlines</div>
        <div style="font-size:12.5px;color:var(--text-dim);margin-top:4px">${isPast ? "No past events recorded for this date." : "This date is currently open on the firm schedule."}</div>
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

  const u = window._currentUser || window._auth?.currentUser;
  const currentUid = u?.uid || "";
  const userEmail = (u?.email || "").toLowerCase();
  const myProf = profiles.find(p => (p.ownerUid && p.ownerUid === currentUid) || (p.email && p.email.toLowerCase() === userEmail));
  const isDeveloper = myProf && myProf.role === "developer";
  const filter = document.getElementById("calendar-filter-select")?.value || "Everyone";

  let activeCases = cases.filter(c => c.dueDate || c.docDueDate || (Array.isArray(c.hearings) && c.hearings.length > 0) || (Array.isArray(c.deadlines) && c.deadlines.length > 0));
  let activeAppts = appointments.filter(a => a.status === "accepted");

  if (isDeveloper) {
    const devUids = profiles.filter(p => p.role === "developer" && p.ownerUid).map(p => p.ownerUid);
    if (currentUid && !devUids.includes(currentUid)) devUids.push(currentUid);
    activeAppts = activeAppts.filter(a => {
      if (a.targetUid === currentUid || a.requesterUid === currentUid || a.ownerUid === currentUid) return true;
      const targetProf = profiles.find(p => p.ownerUid === a.targetUid);
      const reqProf = profiles.find(p => p.ownerUid === a.requesterUid);
      return (targetProf?.role === "developer" || reqProf?.role === "developer");
    });
    if (filter === "Everyone") activeCases = activeCases.filter(c => devUids.includes(c.ownerUid));
    else {
      activeCases = activeCases.filter(c => c.ownerUid === filter);
      activeAppts = activeAppts.filter(a => a.targetUid === filter || a.requesterUid === filter || a.ownerUid === filter);
    }
  } else if (filter !== "Everyone") {
    const matchedProf = profiles.find(p => p.ownerUid === filter);
    activeCases = activeCases.filter(c => c.profileId === matchedProf?.id);
    activeAppts = activeAppts.filter(a => a.targetUid === filter || a.requesterUid === filter);
  } else {
    activeAppts = activeAppts.filter(a => {
      const creatorProf = profiles.find(p => p.ownerUid === (a.targetUid || a.requesterUid || a.ownerUid));
      return creatorProf?.role !== "developer";
    });
  }

  const eventsByDate = {};
  activeCases.forEach(c => {
    const p = profiles.find(x => x.id === c.profileId);
    const hasAccess = c.ownerUid === currentUid || (Array.isArray(c.sharedWith) && c.sharedWith.includes(currentUid)) || (Array.isArray(c.allowedUids) && c.allowedUids.includes(currentUid)) || (myProf && myProf.role === "admin");
    const attorneyInitials = p ? initials(p.name) : "AT";
    const attorneyColor = p?.avatarColor || "#8a6210";

    if (c.docDueDate) {
      if (!eventsByDate[c.docDueDate]) eventsByDate[c.docDueDate] = [];
      eventsByDate[c.docDueDate].push({ id: c.id, type: "deadline", initials: attorneyInitials, avatarColor: attorneyColor, title: hasAccess ? (c.docType || c.title) : "Pleading Due" });
    } else if (c.dueDate && (!Array.isArray(c.hearings) || !c.hearings.some(h => h.date === c.dueDate))) {
      if (!eventsByDate[c.dueDate]) eventsByDate[c.dueDate] = [];
      eventsByDate[c.dueDate].push({ id: c.id, type: "deadline", initials: attorneyInitials, avatarColor: attorneyColor, title: hasAccess ? c.title : "Pleading Due" });
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

  activeAppts.forEach(a => {
    if (!eventsByDate[a.date]) eventsByDate[a.date] = [];
    const isBusy = a.type === "busy";
    const targetProf = profiles.find(p => p.ownerUid === (a.targetUid || a.requesterUid || a.ownerUid));
    eventsByDate[a.date].push({
      id: a.id, type: isBusy ? "busy" : "appt",
      initials: targetProf ? initials(targetProf.name) : (isDeveloper ? "DV" : "AT"),
      avatarColor: targetProf?.avatarColor || (isDeveloper ? "var(--cyan)" : "#991b1b"),
      title: a.title || (isBusy ? "Out of Office" : "Meeting")
    });
  });

  const firstDayObj = new Date(currentCalYear, currentCalMonth, 1);
  const startingDayOfWeek = firstDayObj.getDay();
  const daysInMonth = new Date(currentCalYear, currentCalMonth + 1, 0).getDate();
  const prevMonthDays = new Date(currentCalYear, currentCalMonth, 0).getDate();
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const hasDayPanel = !!document.getElementById("cal-day-panel");

  gridEl.style.cssText = "display:grid !important;grid-template-columns:repeat(7, minmax(0, 1fr)) !important;gap:6px;width:100%;box-sizing:border-box;";

  let html = `
    <div class="cal-day-header">Sun</div><div class="cal-day-header">Mon</div><div class="cal-day-header">Tue</div>
    <div class="cal-day-header">Wed</div><div class="cal-day-header">Thu</div><div class="cal-day-header">Fri</div><div class="cal-day-header">Sat</div>
  `;

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
      const topTwo = dayEvents.slice(0, 2);
      const remainingCount = dayEvents.length - 2;
      eventsMarkup = `<div style="display:flex;flex-direction:column;gap:3px;margin-top:4px;overflow:hidden;width:100%;min-width:0">`;
      topTwo.forEach(ev => {
        let bgStyle = "background:var(--gold-dim);color:var(--gold-light);border:1px solid var(--gold-border);";
        let iconMarkup = `<i class="bi bi-bank" style="font-size:8.5px;flex-shrink:0"></i>`;
        if (ev.type === "deadline") { bgStyle = "background:var(--violet-bg);color:var(--violet);border:1px solid rgba(129,140,248,0.3);"; iconMarkup = `<i class="bi bi-file-earmark-text-fill" style="font-size:8.5px;flex-shrink:0"></i>`; }
        else if (ev.type === "busy") { bgStyle = "background:var(--red-bg);color:var(--red);border:1px solid rgba(248,113,113,0.3);"; iconMarkup = `<i class="bi bi-slash-circle-fill" style="font-size:8.5px;flex-shrink:0"></i>`; }
        else if (ev.type === "appt") { bgStyle = "background:var(--green-bg);color:var(--green);border:1px solid rgba(52,211,153,0.3);"; iconMarkup = `<i class="bi bi-people-fill" style="font-size:8.5px;flex-shrink:0"></i>`; }
        eventsMarkup += `
          <div style="display:flex;align-items:center;gap:3px;font-size:9.5px;font-weight:700;padding:2px 5px;border-radius:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;min-width:0;${bgStyle}" title="${escHtml(ev.title)}">
            <span style="width:13px;height:13px;border-radius:50%;background:${ev.avatarColor};font-size:7px;display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0">${ev.initials}</span>
            ${iconMarkup}
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0">${escHtml(ev.title)}</span>
          </div>`;
      });
      if (remainingCount > 0) {
        eventsMarkup += `<div style="font-size:8.5px;font-weight:700;color:var(--gold-light);background:var(--surface3);border:1px solid var(--border);padding:1px 4px;border-radius:3px;text-align:center;margin-top:1px;white-space:nowrap">+${remainingCount} more</div>`;
      }
      eventsMarkup += `</div>`;
    }

    const todayTag = isToday ? `<span style="font-size:8.5px;background:var(--gold-solid);color:#060c13;font-weight:800;padding:1px 4px;border-radius:3px;letter-spacing:0.5px;flex-shrink:0">TODAY</span>` : "";

    html += `
      <div class="cal-day-cell ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''} ${isPast ? 'is-past' : ''}"
           onclick="onCalendarDayClick('${fullDateStr}')"
           title="${isToday ? "Today's Schedule" : isPast ? "Past Date (View Only)" : "Click to view schedule"}">
        <div style="display:flex;align-items:center;justify-content:space-between;width:100%;min-width:0">
          <span class="cal-day-num">${day}</span>
          ${todayTag}
        </div>
        ${eventsMarkup}
      </div>
    `;
  }

  const rem = (7 - ((startingDayOfWeek + daysInMonth) % 7)) % 7;
  for (let i = 1; i <= rem; i++) {
    html += `<div class="cal-day-cell other-month"><span class="cal-day-num">${i}</span></div>`;
  }

  gridEl.innerHTML = html;
  if (hasDayPanel) renderCalendarDayPanel(selectedCalDateStr);
}
window.renderMonthlyCalendarGrid = renderMonthlyCalendarGrid;

// ── DATE SCHEDULE POPUP MODAL ────────────────────────────────
window.openDateScheduleModal = function(dateStr) {
  const modal = document.getElementById("date-schedule-modal");
  const titleEl = document.getElementById("dsm-title");
  const listEl = document.getElementById("dsm-events-list");
  if (!modal || !listEl) return;

  const formattedDate = formatDate(dateStr);
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const isPast = dateStr < todayStr;
  const isToday = dateStr === todayStr;

  let headerBadge = "";
  if (isToday) headerBadge = ` <span style="font-size:10px;background:var(--gold-solid);color:#060c13;font-weight:800;padding:2px 6px;border-radius:4px">TODAY</span>`;
  else if (isPast) headerBadge = ` <span style="font-size:10px;background:var(--surface3);color:var(--text-dim);font-weight:600;padding:2px 6px;border-radius:4px">PAST DATE</span>`;

  if (titleEl) titleEl.innerHTML = `<i class="bi bi-calendar3" style="color:var(--gold);margin-right:6px"></i> Schedule for ${formattedDate}${headerBadge}`;

  const allItems = buildScheduleItemsForDate(dateStr);
  if (allItems.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state" style="padding:28px 14px">
        <div class="empty-state-icon" style="font-size:32px;margin-bottom:8px;color:var(--gold)"><i class="bi bi-calendar-x"></i></div>
        <div style="font-size:13px;color:var(--text-muted)">${isPast ? "No past events recorded for this date." : "No hearings or schedule blocks on this date."}</div>
      </div>`;
  } else {
    listEl.innerHTML = allItems.map(item => {
      let actionMarkup = "";
      if (item.kind === "hearing" || item.kind === "deadline") {
        actionMarkup = item.hasAccess
          ? `<div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="btn btn-secondary btn-sm" onclick="window.closeDateScheduleModal(); openCase('${item.id}')">Open Case File <i class="bi bi-arrow-right"></i></button></div>`
          : `<div style="margin-top:8px;font-size:11px;color:var(--text-dim);display:flex;align-items:center;gap:4px"><i class="bi bi-lock-fill" style="color:var(--amber)"></i> Case restricted. Only authorized attorneys may view full case files.</div>`;
      } else if (item.canDelete) {
        actionMarkup = `<div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="btn btn-ghost btn-sm" style="color:var(--red);padding:2px 6px" onclick="window.deleteBusySlot('${item.id}')"><i class="bi bi-trash3"></i> Remove</button></div>`;
      }

      let descriptionBlock = "";
      if (item.canEditDesc) {
        descriptionBlock = `
          <div style="margin-top:10px;background:var(--surface3);border:1px solid var(--border);border-radius:9px;padding:10px 12px">
            <label style="font-size:11px;text-transform:uppercase;color:var(--gold-light);font-weight:700;display:flex;align-items:center;gap:5px;margin-bottom:6px"><i class="bi bi-card-text"></i> Description:</label>
            <textarea id="dsm-desc-${item.id}-${item.subId || ''}" class="field-input" style="font-size:12.5px;min-height:56px;padding:8px 10px;resize:vertical" placeholder="Enter schedule description...">${escHtml(item.description || "")}</textarea>
            <div style="display:flex;justify-content:flex-end;margin-top:8px">
              <button class="btn btn-primary btn-sm" type="button" onclick="saveEventInlineDescription('${item.kind}', '${item.id}', '${dateStr}', '${item.subId || ''}')" style="font-size:11.5px;padding:4px 12px"><i class="bi bi-check2"></i> Save Description</button>
            </div>
          </div>`;
      } else if (item.description) {
        descriptionBlock = `
          <div style="margin-top:10px;background:var(--surface3);border:1px solid var(--border);border-radius:9px;padding:10px 12px">
            <div style="font-size:10.5px;text-transform:uppercase;color:var(--text-dim);font-weight:700;margin-bottom:4px">Description:</div>
            <div style="font-size:12.5px;color:var(--text);line-height:1.5;white-space:pre-wrap">${escHtml(item.description)}</div>
          </div>`;
      }

      return `
        <div style="background:var(--surface2);border:1px solid var(--border);border-left:4px solid ${item.badgeColor};border-radius:12px;padding:14px 16px;margin-bottom:12px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <span style="font-size:10.5px;font-weight:700;color:${item.badgeColor};background:${item.badgeBg};padding:2px 8px;border-radius:4px">${item.badgeLabel}</span>
            <span style="font-size:11.5px;color:var(--gold-light);font-weight:700"><i class="bi bi-clock"></i> ${item.time}</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            ${avatarDiv(item.attorneyName, item.attorneyColor, 32, item.photoUrl)}
            <div>
              <div style="font-size:14px;font-weight:700;color:var(--text)">${escHtml(item.title)}</div>
              <div style="font-size:11.5px;color:var(--text-muted)"><strong>${item.isDeveloper ? 'Developer' : 'Counsel'}:</strong> ${escHtml(item.attorneyName)}</div>
            </div>
          </div>
          ${item.venue ? `<div style="font-size:11.5px;color:var(--text-dim);margin-bottom:4px"><i class="bi bi-geo-alt-fill" style="color:var(--gold)"></i> ${escHtml(item.venue)}</div>` : ''}
          ${descriptionBlock}
          ${actionMarkup}
        </div>`;
    }).join("");
  }
  modal.classList.remove("hidden");
};

window.closeDateScheduleModal = function() {
  const modal = document.getElementById("date-schedule-modal");
  if (modal) modal.classList.add("hidden");
};

window.saveEventInlineDescription = async function(kind, id, dateStr, subId) {
  const descEl = document.getElementById(`dsm-desc-${id}-${subId || ''}`) || document.getElementById(`dsm-desc-${id}`);
  if (!descEl) return;
  const newDesc = descEl.value.trim();
  const u = window._currentUser || window._auth?.currentUser;
  const currentUid = u?.uid || "";

  try {
    if (kind === "hearing" || kind === "case") {
      const c = cases.find(x => x.id === id);
      if (!c) throw new Error("Case file not found.");
      if (c.ownerUid !== currentUid) { showToast("You can only edit descriptions on your own cases.", "error"); return; }
      if (typeof showToast === "function") showToast("Saving description...");
      if (Array.isArray(c.hearings) && c.hearings.length > 0) {
        const hIdx = c.hearings.findIndex(h => h.id === subId || h.date === dateStr);
        if (hIdx >= 0) c.hearings[hIdx].notes = newDesc;
        else c.hearings.push({ id: "h_" + Date.now(), date: dateStr, time: "08:30", purpose: "Court Appearance", notes: newDesc });
        await dbUpdateCase(c.id, { hearings: c.hearings });
      } else {
        await dbUpdateCase(c.id, { narrative: newDesc });
      }
    } else if (kind === "deadline") {
      const c = cases.find(x => x.id === id);
      if (!c) throw new Error("Case file not found.");
      if (c.ownerUid !== currentUid) { showToast("You can only edit descriptions on your own cases.", "error"); return; }
      if (typeof showToast === "function") showToast("Saving deadline description...");
      if (Array.isArray(c.deadlines) && c.deadlines.length > 0) {
        const dIdx = c.deadlines.findIndex(d => d.id === subId || d.date === dateStr);
        if (dIdx >= 0) c.deadlines[dIdx].notes = newDesc;
        await dbUpdateCase(c.id, { deadlines: c.deadlines });
      }
    } else if (kind === "appt" || kind === "busy") {
      const a = appointments.find(x => x.id === id);
      if (!a) throw new Error("Appointment not found.");
      const isOwner = a.ownerUid === currentUid || a.requesterUid === currentUid || a.targetUid === currentUid;
      if (!isOwner) { showToast("You can only edit descriptions on your own schedule.", "error"); return; }
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

// ── SYSTEM HEALTH & DIAGNOSTIC ENGINE ─────────────────────────
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
  const netBadge = document.getElementById("diag-network-badge");
  const netSub = document.getElementById("diag-network-sub");
  const dbBadge = document.getElementById("diag-db-badge");
  const dbSub = document.getElementById("diag-db-sub");
  const driveBadge = document.getElementById("diag-drive-badge");
  const driveSub = document.getElementById("diag-drive-sub");
  const dot = document.getElementById("status-indicator-dot");
  const txt = document.getElementById("status-indicator-text");

  const isNetworkOk = navigator.onLine;
  const isDbOk = !localMode && !!window._db && dbReady;
  const isDriveOk = typeof hasValidToken === "function" ? hasValidToken() : false;

  const u = window._currentUser || window._auth?.currentUser;
  const userEmail = (u?.email || "").toLowerCase();
  const myProf = u ? profiles.find(p => (p.ownerUid && p.ownerUid === u.uid) || (p.email && p.email.toLowerCase() === userEmail)) : null;
  const hasDriveFolder = !!(myProf && myProf.driveFolderId);

  if (netBadge && netSub) {
    netBadge.className = isNetworkOk ? "badge badge-pass" : "badge badge-fail";
    netBadge.innerHTML = isNetworkOk ? `<i class="bi bi-wifi" style="color:var(--green)"></i> Online` : `<i class="bi bi-wifi-off" style="color:var(--red)"></i> Offline`;
    netSub.textContent = isNetworkOk ? "Active internet connection detected" : "No network connection. Offline changes won't sync.";
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
    if (txt) { txt.textContent = "System Disconnected"; txt.style.color = "var(--red)"; }
  } else if (!isDriveOk || localMode || !hasDriveFolder) {
    systemHealthStatus = "warning";
    if (dot) dot.className = "status-dot warning";
    if (txt) { txt.textContent = !isDriveOk ? "Connect Drive" : "Memory Mode"; txt.style.color = "var(--amber)"; }
  } else {
    systemHealthStatus = "healthy";
    if (dot) dot.className = "status-dot healthy";
    if (txt) { txt.textContent = "Workspace Active"; txt.style.color = "var(--green)"; }
  }

  if (manualRun && typeof showToast === "function") {
    showToast(`Health check complete: ${systemHealthStatus === "healthy" ? "All systems healthy" : "Issues detected"}`, systemHealthStatus === "healthy" ? "success" : "error");
  }
}
window.updateWorkspaceStatus = updateWorkspaceStatus;

if (!window._healthIntervalId) {
  window._healthIntervalId = setInterval(() => {
    if (document.visibilityState === "visible") updateWorkspaceStatus(false);
  }, 25000);
}
window.addEventListener("online", () => updateWorkspaceStatus(false));
window.addEventListener("offline", () => updateWorkspaceStatus(false));

// ── UNIVERSAL CONFIRMATION DIALOG ─────────────────────────────
let pendingActionConfirmCallback = null;

window.openConfirmModal = function({ icon = "bi-shield-check", title = "Confirm Action", body = "Are you sure?", confirmText = "Confirm", cancelText = "Keep", confirmStyle = "btn-primary", onConfirm = null }) {
  const modal = document.getElementById("universal-confirm-modal");
  const iconEl = document.getElementById("ucm-icon");
  const titleEl = document.getElementById("ucm-title");
  const bodyEl = document.getElementById("ucm-body");
  const btn = document.getElementById("ucm-confirm-btn");
  if (!modal) return;

  if (iconEl) iconEl.innerHTML = `<i class="bi ${icon.startsWith("bi-") ? icon : "bi-shield-check"}" style="color:var(--gold)"></i>`;
  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.innerHTML = body;
  if (btn) { btn.textContent = confirmText; btn.className = `btn ${confirmStyle}`; }
  modal.querySelectorAll('button[onclick="closeConfirmModal()"]').forEach(cb => { cb.textContent = cancelText || "Keep"; });

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
      if (typeof cb === "function") cb();
    });
  }
});

// ── NAVIGATION, PAGE HEADERS & DISCARD INTERCEPTION ──────────
let pendingNavigationDestination = null;
let _isSubmittingCase = false;
let caseDetailOrigin = "allcases";

const DESKTOP_PAGE_META = {
  dashboard:     ["Law Office Dashboard", "Quick overview of your cases, hearings, and deadlines"],
  calendar:      ["Firm Schedule & Court Calendar", "View upcoming hearings, pleading deadlines, and attorney availability"],
  mydrive:       ["Firm Drive — Case Files & Folders", "Direct, secure access to your system Google Drive folders"],
  profiles:      ["Office Attorneys", "Directory of partners and associates in the firm"],
  profileDetail: ["Attorney Profile", "Assigned caseload and contact details"],
  profileForm:   ["Attorney Profile Setup", "Create or edit attorney profile information"],
  allcases:      ["All Cases", "Search, filter, and open any case record"],
  caseDetail:    ["Case File Details", "Full summary, hearing schedule, and attached documents"],
  caseForm:      ["Add / Edit Case", "Follow the 4 steps below to save your case record"],
  myprofile:     ["My Settings & Security", "Manage your profile, Google Drive link, 2FA, and login password"]
};

function hasUnsavedCaseChanges() {
  if (_isSubmittingCase || window._isSubmittingCase) return false;
  if (currentView !== "caseForm") return false;
  const title = (document.getElementById("cf-case-title")?.value || "").trim();
  const narrative = (document.getElementById("cf-narrative")?.value || "").trim();
  const caseNumber = (document.getElementById("cf-case-number")?.value || "").trim();
  const newDeadlineDate = (document.getElementById("cf-new-deadline-date")?.value || "").trim();
  const newDeadlineSubtype = (document.getElementById("cf-new-deadline-subtype")?.value || "").trim();
  const hasDocs = Array.isArray(pendingDocs) && pendingDocs.length > 0;
  const hasHearings = Array.isArray(window.cfHearings) && window.cfHearings.length > 0;
  const hasDeadlines = Array.isArray(window.cfDeadlines) && window.cfDeadlines.length > 0;
  return Boolean(title || narrative || caseNumber || newDeadlineDate || newDeadlineSubtype || hasDocs || hasHearings || hasDeadlines);
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
  if (hasUnsavedCaseChanges()) window.promptDiscardCase(caseFormOrigin || "allcases");
  else { resetCaseFormFields(); executeNavigation(caseFormOrigin || "allcases"); }
};
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

function resetCaseFormFields() {
  setElVal("cf-case-title", ""); setElVal("cf-narrative", ""); setElVal("cf-filed", "");
  setElVal("cf-due", ""); setElVal("cf-case-number", ""); setElVal("cf-doc-type", "");
  setElVal("cf-type-input", ""); setElVal("cf-new-deadline-date", "");
  setElVal("cf-new-deadline-subtype", ""); setElVal("cf-new-deadline-notes", "");
  if (typeof pendingDocs !== "undefined") pendingDocs = [];
  if (typeof window.cfHearings !== "undefined") window.cfHearings = [];
  if (typeof window.cfDeadlines !== "undefined") window.cfDeadlines = [];
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

function isValidMobile(num) {
  if (!num) return true;
  return String(num).replace(/\D/g, "").length === 11;
}
window.isValidMobile = isValidMobile;

function isValidEmail(email) {
  return /^[^\s@]+@(gmail\.com|outlook\.com|yahoo\.com)$/i.test(String(email || "").trim());
}
window.isValidEmail = isValidEmail;

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

  passInput.addEventListener("focus", () => { reqContainer.style.display = "block"; });
  passInput.addEventListener("input", () => {
    const val = passInput.value;
    if (!val) { reqContainer.style.display = "none"; return; }
    reqContainer.style.display = "block";
    for (const key in reqs) {
      const rule = reqs[key];
      const passed = rule.test(val);
      if (rule.el) {
        const icon = rule.el.querySelector(".req-icon");
        rule.el.style.color = passed ? "var(--green)" : "var(--text-dim)";
        if (icon) icon.innerHTML = passed
          ? `<i class="bi bi-check-circle-fill" style="color:var(--green)"></i>`
          : `<i class="bi bi-x-circle" style="color:var(--red)"></i>`;
      }
    }
  });
  passInput.addEventListener("blur", () => { if (!passInput.value) reqContainer.style.display = "none"; });
}
window.initPasswordStrengthChecker = initPasswordStrengthChecker;

function showView(name) {
  const chatPanel = document.getElementById("chat-panel");
  if (chatPanel && !chatPanel.classList.contains("hidden")) chatPanel.classList.add("hidden");
  const notifDropdown = document.getElementById("notif-dropdown");
  if (notifDropdown && !notifDropdown.classList.contains("hidden")) notifDropdown.classList.add("hidden");

  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
  const el = document.getElementById("view-" + name);
  if (el) el.classList.remove("hidden");
  currentView = name;

  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".mobile-nav-item").forEach(b => b.classList.remove("active"));

  let primaryNavKey = name;
  if (name === "caseDetail" || name === "caseForm" || name === "allcases") primaryNavKey = "allcases";
  else if (name === "profileDetail" || name === "profileForm" || name === "profiles") primaryNavKey = "profiles";
  else if (name === "myprofile") primaryNavKey = "myprofile";

  const btn = document.querySelector(`.nav-btn[data-nav="${primaryNavKey}"]`);
  if (btn) btn.classList.add("active");
  const mBtn = document.querySelector(`.mobile-nav-item[data-nav="${primaryNavKey}"]`);
  if (mBtn) mBtn.classList.add("active");

  const meta = DESKTOP_PAGE_META[name];
  if (meta) {
    const tEl = document.getElementById("main-page-title");
    const sEl = document.getElementById("main-page-sub");
    if (tEl) tEl.textContent = meta[0];
    if (sEl) sEl.textContent = meta[1];
  }
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
  if (chatPanel && !chatPanel.classList.contains("hidden")) chatPanel.classList.add("hidden");

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
  if (view === "allcases")  { currentAllCasesPage = 1; renderAllCases(); }
  if (view === "myprofile") renderMyProfile();
  if (view === "calendar")  renderCalendarView();
  if (view === "notifications") renderNotificationsView();
  if (view === "mydrive") initDriveExplorer();
}

window.quickFilterCases = function(status) {
  navTo("allcases");
  if (typeof setAllCasesStatusTab === "function") setAllCasesStatusTab(status);
};

window.showView = showView;
window.navTo = navTo;
window.executeNavigation = executeNavigation;
// ═══════════════════════════════════════════════════════════════
//  SIMANDO LAW — UI CONTROLLER (PART 2 OF 2)
// ═══════════════════════════════════════════════════════════════

// ── DASHBOARD & COMPACT ACTIVE CASES (5 PER PAGE) ────────────
let currentDashPage = 1;
let dashCasesFilter = "all";
const dashPageSize = 5;

window.changeDashPage = function(delta) {
  currentDashPage += delta;
  renderDashboard();
};

window.setDashCasesFilter = function(kind) {
  dashCasesFilter = kind;
  currentDashPage = 1;
  renderDashboard();
};

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
  const pageInfoEl = document.getElementById("dash-page-info");
  const pageNumEl = document.getElementById("dash-page-num");
  const prevBtn = document.getElementById("dash-btn-prev");
  const nextBtn = document.getElementById("dash-btn-next");

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

  if (pageInfoEl) pageInfoEl.textContent = total === 0 ? "Showing 0 cases" : `Showing ${startIdx + 1}–${Math.min(startIdx + dashPageSize, total)} of ${total}`;
  if (pageNumEl) pageNumEl.textContent = `Page ${currentDashPage} of ${totalPages}`;
  if (prevBtn) prevBtn.disabled = currentDashPage <= 1;
  if (nextBtn) nextBtn.disabled = currentDashPage >= totalPages;

  renderDashProfiles();
  renderQuickAccess();
  if (typeof renderDashboardCalendarAgenda === "function") renderDashboardCalendarAgenda();
  if (typeof checkOnboardingSecurityStatus === "function") checkOnboardingSecurityStatus();
}
window.renderDashboard = renderDashboard;

function renderDashProfiles() {
  const el = document.getElementById("dash-profiles");
  if (!el) return;
  const countBadge = document.getElementById("dash-roster-count-badge");
  const searchInp = document.getElementById("dash-profile-search");
  const q = (searchInp?.value || "").toLowerCase().trim();
  const u = window._currentUser || window._auth?.currentUser;
  const userEmail = (u?.email || "").toLowerCase();
  const myProf = u ? profiles.find(p => (p.ownerUid && p.ownerUid === u.uid) || (p.email && p.email.toLowerCase() === userEmail)) : null;
  const isDeveloper = myProf && myProf.role === "developer";

  let visible = isDeveloper ? profiles.filter(p => p.role === "developer") : profiles.filter(p => p.role !== "developer");
  if (q) visible = visible.filter(p => (p.name || "").toLowerCase().includes(q) || (p.role || "").toLowerCase().includes(q));
  if (countBadge) countBadge.textContent = isDeveloper ? `${visible.length} Sandbox Dev` : `${visible.length} Counsel`;

  if (visible.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:24px 10px;color:var(--text-muted);font-size:12px">No attorneys found.</div>`;
    return;
  }
  const userCases = getAccessibleCases();
  el.innerHTML = visible.map(p => {
    const caseCount = userCases.filter(c => c.profileId === p.id).length;
    const isMe = p.ownerUid === u?.uid || (p.email && p.email.toLowerCase() === userEmail);
    return `
      <div class="dash-roster-item" onclick="openProfile('${p.id}')">
        ${avatarDiv(p.name, p.avatarColor, 32, p.photoUrl)}
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:12.5px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(p.name)} ${isMe ? '<span style="font-size:9px;color:var(--gold)">YOU</span>' : ''}</div>
          <div style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(p.role || 'Attorney')}</div>
        </div>
        <span class="badge" style="background:var(--surface3);color:var(--text-dim);font-size:10px">${caseCount} case${caseCount !== 1 ? 's' : ''}</span>
      </div>`;
  }).join("");
}
window.renderDashProfiles = renderDashProfiles;

// ── PROFILES VIEW MODES & DIRECTORY ──────────────────────────
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
  const visibleProfiles = isDeveloper ? profiles.filter(p => p.role === "developer") : profiles.filter(p => p.role !== "developer");

  const countEl = document.getElementById("profiles-count");
  if (countEl) countEl.textContent = isDeveloper ? `${visibleProfiles.length} developer profile(s)` : `${visibleProfiles.length} attorney${visibleProfiles.length !== 1 ? "s" : ""}`;

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
      const ongoing = pc.filter(c => c.status === "On-going").length;
      const isMe = p.ownerUid === u.uid || (p.email && p.email.toLowerCase() === userEmail);
      return `
        <div class="profile-list-row" onclick="openProfile('${p.id}')" style="${isMe ? 'border-color:var(--gold-border)' : ''}">
          <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:0">
            ${avatarDiv(p.name, p.avatarColor, 38, p.photoUrl)}
            <div style="min-width:0">
              <div style="font-weight:700;font-size:14.5px;color:var(--text)">${escHtml(p.name)} ${isMe ? '<span style="font-size:9.5px;color:var(--gold);background:var(--gold-dim);padding:1px 5px;border-radius:4px;margin-left:6px">YOU</span>' : ""}</div>
              <div style="font-size:12px;color:var(--text-muted)">${escHtml(p.role || "Attorney")} · ${escHtml(p.email || "No email")}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;flex-shrink:0">
            <span style="font-size:12px;color:var(--text-dim)">${pc.length} case${pc.length !== 1 ? 's' : ''}</span>
            ${ongoing > 0 ? badge(ongoing + " active", statusColor("On-going")) : ""}
            <span style="font-size:14px;color:var(--gold)"><i class="bi bi-arrow-right"></i></span>
          </div>
        </div>`;
    }).join("");
  } else {
    el.style.display = "grid"; el.style.gridTemplateColumns = "repeat(auto-fill, minmax(280px, 1fr))"; el.style.gap = "18px";
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
              <div style="font-size:13px;color:var(--text-muted)">${escHtml(p.role || "Attorney")}</div>
            </div>
          </div>
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

// ── CASE SHARING SYSTEM ──────────────────────────────────────
window.openShareCaseModal = function() {
  if (!selCase) return;
  const listEl = document.getElementById("share-modal-list");
  if (!listEl) return;
  const sharedUids = selCase.sharedWith || [];
  const currentUid = window._currentUser?.uid || window._auth?.currentUser?.uid;
  const userEmail = (window._currentUser?.email || window._auth?.currentUser?.email || "").toLowerCase();
  const myProf = profiles.find(p => (p.ownerUid && p.ownerUid === currentUid) || (p.email && p.email.toLowerCase() === userEmail));
  const isDeveloper = myProf && myProf.role === "developer";
  const associates = isDeveloper
    ? profiles.filter(p => p.ownerUid && p.ownerUid !== currentUid && p.role === "developer")
    : profiles.filter(p => p.ownerUid && p.ownerUid !== currentUid && p.role !== "developer");

  listEl.innerHTML = associates.length === 0
    ? `<div style="text-align:center;color:var(--text-dim);font-size:13px;padding:12px">No other attorneys available for sharing.</div>`
    : associates.map(p => `
      <label style="display:flex;align-items:center;gap:12px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px 14px;cursor:pointer;margin:0">
        <input type="checkbox" name="share-associate-checkbox" value="${p.ownerUid}" ${sharedUids.includes(p.ownerUid) ? "checked" : ""} style="accent-color:var(--gold);width:16px;height:16px;margin:0"/>
        ${avatarDiv(p.name, p.avatarColor, 28, p.photoUrl)}
        <div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--text)">${escHtml(p.name)}</div><div style="font-size:11px;color:var(--text-muted)">${escHtml(p.email)}</div></div>
      </label>`).join("");

  const modal = document.getElementById("share-modal");
  if (modal) modal.classList.remove("hidden");
};
window.closeShareModal = function() { const m = document.getElementById("share-modal"); if (m) m.classList.add("hidden"); };

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
    console.error("saveShareSettings error:", err);
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
    ? `<button class="btn btn-secondary btn-sm" onclick="navTo('myprofile')"><i class="bi bi-pencil-square"></i> Edit Profile</button><button class="btn btn-primary btn-sm" onclick="openAddCase()"><i class="bi bi-plus-circle"></i> Add Case</button>`
    : `<button class="btn btn-primary btn-sm" onclick="openAppointmentModal('${p.id}')"><i class="bi bi-calendar-plus"></i> Request Schedule</button>`;

  const headerCard = document.getElementById("profile-header-card");
  if (headerCard) {
    headerCard.innerHTML = `
      ${avatarDiv(p.name, p.avatarColor, 64, p.photoUrl)}
      <div style="flex:1">
        <div style="font-size:22px;font-weight:700;color:var(--text)">${escHtml(p.name)}</div>
        <div style="font-size:13.5px;color:var(--text-muted);margin-top:2px">${escHtml(p.role || "Attorney")}</div>
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
        ["Accessible Cases", pc.length, "var(--violet)"],
        ["Active", pc.filter(c => c.status === "On-going").length, "var(--amber)"],
        ["Resolved", pc.filter(c => c.status === "Completed").length, "var(--green)"],
        ["Documents", docs, "var(--gold)"]
      ].map(([l, n, c]) => `<div class="stat-card" style="--accent:${c};padding:16px 18px"><div class="stat-number" style="color:${c};font-size:32px">${n}</div><div class="stat-label">${l}</div></div>`).join("");
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
  let filtered = sortCasesByDue(pc.filter(c =>
    (c.title.toLowerCase().includes(q) || (c.parties || "").toLowerCase().includes(q) || (c.caseNumber || "").toLowerCase().includes(q)) &&
    (status === "All" || c.status === status) && (category === "All" || c.category === category) && (type === "All" || c.type === type)
  ), sort);

  const el = document.getElementById("profile-cases-list");
  if (!el) return;
  if (filtered.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon" style="color:var(--gold)"><i class="bi bi-search"></i></div><div>No cases match your filters.</div></div>`;
    return;
  }
  el.innerHTML = filtered.map(c => `
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

// ── ALL CASES VIEW (QUICK STATUS TABS + 10 PER PAGE) ─────────
let currentAllCasesPage = 1;
const allCasesPageSize = 10;

window.changeAllCasesPage = function(delta) { currentAllCasesPage += delta; renderAllCases(); };
window.goToAllCasesPage = function(pageNum) { currentAllCasesPage = pageNum; renderAllCases(); };

window.setAllCasesStatusTab = function(status) {
  const sel = document.getElementById("ac-status");
  if (sel) sel.value = status;
  currentAllCasesPage = 1;
  renderAllCases();
};

window.resetAllCaseFilters = function() {
  setElVal("ac-search", "");
  setElVal("ac-category", "All");
  setElVal("ac-status", "All");
  setElVal("ac-type", "All");
  setElVal("ac-sort", "asc");
  currentAllCasesPage = 1;
  renderAllCases();
};

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

  let filtered = sortCasesByDue(accessible.filter(c => {
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
  const pageInfoEl = document.getElementById("allcases-page-info");
  const buttonsWrap = document.getElementById("allcases-page-buttons");
  const prevBtn = document.getElementById("allcases-btn-prev");
  const nextBtn = document.getElementById("allcases-btn-next");
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

  if (pageInfoEl) pageInfoEl.textContent = `Showing ${startIdx + 1}–${Math.min(startIdx + allCasesPageSize, total)} of ${total} cases`;
  if (prevBtn) prevBtn.disabled = currentAllCasesPage <= 1;
  if (nextBtn) nextBtn.disabled = currentAllCasesPage >= totalPages;
  if (buttonsWrap) {
    let btnsHtml = "";
    for (let p = 1; p <= totalPages; p++) btnsHtml += `<button class="page-btn ${p === currentAllCasesPage ? 'active' : ''}" onclick="goToAllCasesPage(${p})">${p}</button>`;
    buttonsWrap.innerHTML = btnsHtml;
  }
}
window.renderAllCases = renderAllCases;

// ── CASE DETAIL ──────────────────────────────────────────────
function renderCaseDetail() {
  const c = selCase;
  if (!c) return;
  const p = profiles.find(x => x.id === c.profileId);
  setElText("cd-title", c.title);

  const currentUid = window._currentUser?.uid || window._auth?.currentUser?.uid;
  const userEmail = (window._currentUser?.email || window._auth?.currentUser?.email || "").toLowerCase();
  const isOwner = c.ownerUid === currentUid || (p && p.email && p.email.toLowerCase() === userEmail);
  const isGroupAdmin = profiles.some(pr => pr.ownerUid === currentUid && pr.role === "admin");
  const isShared = (Array.isArray(c.sharedWith) && c.sharedWith.includes(currentUid)) || (Array.isArray(c.allowedUids) && c.allowedUids.includes(currentUid));
  const canEdit = isOwner || isGroupAdmin || isShared;

  let actionButtons = "";
  if (canEdit) actionButtons += `<button class="btn btn-secondary btn-sm" onclick="openEditCase()"><i class="bi bi-pencil-square"></i> Edit Case</button>`;
  if (isOwner || isGroupAdmin) actionButtons += `<button class="btn btn-secondary btn-sm" onclick="openShareCaseModal()"><i class="bi bi-people"></i> Share</button><button class="btn btn-danger btn-sm" onclick="confirmDeleteCase()"><i class="bi bi-trash3"></i> Delete</button>`;
  if (isShared && !isOwner && !isGroupAdmin) actionButtons += `<span class="badge" style="background:var(--green-bg);color:var(--green);padding:6px 12px"><i class="bi bi-shield-check"></i> Shared Associate</span>`;

  const wrapEl = document.getElementById("cd-action-buttons-wrap");
  if (wrapEl) wrapEl.innerHTML = actionButtons;

  const chip = document.getElementById("cd-profile-chip");
  if (chip) {
    if (p) {
      chip.innerHTML = `${avatarDiv(p.name, p.avatarColor, 28, p.photoUrl)}<div><div style="font-size:14px;font-weight:600;color:var(--text)">${escHtml(p.name)}</div><div style="font-size:12px;color:var(--text-muted)">${escHtml(p.role || "Attorney")}</div></div><span style="font-size:12px;color:var(--text-dim);margin-left:8px"><i class="bi bi-arrow-right"></i> view profile</span>`;
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
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const sortedHearings = [...hearingsList].sort((a, b) => new Date(a.date) - new Date(b.date));
    const sortedDeadlines = [...deadlinesList].sort((a, b) => new Date(a.date) - new Date(b.date));

    let hHtml = `<div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:12px"><i class="bi bi-calendar-event" style="color:var(--gold)"></i> Schedule &amp; Timelines</div>`;
    hHtml += `<div style="font-size:11px;text-transform:uppercase;color:var(--text-dim);font-weight:700;margin-bottom:6px"><i class="bi bi-bank" style="color:var(--green)"></i> Court Hearings (${sortedHearings.length})</div>`;
    hHtml += sortedHearings.length === 0 ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">No court appearances on record.</div>`
      : `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">` + sortedHearings.map(h => {
        const isPast = h.date < todayStr;
        return `<div style="padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-left:4px solid ${isPast ? 'var(--text-dim)' : 'var(--green)'};border-radius:8px"><div style="font-weight:700;font-size:12.5px;color:var(--text)">${formatDate(h.date)} ${h.time ? '· ' + h.time : ''}</div><div style="font-size:12px;font-weight:600;color:var(--gold-light)">${escHtml(h.purpose)}</div>${h.notes ? `<div style="font-size:11.5px;color:var(--text-dim);font-style:italic">"${escHtml(h.notes)}"</div>` : ''}</div>`;
      }).join("") + `</div>`;

    const hasLegacyDue = Boolean(c.docDueDate) && !sortedDeadlines.some(d => d.date === c.docDueDate);
    const totalDeadlinesCount = sortedDeadlines.length + (hasLegacyDue ? 1 : 0);
    hHtml += `<div style="font-size:11px;text-transform:uppercase;color:var(--text-dim);font-weight:700;margin-bottom:6px"><i class="bi bi-file-earmark-text-fill" style="color:var(--gold)"></i> Document Deadlines (${totalDeadlinesCount})</div>`;
    if (totalDeadlinesCount === 0) hHtml += `<div style="font-size:12px;color:var(--text-muted)">No filing deadlines logged.</div>`;
    else {
      hHtml += `<div style="display:flex;flex-direction:column;gap:8px">`;
      if (hasLegacyDue) hHtml += `<div style="padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-left:4px solid var(--gold);border-radius:8px"><div style="font-weight:700;font-size:12.5px">${formatDate(c.docDueDate)}</div><div style="font-size:12px;color:var(--gold-light)">${escHtml(c.docType || 'Formal Pleading')}</div></div>`;
      sortedDeadlines.forEach(d => { hHtml += `<div style="padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-left:4px solid var(--gold);border-radius:8px"><div style="font-weight:700;font-size:12.5px">${formatDate(d.date)}</div><div style="font-size:12px;color:var(--gold-light)">${escHtml(d.subtype || d.title || 'Pleading')}</div>${d.notes ? `<div style="font-size:11.5px;color:var(--text-dim);font-style:italic">"${escHtml(d.notes)}"</div>` : ''}</div>`; });
      hHtml += `</div>`;
    }
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

// ── SIDEBAR CHIP, QUICK ACCESS & HELPERS ─────────────────────
function renderQuickAccess() {
  const qa = document.getElementById("quick-access");
  const ql = document.getElementById("quick-list");
  if (!qa || !ql) return;
  const u = window._currentUser || window._auth?.currentUser;
  const userEmail = (u?.email || "").toLowerCase();
  const myProf = u ? profiles.find(p => (p.ownerUid && p.ownerUid === u.uid) || (p.email && p.email.toLowerCase() === userEmail)) : null;
  const visible = (myProf && myProf.role === "developer") ? profiles.filter(p => p.role === "developer") : profiles.filter(p => p.role !== "developer");
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
  if (!chip) return;
  const u = window._currentUser || window._auth?.currentUser;
  if (!u) { chip.style.display = "none"; if (adminSection) adminSection.style.display = "none"; return; }

  const userEmail = (u.email || "").toLowerCase();
  const myProf = profiles.find(p => (p.ownerUid && p.ownerUid === u.uid) || (p.email && p.email.toLowerCase() === userEmail));
  const displayName = myProf?.name || u.displayName || u.email?.split("@")[0] || "Counsel";
  const displayRole = myProf?.role || "Attorney";

  chip.innerHTML = `
    ${avatarDiv(displayName, myProf?.avatarColor || "#c9a84c", 30, myProf?.photoUrl || u.photoURL || null)}
    <div class="user-meta" style="min-width:0;flex:1">
      <div style="font-size:12px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(displayName)}</div>
      <div style="font-size:10px;color:var(--gold);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(displayRole)}</div>
    </div>`;
  chip.style.display = "flex";
  chip.setAttribute("data-tooltip", `${displayName} · My Settings`);

  const isAdmin = (myProf && myProf.role === "admin") || (typeof ADMIN_EMAILS !== "undefined" && ADMIN_EMAILS.some(e => e.toLowerCase() === userEmail));
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

// ── PERSONAL SETTINGS ────────────────────────────────────────
let settingsPhotoDataUrl = null;

function renderMyProfile() {
  const u = window._currentUser || window._auth?.currentUser;
  if (!u) return;
  const userEmail = (u.email || "").toLowerCase();
  const myProf = profiles.find(p => (p.ownerUid && p.ownerUid === u.uid) || (p.email && p.email.toLowerCase() === userEmail));
  if (!myProf) return;

  setElVal("setting-name", myProf.name || "");
  setElVal("setting-role", myProf.role || "Attorney");
  setElVal("setting-contact", myProf.contact || "");
  setElVal("setting-email", u.email || "");
  setElVal("setting-password", "");
  setElVal("setting-current-password", "");
  const reauthEl = document.getElementById("setting-reauth-panel");
  if (reauthEl) reauthEl.style.display = "none";

  settingsPhotoDataUrl = myProf.photoUrl || null;
  if (settingsPhotoDataUrl) showSettingsPhotoPreview(settingsPhotoDataUrl, myProf.name, myProf.role);
  else resetSettingsPhotoUpload();

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
      btnText.textContent = "Connect Google Drive"; btn.classList.remove("connected"); btn.disabled = false;
      if (disconnectBtn) disconnectBtn.classList.add("hidden");
    }
  }

  const tfaBadge = document.getElementById("setting-2fa-status-badge");
  const tfaBtn = document.getElementById("setting-2fa-action-btn");
  const tfaBackupWrap = document.getElementById("setting-2fa-backup-wrap");
  if (tfaBadge && tfaBtn) {
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
window.renderMyProfile = renderMyProfile;

async function connectDriveFromSettings() {
  const btn = document.getElementById("settings-connect-drive-btn");
  const btnText = document.getElementById("settings-connect-drive-text");
  if (!btn) return;
  btn.disabled = true; if (btnText) btnText.textContent = "Connecting...";
  try {
    await promptDriveAuth(true);
    showToast("Google Drive connected successfully!");
    renderMyProfile(); updateWorkspaceStatus(false);
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
    if (btnText) btnText.textContent = "Connect Google Drive";
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
  setElText("setting-role-preview", role || "Role");
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
  const role = (document.getElementById("setting-role")?.value || "").trim();
  const contact = (document.getElementById("setting-contact")?.value || "").trim();
  if (!name || !role) { showToast("Display Name and Role are required.", "error"); return; }
  if (contact && !isValidMobile(contact)) { showToast("Contact number must be exactly 11 digits.", "error"); return; }
  const upd = { name, role, contact };
  try {
    showToast("Saving settings...");
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
    showToast("Failed to save settings: " + err.message, "error");
  }
}

async function saveSecuritySettings() {
  const u = window._currentUser || window._auth?.currentUser;
  if (!u) return;
  const email = (document.getElementById("setting-email")?.value || "").trim();
  const pass = document.getElementById("setting-password")?.value || "";
  const currentPass = document.getElementById("setting-current-password")?.value || "";
  if (email === u.email && !pass) { showToast("No security modifications requested."); return; }
  if (email && !isValidEmail(email)) { showToast("Email must be @gmail.com, @outlook.com, or @yahoo.com.", "error"); return; }
  if (pass && pass.length < 6) { showToast("Password must be at least 6 characters.", "error"); return; }

  const reauthPanel = document.getElementById("setting-reauth-panel");
  if (reauthPanel && reauthPanel.style.display === "none") {
    reauthPanel.style.display = "block";
    showToast("Enter your current password to verify identity.", "error");
    return;
  }
  if (!currentPass) { showToast("Please enter your current password to proceed.", "error"); return; }
  try {
    showToast("Verifying credentials...");
    await window._fbReauth(u, window._fbEmailCred(u.email, currentPass));
    if (email !== u.email) {
      await window._fbUpdateEmail(u, email);
      const myProf = profiles.find(p => p.ownerUid === u.uid);
      if (myProf) await dbUpdateProfile(myProf.id, { email });
    }
    if (pass) await window._fbUpdatePassword(u, pass);
    showToast("Credentials updated successfully!");
    if (reauthPanel) reauthPanel.style.display = "none";
  } catch (err) {
    showToast("Verification failed: " + err.message, "error");
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
  } catch (err) { console.error("Signout error:", err); }
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
  const match = isoString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!match) {
    const d = new Date(isoString);
    return { dateStr: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), timeStr: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }), dateObj: d, isAllDay: false };
  }
  const dateObj = new Date(+match[1], +match[2] - 1, +match[3], +match[4], +match[5]);
  const hh = +match[4];
  return { dateStr: dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), timeStr: `${hh % 12 || 12}:${match[5]} ${hh >= 12 ? "PM" : "AM"}`, dateObj, isAllDay: false };
}

window.openCalendarEventModal = function(index) {
  const ev = window._fetchedCalendarEvents?.[index];
  if (!ev) return;
  const modal = document.getElementById("calendar-event-modal");
  if (!modal) return;
  const parsedStart = parseGoogleDateTime(ev.start.dateTime || ev.start.date);
  const parsedEnd = parseGoogleDateTime(ev.end?.dateTime || ev.end?.date);
  let timeString = parsedStart.dateStr + (parsedStart.isAllDay ? " (All Day)" : ` · ${parsedStart.timeStr}`);
  if (!parsedStart.isAllDay && ev.end && !parsedEnd.isAllDay) timeString += ` - ${parsedEnd.timeStr}`;

  document.getElementById("cem-title").innerHTML = `<i class="bi bi-calendar-event" style="color:var(--gold);margin-right:6px"></i> ${escHtml(ev.summary || "No Title")}`;
  document.getElementById("cem-time").textContent = timeString;
  document.getElementById("cem-location").textContent = ev.location || "No venue specified";
  document.getElementById("cem-desc").textContent = ev.description || "No description provided.";
  const linkEl = document.getElementById("cem-link");
  if (linkEl) { linkEl.href = ev.htmlLink || "#"; linkEl.style.display = ev.htmlLink ? "inline-flex" : "none"; }
  modal.classList.remove("hidden");
};
window.closeCalendarModal = function() { const m = document.getElementById("calendar-event-modal"); if (m) m.classList.add("hidden"); };

// ── COMPACT DASHBOARD SCHEDULE (5 PER PAGE, ALIGNED HEIGHT) ──
let activeDashboardAgendaFilter = "all";
let dashSchedulePage = 1;
const dashSchedulePageSize = 5;

window.filterDashboardAgenda = function(type) {
  activeDashboardAgendaFilter = type;
  dashSchedulePage = 1;
  renderDashboardCalendarAgenda();
};
window.changeDashSchedulePage = function(delta) {
  dashSchedulePage += delta;
  renderDashboardCalendarAgenda();
};

async function renderDashboardCalendarAgenda() {
  const card = document.getElementById("dash-calendar-card");
  if (!card) return;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const accessibleCases = typeof getAccessibleCases === "function" ? getAccessibleCases() : (cases || []);
  const acceptedAppts = (appointments || []).filter(a => a.status === "accepted" && a.date >= todayStr);
  const agendaItems = [];

  accessibleCases.forEach(c => {
    const hearings = Array.isArray(c.hearings) ? c.hearings : [];
    hearings.forEach(h => {
      if (h.date && h.date >= todayStr) agendaItems.push({ id: c.id, type: "hearing", date: h.date, time: h.time || "08:30 AM", title: h.purpose || "Court Hearing", sub: `${c.title} · ${c.venue || "Courtroom"}`, isCase: true, caseId: c.id });
    });
    if (c.dueDate && c.dueDate >= todayStr && !hearings.some(h => h.date === c.dueDate)) {
      agendaItems.push({ id: c.id, type: "hearing", date: c.dueDate, time: "08:30 AM", title: "Scheduled Court Appearance", sub: `${c.title} · ${c.venue || "Courtroom"}`, isCase: true, caseId: c.id });
    }
    const deadlines = Array.isArray(c.deadlines) ? c.deadlines : [];
    deadlines.forEach(d => {
      if (d.date && d.date >= todayStr) agendaItems.push({ id: c.id, type: "deadline", date: d.date, time: "Filing Deadline", title: d.subtype || d.title || "Formal Pleading", sub: c.title, isCase: true, caseId: c.id });
    });
    if (c.docDueDate && c.docDueDate >= todayStr && !deadlines.some(d => d.date === c.docDueDate)) {
      agendaItems.push({ id: c.id, type: "deadline", date: c.docDueDate, time: "Filing Deadline", title: c.docType || "Pleading Due", sub: c.title, isCase: true, caseId: c.id });
    }
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
            <div style="font-size:10.5px;font-weight:700;color:${labelColor};line-height:1.2">${kindLabel}</div>
            <div style="font-size:12.5px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.25">${escHtml(item.title)}</div>
            <div style="font-size:11px;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2">${escHtml(item.sub)}</div>
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
    <div class="pager-bar pagination-bar">
      <span>Showing ${total ? startIdx + 1 : 0}–${endIdx} of ${total}</span>
      ${totalPages > 1 ? `
        <div class="pager-controls pagination-controls">
          <button class="page-btn" onclick="changeDashSchedulePage(-1)" ${dashSchedulePage <= 1 ? 'disabled' : ''}><i class="bi bi-chevron-left"></i></button>
          <span style="padding:0 6px;font-weight:600;color:var(--text)">Page ${dashSchedulePage} of ${totalPages}</span>
          <button class="page-btn" onclick="changeDashSchedulePage(1)" ${dashSchedulePage >= totalPages ? 'disabled' : ''}><i class="bi bi-chevron-right"></i></button>
        </div>` : `<span>All items shown</span>`}
    </div>`;
}
window.renderDashboardCalendarAgenda = renderDashboardCalendarAgenda;
window.fetchAndRenderGoogleCalendarEvents = renderDashboardCalendarAgenda;

// ── NOTIFICATIONS CENTER ─────────────────────────────────────
let currentNotifFilter = "all";
window.filterNotifications = function(cat) { currentNotifFilter = cat; renderNotificationsView(); };

window.toggleNotifDropdown = function() {
  const dropdown = document.getElementById("notif-dropdown");
  if (!dropdown) return;
  const willOpen = dropdown.classList.contains("hidden");
  dropdown.classList.toggle("hidden");
  if (willOpen) {
    const chatPanel = document.getElementById("chat-panel");
    if (chatPanel && !chatPanel.classList.contains("hidden")) chatPanel.classList.add("hidden");
    renderNotificationsView();
  }
};

document.addEventListener("click", (e) => {
  const container = document.getElementById("top-hdr-actions");
  const dropdown = document.getElementById("notif-dropdown");
  if (container && dropdown && !container.contains(e.target)) dropdown.classList.add("hidden");
});

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
  const dropdown = document.getElementById("notif-dropdown");
  if (dropdown) dropdown.classList.add("hidden");
  if ((type === "case_due" || type === "case_share") && relatedId) openCase(relatedId);
  else if (type === "appointment_request") {
    const notif = notifications.find(n => n.id === notifId);
    window.openProposalReviewModal(notif?.caseId || relatedId, notif?.relatedId || relatedId, notifId, false, "");
  } else if ((type === "availability_request" || type === "availability_confirmed") && window._chat) {
    if (typeof window._chat.toggleDock === "function") window._chat.toggleDock();
    if (fromUid && typeof window._chat.openConversation === "function") window._chat.openConversation(fromUid, fromName || "Attorney", false);
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

  if (filtered.length === 0) {
    listEl.innerHTML = tabsHtml + `<div class="empty-state" style="padding:20px"><div style="font-size:12px">No notifications found.</div></div>`;
    return;
  }

  listEl.innerHTML = tabsHtml + filtered.map(n => {
    const isUnread = n.status === "unread";
    const borderAccent = n.severity === "critical" ? "var(--red)" : (n.severity === "warning" ? "var(--amber)" : (isUnread ? "var(--gold)" : "var(--border)"));
    return `
      <div class="doc-item" onclick="handleNotifClick('${n.id}','${n.type}','${n.relatedId}','${n.fromUid}','${escHtml(n.fromName)}')" style="border-left:3.5px solid ${borderAccent};cursor:pointer;padding:10px 12px;font-size:12px">
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;color:var(--text)">${escHtml(n.title)}</div>
          <div style="font-size:11.5px;color:var(--text-muted)">${escHtml(n.message)}</div>
        </div>
        ${isUnread ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();markNotificationRead('${n.id}')">Read</button>` : ""}
      </div>`;
  }).join("");
}
window.renderNotificationsView = renderNotificationsView;

window.markNotificationRead = async function(id) {
  const notif = notifications.find(n => n.id === id);
  if (notif) { notif.status = "read"; updateNotificationBadge(); renderNotificationsView(); }
  await dbUpdateNotification(id, { status: "read" }).catch(() => {});
};
window.markAllNotificationsAsRead = async function() {
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
      if (snap && snap.exists()) targetCase = typeof decryptCaseRecordFromFirestore === "function" ? await decryptCaseRecordFromFirestore({ id: snap.id, ...snap.data() }) : { id: snap.id, ...snap.data() };
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
window.closeProposalReviewModal = function() { const m = document.getElementById("proposal-review-modal"); if (m) m.classList.add("hidden"); };

window.acceptProposalFromDossier = async function() {
  const { caseId, apptId, notifId, msgId, isGroup, channelId } = currentDossierContext;
  if (apptId && typeof dbUpdateAppointment === "function") await dbUpdateAppointment(apptId, { status: "accepted" }).catch(() => {});
  if (notifId && typeof dbUpdateNotification === "function") await dbUpdateNotification(notifId, { appointmentStatus: "accepted", status: "read" }).catch(() => {});
  if (window._chat && msgId) await window._chat.respondAvailCard(msgId, isGroup, channelId, "accepted");
  closeProposalReviewModal();
  renderAllCases(); renderDashboard();
};
window.declineProposalFromDossier = async function() {
  const { apptId, notifId, msgId, isGroup, channelId } = currentDossierContext;
  if (apptId && typeof dbUpdateAppointment === "function") await dbUpdateAppointment(apptId, { status: "declined" }).catch(() => {});
  if (notifId && typeof dbUpdateNotification === "function") await dbUpdateNotification(notifId, { appointmentStatus: "declined", status: "read" }).catch(() => {});
  if (window._chat && msgId) await window._chat.respondAvailCard(msgId, isGroup, channelId, "declined");
  closeProposalReviewModal();
};
window.promptCancelAppearanceFromDossier = function() { closeProposalReviewModal(); };

let targetApptProfile = null, apptAmPm = "AM", apptPurposeType = "present_hearing";
window.openAppointmentModal = function(profileId) {
  const p = profiles.find(x => x.id === profileId || x.ownerUid === profileId) || selProfile;
  if (!p) return;
  targetApptProfile = p;
  const avEl = document.getElementById("appt-recipient-avatar");
  if (avEl) avEl.innerHTML = avatarDiv(p.name, p.avatarColor, 36, p.photoUrl);
  setElText("appt-recipient-name", p.name);
  setElText("appt-recipient-role", p.role || "Associate Counsel");
  const caseSel = document.getElementById("appt-case-select");
  if (caseSel) {
    const accessible = getAccessibleCases();
    caseSel.innerHTML = `<option value="">— Select an active docket file (${accessible.length}) —</option>` + accessible.map(c => `<option value="${c.id}">${escHtml(c.title)}</option>`).join("");
  }
  document.getElementById("appointment-modal")?.classList.remove("hidden");
};
window.closeAppointmentModal = function() { document.getElementById("appointment-modal")?.classList.add("hidden"); targetApptProfile = null; };
window.setApptPurpose = function(btn, type) { apptPurposeType = type; document.querySelectorAll("#appt-purpose-chips button").forEach(b => b.classList.remove("active")); btn.classList.add("active"); };
window.onApptCaseSelectChange = function(caseId) { const c = getAccessibleCases().find(x => x.id === caseId); if (c) setElVal("appt-venue", c.venue || ""); };
window.onApptHearingStageSync = function() {};
window.setApptAmPm = function(val) { apptAmPm = val; };
window.submitAppointmentRequest = async function() {
  const date = document.getElementById("appt-date")?.value;
  const time = document.getElementById("appt-custom-time")?.value || "08:30";
  if (!date) { showToast("Please pick a date.", "error"); return; }
  const u = window._currentUser || window._auth?.currentUser;
  if (!u || !targetApptProfile) return;
  await dbAddAppointment({ title: "Case Appearance Request", date, time: `${time} ${apptAmPm}`, venue: document.getElementById("appt-venue")?.value || "", description: document.getElementById("appt-desc")?.value || "", requesterUid: u.uid, targetUid: targetApptProfile.ownerUid || targetApptProfile.id, ownerUid: u.uid, status: "pending" });
  showToast("Schedule proposal sent!");
  closeAppointmentModal();
};
window.acceptAppointmentRequest = async function(notifId, apptId) { await dbUpdateAppointment(apptId, { status: "accepted" }); await dbUpdateNotification(notifId, { appointmentStatus: "accepted", status: "read" }); renderNotificationsView(); };
window.declineAppointmentRequest = async function(notifId, apptId) { await dbUpdateAppointment(apptId, { status: "declined" }); await dbUpdateNotification(notifId, { appointmentStatus: "declined", status: "read" }); renderNotificationsView(); };

// ── CASE FORM SELECTS & DRIVE EXPLORER ───────────────────────
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
    listEl.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)"><div style="font-size:28px;color:var(--gold)"><i class="bi bi-cloud-slash"></i></div><div style="font-size:13px;font-weight:600;margin-top:6px">Google Drive Not Connected</div><div style="font-size:11.5px;margin-top:4px">Connect Google Drive in My Settings to browse case files.</div></div>`;
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
      const icon = isFolder ? `<i class="bi bi-folder-fill" style="color:var(--gold);font-size:32px"></i>` : `<i class="bi bi-file-earmark-text-fill" style="color:var(--gold);font-size:32px"></i>`;
      const action = isFolder ? `onclick="navigateIntoFolder('${f.id}','${f.name.replace(/'/g,"\\'")}')"` : `onclick="window.open('${f.webViewLink}','_blank')"`;
      return `<div style="position:relative;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:16px 10px;text-align:center;cursor:pointer"><div ${action}><div style="margin-bottom:8px">${icon}</div><div style="font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(f.name)}</div></div><button onclick="event.stopPropagation();adminDeleteDriveExplorerFile('${f.id}','${f.name.replace(/'/g,"\\'")}')" style="position:absolute;top:6px;right:6px;color:var(--red);font-size:13px"><i class="bi bi-trash3"></i></button></div>`;
    }).join("");
  } catch (err) {
    listEl.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--text-muted)">Click Open Google Drive above to view files directly.</div>`;
  }
};

window.adminDeleteDriveExplorerFile = function(fileId, fileName) {
  window.openConfirmModal({ icon: "bi-trash3", title: "Delete from Firm Drive?", body: `Delete <strong>"${escHtml(fileName)}"</strong> from Google Drive?`, confirmText: "Delete", confirmStyle: "btn-danger", onConfirm: async () => { await deleteDriveFile(fileId); loadExplorerFiles(); } });
};
window.navigateIntoFolder = function(id, name) { explorerBreadcrumbs.push({ id, name }); currentExplorerFolderId = id; loadExplorerFiles(); };
window.navigateBreadcrumb = function(index) { explorerBreadcrumbs = explorerBreadcrumbs.slice(0, index + 1); currentExplorerFolderId = explorerBreadcrumbs[index].id; loadExplorerFiles(); };
function renderExplorerBreadcrumbs() {
  const el = document.getElementById("mydrive-breadcrumbs");
  if (!el) return;
  el.innerHTML = explorerBreadcrumbs.map((b, i) => i === explorerBreadcrumbs.length - 1 ? `<span style="color:var(--gold)"><i class="bi bi-folder-fill"></i> ${escHtml(b.name)}</span>` : `<span onclick="navigateBreadcrumb(${i})" style="cursor:pointer;text-decoration:underline">${escHtml(b.name)}</span> / `).join("");
}
window.openMyDriveFolder = function() {
  const u = window._currentUser || window._auth?.currentUser;
  const myProf = u ? profiles.find(p => (p.ownerUid && p.ownerUid === u.uid) || (p.email && p.email.toLowerCase() === (u.email || "").toLowerCase())) : null;
  if (myProf?.driveFolderId) window.open(`https://drive.google.com/drive/folders/${myProf.driveFolderId}`, "_blank");
  else showToast("No Drive folder linked yet.", "error");
};

window.openFilePreview = function(doc) {
  if (!doc) return;
  if (doc.driveLink) { window.open(doc.driveLink, "_blank"); return; }
  if (doc._localTempId && typeof pendingLocalFiles !== "undefined" && pendingLocalFiles[doc._localTempId]) {
    window.open(URL.createObjectURL(pendingLocalFiles[doc._localTempId]), "_blank");
    return;
  }
  showToast("File link not found.", "error");
};
window.closeFilePreview = function() { const m = document.getElementById("file-preview-modal"); if (m) m.style.display = "none"; };

window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (typeof renderSidebarUser === "function") renderSidebarUser();
    if (typeof checkOnboardingSecurityStatus === "function") checkOnboardingSecurityStatus();
  }, 300);
});
