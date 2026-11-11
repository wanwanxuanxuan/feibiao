/* Windows 13 · bootstrap */
(function () {
  "use strict";
  const W13 = window.W13;

  function start() {
    if (!W13) return;
    try {
      W13.initShell();
    } catch (err) {
      console.error("[W13] Shell init failed:", err);
    }
    try {
      W13.initWindowManager();
    } catch (err) {
      console.error("[W13] Window manager init failed:", err);
    }

    document.addEventListener("keydown", (e) => {
      if (!e.metaKey || e.ctrlKey || e.altKey) return;
      const key = String(e.key).toLowerCase();
      const map = { e: "explorer", i: "settings", r: "browser" };
      if (map[key]) {
        e.preventDefault();
        W13.openApp(map[key]);
      } else if (key === "d") {
        e.preventDefault();
        W13.minimizeAll();
      } else if (key === "l") {
        e.preventDefault();
        W13.lockScreen();
      }
    });

    window.addEventListener("error", (event) => {
      if (event && event.message) console.warn("[W13] Runtime:", event.message);
    });

    // Boot screen fallback: never leave the user staring at a frozen logo.
    setTimeout(() => {
      const boot = document.getElementById("boot-screen");
      if (boot && !boot.classList.contains("done") && W13.finishBoot) W13.finishBoot();
    }, 4200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
