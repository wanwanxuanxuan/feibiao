/* Windows 13 · shell: desktop, taskbar flyouts, start, notifications, power */
(function () {
  "use strict";
  const W13 = window.W13;
  const { icon, appMark, escapeHTML, state, showToast, applyState } = W13;

  const ui = {
    booted: false,
    locked: false,
    startOpen: false,
    quickOpen: false,
    notifOpen: false,
    contextOpen: false,
    calCursor: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    mediaPlaying: true,
    desktopExtras: []
  };
  W13.ui = ui;
  W13.customFolders = W13.customFolders || {};

  const DESKTOP_ITEMS = [
    { id: "pc", label: "此电脑", kind: "folder", folder: "pc" },
    { id: "recycle", label: "回收站", kind: "folder", folder: "recycle" },
    { id: "explorer", label: "文件资源管理器", kind: "app", app: "explorer" },
    { id: "browser", label: "Microsoft Edge", kind: "app", app: "browser" },
    { id: "settings", label: "设置", kind: "app", app: "settings" },
    { id: "project", label: "Windows 13 项目", kind: "folder", folder: "project" },
    { id: "solar-tide", label: "Solar Tide.txt", kind: "file", file: "Solar Tide.txt" },
    { id: "photos", label: "照片", kind: "app", app: "photos" }
  ];

  const START_APPS = [
    { id: "browser", label: "Microsoft Edge" },
    { id: "explorer", label: "文件资源管理器" },
    { id: "settings", label: "设置" },
    { id: "notepad", label: "记事本" },
    { id: "photos", label: "照片" },
    { id: "calculator", label: "计算器" },
    { id: "pc", label: "此电脑", target: "folder:pc" },
    { id: "recycle", label: "回收站", target: "folder:recycle" },
    { id: "documents", label: "文档", target: "folder:documents" },
    { id: "pictures", label: "图片", target: "folder:pictures" },
    { id: "terminal", label: "Windows Terminal" },
    { id: "store", label: "Microsoft Store", disabled: true, mark: "store", icon: "store" }
  ];

  const RECOMMENDATIONS = [
    { id: "r1", label: "Windows 13 概念稿.txt", meta: "刚刚 · 文档", icon: "file-text", target: "file:Solar Tide.txt" },
    { id: "r2", label: "Solar Tide 壁纸.png", meta: "10 分钟前 · 图片", icon: "image", target: "photo:art-1" },
    { id: "r3", label: "潮汐设计项目", meta: "昨天 · 文件夹", icon: "folder", target: "folder:project" },
    { id: "r4", label: "产品路线图 2026.docx", meta: "昨天 · 文档", icon: "file-text", target: "file:产品路线图 2026.docx" }
  ];

  let notifications = [
    { id: "n1", icon: "sparkles", app: "Windows 13", title: "欢迎来到黄蓝桌面", message: "这是你的 Windows 13 概念设备。试着打开设置，换一张壁纸。", minutes: 1, target: "app:settings" },
    { id: "n2", icon: "sun", app: "天气", title: "上海 · 24°C 晴朗", message: "今天最高 26°，最低 19°，适合在窗边工作。", minutes: 8, target: "app:browser" },
    { id: "n3", icon: "globe", app: "Microsoft Edge", title: "发现你的下一站", message: "新标签页已准备好，今日精选内容正在等你。", minutes: 23, target: "app:browser" }
  ];
  W13.notifications = notifications;

  const el = (id) => document.getElementById(id);
  const startMenu = el("start-menu");
  const startDynamic = el("start-dynamic");
  const startInput = el("start-search-input");
  const startButton = el("start-button");
  const quickSettings = el("quick-settings");
  const notificationCenter = el("notification-center");
  const powerMenu = el("power-menu");
  const contextMenu = el("context-menu");
  const taskbarApps = el("taskbar-apps");

  function appMarkFor(startApp) {
    if (startApp.mark) {
      return '<span class="app-mark ' + startApp.mark + '">' + icon(startApp.icon || "apps") + "</span>";
    }
    return appMark(startApp.id);
  }

  function iconForDesktop(item) {
    if (item.app) return appMark(item.app);
    if (item.kind === "folder") return appMark(item.folder === "recycle" ? "recycle" : item.folder === "pc" ? "pc" : "folder");
    if (item.kind === "file") {
      return '<span class="app-mark notepad">' + icon("file-text") + "</span>";
    }
    return appMark("folder");
  }

  function renderDesktop() {
    const container = el("desktop-icons");
    if (!container) return;
    const items = DESKTOP_ITEMS.concat(ui.desktopExtras);
    container.innerHTML = items.map((item) => {
      return (
        '<button class="desktop-icon" data-desktop-id="' + escapeHTML(item.id) + '" title="' + escapeHTML(item.label) + '">' +
        '<span class="desktop-icon-art">' + iconForDesktop(item) + "</span>" +
        "<span>" + escapeHTML(item.label) + "</span>" +
        "</button>"
      );
    }).join("");
  }

  function selectDesktopIcon(id) {
    document.querySelectorAll(".desktop-icon").forEach((node) => {
      node.classList.toggle("selected", node.dataset.desktopId === id);
    });
  }

  function findDesktopItem(id) {
    return DESKTOP_ITEMS.concat(ui.desktopExtras).find((item) => item.id === id);
  }

  function openDesktopItem(item) {
    if (!item) return;
    if (item.disabled) {
      showToast("暂时无法打开", "此应用在概念系统中尚未安装。", "info");
      return;
    }
    if (item.kind === "app") {
      if (W13.openApp) W13.openApp(item.app);
    } else if (item.kind === "folder") {
      if (W13.openExplorerAt) W13.openExplorerAt(item.folder);
      else if (W13.openApp) W13.openApp("explorer", { folder: item.folder });
    } else if (item.kind === "file") {
      if (W13.openFile) W13.openFile(item.file);
      else if (W13.openApp) W13.openApp("notepad", { file: item.file });
    }
  }

  function handleOpenTarget(target) {
    if (!target) return;
    const parts = target.split(":");
    const kind = parts.shift();
    const value = parts.join(":");
    closeAllFlyouts();
    if (kind === "app" && W13.openApp) W13.openApp(value);
    else if (kind === "folder" && W13.openExplorerAt) W13.openExplorerAt(value);
    else if (kind === "file" && W13.openFile) W13.openFile(value);
    else if (kind === "photo" && W13.openApp) W13.openApp("photos", { photo: value });
  }
  W13.handleOpenTarget = handleOpenTarget;

  /* ---------------- Start menu ---------------- */

  function renderStartHome() {
    const appTiles = START_APPS.map((app) => {
      const disabled = app.disabled ? " style=\"opacity:.5\"" : "";
      return (
        '<button class="start-tile" data-start-target="' + (app.target || ("app:" + app.id)) + '"' + disabled + ">" +
        appMarkFor(app) + "<span>" + escapeHTML(app.label) + "</span></button>"
      );
    }).join("");
    const recs = RECOMMENDATIONS.map((item) => {
      return (
        '<button class="recommend-item" data-start-target="' + escapeHTML(item.target) + '">' +
        '<span class="recommend-icon">' + icon(item.icon) + "</span>" +
        '<span class="recommend-copy"><b>' + escapeHTML(item.label) + "</b><small>" + escapeHTML(item.meta) + "</small></span>" +
        "</button>"
      );
    }).join("");
    startDynamic.innerHTML =
      '<div class="start-heading"><h3>已固定</h3><button data-start-all="apps">所有应用</button></div>' +
      '<div class="start-grid">' + appTiles + "</div>" +
      '<div class="start-heading"><h3>推荐的项目</h3><button data-start-all="more">更多</button></div>' +
      '<div class="start-recommend">' + recs + "</div>";
  }

  function searchStart(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
      renderStartHome();
      return;
    }
    const appResults = START_APPS.filter((app) => app.label.toLowerCase().includes(q));
    const recResults = RECOMMENDATIONS.filter((item) => item.label.toLowerCase().includes(q) || item.meta.toLowerCase().includes(q));
    let html = '<div class="start-heading"><h3>最佳匹配</h3></div>';
    if (!appResults.length && !recResults.length) {
      startDynamic.innerHTML =
        '<div class="start-empty">' + icon("search") + "<div>没有找到“" + escapeHTML(query) + "”</div><div style=\"margin-top:5px;font-size:9px\">试试搜索“设置”或“Solar”</div></div>";
      return;
    }
    if (appResults.length) {
      html += appResults.map((app) => (
        '<button class="start-result-row" data-start-target="' + (app.target || ("app:" + app.id)) + '">' +
        appMarkFor(app) + '<span class="start-result-copy"><b>' + escapeHTML(app.label) + "</b><small>应用</small></span></button>"
      )).join("");
    }
    if (recResults.length) {
      html += '<div class="start-heading"><h3>文件与项目</h3></div>' + recResults.map((item) => (
        '<button class="start-result-row" data-start-target="' + escapeHTML(item.target) + '">' +
        '<span class="recommend-icon">' + icon(item.icon) + "</span>" +
        '<span class="start-result-copy"><b>' + escapeHTML(item.label) + "</b><small>" + escapeHTML(item.meta) + "</small></span></button>"
      )).join("");
    }
    startDynamic.innerHTML = html;
  }

  function openStart(focusSearch) {
    closeQuick();
    closeNotifications();
    closeContext();
    ui.startOpen = true;
    startMenu.classList.add("open");
    startMenu.setAttribute("aria-hidden", "false");
    startButton.classList.add("active");
    if (startInput) startInput.value = "";
    renderStartHome();
    if (focusSearch) setTimeout(() => startInput && startInput.focus(), 120);
  }

  function closeStart() {
    ui.startOpen = false;
    startMenu.classList.remove("open");
    startMenu.setAttribute("aria-hidden", "true");
    startButton.classList.remove("active");
    powerMenu.classList.remove("open");
  }

  function toggleStart() {
    if (ui.startOpen) closeStart();
    else openStart(false);
  }

  function showPowerMenu() {
    powerMenu.classList.toggle("open");
  }

  /* ---------------- Quick settings ---------------- */

  function updateQuickTileLabels() {
    document.querySelectorAll(".qs-tile[data-qs-toggle]").forEach((tile) => {
      const key = tile.dataset.qsToggle;
      const label = tile.querySelector("small");
      if (!label) return;
      const map = {
        wifi: state.toggles.wifi && !state.toggles.airplane ? "YellowBlue" : "已关闭",
        bluetooth: state.toggles.bluetooth ? "已开启" : "已关闭",
        airplane: state.toggles.airplane ? "已开启" : "已关闭",
        batterySaver: state.toggles.batterySaver ? "已开启" : "平衡",
        nightLight: state.toggles.nightLight ? "已开启" : "已关闭"
      };
      label.textContent = map[key] || label.textContent;
    });
  }
  W13.refreshQuickTileLabels = updateQuickTileLabels;

  function openQuick() {
    closeStart();
    closeNotifications();
    closeContext();
    ui.quickOpen = true;
    quickSettings.classList.add("open");
    quickSettings.setAttribute("aria-hidden", "false");
    updateQuickTileLabels();
  }

  function closeQuick() {
    ui.quickOpen = false;
    quickSettings.classList.remove("open");
    quickSettings.setAttribute("aria-hidden", "true");
  }

  function toggleQuick() {
    if (ui.quickOpen) closeQuick();
    else openQuick();
  }

  function toggleStateKey(key) {
    if (!(key in state.toggles)) return;
    state.toggles[key] = !state.toggles[key];
    if (key === "airplane" && state.toggles.airplane) {
      state.toggles.wifi = false;
      state.toggles.bluetooth = false;
    }
    if (key === "wifi" && state.toggles.wifi) state.toggles.airplane = false;
    if (key === "bluetooth" && state.toggles.bluetooth) state.toggles.airplane = false;
    applyState();
    updateQuickTileLabels();
  }

  /* ---------------- Notifications ---------------- */

  function renderNotifications() {
    const list = el("notif-list");
    if (!list) return;
    const count = notifications.length;
    const countEl = el("notif-count");
    if (countEl) countEl.textContent = count ? count + " 条新通知" : "暂无新通知";
    if (!count) {
      list.innerHTML = '<div class="notif-empty">一切都很安静。没有新的通知。</div>';
      return;
    }
    list.innerHTML = notifications.map((n) => (
      '<div class="notification" data-notification-id="' + n.id + '">' +
      '<span class="notif-app-icon">' + icon(n.icon) + "</span>" +
      '<div class="notif-body" data-notification-open="' + escapeHTML(n.target || "") + '">' +
      "<b>" + escapeHTML(n.title) + "</b><p>" + escapeHTML(n.message) + "</p><small>" + escapeHTML(n.app + " · " + W13.relativeTime(n.minutes)) + "</small></div>" +
      '<button class="notif-close" data-notification-close="' + n.id + '" aria-label="清除通知">' + icon("close") + "</button>" +
      "</div>"
    )).join("");
  }

  function pushNotification(notification) {
    notifications.unshift(Object.assign({ id: "n" + Date.now(), minutes: 0, icon: "info", app: "Windows 13" }, notification));
    W13.notifications = notifications;
    renderNotifications();
  }
  W13.pushNotification = pushNotification;

  function dismissNotification(id) {
    const node = document.querySelector('[data-notification-id="' + id + '"]');
    if (node) {
      node.classList.add("dismissing");
      setTimeout(() => {
        notifications = notifications.filter((n) => n.id !== id);
        W13.notifications = notifications;
        renderNotifications();
      }, 180);
    }
  }

  function renderCalendar() {
    const cal = el("calendar");
    if (!cal) return;
    const cursor = new Date(ui.calCursor.getFullYear(), ui.calCursor.getMonth(), 1);
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const monthNames = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
    const today = new Date();
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    let cells = "";
    const dows = ["一", "二", "三", "四", "五", "六", "日"];
    dows.forEach((d) => { cells += '<span class="cal-dow">' + d + "</span>"; });
    for (let i = 0; i < startOffset; i++) {
      const day = prevMonthDays - startOffset + i + 1;
      cells += '<button class="cal-day muted" data-cal-ignore="1">' + day + "</button>";
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
      cells += '<button class="cal-day' + (isToday ? " today" : "") + '" data-cal-day="' + day + '">' + day + "</button>";
    }
    const total = startOffset + daysInMonth;
    for (let day = 1; day <= (42 - total); day++) {
      cells += '<button class="cal-day muted" data-cal-ignore="1">' + day + "</button>";
    }
    cal.innerHTML =
      '<div class="cal-head"><span>' + year + "年 " + monthNames[month] + "</span>" +
      '<span><button data-cal-nav="-1" aria-label="上个月">' + icon("chevron-left") + "</button>" +
      '<button data-cal-nav="1" aria-label="下个月">' + icon("chevron-right") + "</button></span></div>" +
      cells;
    const weekday = el("notif-weekday");
    const dayEl = el("notif-day");
    const monthEl = el("notif-month");
    if (weekday) weekday.textContent = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][today.getDay()];
    if (dayEl) dayEl.textContent = today.getDate();
    if (monthEl) monthEl.textContent = monthNames[today.getMonth()] + " " + today.getFullYear();
  }

  function openNotifications() {
    closeStart();
    closeQuick();
    closeContext();
    ui.notifOpen = true;
    notificationCenter.classList.add("open");
    notificationCenter.setAttribute("aria-hidden", "false");
    renderCalendar();
    renderNotifications();
  }

  function closeNotifications() {
    ui.notifOpen = false;
    notificationCenter.classList.remove("open");
    notificationCenter.setAttribute("aria-hidden", "true");
  }

  function toggleNotifications() {
    if (ui.notifOpen) closeNotifications();
    else openNotifications();
  }

  /* ---------------- Context menu ---------------- */

  function closeContext() {
    ui.contextOpen = false;
    contextMenu.classList.remove("open");
    contextMenu.setAttribute("aria-hidden", "true");
  }

  function showDesktopContext(x, y, iconItem) {
    const personalization = '<button class="ctx-item" data-ctx="personalize">' + icon("palette") + "<span>个性化</span></button>";
    let html;
    if (iconItem) {
      html =
        '<div class="ctx-label">' + escapeHTML(iconItem.label) + "</div>" +
        '<button class="ctx-item" data-ctx="open" data-ctx-id="' + escapeHTML(iconItem.id) + '">' + icon("external") + "<span>打开</span></button>" +
        '<div class="ctx-sep"></div>' +
        '<button class="ctx-item" data-ctx="copy">' + icon("copy") + "<span>复制</span><kbd>Ctrl+C</kbd></button>" +
        '<button class="ctx-item" data-ctx="rename">' + icon("edit") + "<span>重命名</span><kbd>F2</kbd></button>" +
        '<button class="ctx-item danger" data-ctx="delete" data-ctx-id="' + escapeHTML(iconItem.id) + '">' + icon("trash") + "<span>删除</span></button>" +
        '<div class="ctx-sep"></div>' +
        '<button class="ctx-item" data-ctx="properties" data-ctx-id="' + escapeHTML(iconItem.id) + '">' + icon("info") + "<span>属性</span></button>";
    } else {
      html =
        '<button class="ctx-item" data-ctx="refresh">' + icon("refresh") + "<span>刷新</span><kbd>F5</kbd></button>" +
        '<div class="ctx-sep"></div>' +
        '<button class="ctx-item" data-ctx="new-folder">' + icon("folder-plus") + "<span>新建文件夹</span></button>" +
        '<button class="ctx-item" data-ctx="new-text">' + icon("file-plus") + "<span>新建文本文档</span></button>" +
        '<div class="ctx-sep"></div>' +
        '<button class="ctx-item" data-ctx="display">' + icon("display") + "<span>显示设置</span></button>" +
        personalization;
    }
    contextMenu.innerHTML = html;
    contextMenu.classList.add("open");
    contextMenu.setAttribute("aria-hidden", "false");
    ui.contextOpen = true;
    const rect = contextMenu.getBoundingClientRect();
    contextMenu.style.left = Math.min(x, window.innerWidth - rect.width - 8) + "px";
    contextMenu.style.top = Math.min(y, window.innerHeight - rect.height - 8) + "px";
  }

  function handleContextAction(action, id) {
    closeContext();
    if (action === "personalize") {
      if (W13.openApp) W13.openApp("settings", { page: "personalization" });
    } else if (action === "display") {
      if (W13.openApp) W13.openApp("settings", { page: "system" });
    } else if (action === "refresh") {
      renderDesktop();
      showToast("桌面已刷新", "所有图标已重新排列。", "refresh", 1800);
    } else if (action === "new-folder") {
      createDesktopFolder();
    } else if (action === "new-text") {
      if (W13.openApp) W13.openApp("notepad", { newFile: true });
    } else if (action === "open") {
      openDesktopItem(findDesktopItem(id));
    } else if (action === "delete") {
      const item = findDesktopItem(id);
      ui.desktopExtras = ui.desktopExtras.filter((it) => it.id !== id);
      renderDesktop();
      showToast("已从桌面移除", (item ? item.label : "项目") + " 已移至回收站。", "trash");
    } else if (action === "rename") {
      showToast("重命名", "演示模式下已锁定名称。", "info");
    } else if (action === "copy") {
      showToast("已复制", "项目已复制到剪贴板。", "copy");
    } else if (action === "properties") {
      const item = findDesktopItem(id);
      showToast(item ? item.label : "项目属性", "类型：黄蓝概念项目 · 位置：桌面", "info");
    }
  }

  function createDesktopFolder() {
    const number = ui.desktopExtras.filter((it) => it.label && it.label.indexOf("新建文件夹") === 0).length + 1;
    const name = "新建文件夹" + (number > 1 ? " (" + number + ")" : "");
    const id = "custom-folder-" + Date.now();
    W13.customFolders[id] = { name: name, items: [] };
    ui.desktopExtras.push({ id: id, label: name, kind: "folder", folder: id, custom: true });
    renderDesktop();
    showToast("新建文件夹", "已在桌面创建“" + name + "”。", "folder-plus");
  }

  /* ---------------- Power / lock ---------------- */

  function updateLockTime() {
    const now = new Date();
    const lockClock = el("lock-clock");
    const lockDate = el("lock-date");
    if (lockClock) lockClock.textContent = W13.formatClock(now);
    if (lockDate) lockDate.textContent = W13.formatLongDate(now);
  }

  function lockScreen() {
    closeAllFlyouts();
    ui.locked = true;
    const screen = el("lock-screen");
    screen.classList.remove("unlocking");
    screen.classList.add("open");
    screen.setAttribute("aria-hidden", "false");
    updateLockTime();
  }
  W13.lockScreen = lockScreen;

  function unlockScreen() {
    if (!ui.locked) return;
    ui.locked = false;
    const screen = el("lock-screen");
    screen.classList.add("unlocking");
    screen.setAttribute("aria-hidden", "true");
    setTimeout(() => {
      screen.classList.remove("open", "unlocking");
    }, 430);
  }

  let restartTimer = null;
  function powerAction(action) {
    powerMenu.classList.remove("open");
    closeStart();
    if (action === "lock") {
      lockScreen();
    } else if (action === "sleep") {
      lockScreen();
      showToast("设备已进入睡眠", "点击或按 Enter 唤醒 Windows 13。", "sleep");
    } else if (action === "restart") {
      showShutdown("restart");
    } else if (action === "shutdown") {
      showShutdown("shutdown");
    }
  }

  function showShutdown(mode) {
    clearTimeout(restartTimer);
    closeAllFlyouts();
    const screen = el("shutdown-screen");
    const title = el("shutdown-title");
    const message = el("shutdown-message");
    const spinner = el("shutdown-spinner");
    const power = el("shutdown-power");
    screen.classList.add("open");
    screen.setAttribute("aria-hidden", "false");
    title.textContent = mode === "restart" ? "正在重启" : "正在关机";
    message.textContent = "请稍候，Windows 正在保存你的设置。";
    spinner.hidden = false;
    power.hidden = true;
    if (mode === "restart") {
      restartTimer = setTimeout(() => {
        screen.classList.remove("open");
        screen.setAttribute("aria-hidden", "true");
        startBoot(true);
      }, 2100);
    } else {
      restartTimer = setTimeout(() => {
        title.textContent = "已关机";
        message.textContent = "你的黄蓝桌面正在休息。";
        spinner.hidden = true;
        power.hidden = false;
      }, 2300);
    }
  }

  function startBoot(fromRestart) {
    const boot = el("boot-screen");
    boot.classList.remove("done");
    boot.style.display = "";
    ui.booted = false;
    setTimeout(finishBoot, fromRestart ? 1900 : 2200);
  }

  function finishBoot() {
    if (ui.booted) return;
    ui.booted = true;
    const boot = el("boot-screen");
    if (boot) boot.classList.add("done");
    updateClock();
    if (!document.querySelector(".toast")) {
      setTimeout(() => {
        showToast("欢迎使用 Windows 13", "黄蓝概念桌面已准备就绪。右键桌面可以换一种心情。", "sparkles", 5200);
      }, 700);
    }
  }

  /* ---------------- Clock / taskbar ---------------- */

  function updateClock() {
    const now = new Date();
    const time = el("clock-time");
    const date = el("clock-date");
    if (time) time.textContent = W13.formatClock(now);
    if (date) date.textContent = W13.formatDate(now);
    updateLockTime();
    const notifWeekday = el("notif-weekday");
    if (notifWeekday && ui.notifOpen) renderCalendar();
  }

  /* ---------------- Global wiring ---------------- */

  function closeAllFlyouts() {
    closeStart();
    closeQuick();
    closeNotifications();
    closeContext();
  }
  W13.closeAllFlyouts = closeAllFlyouts;

  function injectStaticIcons() {
    document.querySelectorAll("[data-icon-slot]").forEach((slot) => {
      slot.innerHTML = icon(slot.dataset.iconSlot);
    });
    const startSearchIcon = el("start-search-icon");
    if (startSearchIcon) startSearchIcon.innerHTML = icon("search");
    const startPower = el("start-power");
    if (startPower) startPower.innerHTML = icon("power");
    document.querySelectorAll("[data-power-icon]").forEach((slot) => {
      slot.innerHTML = icon(slot.dataset.powerIcon);
    });
    const qsGear = document.querySelector(".qs-head .icon-button");
    if (qsGear) qsGear.innerHTML = icon("settings");
    const clearNotif = el("clear-notifications");
    if (clearNotif) clearNotif.innerHTML = icon("trash");
    const mediaToggle = el("media-toggle");
    if (mediaToggle) mediaToggle.innerHTML = icon("pause");
    const mediaNext = el("media-next");
    if (mediaNext) mediaNext.innerHTML = icon("next");
    const showDesktop = el("show-desktop");
    if (showDesktop) showDesktop.innerHTML = "";
  }

  function initShell() {
    injectStaticIcons();
    renderDesktop();
    renderStartHome();
    renderNotifications();
    renderCalendar();
    updateClock();
    updateQuickTileLabels();
    applyState();
    setInterval(updateClock, 1000);
    setTimeout(finishBoot, 2200);

    el("boot-skip").addEventListener("click", finishBoot);
    el("boot-screen").addEventListener("click", (e) => {
      if (e.target.id === "boot-screen") finishBoot();
    });

    startButton.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleStart();
    });
    el("taskbar-search").addEventListener("click", (e) => {
      e.stopPropagation();
      if (ui.startOpen) closeStart();
      openStart(true);
    });
    startInput.addEventListener("input", (e) => searchStart(e.target.value));
    startInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const first = startDynamic.querySelector("[data-start-target]");
        if (first) first.click();
      }
    });
    startMenu.addEventListener("click", (e) => {
      const target = e.target.closest("[data-start-target]");
      if (target) {
        handleOpenTarget(target.dataset.startTarget);
        return;
      }
      const all = e.target.closest("[data-start-all]");
      if (all) {
        showToast("所有应用", "这是概念系统中的全部已固定应用。", "apps", 2200);
      }
    });
    el("start-power").addEventListener("click", (e) => {
      e.stopPropagation();
      showPowerMenu();
    });
    powerMenu.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-power-action]");
      if (btn) powerAction(btn.dataset.powerAction);
    });
    el("start-user").addEventListener("click", () => {
      showToast("黄蓝少年", "本地账户 · Windows 13 Pro", "user");
    });

    el("tray-quick").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleQuick();
    });
    el("taskbar-clock").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleNotifications();
    });
    el("weather-pill").addEventListener("click", (e) => {
      e.stopPropagation();
      openNotifications();
    });
    el("show-desktop").addEventListener("click", minimizeAllWindows);

    quickSettings.addEventListener("click", (e) => {
      const tile = e.target.closest("[data-qs-toggle]");
      if (tile) {
        toggleStateKey(tile.dataset.qsToggle);
        return;
      }
      const openSettings = e.target.closest("[data-open-settings]");
      if (openSettings) {
        closeQuick();
        if (W13.openApp) W13.openApp("settings", { page: openSettings.dataset.openSettings });
        return;
      }
      if (e.target.closest("#qs-lock")) {
        closeQuick();
        lockScreen();
      }
    });
    el("brightness-slider").addEventListener("input", (e) => {
      state.brightness = Number(e.target.value);
      W13.applyRangeFill(e.target);
      el("brightness-value").textContent = state.brightness + "%";
      el("brightness-overlay").style.opacity = String(((100 - state.brightness) / 100) * 0.55);
      W13.saveState();
    });
    el("volume-slider").addEventListener("input", (e) => {
      state.volume = Number(e.target.value);
      W13.applyRangeFill(e.target);
      el("volume-value").textContent = state.volume + "%";
      W13.saveState();
    });
    el("media-toggle").addEventListener("click", (e) => {
      ui.mediaPlaying = !ui.mediaPlaying;
      e.currentTarget.innerHTML = icon(ui.mediaPlaying ? "pause" : "play");
      showToast(ui.mediaPlaying ? "正在播放" : "已暂停", "Solar Tide · Windows 13 Ambient Sessions", ui.mediaPlaying ? "play" : "pause", 1800);
    });
    el("media-next").addEventListener("click", () => {
      showToast("下一首", "Amber Horizon · Windows 13 Ambient Sessions", "next", 1800);
    });

    notificationCenter.addEventListener("click", (e) => {
      const nav = e.target.closest("[data-cal-nav]");
      if (nav) {
        const delta = Number(nav.dataset.calNav);
        ui.calCursor = new Date(ui.calCursor.getFullYear(), ui.calCursor.getMonth() + delta, 1);
        renderCalendar();
        return;
      }
      const close = e.target.closest("[data-notification-close]");
      if (close) {
        e.stopPropagation();
        dismissNotification(close.dataset.notificationClose);
        return;
      }
      const open = e.target.closest("[data-notification-open]");
      if (open && open.dataset.notificationOpen) handleOpenTarget(open.dataset.notificationOpen);
    });
    el("clear-notifications").addEventListener("click", () => {
      if (!notifications.length) return;
      document.querySelectorAll(".notification").forEach((n) => n.classList.add("dismissing"));
      setTimeout(() => {
        notifications = [];
        W13.notifications = notifications;
        renderNotifications();
      }, 190);
    });

    document.addEventListener("contextmenu", (e) => {
      if (e.target.closest(".window, .taskbar, .start-menu, .flyout, .lock-screen, .shutdown-screen")) return;
      e.preventDefault();
      const desktopIcon = e.target.closest(".desktop-icon");
      if (desktopIcon) {
        selectDesktopIcon(desktopIcon.dataset.desktopId);
        const item = findDesktopItem(desktopIcon.dataset.desktopId);
        showDesktopContext(e.clientX, e.clientY, item);
      } else {
        document.querySelectorAll(".desktop-icon").forEach((node) => node.classList.remove("selected"));
        showDesktopContext(e.clientX, e.clientY, null);
      }
    });
    contextMenu.addEventListener("click", (e) => {
      const item = e.target.closest("[data-ctx]");
      if (item) handleContextAction(item.dataset.ctx, item.dataset.ctxId);
    });

    el("desktop-icons").addEventListener("click", (e) => {
      const iconNode = e.target.closest(".desktop-icon");
      if (!iconNode) {
        document.querySelectorAll(".desktop-icon").forEach((node) => node.classList.remove("selected"));
        return;
      }
      selectDesktopIcon(iconNode.dataset.desktopId);
    });
    el("desktop-icons").addEventListener("dblclick", (e) => {
      const iconNode = e.target.closest(".desktop-icon");
      if (!iconNode) return;
      openDesktopItem(findDesktopItem(iconNode.dataset.desktopId));
    });

    document.addEventListener("click", (e) => {
      if (ui.startOpen && !e.target.closest(".start-menu, #start-button, #taskbar-search")) closeStart();
      if (ui.quickOpen && !e.target.closest("#quick-settings, #tray-quick, [data-open-settings], #qs-lock, #brightness-slider, #volume-slider, #media-toggle, #media-next")) closeQuick();
      if (ui.notifOpen && !e.target.closest("#notification-center, #taskbar-clock, #weather-pill")) closeNotifications();
      if (ui.contextOpen && !e.target.closest("#context-menu")) closeContext();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeAllFlyouts();
      }
      if (ui.locked && e.key === "Enter") {
        unlockScreen();
      }
    });
    el("lock-screen").addEventListener("click", unlockScreen);
    el("shutdown-power").addEventListener("click", () => {
      const screen = el("shutdown-screen");
      screen.classList.remove("open");
      screen.setAttribute("aria-hidden", "true");
      startBoot(true);
    });
    window.addEventListener("resize", () => {
      document.querySelectorAll(".window.maximized").forEach((win) => {
        win.style.height = "calc(100% - var(--taskbar-h))";
      });
    });
  }

  function minimizeAllWindows() {
    if (W13.minimizeAll) W13.minimizeAll();
    closeAllFlyouts();
  }

  Object.assign(W13, {
    initShell,
    toggleStart,
    closeStart,
    openStart,
    openQuick,
    closeQuick,
    openNotifications,
    closeNotifications,
    lockScreen,
    unlockScreen,
    handleOpenTarget,
    renderDesktop,
    createDesktopFolder,
    finishBoot,
    updateClock
  });
})();
