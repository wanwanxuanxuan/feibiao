/* Windows 13 · core utilities, icons and persistent state */
(function () {
  "use strict";
  const W13 = (window.W13 = window.W13 || {});

  const ICONS = {
    "search": '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    "chevron-left": '<path d="m15 18-6-6 6-6"/>',
    "chevron-right": '<path d="m9 18 6-6-6-6"/>',
    "chevron-down": '<path d="m6 9 6 6 6-6"/>',
    "chevron-up": '<path d="m18 15-6-6-6 6"/>',
    "arrow-left": '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
    "arrow-right": '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    "arrow-up": '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
    "arrow-up-right": '<path d="M7 17 17 7"/><path d="M7 7h10v10"/>',
    "folder": '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    "folder-plus": '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 11v6M9 14h6"/>',
    "file-plus": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 12v6M9 15h6"/>',
    "file-text": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/>',
    "monitor": '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    "display": '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    "trash": '<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6"/><path d="M10 11v6M14 11v6"/>',
    "globe": '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
    "settings": '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1.11 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.88V9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"/>',
    "image": '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    "calculator": '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h2M12 10h2M16 10h2M8 14h2M12 14h2M16 14h2M8 18h6"/>',
    "wifi": '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/>',
    "wifi-off": '<path d="m2 2 20 20"/><path d="M8.5 8.5a11 11 0 0 1 9.4 3.4M5 12.55a11 11 0 0 1 1.4-1.1M10.6 15.7a6 6 0 0 1 2.4-.4"/><path d="M12 20h.01"/>',
    "bluetooth": '<path d="m7 7 10 10-5 5V2l5 5L7 17"/>',
    "airplane": '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
    "battery": '<rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 11v2"/><path d="M5 10h10v4H5z" fill="currentColor" stroke="none"/>',
    "sun": '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/>',
    "moon": '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    "accessibility": '<circle cx="12" cy="5" r="2"/><path d="M5 8h14M12 10v5M8 21l4-6 4 6M9 12l-2 4M15 12l2 4"/>',
    "volume": '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>',
    "lock": '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    "power": '<path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><path d="M12 2v10"/>',
    "sleep": '<path d="M3 12h4l3 8 4-16 3 8h4"/>',
    "restart": '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    "close": '<path d="M18 6 6 18M6 6l12 12"/>',
    "minus": '<path d="M5 12h14"/>',
    "square": '<rect x="5" y="5" width="14" height="14" rx="1"/>',
    "restore": '<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    "home": '<path d="m3 10 9-8 9 8v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    "refresh": '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    "plus": '<path d="M12 5v14M5 12h14"/>',
    "star": '<path d="m12 2 3.1 6.3L22 9.3l-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1z"/>',
    "more-horizontal": '<circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
    "grid": '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    "list": '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    "details": '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>',
    "sort": '<path d="M3 6h18M6 12h12M10 18h4"/>',
    "copy": '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    "cut": '<circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M8.1 8.1 12 12l-3.9 3.9M14.9 8.1 12 12l3.9 3.9"/>',
    "paste": '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
    "edit": '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    "share": '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    "download": '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    "print": '<path d="M6 9V2h12v7"/><rect x="6" y="14" width="12" height="8" rx="1"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>',
    "pin": '<path d="M12 17v5"/><path d="M5 17h14l-1.5-3V7l2-2H5.5l2 2v7z"/>',
    "shield": '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    "update": '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v5h-5"/><path d="M9 12h6M12 9v6"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "calendar": '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    "language": '<path d="M5 8h10M9 4h2M7 8c0 5-3 8-3 8M5 12c2 3 5 4 8 4"/><path d="m13 20 4-10 4 10M14.5 17h5"/>',
    "gamepad": '<rect x="2" y="6" width="20" height="12" rx="4"/><path d="M6 12h4M8 10v4"/><circle cx="16" cy="11" r="1" fill="currentColor" stroke="none"/><circle cx="18" cy="13" r="1" fill="currentColor" stroke="none"/>',
    "palette": '<path d="M12 2a10 10 0 1 0 0 20h1.5a2.5 2.5 0 0 0 0-5H12a2 2 0 0 1 0-4h5a4 4 0 0 0 4-4 9 9 0 0 0-9-7z"/><circle cx="7.5" cy="10.5" r="1" fill="currentColor" stroke="none"/><circle cx="9.5" cy="6.5" r="1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>',
    "apps": '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    "devices": '<rect x="2" y="4" width="13" height="10" rx="2"/><path d="M6 20h6M9 14v6"/><rect x="17" y="8" width="5" height="12" rx="1"/>',
    "network": '<rect x="9" y="2" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M12 8v4M5 16v-2h14v2"/>',
    "user": '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    "users": '<circle cx="9" cy="8" r="3.5"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6 6 0 0 1 4 6"/>',
    "cloud": '<path d="M17.5 19H7a5 5 0 1 1 .9-9.9A7 7 0 0 1 21 12a3.5 3.5 0 0 1-3.5 7z"/>',
    "check": '<path d="M20 6 9 17l-5-5"/>',
    "check-circle": '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.4 2.4 4.6-4.8"/>',
    "info": '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    "alert": '<path d="M10.3 3.7 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    "sparkles": '<path d="m12 3 1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    "play": '<path d="m8 5 11 7-11 7z" fill="currentColor" stroke="none"/>',
    "pause": '<path d="M8 5v14M16 5v14"/>',
    "next": '<path d="m5 5 9 7-9 7z" fill="currentColor" stroke="none"/><path d="M19 5v14"/>',
    "keyboard": '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6"/>',
    "mouse": '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 2v6"/>',
    "headphones": '<path d="M3 14v-2a9 9 0 0 1 18 0v2"/><path d="M21 14h-2a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1a1 1 0 0 0 1-1v-6zM3 14h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H4a1 1 0 0 1-1-1v-6z"/>',
    "storage": '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
    "bell": '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    "location": '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    "camera": '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    "mic": '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>',
    "eye": '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    "contrast": '<circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" opacity=".35"/>',
    "external": '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14 21 3"/>',
    "history": '<path d="M3 12a9 9 0 1 0 9-9 9.7 9.7 0 0 0-6.7 2.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
    "message": '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    "zoom": '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/>',
    "compass": '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z"/>',
    "panel": '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/>',
    "services": '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    "lock-screen": '<rect x="3" y="2" width="18" height="20" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><rect x="7" y="11" width="10" height="7" rx="1"/>',
    "news": '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h6M7 16h10"/>',
    "briefcase": '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7V4h8v3M2 12h20"/>',
    "wifi-router": '<rect x="3" y="13" width="18" height="8" rx="2"/><path d="M7 17h.01M11 17h.01M16 17h4M12 13V9a4 4 0 0 1 4-4"/>',
    "paint": '<path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/><path d="m7 16 4-4 6 6M8 9h.01"/>',
    "terminal": '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m6 9 3 3-3 3M12 15h6"/>',
    "power-settings": '<path d="M12 2v10"/><path d="M18.4 5.6a9 9 0 1 1-12.8 0"/>',
    "privacy": '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1"/>',
    "sensitivity": '<path d="M12 2 4 6v6c0 5 8 10 8 10s8-5 8-10V6z"/><path d="m9 12 2 2 4-4"/>',
    "cloud-download": '<path d="M17.5 19H7a5 5 0 1 1 .9-9.9A7 7 0 0 1 21 12a3.5 3.5 0 0 1-3.5 7z"/><path d="M12 12v6M9.5 15.5 12 18l2.5-2.5"/>',
    "mail": '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    "store": '<path d="M3 9h18l-1.5-5h-15z"/><path d="M5 9v11h14V9M9 20v-6h6v6"/>'
  };

  function icon(name, cls) {
    const body = ICONS[name] || ICONS.info;
    return '<svg class="icon ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + body + "</svg>";
  }

  const APP_META = {
    browser: { name: "Microsoft Edge", mark: "edge", icon: "globe" },
    explorer: { name: "文件资源管理器", mark: "explorer", icon: "folder" },
    settings: { name: "设置", mark: "settings", icon: "settings" },
    notepad: { name: "记事本", mark: "notepad", icon: "file-text" },
    photos: { name: "照片", mark: "photos", icon: "image" },
    calculator: { name: "计算器", mark: "calculator", icon: "calculator" },
    pc: { name: "此电脑", mark: "pc", icon: "monitor" },
    recycle: { name: "回收站", mark: "recycle", icon: "trash" },
    folder: { name: "文件夹", mark: "folder", icon: "folder" },
    documents: { name: "文档", mark: "folder", icon: "folder" },
    pictures: { name: "图片", mark: "folder", icon: "image" },
    terminal: { name: "Windows Terminal", mark: "terminal", icon: "terminal" }
  };

  function appMark(id, cls) {
    const meta = APP_META[id] || APP_META.folder;
    return '<span class="app-mark ' + meta.mark + " " + (cls || "") + '">' + icon(meta.icon) + "</span>";
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function formatClock(date) {
    const d = date || new Date();
    return pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function formatDate(date) {
    const d = date || new Date();
    return d.getFullYear() + "/" + pad(d.getMonth() + 1) + "/" + pad(d.getDate());
  }

  function formatLongDate(date) {
    const d = date || new Date();
    const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    return (d.getMonth() + 1) + "月" + d.getDate() + "日，" + weekdays[d.getDay()];
  }

  function hexToRgb(hex) {
    const clean = String(hex).replace("#", "");
    const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
    const num = parseInt(full, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }

  function relativeTime(minutesAgo) {
    if (minutesAgo < 1) return "刚刚";
    if (minutesAgo < 60) return minutesAgo + " 分钟前";
    if (minutesAgo < 1440) return Math.floor(minutesAgo / 60) + " 小时前";
    return Math.floor(minutesAgo / 1440) + " 天前";
  }

  const DEFAULT_TOGGLES = {
    notifications: true,
    nightLight: false,
    focus: false,
    batterySaver: false,
    nearbySharing: true,
    wifi: true,
    bluetooth: true,
    airplane: false,
    mobileHotspot: false,
    metered: false,
    vpn: false,
    gameBar: true,
    gameMode: true,
    captures: false,
    location: true,
    camera: true,
    microphone: true,
    telemetry: false,
    speech: true,
    transparency: true,
    animations: true,
    contrast: false,
    magnifier: false,
    startupEdge: true,
    accountSync: true,
    backup: true,
    dynamicLock: false,
    activityHistory: true,
    updateAuto: true,
    notificationsBanner: true
  };

  const ACCENTS = [
    { name: "日冕黄", value: "#ffc83d" },
    { name: "潮汐蓝", value: "#4b83ff" },
    { name: "琥珀", value: "#ff9f43" },
    { name: "珊瑚", value: "#ff6b6b" },
    { name: "青柠", value: "#8bd450" },
    { name: "兰花", value: "#b18cff" }
  ];

  const WALLPAPERS = [
    { id: "tide", name: "潮汐金环", className: "tide" },
    { id: "lagoon", name: "泻湖晨光", className: "lagoon" },
    { id: "amber", name: "琥珀余晖", className: "amber" },
    { id: "midnight", name: "午夜金光", className: "midnight" }
  ];

  const DEFAULT_STATE = {
    theme: "dark",
    wallpaper: "tide",
    accent: "#ffc83d",
    brightness: 100,
    volume: 68,
    toggles: Object.assign({}, DEFAULT_TOGGLES)
  };

  function deepMerge(base, incoming) {
    const out = Object.assign({}, base);
    if (incoming && typeof incoming === "object") {
      Object.keys(incoming).forEach((key) => {
        if (incoming[key] && typeof incoming[key] === "object" && !Array.isArray(incoming[key])) {
          out[key] = deepMerge(base[key] || {}, incoming[key]);
        } else if (incoming[key] !== undefined) {
          out[key] = incoming[key];
        }
      });
    }
    return out;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem("w13.state.v1");
      if (!raw) return deepMerge(DEFAULT_STATE, {});
      return deepMerge(DEFAULT_STATE, JSON.parse(raw));
    } catch (err) {
      return deepMerge(DEFAULT_STATE, {});
    }
  }

  const state = loadState();
  if (!state.toggles) state.toggles = Object.assign({}, DEFAULT_TOGGLES);

  function saveState() {
    try {
      localStorage.setItem("w13.state.v1", JSON.stringify(state));
    } catch (err) {
      /* storage can be unavailable in private contexts */
    }
  }

  function applyRangeFill(input) {
    if (!input) return;
    const min = Number(input.min || 0);
    const max = Number(input.max || 100);
    const value = Number(input.value || 0);
    const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
    input.style.setProperty("--range-fill", pct + "%");
  }

  function applyState() {
    const root = document.documentElement;
    root.dataset.theme = state.theme;
    root.dataset.wallpaper = state.wallpaper;
    const accentRgb = hexToRgb(state.accent);
    root.style.setProperty("--accent", state.accent);
    root.style.setProperty("--accent-rgb", accentRgb.join(", "));
    const luminance = (accentRgb[0] * 299 + accentRgb[1] * 587 + accentRgb[2] * 114) / 1000;
    root.style.setProperty("--accent-ink", luminance > 158 ? "#20180a" : "#ffffff");
    root.classList.toggle("reduced-motion", !state.toggles.animations);

    const brightnessOverlay = document.getElementById("brightness-overlay");
    if (brightnessOverlay) brightnessOverlay.style.opacity = String(((100 - state.brightness) / 100) * 0.55);
    const nightOverlay = document.getElementById("night-light-overlay");
    if (nightOverlay) nightOverlay.classList.toggle("on", !!state.toggles.nightLight);

    const brightnessSlider = document.getElementById("brightness-slider");
    if (brightnessSlider) {
      brightnessSlider.value = state.brightness;
      applyRangeFill(brightnessSlider);
    }
    const brightnessValue = document.getElementById("brightness-value");
    if (brightnessValue) brightnessValue.textContent = state.brightness + "%";
    const volumeSlider = document.getElementById("volume-slider");
    if (volumeSlider) {
      volumeSlider.value = state.volume;
      applyRangeFill(volumeSlider);
    }
    const volumeValue = document.getElementById("volume-value");
    if (volumeValue) volumeValue.textContent = state.volume + "%";

    const trayWifi = document.getElementById("tray-wifi");
    if (trayWifi) trayWifi.innerHTML = icon(state.toggles.wifi && !state.toggles.airplane ? "wifi" : "wifi-off");
    const trayVolume = document.getElementById("tray-volume");
    if (trayVolume) trayVolume.innerHTML = icon(state.volume === 0 ? "volume" : "volume");

    document.querySelectorAll("[data-qs-toggle]").forEach((tile) => {
      const key = tile.dataset.qsToggle;
      tile.classList.toggle("active", !!state.toggles[key]);
    });
    document.querySelectorAll(".switch[data-setting-toggle]").forEach((sw) => {
      const key = sw.dataset.settingToggle;
      const on = !!state.toggles[key];
      sw.classList.toggle("on", on);
      sw.setAttribute("aria-checked", on ? "true" : "false");
    });
    document.querySelectorAll(".accent-swatch").forEach((sw) => {
      sw.classList.toggle("active", sw.dataset.accent === state.accent);
    });
    document.querySelectorAll(".wallpaper-option").forEach((opt) => {
      opt.classList.toggle("active", opt.dataset.wallpaper === state.wallpaper);
    });
    document.querySelectorAll(".theme-card").forEach((card) => {
      card.classList.toggle("active", card.dataset.themeChoice === state.theme);
    });
    document.querySelectorAll("[data-theme-choice]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.themeChoice === state.theme);
    });

    saveState();
  }

  let toastCounter = 0;
  function showToast(title, message, iconName, duration) {
    const stack = document.getElementById("toast-stack");
    if (!stack) return;
    const id = "toast-" + ++toastCounter;
    const el = document.createElement("div");
    el.className = "toast";
    el.id = id;
    el.innerHTML =
      '<span class="toast-icon">' + icon(iconName || "info") + "</span>" +
      '<span class="toast-copy"><b>' + escapeHTML(title) + "</b><span>" + escapeHTML(message || "") + "</span></span>" +
      '<button class="toast-close" aria-label="关闭">' + icon("close") + "</button>";
    const remove = () => {
      if (!el.isConnected) return;
      el.classList.add("leaving");
      setTimeout(() => el.remove(), 220);
    };
    el.querySelector(".toast-close").addEventListener("click", remove);
    stack.appendChild(el);
    while (stack.children.length > 4) stack.firstElementChild.remove();
    setTimeout(remove, duration || 4200);
  }

  function registerApp(id, definition) {
    W13.apps[id] = definition;
  }

  function hexToHue(hex) {
    const rgb = hexToRgb(hex).map((c) => c / 255);
    const max = Math.max.apply(null, rgb);
    const min = Math.min.apply(null, rgb);
    let h = 0;
    if (max !== min) {
      const d = max - min;
      if (max === rgb[0]) h = ((rgb[1] - rgb[2]) / d) % 6;
      else if (max === rgb[1]) h = (rgb[2] - rgb[0]) / d + 2;
      else h = (rgb[0] - rgb[1]) / d + 4;
      h = Math.round(h * 60);
      if (h < 0) h += 360;
    }
    return h;
  }

  Object.assign(W13, {
    icon: icon,
    icons: ICONS,
    appMark: appMark,
    APP_META: APP_META,
    state: state,
    saveState: saveState,
    applyState: applyState,
    applyRangeFill: applyRangeFill,
    showToast: showToast,
    escapeHTML: escapeHTML,
    clamp: clamp,
    pad: pad,
    formatClock: formatClock,
    formatDate: formatDate,
    formatLongDate: formatLongDate,
    relativeTime: relativeTime,
    registerApp: registerApp,
    ACCENTS: ACCENTS,
    WALLPAPERS: WALLPAPERS,
    hexToRgb: hexToRgb,
    hexToHue: hexToHue
  });
})();
