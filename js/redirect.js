// ═══════════════════════════════════════════════════════════════
//  SIMANDO LAW — AUTOMATIC DEVICE ROUTER (CMS & ADMIN CONSOLE)
// ═══════════════════════════════════════════════════════════════

(function autoDeviceRedirect() {
  let path = window.location.pathname;
  let currentFile = path.substring(path.lastIndexOf('/') + 1).toLowerCase();
  
  if (currentFile === "" || currentFile === "index" || currentFile === "index.html") {
    currentFile = "index.html";
  }

  const w = window.innerWidth;
  const ua = navigator.userAgent;
  const isTouch = navigator.maxTouchPoints > 0;
  const isMobile = /Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle/i.test(ua) || w < 600;
  const isTablet = (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua) || (w >= 600 && w <= 1024 && isTouch)) && !isMobile;

  let targetFile = currentFile;

  // 1. ROUTING FOR ADMIN CONSOLE
  if (currentFile === "admin.html" || currentFile === "admin-mobile.html" || currentFile === "admin") {
    if (isMobile) {
      targetFile = "admin-mobile.html";
    } else {
      targetFile = "admin.html";
    }
  }
  // 2. ROUTING FOR CASE MANAGEMENT SYSTEM (CMS)
  else if (currentFile === "index.html" || currentFile === "tablet.html" || currentFile === "mobile.html") {
    if (isTablet) {
      targetFile = "tablet.html";
    } else if (isMobile) {
      targetFile = "mobile.html";
    } else {
      targetFile = "index.html";
    }
  }

  // LOOP PROTECTION: Don't redirect if already on target file
  if (currentFile === targetFile) {
    return;
  }

  window.location.replace(targetFile);
})();
