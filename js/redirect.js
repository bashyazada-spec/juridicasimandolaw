// ═══════════════════════════════════════════════════════════════
//  LOOP-PROOF AUTOMATIC DEVICE ROUTER
// ═══════════════════════════════════════════════════════════════

(function autoDeviceRedirect() {
  // Extract and normalize current filename from URL path
  let path = window.location.pathname;
  let currentFile = path.substring(path.lastIndexOf('/') + 1).toLowerCase();
  
  // Normalize root URL or empty filename to "index.html"
  if (currentFile === "" || currentFile === "index" || currentFile === "index.html") {
    currentFile = "index.html";
  }

  const w = window.innerWidth;
  const ua = navigator.userAgent;
  const isTouch = navigator.maxTouchPoints > 0;

  let targetFile = "index.html";

  // 1. Detect Tablet / iPad
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua) || (w >= 600 && w <= 1024 && isTouch)) {
    targetFile = "tablet.html";
  } 
  // 2. Detect Mobile Phone (iPhone / Android)
  else if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle/i.test(ua) || w < 600) {
    targetFile = "mobile.html";
  } 
  // 3. Desktop / Laptop
  else {
    targetFile = "index.html";
  }

  // CRITICAL LOOP PROTECTION:
  // If the user is ALREADY on the target page, stop immediately and do NOT redirect!
  if (currentFile === targetFile) {
    return;
  }

  // Execute redirection only when moving to a different device file
  console.log(`[Device Router] Redirecting from ${currentFile} -> ${targetFile}`);
  window.location.replace(targetFile);
})();
