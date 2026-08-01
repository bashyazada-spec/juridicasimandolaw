// ═══════════════════════════════════════════════════════════════
//  AUTOMATIC DEVICE DETECTION & REDIRECT SYSTEM
//  Directs users seamlessly to index.html, mobile.html, or tablet.html
// ═══════════════════════════════════════════════════════════════

(function autoDeviceRedirect() {
  const w = window.innerWidth;
  const ua = navigator.userAgent;
  const isTouch = navigator.maxTouchPoints > 0;
  
  // Extract current file name from URL
  let currentFile = window.location.pathname.split("/").pop().toLowerCase();
  if (!currentFile || currentFile === "") currentFile = "index.html";

  let targetFile = "index.html";

  // 1. Detect Tablet / iPad
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua) || (w >= 600 && w <= 1024 && isTouch)) {
    targetFile = "tablet.html";
  } 
  // 2. Detect Mobile Phone (iPhone / Android)
  else if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated/i.test(ua) || w < 600) {
    targetFile = "mobile.html";
  } 
  // 3. Desktop / Laptop
  else {
    targetFile = "index.html";
  }

  // Only redirect if user is NOT currently on the correct device page
  if (currentFile !== targetFile) {
    // Prevent redirect loops
    window.location.replace(targetFile);
  }
})();