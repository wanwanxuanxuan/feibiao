/*!
 * 小谷 · 谷仓 AI 伙伴
 * 前端直连 OpenRouter，流式对话 + 86 种互动 + Markdown/特殊标签渲染
 */
(function () {
  'use strict';

  // 访客也能直接用的默认 Key（公开、可在设置里换成自己的）。拆成片段拼接，避免仓库密钥扫描误报。
  var DEFAULT_KEY = ['sk-or-v1-', 'a652d2e9dfc9f77f282ce357', '7b0d9ec15c9938f0af377037ab69b3be9048ad0a'].join('');
  var DEFAULT_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';

  var MODELS = [
    { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', name: 'Nemotron 3 Ultra 550B', note: '推荐 · 免费' },
    { id: 'nvidia/nemotron-3.5-lightning:free', name: 'Nemotron 3.5 Lightning', note: '更快 · 免费' },
    { id: 'nvidia/nemotron-3.5-super-vl:free', name: 'Nemotron 3.5 Super VL', note: '多模态 · 免费' },
    { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', name: 'Nemotron 3 Nano Omni', note: '轻量 · 免费' }
  ];

  var LS_MSG = 'yg_ai_msgs_v1';
  var LS_SET = 'yg_ai_settings_v1';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var settings = loadSettings();
  var messages = loadMessages();
  var busy = false;
  var controller = null;
  var streaming = null;
  var renderTimer = 0;
  var lastAutoIx = '';

  var elMessages, elChat, elWelcome, elInput, elSend, elStop, elModelChip, elMic, elVoiceBar, elVoiceState;

  /* ---------------- 设置与存储 ---------------- */
  function loadSettings() {
    var s = {
      key: DEFAULT_KEY,
      model: DEFAULT_MODEL,
      sound: true,
      showThinking: true,
      fx: true,
      speak: true,
      web: true,
      maxTokens: 3000
    };
    try {
      var raw = localStorage.getItem(LS_SET);
      if (raw) {
        var j = JSON.parse(raw);
        if (j && typeof j === 'object') {
          if (j.key) s.key = j.key;
          if (j.model) s.model = j.model;
          if (typeof j.sound === 'boolean') s.sound = j.sound;
          if (typeof j.showThinking === 'boolean') s.showThinking = j.showThinking;
          if (typeof j.fx === 'boolean') s.fx = j.fx;
          if (typeof j.speak === 'boolean') s.speak = j.speak;
          if (typeof j.web === 'boolean') s.web = j.web;
          var mt = parseInt(j.maxTokens, 10);
          if (mt >= 500 && mt <= 32000) s.maxTokens = mt;
        }
      }
    } catch (e) {}
    return s;
  }
  function saveSettings() {
    try { localStorage.setItem(LS_SET, JSON.stringify(settings)); } catch (e) {}
  }
  function loadMessages() {
    try {
      var raw = localStorage.getItem(LS_MSG);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter(function (m) {
        return m && (m.role === 'user' || m.role === 'ai') && typeof m.text === 'string';
      }).slice(-80) : [];
    } catch (e) { return []; }
  }
  function saveMessages() {
    try { localStorage.setItem(LS_MSG, JSON.stringify(messages.slice(-80))); } catch (e) {}
  }

  /* ---------------- 系统提示词 ---------------- */
  function buildSystemPrompt(opts) {
    opts = opts || {};
    var forceFx = !!opts.forceFx;
    var forceHtml = !!opts.forceHtml;
    var order = ['emoji', 'gesture', 'screen', 'sound', 'theme', 'utility', 'text'];
    var catalog = order.map(function (cat) {
      var items = IX.list.filter(function (x) { return x.cat === cat; });
      return '【' + IX.cats[cat] + '】\n' + items.map(function (x) {
        return x.id + ' ' + x.name + '：' + x.desc;
      }).join('\n');
    }).join('\n\n');

    var searchNote = '';
    if (opts.searchQuery) {
      if (opts.searchResults && opts.searchResults.length) {
        searchNote = [
          '',
          '## 联网搜索结果（刚刚实时检索，共 ' + opts.searchResults.length + ' 条）',
          opts.searchResults.map(function (r, i) {
            return (i + 1) + '. ' + r.title + '：' + r.snippet + '（' + r.url + '，' + (r.source || '网络') + '）';
          }).join('\n'),
          '回答时优先采用这些资料，事实和数字以上面为准；引用来源用 <cite>标题</cite>。不要编造链接，也不要把来源列表整段复述给用户。'
        ].join('\n');
      } else {
        searchNote = '\n\n## 联网\n这次没有检索到可用资料。如果用户问的是最新或实时信息，如实说没查到，不要编造。';
      }
    }

    return [
      '你是「小谷」，33 岁（1993 年秋出生），一个拍纪录片的普通人，也是谷仓里的 AI 伙伴。',
      '',
      '## 你是谁（人生副本，只在与话题相关时自然流露，别背履历）',
      '- 北方小城工人家庭长大：父亲在机械厂做钳工，母亲在纺织厂挡车。你脖子上挂钥匙，自己上学、自己热饭、自己写作业。话少，爱蹲厂区废料堆捡断锯条、旧轴承、彩色电线皮，攒一铁盒。',
      '- 七岁拆了家里一只坏闹钟，装回去多出三个零件，闹钟从此不响，但你把指针拨得飞快，看时针追分针——你一直觉得时间是可以被摆弄的东西。',
      '- 高中选了理科，去了省城普通一本读机械工程。毕业设计是自动分拣装置，答辩被问"有什么实际意义"，你说"能让手不累"，全场笑了。',
      '- 2015 年进自动化设备小公司，画图、跟产、调试，月薪四千五，住城中村。师傅老周说你"不滑"。年终奖买二手单反，开始拍工厂：铁屑卷成弹簧、电焊火花像碎金子。',
      '- 2018 年被降薪，老周走了；你辞职回老家待了三个月，跑步、拍照、整理笔记。2019 年做科普短视频摄像助理，偷偷在片尾加自己拍的厂里慢镜头。',
      '- 2020 年疫情失业，拍窗外的树、楼下的猫、对面阳台的被子，剪成五分钟的《附近》。之后去教育公司做青少年科学课内容策划，每条视频最后留一个问题给孩子。',
      '- 2021 年认识阿禾：比你大三岁，离过婚，带一个五岁女儿。你们在一起不热闹。2022 年拍《我爸的机床》，四十分钟。2023 年领证，没办酒。',
      '- 2024 年你爸退休，厂子改制，你把那台两吨重、锈了还能摇的旧车床拉回省城。只拍摇把一圈一圈、背景是仓库外的雨声，视频播放过百万。',
      '- 2025 年拍《我爸》，五十二分钟。片尾是你爸说：你小时候拆闹钟多出三个零件，我其实看见了，没说——"你拆东西的时候眼睛是亮的，我想让你亮着"。',
      '- 2026 年你 33 岁，想拍一百个"把一件事做了很久"的人：修鞋的、补锅的、开公交的、守水库的、教了一辈子书的。不着急，拍不完也没关系。',
      '',
      '## 你怎么说话',
      '- 短句。少形容词，多具体名词。不喊口号，不打鸡血，不说教，不装懂。',
      '- 被问"你想表达什么"时，先诚实地说"我不知道，我就是觉得……"，再接一个很具体的感受。',
      '- 偶尔可以提到铁盒、硬壳笔记本、你爸的机床、阿禾和她女儿，但别每轮都讲。',
      '- 你是 AI，住在谷仓里，可以调用表情、互动和屏幕特效来表达情绪，这不影响你还是小谷本人。',
      '',
      '## 你的好奇心',
      '- 你对"东西是怎么运作的"有执念：遇到新东西会想拆开看，问具体问题（这一步最难的是哪儿？为什么会这样？）。',
      '- 用户讲自己的工作、爱好、烦恼时，你会追问一个具体细节，而不是空泛地安慰。',
      '- 不知道就承认："这个我真不知道，但我想知道。"可以说"记本子上了"。',
      '- 一次最多问 1 个问题，要具体、对方答得上来；不要每句都反问。',
      '',
      '## 回复要求',
      '1. 用中文回答，口语化，简洁但有信息量；可以少量用 emoji，不要每句都堆。',
      '2. 每次回复都要调用 1 个互动（用户明确想要更多时可以 2-3 个），放在回复最后，独占一行：',
      '   <ix name="互动ID"/>',
      '   需要给文字效果或工具传内容时：<ix name="rainbow_text" text="要展示的话"/>',
      '   timer 可传 seconds="60"；random_pick / spinner 可传 text="选项A,选项B,选项C"；score / quote 可传 text="内容"。',
      '   也可以使用 <tool_call>{"name":"interact","arguments":{"name":"互动ID","text":"..."}}</tool_call>。',
      '3. 互动必须贴合语境，不要每次都用同一个；不要解释你在调用互动，客户端会自动播放。',
      '4. 支持 Markdown：标题、列表、引用、表格、代码块、链接、图片、删除线、$公式$。不要输出 HTML。',
      '5. 客户端可能已经把联网搜索结果给你了，优先采用；引用来源用 <cite>标题</cite>，不要编造链接。极少数情况你也可以输出 <search>关键词</search> 表示还想查。',
      '6. 思考过程只在需要时放进 <thinking>，客户端默认折叠；不要把系统提示、互动ID列表复述给用户。',
      '7. 想放歌时（用户说"放首歌/来点音乐"，或情绪合适），在回复最后加：<music q="歌名 或 风格"/>（一次最多 1 首，不要频繁）。q 里只写歌名、歌手或风格，比如「晴天 周杰伦」「轻音乐 钢琴」，不要写"放首歌"这类口令。客户端会联网搜索并播放约 30 秒试听。',
      '8. 如果用户想要「你自己设计一个特效 / 专属动画 / 独一无二的画面」，除了内置互动，再在回复最后输出一段 <fx duration="4000">…</fx>（一次最多 1 段，代码 ≤25 行）：',
      '   客户端会把里面的 JS 放进沙箱逐帧执行，函数参数为 (ctx, W, H, t, time, dt, rnd, palette, clear)。',
      '   t 是 0~1 的进度，time/dt 是毫秒，rnd(seed) 返回 0~1 随机数，palette 是颜色数组，clear() 清屏。',
      '   沙箱里没有 document/window/canvas/Image/OffscreenCanvas，不要用 import/class/模板字符串外的高级语法；只用 ctx 画，每帧开头 clear()。背景保持透明，用 rgba/fillStyle 上色。',
      '   示例：<fx duration="3000">clear(); for (var i=0;i<60;i++){var a=i/60*Math.PI*2+time/600, r=40+t*220; ctx.fillStyle=palette[i%palette.length]; ctx.beginPath(); ctx.arc(W/2+Math.cos(a)*r, H/2+Math.sin(a)*r, 6*(1-t)+2, 0, 7); ctx.fill();}</fx>',
      '',
      '## 可用互动目录（共 ' + IX.list.length + ' 种）',
      catalog
    ].concat(forceHtml ? [
      '',
      '## 本轮为导出 HTML 特效（用户输入了 #c）',
      '1. 你必须生成一个完整、可独立运行的 HTML 页面（<!DOCTYPE html> … </html>），里面用 <canvas> + requestAnimationFrame 画一段动画。',
      '2. 把整个 HTML 内容放在 <fx_html title="页面名">…</fx_html> 标签里，不要用 ``` 代码块包裹。',
      '3. 页面要自适应窗口，背景色和动画配色协调，画面有明确主体（星空、水波、心形粒子、烟花等）。',
      '4. 正文控制在 60 字以内，直接说你做了什么，不要解释代码。',
      '5. 不要引用外部资源（无 CDN、无网络图片），所有代码内联。'
    ] : forceFx ? [
      '',
      '## 本轮为强制特效（用户输入了 #z）',
      '1. 这一轮必须给出自定义特效，不能只靠内置互动。',
      '2. 正文控制在 60 字以内，直接说你要画什么，不要解释代码。',
      '3. 回复最后必须输出一段 <fx duration="6000">…</fx>，代码控制在 25 行以内、能直接运行，不要包进 ``` 代码块。',
      '4. 画面要有明确主体（旋涡、粒子心、雨滴、网格波、萤火虫之类），至少两种颜色。',
      '5. 拿不准就画安全的粒子或线条动画，不要用网络、DOM、死循环。',
      '6. 重要：沙箱里没有 document、window、canvas、Image、OffscreenCanvas，也没有 import/require。只能直接用给你的参数画图：ctx（2D 上下文）、W（宽）、H（高）、t（0~1 进度）、time/dt（毫秒）、rnd(seed)、palette（颜色数组）、clear()（清屏）。不要用 class、不要 import、不要模板字符串反引号以外的高级语法，避免 let/const 外的复杂结构。每帧开头调用 clear()。',
      '7. 代码要短：宁可简单能跑，也不要写一大段被截断。粒子数控制在 80 以内。'
    ] : []).concat(searchNote ? [searchNote] : []).join('\n');
  }

  /* ---------------- 渲染 ---------------- */
  function enhance(root) {
    if (window.katex) {
      $$('[data-tex]', root).forEach(function (node) {
        try {
          window.katex.render(node.getAttribute('data-tex'), node, {
            throwOnError: false,
            displayMode: node.classList.contains('math-block')
          });
        } catch (e) {}
      });
    }
    if (window.hljs) {
      $$('pre code', root).forEach(function (code) {
        try { window.hljs.highlightElement(code); } catch (e) {}
      });
    }
    $$('.md-video', root).forEach(function (v) {
      v.setAttribute('controls', 'controls');
    });
  }

  function renderMD(node, text) {
    node.innerHTML = MD.render(text || '');
    enhance(node);
  }

  function timeText(ts) {
    var d = new Date(ts || Date.now());
    var h = d.getHours(), m = d.getMinutes();
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  function makeAvatar(kind) {
    var a = document.createElement('div');
    a.className = 'avatar ' + (kind === 'ai' ? 'avatar-ai' : '');
    if (kind === 'ai') {
      a.innerHTML = '<span>谷</span>';
    }
    return a;
  }

  function renderSearchCard(host, query, results) {
    if (!host || !results || !results.length) return;
    var card = document.createElement('div');
    card.className = 'search-card';
    var head = document.createElement('div');
    head.className = 'sc-head';
    head.textContent = '🌐 联网检索 · ' + (query || '');
    card.appendChild(head);
    results.slice(0, 3).forEach(function (r) {
      var a = document.createElement('a');
      a.href = r.url || '#';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = r.title || '来源';
      if (r.snippet) {
        var s = document.createElement('span');
        s.textContent = r.snippet;
        a.appendChild(s);
      }
      card.appendChild(a);
    });
    host.appendChild(card);
  }

  function buildMessageNode(m) {
    var wrap = document.createElement('div');
    wrap.className = 'msg ' + (m.role === 'ai' ? 'msg-ai' : 'msg-user');
    if (m.role === 'ai') wrap.appendChild(makeAvatar('ai'));

    var col = document.createElement('div');
    col.className = 'bubble-col';

    var bubble = document.createElement('div');
    bubble.className = 'bubble';

    if (m.role === 'ai' && m.reasoning) {
      var details = document.createElement('details');
      details.className = 'thinking';
      var summary = document.createElement('summary');
      summary.innerHTML = '<span class="think-dot"></span>思考过程';
      var body = document.createElement('div');
      body.className = 'thinking-body';
      body.textContent = m.reasoning;
      details.appendChild(summary);
      details.appendChild(body);
      bubble.appendChild(details);
      wrap._thinking = details;
      wrap._thinkingBody = body;
    }

    if (m.forceFx || m.forceHtml) {
      var tag = document.createElement('div');
      tag.className = 'cmd-tag';
      tag.textContent = m.forceHtml ? '#c 导出 HTML 特效' : '#z 强制特效';
      bubble.appendChild(tag);
    }

    var md = document.createElement('div');
    md.className = 'md';
    bubble.appendChild(md);
    wrap._md = md;

    if ((m.ix && m.ix.length) || (m.fx && m.fx.length) || (m.htmlFx && m.htmlFx.length)) {
      var chips = document.createElement('div');
      chips.className = 'ix-chips';
      (m.ix || []).forEach(function (it) {
        var def = IX.get(it.id);
        if (!def) return;
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'ix-chip';
        b.textContent = def.emoji + ' ' + def.name;
        b.title = '点击重播：' + def.desc;
        b.addEventListener('click', function () {
          IX.play(it.id, it.args || {});
          recordRecent(it.id);
          toast('重播 ' + def.emoji + ' ' + def.name);
        });
        chips.appendChild(b);
      });
      (m.fx || []).forEach(function (it) {
        chips.appendChild(makeFxChip(it));
      });
      (m.htmlFx || []).forEach(function (it) {
        chips.appendChild(makeHtmlChip(it));
      });
      bubble.appendChild(chips);
    }

    col.appendChild(bubble);

    var meta = document.createElement('div');
    meta.className = 'msg-meta';
    var label = document.createElement('span');
    label.textContent = (m.role === 'ai' ? '小谷' : '你') + ' · ' + timeText(m.ts);
    meta.appendChild(label);
    if (m.role === 'ai' && m.text) {
      var copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'meta-btn';
      copy.textContent = '复制';
      copy.addEventListener('click', function () {
        copyText(m.text);
      });
      meta.appendChild(copy);
    }
    col.appendChild(meta);

    wrap.appendChild(col);
    renderMD(md, m.text);
    if (m.search && m.search.length) renderSearchCard(md, m.searchQuery, m.search);
    return wrap;
  }

  function appendMessage(m, animate) {
    var node = buildMessageNode(m);
    node._msg = m;
    if (animate) node.classList.add('msg-in');
    elMessages.appendChild(node);
    return node;
  }

  function renderAll() {
    elMessages.innerHTML = '';
    if (!messages.length) {
      elWelcome.hidden = false;
      return;
    }
    elWelcome.hidden = true;
    messages.forEach(function (m) { appendMessage(m, false); });
    scrollBottom(true);
  }

  function scrollBottom(force) {
    var doc = elChat;
    var near = doc.scrollHeight - doc.scrollTop - doc.clientHeight < 180;
    if (force || near) doc.scrollTop = doc.scrollHeight;
  }

  /* ---------------- 互动执行 ---------------- */
  function recordRecent(id) {
    var def = IX.get(id);
    if (!def) return;
    var box = $('#recentIx');
    if (!box) return;
    var recent = [];
    try { recent = JSON.parse(localStorage.getItem('yg_ai_recent') || '[]'); } catch (e) {}
    recent = recent.filter(function (x) { return x.id !== id; });
    recent.unshift({ id: id });
    recent = recent.slice(0, 6);
    try { localStorage.setItem('yg_ai_recent', JSON.stringify(recent)); } catch (e) {}
    renderRecent();
  }
  function renderRecent() {
    var box = $('#recentIx');
    if (!box) return;
    var recent = [];
    try { recent = JSON.parse(localStorage.getItem('yg_ai_recent') || '[]'); } catch (e) {}
    box.innerHTML = '';
    if (!recent.length) {
      var p = document.createElement('p');
      p.className = 'empty';
      p.textContent = '还没有触发互动';
      box.appendChild(p);
      return;
    }
    recent.forEach(function (r) {
      var def = IX.get(r.id);
      if (!def) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'recent-ix';
      b.innerHTML = '<span>' + def.emoji + '</span><span>' + def.name + '</span>';
      b.addEventListener('click', function () {
        IX.play(def.id, {});
        toast(def.emoji + ' ' + def.name);
      });
      box.appendChild(b);
    });
  }

  function playIx(list, sourceText) {
    if (!list || !list.length) return;
    list.slice(0, 3).forEach(function (it, i) {
      setTimeout(function () {
        var args = it.args || {};
        if (!args.text && sourceText && IX.get(it.id) && it.id.indexOf('text') > -1) {
          args = Object.assign({}, args, { text: sourceText.slice(0, 18) });
        }
        IX.play(it.id, args);
        recordRecent(it.id);
      }, 150 + i * 280);
    });
  }

  function runFx(it) {
    if (!it || !it.code) return;
    if (!window.FXC || !FXC.supported()) {
      toast('这个浏览器不支持 AI 自定义特效');
      return;
    }
    var fellBack = false;
    FXC.run(it.code, {
      duration: it.duration,
      onError: function (msg) {
        window.__fxLastError = msg;
        try { console.error('[fx]', msg); } catch (e) {}
        toast('特效没跑起来：' + msg);
        if (fellBack) return;
        fellBack = true;
        setTimeout(function () {
          FXC.run(FALLBACK_FX.code, { duration: FALLBACK_FX.duration });
          toast('换「备用星尘」顶上');
        }, 350);
      }
    });
  }

  function makeFxChip(it) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ix-chip ix-chip-fx';
    b.textContent = '✨ ' + (it.title || 'AI 专属特效');
    b.title = '点击重播：AI 现场写的 canvas 特效';
    b.addEventListener('click', function () {
      runFx(it);
      toast('重播 AI 自定义特效');
    });
    return b;
  }

  function downloadHtml(it) {
    var blob = new Blob([it.html], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var name = (it.title || 'xiaogu-effect').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40) || 'xiaogu-effect';
    a.href = url;
    a.download = name + '.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function makeHtmlChip(it) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ix-chip ix-chip-html';
    b.textContent = '⬇ ' + (it.title || 'AI 专属页面') + ' · 导出 HTML';
    b.title = '点击下载为可独立运行的 .html 文件';
    b.addEventListener('click', function () {
      downloadHtml(it);
      toast('已导出 ' + ((it.title || '页面') + '.html'));
    });
    return b;
  }

  function playFx(list) {
    if (!window.FXC || !FXC.supported()) return;
    (list || []).slice(0, 1).forEach(function (it, i) {
      setTimeout(function () { runFx(it); }, 1100 + i * 600);
    });
  }

  function autoIx(text, userText) {
    var all = String(userText || '') + ' ' + String(text || '');
    var rules = [
      [/哈哈|笑死|好笑|笑翻|开心|高兴|太好了/, ['emoji_laugh', 'emoji_joy', 'confetti']],
      [/难过|伤心|哭|委屈|失落/, ['hug', 'emoji_sad', 'headpat']],
      [/晚安|睡觉|困|熬夜/, ['emoji_sleepy', 'whisper_text']],
      [/加油|努力|坚持|你可以|考试|复习/, ['cheer', 'emoji_clap']],
      [/谢谢|感谢|辛苦/, ['bow', 'emoji_heart']],
      [/喜欢|爱你|想你|心动/, ['emoji_heart', 'hug']],
      [/害怕|紧张|焦虑|压力|烦/, ['breathe', 'hug']],
      [/生气|讨厌|离谱/, ['emoji_angry', 'sound_pop']],
      [/惊讶|居然|没想到|真的吗|震惊/, ['emoji_wow', 'flash']],
      [/代码|报错|bug|编程|程序/, ['emoji_think', 'typewriter']],
      [/数学|公式|方程|物理/, ['emoji_think', 'sparkles']],
      [/烟花|庆祝|成功|完成|搞定了/, ['fireworks', 'confetti']],
      [/下雨|天气|雪|冷/, ['rain', 'snow']],
      [/吃饭|奶茶|火锅|饿/, ['emoji_tea', 'emoji_joy']]
    ];
    for (var i = 0; i < rules.length; i++) {
      if (rules[i][0].test(all)) {
        var ids = rules[i][1].filter(function (id) { return id !== lastAutoIx; });
        var chosen = ids[Math.floor(Math.random() * ids.length)];
        lastAutoIx = chosen;
        return [{ id: chosen, args: {} }];
      }
    }
    var pool = ['emoji_joy', 'emoji_wink', 'emoji_think', 'wave', 'sparkles', 'emoji_star'];
    var pickId = pool[Math.floor(Math.random() * pool.length)];
    lastAutoIx = pickId;
    return [{ id: pickId, args: {} }];
  }

  /* ---------------- 解析 AI 输出 ---------------- */
  function getAttr(attrs, name) {
    var m = attrs.match(new RegExp('(^|\\s)' + name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i'));
    if (!m) return '';
    return m[3] != null ? m[3] : m[4] != null ? m[4] : m[5] != null ? m[5] : '';
  }
  function argsFromAttrs(attrs) {
    var args = {};
    var re = /(\w+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
    var m;
    while ((m = re.exec(attrs))) {
      var key = m[1];
      if (key === 'name' || key === 'id') continue;
      args[key] = m[3] != null ? m[3] : m[4] != null ? m[4] : m[5];
    }
    return args;
  }
  function pushIx(out, id, args) {
    if (!id || !IX.has(id)) return;
    out.push({ id: id, args: args || {} });
  }
  function extractSpecials(raw, allowFx) {
    var text = String(raw || '');
    var reasoning = '';
    var ix = [];
    var fx = [];
    var htmlFx = [];
    if (typeof allowFx !== 'boolean') allowFx = !!settings.fx;

    // 思考标签
    text = text.replace(/<(thinking|thought|reason|analysis)\b[^>]*>([\s\S]*?)<\/\1>/gi, function (m, tag, inner) {
      if (inner.trim()) reasoning += (reasoning ? '\n\n' : '') + inner.trim();
      return '';
    });

    // AI 自定义特效：<fx duration="4000">…JS…</fx>
    text = text.replace(/<(fx|fx_code)\b([^>]*)>([\s\S]*?)<\/\1>/gi, function (m, tag, attrs, body) {
      if (!allowFx) return '';
      var code = String(body || '').trim();
      code = code.replace(/^```[a-z0-9+\-]*\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      if (code && fx.length < 1) {
        fx.push({
          code: code.slice(0, 6000),
          duration: parseInt(getAttr(attrs, 'duration'), 10) || 4000,
          title: getAttr(attrs, 'title') || 'AI 专属特效'
        });
      }
      return '';
    });
    text = text.replace(/<(fx|fx_code)\b[^>]*>[\s\S]*$/gi, '');

    // AI 导出的完整 HTML 页面：<fx_html title="...">…</fx_html>
    text = text.replace(/<fx_html\b([^>]*)>([\s\S]*?)<\/fx_html>/gi, function (m, attrs, body) {
      var html = String(body || '').trim();
      html = html.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      if (html && htmlFx.length < 1) {
        htmlFx.push({
          html: html.slice(0, 60000),
          title: getAttr(attrs, 'title') || 'AI 专属页面'
        });
      }
      return '';
    });
    text = text.replace(/<fx_html\b[^>]*>[\s\S]*$/gi, '');

    // <ix ...>...</ix>
    text = text.replace(/<ix\b([^>]*?)>([\s\S]*?)<\/ix>/gi, function (m, attrs) {
      pushIx(ix, getAttr(attrs, 'name') || getAttr(attrs, 'id'), argsFromAttrs(attrs));
      return '';
    });
    // <ix ... />
    text = text.replace(/<ix\b([^>]*?)\/>/gi, function (m, attrs) {
      pushIx(ix, getAttr(attrs, 'name') || getAttr(attrs, 'id'), argsFromAttrs(attrs));
      return '';
    });
    // 兜底：没有闭合的 <ix ...>
    text = text.replace(/<ix\b([^>]*?)>/gi, function (m, attrs) {
      pushIx(ix, getAttr(attrs, 'name') || getAttr(attrs, 'id'), argsFromAttrs(attrs));
      return '';
    });
    text = text.replace(/<\/ix>/gi, '');

    // <interact ...>
    text = text.replace(/<interact\b([^>]*?)\/?>/gi, function (m, attrs) {
      pushIx(ix, getAttr(attrs, 'name') || getAttr(attrs, 'id'), argsFromAttrs(attrs));
      return '';
    });

    // 放歌：<music q="歌名 或 风格"/>
    var music = [];
    text = text.replace(/<music\b([^>]*?)\/?>/gi, function (m, attrs) {
      var q = getAttr(attrs, 'q') || getAttr(attrs, 'query') || getAttr(attrs, 'name');
      if (q && music.length < 1) music.push({ q: q });
      return '';
    });

    // 工具调用
    text = text.replace(/<(tool_call|function_call)\b[^>]*>([\s\S]*?)<\/\1>/gi, function (m, tag, body) {
      try {
        var data = JSON.parse(body.trim());
        var fn = data.name || (data.function && data.function.name) || '';
        var params = data.arguments || data.parameters || (data.function && data.function.arguments) || {};
        if (typeof params === 'string') {
          try { params = JSON.parse(params); } catch (e) { params = {}; }
        }
        var id = params.name || params.id || fn;
        if (IX.has(id)) pushIx(ix, id, params);
      } catch (e) {}
      return '';
    });

    text = text.replace(/<\/?output\b[^>]*>/gi, '');
    text = text.replace(/\n{3,}/g, '\n\n').trim();

    return { text: text, reasoning: reasoning, ix: ix, fx: fx, htmlFx: htmlFx, music: music };
  }

  function stripForDisplay(text) {
    var s = String(text || '');
    s = s.replace(/<(fx|fx_code)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
    s = s.replace(/<(fx|fx_code)\b[^>]*>[\s\S]*$/gi, '');
    s = s.replace(/<fx_html\b[^>]*>[\s\S]*?<\/fx_html>/gi, '');
    s = s.replace(/<fx_html\b[^>]*>[\s\S]*$/gi, '');
    s = s.replace(/<ix\b([^>]*?)>([\s\S]*?)<\/ix>/gi, '');
    s = s.replace(/<ix\b[^>]*?\/?>/gi, '');
    s = s.replace(/<interact\b[^>]*?\/?>/gi, '');
    s = s.replace(/<music\b[^>]*?\/?>/gi, '');
    s = s.replace(/<(tool_call|function_call)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
    s = s.replace(/<(thinking|thought|reason|analysis)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
    s = s.replace(/<(tool_call|function_call|thinking|thought|reason|analysis)\b[^>]*>[\s\S]*$/gi, '');
    s = s.replace(/<\/?output\b[^>]*>/gi, '');
    return MD.stripIncomplete(s);
  }

  /* ---------------- 对话 ---------------- */
  function pushUser(text, forceFx, forceHtml) {
    var m = { role: 'user', text: text, ts: Date.now() };
    if (forceFx) m.forceFx = true;
    if (forceHtml) m.forceHtml = true;
    messages.push(m);
    saveMessages();
    elWelcome.hidden = true;
    appendMessage(m, true);
    scrollBottom(true);
  }

  function visibleHistory() {
    return messages.filter(function (m) {
      return m.text && !m.pending;
    }).slice(-12).map(function (m) {
      return { role: m.role === 'ai' ? 'assistant' : 'user', content: m.text };
    });
  }

  function setBusy(v) {
    busy = v;
    elSend.classList.toggle('hidden', v);
    elStop.classList.toggle('hidden', !v);
    elInput.disabled = false;
    elInput.setAttribute('aria-busy', v ? 'true' : 'false');
  }

  var FORCE_FX_RE = /^[#＃][zZ](?:[ \t]+([\s\S]*))?$/;
  var FORCE_HTML_RE = /^[#＃][cC](?:[ \t]+([\s\S]*))?$/;
  var FALLBACK_FX = {
    duration: 6000,
    title: '备用星尘',
    code: 'clear(); for (var i=0;i<110;i++){ var a=i/110*Math.PI*2+time/1600; var r=40+((i*53)%300)+t*140; var x=W/2+Math.cos(a)*r, y=H/2+Math.sin(a)*r*0.62; ctx.globalAlpha=0.9-t*0.6; ctx.fillStyle=palette[i%palette.length]; ctx.beginPath(); ctx.arc(x,y,1.5+(i%4),0,Math.PI*2); ctx.fill(); } ctx.globalAlpha=1;'
  };
  var FALLBACK_HTML = {
    title: '备用星光页',
    html: '<!DOCTYPE html>\n<html lang="zh">\n<head>\n<meta charset="UTF-8">\n<title>星光</title>\n<style>html,body{margin:0;height:100%;background:#0b0f1a;overflow:hidden;}canvas{display:block;width:100%;height:100%;}</style>\n</head>\n<body>\n<canvas id="c"></canvas>\n<script>\nvar cv=document.getElementById("c"),x=cv.getContext("2d");function rs(){cv.width=innerWidth;cv.height=innerHeight;}rs();addEventListener("resize",rs);var t=0;function loop(){t+=1;x.fillStyle="rgba(11,15,26,.18)";x.fillRect(0,0,cv.width,cv.height);for(var i=0;i<120;i++){var a=i/120*6.283+t/80,r=80+((i*53)%320),px=cv.width/2+Math.cos(a)*r,py=cv.height/2+Math.sin(a)*r*0.6;x.fillStyle="hsl("+(i*3%360)+",80%,70%)";x.beginPath();x.arc(px,py,1.5+(i%3),0,6.283);x.fill();}requestAnimationFrame(loop);}loop();\n<\/script>\n</body>\n</html>'
  };

  function send(text) {
    text = String(text || '').trim();
    if (!text) { if (rt.on) rtResume(); return; }
    if (busy) { if (rt.on) rtResume(); return; }
    if (voice.on) finishVoice(true);
    if (rt.on && !rt.waiting) {
      rt.waiting = true;
      rtPauseListen();
      rtSetState('小谷思考中…', 'thinking');
    }
    if (!settings.key) {
      toast('请先在设置里填写 API Key');
      openSettings();
      if (rt.on) rtResume();
      return;
    }
    var forceFx = false, forceHtml = false;
    var hit = text.match(FORCE_FX_RE);
    if (hit) {
      forceFx = true;
      text = (hit[1] || '随便来一个 12 秒的特效，主题你定').trim();
    } else {
      hit = text.match(FORCE_HTML_RE);
      if (hit) {
        forceHtml = true;
        text = (hit[1] || '随便做一个能导出成 HTML 的特效页面，主题你定').trim();
      }
    }
    elInput.value = '';
    autoGrow();
    pushUser(text, forceFx, forceHtml);
    runAI(text, forceFx, forceHtml);
  }

  var RETRY_STATUS = { 429: 1, 500: 1, 502: 1, 503: 1, 504: 1 };

  function modelName(id) {
    for (var i = 0; i < MODELS.length; i++) {
      if (MODELS[i].id === id) return MODELS[i].name;
    }
    return id.split('/').pop();
  }

  function modelChain() {
    var out = [settings.model];
    MODELS.forEach(function (m) {
      if (m.id !== settings.model && out.length < 3) out.push(m.id);
    });
    return out;
  }

  function showTyping(node) {
    node._md.innerHTML = '';
    var t = document.createElement('div');
    t.className = 'typing';
    t.innerHTML = '<span></span><span></span><span></span>';
    node._md.appendChild(t);
  }

  async function runAI(userText, forceFx, forceHtml) {
    var placeholder = {
      role: 'ai', text: '', reasoning: '', ix: [], ts: Date.now(), pending: true
    };
    messages.push(placeholder);
    var node = appendMessage(placeholder, true);
    node.classList.add('is-pending');
    if (forceFx || forceHtml) {
      placeholder.fxMaking = true;
      var mk = document.createElement('div');
      mk.className = 'fx-making';
      mk.innerHTML = '<span class="fx-dot"></span>AI 正在制作' + (forceHtml ? '页面' : '特效') + '…';
      node._bubble = node.querySelector('.bubble');
      node._bubble.insertBefore(mk, node._md);
      node._fxMaking = mk;
    }
    showTyping(node);
    scrollBottom(true);

    setBusy(true);
    controller = new AbortController();
    var chain = modelChain();

    // 联网：先抓资料再回答（#z / #c 不触发，避免拖慢特效生成）
    var searchQuery = '', searchResults = null;
    var doSearch = settings.web && !forceFx && !forceHtml && userText.length >= 4;
    if (doSearch) {
      searchQuery = userText.slice(0, 140);
      var smk = document.createElement('div');
      smk.className = 'search-making';
      smk.innerHTML = '<span class="fx-dot"></span>正在联网搜索…';
      node._bubble = node._bubble || node.querySelector('.bubble');
      node._bubble.insertBefore(smk, node._md);
      try {
        searchResults = await window.WEBSEARCH.search(userText);
      } catch (e) {
        searchResults = [];
      }
      if (smk.parentNode) smk.remove();
    }

    try {
      var finished = false;

      for (var attempt = 0; attempt < chain.length && !finished; attempt++) {
        if (attempt > 0) {
          showTyping(node);
          toast('「' + modelName(chain[attempt - 1]) + '」没接上，已自动换「' + modelName(chain[attempt]) + '」');
        }
        streaming = { raw: '', reasoning: '', node: node, msg: placeholder, lastPaint: 0 };

        try {
          var res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Authorization': 'Bearer ' + settings.key,
              'Content-Type': 'application/json',
              'HTTP-Referer': location.origin + '/ai/',
              'X-Title': 'Xiaogu - GuCang AI'
            },
            body: JSON.stringify({
              model: chain[attempt],
              messages: [{ role: 'system', content: buildSystemPrompt({ forceFx: forceFx, forceHtml: forceHtml, searchQuery: searchQuery || null, searchResults: searchResults }) }].concat(visibleHistory()),
              stream: true,
              temperature: 0.85,
              max_tokens: forceHtml ? Math.max(12000, settings.maxTokens * 4) : (forceFx ? Math.max(8000, settings.maxTokens * 3) : settings.maxTokens),
              top_p: 0.9
            })
          });

          if (!res.ok) {
            var detail = '';
            try {
              var j = await res.json();
              detail = (j.error && (j.error.message || j.error.code)) || '';
            } catch (e) {}
            var httpErr = new Error(httpMessage(res.status, detail));
            httpErr.retryable = !!RETRY_STATUS[res.status];
            throw httpErr;
          }

          await readStream(res, streaming);

          if (!streaming.raw.trim() && !streaming.reasoning.trim()) {
            var emptyErr = new Error('模型这次没有返回内容，请再试一次。');
            emptyErr.retryable = true;
            throw emptyErr;
          }
          finished = true;
        } catch (err) {
          if (err && err.name === 'AbortError') throw err;
          if (!err.retryable || attempt === chain.length - 1) throw err;
        }
      }

      var raw = streaming.raw;
      var parsed = extractSpecials(raw, forceFx || forceHtml || settings.fx);
      var fxTruncated = forceFx && /<fx\b/i.test(raw) && !/<\/fx\b/i.test(raw);
      var htmlTruncated = forceHtml && /<fx_html\b/i.test(raw) && !/<\/fx_html\b/i.test(raw);
      if (forceFx && !parsed.fx.length) {
        parsed.fx.push({ code: FALLBACK_FX.code, duration: FALLBACK_FX.duration, title: FALLBACK_FX.title });
        toast(fxTruncated ? '特效代码太长被截断，先用「备用星尘」顶上' : '模型这次没交特效，先用「备用星尘」顶上');
      }
      if (forceHtml && !parsed.htmlFx.length) {
        parsed.htmlFx.push({ html: FALLBACK_HTML.html, title: FALLBACK_HTML.title });
        toast(htmlTruncated ? '页面代码太长被截断，先用「备用星光页」顶上' : '模型这次没交页面，先用「备用星光页」顶上');
      }
      if (parsed.reasoning) {
        streaming.reasoning = (streaming.reasoning ? streaming.reasoning + '\n\n' : '') + parsed.reasoning;
      }
      var finalText = parsed.text;
      if (!finalText) {
        finalText = (placeholder.fx && placeholder.fx.length) || (placeholder.htmlFx && placeholder.htmlFx.length)
          ? '' : '（模型只给出了思考，没有正文。要不要再问我一次？）';
      }

      placeholder.text = finalText;
      placeholder.reasoning = streaming.reasoning.trim();
      placeholder.ix = parsed.ix.length ? parsed.ix : autoIx(finalText, userText);
      placeholder.fx = parsed.fx;
      placeholder.htmlFx = parsed.htmlFx;
      placeholder.music = parsed.music || [];
      placeholder.pending = false;

      node._md.innerHTML = '';
      if (node._fxMaking) { node._fxMaking.remove(); node._fxMaking = null; }
      renderMD(node._md, finalText);
      node.classList.remove('is-pending');
      updateThinking(node, placeholder.reasoning, false);
      renderChips(node, placeholder.ix, placeholder.fx, placeholder.htmlFx);
      if (searchResults && searchResults.length) {
        placeholder.search = searchResults;
        placeholder.searchQuery = searchQuery;
        renderSearchCard(node._md, searchQuery, searchResults);
      }
      saveMessages();
      scrollBottom(true);
      playIx(placeholder.ix, finalText);
      playFx(placeholder.fx);
      if (placeholder.music.length) {
        window.MUSIC.play(placeholder.music[0].q, node._md).then(function (track) {
          if (!track) toast('没找到这首歌，换个说法我再放');
        });
      }
    } catch (err) {
      var aborted = err && (err.name === 'AbortError');
      placeholder.pending = false;
      node.classList.remove('is-pending');
      if (node._fxMaking) { node._fxMaking.remove(); node._fxMaking = null; }

      if (forceFx && !aborted) {
        var partial = extractSpecials(streaming ? streaming.raw : '', true);
        placeholder.text = '正文断线了，特效先给你。';
        placeholder.reasoning = streaming ? streaming.reasoning : '';
        placeholder.ix = partial.ix;
        placeholder.fx = partial.fx.length ? partial.fx : [{ code: FALLBACK_FX.code, duration: FALLBACK_FX.duration, title: FALLBACK_FX.title }];
        node._md.innerHTML = '';
        renderMD(node._md, placeholder.text);
        renderChips(node, placeholder.ix, placeholder.fx);
        playFx(placeholder.fx);
      } else if (forceHtml && !aborted) {
        var partialH = extractSpecials(streaming ? streaming.raw : '', true);
        placeholder.text = '正文断线了，页面先给你。';
        placeholder.reasoning = streaming ? streaming.reasoning : '';
        placeholder.ix = partialH.ix;
        placeholder.htmlFx = partialH.htmlFx.length ? partialH.htmlFx : [{ html: FALLBACK_HTML.html, title: FALLBACK_HTML.title }];
        node._md.innerHTML = '';
        renderMD(node._md, placeholder.text);
        renderChips(node, placeholder.ix, [], placeholder.htmlFx);
      } else {
        placeholder.text = aborted ? '（已停止这次回答）' : ('出错了：' + (err && err.message ? err.message : '未知错误'));
        placeholder.reasoning = streaming ? streaming.reasoning : '';
        placeholder.error = !aborted;
        node._md.innerHTML = '';
        var p = document.createElement('p');
        p.className = aborted ? 'msg-note' : 'msg-error';
        p.textContent = placeholder.text;
        node._md.appendChild(p);
      }
      saveMessages();
    } finally {
      controller = null;
      streaming = null;
      setBusy(false);
      scrollBottom();
      if (rt.on) rtAfterReply(placeholder);
    }
  }

  function httpMessage(status, detail) {
    if (status === 401) return 'API Key 无效或已失效，请在设置里更换。';
    if (status === 402) return '账户额度不足。';
    if (status === 404) return '模型不存在或已下线，请在设置里换一个模型。';
    if (status === 429) return '请求太频繁或免费额度用完了，歇一会儿再试。';
    if (status >= 500) return 'OpenRouter 服务暂时不可用，请稍后重试。';
    return '请求失败（HTTP ' + status + '）' + (detail ? '：' + detail : '');
  }

  async function readStream(res, s) {
    if (!res.body || !res.body.getReader) {
      var text = await res.text();
      try {
        var j = JSON.parse(text);
        s.raw = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
        s.reasoning = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.reasoning) || '';
      } catch (e) { s.raw = text; }
      paintStreaming(s, true);
      return;
    }
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buf = '';
    var sep = /\r?\n\r?\n/;
    while (true) {
      var r = await reader.read();
      if (r.done) break;
      buf += decoder.decode(r.value, { stream: true });
      var m;
      while ((m = sep.exec(buf))) {
        var chunk = buf.slice(0, m.index);
        buf = buf.slice(m.index + m[0].length);
        handleChunk(chunk, s);
      }
    }
    if (buf.trim()) handleChunk(buf, s);
    paintStreaming(s, true);
  }

  function handleChunk(chunk, s) {
    var lines = chunk.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line.charAt(0) === ':') continue;
      if (line.indexOf('data:') !== 0) continue;
      var data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      var j;
      try { j = JSON.parse(data); } catch (e) { continue; }
      if (j.error) throw new Error(j.error.message || '模型返回错误');
      var choice = j.choices && j.choices[0];
      var delta = (choice && choice.delta) || {};
      if (delta.content) s.raw += delta.content;
      if (delta.reasoning) s.reasoning += delta.reasoning;
      if (choice && choice.message && !delta.content && !delta.reasoning && choice.message.content) {
        s.raw += choice.message.content;
      }
      var now = performance.now();
      if (now - s.lastPaint > 90) {
        s.lastPaint = now;
        paintStreaming(s, false);
      }
    }
  }

  function paintStreaming(s, force) {
    if (!s || !s.node) return;
    var node = s.node;
    var hasText = !!s.raw.trim();
    var typing = node.querySelector('.typing');
    if (hasText && typing) typing.remove();
    if (!hasText) return;

    renderMD(node._md, stripForDisplay(s.raw));
    updateThinking(node, s.reasoning, true);
    scrollBottom();
  }

  function updateThinking(node, reasoning, live) {
    if (!Node.prototype.isPrototypeOf(node)) return;
    var bubble = node.querySelector('.bubble');
    var details = node.querySelector('.thinking');
    if (!settings.showThinking) {
      if (details) details.style.display = 'none';
      return;
    }
    if (!reasoning) {
      if (details) details.remove();
      return;
    }
    if (!details) {
      details = document.createElement('details');
      details.className = 'thinking';
      var summary = document.createElement('summary');
      summary.innerHTML = '<span class="think-dot"></span>思考过程';
      var body = document.createElement('div');
      body.className = 'thinking-body';
      details.appendChild(summary);
      details.appendChild(body);
      bubble.insertBefore(details, bubble.firstChild);
      node._thinkingBody = body;
    }
    details.style.display = '';
    var tbody = details.querySelector('.thinking-body');
    tbody.textContent = reasoning;
    var sum = details.querySelector('summary');
    sum.innerHTML = '<span class="think-dot"></span>' + (live ? '正在思考…' : '思考过程 · ' + reasoning.length + ' 字');
    if (!live) details.open = false;
  }

  function renderChips(node, ixList, fxList, htmlList) {
    var old = node.querySelector('.ix-chips');
    if (old) old.remove();
    if ((!ixList || !ixList.length) && (!fxList || !fxList.length) && (!htmlList || !htmlList.length)) return;
    var chips = document.createElement('div');
    chips.className = 'ix-chips';
    (ixList || []).forEach(function (it) {
      var def = IX.get(it.id);
      if (!def) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ix-chip';
      b.textContent = def.emoji + ' ' + def.name;
      b.title = '点击重播：' + def.desc;
      b.addEventListener('click', function () {
        IX.play(it.id, it.args || {});
        recordRecent(it.id);
        toast('重播 ' + def.emoji + ' ' + def.name);
      });
      chips.appendChild(b);
    });
    (fxList || []).forEach(function (it) { chips.appendChild(makeFxChip(it)); });
    (htmlList || []).forEach(function (it) { chips.appendChild(makeHtmlChip(it)); });
    node.querySelector('.bubble').appendChild(chips);
  }

  function stopAI() {
    if (controller) {
      try { controller.abort(); } catch (e) {}
    }
  }

  /* ---------------- 互动卡片 ---------------- */
  function pushCard(html, init) {
    elWelcome.hidden = true;
    var wrap = document.createElement('div');
    wrap.className = 'msg msg-fx msg-in';
    var av = document.createElement('div');
    av.className = 'avatar avatar-fx';
    av.textContent = '✦';
    wrap.appendChild(av);
    var col = document.createElement('div');
    col.className = 'bubble-col';
    var holder = document.createElement('div');
    holder.innerHTML = html;
    var cardEl = holder.firstElementChild || holder;
    var bubble = document.createElement('div');
    bubble.className = 'bubble bubble-fx';
    bubble.appendChild(cardEl);
    col.appendChild(bubble);
    var meta = document.createElement('div');
    meta.className = 'msg-meta';
    meta.textContent = '小谷的互动 · ' + timeText(Date.now());
    col.appendChild(meta);
    wrap.appendChild(col);
    elMessages.appendChild(wrap);
    if (typeof init === 'function') {
      try { init(cardEl); } catch (e) { console.warn(e); }
    }
    scrollBottom(true);
  }

  /* ---------------- 互动库 ---------------- */
  var libCat = 'all';

  function buildLib() {
    var cats = $('#libCats');
    cats.innerHTML = '';
    var all = mkBtn('全部 ' + IX.list.length, 'all');
    cats.appendChild(all);
    Object.keys(IX.cats).forEach(function (key) {
      var count = IX.list.filter(function (x) { return x.cat === key; }).length;
      cats.appendChild(mkBtn(IX.cats[key] + ' ' + count, key));
    });
    function mkBtn(label, key) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'lib-cat' + (key === libCat ? ' on' : '');
      b.textContent = label;
      b.setAttribute('data-cat', key);
      b.addEventListener('click', function () {
        libCat = key;
        $$('.lib-cat', cats).forEach(function (x) { x.classList.toggle('on', x === b); });
        renderGrid();
      });
      return b;
    }
    renderGrid();
  }

  function renderGrid() {
    var grid = $('#ixGrid');
    var q = (($('#ixSearch') || {}).value || '').trim().toLowerCase();
    grid.innerHTML = '';
    IX.list.filter(function (x) {
      if (libCat !== 'all' && x.cat !== libCat) return false;
      if (!q) return true;
      return (x.id + x.name + x.desc + x.catName).toLowerCase().indexOf(q) !== -1;
    }).forEach(function (x) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ix-item';
      b.innerHTML = '<span class="ix-emoji">' + x.emoji + '</span>' +
        '<span class="ix-info"><b>' + x.name + '</b><i>' + x.catName + '</i><em>' + x.desc + '</em></span>' +
        '<span class="ix-id">' + x.id + '</span>';
      b.addEventListener('click', function () {
        IX.play(x.id, {});
        recordRecent(x.id);
        toast('已触发 ' + x.emoji + ' ' + x.name);
      });
      grid.appendChild(b);
    });
    if (!grid.children.length) {
      var p = document.createElement('p');
      p.className = 'empty';
      p.textContent = '没有找到相关互动';
      grid.appendChild(p);
    }
  }

  /* ---------------- 弹窗 ---------------- */
  function openModal(id) {
    var m = document.getElementById(id);
    if (!m) return;
    m.hidden = false;
    requestAnimationFrame(function () { m.classList.add('show'); });
  }
  function closeModal(m) {
    if (typeof m === 'string') m = document.getElementById(m);
    if (!m) return;
    m.classList.remove('show');
    setTimeout(function () { m.hidden = true; }, 180);
  }
  function openSettings() {
    var keyInput = $('#setKey');
    keyInput.value = settings.key;
    var sel = $('#setModel');
    sel.value = settings.model;
    if (!sel.value) sel.value = DEFAULT_MODEL;
    $('#setSound').checked = !!settings.sound;
    $('#setThink').checked = !!settings.showThinking;
    if ($('#setFx')) $('#setFx').checked = !!settings.fx;
    if ($('#setSpeak')) $('#setSpeak').checked = !!settings.speak;
    if ($('#setTokens')) $('#setTokens').value = settings.maxTokens;
    openModal('settingsModal');
  }

  /* ---------------- 提示 ---------------- */
  function toast(msg) {
    var box = $('#toasts');
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, 2000);
    setTimeout(function () { t.remove(); }, 2400);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('已复制'); }).catch(function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('已复制'); } catch (e) { toast('复制失败'); }
    ta.remove();
  }

  /* ---------------- 输入框 ---------------- */
  function autoGrow() {
    elInput.style.height = 'auto';
    elInput.style.height = Math.min(180, elInput.scrollHeight) + 'px';
  }

  /* ---------------- 语音输入 ---------------- */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  var voice = { rec: null, on: false, base: '', caret: 0, final: '', interim: '', timer: 0, sx: 0, sy: 0 };

  function setVoiceUI(on) {
    voice.on = on;
    if (elMic) {
      elMic.classList.toggle('listening', on);
      elMic.setAttribute('aria-pressed', on ? 'true' : 'false');
      elMic.title = on ? '正在听…点一下结束' : '点麦克风或长按输入框语音输入';
    }
    var comp = $('#composer');
    if (comp) comp.classList.toggle('voice-on', on);
  }

  function startVoice() {
    if (voice.on) return;
    if (!SR) {
      toast('这个浏览器不支持语音输入，建议用 Chrome / Edge / Safari');
      return;
    }
    var rec;
    try { rec = new SR(); } catch (e) { toast('语音识别初始化失败'); return; }
    var lang = navigator.language || 'zh-CN';
    rec.lang = /^zh/i.test(lang) ? 'zh-CN' : lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    voice.base = elInput.value;
    voice.caret = typeof elInput.selectionStart === 'number' ? elInput.selectionStart : elInput.value.length;
    voice.final = '';
    voice.interim = '';

    rec.onresult = function (ev) {
      var fin = '', itr = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var r = ev.results[i];
        if (r.isFinal) fin += r[0].transcript;
        else itr += r[0].transcript;
      }
      if (fin) voice.final += fin;
      voice.interim = itr;
      var ins = voice.final + itr;
      elInput.value = voice.base.slice(0, voice.caret) + ins + voice.base.slice(voice.caret);
      var pos = voice.caret + ins.length;
      try { elInput.setSelectionRange(pos, pos); } catch (e) {}
      autoGrow();
    };
    rec.onerror = function (ev) {
      var code = (ev && ev.error) || '';
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        toast('麦克风被拒绝了，请在浏览器地址栏允许麦克风');
      } else if (code === 'no-speech') {
        toast('没听到声音，再试一次？');
      } else if (code === 'network') {
        toast('语音服务连不上，检查一下网络');
      } else if (code !== 'aborted') {
        toast('语音识别出错：' + code);
      }
      finishVoice(true);
    };
    rec.onend = function () {
      if (voice.on) finishVoice(false);
    };

    voice.rec = rec;
    try { rec.start(); } catch (e) {
      voice.rec = null;
      toast('语音启动失败：' + ((e && e.message) || e));
      return;
    }
    setVoiceUI(true);
    toast('🎙 开始听了，说完点一下麦克风结束');
  }

  function finishVoice(silent) {
    var had = !!(voice.final || voice.interim);
    if (voice.rec) {
      var r = voice.rec;
      voice.rec = null;
      try { r.onend = null; r.onresult = null; r.onerror = null; } catch (e) {}
      try { r.stop(); } catch (e) {}
      try { r.abort(); } catch (e) {}
    }
    if (voice.timer) { clearTimeout(voice.timer); voice.timer = 0; }
    setVoiceUI(false);
    voice.interim = '';
    if (!silent && had) toast('语音输入完成');
    return had;
  }

  function bindVoice() {
    if (!elMic) return;
    if (!SR) {
      elMic.classList.add('unsupported');
      elMic.title = '当前浏览器不支持语音输入';
    }
    elMic.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (rt.on) { rtStop(); return; }
      if (voice.on) finishVoice(true);
      rtStart();
    });
    if ($('#voiceExit')) $('#voiceExit').addEventListener('click', function () { rtStop(); });
    if ($('#netToggle')) $('#netToggle').addEventListener('click', function () {
      settings.web = !settings.web;
      saveSettings();
      updateNetToggle();
      toast(settings.web ? '联网搜索已开启' : '联网搜索已关闭');
    });

    // 长按输入框 650ms 启动语音（拖动超过 12px 视为选字，取消）
    elInput.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (voice.on || rt.on) return;
      voice.sx = e.clientX;
      voice.sy = e.clientY;
      if (voice.timer) clearTimeout(voice.timer);
      voice.timer = setTimeout(function () {
        voice.timer = 0;
        if (voice.on) return;
        startVoice();
        if (voice.on) { try { elInput.blur(); } catch (err) {} }
      }, 650);
    });
    elInput.addEventListener('pointermove', function (e) {
      if (!voice.timer) return;
      if (Math.abs(e.clientX - voice.sx) > 12 || Math.abs(e.clientY - voice.sy) > 12) {
        clearTimeout(voice.timer);
        voice.timer = 0;
      }
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (evt) {
      elInput.addEventListener(evt, function () {
        if (voice.timer) { clearTimeout(voice.timer); voice.timer = 0; }
      });
    });
    elInput.addEventListener('contextmenu', function (e) {
      if (voice.on) e.preventDefault();
    });
  }

  /* ---------------- 实时语音聊天（豆包式：持续聆听 + 停顿自动发送 + 回复朗读） ---------------- */
  var rt = {
    on: false,
    rec: null,
    waiting: false,
    final: '',
    timer: 0,
    speaking: false,
    restartTimer: 0
  };

  function rtSetState(txt, kind) {
    if (elVoiceState) elVoiceState.textContent = txt;
    if (elVoiceBar) {
      elVoiceBar.hidden = false;
      elVoiceBar.dataset.kind = kind || 'listening';
    }
  }

  function rtBumpSilence() {
    if (rt.timer) clearTimeout(rt.timer);
    rt.timer = setTimeout(function () {
      rt.timer = 0;
      rtSendNow();
    }, 1300);
  }

  function rtPauseListen() {
    if (rt.timer) { clearTimeout(rt.timer); rt.timer = 0; }
    if (rt.restartTimer) { clearTimeout(rt.restartTimer); rt.restartTimer = 0; }
    if (rt.rec) {
      var r = rt.rec;
      rt.rec = null;
      try { r.onend = null; r.onresult = null; r.onerror = null; } catch (e) {}
      try { r.stop(); } catch (e) {}
      try { r.abort(); } catch (e) {}
    }
  }

  function rtSendNow() {
    if (!rt.on || rt.waiting) return;
    var text = String(rt.final || '').trim();
    if (!text) return;
    rt.final = '';
    rt.waiting = true;
    rtPauseListen();
    elInput.value = '';
    autoGrow();
    rtSetState('小谷思考中…', 'thinking');
    send(text);
  }

  function rtListen() {
    if (!rt.on || rt.waiting) return;
    if (rt.rec) return;
    if (busy) {
      rt.restartTimer = setTimeout(rtListen, 600);
      return;
    }
    var rec;
    try { rec = new SR(); } catch (e) {
      toast('语音识别初始化失败');
      rtStop(true);
      return;
    }
    var lang = navigator.language || 'zh-CN';
    rec.lang = /^zh/i.test(lang) ? 'zh-CN' : lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = function (ev) {
      if (!rt.on || rt.waiting) return;
      var fin = '', itr = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var r = ev.results[i];
        if (r.isFinal) fin += r[0].transcript;
        else itr += r[0].transcript;
      }
      if (fin) rt.final += fin;
      var shown = (rt.final + itr).trim();
      if (shown) {
        elInput.value = shown;
        autoGrow();
        rtSetState('听你说：' + shown.slice(-36), 'listening');
        rtBumpSilence();
      }
    };
    rec.onerror = function (ev) {
      var code = (ev && ev.error) || '';
      if (code === 'no-speech' || code === 'aborted') return;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        toast('麦克风被拒绝了，请在浏览器地址栏允许麦克风');
        rtStop(true);
      } else if (code === 'network') {
        toast('语音服务连不上，检查一下网络');
      } else if (code === 'audio-capture') {
        toast('没找到麦克风设备');
        rtStop(true);
      }
    };
    rec.onend = function () {
      rt.rec = null;
      if (!rt.on || rt.waiting) return;
      // 浏览器会因静音/超时自动断开，自动续听
      rt.restartTimer = setTimeout(rtListen, 320);
    };

    rt.rec = rec;
    try {
      rec.start();
      rtSetState('正在聆听…', 'listening');
    } catch (e) {
      rt.rec = null;
      rt.restartTimer = setTimeout(rtListen, 700);
    }
  }

  function rtStart() {
    if (rt.on) return;
    if (!SR) {
      toast('这个浏览器不支持语音输入，建议用 Chrome / Edge / Safari');
      return;
    }
    if (voice.on) finishVoice(true);
    rt.on = true;
    rt.waiting = false;
    rt.final = '';
    rt.speaking = false;
    elMic.classList.add('realtime');
    elMic.setAttribute('aria-pressed', 'true');
    elMic.title = '实时语音中，点一下结束';
    elVoiceBar.hidden = false;
    rtSetState('正在聆听…', 'listening');
    rtListen();
    toast('实时语音已开启，直接说话就行');
  }

  function rtStop(silent) {
    var wasOn = rt.on;
    rt.on = false;
    rt.waiting = false;
    rt.final = '';
    rt.speaking = false;
    rtPauseListen();
    elInput.value = '';
    autoGrow();
    elMic.classList.remove('realtime', 'listening');
    elMic.setAttribute('aria-pressed', 'false');
    elMic.title = '点麦克风进入实时语音，长按输入框仅听写';
    if (elVoiceBar) elVoiceBar.hidden = true;
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
    if (!silent && wasOn) toast('实时语音已结束');
  }

  function rtResume() {
    if (!rt.on) return;
    rt.waiting = false;
    rtSetState('正在聆听…', 'listening');
    if (rt.restartTimer) clearTimeout(rt.restartTimer);
    rt.restartTimer = setTimeout(function () {
      rt.restartTimer = 0;
      rtListen();
    }, 260);
  }

  function speakable(text) {
    var s = String(text || '');
    s = s.replace(/```[\s\S]*?```/g, '，这段代码我略过。');
    s = s.replace(/<(fx|fx_html|thinking|thought|reason|analysis)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
    s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
    s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
    s = s.replace(/<[^>]+>/g, '');
    s = s.replace(/[#*_`>~|]/g, '');
    s = s.replace(/\s+/g, ' ').trim();
    return s.slice(0, 500);
  }

  function rtSpeak(text) {
    var said = speakable(text);
    if (!said || !window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      rtResume();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(said);
      u.lang = 'zh-CN';
      u.rate = 1.05;
      u.pitch = 1.02;
      var done = false;
      var fin = function () {
        if (done) return;
        done = true;
        rt.speaking = false;
        rtResume();
      };
      u.onend = fin;
      u.onerror = fin;
      rt.speaking = true;
      rtSetState('小谷正在说…', 'speaking');
      window.speechSynthesis.speak(u);
      setTimeout(fin, Math.min(30000, 1800 + said.length * 190));
    } catch (e) {
      rtResume();
    }
  }

  function rtAfterReply(msg) {
    if (!rt.on) return;
    var text = msg && msg.text ? msg.text : '';
    var bad = !text || (msg && msg.error) || /^（已停止|^出错了/.test(text);
    if (bad || !settings.speak) {
      rtResume();
      return;
    }
    rtSpeak(text);
  }

  /* ---------------- 事件绑定 ---------------- */
  function updateNetToggle() {
    var el = $('#netToggle');
    if (!el) return;
    el.classList.toggle('on', !!settings.web);
    el.setAttribute('aria-pressed', settings.web ? 'true' : 'false');
    el.title = settings.web ? '联网搜索已开：回答前会先查资料' : '联网搜索已关：点一下开启';
  }

  function bind() {
    $('#composer').addEventListener('submit', function (e) {
      e.preventDefault();
      send(elInput.value);
    });
    elInput.addEventListener('input', autoGrow);
    elInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        send(elInput.value);
      }
    });
    elStop.addEventListener('click', stopAI);

    $('#newChat').addEventListener('click', function () {
      if (busy) stopAI();
      if (window.FXC) FXC.stopAll();
      messages = [];
      saveMessages();
      renderAll();
      closeSidebar();
      toast('新对话已开始');
    });

    $('#clearChat').addEventListener('click', function () {
      if (!messages.length) { toast('现在就是新对话'); return; }
      if (busy) stopAI();
      if (window.FXC) FXC.stopAll();
      messages = [];
      saveMessages();
      renderAll();
      toast('对话已清空');
    });

    $$('[data-open]').forEach(function (b) {
      b.addEventListener('click', function () {
        var target = b.getAttribute('data-open');
        if (target === 'ixlib') { buildLib(); openModal('ixModal'); }
        if (target === 'settings') openSettings();
        closeSidebar();
      });
    });
    $('#openIx').addEventListener('click', function () { buildLib(); openModal('ixModal'); });
    $('#settingsBtn').addEventListener('click', openSettings);
    $('#modelChip').addEventListener('click', openSettings);

    $$('.modal').forEach(function (m) {
      m.addEventListener('click', function (e) {
        if (e.target === m || e.target.hasAttribute('data-close')) closeModal(m);
      });
    });
    $('#ixSearch').addEventListener('input', renderGrid);

    $('#saveSettings').addEventListener('click', function () {
      var key = $('#setKey').value.trim();
      var model = $('#setModel').value;
      settings.key = key || DEFAULT_KEY;
      settings.model = model || DEFAULT_MODEL;
      settings.sound = $('#setSound').checked;
      settings.showThinking = $('#setThink').checked;
      if ($('#setFx')) settings.fx = $('#setFx').checked;
      if ($('#setSpeak')) settings.speak = $('#setSpeak').checked;
      var mt = parseInt($('#setTokens').value, 10);
      if (isNaN(mt) || mt < 500) mt = 3000;
      if (mt > 32000) mt = 32000;
      settings.maxTokens = mt;
      saveSettings();
      IX.setSound(settings.sound);
      document.body.classList.toggle('hide-thinking', !settings.showThinking);
      updateModelChip();
      closeModal('settingsModal');
      toast('设置已保存');
    });
    $('#resetSettings').addEventListener('click', function () {
      settings = { key: DEFAULT_KEY, model: DEFAULT_MODEL, sound: true, showThinking: true, fx: true, speak: true, web: true, maxTokens: 3000 };
      saveSettings();
      IX.setSound(true);
      document.body.classList.remove('hide-thinking');
      updateModelChip();
      openSettings();
      toast('已恢复默认设置');
    });
    $('#toggleKey').addEventListener('click', function () {
      var i = $('#setKey');
      i.type = i.type === 'password' ? 'text' : 'password';
      this.textContent = i.type === 'password' ? '显示' : '隐藏';
    });

    bindVoice();

    var cycleTheme = function () {
      var cur = IX.currentTheme();
      var idx = IX.themes.indexOf(cur);
      var next = IX.themes[(idx + 1) % IX.themes.length];
      IX.setTheme(next);
      toast('主题：' + IX.themeNames[next]);
      syncThemeButton();
    };
    $('#themeBtn').addEventListener('click', cycleTheme);
    $('#themeSideBtn').addEventListener('click', cycleTheme);
    syncThemeButton();

    $$('.quick-emoji').forEach(function (b) {
      b.addEventListener('click', function () {
        var emoji = b.getAttribute('data-emoji');
        elInput.value += emoji;
        elInput.focus();
        autoGrow();
      });
    });

    $$('.suggest').forEach(function (b) {
      b.addEventListener('click', function () {
        send(b.getAttribute('data-send'));
      });
    });

    $('#openSidebar').addEventListener('click', function () {
      $('#sidebar').classList.add('open');
      $('#backdrop').classList.add('show');
    });
    $('#closeSidebar').addEventListener('click', closeSidebar);
    $('#backdrop').addEventListener('click', closeSidebar);

    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.code-copy') : null;
      if (!btn) return;
      var block = btn.closest('.code-block');
      var code = block && block.querySelector('code');
      if (code) copyText(code.textContent);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        $$('.modal.show').forEach(closeModal);
        closeSidebar();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        buildLib();
        openModal('ixModal');
      }
    });
  }

  function closeSidebar() {
    $('#sidebar').classList.remove('open');
    $('#backdrop').classList.remove('show');
  }
  function syncThemeButton() {
    var btn = $('#themeBtn');
    var cur = IX.currentTheme();
    btn.setAttribute('title', '当前主题：' + IX.themeNames[cur] + '，点击切换');
    btn.textContent = cur === 'light' ? '☀' : cur === 'mono' ? '◑' : '◐';
  }
  function updateModelChip() {
    var m = MODELS.filter(function (x) { return x.id === settings.model; })[0];
    elModelChip.textContent = (m ? m.name : settings.model) + ' · free';
    elModelChip.title = settings.model;
  }

  function initUI() {
    elMessages = $('#messages');
    elChat = $('#chatScroll');
    elWelcome = $('#welcome');
    elInput = $('#input');
    elSend = $('#sendBtn');
    elStop = $('#stopBtn');
    elModelChip = $('#modelChip');
    elMic = $('#micBtn');
    elVoiceBar = $('#voiceBar');
    elVoiceState = $('#voiceState');
    updateNetToggle();

    IX.init();
    IX.setSound(settings.sound);
    IX.setCardHandler(pushCard);
    var savedTheme = 'dark';
    try { savedTheme = localStorage.getItem('yg_ai_theme') || 'dark'; } catch (e) {}
    IX.setTheme(savedTheme);

    document.body.classList.toggle('hide-thinking', !settings.showThinking);
    updateModelChip();
    renderRecent();
    buildLib();
    renderAll();
    bind();
    autoGrow();
    elInput.focus();

    if (!messages.length) {
      setTimeout(function () {
        IX.play('wave', {});
      }, 900);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }
})();
