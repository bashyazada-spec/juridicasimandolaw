// ═══════════════════════════════════════════════════════════════
//  SIDEBAR TOGGLE — burger menu, collapsible sidebar
// ═══════════════════════════════════════════════════════════════
(function () {
  var MOBILE_QUERY = "(max-width: 900px)";

  function isMobile() {
    return window.matchMedia(MOBILE_QUERY).matches;
  }

  function applyState(collapsed) {
    var app = document.getElementById("app");
    if (!app) return;
    app.classList.toggle("sidebar-collapsed", collapsed);
    var btn = document.getElementById("sidebar-toggle");
    if (btn) btn.setAttribute("aria-expanded", String(!collapsed));
  }

  window.toggleSidebar = function () {
    var app = document.getElementById("app");
    if (!app) return;
    var collapsed = !app.classList.contains("sidebar-collapsed");
    applyState(collapsed);
    if (!isMobile()) {
      localStorage.setItem("simando-sidebar", collapsed ? "closed" : "open");
    }
  };

  window.closeSidebarOnMobile = function () {
    if (isMobile()) applyState(true);
  };

  function initSidebar() {
    var app = document.getElementById("app");
    if (!app) return;

    if (isMobile()) {
      applyState(true); // start closed on small screens
    } else {
      var saved = localStorage.getItem("simando-sidebar");
      applyState(saved === "closed");
    }
    app.classList.toggle("is-mobile", isMobile());

    // Close the drawer automatically after a nav click on mobile
    document.addEventListener("click", function (e) {
      if (!isMobile()) return;
      var navBtn = e.target.closest(".nav-btn");
      var backdrop = e.target.closest(".sidebar-backdrop");
      if (navBtn || backdrop) applyState(true);
    });

    window.addEventListener("resize", function () {
      var mobile = isMobile();
      app.classList.toggle("is-mobile", mobile);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSidebar);
  } else {
    initSidebar();
  }
})();
