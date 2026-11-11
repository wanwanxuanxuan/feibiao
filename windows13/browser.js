/* Windows 13 · Microsoft Edge (concept browser) */
(function () {
  "use strict";
  const W13 = window.W13;
  const { icon, escapeHTML, showToast } = W13;

  const ARTICLES = {
    tide: {
      id: "tide",
      site: "黄蓝工作室",
      title: "潮汐与日冕：Windows 13 的设计语言",
      url: "w13.design/journal/tide",
      byline: "Aria · 设计总监",
      date: "2026 年 11 月 9 日 · 8 分钟阅读",
      body: [
        "<p>如果要用一句话描述 Windows 13，我们会说：它像清晨六点的海面。太阳还没有完全升起，蓝色仍然占据大部分天空，但金色的边缘已经出现。</p>",
        "<p>这套设计语言围绕两个词展开：<b>潮汐</b>与<b>日冕</b>。潮汐负责结构——窗口、任务栏、侧边栏，一切都沿着柔和的水平线排列；日冕负责强调——按钮、开关、选中的标签，用一小块琥珀金告诉你此刻在哪里。</p>",
        "<h2>为什么是 70 / 20 / 10</h2>",
        "<p>我们给界面的色彩做了一个简单的比例：70% 深蓝，20% 中性表面，10% 金色。蓝色提供沉浸感，中性表面保证可读性，金色只用于需要你注意的地方。克制，是这套系统的第一原则。</p>",
        "<div class=\"article-quote\">“不要用金色装饰一切。让金色成为一天中唯一一次日出。”</div>",
        "<h2>圆角与玻璃</h2>",
        "<p>窗口使用 12px 圆角，卡片 10px，按钮 6px。所有表面都有一层很薄的亚克力模糊，让壁纸的颜色透进来。我们希望窗口不是贴在桌面上的纸片，而是浮在水面上的玻璃。</p>",
        "<h2>动效的呼吸</h2>",
        "<p>所有过渡都比常见的系统慢一点点：0.2 到 0.3 秒，使用接近自然的缓动曲线。它们不应该让你等待，而应该让你感觉到界面在呼吸。</p>"
      ].join(""),
      related: [
        { id: "color", tag: "色彩", title: "为什么是黄蓝色？一次关于温度的实验" },
        { id: "search", tag: "体验", title: "搜索的未来：更少点击，更多答案" }
      ]
    },
    search: {
      id: "search",
      site: "Windows 体验博客",
      title: "搜索的未来：更少点击，更多答案",
      url: "w13.design/journal/search",
      byline: "林工 · 产品",
      date: "2026 年 11 月 6 日 · 6 分钟阅读",
      body: [
        "<p>传统搜索是一串蓝色链接。我们想问的是：如果浏览器在一开始就理解你的问题，会发生什么？</p>",
        "<p>在 Windows 13 的概念浏览器里，搜索结果页的第一屏不是十条链接，而是一张 AI 摘要卡。它用三句话回答你的问题，然后在下面列出出处。</p>",
        "<h2>摘要不是终点</h2>",
        "<p>摘要的作用是让你更快判断“这个方向对不对”。当你需要细节时，下面的来源卡片仍然可以点开完整文章。我们不想隐藏互联网，只想让你少点几次。</p>",
        "<div class=\"article-quote\">“好的搜索应该像问一位博学的朋友，而不是在图书馆里翻卡片。”</div>",
        "<h2>隐私优先</h2>",
        "<p>概念版本中，所有摘要都在本地生成。我们相信，理解用户不应该以收集用户为代价。</p>"
      ].join(""),
      related: [
        { id: "tide", tag: "设计", title: "潮汐与日冕：Windows 13 的设计语言" },
        { id: "color", tag: "色彩", title: "为什么是黄蓝色？一次关于温度的实验" }
      ]
    },
    color: {
      id: "color",
      site: "Solar Journal",
      title: "为什么是黄蓝色？一次关于温度的实验",
      url: "w13.design/journal/color",
      byline: "Mira · 色彩研究",
      date: "2026 年 10 月 28 日 · 5 分钟阅读",
      body: [
        "<p>蓝色是冷色，黄色是暖色。把它们放在一起，你会得到一种奇怪的平衡：既安静，又有一点点雀跃。</p>",
        "<p>我们测试了 42 种蓝与黄的组合。最终选中的深海蓝 #0B3674 与日冕黄 #FFC83D，在色相环上几乎相对，却在明度上非常接近。这意味着它们可以同时出现在一个界面里，而不会有一方被另一方吞掉。</p>",
        "<h2>黄不是警示色</h2>",
        "<p>在很多系统里，黄色意味着警告。我们通过降低饱和度、提高明度，把它变成一种更接近阳光的黄。它不再尖叫，而是发光。</p>",
        "<div class=\"article-quote\">“蓝色负责让你留下来，黄色负责让你继续往前走。”</div>",
        "<h2>深色与浅色</h2>",
        "<p>深色主题使用午夜蓝作为底，浅色主题使用带一点奶油感的白色。两者共享同一套强调色，所以无论你何时切换，界面仍然是同一个 Windows 13。</p>"
      ].join(""),
      related: [
        { id: "tide", tag: "设计", title: "潮汐与日冕：Windows 13 的设计语言" },
        { id: "search", tag: "体验", title: "搜索的未来：更少点击，更多答案" }
      ]
    }
  };

  const SEARCH_SUGGESTIONS = ["Windows 13 设计语言", "黄蓝色调搭配", "潮汐壁纸", "概念系统设置"];

  let bTabs = [];
  let activeB = 0;
  let seq = 0;
  let currentWin = null;

  function makeState(type, extra) {
    return Object.assign({ type: type || "home", query: "", articleId: null, url: "", title: "新标签页" }, extra || {});
  }
  function newBrowserTab(state) {
    const st = state || makeState("home", { url: "edge://newtab" });
    const t = { id: ++seq, bookmarked: false, history: [Object.assign({}, st)], histIndex: 0 };
    Object.assign(t, st);
    bTabs.push(t);
    activeB = bTabs.length - 1;
    return t;
  }
  function bt() { return bTabs[activeB]; }

  function pushState(st) {
    const t = bt();
    t.history = t.history.slice(0, t.histIndex + 1);
    t.history.push(Object.assign({}, st));
    t.histIndex = t.history.length - 1;
    applyState(st);
  }
  function applyState(st) {
    const t = bt();
    t.type = st.type;
    t.query = st.query || "";
    t.articleId = st.articleId || null;
    t.url = st.url || "";
    t.title = st.title || "新标签页";
  }

  function goHome() {
    pushState(makeState("home", { url: "edge://newtab", title: "新标签页" }));
    refresh();
  }
  function doSearch(query) {
    const q = String(query || "").trim();
    if (!q) return;
    if (/^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(q) && q.indexOf(" ") === -1 && !/[一-龥]/.test(q)) {
      openExternal(q);
      return;
    }
    pushState(makeState("search", { query: q, url: "edge://search?q=" + encodeURIComponent(q), title: q + " - 搜索" }));
    refresh();
  }
  function openArticle(id) {
    const article = ARTICLES[id] || ARTICLES.tide;
    pushState(makeState("article", { articleId: article.id, url: article.url, title: article.title }));
    refresh();
  }
  function openExternal(raw) {
    let url = String(raw).trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    pushState(makeState("external", { url: url, title: url.replace(/^https?:\/\//, "").split("/")[0] }));
    refresh();
  }

  function addressFor(t) {
    if (t.type === "search") return "https://www.bing.com/search?q=" + t.query;
    if (t.type === "article") return t.url;
    if (t.type === "external") return t.url;
    return "edge://newtab";
  }

  function faviconFor(t) {
    if (t.type === "article") return icon("news");
    if (t.type === "external") return icon("globe");
    if (t.type === "search") return icon("search");
    return icon("compass");
  }

  /* ---------------- shell ---------------- */

  function tabsHTML() {
    return bTabs.map((t, i) =>
      '<button class="edge-tab' + (i === activeB ? " active" : "") + '" data-btab="' + i + '">' +
      '<span class="edge-tab-favicon">' + faviconFor(t) + "</span>" +
      '<span class="edge-tab-title">' + escapeHTML(t.title || "新标签页") + "</span>" +
      '<span class="edge-tab-close" data-btab-close="' + i + '" role="button" aria-label="关闭标签页">' + icon("close") + "</span></button>"
    ).join("") +
      '<button class="edge-new-tab" data-bnew-tab title="新建标签页">' + icon("plus") + "</button>" +
      '<span class="edge-tab-spacer"></span><span class="edge-profile" title="黄蓝少年">黄</span>';
  }

  function toolbarHTML() {
    const t = bt();
    const canBack = t.histIndex > 0;
    const canForward = t.histIndex < t.history.length - 1;
    return (
      '<div class="edge-toolbar">' +
      '<button class="edge-nav-btn" data-bnav="back" aria-label="后退"' + (canBack ? "" : " disabled") + ">" + icon("arrow-left") + "</button>" +
      '<button class="edge-nav-btn" data-bnav="forward" aria-label="前进"' + (canForward ? "" : " disabled") + ">" + icon("arrow-right") + "</button>" +
      '<button class="edge-nav-btn" data-bnav="reload" aria-label="刷新">' + icon("refresh") + "</button>" +
      '<button class="edge-nav-btn" data-bnav="home" aria-label="主页">' + icon("home") + "</button>" +
      '<div class="edge-address">' + icon(t.type === "external" ? "globe" : (t.type === "search" ? "search" : "compass")) +
      '<input id="edge-address" type="text" value="' + escapeHTML(addressFor(t)) + '" aria-label="地址和搜索栏" autocomplete="off">' +
      '<button class="edge-address-star' + (t.bookmarked ? " bookmarked" : "") + '" data-toggle-bookmark aria-label="收藏此页">' + icon("star") + "</button></div>" +
      '<div class="edge-toolbar-actions">' +
      '<button class="edge-action" data-edge-action="collections" title="集锦">' + icon("panel") + "</button>" +
      '<button class="edge-action" data-edge-action="read" title="沉浸式阅读">' + icon("file-text") + "</button>" +
      '<button class="edge-action" data-edge-action="translate" title="译">' + icon("language") + "</button>" +
      '<button class="edge-action" data-edge-action="menu" title="设置及其他">' + icon("more-horizontal") + "</button>" +
      "</div></div>" +
      '<div class="edge-loadbar" id="edge-loadbar"><i></i></div>'
    );
  }

  function bookmarksHTML() {
    const marks = [
      { label: "必应", url: "https://www.bing.com", dot: "" },
      { label: "黄蓝工作室", url: "w13.design", dot: "blue" },
      { label: "Solar Journal", url: "w13.design/journal", dot: "teal" },
      { label: "设计灵感", url: "dribbble.com", dot: "orange" },
      { label: "GitHub", url: "github.com", dot: "blue" }
    ];
    return '<div class="edge-bookmarks">' + marks.map((m) =>
      '<button class="edge-bookmark" data-bookmark-url="' + escapeHTML(m.url) + '"><span class="bm-dot ' + m.dot + '"></span>' + escapeHTML(m.label) + "</button>"
    ).join("") + "</div>";
  }

  function homeHTML() {
    const links = [
      { label: "必应", cls: "blue", letter: "B", url: "bing.com" },
      { label: "设计", cls: "gold", letter: "D", url: "w13.design" },
      { label: "代码", cls: "dark", letter: "G", url: "github.com" },
      { label: "音乐", cls: "teal", letter: "M", url: "music.w13.dev" },
      { label: "新闻", cls: "red", letter: "N", url: "news.w13.dev" },
      { label: "商店", cls: "purple", letter: "S", url: "store.w13.dev" }
    ];
    const feeds = [
      { id: "tide", art: "", tag: "设计 · 8 分钟", title: "潮汐与日冕：Windows 13 的设计语言" },
      { id: "color", art: "alt", tag: "色彩 · 5 分钟", title: "为什么是黄蓝色？一次关于温度的实验" },
      { id: "search", art: "alt2", tag: "体验 · 6 分钟", title: "搜索的未来：更少点击，更多答案" }
    ];
    return (
      '<div class="browser-home">' +
      '<div class="browser-brand"><span class="browser-orb"></span><h1>Microsoft Edge</h1><p>为黄蓝桌面打造的概念浏览器</p></div>' +
      '<form class="browser-search" id="home-search-form">' + icon("search") +
      '<input id="home-search-input" type="text" placeholder="搜索网页、问题或 URL" autocomplete="off" aria-label="搜索">' +
      '<button class="browser-search-btn" type="submit">搜索</button></form>' +
      '<div class="quick-links">' + links.map((l) =>
        '<button class="quick-link" data-quick-url="' + escapeHTML(l.url) + '"><span class="quick-link-logo ' + l.cls + '">' + l.letter + "</span><span>" + l.label + "</span></button>"
      ).join("") + "</div>" +
      '<div class="browser-feed-head"><b>为你精选</b><span>根据你的黄蓝品味更新</span></div>' +
      '<div class="feed-grid">' + feeds.map((f) =>
        '<button class="feed-card" data-open-article="' + f.id + '"><span class="feed-art ' + f.art + '"></span>' +
        '<span class="feed-copy"><b>' + f.title + "</b><small>" + f.tag + "</small></span></button>"
      ).join("") + "</div>" +
      '<div class="browser-home-footer">Windows 13 · Edge 概念版 128.0 · 此页面不会连接真实网络</div>' +
      "</div>"
    );
  }

  function resultsFor(q) {
    const clean = escapeHTML(q);
    return [
      { id: "tide", site: "w13.design", fav: "W", title: clean + "：从潮汐到日冕的设计方法", desc: "我们如何用 70% 蓝、20% 中性表面和 10% 金色，构建一套安静但有温度的系统界面。" },
      { id: "color", site: "solar.journal", fav: "S", title: "关于“" + clean + "”的 12 个色彩实验", desc: "从 42 组配色中筛选出的黄蓝组合，以及它们在深色与浅色主题下的表现。" },
      { id: "search", site: "windows.blog", fav: "M", title: clean + " · 搜索结果页的下一代形态", desc: "摘要卡、来源链接与更少的点击：一次关于浏览器信息架构的讨论。" }
    ];
  }

  function searchHTML() {
    const t = bt();
    const results = resultsFor(t.query);
    return (
      '<div class="browser-search-page">' +
      '<div class="brand-mini"><span class="brand-orb-mini"></span>Edge 搜索</div>' +
      '<form class="browser-search-form" id="search-page-form">' + icon("search") +
      '<input id="search-page-input" type="text" value="' + escapeHTML(t.query) + '" aria-label="搜索">' +
      '<button class="browser-search-btn" type="submit">搜索</button></form>' +
      '<div class="browser-tabs-row"><span class="active">全部</span><span>图片</span><span>新闻</span><span>视频</span><span>学术</span></div>' +
      '<p class="result-meta">约 1,280,000 个结果 · 0.32 秒</p>' +
      '<div class="ai-answer"><div class="ai-answer-head">' + icon("sparkles") + "AI 摘要</div>" +
      "<p>关于“" + escapeHTML(t.query) + "”，可以这样理解：它既是 Windows 13 黄蓝设计语言的核心概念，也是一种把秩序与温度放在同一张桌面上的尝试。深海蓝提供沉浸感，日冕金提供方向感，两者以 70/20/10 的比例共存。</p>" +
      "<small>由本地概念模型生成 · 仅供参考</small></div>" +
      results.map((r) =>
        '<article class="search-result"><div class="search-result-url"><span class="result-fav">' + r.fav + "</span>" + escapeHTML(r.site) + " › journal</div>" +
        '<h3><button data-open-article="' + r.id + '">' + r.title + "</button></h3><p>" + r.desc + "</p>" +
        '<div class="result-site-links"><button data-open-article="' + r.id + '">阅读全文</button><button data-edge-action="save">保存</button><button data-edge-action="more">更多</button></div></article>'
      ).join("") +
      '<div class="search-page-footer"><span>第 1 页 · 共 3 条概念结果</span>' +
      '<button class="real-search" data-real-search="' + escapeHTML(t.query) + '">' + icon("external") + "在真实必应中搜索</button></div>" +
      "</div>"
    );
  }

  function articleHTML() {
    const article = ARTICLES[bt().articleId] || ARTICLES.tide;
    return (
      '<article class="article-page">' +
      '<header class="article-banner"><div class="article-sitebar"><span class="article-site"><span class="site-mark">W</span>' + article.site + "</span>" +
      '<button class="article-open-real" data-external-open="https://www.bing.com/search?q=' + encodeURIComponent(article.title) + '">' + icon("external") + "在真实浏览器中打开</button></div>" +
      '<div class="article-banner-copy"><h1>' + article.title + "</h1></div></header>" +
      '<div class="article-body"><div class="article-byline"><span>' + article.byline + "</span><i></i><span>" + article.date + "</span></div>" +
      article.body +
      '<div class="article-related">' + article.related.map((r) =>
        '<button data-open-article="' + r.id + '"><small>' + r.tag + "</small><b>" + r.title + "</b></button>"
      ).join("") + "</div></div></article>"
    );
  }

  function externalHTML() {
    const t = bt();
    const host = t.url.replace(/^https?:\/\//, "").split("/")[0];
    return (
      '<div class="external-page"><div class="external-card"><span class="external-icon">' + icon("globe") + "</span>" +
      "<h2>即将离开概念浏览器</h2><p>这是 Windows 13 的模拟浏览器，无法渲染真实网页。你可以选择在系统默认浏览器中打开，或返回新标签页。</p>" +
      '<div class="external-url">' + escapeHTML(t.url) + "</div>" +
      '<a class="btn primary" href="' + escapeHTML(t.url) + '" target="_blank" rel="noopener noreferrer">' + icon("external") + "在真实浏览器中打开</a>" +
      '<div style="display:flex;gap:7px;margin-top:8px"><button class="btn" style="flex:1" data-external-copy="' + escapeHTML(t.url) + '">' + icon("copy") + "复制链接</button>" +
      '<button class="btn" style="flex:1" data-bnav="home">' + icon("home") + "返回新标签页</button></div>" +
      '<div style="margin-top:12px;font-size:8px;color:var(--muted)">目标站点：' + escapeHTML(host) + "</div></div></div>"
    );
  }

  function viewHTML() {
    const t = bt();
    if (t.type === "search") return searchHTML();
    if (t.type === "article") return articleHTML();
    if (t.type === "external") return externalHTML();
    return homeHTML();
  }

  function refresh() {
    if (!currentWin) return;
    const root = currentWin.querySelector(".window-content > .edge-app");
    if (!root) return;
    root.innerHTML =
      '<div class="edge-tabs">' + tabsHTML() + "</div>" +
      toolbarHTML() + bookmarksHTML() +
      '<div class="edge-view" id="edge-view">' + viewHTML() + "</div>";
    if (W13.updateWindowTitle) W13.updateWindowTitle(currentWin, bt().title || "Microsoft Edge");
    simulateLoad();
  }

  function simulateLoad() {
    if (!currentWin) return;
    const bar = currentWin.querySelector("#edge-loadbar");
    if (!bar) return;
    bar.classList.add("loading");
    setTimeout(() => {
      bar.classList.remove("loading");
      const fill = bar.querySelector("i");
      if (fill) fill.style.width = "0";
    }, 760);
  }

  /* ---------------- interactions ---------------- */

  function bind(win) {
    currentWin = win;
    const root = win.querySelector(".window-content > .edge-app");
    if (!root) return;

    root.addEventListener("click", (e) => {
      const close = e.target.closest("[data-btab-close]");
      if (close) {
        e.stopPropagation();
        const idx = Number(close.dataset.btabClose);
        bTabs.splice(idx, 1);
        if (!bTabs.length) { W13.closeWindow(win); return; }
        activeB = Math.min(activeB, bTabs.length - 1);
        refresh();
        return;
      }
      const tabBtn = e.target.closest("[data-btab]");
      if (tabBtn) { activeB = Number(tabBtn.dataset.btab); refresh(); return; }
      if (e.target.closest("[data-bnew-tab]")) {
        if (bTabs.length >= 8) { showToast("标签页已满", "最多同时打开 8 个标签页。", "info", 2000); return; }
        newBrowserTab(makeState("home", { url: "edge://newtab", title: "新标签页" }));
        refresh();
        return;
      }
      const nav = e.target.closest("[data-bnav]");
      if (nav) {
        const t = bt();
        const action = nav.dataset.bnav;
        if (action === "back" && t.histIndex > 0) { t.histIndex--; applyState(t.history[t.histIndex]); refresh(); }
        else if (action === "forward" && t.histIndex < t.history.length - 1) { t.histIndex++; applyState(t.history[t.histIndex]); refresh(); }
        else if (action === "home") goHome();
        else if (action === "reload") { refresh(); showToast("正在刷新", "概念页面已重新加载。", "refresh", 1400); }
        return;
      }
      if (e.target.closest("[data-toggle-bookmark]")) {
        const t = bt();
        t.bookmarked = !t.bookmarked;
        refresh();
        showToast(t.bookmarked ? "已添加到收藏夹" : "已从收藏夹移除", t.title || "新标签页", "star", 1700);
        return;
      }
      const articleBtn = e.target.closest("[data-open-article]");
      if (articleBtn) { openArticle(articleBtn.dataset.openArticle); return; }
      const bookmark = e.target.closest("[data-bookmark-url]");
      if (bookmark) {
        const url = bookmark.dataset.bookmarkUrl;
        if (url === "w13.design" || url === "w13.design/journal") { goHome(); }
        else openExternal(url);
        return;
      }
      const quick = e.target.closest("[data-quick-url]");
      if (quick) { openExternal(quick.dataset.quickUrl); return; }
      const searchGo = e.target.closest("[data-search-go]");
      if (searchGo) {
        const box = searchGo.closest(".browser-search, .browser-search-form");
        const input = box && box.querySelector("input");
        doSearch(input ? input.value : "");
        return;
      }
      const real = e.target.closest("[data-real-search]");
      if (real) {
        const q = real.dataset.realSearch;
        window.open("https://www.bing.com/search?q=" + encodeURIComponent(q), "_blank", "noopener");
        showToast("正在打开必应", "已尝试在真实浏览器中搜索“" + q + "”。", "external", 2400);
        return;
      }
      const extOpen = e.target.closest("[data-external-open]");
      if (extOpen) { openExternal(extOpen.dataset.externalOpen); return; }
      const copy = e.target.closest("[data-external-copy]");
      if (copy) {
        const url = copy.dataset.externalCopy;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(() => showToast("已复制链接", url, "copy", 2000)).catch(() => showToast("链接", url, "copy", 2400));
        } else {
          showToast("链接", url, "copy", 2400);
        }
        return;
      }
      const edgeAction = e.target.closest("[data-edge-action]");
      if (edgeAction) {
        const key = edgeAction.dataset.edgeAction;
        const map = {
          collections: ["集锦", "已保存 3 个网页到“黄蓝灵感”集锦。"],
          read: ["沉浸式阅读", "已进入阅读模式（概念演示）。"],
          translate: ["翻译", "此页面已经是简体中文，无需翻译。"],
          menu: ["Edge 设置", "概念浏览器提供最小化的设置面板。"],
          save: ["已保存", "结果已添加到你的集锦。"],
          more: ["更多", "此操作在概念版本中不可用。"]
        };
        const item = map[key] || ["Microsoft Edge", "概念浏览器"];
        showToast(item[0], item[1], "globe", 2200);
        return;
      }
    });

    root.addEventListener("submit", (e) => {
      const form = e.target;
      if (form.id === "home-search-form" || form.id === "search-page-form") {
        e.preventDefault();
        const input = form.querySelector("input");
        doSearch(input ? input.value : "");
      }
    });

    root.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      if (e.target.id === "edge-address") {
        e.preventDefault();
        const value = e.target.value.trim();
        if (!value) return;
        if (/^edge:\/\//.test(value)) { goHome(); return; }
        doSearch(value);
      }
    });
  }

  W13.registerApp("browser", {
    name: "Microsoft Edge",
    width: 1040,
    height: 700,
    minWidth: 560,
    minHeight: 400,
    render() {
      bTabs = [];
      activeB = 0;
      newBrowserTab(makeState("home", { url: "edge://newtab", title: "新标签页" }));
      return (
        '<div class="edge-app">' +
        '<div class="edge-tabs">' + tabsHTML() + "</div>" +
        toolbarHTML() + bookmarksHTML() +
        '<div class="edge-view" id="edge-view">' + homeHTML() + "</div>" +
        "</div>"
      );
    },
    init(win) {
      bind(win);
      setTimeout(simulateLoad, 90);
    },
    reopen(win) {
      currentWin = win;
      refresh();
    },
    onClose() { currentWin = null; }
  });

  W13.openUrl = function (url) {
    W13.openApp("browser");
    openExternal(url);
  };
})();
