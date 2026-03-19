(function () {
  function collapseListSidebarByDefault() {
    try {
      localStorage.show_sidebar = "false";
    } catch (e) {}

    if (document.body) {
      document.body.classList.add("no-list-sidebar");
    }

    document.querySelectorAll(".page-container .layout-side-section").forEach((el) => {
      if (el instanceof HTMLElement) {
        el.style.display = "";
      }
    });

    const page = window.frappe && frappe.container && frappe.container.page;
    if (page && typeof page.update_sidebar_icon === "function") {
      try {
        page.update_sidebar_icon();
      } catch (e) {}
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", collapseListSidebarByDefault, { once: true });
  } else {
    collapseListSidebarByDefault();
  }

  // Keep the default collapsed state when navigating between Desk pages.
  let routeHooked = false;
  const attachRouteHandler = () => {
    if (routeHooked || !(window.frappe && frappe.router && typeof frappe.router.on === "function")) {
      return false;
    }
    routeHooked = true;
    frappe.router.on("change", () => {
      setTimeout(collapseListSidebarByDefault, 0);
    });
    return true;
  };

  if (!attachRouteHandler()) {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (attachRouteHandler() || attempts > 50) {
        clearInterval(timer);
      }
    }, 200);
  }
})();
