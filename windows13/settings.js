/* Windows 13 · Settings */
(function () {
  "use strict";
  const W13 = window.W13;
  const { icon, escapeHTML, state, showToast, applyState } = W13;

  const NAV = [
    { group: "系统", items: [
      { id: "system", label: "系统", icon: "monitor", desc: "显示、声音、通知、电源" },
      { id: "bluetooth", label: "蓝牙和其他设备", icon: "devices", desc: "已连接的鼠标、键盘与音频" },
      { id: "network", label: "网络和 Internet", icon: "network", desc: "Wi-Fi、VPN、飞行模式" }
    ]},
    { group: "个性化", items: [
      { id: "personalization", label: "个性化", icon: "palette", desc: "壁纸、主题、强调色" },
      { id: "apps", label: "应用", icon: "apps", desc: "已安装的应用和默认应用" }
    ]},
    { group: "账户", items: [
      { id: "accounts", label: "账户", icon: "user", desc: "账户信息、同步和登录选项" }
    ]},
    { group: "时间和语言", items: [
      { id: "time", label: "时间和语言", icon: "language", desc: "日期、时间、语言和区域" }
    ]},
    { group: "游戏", items: [
      { id: "gaming", label: "游戏", icon: "gamepad", desc: "游戏栏、游戏模式和捕获" }
    ]},
    { group: "辅助功能", items: [
      { id: "accessibility", label: "辅助功能", icon: "accessibility", desc: "视觉、听觉和交互" }
    ]},
    { group: "隐私和安全性", items: [
      { id: "privacy", label: "隐私和安全性", icon: "shield", desc: "权限、诊断和安全性" },
      { id: "update", label: "Windows 更新", icon: "update", desc: "检查更新和更新历史" }
    ]}
  ];

  const PAGES = {
    system: { title: "系统", sub: "黄蓝设备 · Windows 13 Pro" },
    bluetooth: { title: "蓝牙和其他设备", sub: "管理已连接的外设" },
    network: { title: "网络和 Internet", sub: "YellowBlue · 已连接，安全" },
    personalization: { title: "个性化", sub: "让桌面属于你" },
    apps: { title: "应用", sub: "安装、默认应用和启动项" },
    accounts: { title: "账户", sub: "你的信息、同步与登录" },
    time: { title: "时间和语言", sub: "日期、时间、语言和区域" },
    gaming: { title: "游戏", sub: "游戏栏、模式与捕获" },
    accessibility: { title: "辅助功能", sub: "让 Windows 更符合你的需要" },
    privacy: { title: "隐私和安全性", sub: "控制应用权限和诊断数据" },
    update: { title: "Windows 更新", sub: "让设备保持最新" }
  };

  const SEARCH_ITEMS = [
    { page: "system", title: "显示", desc: "亮度、分辨率、缩放、夜间模式", icon: "display" },
    { page: "system", title: "声音", desc: "音量、输出设备、音频增强", icon: "volume" },
    { page: "system", title: "通知", desc: "通知和横幅提醒", icon: "bell" },
    { page: "system", title: "电源和电池", desc: "节能模式、电源模式", icon: "battery" },
    { page: "system", title: "存储", desc: "磁盘空间和存储感知", icon: "storage" },
    { page: "system", title: "关于此电脑", desc: "设备规格、Windows 规格", icon: "info" },
    { page: "bluetooth", title: "蓝牙", desc: "开启蓝牙并添加设备", icon: "bluetooth" },
    { page: "bluetooth", title: "打印机和扫描仪", desc: "添加打印机或扫描仪", icon: "print" },
    { page: "network", title: "Wi-Fi", desc: "YellowBlue 网络与已知网络", icon: "wifi" },
    { page: "network", title: "VPN", desc: "添加或管理虚拟专用网络", icon: "lock" },
    { page: "network", title: "飞行模式", desc: "关闭无线通信", icon: "airplane" },
    { page: "network", title: "移动热点", desc: "共享网络连接", icon: "wifi-router" },
    { page: "personalization", title: "背景", desc: "壁纸与桌面背景", icon: "image" },
    { page: "personalization", title: "颜色", desc: "主题色与强调色", icon: "palette" },
    { page: "personalization", title: "主题", desc: "深色、浅色和对比度", icon: "contrast" },
    { page: "personalization", title: "锁屏界面", desc: "锁屏图片和小组件", icon: "lock-screen" },
    { page: "apps", title: "已安装的应用", desc: "查看和卸载应用", icon: "apps" },
    { page: "apps", title: "默认应用", desc: "为文件类型选择默认应用", icon: "external" },
    { page: "accounts", title: "账户信息", desc: "黄蓝少年 · 本地账户", icon: "user" },
    { page: "accounts", title: "登录选项", desc: "Windows Hello 和密码", icon: "lock" },
    { page: "time", title: "日期和时间", desc: "自动设置时间和时区", icon: "clock" },
    { page: "time", title: "语言和区域", desc: "简体中文、中国", icon: "language" },
    { page: "gaming", title: "游戏栏", desc: "使用 Win+G 打开游戏栏", icon: "gamepad" },
    { page: "gaming", title: "游戏模式", desc: "优化游戏性能", icon: "sparkles" },
    { page: "accessibility", title: "文本大小", desc: "放大屏幕上的文字", icon: "zoom" },
    { page: "accessibility", title: "视觉效果", desc: "动画和透明效果", icon: "eye" },
    { page: "privacy", title: "位置", desc: "允许应用使用你的位置", icon: "location" },
    { page: "privacy", title: "相机", desc: "允许应用使用相机", icon: "camera" },
    { page: "privacy", title: "麦克风", desc: "允许应用使用麦克风", icon: "mic" },
    { page: "update", title: "检查更新", desc: "下载并安装最新更新", icon: "update" },
    { page: "update", title: "更新历史记录", desc: "已安装的质量更新", icon: "history" }
  ];

  const PREFS_KEY = "w13.prefs.v1";
  const DEFAULT_PREFS = {
    resolution: "2560 × 1600",
    scale: "150%",
    refresh: "120 Hz",
    hdr: false,
    dynamicRefresh: true,
    powerMode: "平衡",
    output: "扬声器 (Realtek® Audio)",
    printer: "未添加打印机",
    cursor: "默认",
    textScale: 100,
    language: "简体中文",
    region: "中国",
    timeZone: "(UTC+08:00) 北京、重庆、香港",
    signIn: "Windows Hello 人脸",
    installedFilter: "全部"
  };
  let prefs = Object.assign({}, DEFAULT_PREFS);
  try {
    prefs = Object.assign(prefs, JSON.parse(localStorage.getItem(PREFS_KEY) || "{}"));
  } catch (err) { /* ignore */ }
  function savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (err) { /* ignore */ }
  }

  let activePage = "system";
  let query = "";
  let currentWin = null;
  let updateTimer = null;
  let updateState = { running: false, value: 0, done: false };

  /* ---------------- small builders ---------------- */

  function sw(key, extra) {
    const on = !!state.toggles[key];
    return '<button class="switch' + (on ? " on" : "") + '" role="switch" aria-checked="' + on + '" data-setting-toggle="' + key + '"' + (extra || "") + "></button>";
  }
  function prefSw(key) {
    const on = !!prefs[key];
    return '<button class="switch' + (on ? " on" : "") + '" role="switch" aria-checked="' + on + '" data-pref-toggle="' + key + '"></button>';
  }
  function row(iconName, title, desc, control) {
    return (
      '<div class="setting-row"><span class="setting-icon">' + icon(iconName) + "</span>" +
      '<div class="setting-copy"><b>' + title + "</b>" + (desc ? "<p>" + desc + "</p>" : "") + "</div>" +
      '<div class="setting-control">' + control + "</div></div>"
    );
  }
  function card(iconName, title, desc, body, tone) {
    return (
      '<section class="settings-card"><header class="settings-card-head">' +
      '<span class="card-icon' + (tone ? " " + tone : "") + '">' + icon(iconName) + "</span>" +
      "<div><h3>" + title + "</h3>" + (desc ? "<p>" + desc + "</p>" : "") + "</div></header>" +
      '<div class="settings-card-body">' + body + "</div></section>"
    );
  }
  function selectRow(iconName, title, desc, prefKey, options) {
    return row(iconName, title, desc,
      '<select class="settings-select" data-pref="' + prefKey + '">' + options.map((opt) =>
        '<option' + (prefs[prefKey] === opt ? " selected" : "") + ">" + opt + "</option>"
      ).join("") + "</select>"
    );
  }
  function rangeBlock(label, value, attrs) {
    return (
      '<div class="range-block"><div class="range-block-head"><span>' + label + "</span><b>" + value + "</b></div>" +
      '<input type="range" ' + attrs + "></div>"
    );
  }

  /* ---------------- pages ---------------- */

  function pageSystem() {
    const battery = state.toggles.batterySaver ? "节能模式 · 18 小时" : "平衡 · 14 小时";
    return (
      '<div class="settings-page-inner">' +
      '<div class="settings-hero"><div class="settings-hero-copy">' +
      "<small>YELLOWBLUE STUDIO · 13 英寸</small><h2>黄蓝少年</h2>" +
      "<p>Windows 13 Pro · 潮汐金环</p>" +
      '<div class="hero-battery"><span class="battery-shell"><span class="battery-fill"></span></span><span>87% · ' + battery + "</span></div></div>" +
      '<div class="device-art"><div class="device-screen"></div><div class="device-base"></div></div></div>' +

      card("display", "显示", "亮度、分辨率和夜间模式",
        rangeBlock("亮度", state.brightness + "%", 'min="20" max="100" step="1" value="' + state.brightness + '" data-range="brightness"') +
        row("sun", "夜间模式", "让屏幕色调更温暖，减少蓝光", sw("nightLight")) +
        row("monitor", "分辨率", "推荐：2560 × 1600", '<select class="settings-select" data-pref="resolution"><option>2560 × 1600</option><option>1920 × 1200</option><option>1680 × 1050</option></select>') +
        row("zoom", "缩放", "更改文本、应用和其他项目的大小", '<select class="settings-select" data-pref="scale"><option>100%</option><option>125%</option><option selected>150%</option><option>175%</option></select>') +
        row("refresh", "刷新率", "动态刷新以节省电量", '<select class="settings-select" data-pref="refresh"><option>60 Hz</option><option>120 Hz</option></select>')
      ) +

      card("volume", "声音", "输出设备和音量",
        rangeBlock("主音量", state.volume + "%", 'min="0" max="100" step="1" value="' + state.volume + '" data-range="volume"') +
        selectRow("headphones", "输出", "选择播放声音的设备", "output", ["扬声器 (Realtek® Audio)", "耳机 (WH-1000XM5)", "显示器音频"])
      ) +

      card("bell", "通知", "来自应用和系统的提醒",
        row("bell", "通知", "获取来自应用和系统的通知", sw("notifications")) +
        row("message", "显示通知横幅", "在屏幕右下角显示提醒", sw("notificationsBanner"))
      ) +

      '<div class="settings-grid-2">' +
      card("battery", "电源和电池", "续航与性能",
        row("battery", "节能模式", "自动降低后台活动", sw("batterySaver")) +
        selectRow("power-settings", "电源模式", "在性能和能耗之间取舍", "powerMode", ["最佳能效", "平衡", "最佳性能"])
      ) +
      card("storage", "存储", "本机磁盘 C:",
        '<div class="storage-bar"><i class="storage-seg apps"></i><i class="storage-seg system"></i><i class="storage-seg docs"></i><i class="storage-seg photos"></i><i class="storage-seg free"></i></div>' +
        '<div class="storage-legend"><span><i style="background:var(--accent-2)"></i>应用 24%</span><span><i style="background:var(--accent)"></i>系统 20%</span><span><i style="background:#59c7a0"></i>文档 12%</span><span><i style="background:#ff9f5a"></i>照片 9%</span><span><i style="background:rgba(255,255,255,.18)"></i>可用 35%</span></div>'
      ) + "</div>" +

      '<div class="about-device"><div class="about-device-art"></div><div><b>Windows 13 概念设备</b><p>YellowBlue Studio · 16 GB 内存 · 1 TB SSD<br>Windows 13 Pro · 25H2 · 体验指数 9.7</p></div></div>' +
      '<div class="spec-list">' +
      '<div class="spec-row"><span>设备名称</span><b>YELLOWBLUE-13</b></div>' +
      '<div class="spec-row"><span>处理器</span><b>Solar Core i9 · 16 核</b></div>' +
      '<div class="spec-row"><span>已安装内存</span><b>16.0 GB</b></div>' +
      '<div class="spec-row"><span>系统类型</span><b>64 位操作系统</b></div>' +
      '<div class="spec-row"><span>设备 ID</span><b>W13-7A3F-9C21</b></div>' +
      '<div class="spec-row"><span>产品 ID</span><b>00331-13-00000-AAOEM</b></div>' +
      "</div></div>"
    );
  }

  function pageBluetooth() {
    const devices = [
      { icon: "mouse", name: "Surface Precision Mouse", meta: "已连接 · 电量 76%", on: true },
      { icon: "keyboard", name: "Designer Keyboard", meta: "已连接 · 电量 92%", on: true },
      { icon: "headphones", name: "WH-1000XM5", meta: "已配对 · 未连接", on: false },
      { icon: "gamepad", name: "Xbox Wireless Controller", meta: "已配对 · 未连接", on: false }
    ];
    return (
      '<div class="settings-page-inner">' +
      card("bluetooth", "蓝牙", state.toggles.bluetooth ? "已开启，可被发现为“YELLOWBLUE-13”" : "蓝牙已关闭",
        row("bluetooth", "蓝牙", "连接鼠标、键盘、耳机等设备", sw("bluetooth"))
      ) +
      '<div class="section-label"><span>已连接的设备</span><small>4 台设备</small></div>' +
      '<section class="settings-card"><div class="settings-card-body">' +
      devices.map((d) =>
        '<div class="installed-app-row"><span class="app-mark folder">' + icon(d.icon) + "</span>" +
        "<div><b>" + d.name + "</b><span>" + d.meta + "</span></div>" +
        '<button class="btn ghost" data-action="device-options" data-name="' + escapeHTML(d.name) + '">' + (d.on ? "已连接" : "连接") + "</button></div>"
      ).join("") +
      "</div></section>" +
      card("plus", "添加设备", "确保设备已开启并处于可发现状态",
        '<div style="display:flex;gap:7px;flex-wrap:wrap"><button class="btn primary" data-action="add-device">' + icon("plus") + "添加设备</button>" +
        '<button class="btn" data-action="printer">' + icon("print") + "打印机和扫描仪</button></div>"
      ) +
      "</div>"
    );
  }

  function pageNetwork() {
    const nets = [
      { name: "YellowBlue", meta: "已连接，安全 · 5 GHz", signal: true },
      { name: "SolarTide-Guest", meta: "开放网络 · 2.4 GHz", signal: false },
      { name: "AmberStudio", meta: "安全 · 5 GHz", signal: false }
    ];
    return (
      '<div class="settings-page-inner">' +
      '<div class="wifi-hero"><span class="wifi-signal">' + icon(state.toggles.wifi && !state.toggles.airplane ? "wifi" : "wifi-off") + "</span>" +
      "<div><b>" + (state.toggles.airplane ? "飞行模式已开启" : (state.toggles.wifi ? "YellowBlue" : "Wi-Fi 已关闭")) + "</b>" +
      "<p>" + (state.toggles.wifi && !state.toggles.airplane ? "已连接，安全 · 信号极佳 · 千兆速率" : "打开 Wi-Fi 以连接网络") + "</p></div></div>" +
      card("wifi", "Wi-Fi", "无线网络连接",
        row("wifi", "Wi-Fi", "连接到附近的无线网络", sw("wifi")) +
        row("airplane", "飞行模式", "关闭所有无线通信", sw("airplane")) +
        row("wifi-router", "移动热点", "共享我的 Internet 连接", sw("mobileHotspot")) +
        row("battery", "按流量计费", "将此网络视为按流量计费", sw("metered"))
      ) +
      '<div class="section-label"><span>可用的网络</span><small>3 个网络</small></div>' +
      '<section class="settings-card"><div class="settings-card-body"><div class="network-list">' +
      nets.map((n) =>
        '<div class="network-row">' + icon(n.signal ? "wifi" : "wifi-off") + "<span>" + n.name + "</span><small>" + n.meta + "</small>" +
        '<button class="btn ghost" data-action="join-network" data-name="' + n.name + '">' + (n.signal ? "已连接" : "连接") + "</button></div>"
      ).join("") +
      "</div></div></section>" +
      card("lock", "VPN", "添加虚拟专用网络连接",
        row("lock", "VPN 连接", "通过加密隧道访问公司网络", sw("vpn")) +
        '<div class="settings-note">' + icon("info") + '<span>此概念系统不会建立真实网络连接，所有网络状态仅用于演示界面。</span></div>'
      ) +
      "</div>"
    );
  }

  function pagePersonalization() {
    const wallpapers = W13.WALLPAPERS.map((w) =>
      '<button class="wallpaper-option' + (state.wallpaper === w.id ? " active" : "") + '" data-wallpaper="' + w.id + '">' +
      '<span class="wallpaper-thumb ' + w.className + '"></span><span>' + w.name + "</span></button>"
    ).join("");
    const accents = W13.ACCENTS.map((a) =>
      '<button class="accent-swatch' + (state.accent === a.value ? " active" : "") + '" data-accent="' + a.value + '" title="' + a.name + '" aria-label="' + a.name + '" style="background:' + a.value + '"></button>'
    ).join("");
    const themes = [
      { id: "dark", name: "午夜黄蓝", thumb: "dark" },
      { id: "light", name: "晨光浅色", thumb: "light" }
    ].map((t) =>
      '<button class="theme-card' + (state.theme === t.id ? " active" : "") + '" data-theme-choice="' + t.id + '">' +
      '<span class="theme-thumb ' + t.thumb + '"></span><b>' + t.name + "</b></button>"
    ).join("") +
      '<button class="theme-card' + (state.toggles.contrast ? " active" : "") + '" data-action="contrast-theme">' +
      '<span class="theme-thumb tide"></span><b>高对比度</b></button>';
    return (
      '<div class="settings-page-inner">' +
      '<div class="personal-preview"><div class="mini-desktop"><div class="mini-window"></div><div class="mini-taskbar"><i></i><i></i><i></i><i></i></div></div>' +
      '<div class="personal-preview-footer"><b>桌面预览</b><span>' + (W13.WALLPAPERS.find((w) => w.id === state.wallpaper) || {}).name + " · " + (state.theme === "light" ? "浅色" : "深色") + "</span></div></div>" +

      card("image", "背景", "选择一张黄蓝概念壁纸",
        '<div class="wallpaper-grid">' + wallpapers + "</div>" +
        '<div style="margin-top:11px;display:flex;gap:7px"><button class="btn" data-action="browse-wallpaper">' + icon("folder") + "浏览图片</button>" +
        '<button class="btn" data-action="slideshow">' + icon("play") + "幻灯片放映</button></div>"
      ) +
      card("palette", "颜色", "强调色会应用到按钮、开关和任务栏",
        '<div class="accent-row">' + accents + "</div>" +
        row("contrast", "透明效果", "让窗口和表面呈半透明", sw("transparency")) +
        row("eye", "动画效果", "启用窗口和界面的过渡动画", sw("animations"))
      ) +
      card("contrast", "主题", "深色、浅色与潮汐色板",
        '<div class="theme-cards">' + themes + "</div>"
      ) +
      card("lock-screen", "锁屏界面", "锁屏时钟与背景",
        row("lock-screen", "在锁屏上显示小组件", "天气、日历和音乐", sw("lockWidgets")) +
        '<div class="setting-row"><span class="setting-icon">' + icon("image") + "</span>" +
        '<div class="setting-copy"><b>锁屏背景</b><p>使用当前桌面壁纸</p></div>' +
        '<button class="btn ghost" data-action="lock-preview">预览锁屏</button></div>'
      ) +
      "</div>"
    );
  }

  function pageApps() {
    const installed = [
      { id: "browser", name: "Microsoft Edge", meta: "128.0.2739 · 浏览器" },
      { id: "explorer", name: "文件资源管理器", meta: "系统组件" },
      { id: "notepad", name: "记事本", meta: "11.2 · 文本编辑" },
      { id: "photos", name: "照片", meta: "2026.3 · 图像查看" },
      { id: "calculator", name: "计算器", meta: "11.2 · 工具" }
    ];
    return (
      '<div class="settings-page-inner">' +
      card("apps", "已安装的应用", "5 个应用 · 1.84 GB",
        installed.map((a) =>
          '<div class="installed-app-row">' + W13.appMark(a.id) + "<div><b>" + a.name + "</b><span>" + a.meta + "</span></div>" +
          '<button class="btn ghost" data-action="open-app" data-app="' + a.id + '">打开</button></div>'
        ).join("") +
        '<div style="margin-top:10px"><button class="btn" data-action="store">' + icon("store") + "在 Microsoft Store 中获取更多应用</button></div>"
      ) +
      card("external", "默认应用", "为文件类型和协议选择默认应用",
        row("globe", "Microsoft Edge", "网页浏览器 · 默认", '<button class="btn ghost" data-action="default-browser">管理</button>') +
        row("file-text", "记事本", ".txt · 默认", '<button class="btn ghost" data-action="default-notepad">管理</button>') +
        row("image", "照片", ".png / .jpg · 默认", '<button class="btn ghost" data-action="default-photos">管理</button>')
      ) +
      card("play", "启动", "登录时自动启动的应用",
        row("external", "Microsoft Edge", "启动时预加载浏览器", sw("startupEdge")) +
        '<div class="settings-note">' + icon("info") + "<span>概念设置不会修改真实的系统启动项。</span></div>"
      ) +
      "</div>"
    );
  }

  function pageAccounts() {
    return (
      '<div class="settings-page-inner">' +
      '<div class="account-hero"><span class="avatar large">黄</span><div><b>黄蓝少年</b><p>本地账户 · 管理员 · yellowblue@w13.local</p></div>' +
      '<button class="btn" data-action="account-photo">更改头像</button></div>' +
      card("user", "账户信息", "你的个人资料",
        row("user", "姓名", "黄蓝少年", '<button class="btn ghost" data-action="rename-account">编辑</button>') +
        row("mail", "电子邮件", "yellowblue@w13.local", '<button class="btn ghost" data-action="email-account">管理</button>') +
        row("cloud", "账户同步", "在这台设备上同步主题和设置", sw("accountSync"))
      ) +
      card("lock", "登录选项", "Windows Hello 与密码",
        selectRow("shield", "登录方式", "选择你偏好的登录方式", "signIn", ["Windows Hello 人脸", "PIN", "密码", "图片密码"]) +
        row("sensitivity", "动态锁", "离开时自动锁定设备", sw("dynamicLock")) +
        row("lock-screen", "需要登录", "从睡眠唤醒后需要登录", '<span class="ex-chip">已启用</span>')
      ) +
      card("users", "其他用户", "家庭成员与访客",
        row("user", "添加其他用户", "为家庭成员创建本地账户", '<button class="btn" data-action="add-user">' + icon("plus") + "添加</button>")
      ) +
      "</div>"
    );
  }

  function pageTime() {
    const now = new Date();
    return (
      '<div class="settings-page-inner">' +
      card("clock", "日期和时间", "当前：" + W13.formatLongDate(now) + " " + W13.formatClock(now),
        '<div class="setting-row"><span class="setting-icon">' + icon("clock") + '</span><div class="setting-copy"><b>当前时间</b><p>' +
        now.getFullYear() + "年" + (now.getMonth() + 1) + "月" + now.getDate() + "日 " + W13.formatClock(now) + ":" + W13.pad(now.getSeconds()) + "</p></div>" +
        '<span class="ex-chip">' + prefs.timeZone + "</span></div>" +
        row("globe", "自动设置时间", "与时区服务器保持同步", '<span class="ex-chip">已开启</span>') +
        selectRow("language", "时区", "选择你所在的时区", "timeZone", ["(UTC+08:00) 北京、重庆、香港", "(UTC+09:00) 东京", "(UTC+00:00) 伦敦", "(UTC-08:00) 太平洋时间"])
      ) +
      card("language", "语言和区域", "显示语言与地区格式",
        selectRow("language", "Windows 显示语言", "界面使用的语言", "language", ["简体中文", "English (United States)", "日本語", "Français"]) +
        selectRow("globe", "国家或地区", "用于内容与格式", "region", ["中国", "日本", "美国", "英国"]) +
        row("keyboard", "键盘", "中文（简体）· 微软拼音", '<button class="btn ghost" data-action="add-language">添加语言</button>')
      ) +
      card("calendar", "相关设置", "更多时间和语言选项",
        row("calendar", "日历", "添加日历账户", '<button class="btn ghost" data-action="calendar-settings">打开</button>') +
        row("mic", "语音", "语音识别和朗读", '<button class="btn ghost" data-action="speech-settings">打开</button>')
      ) +
      "</div>"
    );
  }

  function pageGaming() {
    return (
      '<div class="settings-page-inner">' +
      card("gamepad", "游戏栏", "使用 Win + G 在游戏中打开",
        row("gamepad", "游戏栏", "使用控制器打开游戏栏", sw("gameBar")) +
        row("play", "使用此按钮打开游戏栏", "Xbox 按钮", '<span class="ex-chip">已启用</span>')
      ) +
      card("sparkles", "游戏模式", "让 Windows 优先处理游戏",
        row("sparkles", "游戏模式", "优化 CPU 和 GPU 资源分配", sw("gameMode")) +
        row("refresh", "动态刷新率", "在游戏中自动调整刷新率", prefSw("dynamicRefresh"))
      ) +
      card("camera", "捕获", "录制游戏片段和屏幕截图",
        row("camera", "后台录制", "在后台持续录制最近 30 秒", sw("captures")) +
        row("folder", "捕获文件夹", "C:\\Users\\YellowBlue\\Videos\\Captures", '<button class="btn ghost" data-action="open-captures">打开</button>')
      ) +
      '<div class="settings-note">' + icon("sparkles") + "<span>已为 Solar Tide 启用游戏模式，预计可提升 6% 的帧率稳定性。</span></div>" +
      "</div>"
    );
  }

  function pageAccessibility() {
    return (
      '<div class="settings-page-inner">' +
      card("zoom", "视觉", "文本大小和显示效果",
        rangeBlock("文本大小", prefs.textScale + "%", 'min="80" max="150" step="5" value="' + prefs.textScale + '" data-range="textScale"') +
        '<div class="accessibility-preview" style="font-size:' + (10.5 * prefs.textScale / 100) + 'px">预览：黄蓝桌面上的文字会按照你的偏好缩放，窗口和对话框也会随之调整。</div>' +
        row("contrast", "高对比度", "增强前景与背景的对比度", sw("contrast")) +
        row("zoom", "放大镜", "使用 Win + 加号放大屏幕", sw("magnifier")) +
        row("eye", "动画效果", "减少界面动态效果", sw("animations")) +
        selectRow("mouse", "鼠标指针大小", "调整指针的可视大小", "cursor", ["默认", "大", "特大"])
      ) +
      card("volume", "听觉", "声音和字幕",
        row("volume", "单声道音频", "将立体声合并为单声道", '<span class="ex-chip">已关闭</span>') +
        row("message", "实时字幕", "为音频内容显示字幕", '<span class="ex-chip">已关闭</span>')
      ) +
      card("keyboard", "交互", "键盘、鼠标和触控",
        row("keyboard", "粘滞键", "连续按五次 Shift 启用", '<span class="ex-chip">已关闭</span>') +
        row("mouse", "鼠标键", "使用数字小键盘移动指针", '<span class="ex-chip">已关闭</span>')
      ) +
      "</div>"
    );
  }

  function pagePrivacy() {
    return (
      '<div class="settings-page-inner">' +
      card("shield", "常规", "隐私选项和诊断数据",
        row("shield", "诊断数据", "向 Microsoft 发送可选的诊断数据", sw("telemetry")) +
        row("history", "活动历史记录", "在此设备上保存我的活动", sw("activityHistory")) +
        row("message", "语音数据", "允许在线语音识别", sw("speech"))
      ) +
      card("location", "应用权限", "控制应用可以访问的内容",
        row("location", "位置", "允许应用使用你的位置", sw("location")) +
        row("camera", "相机", "允许应用使用相机", sw("camera")) +
        row("mic", "麦克风", "允许应用使用麦克风", sw("microphone")) +
        row("user", "账户信息", "允许应用访问你的姓名和头像", '<button class="btn ghost" data-action="privacy-manage">管理</button>')
      ) +
      card("sensitivity", "Windows 安全中心", "设备安全状态",
        row("shield", "病毒和威胁防护", "上次扫描：今天 09:12 · 无威胁", '<span class="checkmark">' + icon("check") + "</span>") +
        row("network", "防火墙和网络保护", "域、专用和公用网络", '<span class="checkmark">' + icon("check") + "</span>") +
        row("update", "应用和浏览器控制", "针对应用的智能筛选", '<span class="checkmark">' + icon("check") + "</span>")
      ) +
      "</div>"
    );
  }

  function pageUpdate() {
    const pct = updateState.value;
    return (
      '<div class="settings-page-inner">' +
      '<div class="update-hero"><span class="update-icon">' + icon(updateState.done ? "check-circle" : "update") + "</span>" +
      '<div class="update-copy"><b>' + (updateState.done ? "你已是最新版本" : (updateState.running ? "正在下载更新… " + pct + "%" : "有可用的更新")) + "</b>" +
      "<p>" + (updateState.done ? "Windows 13 Pro 25H2 · 内部版本 26100.1742" : "Windows 13 25H2 质量更新 · 大小 624 MB") + "</p>" +
      '<div class="update-progress' + (updateState.running || updateState.done ? " active" : "") + '"><i style="width:' + pct + '%"></i></div></div>' +
      '<button class="btn primary" data-action="check-update"' + (updateState.running ? " disabled" : "") + ">" +
      (updateState.running ? "下载中 " + pct + "%" : (updateState.done ? "重新检查" : "检查更新")) + "</button></div>" +
      card("update", "更新选项", "控制更新的安装方式",
        row("update", "自动获取更新", "有可用更新时自动下载并安装", sw("updateAuto")) +
        row("clock", "活动时间", "避免在 8:00 – 23:00 自动重启", '<span class="ex-chip">已启用</span>') +
        row("pause", "暂停更新", "最多可暂停 5 周", '<button class="btn ghost" data-action="pause-update">暂停 1 周</button>')
      ) +
      '<div class="section-label"><span>更新历史记录</span><small>最近 3 项</small></div>' +
      '<section class="settings-card"><div class="settings-card-body update-history">' +
      row("check-circle", "Windows 13 25H2 质量更新", "2026/11/05 · KB5099121 · 成功安装", '<span class="checkmark">' + icon("check") + "</span>") +
      row("check-circle", "安全智能更新", "2026/10/28 · KB2267602 · 成功安装", '<span class="checkmark">' + icon("check") + "</span>") +
      row("check-circle", "Microsoft Edge 128.0.2739", "2026/10/21 · 成功安装", '<span class="checkmark">' + icon("check") + "</span>") +
      "</div></section>" +
      '<button class="btn ghost" data-action="update-history" style="margin-top:4px">' + icon("history") + "查看完整更新历史</button>" +
      "</div>"
    );
  }

  const PAGE_RENDERERS = {
    system: pageSystem, bluetooth: pageBluetooth, network: pageNetwork,
    personalization: pagePersonalization, apps: pageApps, accounts: pageAccounts,
    time: pageTime, gaming: pageGaming, accessibility: pageAccessibility,
    privacy: pagePrivacy, update: pageUpdate
  };

  /* ---------------- shell ---------------- */

  function sidebarHTML() {
    let html =
      '<div class="settings-account" data-action="account"><span class="avatar">黄</span>' +
      "<div><b>黄蓝少年</b><span>yellowblue@w13.local</span></div></div>";
    NAV.forEach((group) => {
      html += '<div class="settings-nav-label">' + group.group + "</div>";
      group.items.forEach((item) => {
        html += '<button class="settings-nav-item' + (activePage === item.id ? " active" : "") + '" data-page="' + item.id + '">' +
          icon(item.icon) + "<span>" + item.label + "</span></button>";
      });
    });
    html += '<div class="settings-sidebar-footer">Windows 13 Pro<br>概念构建 26H2 · 黄蓝工作室</div>';
    return html;
  }

  function headHTML() {
    const meta = PAGES[activePage] || PAGES.system;
    return (
      '<header class="settings-head"><div><h1>' + meta.title + "</h1><p>" + meta.sub + "</p></div>" +
      '<div class="settings-search-box">' + icon("search") +
      '<input type="text" id="settings-search" placeholder="查找设置" autocomplete="off" aria-label="查找设置" value="' + escapeHTML(query) + '"></div></header>'
    );
  }

  function resultsHTML() {
    const q = query.trim().toLowerCase();
    const results = SEARCH_ITEMS.filter((item) =>
      (item.title + " " + item.desc).toLowerCase().includes(q)
    );
    if (!results.length) {
      return '<div class="settings-page-inner"><div class="empty-state" style="padding:70px 0">' + icon("search") +
        "<b>没有找到“" + escapeHTML(query) + "”</b><span>试试“壁纸”“网络”或“更新”</span></div></div>";
    }
    return (
      '<div class="settings-page-inner"><div class="section-label"><span>搜索结果</span><small>' + results.length + " 项</small></div>" +
      '<section class="settings-card"><div class="settings-card-body">' +
      results.map((r) =>
        '<button class="installed-app-row" style="width:100%;text-align:left" data-page="' + r.page + '">' +
        '<span class="app-mark folder">' + icon(r.icon) + "</span><div><b>" + r.title + "</b><span>" + r.desc + "</span></div>" +
        '<span class="ex-chip">' + (PAGES[r.page] || {}).title + "</span></button>"
      ).join("") +
      "</div></section></div>"
    );
  }

  function render() {
    return (
      '<div class="settings-shell">' +
      '<aside class="settings-sidebar" id="settings-sidebar">' + sidebarHTML() + "</aside>" +
      '<div class="settings-main" id="settings-main">' +
      headHTML() +
      '<div class="settings-page" id="settings-page">' + (query.trim() ? resultsHTML() : (PAGE_RENDERERS[activePage] || pageSystem)()) + "</div>" +
      "</div></div>"
    );
  }

  function refreshPage() {
    if (!currentWin) return;
    const root = currentWin.querySelector(".settings-shell");
    if (!root) return;
    const side = root.querySelector("#settings-sidebar");
    if (side) side.innerHTML = sidebarHTML();
    const head = root.querySelector(".settings-head");
    if (head) {
      const meta = PAGES[activePage] || PAGES.system;
      head.querySelector("h1").textContent = meta.title;
      head.querySelector("p").textContent = meta.sub;
      const input = head.querySelector("#settings-search");
      if (input && document.activeElement !== input) input.value = query;
    }
    const page = root.querySelector("#settings-page");
    if (page) {
      page.innerHTML = query.trim() ? resultsHTML() : (PAGE_RENDERERS[activePage] || pageSystem)();
      page.scrollTop = 0;
    }
    if (W13.updateWindowTitle && currentWin) W13.updateWindowTitle(currentWin, query.trim() ? "设置 · 搜索" : "设置");
  }

  function gotoPage(id) {
    if (!PAGE_RENDERERS[id]) return;
    activePage = id;
    query = "";
    refreshPage();
  }

  /* ---------------- update simulation ---------------- */

  function runUpdate() {
    if (updateState.running) return;
    updateState = { running: true, value: 0, done: false };
    refreshPage();
    clearInterval(updateTimer);
    updateTimer = setInterval(() => {
      updateState.value = Math.min(100, updateState.value + 4 + Math.round(Math.random() * 7));
      const win = currentWin;
      if (win) {
        const bar = win.querySelector(".update-progress i");
        const btn = win.querySelector('[data-action="check-update"]');
        const label = win.querySelector(".update-copy b");
        const sub = win.querySelector(".update-copy p");
        if (bar) bar.style.width = updateState.value + "%";
        if (btn) btn.textContent = "下载中 " + updateState.value + "%";
        if (label) label.textContent = "正在下载更新… " + updateState.value + "%";
        if (sub) sub.textContent = "Windows 13 25H2 质量更新 · 已下载 " + Math.round(updateState.value * 6.24) + " MB / 624 MB";
      }
      if (updateState.value >= 100) {
        clearInterval(updateTimer);
        updateState = { running: false, value: 100, done: true };
        refreshPage();
        W13.showToast("Windows 更新", "更新已成功安装，重启后生效。", "check-circle", 5000);
        if (W13.pushNotification) W13.pushNotification({ icon: "update", app: "Windows 更新", title: "更新已就绪", message: "Windows 13 25H2 质量更新已安装，重启以完成。", target: "app:settings" });
      }
    }, 420);
  }

  /* ---------------- interactions ---------------- */

  function bind(win) {
    currentWin = win;
    const root = win.querySelector(".settings-shell");
    if (!root) return;

    root.addEventListener("click", (e) => {
      const nav = e.target.closest("[data-page]");
      if (nav) {
        gotoPage(nav.dataset.page);
        return;
      }
      const themeBtn = e.target.closest("button[data-theme-choice]");
      if (themeBtn) {
        state.theme = themeBtn.dataset.themeChoice;
        applyState();
        W13.refreshQuickTileLabels && W13.refreshQuickTileLabels();
        refreshPage();
        return;
      }
      const wall = e.target.closest(".wallpaper-option[data-wallpaper]");
      if (wall) {
        state.wallpaper = wall.dataset.wallpaper;
        applyState();
        refreshPage();
        W13.showToast("壁纸已更新", "桌面已切换为“" + (W13.WALLPAPERS.find((w) => w.id === state.wallpaper) || {}).name + "”。", "image", 2400);
        return;
      }
      const accent = e.target.closest(".accent-swatch[data-accent]");
      if (accent) {
        state.accent = accent.dataset.accent;
        applyState();
        refreshPage();
        return;
      }
      const setSw = e.target.closest("[data-setting-toggle]");
      if (setSw) {
        const key = setSw.dataset.settingToggle;
        state.toggles[key] = !state.toggles[key];
        if (key === "airplane" && state.toggles.airplane) {
          state.toggles.wifi = false;
          state.toggles.bluetooth = false;
        }
        if ((key === "wifi" || key === "bluetooth") && state.toggles[key]) state.toggles.airplane = false;
        applyState();
        W13.refreshQuickTileLabels && W13.refreshQuickTileLabels();
        if (["nightLight", "airplane", "wifi"].indexOf(key) !== -1) refreshPage();
        return;
      }
      const pSw = e.target.closest("[data-pref-toggle]");
      if (pSw) {
        const key = pSw.dataset.prefToggle;
        prefs[key] = !prefs[key];
        savePrefs();
        pSw.classList.toggle("on", prefs[key]);
        pSw.setAttribute("aria-checked", prefs[key] ? "true" : "false");
        if (key === "dynamicRefresh") refreshPage();
        return;
      }
      const action = e.target.closest("[data-action]");
      if (action) handleAction(action, e);
    });

    root.addEventListener("change", (e) => {
      const sel = e.target.closest("select[data-pref]");
      if (sel) {
        prefs[sel.dataset.pref] = sel.value;
        savePrefs();
        W13.showToast("设置已保存", sel.dataset.pref + "：" + sel.value, "check", 2000);
        return;
      }
      const range = e.target.closest("input[data-range]");
      if (range) {
        const key = range.dataset.range;
        if (key === "brightness") {
          state.brightness = Number(range.value);
          const overlay = document.getElementById("brightness-overlay");
          if (overlay) overlay.style.opacity = String(((100 - state.brightness) / 100) * 0.55);
          W13.saveState();
        } else if (key === "volume") {
          state.volume = Number(range.value);
          W13.saveState();
        } else if (key === "textScale") {
          prefs.textScale = Number(range.value);
          savePrefs();
          refreshPage();
        }
      }
    });

    root.addEventListener("input", (e) => {
      const search = e.target.closest("#settings-search");
      if (search) {
        query = search.value;
        const page = root.querySelector("#settings-page");
        if (page) {
          page.innerHTML = query.trim() ? resultsHTML() : (PAGE_RENDERERS[activePage] || pageSystem)();
          if (!page.innerHTML) page.innerHTML = resultsHTML();
        }
        return;
      }
      const range = e.target.closest("input[data-range]");
      if (range) {
        W13.applyRangeFill(range);
        const block = range.closest(".range-block");
        const label = block && block.querySelector(".range-block-head b");
        const key = range.dataset.range;
        if (label) label.textContent = range.value + "%";
        if (key === "brightness") {
          state.brightness = Number(range.value);
          const overlay = document.getElementById("brightness-overlay");
          if (overlay) overlay.style.opacity = String(((100 - state.brightness) / 100) * 0.55);
          const qs = document.getElementById("brightness-slider");
          if (qs) { qs.value = range.value; W13.applyRangeFill(qs); }
          const qv = document.getElementById("brightness-value");
          if (qv) qv.textContent = range.value + "%";
          W13.saveState();
        } else if (key === "volume") {
          state.volume = Number(range.value);
          const qs = document.getElementById("volume-slider");
          if (qs) { qs.value = range.value; W13.applyRangeFill(qs); }
          const qv = document.getElementById("volume-value");
          if (qv) qv.textContent = range.value + "%";
          W13.saveState();
        } else if (key === "textScale") {
          prefs.textScale = Number(range.value);
          const preview = root.querySelector(".accessibility-preview");
          if (preview) preview.style.fontSize = (10.5 * prefs.textScale / 100) + "px";
          savePrefs();
        }
      }
    });

    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && e.target.id === "settings-search" && query) {
        query = "";
        e.target.value = "";
        refreshPage();
      }
    });
  }

  function handleAction(node) {
    const action = node.dataset.action;
    const name = node.dataset.name;
    const app = node.dataset.app;
    if (action === "open-app" && app) { W13.openApp(app); return; }
    if (action === "contrast-theme") {
      state.toggles.contrast = !state.toggles.contrast;
      applyState();
      refreshPage();
      W13.showToast("高对比度", state.toggles.contrast ? "已启用高对比度主题。" : "已恢复标准主题。", "contrast", 2200);
      return;
    }
    if (action === "check-update") { runUpdate(); return; }
    if (action === "account") { W13.showToast("黄蓝少年", "本地账户 · 管理员 · Windows 13 Pro", "user"); return; }
    if (action === "add-device") { W13.showToast("添加设备", "正在搜索附近的蓝牙设备…", "bluetooth", 2600); return; }
    if (action === "printer") { W13.showToast("打印机和扫描仪", "尚未添加打印机。概念系统不会连接真实设备。", "print", 3000); return; }
    if (action === "device-options" && name) { W13.showToast(name, "设备连接状态已更新（演示）。", "check", 2200); return; }
    if (action === "join-network" && name) {
      if (name === "YellowBlue") { W13.showToast("已连接", "YellowBlue · 信号极佳", "wifi", 2200); }
      else { W13.showToast("无法连接", "“" + name + "”需要密码或不在范围内。", "alert", 2600); }
      return;
    }
    if (action === "browse-wallpaper") { W13.openApp("explorer", { folder: "pictures" }); return; }
    if (action === "slideshow") { W13.showToast("幻灯片放映", "已启用每 30 分钟更换壁纸（演示）。", "image", 2400); return; }
    if (action === "lock-preview") { W13.lockScreen && W13.lockScreen(); return; }
    if (action === "store") { W13.showToast("Microsoft Store", "Store 在概念系统中尚未开放。", "store", 2600); return; }
    if (action === "default-browser") { W13.showToast("默认应用", "Microsoft Edge 已设为默认浏览器。", "globe", 2300); return; }
    if (action === "default-notepad") { W13.showToast("默认应用", "记事本已关联 .txt 文件。", "file-text", 2300); return; }
    if (action === "default-photos") { W13.showToast("默认应用", "照片已关联 .png / .jpg 文件。", "image", 2300); return; }
    if (action === "account-photo") { W13.showToast("更改头像", "已选择新的黄蓝渐变头像。", "user", 2400); return; }
    if (action === "rename-account") { W13.showToast("编辑姓名", "演示模式下姓名已锁定为“黄蓝少年”。", "edit", 2600); return; }
    if (action === "email-account") { W13.showToast("电子邮件", "yellowblue@w13.local · 已验证", "mail", 2600); return; }
    if (action === "add-user") { W13.showToast("添加用户", "概念系统仅支持单一本地账户。", "users", 2600); return; }
    if (action === "add-language") { W13.showToast("添加语言", "简体中文已安装，无需重复添加。", "language", 2600); return; }
    if (action === "calendar-settings") { W13.openNotifications && W13.openNotifications(); return; }
    if (action === "speech-settings") { W13.showToast("语音", "语音识别已就绪，麦克风权限已开启。", "mic", 2400); return; }
    if (action === "open-captures") { W13.openApp("explorer", { folder: "pictures" }); return; }
    if (action === "privacy-manage") { W13.showToast("账户信息权限", "已允许 3 个应用访问你的姓名和头像。", "privacy", 2600); return; }
    if (action === "pause-update") { W13.showToast("已暂停更新", "更新将暂停 1 周（演示）。", "pause", 2400); return; }
    if (action === "update-history") { W13.showToast("更新历史记录", "已显示全部 12 项历史更新。", "history", 2400); return; }
  }

  /* ---------------- app registration ---------------- */

  W13.registerApp("settings", {
    name: "设置",
    width: 1000,
    height: 680,
    minWidth: 560,
    minHeight: 420,
    render(options) {
      activePage = (options && options.page && PAGE_RENDERERS[options.page]) ? options.page : "system";
      query = "";
      return render();
    },
    init(win) {
      bind(win);
    },
    reopen(win, options) {
      currentWin = win;
      if (options && options.page && PAGE_RENDERERS[options.page]) {
        activePage = options.page;
        query = "";
        refreshPage();
      }
    },
    onClose() {
      currentWin = null;
      clearInterval(updateTimer);
    }
  });

  W13.openSettingsPage = function (page) {
    W13.openApp("settings", { page: page || "system" });
  };
})();
