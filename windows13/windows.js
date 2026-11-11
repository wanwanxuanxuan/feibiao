/* Windows 13 · window manager and taskbar */
(function () {
  "use strict";
  const W13 = window.W13;
  const { icon, appMark, state, escapeHTML, showToast } = W13;

  W13.apps = W13.apps || {};
  const openWindows = new Map();
  const PINNED = ["explorer", "browser", "settings", "notepad"];
  let zCounter = 2100;
  let focusedId = null;
  let openSequence = 0;

  const layer = document.getElementById("window-layer");
  const taskbarApps = document.getElementById("taskbar-apps");

  function metaFor(id) {
    return W13.APP_META[id] || { name: id, mark: "folder", icon: "apps" };
  }

  function appName(id) {
    const def = W13.apps[id];
    return (def && def.name) || metaFor(id).name;
  }

  function updateTaskbar() {
    const ids = PINNED.slice();
    openWindows.forEach((_win, id) => {
      if (ids.indexOf(id) === -1) ids.push(id);
    });
    taskbarApps.innerHTML = ids.map((id) => {
      const win = openWindows.get(id);
      const running = !!win;
      const active = running && focusedId === id && !win.classList.contains("minimized");
      const mark = appMark(id);
      return (
        '<button class="tb-app' + (running ? " running" : "") + (active ? " active" : "") + '" data-task-app="' + id + '" aria-label="' + escapeHTML(appName(id)) + '">' +
        mark +
        '<span class="tb-tooltip">' + escapeHTML(appName(id)) + "</span></button>"
      );
    }).join("");
  }

  function focusWindow(win) {
    if (!win) return;
    document.querySelectorAll(".window").forEach((node) => {
      node.classList.remove("focused");
      if (node !== win) node.classList.add("unfocused");
    });
    win.classList.remove("unfocused");
    win.classList.add("focused");
    win.style.zIndex = String(++zCounter);
    focusedId = win.dataset.app;
    updateTaskbar();
  }

  function focusNextWindow() {
    let top = null;
    let topZ = -1;
    openWindows.forEach((win) => {
      if (win.classList.contains("minimized")) return;
      const z = Number(win.style.zIndex || 0);
      if (z > topZ) { top = win; topZ = z; }
    });
    if (top) focusWindow(top);
    else {
      focusedId = null;
      document.querySelectorAll(".window").forEach((w) => w.classList.remove("focused"));
      updateTaskbar();
    }
  }

  function restoreWindow(win) {
    win.classList.remove("minimized");
    focusWindow(win);
  }

  function minimizeWindow(win) {
    if (!win) return;
    win.classList.add("minimized");
    win.classList.remove("focused");
    if (focusedId === win.dataset.app) focusedId = null;
    focusNextWindow();
    updateTaskbar();
  }

  function toggleMaximize(win) {
    if (!win) return;
    const maximized = win.classList.toggle("maximized");
    const iconNode = win.querySelector('[data-window-control="maximize"]');
    if (iconNode) {
      iconNode.innerHTML = icon(maximized ? "restore" : "square");
      iconNode.setAttribute("aria-label", maximized ? "还原" : "最大化");
    }
    focusWindow(win);
  }

  function closeWindow(win) {
    if (!win) return;
    const def = W13.apps[win.dataset.app];
    if (def && typeof def.onClose === "function") def.onClose(win);
    win.classList.add("closing");
    const id = win.dataset.app;
    setTimeout(() => {
      win.remove();
      openWindows.delete(id);
      if (focusedId === id) focusedId = null;
      focusNextWindow();
      updateTaskbar();
    }, 180);
  }

  function makeDraggable(win) {
    const bar = win.querySelector(".window-titlebar");
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    bar.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      if (e.target.closest(".window-controls")) return;
      if (win.classList.contains("maximized")) return;
      dragging = true;
      const rect = win.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      document.body.classList.add("dragging");
      bar.setPointerCapture(e.pointerId);
      focusWindow(win);
    });

    bar.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const maxTop = window.innerHeight - 80;
      const left = W13.clamp(startLeft + e.clientX - startX, -win.offsetWidth + 120, window.innerWidth - 120);
      const top = W13.clamp(startTop + e.clientY - startY, 0, maxTop);
      win.style.left = left + "px";
      win.style.top = top + "px";
    });

    const stopDrag = () => {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove("dragging");
    };
    bar.addEventListener("pointerup", stopDrag);
    bar.addEventListener("pointercancel", stopDrag);
    bar.addEventListener("dblclick", (e) => {
      if (e.target.closest(".window-controls")) return;
      toggleMaximize(win);
    });
  }

  function makeResizable(win) {
    const handle = win.querySelector(".window-resize");
    if (!handle) return;
    let resizing = false;
    let startX = 0;
    let startY = 0;
    let startW = 0;
    let startH = 0;
    handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || win.classList.contains("maximized")) return;
      resizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startW = win.offsetWidth;
      startH = win.offsetHeight;
      const def = W13.apps[win.dataset.app];
      handle.setPointerCapture(e.pointerId);
      focusWindow(win);
    });
    handle.addEventListener("pointermove", (e) => {
      if (!resizing) return;
      const def = W13.apps[win.dataset.app] || {};
      const minW = def.minWidth || 360;
      const minH = def.minHeight || 280;
      const maxW = window.innerWidth - win.offsetLeft;
      const maxH = window.innerHeight - win.offsetTop - 8;
      win.style.width = W13.clamp(startW + e.clientX - startX, minW, Math.max(minW, maxW)) + "px";
      win.style.height = W13.clamp(startH + e.clientY - startY, minH, Math.max(minH, maxH)) + "px";
    });
    const stopResize = () => { resizing = false; };
    handle.addEventListener("pointerup", stopResize);
    handle.addEventListener("pointercancel", stopResize);
  }

  function buildWindowShell(id, options) {
    const def = W13.apps[id];
    const name = def.name || metaFor(id).name;
    const width = Math.min(def.width || 860, window.innerWidth - 32);
    const height = Math.min(def.height || 600, window.innerHeight - 72);
    const isSmall = window.innerWidth < 760;
    const offset = (openSequence++ % 5) * 26;
    const left = Math.max(8, Math.round((window.innerWidth - width) / 2) + offset - 40);
    const top = Math.max(8, Math.round((window.innerHeight - 52 - height) / 2) + offset - 28);

    const win = document.createElement("div");
    win.className = "window app-window";
    win.dataset.app = id;
    win.style.width = width + "px";
    win.style.height = height + "px";
    win.style.left = Math.max(8, Math.min(left, window.innerWidth - width - 8)) + "px";
    win.style.top = Math.max(8, Math.min(top, window.innerHeight - 52 - height - 8)) + "px";
    if (isSmall) win.classList.add("maximized");
    win.innerHTML =
      '<div class="window-titlebar">' +
        '<div class="window-title">' + appMark(id) + "<b>" + escapeHTML(name) + "</b></div>" +
        '<div class="window-controls">' +
          '<button class="win-control" data-window-control="minimize" aria-label="最小化">' + icon("minus") + "</button>" +
          '<button class="win-control" data-window-control="maximize" aria-label="最大化">' + icon("square") + "</button>" +
          '<button class="win-control close" data-window-control="close" aria-label="关闭">' + icon("close") + "</button>" +
        "</div>" +
      "</div>" +
      '<div class="window-content"></div>' +
      '<div class="window-resize" aria-hidden="true"></div>';
    layer.appendChild(win);

    const content = win.querySelector(".window-content");
    content.innerHTML = def.render(options || {});
    if (typeof def.init === "function") def.init(win, options || {});

    win.addEventListener("pointerdown", () => focusWindow(win));
    win.querySelector(".window-controls").addEventListener("click", (e) => {
      const button = e.target.closest("[data-window-control]");
      if (!button) return;
      e.stopPropagation();
      const action = button.dataset.windowControl;
      if (action === "minimize") minimizeWindow(win);
      else if (action === "maximize") toggleMaximize(win);
      else if (action === "close") closeWindow(win);
    });
    makeDraggable(win);
    makeResizable(win);
    openWindows.set(id, win);
    focusWindow(win);
    updateTaskbar();
    if (isSmall) {
      const maxIcon = win.querySelector('[data-window-control="maximize"]');
      if (maxIcon) maxIcon.innerHTML = icon("restore");
    }
    return win;
  }

  function openApp(id, options) {
    const opts = options || {};
    if (!W13.apps[id]) {
      showToast("无法打开", "此应用尚未安装。", "alert");
      return null;
    }
    W13.closeAllFlyouts();
    const existing = openWindows.get(id);
    if (existing) {
      const def = W13.apps[id];
      if (typeof def.reopen === "function") def.reopen(existing, opts);
      restoreWindow(existing);
      return existing;
    }
    return buildWindowShell(id, opts);
  }

  function updateWindowTitle(win, title) {
    if (!win) return;
    const label = win.querySelector(".window-title b");
    if (label) label.textContent = title;
  }

  function setTaskbarActive(id) {
    focusedId = id;
    updateTaskbar();
  }

  function minimizeAll() {
    openWindows.forEach((win) => {
      if (!win.classList.contains("minimized")) win.classList.add("minimized");
    });
    focusedId = null;
    document.querySelectorAll(".window").forEach((win) => win.classList.remove("focused"));
    updateTaskbar();
  }

  function initWindowManager() {
    if (!taskbarApps) return;
    taskbarApps.addEventListener("click", (e) => {
      const button = e.target.closest("[data-task-app]");
      if (!button) return;
      const id = button.dataset.taskApp;
      const win = openWindows.get(id);
      if (!win) {
        openApp(id);
        return;
      }
      if (win.classList.contains("minimized")) restoreWindow(win);
      else if (focusedId === id) minimizeWindow(win);
      else focusWindow(win);
    });
    updateTaskbar();
    window.addEventListener("resize", () => {
      openWindows.forEach((win) => {
        if (win.classList.contains("maximized")) return;
        const rect = win.getBoundingClientRect();
        if (rect.right > window.innerWidth) win.style.left = Math.max(6, window.innerWidth - rect.width - 6) + "px";
        if (rect.bottom > window.innerHeight - 52) win.style.top = Math.max(6, window.innerHeight - 52 - rect.height - 6) + "px";
      });
    });
  }

  Object.assign(W13, {
    openApp,
    openWindows,
    updateTaskbar,
    updateWindowTitle,
    minimizeWindow,
    restoreWindow,
    closeWindow,
    toggleMaximize,
    focusWindow,
    minimizeAll,
    initWindowManager
  });
})();
