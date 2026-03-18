(function () {
  "use strict";

  const themeToggle = document.getElementById("themeToggle");
  const navbarMenu = document.getElementById("navbar-menu");
  const mobileMenuToggle = document.querySelector(".mobile-menu-toggle");
  const userMenuButton = document.querySelector(".user-menu-button");
  const userMenuDropdown = document.getElementById("user-menu-dropdown");
  const scrollToTopBtn = document.getElementById("scrollToTop");

  function closeUserMenu() {
    if (!userMenuDropdown || !userMenuButton) return;
    userMenuDropdown.hidden = true;
    userMenuButton.setAttribute("aria-expanded", "false");
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      if (isDark) {
        document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("theme", "light");
      } else {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("theme", "dark");
      }
    });
  }

  if (mobileMenuToggle && navbarMenu) {
    mobileMenuToggle.addEventListener("click", () => {
      const isOpen = navbarMenu.classList.toggle("open");
      mobileMenuToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  }

  if (userMenuButton && userMenuDropdown) {
    userMenuButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = !userMenuDropdown.hidden;
      userMenuDropdown.hidden = isOpen;
      userMenuButton.setAttribute("aria-expanded", isOpen ? "false" : "true");
    });
  }

  document.addEventListener("click", (event) => {
    if (!userMenuDropdown || !userMenuButton) return;
    if (userMenuDropdown.hidden) return;
    const target = event.target;
    if (!userMenuDropdown.contains(target) && !userMenuButton.contains(target)) {
      closeUserMenu();
    }
  });

  if (scrollToTopBtn) {
    window.addEventListener("scroll", () => {
      if (window.scrollY > 300) {
        scrollToTopBtn.hidden = false;
      } else {
        scrollToTopBtn.hidden = true;
      }
    });

    scrollToTopBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeUserMenu();
    }
  });
})();
