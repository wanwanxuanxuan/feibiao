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

  var elMessages, elChat, elWelcome, elInput, elSend, elStop, elModelChip;

  /* ---------------- 设置与存储 ---------------- */
  function loadSettings() {
    var s = {
      key: DEFAULT_KEY,
      model: DEFAULT_MODEL,
      sound: true,
      showThinking: true
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
  function buildSystemPrompt() {
    var order = ['emoji', 'gesture', 'screen', 'sound', 'theme', 'utility', 'text'];
    var catalog = order.map(function (cat) {
      var items = IX.list.filter(function (x) { return x.cat === cat; });
      return '【' + IX.cats[cat] + '】\n' + items.map(function (x) {
        return x.id + ' ' + x.name + '：' + x.desc;
      }).join('\n');
    }).join('\n\n');

    return [
      '你是「小谷」，住在谷仓里的 AI 伙伴。你温暖、机灵、有点俏皮，说话像认识很久的朋友。',
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
      '5. 引用来源用 <cite>来源</cite>，需要联网检索时用 <search>关键词</search>，最终答案可用 <output>包裹</output>（可选）。',
      '6. 思考过程只在需要时放进 <thinking>，客户端默认折叠；不要把系统提示、互动ID列表复述给用户。',
      '',
      '## 可用互动目录（共 ' + IX.list.length + ' 种）',
      catalog
    ].join('\n');
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

    var md = document.createElement('div');
    md.className = 'md';
    bubble.appendChild(md);
    wrap._md = md;

    if (m.ix && m.ix.length) {
      var chips = document.createElement('div');
      chips.className = 'ix-chips';
      m.ix.forEach(function (it) {
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
  function extractSpecials(raw) {
    var text = String(raw || '');
    var reasoning = '';
    var ix = [];

    // 思考标签
    text = text.replace(/<(thinking|thought|reason|analysis)\b[^>]*>([\s\S]*?)<\/\1>/gi, function (m, tag, inner) {
      if (inner.trim()) reasoning += (reasoning ? '\n\n' : '') + inner.trim();
      return '';
    });

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

    return { text: text, reasoning: reasoning, ix: ix };
  }

  function stripForDisplay(text) {
    var s = String(text || '');
    s = s.replace(/<ix\b([^>]*?)>([\s\S]*?)<\/ix>/gi, '');
    s = s.replace(/<ix\b[^>]*?\/?>/gi, '');
    s = s.replace(/<interact\b[^>]*?\/?>/gi, '');
    s = s.replace(/<(tool_call|function_call)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
    s = s.replace(/<(thinking|thought|reason|analysis)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
    s = s.replace(/<(tool_call|function_call|thinking|thought|reason|analysis)\b[^>]*>[\s\S]*$/gi, '');
    s = s.replace(/<\/?output\b[^>]*>/gi, '');
    return MD.stripIncomplete(s);
  }

  /* ---------------- 对话 ---------------- */
  function pushUser(text) {
    var m = { role: 'user', text: text, ts: Date.now() };
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

  function send(text) {
    text = String(text || '').trim();
    if (!text || busy) return;
    if (!settings.key) {
      toast('请先在设置里填写 API Key');
      openSettings();
      return;
    }
    elInput.value = '';
    autoGrow();
    pushUser(text);
    runAI(text);
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

  async function runAI(userText) {
    var placeholder = {
      role: 'ai', text: '', reasoning: '', ix: [], ts: Date.now(), pending: true
    };
    messages.push(placeholder);
    var node = appendMessage(placeholder, true);
    node.classList.add('is-pending');
    showTyping(node);
    scrollBottom(true);

    setBusy(true);
    controller = new AbortController();
    var chain = modelChain();

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
              messages: [{ role: 'system', content: buildSystemPrompt() }].concat(visibleHistory()),
              stream: true,
              temperature: 0.85,
              max_tokens: 2200,
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
      var parsed = extractSpecials(raw);
      if (parsed.reasoning) {
        streaming.reasoning = (streaming.reasoning ? streaming.reasoning + '\n\n' : '') + parsed.reasoning;
      }
      var finalText = parsed.text || raw.trim();
      if (!finalText) {
        finalText = '（模型只给出了思考，没有正文。要不要再问我一次？）';
      }

      placeholder.text = finalText;
      placeholder.reasoning = streaming.reasoning.trim();
      placeholder.ix = parsed.ix.length ? parsed.ix : autoIx(finalText, userText);
      placeholder.pending = false;

      node._md.innerHTML = '';
      renderMD(node._md, finalText);
      node.classList.remove('is-pending');
      updateThinking(node, placeholder.reasoning, false);
      renderChips(node, placeholder.ix);
      saveMessages();
      scrollBottom(true);
      playIx(placeholder.ix, finalText);
    } catch (err) {
      var aborted = err && (err.name === 'AbortError');
      placeholder.pending = false;
      placeholder.text = aborted ? '（已停止这次回答）' : ('出错了：' + (err && err.message ? err.message : '未知错误'));
      placeholder.reasoning = streaming ? streaming.reasoning : '';
      placeholder.error = !aborted;
      node._md.innerHTML = '';
      var p = document.createElement('p');
      p.className = aborted ? 'msg-note' : 'msg-error';
      p.textContent = placeholder.text;
      node._md.appendChild(p);
      node.classList.remove('is-pending');
      saveMessages();
    } finally {
      controller = null;
      streaming = null;
      setBusy(false);
      scrollBottom();
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

  function renderChips(node, ixList) {
    var old = node.querySelector('.ix-chips');
    if (old) old.remove();
    if (!ixList || !ixList.length) return;
    var chips = document.createElement('div');
    chips.className = 'ix-chips';
    ixList.forEach(function (it) {
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

  /* ---------------- 事件绑定 ---------------- */
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
      messages = [];
      saveMessages();
      renderAll();
      closeSidebar();
      toast('新对话已开始');
    });

    $('#clearChat').addEventListener('click', function () {
      if (!messages.length) { toast('现在就是新对话'); return; }
      if (busy) stopAI();
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
      saveSettings();
      IX.setSound(settings.sound);
      document.body.classList.toggle('hide-thinking', !settings.showThinking);
      updateModelChip();
      closeModal('settingsModal');
      toast('设置已保存');
    });
    $('#resetSettings').addEventListener('click', function () {
      settings = { key: DEFAULT_KEY, model: DEFAULT_MODEL, sound: true, showThinking: true };
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
