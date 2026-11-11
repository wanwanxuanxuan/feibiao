/* Windows 13 · File Explorer */
(function () {
  "use strict";
  const W13 = window.W13;
  const { icon, escapeHTML, showToast } = W13;

  /* ---------------- shared file data ---------------- */

  W13.FILES = W13.FILES || {
    "Solar Tide.txt": [
      "Solar Tide · Windows 13",
      "----------------------------",
      "",
      "欢迎来到黄蓝桌面。",
      "",
      "这是一台属于未来的概念设备：深邃的潮汐蓝，",
      "搭配日出时分的琥珀金。窗口是半透明的，",
      "图标是圆润的，每一次点击都像潮水漫过沙滩。",
      "",
      "你可以：",
      "  · 在设置里换一张壁纸，或者换一种强调色",
      "  · 用 Edge 浏览概念版的新标签页",
      "  · 在文件资源管理器里整理你的项目",
      "  · 按 Win + G 打开游戏栏（如果它真的存在）",
      "",
      "愿你的每一天，都有一点点黄和一点点蓝。",
      "",
      "— 黄蓝工作室，2026"
    ].join("\n"),
    "Windows 13 概念稿.txt": [
      "Windows 13 概念稿 · Revision 07",
      "",
      "设计关键词：潮汐、日冕、玻璃、秩序。",
      "",
      "1. 桌面",
      "   壁纸是一幅可呼吸的海面。太阳不是装饰，",
      "   而是整个色板的锚点：所有蓝色都向它退让。",
      "",
      "2. 窗口",
      "   12px 圆角，亚克力模糊，1px 内高光。",
      "   标题栏不再喧宾夺主，内容才是主角。",
      "",
      "3. 任务栏",
      "   居中的开始按钮，像一枚悬浮的日蚀。",
      "",
      "4. 动效",
      "   所有过渡都慢半拍，让界面有潮汐的呼吸感。",
      "",
      "下一步：完善设置页的更新流程与辅助功能。"
    ].join("\n"),
    "产品路线图 2026.docx": [
      "Windows 13 · 产品路线图 2026",
      "",
      "Q1  黄蓝设计语言 2.0",
      "    · 动态壁纸引擎",
      "    · 全新的开始菜单与搜索",
      "",
      "Q2  多任务与窗口",
      "    · 窗口布局建议",
      "    · 跨设备接力",
      "",
      "Q3  智能与隐私",
      "    · 本地 AI 摘要",
      "    · 透明的权限面板",
      "",
      "Q4  生态",
      "    · Edge 与 Store 全面整合",
      "    · 创作者主题市场",
      "",
      "目标：让每一次开机都像一次日出。"
    ].join("\n"),
    "会议纪要.md": [
      "# 设计评审 · 11 月 11 日",
      "",
      "参会：黄蓝少年、林工、Aria",
      "",
      "## 结论",
      "- 壁纸的太阳再暖 4%，蓝色不要偏紫",
      "- 设置页信息密度可以再高一点",
      "- 任务栏高度统一为 52px",
      "",
      "## 待办",
      "- [x] 完成桌面外壳",
      "- [x] 完成窗口管理器",
      "- [ ] 浏览器搜索页文案润色",
      "- [ ] 补充辅助功能演示"
    ].join("\n"),
    "设计说明.pdf": [
      "Windows 13 设计说明（节选）",
      "",
      "色彩：以 #0b3674 为深海，以 #ffc83d 为日冕。",
      "界面中 70% 是蓝，20% 是中性表面，10% 是金。",
      "",
      "字体：Segoe UI Variable Display 用于标题，",
      "中文回退到微软雅黑 UI / 苹方。",
      "",
      "圆角：窗口 12，卡片 10，按钮 6。",
      "",
      "这是概念，不是承诺。"
    ].join("\n")
  };

  W13.PHOTO_MAP = W13.PHOTO_MAP || {
    "Solar Tide 壁纸.png": "art-1",
    "Lagoon Morning.png": "art-2",
    "Amber Dusk.png": "art-3",
    "Midnight Gold.png": "art-4",
    "潮汐金环.png": "art-1",
    "泻湖晨光.png": "art-2",
    "琥珀余晖.png": "art-3",
    "午夜金光.png": "art-4"
  };

  const PHOTO_TITLES = {
    "art-1": "潮汐金环", "art-2": "泻湖晨光", "art-3": "琥珀余晖", "art-4": "午夜金光"
  };
  W13.PHOTO_TITLES = W13.PHOTO_TITLES || PHOTO_TITLES;

  function folder(name, folderId, modified, extra) {
    return Object.assign({ name: name, kind: "folder", folder: folderId, modified: modified || "2026/11/08 14:20", size: "—" }, extra || {});
  }
  function file(name, size, modified) {
    return { name: name, kind: "file", size: size || "128 KB", modified: modified || "2026/11/10 09:30" };
  }

  const FOLDERS = {
    home: { name: "主页", kind: "home", items: [] },
    pc: { name: "此电脑", kind: "drives", items: [] },
    recycle: { name: "回收站", kind: "recycle", items: [] },
    desktop: {
      name: "桌面", parent: "home", path: ["桌面"],
      items: [folder("Windows 13 项目", "project"), folder("潮汐素材", "assets"), file("Solar Tide.txt", "4 KB", "2026/11/11 20:45"), file("产品路线图 2026.docx", "186 KB", "2026/11/09 16:12")]
    },
    documents: {
      name: "文档", parent: "pc", path: ["此电脑", "文档"],
      items: [
        folder("Windows 13 项目", "project", "2026/11/10 18:04"),
        file("Windows 13 概念稿.txt", "12 KB", "2026/11/11 19:22"),
        file("产品路线图 2026.docx", "186 KB", "2026/11/09 16:12"),
        file("会议纪要.md", "6 KB", "2026/11/11 09:40"),
        file("预算 2027.xlsx", "94 KB", "2026/11/06 11:05"),
        file("设计说明.pdf", "2.4 MB", "2026/11/04 15:38")
      ]
    },
    project: {
      name: "Windows 13 项目", parent: "documents", path: ["文档", "Windows 13 项目"],
      items: [
        folder("潮汐素材", "assets", "2026/11/08 17:30"),
        folder("归档", "archive", "2026/10/21 10:12"),
        file("Windows 13 概念稿.txt", "12 KB", "2026/11/11 19:22"),
        file("产品路线图 2026.docx", "186 KB", "2026/11/09 16:12"),
        file("会议纪要.md", "6 KB", "2026/11/11 09:40"),
        file("设计说明.pdf", "2.4 MB", "2026/11/04 15:38")
      ]
    },
    assets: {
      name: "潮汐素材", parent: "project", path: ["Windows 13 项目", "潮汐素材"],
      items: [
        file("Solar Tide 壁纸.png", "6.2 MB", "2026/11/10 21:08"),
        file("Lagoon Morning.png", "5.8 MB", "2026/11/10 21:09"),
        file("Amber Dusk.png", "5.1 MB", "2026/11/10 21:10"),
        file("Midnight Gold.png", "6.6 MB", "2026/11/10 21:11")
      ]
    },
    archive: {
      name: "归档", parent: "project", path: ["Windows 13 项目", "归档"],
      items: [file("旧版桌面 v1.zip", "48 MB", "2026/09/18 13:34"), file("字体授权.pdf", "820 KB", "2026/08/02 10:00")]
    },
    pictures: {
      name: "图片", parent: "pc", path: ["此电脑", "图片"],
      items: [
        file("Solar Tide 壁纸.png", "6.2 MB", "2026/11/10 21:08"),
        file("Lagoon Morning.png", "5.8 MB", "2026/11/10 21:09"),
        file("Amber Dusk.png", "5.1 MB", "2026/11/10 21:10"),
        file("Midnight Gold.png", "6.6 MB", "2026/11/10 21:11"),
        folder("截图", "screenshots")
      ]
    },
    screenshots: {
      name: "截图", parent: "pictures", path: ["图片", "截图"],
      items: [file("桌面预览.png", "1.8 MB", "2026/11/11 18:02"), file("设置界面.png", "1.2 MB", "2026/11/10 14:26")]
    },
    downloads: {
      name: "下载", parent: "home", path: ["下载"],
      items: [file("EdgeSetup.exe", "84 MB", "2026/11/07 20:15"), file("wallpaper-pack.zip", "126 MB", "2026/11/05 12:41"), file("字体包.zip", "38 MB", "2026/10/30 09:12")]
    },
    music: {
      name: "音乐", parent: "pc", path: ["此电脑", "音乐"],
      items: [file("Solar Tide.mp3", "8.4 MB", "2026/11/01 22:10"), file("Amber Horizon.flac", "42 MB", "2026/11/01 22:12")]
    },
    videos: {
      name: "视频", parent: "pc", path: ["此电脑", "视频"],
      items: [file("桌面演示.mp4", "128 MB", "2026/10/28 19:30"), file("潮汐循环.mp4", "64 MB", "2026/10/28 19:36")]
    }
  };

  let recycleItems = [
    Object.assign(file("旧版图标.png", "640 KB", "2026/10/17 11:20"), { trashed: "2026/11/02" }),
    Object.assign(file("临时草稿.txt", "2 KB", "2026/10/30 08:44"), { trashed: "2026/11/06" }),
    Object.assign(folder("未命名文件夹", "custom-trash"), { trashed: "2026/11/09" })
  ];

  const CUSTOM_PATH = ["桌面"];
  const QUICK_FOLDERS = ["desktop", "downloads", "documents", "pictures"];

  W13.customFolders = W13.customFolders || {};

  /* ---------------- helpers ---------------- */

  function extOf(name) {
    const parts = String(name).split(".");
    return parts.length > 1 ? parts.pop().toLowerCase() : "";
  }
  function kindOf(name) {
    const ext = extOf(name);
    if (["png", "jpg", "jpeg", "gif", "webp", "bmp"].indexOf(ext) !== -1) return "image";
    if (ext === "txt" || ext === "md") return "txt";
    if (ext === "doc" || ext === "docx") return "doc";
    if (ext === "xls" || ext === "xlsx" || ext === "csv") return "xls";
    if (ext === "pdf") return "pdf";
    if (ext === "zip" || ext === "rar" || ext === "7z") return "zip";
    if (ext === "mp3" || ext === "flac" || ext === "wav") return "audio";
    if (ext === "mp4" || ext === "mov" || ext === "mkv") return "video";
    return "doc";
  }
  function miniIcon(name) {
    const kind = kindOf(name);
    const cls = kind === "image" ? "img" : kind;
    return '<span class="mini-file-icon ' + cls + '"></span>';
  }
  function artFor(name, index) {
    return W13.PHOTO_MAP[name] || ("art-" + ((index || 0) % 4 + 1));
  }
  function fileArt(item, index) {
    if (item.kind === "folder") return '<span class="folder-glyph"></span>';
    if (kindOf(item.name) === "image") return '<span class="art-thumb ' + artFor(item.name, index) + '"></span>';
    return miniIcon(item.name);
  }
  function folderItems(id) {
    if (W13.customFolders[id]) return W13.customFolders[id].items || [];
    return (FOLDERS[id] && FOLDERS[id].items) || [];
  }
  function folderName(id) {
    if (W13.customFolders[id]) return W13.customFolders[id].name;
    return (FOLDERS[id] && FOLDERS[id].name) || "文件夹";
  }
  function folderParent(id) {
    if (W13.customFolders[id]) return "desktop";
    return (FOLDERS[id] && FOLDERS[id].parent) || "home";
  }
  function sortItems(items, mode) {
    const list = items.slice();
    list.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      if (mode === "date") return String(b.modified).localeCompare(String(a.modified));
      return a.name.localeCompare(b.name, "zh-CN");
    });
    return list;
  }
  function crumbsFor(id) {
    if (id === "home") return [{ label: "主页", folder: "home" }];
    if (id === "pc") return [{ label: "此电脑", folder: "pc" }];
    if (id === "recycle") return [{ label: "回收站", folder: "recycle" }];
    if (W13.customFolders[id]) return [{ label: "桌面", folder: "desktop" }, { label: W13.customFolders[id].name }];
    const meta = FOLDERS[id];
    if (!meta) return [{ label: "主页", folder: "home" }];
    const out = (meta.path || [meta.name]).map((label, i, arr) => {
      if (i === arr.length - 1) return { label: label, folder: id };
      if (label === "此电脑") return { label: label, folder: "pc" };
      return { label: label };
    });
    return out;
  }

  function findFileGlobal(name) {
    let found = null;
    Object.keys(FOLDERS).forEach((id) => {
      FOLDERS[id].items.forEach((item) => {
        if (item.kind === "file" && item.name === name && !found) found = Object.assign({ folder: id }, item);
      });
    });
    if (!found) {
      recycleItems.forEach((item) => {
        if (item.name === name && !found) found = Object.assign({ folder: "recycle" }, item);
      });
    }
    return found;
  }

  /* ---------------- tabs & window state ---------------- */

  let tabs = [];
  let activeTab = 0;
  let tabSeq = 0;
  let currentWin = null;

  function newTab(folderId, activate) {
    const id = ++tabSeq;
    tabs.push({ id: id, folder: folderId || "home", history: [folderId || "home"], histIndex: 0, view: "grid", query: "", selected: null, sort: "name" });
    if (activate !== false) activeTab = tabs.length - 1;
    return tabs[tabs.length - 1];
  }
  function tab() { return tabs[activeTab]; }

  function navigate(folderId, push) {
    const t = tab();
    if (!t) return;
    t.folder = folderId;
    t.selected = null;
    t.query = "";
    if (push !== false) {
      t.history = t.history.slice(0, t.histIndex + 1);
      t.history.push(folderId);
      t.histIndex = t.history.length - 1;
    }
    refresh();
  }

  /* ---------------- rendering ---------------- */

  function tabsHTML() {
    return tabs.map((t, i) =>
      '<button class="ex-tab' + (i === activeTab ? " active" : "") + '" data-tab="' + i + '">' +
      icon(t.folder === "recycle" ? "trash" : (t.folder === "pc" ? "monitor" : "folder")) +
      "<span>" + escapeHTML(folderName(t.folder)) + "</span>" +
      '<span class="tab-close" data-tab-close="' + i + '" role="button" aria-label="关闭标签页">' + icon("close") + "</span></button>"
    ).join("") +
      '<button class="ex-add-tab" data-add-tab title="新建标签页">' + icon("plus") + "</button>";
  }

  function crumbsHTML(t) {
    const crumbs = crumbsFor(t.folder);
    return crumbs.map((c, i) =>
      (i ? '<span class="ex-crumb-sep">›</span>' : "") +
      '<button class="ex-crumb" ' + (c.folder ? 'data-crumb="' + c.folder + '"' : "") + ">" +
      (i === 0 ? icon(c.folder === "pc" ? "monitor" : (c.folder === "recycle" ? "trash" : (c.folder === "home" ? "home" : "folder"))) : "") +
      "<span>" + escapeHTML(c.label) + "</span></button>"
    ).join("");
  }

  function toolbarHTML(t) {
    const canBack = t.histIndex > 0;
    const canForward = t.histIndex < t.history.length - 1;
    return (
      '<div class="ex-toolbar">' +
      '<div class="ex-nav-btns">' +
      '<button class="ex-nav-btn" data-nav="back" aria-label="后退"' + (canBack ? "" : " disabled") + ">" + icon("chevron-left") + "</button>" +
      '<button class="ex-nav-btn" data-nav="forward" aria-label="前进"' + (canForward ? "" : " disabled") + ">" + icon("chevron-right") + "</button>" +
      '<button class="ex-nav-btn" data-nav="up" aria-label="向上"' + (t.folder === "home" || t.folder === "pc" ? " disabled" : "") + ">" + icon("arrow-up") + "</button>" +
      '<button class="ex-nav-btn" data-nav="refresh" aria-label="刷新">' + icon("refresh") + "</button>" +
      "</div>" +
      '<div class="ex-address">' + crumbsHTML(t) + "</div>" +
      '<div class="ex-search">' + icon("search") +
      '<input type="text" id="ex-search-input" placeholder="搜索" aria-label="搜索" value="' + escapeHTML(t.query) + '"></div>' +
      "</div>"
    );
  }

  function commandbarHTML(t) {
    const hasSel = !!t.selected;
    return (
      '<div class="ex-commandbar">' +
      '<button class="ex-command" data-ex-action="new">' + icon("plus") + "<span>新建</span>" + icon("chevron-down", "chev") + "</button>" +
      '<span class="ex-command-sep"></span>' +
      '<button class="ex-command" data-ex-action="copy"' + (hasSel ? "" : " disabled") + ">" + icon("copy") + "<span>复制</span></button>" +
      '<button class="ex-command" data-ex-action="cut"' + (hasSel ? "" : " disabled") + ">" + icon("cut") + "<span>剪切</span></button>" +
      '<button class="ex-command" data-ex-action="rename"' + (hasSel ? "" : " disabled") + ">" + icon("edit") + "<span>重命名</span></button>" +
      '<button class="ex-command" data-ex-action="delete"' + (hasSel ? "" : " disabled") + ">" + icon("trash") + "<span>删除</span></button>" +
      '<span class="ex-command-sep"></span>' +
      '<button class="ex-command" data-ex-action="share">' + icon("share") + "<span>共享</span></button>" +
      '<button class="ex-command" data-ex-action="sort">' + icon("sort") + "<span>排序</span></button>" +
      '<span class="ex-command-spacer"></span>' +
      '<div class="ex-view-switch">' +
      '<button data-view="grid" class="' + (t.view === "grid" ? "active" : "") + '" aria-label="网格视图">' + icon("grid") + "</button>" +
      '<button data-view="list" class="' + (t.view === "list" ? "active" : "") + '" aria-label="列表视图">' + icon("list") + "</button>" +
      "</div>" +
      '<button class="ex-command" data-ex-action="details" title="详细信息">' + icon("panel") + "</button>" +
      "</div>"
    );
  }

  function sideHTML(t) {
    const custom = Object.keys(W13.customFolders).map((id) =>
      '<button class="ex-side-item' + (t.folder === id ? " active" : "") + '" data-side="' + escapeHTML(id) + '">' +
      icon("folder") + "<span>" + escapeHTML(W13.customFolders[id].name) + "</span></button>"
    ).join("");
    return (
      '<div class="ex-side-group">' +
      '<button class="ex-side-item' + (t.folder === "home" ? " active" : "") + '" data-side="home">' + icon("home") + "<span>主页</span></button>" +
      '<button class="ex-side-item' + (t.folder === "pictures" ? " active" : "") + '" data-side="pictures">' + icon("image") + "<span>图库</span></button>" +
      "</div>" +
      '<div class="ex-side-title">快速访问</div>' +
      '<div class="ex-side-group">' +
      '<button class="ex-side-item' + (t.folder === "desktop" ? " active" : "") + '" data-side="desktop">' + icon("monitor") + "<span>桌面</span></button>" +
      '<button class="ex-side-item' + (t.folder === "downloads" ? " active" : "") + '" data-side="downloads">' + icon("download") + "<span>下载</span></button>" +
      '<button class="ex-side-item' + (t.folder === "documents" ? " active" : "") + '" data-side="documents">' + icon("file-text") + "<span>文档</span></button>" +
      '<button class="ex-side-item' + (t.folder === "pictures" ? " active" : "") + '" data-side="pictures">' + icon("image") + "<span>图片</span></button>" +
      '<button class="ex-side-item' + (t.folder === "music" ? " active" : "") + '" data-side="music">' + icon("volume") + "<span>音乐</span></button>" +
      '<button class="ex-side-item' + (t.folder === "videos" ? " active" : "") + '" data-side="videos">' + icon("play") + "<span>视频</span></button>" +
      custom +
      "</div>" +
      '<div class="ex-side-title">此电脑</div>' +
      '<div class="ex-side-group">' +
      '<button class="ex-side-item' + (t.folder === "pc" ? " active" : "") + '" data-side="pc">' + icon("monitor") + "<span>此电脑</span></button>" +
      '<button class="ex-side-item' + (t.folder === "recycle" ? " active" : "") + '" data-side="recycle">' + icon("trash") + "<span>回收站</span></button>" +
      "</div>" +
      '<div class="ex-side-drive">' +
      '<div class="ex-drive-row"><div class="ex-drive-row-head"><span>Windows (C:)</span><span>71%</span></div><div class="ex-drive-bar"><i style="width:71%"></i></div></div>' +
      '<div class="ex-drive-row"><div class="ex-drive-row-head"><span>Data (D:)</span><span>32%</span></div><div class="ex-drive-bar"><i style="width:32%"></i></div></div>' +
      "</div>"
    );
  }

  function homeHTML() {
    const quick = QUICK_FOLDERS.map((id) =>
      '<button class="quick-folder" data-side="' + id + '">' + '<span class="folder-glyph' + (id === "pictures" ? " blue" : "") + '"></span>' +
      "<div><b>" + folderName(id) + "</b><span>" + folderItems(id).length + " 个项目</span></div></button>"
    ).join("");
    const recents = [
      { name: "Solar Tide.txt", location: "桌面", meta: "今天 20:45", size: "4 KB", folder: "desktop" },
      { name: "Windows 13 概念稿.txt", location: "文档", meta: "今天 19:22", size: "12 KB", folder: "documents" },
      { name: "产品路线图 2026.docx", location: "文档", meta: "昨天 16:12", size: "186 KB", folder: "documents" },
      { name: "Solar Tide 壁纸.png", location: "图片", meta: "昨天 21:08", size: "6.2 MB", folder: "pictures" },
      { name: "会议纪要.md", location: "文档", meta: "今天 09:40", size: "6 KB", folder: "documents" }
    ].map((r) =>
      '<button class="recent-row" data-open-file="' + escapeHTML(r.name) + '">' +
      '<span class="recent-name">' + (kindOf(r.name) === "image" ? '<span class="mini-file-icon img"></span>' : miniIcon(r.name)) + "<span>" + escapeHTML(r.name) + "</span></span>" +
      "<span>" + escapeHTML(r.location) + "</span><span>" + r.meta + "</span><span>" + r.size + "</span></button>"
    ).join("");
    return (
      '<div class="ex-home-head"><div><h2>欢迎回来，黄蓝少年</h2><p>这是你的文件宇宙 · ' + new Date().getFullYear() + " 年 " + (new Date().getMonth() + 1) + " 月 " + new Date().getDate() + " 日</p></div>" +
      '<span class="ex-greeting-chip">' + icon("sparkles") + " 潮汐状态：平静</span></div>" +
      '<div class="ex-section-head"><span>快速访问</span><button data-side="pc">查看此电脑</button></div>' +
      '<div class="quick-folders">' + quick + "</div>" +
      '<div class="ex-section-head"><span>最近使用</span><button data-ex-action="recent">全部</button></div>' +
      '<div class="recent-list">' + recents + "</div>" +
      '<div class="ex-section-head"><span>设备和驱动器</span><button data-side="pc">管理</button></div>' +
      '<div class="drives-panel">' +
      '<div class="drive-card"><span class="drive-icon"></span><div class="drive-info"><b>Windows (C:)</b><span>356 GB 可用，共 1 TB</span><div class="ex-drive-bar"><i style="width:71%"></i></div></div></div>' +
      '<div class="drive-card"><span class="drive-icon"></span><div class="drive-info"><b>Data (D:)</b><span>680 GB 可用，共 1 TB</span><div class="ex-drive-bar"><i style="width:32%"></i></div></div></div>' +
      "</div>"
    );
  }

  function pcHTML() {
    return (
      '<div class="ex-header"><div class="ex-header-main">' + '<span class="folder-glyph blue"></span><div><h2>此电脑</h2><p>2 个驱动器 · 5 个文件夹</p></div></div>' +
      '<div class="ex-header-actions"><span class="ex-chip">设备：YELLOWBLUE-13</span></div></div>' +
      '<div class="ex-section-head"><span>设备和驱动器</span><button data-ex-action="refresh">刷新</button></div>' +
      '<div class="drives-panel">' +
      '<div class="drive-card"><span class="drive-icon"></span><div class="drive-info"><b>Windows (C:)</b><span>356 GB 可用，共 1 TB</span><div class="ex-drive-bar"><i style="width:71%"></i></div></div></div>' +
      '<div class="drive-card"><span class="drive-icon"></span><div class="drive-info"><b>Data (D:)</b><span>680 GB 可用，共 1 TB</span><div class="ex-drive-bar"><i style="width:32%"></i></div></div></div>' +
      "</div>" +
      '<div class="ex-section-head"><span>文件夹</span><span style="font-size:8.5px;color:var(--muted);font-weight:400">6 项</span></div>' +
      '<div class="quick-folders">' +
      ["desktop", "documents", "downloads", "pictures", "music", "videos"].map((id) =>
        '<button class="quick-folder" data-side="' + id + '"><span class="folder-glyph"></span><div><b>' + folderName(id) + "</b><span>" + folderItems(id).length + " 个项目</span></div></button>"
      ).join("") +
      "</div>"
    );
  }

  function recycleHTML() {
    const list = recycleItems.length
      ? '<div class="file-grid">' + recycleItems.map((item, i) =>
          '<button class="file-card" data-recycle="' + i + '"><span class="file-card-art">' + (item.kind === "folder" ? '<span class="folder-glyph"></span>' : miniIcon(item.name)) + "</span>" +
          "<b>" + escapeHTML(item.name) + "</b><small>删除于 " + escapeHTML(item.trashed || "2026/11/02") + "</small></button>"
        ).join("") + "</div>"
      : '<div class="ex-empty">' + icon("trash") + "<b>回收站是空的</b><span>删除的文件会暂时出现在这里</span></div>";
    return (
      '<div class="ex-header"><div class="ex-header-main"><span class="app-mark recycle" style="width:35px;height:35px">' + icon("trash") + "</span>" +
      "<div><h2>回收站</h2><p>" + recycleItems.length + " 个项目 · 删除的项目会保留 30 天</p></div></div>" +
      '<div class="ex-header-actions"><button class="btn ghost" data-ex-action="empty-recycle">清空回收站</button></div></div>' + list
    );
  }

  function headerHTML(t, items) {
    const name = folderName(t.folder);
    const isPic = t.folder === "pictures" || t.folder === "assets";
    return (
      '<div class="ex-header"><div class="ex-header-main"><span class="folder-glyph' + (isPic ? " blue" : "") + '"></span>' +
      '<div><h2>' + escapeHTML(t.query ? "搜索：" + t.query : name) + "</h2><p>" + (t.query ? items.length + " 个结果" : items.length + " 个项目") + "</p></div></div>" +
      '<div class="ex-header-actions"><button class="btn ghost" data-ex-action="new">' + icon("folder-plus") + "新建文件夹</button></div></div>"
    );
  }

  function gridHTML(t, items) {
    return '<div class="file-grid">' + items.map((item, i) =>
      '<button class="file-card' + (t.selected === item.name ? " selected" : "") + '" data-item="' + escapeHTML(item.name) + '" data-kind="' + item.kind + '" data-folder="' + escapeHTML(item.folder || "") + '">' +
      '<span class="file-card-art">' + fileArt(item, i) + "</span>" +
      "<b>" + escapeHTML(item.name) + "</b><small>" + (item.kind === "folder" ? "文件夹" : escapeHTML(item.size)) + "</small></button>"
    ).join("") + "</div>";
  }

  function listHTML(t, items) {
    return (
      '<div class="file-list"><div class="file-list-head"><span>名称</span><span>修改日期</span><span>类型</span><span>大小</span></div>' +
      items.map((item) =>
        '<button class="file-list-row' + (t.selected === item.name ? " selected" : "") + '" data-item="' + escapeHTML(item.name) + '" data-kind="' + item.kind + '" data-folder="' + escapeHTML(item.folder || "") + '">' +
        '<span class="file-list-name">' + (item.kind === "folder" ? '<span class="folder-glyph"></span>' : miniIcon(item.name)) + "<span>" + escapeHTML(item.name) + "</span></span>" +
        "<span>" + escapeHTML(item.modified) + "</span>" +
        "<span>" + (item.kind === "folder" ? "文件夹" : kindOf(item.name).toUpperCase() + " 文件") + "</span>" +
        "<span>" + (item.kind === "folder" ? "—" : escapeHTML(item.size)) + "</span></button>"
      ).join("") + "</div>"
    );
  }

  function contentHTML(t) {
    if (t.folder === "home") return homeHTML();
    if (t.folder === "pc") return pcHTML();
    if (t.folder === "recycle") return recycleHTML();
    let items = folderItems(t.folder).slice();
    if (t.query.trim()) {
      const q = t.query.trim().toLowerCase();
      items = items.filter((item) => item.name.toLowerCase().includes(q));
    }
    items = sortItems(items, t.sort);
    const body = items.length
      ? (t.view === "grid" ? gridHTML(t, items) : listHTML(t, items))
      : '<div class="ex-empty">' + icon("folder") + "<b>" + (t.query ? "没有匹配的项目" : "此文件夹为空") + "</b><span>" +
        (t.query ? "试试其他关键词" : "右键桌面或点击“新建文件夹”开始整理") + "</span></div>";
    return headerHTML(t, items) + body;
  }

  function detailsHTML(t) {
    if (t.folder === "home" || t.folder === "pc" || t.folder === "recycle" || !t.selected) {
      return '<div class="ex-details-head">详细信息</div><div class="ex-details-empty">' + icon("info") + "<div>选择一个文件<br>以查看详细信息</div></div>";
    }
    const item = folderItems(t.folder).find((it) => it.name === t.selected);
    if (!item) return '<div class="ex-details-head">详细信息</div><div class="ex-details-empty">没有选择项目</div>';
    const preview = item.kind === "folder" ? '<span class="folder-glyph"></span>'
      : kindOf(item.name) === "image" ? '<span class="art-thumb ' + artFor(item.name) + '"></span>'
      : '<span class="icon-wrap">' + icon(kindOf(item.name) === "txt" ? "file-text" : "file-text") + "</span>";
    return (
      '<div class="ex-details-head">详细信息</div>' +
      '<div class="ex-details-preview">' + preview + "</div>" +
      '<div class="ex-details-name">' + escapeHTML(item.name) + "</div>" +
      '<div class="ex-details-sub">' + (item.kind === "folder" ? "文件夹" : kindOf(item.name).toUpperCase() + " 文件") + "</div>" +
      '<div class="ex-detail-row"><span>类型</span><b>' + (item.kind === "folder" ? "文件夹" : kindOf(item.name).toUpperCase() + " 文件") + "</b></div>" +
      '<div class="ex-detail-row"><span>大小</span><b>' + (item.kind === "folder" ? "—" : escapeHTML(item.size)) + "</b></div>" +
      '<div class="ex-detail-row"><span>修改日期</span><b>' + escapeHTML(item.modified) + "</b></div>" +
      '<div class="ex-detail-row"><span>位置</span><b>' + escapeHTML(folderName(t.folder)) + "</b></div>" +
      '<button class="btn primary" data-open-selected style="width:100%;margin-top:10px">' + (item.kind === "folder" ? "打开文件夹" : "打开文件") + "</button>" +
      '<div class="ex-detail-hint">双击即可' + (item.kind === "folder" ? "打开文件夹" : "使用默认应用打开") + "。这是概念系统中的模拟文件。</div>"
    );
  }

  function renderContent() {
    if (!currentWin) return;
    const t = tab();
    if (!t) return;
    const tabsEl = currentWin.querySelector("#ex-tabs");
    if (tabsEl) tabsEl.innerHTML = tabsHTML();
    const toolbar = currentWin.querySelector("#ex-toolbar-slot");
    if (toolbar) toolbar.innerHTML = toolbarHTML(t);
    const cmd = currentWin.querySelector("#ex-command-slot");
    if (cmd) cmd.innerHTML = commandbarHTML(t);
    const side = currentWin.querySelector("#ex-side");
    if (side) side.innerHTML = sideHTML(t);
    const content = currentWin.querySelector("#ex-content");
    if (content) content.innerHTML = contentHTML(t);
    const details = currentWin.querySelector("#ex-details");
    if (details) {
      details.classList.toggle("hidden", !detailsVisible);
      details.innerHTML = detailsHTML(t);
    }
    const search = currentWin.querySelector("#ex-search-input");
    if (search && document.activeElement !== search) search.value = t.query;
  }

  let detailsVisible = true;
  function refresh() { renderContent(); }

  /* ---------------- actions ---------------- */

  function selectedItem() {
    const t = tab();
    if (!t || !t.selected) return null;
    return folderItems(t.folder).find((it) => it.name === t.selected) || null;
  }

  function createFolder() {
    const t = tab();
    if (!t || ["home", "pc", "recycle"].indexOf(t.folder) !== -1) {
      showToast("无法在此创建", "请先打开一个文件夹。", "alert", 2200);
      return;
    }
    const count = Object.keys(W13.customFolders).length + 1;
    const id = "explorer-folder-" + Date.now();
    const name = "新建文件夹" + (count > 1 ? " (" + count + ")" : "");
    W13.customFolders[id] = { name: name, items: [] };
    if (W13.customFolders[t.folder]) {
      W13.customFolders[t.folder].items = W13.customFolders[t.folder].items || [];
      W13.customFolders[t.folder].items.push({ name: name, kind: "folder", folder: id, size: "—", modified: "刚刚" });
    } else {
      folderItems(t.folder).push({ name: name, kind: "folder", folder: id, size: "—", modified: "刚刚" });
    }
    t.selected = name;
    refresh();
    showToast("已新建文件夹", name + " 已创建。", "folder-plus", 2200);
  }

  function deleteSelected() {
    const t = tab();
    const item = selectedItem();
    if (!item) return;
    const arr = folderItems(t.folder);
    const idx = arr.indexOf(item);
    if (idx !== -1) arr.splice(idx, 1);
    recycleItems.unshift(Object.assign({}, item, { trashed: "刚刚" }));
    t.selected = null;
    refresh();
    showToast("已移至回收站", item.name + " 已删除。", "trash", 2400);
  }

  function openItem(item, itemFolder) {
    if (!item) return;
    if (item.kind === "folder") { navigate(item.folder); return; }
    if (W13.openFile) W13.openFile(item.name);
  }

  function bind(win) {
    currentWin = win;
    const root = win.querySelector(".window-content > .explorer-app");
    if (!root) return;

    root.addEventListener("click", (e) => {
      const closeTab = e.target.closest("[data-tab-close]");
      if (closeTab) {
        e.stopPropagation();
        const idx = Number(closeTab.dataset.tabClose);
        tabs.splice(idx, 1);
        if (!tabs.length) { W13.closeWindow(win); return; }
        activeTab = Math.min(activeTab, tabs.length - 1);
        refresh();
        return;
      }
      const tabBtn = e.target.closest("[data-tab]");
      if (tabBtn) { activeTab = Number(tabBtn.dataset.tab); refresh(); return; }
      if (e.target.closest("[data-add-tab]")) {
        if (tabs.length >= 5) { showToast("标签页已满", "最多同时打开 5 个标签页。", "info", 2000); return; }
        newTab("home");
        refresh();
        return;
      }
      const nav = e.target.closest("[data-nav]");
      if (nav) {
        const t = tab();
        const action = nav.dataset.nav;
        if (action === "back" && t.histIndex > 0) { t.histIndex--; t.folder = t.history[t.histIndex]; t.selected = null; t.query = ""; refresh(); }
        else if (action === "forward" && t.histIndex < t.history.length - 1) { t.histIndex++; t.folder = t.history[t.histIndex]; t.selected = null; t.query = ""; refresh(); }
        else if (action === "up") { navigate(folderParent(t.folder)); }
        else if (action === "refresh") { refresh(); showToast("已刷新", "文件列表是最新的。", "refresh", 1500); }
        return;
      }
      const crumb = e.target.closest("[data-crumb]");
      if (crumb) { navigate(crumb.dataset.crumb); return; }
      const side = e.target.closest("[data-side]");
      if (side) { navigate(side.dataset.side); return; }
      const view = e.target.closest("[data-view]");
      if (view) { tab().view = view.dataset.view; refresh(); return; }
      const openFile = e.target.closest("[data-open-file]");
      if (openFile) {
        if (W13.openFile) W13.openFile(openFile.dataset.openFile);
        return;
      }
      const recycle = e.target.closest("[data-recycle]");
      if (recycle) {
        const idx = Number(recycle.dataset.recycle);
        const item = recycleItems[idx];
        if (!item) return;
        recycleItems.splice(idx, 1);
        if (item.kind === "file") folderItems("documents").push(Object.assign({}, item));
        refresh();
        showToast("已还原", item.name + " 已还原到文档。", "restore", 2200);
        return;
      }
      if (e.target.closest("[data-open-selected]")) {
        const item = selectedItem();
        if (item) openItem(item);
        return;
      }
      const action = e.target.closest("[data-ex-action]");
      if (action) handleAction(action);
    });

    root.addEventListener("click", (e) => {
      const card = e.target.closest("[data-item]");
      if (!card) return;
      const t = tab();
      t.selected = card.dataset.item;
      if (!currentWin) return;
      currentWin.querySelectorAll("#ex-content [data-item]").forEach((node) => {
        node.classList.toggle("selected", node.dataset.item === t.selected);
      });
      const cmd = currentWin.querySelector("#ex-command-slot");
      if (cmd) cmd.innerHTML = commandbarHTML(t);
      const details = currentWin.querySelector("#ex-details");
      if (details) details.innerHTML = detailsHTML(t);
    });

    root.addEventListener("dblclick", (e) => {
      const card = e.target.closest("[data-item]");
      if (!card) return;
      const t = tab();
      const item = folderItems(t.folder).find((it) => it.name === card.dataset.item);
      if (item) openItem(item);
    });

    root.addEventListener("input", (e) => {
      const search = e.target.closest("#ex-search-input");
      if (!search) return;
      const t = tab();
      t.query = search.value;
      t.selected = null;
      const content = root.querySelector("#ex-content");
      if (content) content.innerHTML = contentHTML(t);
      const details = root.querySelector("#ex-details");
      if (details) details.innerHTML = detailsHTML(t);
    });

    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && e.target.id === "ex-search-input") {
        e.target.value = "";
        const t = tab();
        t.query = "";
        renderContent();
      }
    });
  }

  function handleAction(node) {
    const action = node.dataset.exAction;
    const t = tab();
    if (action === "new") { createFolder(); return; }
    if (action === "delete") { deleteSelected(); return; }
    if (action === "details") { detailsVisible = !detailsVisible; refresh(); return; }
    if (action === "sort") {
      t.sort = t.sort === "name" ? "date" : "name";
      refresh();
      showToast("排序方式", t.sort === "name" ? "按名称排序" : "按修改日期排序", "sort", 1600);
      return;
    }
    if (action === "copy") { showToast("已复制", (t.selected || "项目") + " 已复制到剪贴板。", "copy", 1800); return; }
    if (action === "cut") { showToast("已剪切", (t.selected || "项目") + " 将在粘贴后移动。", "cut", 1800); return; }
    if (action === "rename") { showToast("重命名", "概念文件系统已锁定演示名称。", "edit", 2000); return; }
    if (action === "share") { showToast("共享", "已生成“" + folderName(t.folder) + "”的共享链接（演示）。", "share", 2200); return; }
    if (action === "recent") { navigate("documents"); return; }
    if (action === "refresh") { refresh(); return; }
    if (action === "empty-recycle") {
      recycleItems = [];
      refresh();
      showToast("回收站已清空", "所有项目已被永久删除（演示）。", "trash", 2200);
      return;
    }
  }

  /* ---------------- app registration ---------------- */

  W13.registerApp("explorer", {
    name: "文件资源管理器",
    width: 940,
    height: 640,
    minWidth: 520,
    minHeight: 380,
    render(options) {
      tabs = [];
      activeTab = 0;
      detailsVisible = true;
      newTab((options && options.folder) || "home");
      return (
        '<div class="explorer-app">' +
        '<div class="ex-tabs" id="ex-tabs">' + tabsHTML() + "</div>" +
        '<div id="ex-toolbar-slot">' + toolbarHTML(tab()) + "</div>" +
        '<div id="ex-command-slot">' + commandbarHTML(tab()) + "</div>" +
        '<div class="ex-body">' +
        '<aside class="ex-side" id="ex-side">' + sideHTML(tab()) + "</aside>" +
        '<div class="ex-main"><div class="ex-content" id="ex-content">' + contentHTML(tab()) + "</div></div>" +
        '<aside class="ex-details" id="ex-details">' + detailsHTML(tab()) + "</aside>" +
        "</div></div>"
      );
    },
    init(win) { bind(win); },
    reopen(win, options) {
      currentWin = win;
      if (options && options.folder) navigate(options.folder);
      else refresh();
    },
    onClose() { currentWin = null; }
  });

  W13.openExplorerAt = function (folderId) {
    const win = W13.openWindows && W13.openWindows.get("explorer");
    if (win) {
      W13.openApp("explorer", { folder: folderId || "home" });
      return;
    }
    W13.openApp("explorer", { folder: folderId || "home" });
  };

  W13.openFile = function (name) {
    const info = findFileGlobal(name);
    const kind = kindOf(name);
    if (kind === "image") {
      W13.openApp("photos", { photo: W13.PHOTO_MAP[name] || artFor(name) });
      return;
    }
    if (kind === "audio") {
      showToast("正在播放", name + " · Windows 13 Media Player", "play", 2600);
      return;
    }
    if (kind === "video") {
      showToast("正在播放", name + " · 电影和电视", "play", 2600);
      return;
    }
    if (kind === "zip") {
      showToast("压缩文件", name + " 已准备好解压（演示）。", "zip", 2400);
      return;
    }
    W13.openApp("notepad", { file: name, content: (info && W13.FILES[name]) || null });
  };
})();
