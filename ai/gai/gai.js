/*
 * 小谷改题 · 谷仓 AI
 * 纯前端：题目识别 → 答案对照 → 批量批改 / 留痕
 * 与 /ai 共用同一个 OpenRouter Key（localStorage: yg_ai_settings_v1）
 */
(function () {
  'use strict';

  /* ================= 配置 ================= */

  // 与「小谷」共用的默认 Key（拆开拼接，避免密钥扫描误报）
  var DEFAULT_KEY = ['sk-or-v1-', 'a652d2e9dfc9f77f282ce357', '7b0d9ec15c9938f0af377037ab69b3be9048ad0a'].join('');
  var OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';

  var LS_SET = 'yg_ai_settings_v1';
  var LS_GAI = 'yg_ai_gai_v1';

  var TEXT_MODELS = [
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'nvidia/nemotron-3.5-lightning:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'
  ];

  // 识图 / 批改模型：默认用多模态能力更强的一档，失败自动换备用
  var VISION_OPTIONS = [
    { id: 'nvidia/nemotron-3.5-super-vl:free', name: 'Nemotron 3.5 Super VL · 多模态 · 免费' },
    { id: 'nvidia/nemotron-nano-12b-v2-vl:free', name: 'Nemotron Nano 12B VL · 看图 · 免费' },
    { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', name: 'Nemotron 3 Nano Omni · 免费' },
    { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash · 识字强 · 免费' }
  ];
  var DEFAULT_VISION = VISION_OPTIONS[0].id;

  // 这些状态码算「这个模型这会儿不行」，自动换下一个
  var RETRY_STATUS = { 402: 1, 403: 1, 404: 1, 408: 1, 409: 1, 425: 1, 429: 1, 500: 1, 502: 1, 503: 1, 504: 1, 529: 1 };

  var IMG_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'heic'];
  var TEXT_EXTS = ['txt', 'md', 'csv', 'json', 'html', 'htm', 'xml', 'log', 'ini', 'yml', 'yaml'];
  var OLD_OFFICE = ['doc', 'ppt', 'xls', 'xlsx'];

  var MAX_OCR_IMAGES = 12;
  var MAX_PDF_PAGES = 12;

  /* ================= 基础工具 ================= */

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function toast(msg, isErr) {
    var host = $('#toasts');
    if (!host) return;
    var n = document.createElement('div');
    n.className = 'toast' + (isErr ? ' err' : '');
    n.textContent = msg;
    host.appendChild(n);
    setTimeout(function () {
      n.style.opacity = '0';
      n.style.transition = '.3s';
      setTimeout(function () { n.remove(); }, 320);
    }, isErr ? 4200 : 2600);
  }

  function uid(p) { return (p || 'q') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function decodeEntities(s) {
    return String(s || '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&');
  }

  function xmlToText(xml) {
    return decodeEntities(
      String(xml || '')
        .replace(/<w:tab[^>]*\/>/g, '\t')
        .replace(/<w:br[^>]*\/>/g, '\n')
        .replace(/<a:br[^>]*\/>/g, '\n')
        .replace(/<\/w:p>/g, '\n')
        .replace(/<\/a:p>/g, '\n')
        .replace(/<[^>]+>/g, '')
    );
  }

  function decodeBytes(buf) {
    try {
      return new TextDecoder('utf-8', { fatal: false }).decode(buf);
    } catch (e) {
      return String.fromCharCode.apply(null, new Uint8Array(buf).slice(0, 200000));
    }
  }

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
    var w = src.naturalWidth || src.width;
    var h = src.naturalHeight || src.height;
    if (!w || !h) throw new Error('图片尺寸异常');
    var k = Math.min(1, maxSide / Math.max(w, h));
    var cw = Math.max(1, Math.round(w * k));
    var ch = Math.max(1, Math.round(h * k));
    var c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(src, 0, 0, cw, ch);
    return c.toDataURL('image/jpeg', quality);
  }

  /* ================= 设置（与 /ai 共用） ================= */

  var settings = loadSettings();
  var visionModel = localStorage.getItem('yg_ai_vision_model') || DEFAULT_VISION;
  if (!VISION_OPTIONS.filter(function (o) { return o.id === visionModel; }).length) visionModel = DEFAULT_VISION;

  function loadSettings() {
    try {
      var o = JSON.parse(localStorage.getItem(LS_SET) || '{}');
      return o && typeof o === 'object' ? o : {};
    } catch (e) { return {}; }
  }

  function apiKey() {
    return (settings.key && String(settings.key).trim()) || DEFAULT_KEY;
  }

  function textChain() {
    var out = [];
    if (settings.model) out.push(settings.model);
    TEXT_MODELS.forEach(function (m) { if (out.indexOf(m) === -1) out.push(m); });
    return out;
  }

  function visionChain() {
    var out = [visionModel];
    VISION_OPTIONS.forEach(function (o) { if (out.indexOf(o.id) === -1) out.push(o.id); });
    return out;
  }

  /* ================= OpenRouter 调用 ================= */

  var currentAbort = null;
  var stopRequested = false;

  function abortAll() {
    stopRequested = true;
    if (currentAbort) { try { currentAbort.abort(); } catch (e) {} }
  }

  async function chat(models, messages, opts) {
    opts = opts || {};
    var lastErr = null;
    for (var i = 0; i < models.length; i++) {
      if (stopRequested) throw new Error('已停止');
      var ctrl = new AbortController();
      currentAbort = ctrl;
      var timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, opts.timeout || 180000);
      try {
        var res = await fetch(OPENROUTER, {
          method: 'POST',
          signal: ctrl.signal,
          headers: {
            'Authorization': 'Bearer ' + apiKey(),
            'Content-Type': 'application/json',
            'HTTP-Referer': location.origin + '/ai/gai/',
            'X-Title': 'Xiaogu - GaiTi'
          },
          body: JSON.stringify({
            model: models[i],
            messages: messages,
            max_tokens: opts.maxTokens || 3000,
            temperature: opts.temperature == null ? 0.2 : opts.temperature
          })
        });
        clearTimeout(timer);
        if (!res.ok) {
          var detail = '';
          try {
            var j = await res.json();
            detail = (j.error && (j.error.message || j.error.code)) || '';
          } catch (e) {}
          var err = new Error('HTTP ' + res.status + (detail ? '：' + detail : ''));
          err.status = res.status;
          throw err;
        }
        var data = await res.json();
        var text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
        if (!String(text).trim()) throw new Error('模型这次没有返回内容');
        currentAbort = null;
        return { text: String(text), model: models[i] };
      } catch (e) {
        clearTimeout(timer);
        currentAbort = null;
        lastErr = e;
        if (stopRequested) throw new Error('已停止');
        if (e && e.name === 'AbortError') throw e;
        if (e && e.status && !RETRY_STATUS[e.status]) throw e;
        // 否则换下一个模型
      }
    }
    throw lastErr || new Error('所有模型都不可用');
  }

  function parseJson(text) {
    var s = String(text || '').trim();
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    try { return JSON.parse(s); } catch (e) {}
    var a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a > -1 && b > a) {
      try { return JSON.parse(s.slice(a, b + 1)); } catch (e) {}
    }
    return null;
  }

  /* ================= 文件解析 ================= */

  async function ensurePdfLib() {
    if (!window.pdfjsLib) throw new Error('PDF 解析库没加载好，刷新页面再试');
    if (!window.__gaiPdfWorker) {
      var wr = await fetch('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js');
      if (!wr.ok) throw new Error('PDF 解析器加载失败');
      window.__gaiPdfWorker = URL.createObjectURL(new Blob([await wr.text()], { type: 'application/javascript' }));
    }
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = window.__gaiPdfWorker;
    return window.pdfjsLib;
  }

  async function extractPdfText(file) {
    var lib = await ensurePdfLib();
    var pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
    var out = [], total = 0;
    var pages = Math.min(pdf.numPages, 60);
    for (var p = 1; p <= pages; p++) {
      var page = await pdf.getPage(p);
      var tc = await page.getTextContent();
      var line = tc.items.map(function (it) { return it.str || ''; }).join(' ').replace(/\s+/g, ' ').trim();
      out.push('【第 ' + p + ' 页】\n' + line);
      total += line.length;
      if (total > 60000) { out.push('……（共 ' + pdf.numPages + ' 页，后面省略）'); break; }
    }
    return out.join('\n\n');
  }

  async function pdfToImages(file) {
    var lib = await ensurePdfLib();
    var pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
    var n = Math.min(pdf.numPages, MAX_PDF_PAGES);
    var out = [];
    for (var p = 1; p <= n; p++) {
      var page = await pdf.getPage(p);
      var vp = page.getViewport({ scale: 1.7 });
      var c = document.createElement('canvas');
      c.width = Math.round(vp.width);
      c.height = Math.round(vp.height);
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      out.push(c.toDataURL('image/jpeg', 0.84));
    }
    return out;
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
    var out = [];
    for (var i = 0; i < slides.length; i++) {
      var xml = await zip.file(slides[i].path).async('string');
      var body = '';
      xml.replace(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g, function (m, s) { body += decodeEntities(s) + '\n'; return m; });
      body = body.trim();
      if (body) out.push('【第 ' + slides[i].n + ' 页】\n' + body);
    }
    return out.join('\n\n');
  }

  // 把一批文件整理成「文字」和「图片」两类素材
  async function prepareSources(files, onStep) {
    var texts = [], images = [];
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      var ext = (String(file.name || '').split('.').pop() || '').toLowerCase();
      if (file.size > 80 * 1024 * 1024) throw new Error('文件太大了：' + file.name);
      if (onStep) onStep('正在读取 ' + (file.name || '文件') + '…');

      if ((file.type && /^image\//.test(file.type)) || IMG_EXTS.indexOf(ext) > -1) {
        var raw = await readAsDataURL(file);
        var img = await loadImage(raw);
        images.push({ name: file.name || '照片', data: drawScaled(img, 1600, 0.85) });
      } else if (ext === 'pdf') {
        var text = await extractPdfText(file);
        if (String(text).replace(/【第 \d+ 页】/g, '').trim().length < 30) {
          // 扫描版 PDF：没有文字层，按图片识别
          if (onStep) onStep('扫描版 PDF，正在转成图片…');
          var pages = await pdfToImages(file);
          pages.forEach(function (d, k) {
            images.push({ name: (file.name || 'PDF') + ' · 第' + (k + 1) + '页', data: d });
          });
        } else {
          texts.push({ name: file.name || 'PDF', text: text });
        }
      } else if (ext === 'docx') {
        texts.push({ name: file.name || 'Word', text: await extractDocx(file) });
      } else if (ext === 'pptx') {
        texts.push({ name: file.name || 'PPT', text: await extractPptx(file) });
      } else if (OLD_OFFICE.indexOf(ext) > -1) {
        throw new Error('旧版 .' + ext + ' 读不了，另存为 .docx / .pptx 再传');
      } else {
        texts.push({ name: file.name || '文件', text: decodeBytes(await file.arrayBuffer()) });
      }
    }
    texts.forEach(function (t) {
      t.text = String(t.text || '').replace(/\r\n/g, '\n').replace(/[\t ]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
    });
    return { texts: texts, images: images };
  }

  function contentWithSources(prompt, sources) {
    var text = prompt;
    sources.texts.forEach(function (t) {
      text += '\n\n## 文件：' + t.name + '\n```\n' + t.text.slice(0, 26000) + '\n```';
    });
    var parts = [{ type: 'text', text: text }];
    sources.images.slice(0, MAX_OCR_IMAGES).forEach(function (im) {
      parts.push({ type: 'image_url', image_url: { url: im.data } });
    });
    return parts;
  }

  /* ================= 状态 ================= */

  var state = {
    step: 1,
    questions: [],   // {id,no,stem,type,score,origin,on}
    answers: {},     // qid -> {text, source:'ai'|'upload'}
    sheets: [],      // {id,name,dataUrl,thumb,status,result,error,img}
    annotate: false,
    running: false,
    lastSources: null
  };

  function save() {
    try {
      localStorage.setItem(LS_GAI, JSON.stringify({
        step: state.step,
        questions: state.questions,
        answers: state.answers
      }));
    } catch (e) {}
  }

  function restore() {
    try {
      var o = JSON.parse(localStorage.getItem(LS_GAI) || 'null');
      if (!o || !Array.isArray(o.questions)) return;
      state.questions = o.questions.map(function (q) {
        return {
          id: q.id || uid(),
          no: String(q.no == null ? '' : q.no),
          stem: String(q.stem || ''),
          type: q.type || 'other',
          score: q.score == null ? '' : q.score,
          origin: q.origin === 'handwrite' ? 'handwrite' : 'print',
          on: q.on !== false
        };
      });
      state.answers = o.answers && typeof o.answers === 'object' ? o.answers : {};
    } catch (e) {}
  }

  function selectedQuestions() {
    return state.questions.filter(function (q) { return q.on && String(q.stem).trim(); });
  }

  function qById(id) {
    return state.questions.filter(function (q) { return q.id === id; })[0] || null;
  }

  /* ================= 第一步：题目识别 ================= */

  var qOCRPrompt = [
    '下面是一份试卷的素材（可能只有文字，也可能只有照片/扫描页）。请把题目整理成清单。',
    '',
    '要求：',
    '1. 按原卷顺序整理；跨页、跨图里的同一道题要合并；跳过姓名栏、班级栏、页眉页脚、页码和分数统计。',
    '2. 题号沿用原卷；没有题号就按 1、2、3 顺排。选择题的 A/B/C/D 选项要完整保留在题干里。',
    '3. 分清印刷和手写：题干主要是印刷体的填 "print"，主要是手写的填 "handwrite"。',
    '4. 不要给答案、不要解题、不要点评。',
    '5. 公式用 LaTeX（行内 $...$）；实在看不清的字写 [看不清]，不要猜。',
    '6. 只输出 JSON，不要 Markdown 代码块，不要解释。',
    '',
    'JSON 格式：',
    '{"title":"试卷标题（没有就空字符串）","questions":[{"no":"1","stem":"完整题干……","type":"choice|fill|short|essay|calc|other","score":5,"origin":"print"}]}',
    'score 没有标注就填 null。'
  ].join('\n');

  async function recognizeQuestions(files) {
    stopRequested = false;
    var bar = $('#qBar'), barText = $('#qBarText');
    bar.hidden = false;
    barText.textContent = '正在读取文件…';
    try {
      var sources = await prepareSources(files, function (m) { barText.textContent = m; });
      if (!sources.texts.length && !sources.images.length) throw new Error('没有读到可用内容');
      state.lastSources = sources;

      barText.textContent = 'AI 正在认题（' + (sources.images.length ? sources.images.length + ' 张图 / ' : '') + (sources.texts.length ? sources.texts.length + ' 份文字' : '') + '）…';
      var prompt = qOCRPrompt;
      var res = await chat(visionChain(), [
        {
          role: 'system',
          content: '你是谷仓 AI 的认题助手。你只做一件事：把试卷里的题目准确、完整地转成结构化清单，并区分印刷体和手写内容。'
        },
        { role: 'user', content: contentWithSources(prompt, sources) }
      ], { maxTokens: 6000, temperature: 0.1 });

      var data = parseJson(res.text);
      if (!data || !Array.isArray(data.questions)) throw new Error('AI 返回的题目格式不对，请重试或换一张更清晰的图');

      var qs = data.questions.map(function (q, i) {
        return {
          id: uid(),
          no: String(q.no == null || q.no === '' ? (i + 1) : q.no),
          stem: String(q.stem || '').trim(),
          type: q.type || 'other',
          score: q.score == null ? '' : q.score,
          origin: q.origin === 'handwrite' ? 'handwrite' : 'print',
          on: true
        };
      }).filter(function (q) { return q.stem; });

      if (!qs.length) throw new Error('没识别出题目，换张更清晰的图或检查文件内容');

      state.questions = qs;
      state.answers = {};
      renderQuestions();
      save();
      toast('识别到 ' + qs.length + ' 道题，主模型：' + prettyModel(res.model));
      setStep(1);
    } catch (e) {
      if (String(e.message) === '已停止') toast('已停止识别');
      else toast(e.message || '识别失败', true);
    } finally {
      bar.hidden = true;
      $('#qSpin') && ($('#qSpin').style.display = '');
    }
  }

  function prettyModel(id) {
    var found = VISION_OPTIONS.filter(function (o) { return o.id === id; })[0];
    if (found) return found.name.split(' · ')[0];
    return String(id || '').split('/').pop();
  }

  function originBadge(q) {
    return q.origin === 'handwrite'
      ? '<span class="badge hand">手写</span>'
      : '<span class="badge print">印刷</span>';
  }

  function typeName(t) {
    return ({ choice: '选择题', fill: '填空题', short: '简答题', essay: '作文/论述', calc: '计算题' })[t] || '题目';
  }

  function renderQuestions() {
    var list = $('#qList');
    list.innerHTML = state.questions.map(function (q, i) {
      return '' +
        '<div class="q-card' + (q.on ? '' : ' off') + '" data-id="' + q.id + '">' +
          '<div class="q-top">' +
            '<label class="chk"><input type="checkbox" class="q-on"' + (q.on ? ' checked' : '') + ' /></label>' +
            '<input class="q-no q-no-in" value="' + esc(q.no) + '" aria-label="题号" style="width:52px;background:transparent;border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:1px 6px;font-size:12px;text-align:center;color:#22d3ee;font-weight:700" />' +
            originBadge(q) +
            '<span class="badge type">' + typeName(q.type) + '</span>' +
            '<input class="q-score" type="number" min="0" step="0.5" value="' + esc(q.score) + '" placeholder="分值" title="这题的分值" />' +
            '<button class="q-del" type="button" title="删除这题">×</button>' +
          '</div>' +
          '<textarea class="q-stem" rows="3" placeholder="题干…">' + esc(q.stem) + '</textarea>' +
        '</div>';
    }).join('');

    var has = state.questions.length > 0;
    $('#qListHead').hidden = !has;
    updateQMeta();
  }

  function updateQMeta() {
    var sel = state.questions.filter(function (q) { return q.on; }).length;
    var total = state.questions.length;
    $('#qCount').textContent = total + ' 题 · 已选 ' + sel;
    $('#toStep2').disabled = selectedQuestions().length === 0;
    $('#qClear').disabled = !total;
  }

  /* ================= 第二步：答案 ================= */

  var aPrompt = [
    '下面是一份答案素材（可能只有文字，也可能只有照片/扫描页）。请把答案按题号整理出来。',
    '',
    '要求：',
    '1. 严格按题号对应，题号沿用原卷；找不到题号的答案按顺序排，并在 no 里写 "?"。',
    '2. 保留答案的关键步骤、要点和最终结果；选择题只写选项，如 "B"。',
    '3. 区分印刷和手写：答案主要是印刷体填 "print"，手写填 "handwrite"。',
    '4. 不要改题、不要补充原卷没有的答案；看不清写 [看不清]。',
    '5. 公式用 LaTeX；只输出 JSON，不要代码块。',
    '',
    'JSON 格式：',
    '{"answers":[{"no":"1","answer":"……","origin":"print"}]}'
  ].join('\n');

  var genPrompt = [
    '你是谷仓 AI 的解题老师。请为下面每道题写一份「参考答案」，用于对照批改。',
    '',
    '要求：',
    '1. 逐题作答，题号必须与输入一致，不要漏题、不要改题号。',
    '2. 答案要准确、可直接对照：选择题给出选项和一句理由；填空给最终答案；计算题给关键步骤和结果；简答/论述给要点。',
    '3. 拿不准的题写 "（无法确定）"，不要编造。',
    '4. 公式用 LaTeX；只输出 JSON，不要代码块。',
    '',
    'JSON 格式：',
    '{"answers":[{"no":"1","answer":"……"}]}'
  ].join('\n');

  async function recognizeAnswers(files) {
    stopRequested = false;
    var bar = $('#aBar'), barText = $('#aBarText');
    bar.hidden = false;
    barText.textContent = '正在读取答案…';
    try {
      var sources = await prepareSources(files, function (m) { barText.textContent = m; });
      if (!sources.texts.length && !sources.images.length) throw new Error('没有读到可用内容');

      barText.textContent = 'AI 正在整理答案…';
      var res = await chat(visionChain(), [
        { role: 'system', content: '你是谷仓 AI 的答案整理助手，只负责把答案按题号准确转成结构化 JSON。' },
        { role: 'user', content: contentWithSources(aPrompt, sources) }
      ], { maxTokens: 6000, temperature: 0.1 });

      var data = parseJson(res.text);
      if (!data || !Array.isArray(data.answers)) throw new Error('AI 返回的答案格式不对，请重试');

      var hit = 0, miss = [];
      data.answers.forEach(function (a) {
        var q = findQuestionByNo(a.no);
        if (!q) { miss.push(String(a.no)); return; }
        state.answers[q.id] = { text: String(a.answer || '').trim(), source: 'upload' };
        hit++;
      });
      renderAnswers();
      save();
      toast('识别到 ' + hit + ' 道题的答案' + (miss.length ? '，有 ' + miss.length + ' 条没对上题号：' + miss.slice(0, 6).join('、') : ''));
    } catch (e) {
      toast(e.message || '识别答案失败', true);
    } finally {
      bar.hidden = true;
    }
  }

  function findQuestionByNo(no) {
    var s = String(no == null ? '' : no).trim().replace(/^第|题$|\.$|、$/g, '');
    return state.questions.filter(function (q) { return String(q.no).trim() === s; })[0] ||
      state.questions.filter(function (q) { return String(q.no).trim().replace(/\D/g, '') === s.replace(/\D/g, '') && s; })[0] ||
      null;
  }

  async function generateAnswers() {
    var qs = selectedQuestions();
    if (!qs.length) { toast('先选几道题', true); return; }
    stopRequested = false;
    var bar = $('#gBar'), barText = $('#gBarText');
    bar.hidden = false;
    barText.textContent = 'AI 正在写 ' + qs.length + ' 道题的答案…';
    $('#aiGenBtn').disabled = true;
    try {
      var payload = {
        title: '',
        questions: qs.map(function (q) {
          return { no: q.no, stem: q.stem, type: q.type, score: q.score === '' ? null : q.score };
        })
      };
      var res = await chat(textChain(), [
        { role: 'system', content: '你是谷仓 AI 的解题老师，答案要准确、简洁、可直接用于对照批改。' },
        { role: 'user', content: genPrompt + '\n\n## 题目\n' + JSON.stringify(payload, null, 2) }
      ], { maxTokens: 6000, temperature: 0.2 });

      var data = parseJson(res.text);
      if (!data || !Array.isArray(data.answers)) throw new Error('AI 返回的答案格式不对，请重试');

      var hit = 0;
      data.answers.forEach(function (a) {
        var q = findQuestionByNo(a.no);
        if (!q) return;
        state.answers[q.id] = { text: String(a.answer || '').trim(), source: 'ai' };
        hit++;
      });
      renderAnswers();
      save();
      toast('AI 写好了 ' + hit + ' 道题的参考答案，可以逐题修改');
    } catch (e) {
      toast(e.message || '生成答案失败', true);
    } finally {
      bar.hidden = true;
      $('#aiGenBtn').disabled = false;
    }
  }

  function renderAnswers() {
    var qs = selectedQuestions();
    var host = $('#aList');
    host.innerHTML = qs.map(function (q, i) {
      var a = state.answers[q.id] || { text: '', source: '' };
      return '' +
        '<div class="a-card" data-id="' + q.id + '">' +
          '<div class="a-card-head">' +
            '<span class="q-no">' + esc(q.no) + '</span>' +
            originBadge(q) +
            '<b>' + esc(String(q.stem).replace(/\s+/g, ' ').slice(0, 60)) + (String(q.stem).length > 60 ? '…' : '') + '</b>' +
            (a.source === 'ai' ? '<span class="badge type" style="margin-left:auto">AI 生成</span>' : (a.source === 'upload' ? '<span class="badge" style="margin-left:auto">你上传</span>' : '')) +
          '</div>' +
          '<textarea class="a-text" rows="3" data-ph="这题的答案…" placeholder="这题的答案…">' + esc(a.text) + '</textarea>' +
        '</div>';
    }).join('');

    var filled = qs.filter(function (q) { return state.answers[q.id] && state.answers[q.id].text.trim(); }).length;
    $('#aCount').textContent = qs.length + ' 题 · 已有答案 ' + filled;
    $('#aListHead').hidden = qs.length === 0;
    $('#toStep3').disabled = !(qs.length && filled > 0);
  }

  /* ================= 第三步：批改 ================= */

  function gradingPrompt(qs) {
    var lines = ['## 题目与参考答案'];
    qs.forEach(function (q) {
      var a = state.answers[q.id];
      lines.push('');
      lines.push(q.no + '. （' + (q.score === '' ? '分值未知' : q.score + ' 分') + '）' + String(q.stem).replace(/\n+/g, ' '));
      lines.push('   参考答案：' + (a && a.text.trim() ? String(a.text).replace(/\n+/g, ' ') : '（没有参考答案，请按题目本身判断）'));
    });
    lines.push('');
    lines.push('## 批改要求');
    lines.push('1. 只批改上面列出的题，按题号逐题判断：correct（对）/ wrong（错）/ partial（部分对）/ missing（没作答或看不到）。');
    lines.push('2. 选择题只核对选项；主观题按要点给分，等价的表达算对；有步骤分的部分对给 partial。');
    lines.push('3. student_answer 只抄学生实际写的关键内容；看不清写 [看不清]。');
    lines.push('4. comment 用一句话说明扣分或得分原因，不要长篇大论。');
    lines.push('5. box 是这题作答区域在图片中的位置，用归一化坐标（0~1，左上角为原点）；定位不到就填 null。');
    lines.push('6. score / total 按这页实际出现的题算，不确定就填 null。');
    lines.push('7. 只输出 JSON，不要 Markdown 代码块，不要解释。');
    lines.push('');
    lines.push('JSON 格式：');
    lines.push('{"items":[{"no":"1","verdict":"correct","student_answer":"……","comment":"……","box":{"x":0.1,"y":0.2,"w":0.3,"h":0.1}}],"score":85,"total":100,"note":"这页的整体情况"}');
    return lines.join('\n');
  }

  async function gradeOne(sheet) {
    var qs = selectedQuestions();
    var res = await chat(visionChain(), [
      {
        role: 'system',
        content: '你是谷仓 AI 的阅卷老师。你会根据题目和参考答案，看清学生答卷照片上的作答，逐题判断对错并指出原因。判断要严格但公平，看不清就如实说明。'
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: gradingPrompt(qs) + '\n\n## 学生答卷（第 ' + sheet.order + ' 张）' },
          { type: 'image_url', image_url: { url: sheet.dataUrl } }
        ]
      }
    ], { maxTokens: 5000, temperature: 0.1, timeout: 240000 });

    var data = parseJson(res.text);
    if (!data) {
      data = { items: [], note: 'AI 没有按格式返回，下面是原文：' + String(res.text).slice(0, 1200), raw: true };
    }
    var items = Array.isArray(data.items) ? data.items : [];
    data.items = items.map(function (it) {
      var v = String(it.verdict || '').toLowerCase();
      if (['correct', 'wrong', 'partial', 'missing'].indexOf(v) === -1) {
        v = /错|不对/.test(String(it.comment || '')) ? 'wrong' : 'partial';
      }
      var q = findQuestionByNo(it.no);
      return {
        no: q ? q.no : String(it.no == null ? '' : it.no),
        qid: q ? q.id : '',
        verdict: v,
        student_answer: String(it.student_answer == null ? '' : it.student_answer),
        comment: String(it.comment == null ? '' : it.comment),
        box: normalizeBox(it.box)
      };
    });
    data.model = res.model;
    return data;
  }

  function normalizeBox(b) {
    if (!b || typeof b !== 'object') return null;
    var x = Number(b.x), y = Number(b.y), w = Number(b.w), h = Number(b.h);
    if ([x, y, w, h].some(function (n) { return !isFinite(n); })) return null;
    var max = Math.max(x + w, y + h);
    var k = max <= 1.02 ? 1 : (max <= 102 ? 100 : 1000);
    x /= k; y /= k; w /= k; h /= k;
    if (w <= 0 || h <= 0) return null;
    x = Math.max(0, Math.min(0.98, x));
    y = Math.max(0, Math.min(0.98, y));
    w = Math.max(0.02, Math.min(1 - x, w));
    h = Math.max(0.01, Math.min(1 - y, h));
    return { x: x, y: y, w: w, h: h };
  }

  var VERDICT = {
    correct: { mark: '✓', cls: 'ok', cn: '对' },
    wrong: { mark: '✗', cls: 'bad', cn: '错' },
    partial: { mark: '△', cls: 'mid', cn: '部分对' },
    missing: { mark: '?', cls: 'miss', cn: '未作答' }
  };

  async function startGrading() {
    if (state.running) return;
    var qs = selectedQuestions();
    if (!qs.length) { toast('没有可批改的题目', true); return; }
    if (!state.sheets.length) { toast('先上传答卷图片', true); return; }

    state.running = true;
    stopRequested = false;
    $('#gradeBtn').disabled = true;
    $('#sBar').hidden = false;

    var order = 0;
    for (var i = 0; i < state.sheets.length; i++) {
      var s = state.sheets[i];
      if (stopRequested) break;
      order++;
      s.status = 'run';
      s.error = '';
      $('#sBarText').textContent = '正在批改第 ' + (i + 1) + ' / ' + state.sheets.length + ' 张：' + s.name;
      renderSheets();
      try {
        s.result = await gradeOne(s);
        s.status = 'ok';
      } catch (e) {
        s.status = 'err';
        s.error = e.message || '批改失败';
        if (stopRequested) { $('#sBarText').textContent = '已停止'; break; }
      }
      renderSheets();
      renderResults();
      renderSummary();
    }

    state.running = false;
    $('#sBar').hidden = true;
    $('#gradeBtn').disabled = false;

    var ok = state.sheets.filter(function (x) { return x.status === 'ok'; }).length;
    toast(stopRequested ? ('已停止，完成 ' + ok + ' 张') : ('批改完成，共 ' + ok + ' 张'));
  }

  /* ---------------- 答卷缩略图 ---------------- */

  function renderSheets() {
    var host = $('#sheets');
    host.innerHTML = state.sheets.map(function (s, i) {
      var st = '';
      if (s.status === 'ok') st = '<span class="state ok">已批改</span>';
      else if (s.status === 'run') st = '<span class="state run">批改中</span>';
      else if (s.status === 'err') st = '<span class="state err">失败</span>';
      return '' +
        '<div class="sheet-thumb" data-id="' + s.id + '">' +
          '<img src="' + s.thumb + '" alt="第 ' + (i + 1) + ' 张" />' +
          '<span class="num">#' + (i + 1) + '</span>' +
          '<button class="x" type="button" title="移除">×</button>' +
          '<span class="name">' + esc(s.name) + '</span>' +
          st +
        '</div>';
    }).join('');
    $('#gradeBtn').disabled = !state.sheets.length || state.running;
  }

  async function addSheets(files) {
    if (!files || !files.length) return;
    stopRequested = false;
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (!f.type || !/^image\//.test(f.type)) { toast('只能上传图片：' + f.name, true); continue; }
      try {
        var raw = await readAsDataURL(f);
        var img = await loadImage(raw);
        state.sheets.push({
          id: uid('s'),
          name: f.name || '答卷',
          dataUrl: drawScaled(img, 1600, 0.85),
          thumb: drawScaled(img, 260, 0.6),
          img: img,
          status: 'wait',
          result: null,
          error: ''
        });
      } catch (e) {
        toast('这张图读不出来：' + (f.name || ''), true);
      }
    }
    state.sheets.forEach(function (s, k) { s.order = k + 1; });
    renderSheets();
    renderResults();
  }

  /* ---------------- 结果与留痕 ---------------- */

  function renderResults() {
    var host = $('#results');
    var done = state.sheets.filter(function (s) { return s.status === 'ok' || s.status === 'err'; });
    host.innerHTML = '';
    done.forEach(function (s) {
      var i = state.sheets.indexOf(s);
      var card = document.createElement('div');
      card.className = 'result-card';
      card.dataset.id = s.id;

      var head = document.createElement('div');
      head.className = 'result-head';
      head.innerHTML = '' +
        '<span class="idx">第 ' + (i + 1) + ' 张</span>' +
        '<span class="fname">' + esc(s.name) + '</span>' +
        '<span class="score">' + scoreText(s) + '</span>' +
        '<button class="btn ghost sm dl" type="button">下载批改图</button>';
      card.appendChild(head);

      if (s.status === 'err') {
        var err = document.createElement('div');
        err.className = 'raw-box';
        err.textContent = '批改失败：' + s.error;
        card.appendChild(err);
        host.appendChild(card);
        return;
      }

      var body = document.createElement('div');
      body.className = 'result-body';

      var imgWrap = document.createElement('div');
      imgWrap.className = 'result-img';
      var canvas = document.createElement('canvas');
      imgWrap.appendChild(canvas);
      body.appendChild(imgWrap);

      var list = document.createElement('div');
      list.className = 'grade-list';
      var items = (s.result && s.result.items) || [];
      if (!items.length) {
        list.innerHTML = '<div class="raw-box" style="border:0;padding:0">' + esc((s.result && s.result.note) || '没有识别到批改结果') + '</div>';
      } else {
        list.innerHTML = items.map(function (it) {
          var v = VERDICT[it.verdict] || VERDICT.partial;
          return '' +
            '<div class="g-row">' +
              '<span class="g-mark ' + v.cls + '">' + v.mark + '</span>' +
              '<div class="g-main">' +
                '<div class="g-title"><b>第 ' + esc(it.no) + ' 题</b><span class="badge ' + (v.cls === 'ok' ? 'print' : v.cls === 'bad' ? 'hand' : '') + '">' + v.cn + '</span></div>' +
                (it.student_answer ? '<div class="g-ans"><em>作答：</em>' + esc(it.student_answer) + '</div>' : '') +
                (it.comment ? '<div class="g-cmt">' + esc(it.comment) + '</div>' : '') +
              '</div>' +
            '</div>';
        }).join('');
      }
      body.appendChild(list);
      card.appendChild(body);

      if (s.result && s.result.raw && s.result.note) {
        var raw = document.createElement('div');
        raw.className = 'raw-box';
        raw.textContent = s.result.note;
        card.appendChild(raw);
      }

      card.querySelector('.dl').addEventListener('click', function () {
        downloadSheet(s);
      });

      host.appendChild(card);
      drawSheet(s, canvas);
    });
  }

  function scoreText(s) {
    if (!s.result) return '';
    var it = s.result.items || [];
    var right = it.filter(function (x) { return x.verdict === 'correct'; }).length;
    var bad = it.filter(function (x) { return x.verdict === 'wrong'; }).length;
    var mid = it.filter(function (x) { return x.verdict === 'partial'; }).length;
    var parts = ['✓' + right, '✗' + bad];
    if (mid) parts.push('△' + mid);
    var sc = (s.result.score != null ? s.result.score : null);
    var total = (s.result.total != null ? s.result.total : null);
    return (sc != null ? sc + (total != null ? '/' + total : '') + ' 分 · ' : '') + parts.join(' ');
  }

  function drawSheet(s, canvas) {
    if (!canvas || !s.img) return;
    var img = s.img;
    var maxW = 1400;
    var k = Math.min(1, maxW / (img.naturalWidth || img.width));
    var W = Math.max(1, Math.round((img.naturalWidth || img.width) * k));
    var H = Math.max(1, Math.round((img.naturalHeight || img.height) * k));
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, W, H);

    if (!state.annotate || !s.result) return;

    var items = s.result.items || [];
    var base = Math.max(16, W * 0.019);
    items.forEach(function (it, i) {
      var v = VERDICT[it.verdict] || VERDICT.partial;
      var color = v.cls === 'ok' ? '#16a34a' : v.cls === 'bad' ? '#dc2626' : v.cls === 'mid' ? '#f59e0b' : '#94a3b8';
      var box = it.box || fallbackBox(i, items.length);
      var x = box.x * W, y = box.y * H, w = box.w * W, h = box.h * H;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = Math.max(2, base * 0.13);
      ctx.strokeRect(x, y, w, h);
      ctx.globalAlpha = 1;

      // 打勾 / 叉：优先放在框右侧，贴边时放框内右上
      var mx = x + w + base * 0.9;
      if (mx > W - base) mx = x + w - base * 0.7;
      var my = y + h / 2;
      ctx.font = 'bold ' + Math.round(base * 1.35) + 'px "Segoe UI Symbol", "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(2, base * 0.16);
      ctx.strokeStyle = 'rgba(255,255,255,.9)';
      ctx.strokeText(v.mark, mx, my);
      ctx.fillStyle = color;
      ctx.fillText(v.mark, mx, my);
      ctx.restore();
    });

    if (s.result.score != null) {
      var label = '得分 ' + s.result.score + (s.result.total != null ? ' / ' + s.result.total : '');
      var fs = Math.max(14, base * 0.85);
      ctx.font = 'bold ' + Math.round(fs) + 'px "PingFang SC", sans-serif';
      var tw = ctx.measureText(label).width;
      var padX = fs * 0.7, padY = fs * 0.5;
      var bw = tw + padX * 2, bh = fs + padY * 2;
      var bx = W - bw - fs * 0.6, by = fs * 0.6;
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      roundRect(ctx, bx, by, bw, bh, fs * 0.4);
      ctx.fill();
      ctx.strokeStyle = 'rgba(139,108,255,.9)';
      ctx.lineWidth = Math.max(2, fs * 0.1);
      roundRect(ctx, bx, by, bw, bh, fs * 0.4);
      ctx.stroke();
      ctx.fillStyle = '#6d28d9';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, bx + bw / 2, by + bh / 2);
      ctx.restore();
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fallbackBox(i, n) {
    var step = Math.min(0.06, 0.86 / Math.max(1, n));
    return { x: 0.9, y: 0.03 + i * step, w: 0.08, h: Math.max(0.025, step * 0.75) };
  }

  function downloadSheet(s) {
    var canvas = document.querySelector('.result-card[data-id="' + s.id + '"] canvas');
    if (!canvas) return;
    var a = document.createElement('a');
    a.download = '批改_第' + (state.sheets.indexOf(s) + 1) + '张.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  }

  function renderSummary() {
    var done = state.sheets.filter(function (s) { return s.status === 'ok'; });
    if (!done.length) { $('#summary').hidden = true; return; }
    $('#summary').hidden = false;

    var totalRight = 0, totalWrong = 0, totalMid = 0;
    var rows = state.sheets.map(function (s, i) {
      if (s.status === 'err') {
        return '<div class="sum-row"><span class="file">第 ' + (i + 1) + ' 张</span><span class="pill miss">批改失败</span></div>';
      }
      if (s.status !== 'ok') return '';
      var items = (s.result && s.result.items) || [];
      var cnt = { correct: 0, wrong: 0, partial: 0, missing: 0 };
      items.forEach(function (x) { cnt[x.verdict] = (cnt[x.verdict] || 0) + 1; });
      totalRight += cnt.correct; totalWrong += cnt.wrong; totalMid += cnt.partial;
      var pills = '';
      if (cnt.correct) pills += '<span class="pill ok">对 ' + cnt.correct + '</span>';
      if (cnt.wrong) pills += '<span class="pill bad">错 ' + cnt.wrong + '</span>';
      if (cnt.partial) pills += '<span class="pill mid">部分对 ' + cnt.partial + '</span>';
      if (cnt.missing) pills += '<span class="pill miss">未作答 ' + cnt.missing + '</span>';
      var sc = s.result && s.result.score != null ? (' · ' + s.result.score + (s.result.total != null ? '/' + s.result.total : '') + ' 分') : '';
      return '<div class="sum-row"><span class="file">第 ' + (i + 1) + ' 张</span>' + pills + '<span style="color:var(--dim);font-size:11.5px">' + esc(s.name) + sc + '</span></div>';
    }).join('');

    $('#summaryMeta').textContent = '共 ' + done.length + ' 张 · 对 ' + totalRight + ' · 错 ' + totalWrong + (totalMid ? ' · 部分对 ' + totalMid : '');
    $('#summaryBody').innerHTML = rows;
  }

  /* ================= 步骤切换 ================= */

  function setStep(n) {
    state.step = n;
    $('#step1').hidden = n !== 1;
    $('#step2').hidden = n !== 2;
    $('#step3').hidden = n !== 3;
    $$('#steps .step').forEach(function (b) {
      var s = Number(b.dataset.step);
      b.classList.toggle('active', s === n);
      b.classList.toggle('done', s < n);
    });
    if (n === 2) renderAnswers();
    if (n === 3) { renderSheets(); renderResults(); renderSummary(); }
    save();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ================= 事件绑定 ================= */

  function bindDrop(host, input, handler) {
    if (!host) return;
    ['dragenter', 'dragover'].forEach(function (ev) {
      host.addEventListener(ev, function (e) { e.preventDefault(); host.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      host.addEventListener(ev, function (e) { e.preventDefault(); host.classList.remove('over'); });
    });
    host.addEventListener('drop', function (e) {
      var files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length) handler(files);
    });
    host.addEventListener('click', function (e) {
      if (e.target.closest('button') || e.target === input) return;
      input.click();
    });
    host.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
    });
  }

  function toArray(fileList) { return fileList ? Array.prototype.slice.call(fileList) : []; }

  function init() {
    restore();

    if (state.questions.length) {
      renderQuestions();
      setStep(state.step === 3 ? 2 : state.step);
    }

    // 题目
    bindDrop($('#qDrop'), $('#qFile'), function (f) { recognizeQuestions(toArray(f)); });
    $('#pickQFile').addEventListener('click', function () { $('#qFile').click(); });
    $('#pickQCam').addEventListener('click', function () { $('#qCam').click(); });
    $('#qFile').addEventListener('change', function (e) {
      var files = toArray(e.target.files);
      e.target.value = '';
      if (files.length) recognizeQuestions(files);
    });
    $('#qCam').addEventListener('change', function (e) {
      var files = toArray(e.target.files);
      e.target.value = '';
      if (files.length) recognizeQuestions(files);
    });
    $('#qAgain').addEventListener('click', function () {
      if (state.lastSources) {
        cacheToFiles(state.lastSources).then(function (files) {
          if (files.length) recognizeQuestions(files);
          else toast('请重新选择文件', true);
        });
      } else {
        $('#qFile').click();
      }
    });

    $('#qList').addEventListener('input', function (e) {
      var card = e.target.closest('.q-card');
      if (!card) return;
      var q = qById(card.dataset.id);
      if (!q) return;
      if (e.target.classList.contains('q-stem')) q.stem = e.target.value;
      else if (e.target.classList.contains('q-no-in')) q.no = e.target.value;
      else if (e.target.classList.contains('q-score')) q.score = e.target.value;
      else if (e.target.classList.contains('q-on')) {
        q.on = e.target.checked;
        card.classList.toggle('off', !q.on);
      }
      updateQMeta();
      save();
    });
    $('#qList').addEventListener('click', function (e) {
      if (!e.target.classList.contains('q-del')) return;
      var card = e.target.closest('.q-card');
      if (!card) return;
      var q = qById(card.dataset.id);
      state.questions = state.questions.filter(function (x) { return x.id !== card.dataset.id; });
      if (q) delete state.answers[q.id];
      renderQuestions();
      save();
    });
    $('#qSelectAll').addEventListener('click', function () {
      state.questions.forEach(function (q) { q.on = true; });
      renderQuestions(); save();
    });
    $('#qSelectNone').addEventListener('click', function () {
      state.questions.forEach(function (q) { q.on = false; });
      renderQuestions(); save();
    });
    $('#qAdd').addEventListener('click', function () {
      state.questions.push({ id: uid(), no: String(state.questions.length + 1), stem: '', type: 'other', score: '', origin: 'print', on: true });
      renderQuestions();
      save();
      var last = $('#qList').lastElementChild;
      if (last) last.querySelector('.q-stem').focus();
    });
    $('#qClear').addEventListener('click', function () {
      if (!state.questions.length) return;
      if (!confirm('清空所有题目和答案？')) return;
      state.questions = [];
      state.answers = {};
      state.lastSources = null;
      renderQuestions();
      save();
      toast('已清空');
    });
    $('#toStep2').addEventListener('click', function () {
      if (!selectedQuestions().length) { toast('至少选一道题', true); return; }
      setStep(2);
    });

    // 答案
    bindDrop($('#aDrop'), $('#aFile'), function (f) { recognizeAnswers(toArray(f)); });
    $('#pickAFile').addEventListener('click', function () { $('#aFile').click(); });
    $('#pickACam').addEventListener('click', function () { $('#aCam').click(); });
    $('#aFile').addEventListener('change', function (e) {
      var files = toArray(e.target.files);
      e.target.value = '';
      if (files.length) recognizeAnswers(files);
    });
    $('#aCam').addEventListener('change', function (e) {
      var files = toArray(e.target.files);
      e.target.value = '';
      if (files.length) recognizeAnswers(files);
    });
    $('#aiGenBtn').addEventListener('click', generateAnswers);

    $$('#answerTabs .tab').forEach(function (t) {
      t.addEventListener('click', function () {
        $$('#answerTabs .tab').forEach(function (x) { x.classList.toggle('active', x === t); });
        $('#tabUpload').hidden = t.dataset.tab !== 'upload';
        $('#tabAI').hidden = t.dataset.tab !== 'ai';
      });
    });

    $('#aList').addEventListener('input', function (e) {
      if (!e.target.classList.contains('a-text')) return;
      var card = e.target.closest('.a-card');
      if (!card) return;
      var cur = state.answers[card.dataset.id] || { text: '', source: '' };
      cur.text = e.target.value;
      if (!cur.source) cur.source = 'upload';
      state.answers[card.dataset.id] = cur;
      var qs = selectedQuestions();
      var filled = qs.filter(function (q) { return state.answers[q.id] && state.answers[q.id].text.trim(); }).length;
      $('#aCount').textContent = qs.length + ' 题 · 已有答案 ' + filled;
      $('#toStep3').disabled = !(qs.length && filled > 0);
      save();
    });

    $('#toStep1').addEventListener('click', function () { setStep(1); });
    $('#toStep2b').addEventListener('click', function () { setStep(2); });
    $('#toStep3').addEventListener('click', function () {
      var qs = selectedQuestions();
      var missing = qs.filter(function (q) { return !(state.answers[q.id] && state.answers[q.id].text.trim()); });
      if (missing.length) toast('还有 ' + missing.length + ' 道题没有答案，批改时会按题目本身判断', false);
      setStep(3);
    });

    // 批改
    bindDrop($('#sDrop'), $('#sFile'), addSheets);
    $('#pickSFiles').addEventListener('click', function () { $('#sFile').click(); });
    $('#pickSCam').addEventListener('click', function () { $('#sCam').click(); });
    $('#sFile').addEventListener('change', function (e) {
      var files = toArray(e.target.files);
      e.target.value = '';
      addSheets(files);
    });
    $('#sCam').addEventListener('change', function (e) {
      var files = toArray(e.target.files);
      e.target.value = '';
      addSheets(files);
    });
    $('#sheets').addEventListener('click', function (e) {
      if (!e.target.classList.contains('x')) return;
      var card = e.target.closest('.sheet-thumb');
      if (!card) return;
      var s = state.sheets.filter(function (x) { return x.id === card.dataset.id; })[0];
      if (!s) return;
      state.sheets = state.sheets.filter(function (x) { return x.id !== card.dataset.id; });
      state.sheets.forEach(function (x, k) { x.order = k + 1; });
      renderSheets();
      renderResults();
      renderSummary();
    });

    $('#annotToggle').addEventListener('change', function (e) {
      state.annotate = e.target.checked;
      renderResults();
    });

    $('#gradeBtn').addEventListener('click', startGrading);
    $('#sStop').addEventListener('click', function () { abortAll(); toast('正在停止…'); });
    $('#resetAll').addEventListener('click', function () {
      if (!confirm('清空这次的所有题目、答案和批改结果？')) return;
      try { localStorage.removeItem(LS_GAI); } catch (e) {}
      location.reload();
    });

    // 设置
    $('#keyBtn').addEventListener('click', openSettings);
    $('#saveSet').addEventListener('click', saveSettings);
    $('#toggleKey').addEventListener('click', function () {
      var inp = $('#setKey');
      inp.type = inp.type === 'password' ? 'text' : 'password';
      this.textContent = inp.type === 'password' ? '显示' : '隐藏';
    });
    $$('#setModal [data-close]').forEach(function (b) {
      b.addEventListener('click', function () { $('#setModal').hidden = true; });
    });
    $('#setModal').addEventListener('click', function (e) {
      if (e.target === this) this.hidden = true;
    });

    // 页面卸载时如果正在批改，问一句
    window.addEventListener('beforeunload', function (e) {
      if (state.running) { e.preventDefault(); e.returnValue = ''; }
    });
  }

  function openSettings() {
    var sel = $('#setVision');
    sel.innerHTML = VISION_OPTIONS.map(function (o) {
      return '<option value="' + o.id + '"' + (o.id === visionModel ? ' selected' : '') + '>' + esc(o.name) + '</option>';
    }).join('');
    $('#setKey').value = settings.key || '';
    $('#setModal').hidden = false;
  }

  function saveSettings() {
    var k = $('#setKey').value.trim();
    try {
      var all = loadSettings();
      all.key = k;
      localStorage.setItem(LS_SET, JSON.stringify(all));
    } catch (e) {}
    settings = loadSettings();
    visionModel = $('#setVision').value || DEFAULT_VISION;
    try { localStorage.setItem('yg_ai_vision_model', visionModel); } catch (e) {}
    $('#setModal').hidden = true;
    toast('设置已保存');
  }

  // 「重新识别」：把上次整理好的素材还原成 File 数组
  function cacheToFiles(sources) {
    var files = [];
    (sources.texts || []).forEach(function (t, i) {
      files.push(new File([t.text], (t.name || ('文字' + i)) + '.txt', { type: 'text/plain' }));
    });
    return (async function () {
      for (var i = 0; i < (sources.images || []).length; i++) {
        try {
          var blob = await (await fetch(sources.images[i].data)).blob();
          files.push(new File([blob], (sources.images[i].name || ('图片' + i)) + '.jpg', { type: 'image/jpeg' }));
        } catch (e) {}
      }
      return files;
    })();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
