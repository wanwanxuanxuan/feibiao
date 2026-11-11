/* Windows 13 · Notepad, Photos, Calculator, Terminal */
(function () {
  "use strict";
  const W13 = window.W13;
  const { icon, escapeHTML, state, showToast } = W13;

  /* ============================================================
     Notepad
     ============================================================ */

  let npFile = "无标题.txt";
  let npInitial = "";
  let npWin = null;
  let npWrap = true;

  const NP_DEFAULT = [
    "Windows 13 · 记事本",
    "",
    "在这里写下你的想法。",
    "所有文字都只保存在这台概念设备里。",
    "",
    "提示：右键桌面可以新建文本文档；",
    "在文件资源管理器里双击 .txt 文件也会用记事本打开。"
  ].join("\n");

  function npCounts(win) {
    const area = win.querySelector(".notepad-text");
    const status = win.querySelector(".notepad-status");
    if (!area || !status) return;
    const value = area.value;
    const chars = value.length;
    const lines = value ? value.split("\n").length : 1;
    const words = (value.match(/[\u4e00-\u9fa5]|[A-Za-z0-9]+/g) || []).length;
    status.innerHTML = "<span>" + chars + " 个字符</span><span>" + words + " 个词</span><span>第 " + lines + " 行，第 1 列</span>";
  }

  function npMarkDirty(win) {
    if (W13.updateWindowTitle) W13.updateWindowTitle(win, npFile + " *");
    const saveState = win.querySelector(".save-state");
    if (saveState) saveState.textContent = "未保存";
  }

  function npReload(win) {
    const area = win.querySelector(".notepad-text");
    if (!area) return;
    area.value = npInitial;
    npCounts(win);
    if (W13.updateWindowTitle) W13.updateWindowTitle(win, npFile);
    const s = win.querySelector(".save-state");
    if (s) s.textContent = "已保存";
  }

  function npBind(win) {
    npWin = win;
    const root = win.querySelector(".window-content > .notepad-app");
    if (!root) return;
    root.addEventListener("input", () => {
      npCounts(win);
      npMarkDirty(win);
    });
    root.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-np]");
      if (!btn) return;
      const action = btn.dataset.np;
      const area = win.querySelector(".notepad-text");
      if (action === "new") {
        npFile = "无标题.txt";
        npInitial = "";
        area.value = "";
        npCounts(win);
        if (W13.updateWindowTitle) W13.updateWindowTitle(win, npFile);
        const s = win.querySelector(".save-state");
        if (s) s.textContent = "新建";
      } else if (action === "open") {
        W13.openApp("explorer", { folder: "documents" });
      } else if (action === "save") {
        W13.FILES[npFile] = area.value;
        if (W13.updateWindowTitle) W13.updateWindowTitle(win, npFile);
        const s = win.querySelector(".save-state");
        if (s) s.textContent = "已保存";
        showToast("已保存", npFile + " 已保存到文档。", "check", 2200);
      } else if (action === "wrap") {
        npWrap = !npWrap;
        area.setAttribute("wrap", npWrap ? "soft" : "off");
        btn.textContent = npWrap ? "自动换行：开" : "自动换行：关";
      } else if (action === "zoom") {
        const size = parseFloat(getComputedStyle(area).fontSize) || 12.5;
        area.style.fontSize = (size >= 16 ? 12.5 : size + 1.5) + "px";
      } else if (action === "about") {
        showToast("关于记事本", "Windows 13 概念记事本 · 版本 11.2", "file-text", 2400);
      }
    });
  }

  W13.registerApp("notepad", {
    name: "记事本",
    width: 820,
    height: 560,
    minWidth: 420,
    minHeight: 300,
    render(options) {
      const opts = options || {};
      npFile = opts.file || "无标题.txt";
      npInitial = opts.content != null ? opts.content : (W13.FILES[npFile] || (opts.newFile ? "" : NP_DEFAULT));
      return (
        '<div class="notepad-app">' +
        '<div class="notepad-menu"><button data-np="new">新建</button><button data-np="open">打开</button><button data-np="save">保存</button>' +
        '<span class="spacer"></span><button data-np="wrap">自动换行：开</button><button data-np="zoom">A+</button><button data-np="about">帮助</button>' +
        '<span class="save-state">已保存</span></div>' +
        '<div class="notepad-editor"><textarea class="notepad-text" spellcheck="false" wrap="soft" aria-label="记事本编辑器">' + escapeHTML(npInitial) + "</textarea></div>" +
        '<div class="notepad-status"></div></div>'
      );
    },
    init(win) {
      npBind(win);
      npCounts(win);
      if (W13.updateWindowTitle) W13.updateWindowTitle(win, npFile);
    },
    reopen(win, options) {
      npWin = win;
      if (options && (options.file || options.newFile)) {
        npFile = options.file || "无标题.txt";
        npInitial = options.content != null ? options.content : (W13.FILES[npFile] || (options.newFile ? "" : NP_DEFAULT));
        npReload(win);
      }
    },
    onClose() { npWin = null; }
  });

  /* ============================================================
     Photos
     ============================================================ */

  const PHOTO_ORDER = ["art-1", "art-2", "art-3", "art-4"];
  let photoCurrent = "art-1";
  let photosWin = null;

  function photoTitle(id) {
    return (W13.PHOTO_TITLES && W13.PHOTO_TITLES[id]) || "未命名图片";
  }

  function photosRefresh(win) {
    if (!win) return;
    const canvas = win.querySelector(".photos-canvas .art-thumb");
    if (canvas) canvas.className = "art-thumb " + photoCurrent;
    const cap = win.querySelector(".photos-caption b");
    if (cap) cap.textContent = photoTitle(photoCurrent);
    const sub = win.querySelector(".photos-caption span");
    if (sub) sub.textContent = "2560 × 1600 · " + (PHOTO_ORDER.indexOf(photoCurrent) + 1) + " / 4 · 概念壁纸";
    win.querySelectorAll("[data-photo]").forEach((node) => {
      node.classList.toggle("active", node.dataset.photo === photoCurrent);
    });
  }

  function photosBind(win) {
    photosWin = win;
    const root = win.querySelector(".window-content > .photos-app");
    if (!root) return;
    root.addEventListener("click", (e) => {
      const thumb = e.target.closest("[data-photo]");
      if (thumb) { photoCurrent = thumb.dataset.photo; photosRefresh(win); return; }
      const action = e.target.closest("[data-photos-action]");
      if (!action) return;
      const key = action.dataset.photosAction;
      const idx = PHOTO_ORDER.indexOf(photoCurrent);
      if (key === "next") { photoCurrent = PHOTO_ORDER[(idx + 1) % PHOTO_ORDER.length]; photosRefresh(win); }
      else if (key === "prev") { photoCurrent = PHOTO_ORDER[(idx + PHOTO_ORDER.length - 1) % PHOTO_ORDER.length]; photosRefresh(win); }
      else if (key === "favorite") { showToast("已收藏", photoTitle(photoCurrent) + " 已添加到收藏。", "star", 2000); }
      else if (key === "rotate") { showToast("旋转", "图片已顺时针旋转 90°（演示）。", "refresh", 1800); }
      else if (key === "wallpaper") {
        const map = { "art-1": "tide", "art-2": "lagoon", "art-3": "amber", "art-4": "midnight" };
        state.wallpaper = map[photoCurrent] || "tide";
        W13.applyState();
        showToast("已设为壁纸", "桌面已切换为“" + photoTitle(photoCurrent) + "”。", "image", 2400);
      } else if (key === "info") {
        showToast(photoTitle(photoCurrent), "2560 × 1600 · PNG · 6.2 MB · 2026/11/10", "info", 2600);
      }
    });
  }

  W13.registerApp("photos", {
    name: "照片",
    width: 900,
    height: 620,
    minWidth: 460,
    minHeight: 340,
    render(options) {
      photoCurrent = (options && options.photo) || "art-1";
      return (
        '<div class="photos-app">' +
        '<div class="photos-toolbar"><div class="photos-title">' + icon("image") + " 照片 · 潮汐系列</div>" +
        '<div class="photos-actions"><button class="photos-action" data-photos-action="favorite" title="收藏">' + icon("star") + "</button>" +
        '<button class="photos-action" data-photos-action="rotate" title="旋转">' + icon("refresh") + "</button>" +
        '<button class="photos-action" data-photos-action="wallpaper" title="设为壁纸">' + icon("monitor") + "</button>" +
        '<button class="photos-action" data-photos-action="info" title="信息">' + icon("info") + "</button></div></div>" +
        '<div class="photos-main"><div class="photos-preview">' +
        '<div class="photos-canvas"><span class="art-thumb ' + photoCurrent + '"></span></div>' +
        '<div class="photos-caption"><div><b>' + photoTitle(photoCurrent) + "</b><span>2560 × 1600 · 概念壁纸</span></div>" +
        '<div class="photos-caption-actions"><button data-photos-action="prev" title="上一张">' + icon("chevron-left") + "</button>" +
        '<button data-photos-action="next" title="下一张">' + icon("chevron-right") + "</button></div></div></div>" +
        '<aside class="photos-strip"><div class="photos-strip-head">潮汐系列 · 4 张</div>' +
        PHOTO_ORDER.map((id) =>
          '<button class="photo-thumb' + (id === photoCurrent ? " active" : "") + '" data-photo="' + id + '" aria-label="' + photoTitle(id) + '">' +
          '<span class="art-thumb ' + id + '"></span></button>'
        ).join("") + "</aside></div></div>"
      );
    },
    init(win) { photosBind(win); },
    reopen(win, options) {
      photosWin = win;
      if (options && options.photo && PHOTO_ORDER.indexOf(options.photo) !== -1) {
        photoCurrent = options.photo;
        photosRefresh(win);
      }
    },
    onClose() { photosWin = null; }
  });

  /* ============================================================
     Calculator
     ============================================================ */

  const CALC_KEYS = [
    { label: "AC", cls: "function", act: "clear" },
    { label: "±", cls: "function", act: "sign" },
    { label: "%", cls: "function", act: "percent" },
    { label: "÷", cls: "operator", act: "op", op: "/" },
    { label: "7", act: "digit" }, { label: "8", act: "digit" }, { label: "9", act: "digit" },
    { label: "×", cls: "operator", act: "op", op: "*" },
    { label: "4", act: "digit" }, { label: "5", act: "digit" }, { label: "6", act: "digit" },
    { label: "−", cls: "operator", act: "op", op: "-" },
    { label: "1", act: "digit" }, { label: "2", act: "digit" }, { label: "3", act: "digit" },
    { label: "+", cls: "operator", act: "op", op: "+" },
    { label: "0", act: "digit", cls: "zero" }, { label: ".", act: "dot" },
    { label: "⌫", cls: "function", act: "back" },
    { label: "=", cls: "equals", act: "equals" }
  ];

  let calc = { display: "0", previous: null, operator: null, waiting: false, history: "" };

  function calcNumber(value) {
    const n = Number(value);
    if (!isFinite(n)) return "错误";
    const rounded = Math.round(n * 1e10) / 1e10;
    return String(rounded);
  }
  function calcRender(win) {
    const value = win.querySelector(".calc-value");
    const history = win.querySelector(".calc-history");
    if (value) value.textContent = calc.display;
    if (history) history.textContent = calc.history;
  }
  function calcPress(win, key) {
    if (key.act === "digit") {
      if (calc.waiting) { calc.display = key.label; calc.waiting = false; }
      else calc.display = calc.display === "0" ? key.label : calc.display + key.label;
    } else if (key.act === "dot") {
      if (calc.waiting) { calc.display = "0."; calc.waiting = false; }
      else if (calc.display.indexOf(".") === -1) calc.display += ".";
    } else if (key.act === "clear") {
      calc = { display: "0", previous: null, operator: null, waiting: false, history: "" };
    } else if (key.act === "back") {
      calc.display = calc.display.length > 1 ? calc.display.slice(0, -1) : "0";
    } else if (key.act === "sign") {
      calc.display = calc.display.charAt(0) === "-" ? calc.display.slice(1) : "-" + calc.display;
    } else if (key.act === "percent") {
      calc.display = calcNumber(Number(calc.display) / 100);
    } else if (key.act === "op") {
      if (calc.operator && !calc.waiting) {
        const result = calcCompute(Number(calc.previous), Number(calc.display), calc.operator);
        calc.display = calcNumber(result);
      }
      calc.previous = calc.display;
      calc.operator = key.op;
      calc.waiting = true;
      calc.history = calc.display + " " + key.label;
    } else if (key.act === "equals") {
      if (calc.operator !== null && calc.previous !== null) {
        const result = calcCompute(Number(calc.previous), Number(calc.display), calc.operator);
        calc.history = calc.previous + " " + (calc.operator === "*" ? "×" : calc.operator === "/" ? "÷" : calc.operator) + " " + calc.display + " =";
        calc.display = calcNumber(result);
        calc.previous = null;
        calc.operator = null;
        calc.waiting = true;
      }
    }
    calcRender(win);
  }
  function calcCompute(a, b, op) {
    if (op === "+") return a + b;
    if (op === "-") return a - b;
    if (op === "*") return a * b;
    if (op === "/") return b === 0 ? NaN : a / b;
    return b;
  }

  function calcBind(win) {
    const root = win.querySelector(".window-content > .calculator-app");
    if (!root) return;
    root.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-calc-key]");
      if (!btn) return;
      const idx = Number(btn.dataset.calcKey);
      const key = CALC_KEYS[idx];
      if (key) calcPress(win, key);
    });
    win.addEventListener("keydown", (e) => {
      if (!win.classList.contains("focused")) return;
      const map = { "+": 17, "-": 11, "*": 7, "/": 3, "Enter": 18, "=": 18, "Escape": 0, "Backspace": 19, ".": 16 };
      if (/^[0-9]$/.test(e.key)) {
        const idx = CALC_KEYS.findIndex((k) => k.act === "digit" && k.label === e.key);
        if (idx !== -1) { calcPress(win, CALC_KEYS[idx]); e.preventDefault(); }
        return;
      }
      const idx = map[e.key];
      if (idx != null) { calcPress(win, CALC_KEYS[idx]); e.preventDefault(); }
    });
  }

  W13.registerApp("calculator", {
    name: "计算器",
    width: 390,
    height: 560,
    minWidth: 300,
    minHeight: 420,
    render() {
      calc = { display: "0", previous: null, operator: null, waiting: false, history: "" };
      return (
        '<div class="calculator-app"><div class="calc-top"><span>标准</span>' +
        '<button data-calc-mode="history" aria-label="历史记录">' + icon("history") + "</button></div>" +
        '<div class="calc-display"><div class="calc-history"></div><div class="calc-value">0</div></div>' +
        '<div class="calc-grid" style="grid-template-rows:repeat(5,1fr)">' +
        CALC_KEYS.map((key, i) =>
          '<button class="calc-btn ' + (key.cls || "") + '" data-calc-key="' + i + '">' + key.label + "</button>"
        ).join("") + "</div></div>"
      );
    },
    init(win) {
      calcBind(win);
      const root = win.querySelector(".window-content > .calculator-app");
      const historyBtn = root && root.querySelector("[data-calc-mode]");
      if (historyBtn) historyBtn.addEventListener("click", () => showToast("历史记录", "本次会话还没有更多计算记录。", "history", 2000));
      win.addEventListener("keydown", (e) => {
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      });
    }
  });

  /* ============================================================
     Terminal
     ============================================================ */

  const TERM_BANNER = [
    "Windows Terminal · Windows 13 Pro",
    "Copyright (c) 2026 YellowBlue Studio. All rights reserved.",
    "",
    "输入 help 查看可用命令。",
    ""
  ];

  let termHistory = [];
  let termBuffer = TERM_BANNER.slice();

  function termPromptHTML() {
    return '<span class="term-path">C:\\Users\\YellowBlue</span><span class="term-chevron">›</span>';
  }
  function termRender(win) {
    const out = win.querySelector(".term-output");
    if (out) {
      out.innerHTML = termBuffer.map((line) => '<div class="term-line">' + escapeHTML(line) + "</div>").join("");
      out.scrollTop = out.scrollHeight;
    }
  }
  function termRun(win, raw) {
    const input = String(raw || "").trim();
    termBuffer.push("C:\\Users\\YellowBlue› " + input);
    if (!input) { termRender(win); return; }
    const parts = input.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const rest = parts.slice(1).join(" ");
    if (cmd === "help") {
      termBuffer.push("", "可用命令：", "  help            显示此帮助", "  whoami          显示当前用户", "  date            显示日期和时间", "  dir             列出当前目录", "  echo <文本>     输出文本", "  theme dark|light 切换主题", "  open <应用>     打开应用 (explorer/browser/settings/photos)", "  clear           清空屏幕", "  neofetch        显示系统信息", "");
    } else if (cmd === "whoami") {
      termBuffer.push("yellowblue\\huanglan-shaonian");
    } else if (cmd === "date") {
      termBuffer.push(new Date().toLocaleString("zh-CN"));
    } else if (cmd === "dir") {
      termBuffer.push(" 驱动器 C 中的卷是 WINDOWS13", " 卷的序列号是 13A7-9C21", "", " C:\\Users\\YellowBlue 的目录", "");
      termBuffer.push(" 2026/11/11  20:45    <DIR>          桌面", " 2026/11/11  19:22    <DIR>          文档", " 2026/11/10  21:08    <DIR>          图片", " 2026/11/09  16:12            186,880 产品路线图 2026.docx", "               1 个文件        186,880 字节", "");
    } else if (cmd === "echo") {
      termBuffer.push(rest || "");
    } else if (cmd === "theme") {
      if (rest === "dark" || rest === "light") {
        state.theme = rest;
        W13.applyState();
        termBuffer.push("主题已切换为 " + rest + "。");
      } else {
        termBuffer.push("用法：theme dark|light");
      }
    } else if (cmd === "open") {
      const apps = ["explorer", "browser", "settings", "photos", "notepad", "calculator"];
      if (apps.indexOf(rest) !== -1) {
        W13.openApp(rest);
        termBuffer.push("正在打开 " + rest + "…");
      } else {
        termBuffer.push("未知应用：" + rest + "。可用：" + apps.join(", "));
      }
    } else if (cmd === "clear" || cmd === "cls") {
      termBuffer = [];
    } else if (cmd === "neofetch") {
      termBuffer.push(
        "        ▄▄▄▄▄▄▄        yellowblue@YELLOWBLUE-13",
        "      ▄█████████▄      -------------------------",
        "     █████████████     OS: Windows 13 Pro 25H2",
        "     █████████████     Kernel: Solar Core 13.0",
        "      ▀█████████▀      Shell: W13 Terminal",
        "        ▀▀▀▀▀▀▀        Theme: YellowBlue / Tide",
        "                       Memory: 6.2 GB / 16 GB",
        ""
      );
    } else {
      termBuffer.push("'" + cmd + "' 不是内部或外部命令，也不是可运行的程序。输入 help 查看命令。");
    }
    termRender(win);
    const inputEl = win.querySelector(".term-input");
    if (inputEl) inputEl.value = "";
  }

  function termBind(win) {
    const root = win.querySelector(".window-content > .terminal-app");
    if (!root) return;
    const inputEl = root.querySelector(".term-input");
    if (inputEl) {
      inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          termHistory.push(inputEl.value);
          termRun(win, inputEl.value);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          termHistory.index = Math.max(0, (termHistory.index == null ? termHistory.length : termHistory.index) - 1);
          inputEl.value = termHistory[termHistory.index] || "";
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          termHistory.index = Math.min(termHistory.length, (termHistory.index == null ? 0 : termHistory.index) + 1);
          inputEl.value = termHistory[termHistory.index] || "";
        }
      });
    }
    root.addEventListener("click", (e) => {
      if (e.target.closest(".term-screen") && inputEl) inputEl.focus();
    });
    termRender(win);
    if (inputEl) setTimeout(() => inputEl.focus(), 200);
  }

  W13.registerApp("terminal", {
    name: "Windows Terminal",
    width: 780,
    height: 480,
    minWidth: 420,
    minHeight: 280,
    render() {
      termBuffer = TERM_BANNER.slice();
      termHistory = [];
      return (
        '<div class="terminal-app"><div class="terminal-bar"><span class="terminal-tab">' + icon("terminal") + " Windows PowerShell</span>" +
        '<span class="terminal-actions">' + icon("more-horizontal") + "</span></div>" +
        '<div class="term-screen"><div class="term-output"></div>' +
        '<div class="term-row">' + termPromptHTML() + '<input class="term-input" type="text" aria-label="终端输入" autocomplete="off" spellcheck="false"></div></div></div>'
      );
    },
    init(win) { termBind(win); }
  });
})();
