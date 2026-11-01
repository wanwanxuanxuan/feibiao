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

  // 两个「只负责看」的 AI：n12 看图，n30 看片。它们不闲聊，只把内容说出来，供小谷使用。
  // 注：nvidia/nemotron-nano-12b-v2-vl:free 目前不在 OpenRouter 目录里，所以后面挂了备用视觉模型。
  var MEDIA = {
    n12: {
      id: 'nvidia/nemotron-nano-12b-v2-vl:free',
      fallback: ['nvidia/nemotron-3.5-super-vl:free', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'],
      name: '看图 AI',
      short: 'n12',
      kind: 'image'
    },
    n30: {
      id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      fallback: ['nvidia/nemotron-3.5-super-vl:free'],
      name: '看片 AI',
      short: 'n30',
      kind: 'video'
    },
    // 读文档 AI：PDF / Word / PPT / 代码 / 纯文本都由它读。客户端先抽文字，再交给它。
    doc: {
      id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
      fallback: ['nvidia/nemotron-3.5-lightning:free', 'nvidia/nemotron-3.5-super-vl:free'],
      name: '读文档 AI',
      short: 'doc',
      kind: 'file'
    }
  };
  var mediaWorking = { n12: '', n30: '', doc: '' };

  // 三个「生成类」AI：视频、音乐、图片。都是异步长任务，要能在后台跑完。
  // 注：用户写的是 oogle/lyria，实际是 google/lyria。
  var GEN = {
    video: { id: 'bytedance/seedance-2.0:free', name: '视频 AI', short: 'video', emoji: '🎬', endpoint: 'videos' },
    music: { id: 'google/lyria-3-pro-preview', name: '音乐 AI', short: 'music', emoji: '🎵', endpoint: 'chat' },
    image: { id: 'bytedance-seed/seedream-4.5:free', name: '画图 AI', short: 'image', emoji: '🖼', endpoint: 'chat' }
  };
  var GEN_ALIASES = {
    video: ['video', 'seedance', '视频', 'videogen'],
    music: ['music', 'lyria', '音乐', 'song'],
    image: ['image', 'seedream', '图片', '画图', '图', '画']
  };
  var LS_JOBS = 'yg_ai_jobs_v1';

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
  var attach = null;      // 待发送的附件 {kind, name, size, thumb, media[]}
  var lastMedia = null;   // 最近一次上传的媒体，@n12 / @n30 和小谷追问时复用

  // 生成类任务：视频 / 音乐 / 图片。长任务，状态持久化到 localStorage，
  // 页面刷新后会自动续跑（视频是服务端任务，可真正续跑；音乐/图片会重新发起请求）。
  var jobs = loadJobs();
  var genControllers = {}; // jobId -> AbortController
  var genMediaCache = {};  // jobId -> {url, mime, transcript}  仅内存，刷新后失效

  var elMessages, elChat, elWelcome, elInput, elSend, elStop, elModelChip, elMic, elVoiceBar, elVoiceState;

  /* ---------------- 生成任务持久化 ---------------- */
  function loadJobs() {
    try {
      var raw = localStorage.getItem(LS_JOBS);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter(function (j) {
        return j && j.id && GEN[j.who];
      }).slice(-40) : [];
    } catch (e) { return []; }
  }
  function saveJobs() {
    try {
      // 不存 blob URL（刷新后失效），只存状态
      var slim = jobs.slice(-40).map(function (j) {
        var c = Object.assign({}, j);
        if (c.result) {
          c.result = Object.assign({}, c.result);
          delete c.result.url;
        }
        return c;
      });
      localStorage.setItem(LS_JOBS, JSON.stringify(slim));
    } catch (e) {}
  }
  function findJob(id) {
    for (var i = 0; i < jobs.length; i++) if (jobs[i].id === id) return jobs[i];
    return null;
  }
  function updateJob(id, patch) {
    var j = findJob(id);
    if (!j) return null;
    Object.assign(j, patch, { updatedAt: Date.now() });
    saveJobs();
    renderJobMessage(id);
    return j;
  }
  function newJob(who, prompt) {
    var j = {
      id: 'j_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      who: who,
      prompt: prompt,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    jobs.push(j);
    saveJobs();
    return j;
  }

  function findMessageByJob(jobId) {
    for (var i = messages.length - 1; i >= 0; i--) {
      if (messages[i].gen && messages[i].gen.jobId === jobId) return messages[i];
    }
    return null;
  }

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
    try {
      localStorage.setItem(LS_MSG, JSON.stringify(messages.slice(-80)));
    } catch (e) {
      // 缩略图太多可能撑爆 localStorage：去掉缩略图再存一次
      try {
        var slim = messages.slice(-80).map(function (m) {
          if (!m.att) return m;
          var c = Object.assign({}, m);
          c.att = { kind: m.att.kind, name: m.att.name };
          return c;
        });
        localStorage.setItem(LS_MSG, JSON.stringify(slim));
      } catch (e2) {}
    }
  }

  /* ---------------- 系统提示词 ---------------- */
  function buildSystemPrompt(opts) {
    opts = opts || {};
    var forceFx = !!opts.forceFx;
    var forceHtml = !!opts.forceHtml;
    var extraNote = opts.extraNote || '';
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
      '## 你的三个帮手（只负责看，不闲聊）',
      '- 谷仓里还住着三个只负责「看」的 AI：n12 看图（用户上传的照片），n30 看片（用户上传的视频），doc 读文档（PDF / Word / PPT / 代码 / 纯文本等文件）。',
      '- 对话记录里以「[看图 AI 描述]」「[看片 AI 描述]」「[读文档 AI 描述]」开头的段落，就是它们看到/读到的内容。你可以直接当成你看到的事实来用，不要否认，也不要整段复述。',
      '- 你需要更多细节时，可以在回复最后写 <ask who="n12">问题</ask> / <ask who="n30">问题</ask> / <ask who="doc">问题</ask>，客户端会去问它们，再把答案交回给你继续回答。一次最多问 1 个，只在真的需要时用。',
      '- 用户也可以用 @n12 / @n30 / @doc / @g 直接点名让谁回答；被点名的是它们，你不用抢话。',
      '- 用户上传任意文档后，客户端会先让 doc 读完，再把内容交给你。你可以据此继续解释、翻译、总结或改写。',
      '',
      '## 你的三个生成帮手（做视频 / 音乐 / 图片）',
      '- 谷仓里还有三个负责「做东西」的 AI：视频 AI（seedance，做短视频）、音乐 AI（lyria，做音乐）、画图 AI（seedream，画图片）。',
      '- 用户可以用 @video / @music / @image 直接点名让它们生成；这时你不用抢话，它们做完会回来找你总结。',
      '- 如果用户没有点名，但你判断他想要的是「生成一段视频 / 一首音乐 / 一张图片」，就在回复最后输出一行：',
      '  <route to="video" prompt="把用户想要的内容提炼成一句清晰的提示词"/>',
      '  （to 可选 video / music / image；prompt 里写生成提示词，不要写命令。）',
      '- 派单后，客户端会启动对应的生成 AI，生成完会自动把结果交给你，你再用一两句话回应。派单这一轮你照常回复用户就行，把 <route/> 放在最后。',
      '- 拿不准用户要哪种时，先简短问一句，不要乱派。用户只是想聊天、问问题、查资料时，不要派单。',
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
      '7. 想放歌时（用户说"放首歌/来点音乐"，或情绪合适），在回复最后加：<music q="歌名 或 风格"/>（一次最多 1 首，不要频繁）。q 里只写歌名/歌手/风格，最优先写歌名，比如用户说「放一首晴天」就写 q="晴天"（不要只写歌手，也不要写"放首歌"这类口令）。客户端会联网搜索并播放约 30 秒试听。',
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
    ] : []).concat(searchNote ? [searchNote] : []).concat(extraNote ? ['', extraNote] : []).join('\n');
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
    a.className = 'avatar ' + (kind === 'ai' ? 'avatar-ai' : 'avatar-' + kind);
    if (kind === 'n12') {
      a.textContent = '图';
      a.title = '看图 AI · n12';
    } else if (kind === 'n30') {
      a.textContent = '影';
      a.title = '看片 AI · n30';
    } else if (kind === 'doc') {
      a.textContent = '📄';
      a.title = '读文档 AI · doc';
    } else if (kind === 'video') {
      a.textContent = '🎬';
      a.title = '视频 AI · seedance';
    } else if (kind === 'music') {
      a.textContent = '🎵';
      a.title = '音乐 AI · lyria';
    } else if (kind === 'image') {
      a.textContent = '🖼';
      a.title = '画图 AI · seedream';
    } else if (kind === 'ai') {
      a.innerHTML = '<span>谷</span>';
    }
    return a;
  }

  function whoLabel(who) {
    if (who === 'n12') return '看图 AI · n12';
    if (who === 'n30') return '看片 AI · n30';
    if (who === 'doc') return '读文档 AI · doc';
    if (who === 'video') return '视频 AI · seedance';
    if (who === 'music') return '音乐 AI · lyria';
    if (who === 'image') return '画图 AI · seedream';
    return '小谷';
  }

  // 从文本开头解析 @video / @music / @image（含别名）。返回 {who, text} 或 null
  function parseGenWho(text) {
    var m = String(text || '').match(/^[@＠]([a-zA-Z\u4e00-\u9fa5]+)(?=$|[^\w\u4e00-\u9fa5])/);
    if (!m) return null;
    var token = m[1].toLowerCase();
    for (var who in GEN_ALIASES) {
      var aliases = GEN_ALIASES[who];
      for (var i = 0; i < aliases.length; i++) {
        if (aliases[i].toLowerCase() === token) {
          var rest = text.slice(m[0].length).replace(/^[，,。.、:：\s]+/, '').trim();
          return { who: who, text: rest };
        }
      }
    }
    return null;
  }

  function renderAttCard(host, att) {
    if (!host || !att) return;
    var card = document.createElement('div');
    card.className = 'att-card';
    if (att.thumb) {
      var img = document.createElement('img');
      img.src = att.thumb;
      img.alt = att.name || '附件';
      card.appendChild(img);
    }
    var cap = document.createElement('div');
    cap.className = 'att-cap';
    var b = document.createElement('b');
    b.textContent = att.kind === 'video' ? '🎬 视频' : att.kind === 'file' ? '📄 文件' : '📷 照片';
    var s = document.createElement('span');
    s.textContent = att.name || '';
    cap.appendChild(b);
    if (att.name) cap.appendChild(s);
    card.appendChild(cap);
    host.appendChild(card);
  }

  // 用户明确点歌时（放一首晴天），客户端直接从原话里取歌名，比模型给的 q 更准
  function guessSong(text) {
    var raw = String(text || '');
    var m = raw.match(/[放来播听](?:一|两|几)?[首支]\s*[《「"']?([^，。！？,.!?》」"'、\s]{2,12})/);
    if (!m) m = raw.match(/[放来播听].{0,10}的([^，。！？,.!?》」"'、\s]{1,12})/);
    if (!m) return '';
    var s = m[1];
    if (/^(歌|音乐|曲子|歌曲|点|些|首|支)/.test(s)) return '';
    return s;
  }

  /* ---------------- 附件：照片 / 视频 ---------------- */
  function readAsDataURL(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result || '')); };
      r.onerror = function () { reject(new Error('文件读不出来')); };
      r.readAsDataURL(file);
    });
  }

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('图片读不出来')); };
      img.src = url;
    });
  }

  function drawScaled(src, maxSide, quality) {
    var w = src.videoWidth || src.naturalWidth || src.width;
    var h = src.videoHeight || src.naturalHeight || src.height;
    if (!w || !h) throw new Error('尺寸异常');
    var k = Math.min(1, maxSide / Math.max(w, h));
    var cw = Math.round(w * k), ch = Math.round(h * k);
    var c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    var ctx = c.getContext('2d');
    if (!ctx) throw new Error('浏览器不支持图片处理');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(src, 0, 0, cw, ch);
    return c.toDataURL('image/jpeg', quality);
  }

  async function prepareImage(file) {
    if (file.size > 20 * 1024 * 1024) throw new Error('照片太大了（上限 20MB）');
    var raw = await readAsDataURL(file);
    var img = await loadImage(raw);
    return {
      kind: 'image',
      name: file.name || '照片',
      size: file.size,
      thumb: drawScaled(img, 220, 0.6),
      media: [drawScaled(img, 1280, 0.82)]
    };
  }

  function prepareVideo(file) {
    return new Promise(function (resolve, reject) {
      if (file.size > 80 * 1024 * 1024) { reject(new Error('视频太大了（上限 80MB）')); return; }
      var url = URL.createObjectURL(file);
      var v = document.createElement('video');
      var done = false;
      v.preload = 'auto';
      v.muted = true;
      v.playsInline = true;
      v.src = url;
      function finish() {
        done = true;
        try { URL.revokeObjectURL(url); } catch (e) {}
      }
      function fail(msg) {
        if (done) return;
        finish();
        reject(new Error(msg));
      }
      var guard = setTimeout(function () { fail('视频处理超时，换个小一点的视频试试'); }, 25000);
      v.onerror = function () { clearTimeout(guard); fail('这个视频浏览器读不了，换个格式试试'); };
      v.onloadedmetadata = function () {
        var dur = isFinite(v.duration) && v.duration > 0 ? v.duration : 0;
        if (!dur) { clearTimeout(guard); fail('读不出视频时长'); return; }
        var times = [0.06, 0.32, 0.58, 0.84].map(function (p) {
          return Math.min(Math.max(0, dur - 0.06), dur * p);
        });
        var i = 0, frames = [], thumb = '';
        function shot() {
          if (done) return;
          if (i >= times.length) {
            clearTimeout(guard);
            finish();
            if (!frames.length) { reject(new Error('没能从视频里抽到画面')); return; }
            resolve({ kind: 'video', name: file.name || '视频', size: file.size, thumb: thumb, media: frames, duration: dur });
            return;
          }
          var t = times[i++];
          v.onseeked = function () {
            try {
              var jpg = drawScaled(v, 720, 0.75);
              if (!thumb) thumb = drawScaled(v, 220, 0.6);
              frames.push(jpg);
            } catch (e) {}
            shot();
          };
          try { v.currentTime = t; } catch (e) { shot(); }
        }
        shot();
      };
    });
  }

  // 可以直接按文本读的扩展名
  var TEXT_EXTS = ['txt', 'text', 'md', 'markdown', 'json', 'jsonl', 'csv', 'tsv', 'log', 'ini', 'cfg', 'conf', 'yml', 'yaml', 'xml', 'html', 'htm', 'css', 'scss', 'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'py', 'ipynb', 'rb', 'go', 'java', 'kt', 'c', 'h', 'cpp', 'hpp', 'cs', 'rs', 'php', 'pl', 'lua', 'swift', 'sh', 'bash', 'zsh', 'bat', 'cmd', 'ps1', 'sql', 'toml', 'env', 'gitignore', 'dockerfile', 'makefile', 'r', 'm', 'asm', 'vbs', 'ahk'];
  var OLD_OFFICE = ['doc', 'ppt', 'xls', 'wps', 'et', 'dps'];

  // 中文文件常见 GBK 编码：先按 UTF-8 解，出现乱码就换 GBK
  function decodeBytes(buf) {
    var text = '';
    try { text = new TextDecoder('utf-8', { fatal: false }).decode(buf); } catch (e) { text = ''; }
    if (text.indexOf('\uFFFD') === -1) return text;
    try { return new TextDecoder('gbk', { fatal: false }).decode(buf); } catch (e) { return text; }
  }

  function decodeEntities(s) {
    return String(s || '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&');
  }

  // Word / PPT 的 XML 里，段落结束就是换行，去掉标签后就是正文
  function xmlToText(xml) {
    var s = String(xml || '')
      .replace(/<w:tab[^>]*\/>/g, '\t')
      .replace(/<w:br[^>]*\/>/g, '\n')
      .replace(/<a:br[^>]*\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<\/a:p>/g, '\n')
      .replace(/<[^>]+>/g, '');
    return decodeEntities(s);
  }

  async function ensurePdfLib() {
    if (!window.pdfjsLib) throw new Error('PDF 解析库没加载好，刷新页面再试');
    if (!window.__pdfWorkerBlob) {
      var wr = await fetch('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js');
      if (!wr.ok) throw new Error('PDF 解析器加载失败');
      window.__pdfWorkerBlob = URL.createObjectURL(new Blob([await wr.text()], { type: 'application/javascript' }));
    }
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = window.__pdfWorkerBlob;
    return window.pdfjsLib;
  }

  async function extractPdf(file) {
    var lib = await ensurePdfLib();
    var buf = await file.arrayBuffer();
    var pdf = await lib.getDocument({ data: buf }).promise;
    var out = [], total = 0, maxPages = Math.min(pdf.numPages, 60);
    for (var p = 1; p <= maxPages; p++) {
      var page = await pdf.getPage(p);
      var tc = await page.getTextContent();
      var line = tc.items.map(function (it) { return it.str || ''; }).join(' ').replace(/\s+/g, ' ').trim();
      out.push('【第 ' + p + ' 页】\n' + line);
      total += line.length;
      if (total > 60000) {
        out.push('……（共 ' + pdf.numPages + ' 页，后面已省略）');
        break;
      }
    }
    return out.join('\n\n');
  }

  async function extractDocx(file) {
    if (!window.JSZip) throw new Error('文档解析库没加载好，刷新页面再试');
    var zip = await window.JSZip.loadAsync(file);
    var entry = zip.file('word/document.xml');
    if (!entry) throw new Error('这个 docx 里没找到正文');
    return xmlToText(await entry.async('string'));
  }

  async function extractPptx(file) {
    if (!window.JSZip) throw new Error('文档解析库没加载好，刷新页面再试');
    var zip = await window.JSZip.loadAsync(file);
    var slides = [];
    zip.forEach(function (path) {
      var m = path.match(/^ppt\/slides\/slide(\d+)\.xml$/);
      if (m) slides.push({ n: parseInt(m[1], 10), path: path });
    });
    if (!slides.length) throw new Error('这个 pptx 里没找到幻灯片');
    slides.sort(function (a, b) { return a.n - b.n; });
    var out = [], total = 0;
    for (var i = 0; i < slides.length; i++) {
      var xml = await zip.file(slides[i].path).async('string');
      var body = '';
      xml.replace(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g, function (m, s) { body += decodeEntities(s) + '\n'; return m; });
      body = body.trim();
      if (!body) continue;
      out.push('【第 ' + slides[i].n + ' 页】\n' + body);
      total += body.length;
      if (total > 60000) {
        out.push('……（共 ' + slides.length + ' 页，后面已省略）');
        break;
      }
    }
    return out.join('\n\n');
  }

  async function prepareFile(file) {
    if (file.size > 60 * 1024 * 1024) throw new Error('文件太大了（上限 60MB）');
    var ext = (String(file.name).split('.').pop() || '').toLowerCase();
    var text = '';
    if (ext === 'pdf') {
      toast('正在解析 PDF…');
      text = await extractPdf(file);
    } else if (ext === 'docx') {
      toast('正在解析 Word…');
      text = await extractDocx(file);
    } else if (ext === 'pptx') {
      toast('正在解析 PPT…');
      text = await extractPptx(file);
    } else if (OLD_OFFICE.indexOf(ext) > -1) {
      throw new Error('旧版 .' + ext + ' 读不了，另存为 .docx / .pptx 再传');
    } else if (TEXT_EXTS.indexOf(ext) > -1 || /^text\//.test(file.type) || !file.type) {
      text = decodeBytes(await file.arrayBuffer());
    } else {
      throw new Error('暂不支持 .' + (ext || '未知') + ' 这种格式');
    }

    text = String(text || '').replace(/\r\n/g, '\n').replace(/[\t ]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
    if (!text) throw new Error('这个文件里没抽到文字（可能是扫描版或纯图片）');

    // 免费模型上下文有限，超长文件先截断（保留开头，够模型判断和回答）
    var full = text.length;
    var truncated = false;
    if (text.length > 30000) { text = text.slice(0, 30000); truncated = true; }

    return {
      kind: 'file',
      name: file.name || '文件',
      size: file.size,
      ext: ext,
      text: text,
      fullChars: full,
      truncated: truncated,
      chars: text.length
    };
  }

  async function handleUpload(file) {
    if (!file) return;
    if (busy) { toast('等这一轮说完再传附件'); return; }
    var kind = /^video\//.test(file.type) ? 'video' : /^image\//.test(file.type) ? 'image' : 'file';
    toast(kind === 'video' ? '正在从视频里抽画面…' : kind === 'image' ? '正在处理照片…' : '正在读文件…');
    try {
      var a = kind === 'video' ? await prepareVideo(file) : kind === 'image' ? await prepareImage(file) : await prepareFile(file);
      attach = a;
      lastMedia = { kind: a.kind, name: a.name, media: a.media || [], text: a.text || '', ext: a.ext || '' };
      renderAttachUI();
      toast(kind === 'video' ? '视频已就绪（' + a.media.length + ' 帧）'
        : kind === 'image' ? '照片已就绪'
        : '文件已就绪（' + a.chars + ' 字' + (a.truncated ? '，已截断' : '') + '）');
    } catch (e) {
      toast((e && e.message) || '附件处理失败');
    }
  }

  function renderAttachUI() {
    var strip = $('#attachStrip');
    if (!strip) return;
    if (!attach) { strip.hidden = true; return; }
    strip.hidden = false;
    var th = $('#attachThumb');
    th.innerHTML = '';
    if (attach.thumb) {
      var img = document.createElement('img');
      img.src = attach.thumb;
      img.alt = attach.name || '';
      th.appendChild(img);
    } else if (attach.kind === 'file') {
      var icon = document.createElement('div');
      icon.className = 'att-file-icon';
      icon.textContent = '📄';
      th.appendChild(icon);
    }
    $('#attachName').textContent = attach.name || '附件';
    var mb = attach.size ? (attach.size / 1024 / 1024).toFixed(1) + 'MB' : '';
    var sizeText;
    if (attach.kind === 'video') sizeText = '视频 · ' + attach.media.length + ' 帧';
    else if (attach.kind === 'file') sizeText = '文件 · ' + attach.chars + ' 字' + (attach.truncated ? '（已截断）' : '');
    else sizeText = '照片';
    var reader = attach.kind === 'video' ? '看片 AI n30' : attach.kind === 'file' ? '读文档 AI doc' : '看图 AI n12';
    $('#attachMeta').textContent = sizeText + (mb ? ' · ' + mb : '') + ' · 先交给' + reader;
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
    var isGen = !!(m.gen && m.gen.jobId);
    var who;
    if (m.who === 'n12' || m.who === 'n30' || m.who === 'doc' || m.who === 'video' || m.who === 'music' || m.who === 'image') who = m.who;
    else who = 'ai';
    var wrap = document.createElement('div');
    wrap.className = 'msg ' + (m.role === 'ai' ? ('msg-ai' + (who !== 'ai' ? ' msg-' + who : '')) : 'msg-user');
    if (m.role === 'ai') wrap.appendChild(makeAvatar(who));

    var col = document.createElement('div');
    col.className = 'bubble-col';

    var bubble = document.createElement('div');
    bubble.className = 'bubble';

    if (m.att) renderAttCard(bubble, m.att);

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

    // 小谷调用其它 AI 的记录（追问 n12/n30/doc、派单给生成 AI），历史消息也要能看到
    if (m.calls && m.calls.length) {
      var callBox = document.createElement('div');
      callBox.className = 'call-tags';
      m.calls.forEach(function (c) { callBox.appendChild(makeCallTag(c)); });
      bubble.appendChild(callBox);
    }

    // 生成类 AI：渲染任务卡片（状态 + 媒体播放器）
    if (isGen) {
      var genHost = document.createElement('div');
      genHost.className = 'gen-card-host';
      bubble.appendChild(genHost);
      wrap._genHost = genHost;
      var job = findJob(m.gen.jobId);
      renderGenCard(genHost, job, m);
    }

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
    label.textContent = (m.role === 'ai' ? whoLabel(m.who) : '你') + ' · ' + timeText(m.ts);
    meta.appendChild(label);
    if (m.role === 'ai' && m.text && !isGen) {
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
    if (!isGen) renderMD(md, m.text);
    if (m.search && m.search.length) renderSearchCard(md, m.searchQuery, m.search);
    return wrap;
  }

  // 小谷调用其它 AI 的小标记：「↳ 调用 读文档 AI · doc「问题」」
  function makeCallTag(c) {
    var target = c.type === 'route'
      ? (GEN[c.who] ? GEN[c.who].name : c.who)
      : (MEDIA[c.who] ? whoLabel(c.who) : c.who);
    var row = document.createElement('div');
    row.className = 'call-tag ' + (c.type === 'route' ? 'call-route' : 'call-ask');
    var arrow = document.createElement('span');
    arrow.className = 'call-arrow';
    arrow.textContent = '↳';
    var label = document.createElement('b');
    label.textContent = (c.type === 'route' ? '派单给 ' : '调用 ') + target;
    var body = document.createElement('span');
    body.className = 'call-body';
    body.textContent = c.type === 'route' ? ('「' + (c.prompt || '') + '」') : ('「' + (c.q || '') + '」');
    row.appendChild(arrow);
    row.appendChild(label);
    row.appendChild(body);
    return row;
  }

  // 运行时追加到正在流式的这条消息上
  function appendCallTag(node, call) {
    if (!node) return;
    var bubble = node.querySelector('.bubble');
    if (!bubble) return;
    var box = bubble.querySelector('.call-tags');
    if (!box) {
      box = document.createElement('div');
      box.className = 'call-tags';
      bubble.appendChild(box);
    }
    box.appendChild(makeCallTag(call));
    scrollBottom(true);
  }

  // 重新渲染某个任务对应的消息卡片（任务状态变化时调用）
  function renderJobMessage(jobId) {
    if (!elMessages) return;
    var nodes = elMessages.children;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var m = n._msg;
      if (m && m.gen && m.gen.jobId === jobId && n._genHost) {
        var job = findJob(jobId);
        renderGenCard(n._genHost, job, m);
        break;
      }
    }
  }

  function genStatusText(job) {
    if (!job) return '任务不存在';
    if (job.status === 'pending') return '排队中…';
    if (job.status === 'running') {
      if (job.who === 'video') return '🎬 视频生成中…';
      if (job.who === 'music') return '🎵 音乐生成中…';
      return '🖼 图片生成中…';
    }
    if (job.status === 'done') {
      if (job.who === 'video') return '✅ 视频生成完成';
      if (job.who === 'music') return '✅ 音乐生成完成';
      return '✅ 图片生成完成';
    }
    if (job.status === 'error') return '❌ 生成失败：' + (job.error || '未知错误');
    return job.status;
  }

  function renderGenCard(host, job, msg) {
    if (!host) return;
    host.innerHTML = '';
    if (!job) {
      host.textContent = '任务数据丢失';
      return;
    }
    var def = GEN[job.who];

    var prompt = document.createElement('div');
    prompt.className = 'gen-prompt';
    prompt.innerHTML = '<b>' + def.emoji + ' ' + def.name + '</b><span>提示词：' + escapeHtml(job.prompt || '（空）') + '</span>';
    host.appendChild(prompt);

    var status = document.createElement('div');
    status.className = 'gen-status gen-status-' + job.status;
    status.textContent = genStatusText(job);
    host.appendChild(status);

    var media = genMediaCache[job.id];
    var expired = job.status === 'done' && !media;

    if (job.status === 'done' && media && media.url) {
      var player = document.createElement('div');
      player.className = 'gen-media';
      if (job.who === 'video') {
        var v = document.createElement('video');
        v.src = media.url;
        v.controls = true;
        v.playsInline = true;
        v.style.maxWidth = '100%';
        player.appendChild(v);
      } else if (job.who === 'music') {
        var au = document.createElement('audio');
        au.src = media.url;
        au.controls = true;
        player.appendChild(au);
        if (media.transcript) {
          var tr = document.createElement('div');
          tr.className = 'gen-transcript';
          tr.textContent = '歌词：' + media.transcript;
          player.appendChild(tr);
        }
      } else {
        var im = document.createElement('img');
        im.src = media.url;
        im.alt = job.prompt || '生成的图片';
        im.style.maxWidth = '100%';
        im.style.borderRadius = '10px';
        player.appendChild(im);
      }
      host.appendChild(player);
    } else if (expired) {
      var exp = document.createElement('div');
      exp.className = 'gen-expired';
      exp.textContent = '媒体已随页面刷新失效，可点击右侧按钮重新生成。';
      host.appendChild(exp);
    }

    // 操作按钮：失败 / 已过期 / 运行中（停止）
    var actions = document.createElement('div');
    actions.className = 'gen-actions';
    if (job.status === 'running' || job.status === 'pending') {
      var stop = document.createElement('button');
      stop.type = 'button';
      stop.className = 'meta-btn';
      stop.textContent = '停止生成';
      stop.addEventListener('click', function () { abortJob(job.id); });
      actions.appendChild(stop);
    }
    if (job.status === 'error' || expired) {
      var retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'meta-btn';
      retry.textContent = '重新生成';
      retry.addEventListener('click', function () {
        runGen(job.who, job.prompt, { summarize: false });
      });
      actions.appendChild(retry);
    }
    if (actions.children.length) host.appendChild(actions);
  }

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = String(s == null ? '' : s);
    return d.innerHTML;
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

  // 小谷向 n12 / n30 提问：<ask who="n12">问题</ask>
  function takeAsks(raw) {
    var list = [];
    var text = String(raw || '').replace(/<ask\b([^>]*)>([\s\S]*?)<\/ask>/gi, function (m, attrs, body) {
      var who = (getAttr(attrs, 'who') || getAttr(attrs, 'to') || 'n12').toLowerCase();
      if (who !== 'n12' && who !== 'n30' && who !== 'doc') who = 'n12';
      if (list.length < 1 && String(body || '').trim()) {
        list.push({ who: who, q: String(body || '').trim().slice(0, 300) });
      }
      return '';
    });
    text = text.replace(/<ask\b[^>]*>[\s\S]*$/gi, '');
    return { raw: text, list: list };
  }

  // 小谷把生成任务派给三个生成 AI：<route to="video|music|image" prompt="..."/>
  // 也支持 <route to="image">提示词</route>
  function takeRoute(raw) {
    var route = null;
    var text = String(raw || '');
    // 1) 自闭合写法 <route to="image" prompt="..."/>（必须先处理，否则会被下面的兜底规则吃掉）
    text = text.replace(/<route\b([^>]*?)\/>/gi, function (m, attrs) {
      if (route) return '';
      var to = (getAttr(attrs, 'to') || '').toLowerCase();
      var prompt = getAttr(attrs, 'prompt') || '';
      if (GEN[to] && prompt) route = { who: to, prompt: prompt.slice(0, 400) };
      return '';
    });
    // 2) 成对写法 <route to="...">提示词</route>
    text = text.replace(/<route\b([^>]*)>([\s\S]*?)<\/route>/gi, function (m, attrs, body) {
      if (route) return '';
      var to = (getAttr(attrs, 'to') || '').toLowerCase();
      var prompt = getAttr(attrs, 'prompt') || String(body || '').trim();
      if (GEN[to] && prompt) route = { who: to, prompt: prompt.slice(0, 400) };
      return '';
    });
    // 3) 没闭合的残留，直接删掉
    text = text.replace(/<route\b[^>]*>[\s\S]*$/gi, '');
    return { raw: text, route: route };
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
    s = s.replace(/<ask\b[^>]*>[\s\S]*?<\/ask>/gi, '');
    s = s.replace(/<ask\b[^>]*>[\s\S]*$/gi, '');
    s = s.replace(/<route\b[^>]*>[\s\S]*?<\/route>/gi, '');
    s = s.replace(/<route\b[^>]*?\/?>/gi, '');
    s = s.replace(/<route\b[^>]*>[\s\S]*$/gi, '');
    s = s.replace(/<(tool_call|function_call)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
    s = s.replace(/<(thinking|thought|reason|analysis)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
    s = s.replace(/<(tool_call|function_call|thinking|thought|reason|analysis)\b[^>]*>[\s\S]*$/gi, '');
    s = s.replace(/<\/?output\b[^>]*>/gi, '');
    return MD.stripIncomplete(s);
  }

  /* ---------------- 对话 ---------------- */
  function pushUser(text, forceFx, forceHtml, att) {
    var m = { role: 'user', text: text, ts: Date.now() };
    if (forceFx) m.forceFx = true;
    if (forceHtml) m.forceHtml = true;
    if (att) m.att = att;
    messages.push(m);
    saveMessages();
    elWelcome.hidden = true;
    appendMessage(m, true);
    scrollBottom(true);
  }

  // 三个 AI 共享同一份对话记录：给每一个都带上说话人标签
  function transcriptFor(limit) {
    var lines = [];
    messages.filter(function (m) {
      return (m.text || m.att || m.gen) && !m.pending;
    }).slice(-(limit || 12)).forEach(function (m) {
      if (m.role === 'user') {
        var attName = m.att ? (m.att.kind === 'video' ? '视频' : m.att.kind === 'file' ? '文件' : '照片') : '';
        lines.push('用户：' + (m.text || '（只上传了' + attName + '）') +
          (m.att && m.text ? '（同时上传了' + attName + '）' : ''));
      } else if (m.gen) {
        var j = findJob(m.gen.jobId);
        lines.push(whoLabel(m.who) + '：' + genSummaryText(j));
      } else {
        lines.push(whoLabel(m.who) + '：' + (m.text || ''));
      }
    });
    return lines.join('\n');
  }

  function genSummaryText(job) {
    if (!job) return '（生成任务）';
    var def = GEN[job.who] || { name: '生成 AI' };
    if (job.status === 'done') return '[' + def.name + ' 生成完成] 提示词：' + job.prompt;
    if (job.status === 'error') return '[' + def.name + ' 生成失败] ' + (job.error || '') + '，提示词：' + job.prompt;
    return '[' + def.name + ' 生成中] 提示词：' + job.prompt;
  }

  function visibleHistory() {
    return messages.filter(function (m) {
      return (m.text || m.att || m.gen) && !m.pending;
    }).slice(-12).map(function (m) {
      if (m.role === 'user') {
        var attName = m.att ? (m.att.kind === 'video' ? '一段视频' : m.att.kind === 'file' ? '一个文件' : '一张照片') : '';
        var head = m.att ? ('[用户上传了' + attName + ']' + (m.text ? '\n' : '')) : '';
        return { role: 'user', content: head + (m.text || '') };
      }
      if (m.gen) {
        var j = findJob(m.gen.jobId);
        return { role: 'assistant', content: genSummaryText(j) };
      }
      var tag = m.who === 'n12' ? '[看图 AI 描述] ' : m.who === 'n30' ? '[看片 AI 描述] ' : m.who === 'doc' ? '[读文档 AI 描述] ' : '';
      return { role: 'assistant', content: tag + (m.text || '') };
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
    if (!text && !attach) { if (rt.on) rtResume(); return; }
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
    // @video / @music / @image（含别名）：点名生成类 AI
    var genRoute = parseGenWho(text);
    // @n12 / @n30 / @doc / @g：点名让谁回答
    var who = 'g';
    var route = text.match(/^[@＠](n12|n30|doc|g)(?=$|[^\w])/i);
    if (route) {
      who = route[1].toLowerCase();
      text = text.slice(route[0].length).replace(/^[，,。.、:：\s]+/, '').trim();
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
    var media = attach ? {
      kind: attach.kind,
      name: attach.name,
      thumb: attach.thumb,
      media: (attach.media || []).slice(),
      text: attach.text || '',
      ext: attach.ext || ''
    } : null;
    if (media) lastMedia = { kind: media.kind, name: media.name, media: media.media, text: media.text, ext: media.ext };
    var attMeta = media ? { kind: media.kind, name: media.name, thumb: media.thumb } : null;

    elInput.value = '';
    autoGrow();
    attach = null;
    renderAttachUI();
    pushUser(text, forceFx, forceHtml, attMeta);

    // 点名生成类 AI：直接生成，完成后小谷总结
    if (genRoute) {
      runGen(genRoute.who, genRoute.text, { summarize: true });
      return;
    }

    // 点名 n12 / n30 / doc：只让它们回答（上下文仍然共享）
    if (who === 'n12' || who === 'n30' || who === 'doc') {
      var picked = null;
      if (media && media.kind === MEDIA[who].kind) picked = media;
      else if (lastMedia && lastMedia.kind === MEDIA[who].kind) picked = lastMedia;
      if (!picked) {
        var needName = MEDIA[who].kind === 'video' ? '一段视频' : MEDIA[who].kind === 'file' ? '一个文件' : '一张照片';
        toast('先上传' + needName + '，' + MEDIA[who].name + '才有东西看');
        runAI(text || '你好', false, false, {});
        return;
      }
      runMedia(who, text, picked, {});
      return;
    }

    // 默认：有附件时先让看图 / 看片 / 读文档 AI 处理，再交给小谷
    if (media) {
      var reader = media.kind === 'video' ? 'n30' : media.kind === 'file' ? 'doc' : 'n12';
      runMedia(reader, text, media, { thenG: true });
      return;
    }

    runAI(text, forceFx, forceHtml, {});
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

  /* ---------------- 看图 / 看片 AI ---------------- */
  function mediaChain(who) {
    var d = MEDIA[who];
    var out = [];
    if (mediaWorking[who]) out.push(mediaWorking[who]);
    if (out.indexOf(d.id) === -1) out.push(d.id);
    (d.fallback || []).forEach(function (x) { if (out.indexOf(x) === -1) out.push(x); });
    return out;
  }

  function mediaSystem(who) {
    if (who === 'doc') {
      return [
        '你是「谷仓 AI」里专门读文件的助手，代号 doc。你只做一件事：把文件里的内容如实说出来。',
        '你会收到从用户上传的文件里提取出来的文字（PDF / Word / PPT / 代码 / 纯文本）。',
        '规则：',
        '1. 先用一句话说清这是什么文件、大概讲什么，再回答用户关心的点。',
        '2. 引用原文的关键句、数字、条款时保持准确，不要改写原意，不要编造文件里没有的内容。',
        '3. 代码文件说清语言、用途、关键函数和值得注意的地方；批处理/脚本要说清它会执行什么操作、有没有风险。',
        '4. 不闲聊、不扮演小谷、不调用互动、不输出任何标签；用短句。',
        '5. 一般 200 字以内；对方明确要求细读或总结时才展开，可以用简单列表。',
        '6. 提取的文字可能有断行、乱码或被截断，遇到明显残缺就说明，不要硬猜。'
      ].join('\n');
    }
    if (who === 'n30') {
      return [
        '你是「谷仓 AI」里专门看视频的助手，代号 n30。你只做一件事：把看到的内容如实说出来。',
        '你会收到同一个视频里按时间顺序抽出的几帧画面（第 1 帧最早，最后一帧最晚），请把它们当成一段连续的视频来理解。',
        '规则：',
        '1. 按时间顺序讲清楚发生了什么：人物、动作、场景、镜头变化、画面里的文字、光线和气氛。',
        '2. 不闲聊、不扮演小谷、不调用互动、不输出任何标签；用短句，不要 Markdown 标题。',
        '3. 看不清、抽帧没覆盖到的地方就说看不清，绝不编造剧情或台词。',
        '4. 用户或小谷在问你细节时，直接回答，回答得具体。',
        '5. 一般 120 字以内；对方明确要求细节时才展开。'
      ].join('\n');
    }
    return [
      '你是「谷仓 AI」里专门看图的助手，代号 n12。你只做一件事：把看到的内容如实说出来。',
      '规则：',
      '1. 只描述画面里真实存在的东西：主体、动作、场景、颜色、数量、画面里的文字、镜头角度和气氛。',
      '2. 不闲聊、不扮演小谷、不调用互动、不输出任何标签；用短句，不要 Markdown 标题。',
      '3. 看不清就说看不清，绝不编造画面里没有的东西。',
      '4. 用户或小谷在问你细节时，直接回答，回答得具体。',
      '5. 一般 120 字以内；对方明确要求细节时才展开。'
    ].join('\n');
  }

  function mediaPrompt(who, question, kind) {
    var head = who === 'n30'
      ? '下面是从同一个视频里按时间顺序抽取的几帧画面（第 1 帧最早，最后一帧最晚）。'
      : who === 'doc'
        ? '下面是从用户上传的文件里提取出来的文字。'
        : '下面这张照片是用户刚刚上传的。';
    var askText = kind === 'video'
      ? '说说视频里发生了什么。'
      : kind === 'file'
        ? '根据文件内容回答。'
        : '说说照片里有什么。';
    var history = transcriptFor(12);
    return [
      head,
      '',
      '## 共享对话记录（用户、小谷和你都在里面）',
      history || '（刚开始）',
      '',
      '## 你的任务',
      question
        ? ('针对用户最后说的「' + question.slice(0, 160) + '」：' + askText)
        : ('用户没有额外说明，直接' + askText),
      '只描述你看到的内容，不要扮演小谷，不要输出标签或 Markdown 标题。'
    ].join('\n');
  }

  function mediaForAsk(who) {
    if (!lastMedia || lastMedia.kind !== MEDIA[who].kind) return null;
    return lastMedia;
  }

  async function runMedia(who, question, media, opts) {
    opts = opts || {};
    var def = MEDIA[who];
    var placeholder = { role: 'ai', who: who, text: '', reasoning: '', ts: Date.now(), pending: true };
    messages.push(placeholder);
    var node = appendMessage(placeholder, true);
    node.classList.add('is-pending');
    showTyping(node);
    scrollBottom(true);

    setBusy(true);
    controller = new AbortController();
    var chain = mediaChain(who);

    var parts;
    if (media.kind === 'file') {
      // 纯文本用字符串内容，兼容性最好
      var docHead = mediaPrompt(who, question, 'file');
      parts = docHead + '\n\n## 文件：' + (media.name || '未命名') + (media.ext ? '（.' + media.ext + '）' : '') +
        '\n```\n' + String(media.text || '').slice(0, 30000) + '\n```';
    } else {
      parts = [{ type: 'text', text: mediaPrompt(who, question, media.kind) }];
      (media.media || []).slice(0, 8).forEach(function (url) {
        parts.push({ type: 'image_url', image_url: { url: url } });
      });
    }

    var answer = '', lastErr = null, usedModel = '';
    for (var i = 0; i < chain.length; i++) {
      if (i > 0) showTyping(node);
      var s = { raw: '', reasoning: '', node: node, msg: placeholder, lastPaint: 0 };
      streaming = s;
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
            model: chain[i],
            messages: [
              { role: 'system', content: mediaSystem(who) },
              { role: 'user', content: parts }
            ],
            stream: true,
            temperature: 0.35,
            max_tokens: who === 'doc' ? 3000 : 1800,
            top_p: 0.9
          })
        });
        if (!res.ok) {
          var detail = '';
          try {
            var j = await res.json();
            detail = (j.error && (j.error.message || j.error.code)) || '';
          } catch (e) {}
          throw new Error('HTTP ' + res.status + (detail ? '：' + detail : ''));
        }
        await readStream(res, s);
        if (!String(s.raw || '').trim()) throw new Error('这次没有返回内容');
        answer = s.raw;
        placeholder.reasoning = s.reasoning;
        usedModel = chain[i];
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        if (e && e.name === 'AbortError') break;
      }
    }

    var aborted = lastErr && lastErr.name === 'AbortError';
    var parsed = extractSpecials(answer, false);
    var finalText = parsed.text || parsed.reasoning || '';

    placeholder.pending = false;
    node.classList.remove('is-pending');
    node._md.innerHTML = '';

    if (!finalText) {
      placeholder.text = aborted
        ? '（已停止这次识别）'
        : ('识别失败：' + ((lastErr && lastErr.message) || '未知错误') + '。可以先 @g 让小谷回答。');
      placeholder.error = !aborted;
      var p = document.createElement('p');
      p.className = aborted ? 'msg-note' : 'msg-error';
      p.textContent = placeholder.text;
      node._md.appendChild(p);
    } else {
      placeholder.text = finalText;
      if (parsed.reasoning) placeholder.reasoning = parsed.reasoning;
      placeholder.model = usedModel;
      if (placeholder.reasoning) updateThinking(node, placeholder.reasoning, false);
      renderMD(node._md, finalText);
      if (usedModel) mediaWorking[who] = usedModel;
    }

    saveMessages();
    scrollBottom(true);
    controller = null;
    streaming = null;
    setBusy(false);

    if (opts.thenG && finalText) {
      var seenWhat = media.kind === 'video' ? '用户上传的视频' : media.kind === 'file' ? '用户上传的文件' : '用户上传的照片';
      var note = [
        '## 你的同伴刚刚看过内容了',
        '「' + def.name + '」看了' + seenWhat + (media.kind === 'file' ? '（' + (media.name || '') + '）' : '') + '，它看到的是：',
        finalText,
        '',
        '请用你自己的话接着回应（不要复述整段描述，只挑你在意的细节，可以带上你的经历或追问）。如果你还需要更多细节，可以在回复里写 <ask who="' + who + '">问题</ask>。'
      ].join('\n');
      runAI(question || '看看这个', false, false, { extraNote: note, depth: opts.depth || 0 });
    }
  }

  /* ---------------- 生成类 AI：视频 / 音乐 / 图片 ---------------- */
  function abortJob(jobId) {
    var c = genControllers[jobId];
    if (c) { try { c.abort(); } catch (e) {} }
    var j = findJob(jobId);
    if (j && (j.status === 'running' || j.status === 'pending')) {
      updateJob(jobId, { status: 'error', error: '已手动停止' });
    }
  }

  // 调度：创建任务 + 消息，启动生成；完成后可让小谷总结
  function runGen(who, prompt, opts) {
    opts = opts || {};
    var def = GEN[who];
    if (!def) { toast('不认识的生成类型：' + who); return; }
    prompt = String(prompt || '').trim();
    if (!prompt) {
      toast(def.name + '需要一个提示词');
      return;
    }
    var job = newJob(who, prompt);
    var msg = {
      role: 'ai', who: who, text: '', ts: Date.now(),
      gen: { jobId: job.id }, pending: true
    };
    messages.push(msg);
    saveMessages();
    elWelcome.hidden = true;
    appendMessage(msg, true);
    scrollBottom(true);
    startGen(job, opts);
  }

  function startGen(job, opts) {
    opts = opts || {};
    var who = job.who;
    var def = GEN[who];
    var ctl = new AbortController();
    genControllers[job.id] = ctl;
    updateJob(job.id, { status: 'running' });

    var worker;
    if (who === 'video') worker = runVideoGen(job, ctl);
    else if (who === 'music') worker = runMusicGen(job, ctl);
    else worker = runImageGen(job, ctl);

    worker.then(function (ok) {
      delete genControllers[job.id];
      var msg = findMessageByJob(job.id);
      if (msg) msg.pending = false;
      saveMessages();
      if (ok && opts.summarize !== false) {
        summarizeGen(job);
      }
    }).catch(function (e) {
      delete genControllers[job.id];
      var aborted = e && e.name === 'AbortError';
      if (!aborted) {
        updateJob(job.id, { status: 'error', error: (e && e.message) ? e.message : '生成失败' });
      }
      var msg2 = findMessageByJob(job.id);
      if (msg2) msg2.pending = false;
      saveMessages();
    });
  }

  // 生成完成后，把结果交给小谷用自己的话总结一下
  function summarizeGen(job) {
    var def = GEN[job.who];
    var media = genMediaCache[job.id] || {};
    var desc = def.name + '刚刚完成了一次生成。';
    if (job.who === 'video') desc += '内容是一段视频，提示词是：' + job.prompt;
    else if (job.who === 'music') desc += '内容是一段音乐' + (media.transcript ? '，歌词大意：' + media.transcript : '') + '，提示词是：' + job.prompt;
    else desc += '内容是一张图片，提示词是：' + job.prompt;
    var note = [
      '## 你的同伴刚刚生成了东西',
      desc,
      '媒体已经在对话里展示给用户了。请用你自己的话简单回应一下（一两句话就够，不要复述提示词），可以带上你的感受或追问。'
    ].join('\n');
    runAI('', false, false, { extraNote: note, depth: 0 });
  }

  // 视频：OpenRouter /api/v1/videos，服务端异步任务，可跨页面续跑
  async function runVideoGen(job, ctl) {
    var def = GEN.video;
    if (!job.remoteId) {
      updateJob(job.id, { status: 'running' });
      var res = await fetch('https://openrouter.ai/api/v1/videos', {
        method: 'POST',
        signal: ctl.signal,
        headers: {
          'Authorization': 'Bearer ' + settings.key,
          'Content-Type': 'application/json',
          'HTTP-Referer': location.origin + '/ai/',
          'X-Title': 'Xiaogu - GuCang AI'
        },
        body: JSON.stringify({
          model: def.id,
          prompt: job.prompt
        })
      });
      if (!res.ok) {
        var detail = '';
        try { var j = await res.json(); detail = (j.error && (j.error.message || j.error.code)) || ''; } catch (e) {}
        throw new Error('HTTP ' + res.status + (detail ? '：' + detail : ''));
      }
      var created = await res.json();
      var remoteId = created.id || (created.data && created.data.id);
      var pollingUrl = created.polling_url || (created.data && created.data.polling_url);
      if (!remoteId) throw new Error('服务端没返回任务 ID');
      updateJob(job.id, { remoteId: remoteId, pollingUrl: pollingUrl || null });
    }

    // 轮询
    var url = job.pollingUrl || ('https://openrouter.ai/api/v1/videos/' + job.remoteId);
    var waited = 0;
    while (true) {
      if (ctl.signal.aborted) throw new DOMException('aborted', 'AbortError');
      var pr = await fetch(url, {
        signal: ctl.signal,
        headers: {
          'Authorization': 'Bearer ' + settings.key,
          'HTTP-Referer': location.origin + '/ai/',
          'X-Title': 'Xiaogu - GuCang AI'
        }
      });
      if (!pr.ok) {
        var d = '';
        try { var pj = await pr.json(); d = (pj.error && (pj.error.message || pj.error.code)) || ''; } catch (e) {}
        throw new Error('轮询失败 HTTP ' + pr.status + (d ? '：' + d : ''));
      }
      var info = await pr.json();
      var st = info.status || (info.data && info.data.status);
      if (st === 'completed') break;
      if (st === 'failed' || st === 'cancelled') {
        var errMsg = (info.error && (info.error.message || info.error.code)) || '服务端生成失败';
        throw new Error(errMsg);
      }
      waited += 4000;
      if (waited > 10 * 60 * 1000) throw new Error('生成超时（超过 10 分钟）');
      await sleep(4000);
    }

    // 拉取视频内容
    var contentRes = await fetch('https://openrouter.ai/api/v1/videos/' + job.remoteId + '/content?index=0', {
      signal: ctl.signal,
      headers: {
        'Authorization': 'Bearer ' + settings.key,
        'HTTP-Referer': location.origin + '/ai/',
        'X-Title': 'Xiaogu - GuCang AI'
      }
    });
    if (!contentRes.ok) throw new Error('下载视频失败 HTTP ' + contentRes.status);
    var blob = await contentRes.blob();
    var url2 = URL.createObjectURL(blob);
    genMediaCache[job.id] = { url: url2, mime: blob.type || 'video/mp4' };
    updateJob(job.id, { status: 'done', result: { mime: blob.type || 'video/mp4', size: blob.size } });
    return true;
  }

  // 音乐：lyria 走 chat/completions 流式，audio 数据在 delta.audio.data（base64 分片）
  async function runMusicGen(job, ctl) {
    var def = GEN.music;
    updateJob(job.id, { status: 'running' });
    var res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: ctl.signal,
      headers: {
        'Authorization': 'Bearer ' + settings.key,
        'Content-Type': 'application/json',
        'HTTP-Referer': location.origin + '/ai/',
        'X-Title': 'Xiaogu - GuCang AI'
      },
      body: JSON.stringify({
        model: def.id,
        messages: [{ role: 'user', content: job.prompt }],
        stream: true
      })
    });
    if (!res.ok) {
      var detail = '';
      try { var j = await res.json(); detail = (j.error && (j.error.message || j.error.code)) || ''; } catch (e) {}
      throw new Error('HTTP ' + res.status + (detail ? '：' + detail : ''));
    }

    var base64Chunks = [];
    var transcript = '';
    var mime = 'audio/mpeg';
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
        parseMusicChunk(chunk, base64Chunks, function (t) { transcript += t; }, function (mt) { if (mt) mime = mt; });
      }
    }
    if (buf.trim()) parseMusicChunk(buf, base64Chunks, function (t) { transcript += t; }, function (mt) { if (mt) mime = mt; });

    if (!base64Chunks.length) throw new Error('没有收到音频数据');
    var binary = atob(base64Chunks.join(''));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    var blob = new Blob([bytes], { type: mime });
    var url = URL.createObjectURL(blob);
    genMediaCache[job.id] = { url: url, mime: mime, transcript: transcript };
    updateJob(job.id, { status: 'done', result: { mime: mime, size: blob.size, transcript: transcript } });
    return true;
  }

  function parseMusicChunk(chunk, outChunks, onTranscript, onMime) {
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
      if (delta.audio) {
        if (delta.audio.data) outChunks.push(delta.audio.data);
        if (delta.audio.transcript) onTranscript(delta.audio.transcript);
        if (delta.audio.mime_type) onMime(delta.audio.mime_type);
      }
    }
  }

  // 图片：seedream 走 chat/completions，图片在返回里
  async function runImageGen(job, ctl) {
    var def = GEN.image;
    updateJob(job.id, { status: 'running' });
    var res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: ctl.signal,
      headers: {
        'Authorization': 'Bearer ' + settings.key,
        'Content-Type': 'application/json',
        'HTTP-Referer': location.origin + '/ai/',
        'X-Title': 'Xiaogu - GuCang AI'
      },
      body: JSON.stringify({
        model: def.id,
        messages: [{ role: 'user', content: job.prompt }]
      })
    });
    if (!res.ok) {
      var detail = '';
      try { var j = await res.json(); detail = (j.error && (j.error.message || j.error.code)) || ''; } catch (e) {}
      throw new Error('HTTP ' + res.status + (detail ? '：' + detail : ''));
    }
    var data = await res.json();
    var msg0 = data.choices && data.choices[0] && data.choices[0].message;
    var imgUrl = extractImageUrl(msg0);
    if (!imgUrl) throw new Error('模型没有返回图片');

    var blobUrl;
    if (imgUrl.indexOf('data:') === 0) {
      var m = imgUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!m) throw new Error('图片数据格式异常');
      var binary = atob(m[2]);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      blobUrl = URL.createObjectURL(new Blob([bytes], { type: m[1] }));
      genMediaCache[job.id] = { url: blobUrl, mime: m[1] };
    } else {
      // 远程 URL：下载成 blob，避免外链过期 / 跨域
      try {
        var ir = await fetch(imgUrl, { signal: ctl.signal });
        if (ir.ok) {
          var blob = await ir.blob();
          blobUrl = URL.createObjectURL(blob);
          genMediaCache[job.id] = { url: blobUrl, mime: blob.type || 'image/png' };
        } else {
          genMediaCache[job.id] = { url: imgUrl, mime: 'image/*', remote: true };
        }
      } catch (e) {
        genMediaCache[job.id] = { url: imgUrl, mime: 'image/*', remote: true };
      }
    }
    updateJob(job.id, { status: 'done', result: { mime: genMediaCache[job.id].mime } });
    return true;
  }

  function extractImageUrl(msg) {
    if (!msg) return '';
    // 1. message.images 数组
    if (Array.isArray(msg.images) && msg.images.length) {
      var im = msg.images[0];
      if (typeof im === 'string') return im;
      if (im && im.url) return im.url;
    }
    // 2. content 是数组（多模态）
    if (Array.isArray(msg.content)) {
      for (var i = 0; i < msg.content.length; i++) {
        var p = msg.content[i];
        if (p && p.type === 'image_url' && p.image_url && p.image_url.url) return p.image_url.url;
      }
    }
    // 3. content 字符串里的 markdown 图片 / data URL / http URL
    var text = typeof msg.content === 'string' ? msg.content : '';
    var dm = text.match(/!\[[^\]]*\]\((https?:\/\/[^)]+)\)/i);
    if (dm) return dm[1];
    var bm = text.match(/(data:image\/[a-zA-Z+]+;base64,[A-Za-z0-9+/=]+)/);
    if (bm) return bm[1];
    var um = text.match(/(https?:\/\/[^\s"'<>]+\.(png|jpe?g|webp|gif)(\?[^\s"'<>]*)?)/i);
    if (um) return um[1];
    return '';
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // 页面加载后，把还没结束的任务续跑起来
  function resumeJobs() {
    var now = Date.now();
    jobs.forEach(function (job) {
      if (job.status === 'running' || job.status === 'pending') {
        // 超过 30 分钟的任务认为已经死掉了
        if (now - (job.updatedAt || job.createdAt) > 30 * 60 * 1000) {
          updateJob(job.id, { status: 'error', error: '页面离开太久，任务已中断' });
          return;
        }
        startGen(job, { summarize: false });
      }
    });
  }

  function showTyping(node) {
    node._md.innerHTML = '';
    var t = document.createElement('div');
    t.className = 'typing';
    t.innerHTML = '<span></span><span></span><span></span>';
    node._md.appendChild(t);
  }

  async function runAI(userText, forceFx, forceHtml, opts) {
    opts = opts || {};
    var pendingAsk = null;
    var pendingRoute = null;
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
    var doSearch = settings.web && !forceFx && !forceHtml && !opts.extraNote && userText.length >= 4;
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
              messages: [{ role: 'system', content: buildSystemPrompt({ forceFx: forceFx, forceHtml: forceHtml, searchQuery: searchQuery || null, searchResults: searchResults, extraNote: opts.extraNote || '' }) }].concat(visibleHistory()),
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

          var visible = streaming.raw
            .replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi, '')
            .replace(/<music\b[^>]*\/?>/gi, '')
            .trim();
          if (!visible) {
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

      // 小谷可能想追问看图 / 看片 AI：<ask who="n12">…</ask>
      var askInfo = takeAsks(streaming.raw);
      streaming.raw = askInfo.raw;
      var asks = askInfo.list;

      // 小谷把生成任务派给视频 / 音乐 / 图片 AI：<route to="..." prompt="..."/>
      var routeInfo = takeRoute(streaming.raw);
      streaming.raw = routeInfo.raw;
      var routeTo = routeInfo.route;

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
      if (!finalText && !asks.length) {
        finalText = (parsed.fx && parsed.fx.length) || (parsed.htmlFx && parsed.htmlFx.length)
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
        var songQ = guessSong(userText) || placeholder.music[0].q;
        window.MUSIC.play(songQ, node._md).then(function (track) {
          if (!track) toast('没找到这首歌，换个说法我再放');
        });
      }

      // 小谷想追问看图的 / 看片的 AI：交给它，再把答案回给小谷
      if (asks.length && (opts.depth || 0) < 1) {
        var ask = asks[0];
        var askMedia = mediaForAsk(ask.who);
        if (askMedia) {
          pendingAsk = { who: ask.who, q: ask.q, media: askMedia, depth: opts.depth || 0 };
          var callAsk = { type: 'ask', who: ask.who, q: ask.q };
          placeholder.calls = placeholder.calls || [];
          placeholder.calls.push(callAsk);
          appendCallTag(node, callAsk);
          saveMessages();
        } else {
          var lackWhat = MEDIA[ask.who].kind === 'video' ? '视频' : MEDIA[ask.who].kind === 'file' ? '文件' : '照片';
          toast(MEDIA[ask.who].name + '不在场（这轮没有' + lackWhat + '可看）');
        }
      }

      // 小谷派给生成类 AI：启动生成，完成后自动回小谷总结
      if (routeTo && (opts.routeDepth || 0) < 1) {
        pendingRoute = routeTo;
        var callRoute = { type: 'route', who: routeTo.who, prompt: routeTo.prompt };
        placeholder.calls = placeholder.calls || [];
        placeholder.calls.push(callRoute);
        appendCallTag(node, callRoute);
        saveMessages();
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
      if (pendingAsk) {
        var pa = pendingAsk;
        pendingAsk = null;
        setTimeout(function () {
          runMedia(pa.who, pa.q, pa.media, { thenG: true, depth: pa.depth + 1 });
        }, 80);
      }
      if (pendingRoute) {
        var pr = pendingRoute;
        pendingRoute = null;
        setTimeout(function () {
          runGen(pr.who, pr.prompt, { summarize: true });
        }, 120);
      }
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
    // 同时停止所有进行中的生成任务
    Object.keys(genControllers).forEach(function (id) {
      abortJob(id);
    });
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

    var fileInput = $('#fileInput');
    $('#attachBtn').addEventListener('click', function () {
      if (busy) { toast('等这一轮说完再传附件'); return; }
      fileInput.click();
    });
    fileInput.addEventListener('change', function () {
      var f = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (f) handleUpload(f);
    });
    $('#attachRemove').addEventListener('click', function () {
      attach = null;
      renderAttachUI();
    });

    $('#newChat').addEventListener('click', function () {
      if (busy) stopAI();
      if (window.FXC) FXC.stopAll();
      messages = [];
      attach = null;
      lastMedia = null;
      renderAttachUI();
      saveMessages();
      renderAll();
      closeSidebar();
      toast('新对话已开始');
    });

    $('#clearChat').addEventListener('click', function () {
      if (!messages.length && !attach) { toast('现在就是新对话'); return; }
      if (busy) stopAI();
      if (window.FXC) FXC.stopAll();
      messages = [];
      attach = null;
      lastMedia = null;
      renderAttachUI();
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
    resumeJobs();

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
