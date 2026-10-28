/*!
 * 小谷互动引擎 · 86 种内置互动
 * 表情回应 / 陪伴动作 / 屏幕特效 / 声音 / 主题 / 小工具 / 文字效果
 */
(function () {
  'use strict';

  var CATS = {
    emoji: '表情回应',
    gesture: '陪伴动作',
    screen: '屏幕特效',
    sound: '声音',
    theme: '主题',
    utility: '小工具',
    text: '文字效果'
  };

  var THEMES = ['dark', 'light', 'cyber', 'forest', 'ocean', 'sunset', 'mono', 'aurora'];
  var THEME_NAMES = {
    dark: '深夜紫', light: '日光白', cyber: '赛博霓虹', forest: '森林绿',
    ocean: '深海蓝', sunset: '日落橙', mono: '黑白胶片', aurora: '极光'
  };

  var list = [];
  var byId = {};
  var soundOn = true;
  var pushCardFn = null;

  function reg(id, emoji, name, cat, desc, run) {
    var def = { id: id, emoji: emoji, name: name, cat: cat, catName: CATS[cat], desc: desc, run: run };
    list.push(def);
    byId[id] = def;
  }

  /* ---------------- 基础工具 ---------------- */
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function num(v, def) {
    var n = parseInt(String(v == null ? '' : v).replace(/[^\d-]/g, ''), 10);
    return isFinite(n) && n > 0 ? n : def;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function mk(tag, cls, txt) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (txt != null) el.textContent = txt;
    return el;
  }
  function layer() { return document.getElementById('fx-layer'); }
  function bannerRoot() { return document.getElementById('fx-banner'); }
  function reduceMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function bodyEffect(cls, ms) {
    document.body.classList.add(cls);
    setTimeout(function () { document.body.classList.remove(cls); }, ms);
  }
  function overlay(cls, ms, html) {
    var L = layer();
    if (!L) return null;
    var d = mk('div', cls);
    if (html) d.innerHTML = html;
    L.appendChild(d);
    setTimeout(function () { d.remove(); }, ms);
    return d;
  }
  function toastNote(txt) {
    var L = layer();
    if (!L) return;
    var d = mk('div', 'fx-note', txt);
    d.style.left = rand(20, 80) + '%';
    L.appendChild(d);
    setTimeout(function () { d.remove(); }, 2200);
  }

  /* ---------------- 声音（WebAudio，无外部资源） ---------------- */
  var ac = null;
  function actx() {
    if (!soundOn) return null;
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      return ac;
    } catch (e) { return null; }
  }
  function tone(freq, dur, type, delay, vol, slideTo) {
    var a = actx();
    if (!a) return;
    var t0 = a.currentTime + (delay || 0);
    var o = a.createOscillator();
    var g = a.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol == null ? 0.06 : vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(a.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }
  function noiseBurst(dur, vol, freq) {
    var a = actx();
    if (!a) return;
    var len = Math.max(1, Math.floor(a.sampleRate * dur));
    var buf = a.createBuffer(1, len, a.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = a.createBufferSource();
    src.buffer = buf;
    var f = a.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq || 900;
    var g = a.createGain();
    g.gain.value = vol == null ? 0.18 : vol;
    src.connect(f); f.connect(g); g.connect(a.destination);
    src.start();
  }
  var SOUNDS = {
    ding: function () { tone(880, 0.5, 'sine', 0, 0.09); tone(1320, 0.4, 'sine', 0.02, 0.04); },
    pop: function () { tone(320, 0.09, 'square', 0, 0.05, 140); },
    success: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.24, 'triangle', i * 0.085, 0.06); }); },
    error: function () { tone(220, 0.2, 'sawtooth', 0, 0.04); tone(165, 0.3, 'sawtooth', 0.16, 0.04); },
    whoosh: function () { noiseBurst(0.42, 0.14, 700); },
    chime: function () { [1047, 1319, 1568, 2093].forEach(function (f, i) { tone(f, 0.7, 'sine', i * 0.07, 0.035); }); },
    heartbeat: function () { tone(58, 0.18, 'sine', 0, 0.12); tone(52, 0.22, 'sine', 0.24, 0.1); },
    typing: function () {
      for (var i = 0; i < 8; i++) tone(rand(1400, 2100), 0.03, 'square', i * 0.075, 0.02);
    }
  };

  /* ---------------- 粒子画布 ---------------- */
  var canvas = null, g = null, W = 0, H = 0, parts = [], raf = 0, lastT = 0;

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.getElementById('fx-canvas');
    if (!canvas) return;
    g = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }
  function resizeCanvas() {
    if (!canvas) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function addP(o) {
    if (parts.length > 1400) return;
    parts.push(Object.assign({
      x: 0, y: 0, vx: 0, vy: 0, g: 0, size: 6, color: '#fff', kind: 'rect',
      life: 2, maxLife: 2, rot: 0, vr: 0, alpha: 1, char: '•', seed: Math.random() * 10
    }, o));
    startLoop();
  }
  function startLoop() {
    ensureCanvas();
    if (!g) return;
    if (!raf) {
      lastT = performance.now();
      raf = requestAnimationFrame(tick);
    }
  }
  function heartPath(size) {
    g.beginPath();
    g.moveTo(0, size * 0.35);
    g.bezierCurveTo(-size * 0.9, -size * 0.1, -size * 0.55, -size * 0.75, 0, -size * 0.32);
    g.bezierCurveTo(size * 0.55, -size * 0.75, size * 0.9, -size * 0.1, 0, size * 0.35);
    g.fill();
  }
  function starPath(size) {
    g.beginPath();
    for (var i = 0; i < 10; i++) {
      var r = i % 2 ? size * 0.42 : size;
      var a = (Math.PI / 5) * i - Math.PI / 2;
      var px = Math.cos(a) * r, py = Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
    g.fill();
  }
  function tick(t) {
    var dt = Math.min(0.05, (t - lastT) / 1000) || 0.016;
    lastT = t;
    g.clearRect(0, 0, W, H);
    var tSec = t / 1000;
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      var a = Math.min(1, p.life / (p.maxLife * 0.45)) * p.alpha;
      if (p.kind === 'star' || p.kind === 'spark') a *= 0.55 + 0.45 * Math.sin(tSec * 3 + p.seed);
      g.save();
      g.globalAlpha = Math.max(0, a);
      g.fillStyle = p.color;
      if (p.kind === 'rect') {
        g.translate(p.x, p.y); g.rotate(p.rot);
        g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else if (p.kind === 'circle' || p.kind === 'bubble') {
        g.beginPath(); g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        if (p.kind === 'bubble') { g.strokeStyle = p.color; g.lineWidth = 1.4; g.stroke(); } else g.fill();
      } else if (p.kind === 'heart') {
        g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.color; heartPath(p.size);
      } else if (p.kind === 'star' || p.kind === 'spark') {
        g.translate(p.x, p.y); g.rotate(p.rot); starPath(p.size);
      } else if (p.kind === 'char') {
        g.font = '600 ' + p.size + 'px ui-monospace, monospace';
        g.fillText(p.char, p.x, p.y);
      } else if (p.kind === 'streak') {
        g.strokeStyle = p.color; g.lineWidth = Math.max(1, p.size * 0.22);
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045); g.stroke();
      }
      g.restore();
    }
    if (parts.length) {
      raf = requestAnimationFrame(tick);
    } else {
      raf = 0;
      g.clearRect(0, 0, W, H);
    }
  }

  function burst(kind, count, o) {
    o = o || {};
    ensureCanvas();
    if (!g) return;
    var cx = (o.x == null ? 0.5 : o.x) * W;
    var cy = (o.y == null ? 0.45 : o.y) * H;
    var colors = o.colors || ['#ffd166', '#8b6cff', '#22d3ee', '#ff6b9d', '#7ef29d'];
    for (var i = 0; i < count; i++) {
      var ang = rand(0, Math.PI * 2);
      var sp = rand(o.minSpeed || 90, o.maxSpeed || 420);
      var size = rand(o.minSize || 3, o.maxSize || 9);
      addP({
        kind: kind, x: cx + rand(-8, 8), y: cy + rand(-8, 8),
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - (o.lift || 0),
        g: o.gravity == null ? 420 : o.gravity,
        size: size, color: pick(colors), rot: rand(0, 6.28), vr: rand(-6, 6),
        life: rand(o.minLife || 1.1, o.maxLife || 2.2), maxLife: o.maxLife || 2.2
      });
    }
  }
  function confettiRain() {
    ensureCanvas();
    if (!g) return;
    var colors = ['#ffd166', '#8b6cff', '#22d3ee', '#ff6b9d', '#7ef29d', '#c084fc'];
    for (var i = 0; i < 110; i++) {
      addP({
        kind: 'rect', x: rand(0, W), y: rand(-H * 0.45, 0),
        vx: rand(-60, 60), vy: rand(120, 320), g: 60,
        size: rand(5, 12), color: pick(colors), rot: rand(0, 6.28), vr: rand(-8, 8),
        life: rand(2.2, 3.6), maxLife: 3.6
      });
    }
  }

  /* ---------------- 表情 / 手势 / 横幅 ---------------- */
  function floatEmoji(emoji, o) {
    o = o || {};
    var L = layer();
    if (!L) return;
    var n = o.count || 1;
    for (var i = 0; i < n; i++) {
      var s = mk('span', 'fx-emoji ef-' + (o.anim || 'float'), emoji);
      s.style.left = (o.x != null ? o.x * 100 + (i - n / 2) * 4 : rand(12, 88)) + '%';
      s.style.top = (o.y != null ? o.y * 100 + rand(-6, 6) : rand(18, 78)) + '%';
      s.style.fontSize = Math.round((o.size || 44) * rand(0.8, 1.25)) + 'px';
      s.style.animationDelay = (i * 70 + rand(0, 160)) + 'ms';
      s.style.setProperty('--dx', rand(-70, 70).toFixed(0) + 'px');
      L.appendChild(s);
      setTimeout(function (node) { return function () { node.remove(); }; }(s), 3000);
    }
  }
  function gesture(emoji, label, variant) {
    var L = layer();
    if (!L) return;
    var wrap = mk('div', 'fx-gesture g-' + variant);
    var big = mk('div', 'g-emoji', emoji);
    var lab = mk('div', 'g-label', label);
    wrap.appendChild(big);
    wrap.appendChild(lab);
    L.appendChild(wrap);
    setTimeout(function () { wrap.remove(); }, 2400);
  }
  function banner(text, variant, ms) {
    var R = bannerRoot();
    if (!R) return;
    var b = mk('div', 'fx-banner-item b-' + (variant || 'soft'));
    var t = text == null ? '' : String(text);
    if (variant === 'typewriter') {
      var i = 0;
      b.textContent = '';
      var timer = setInterval(function () {
        b.textContent = t.slice(0, ++i);
        if (i >= t.length) clearInterval(timer);
      }, 45);
    } else if (variant === 'wave') {
      t.split('').forEach(function (ch, idx) {
        var sp = mk('span', null, ch === ' ' ? '\u00a0' : ch);
        sp.style.animationDelay = (idx * 0.06) + 's';
        b.appendChild(sp);
      });
    } else if (variant === 'glitch') {
      b.textContent = t;
      b.setAttribute('data-text', t);
    } else {
      b.textContent = t;
    }
    R.appendChild(b);
    setTimeout(function () { b.remove(); }, ms || 2600);
  }
  function dotsBubble() {
    var L = layer();
    if (!L) return;
    var d = mk('div', 'fx-dots');
    d.innerHTML = '<span></span><span></span><span></span>';
    L.appendChild(d);
    setTimeout(function () { d.remove(); }, 1900);
  }

  /* ---------------- 主题 ---------------- */
  function applyTheme(name) {
    if (THEMES.indexOf(name) === -1) return false;
    document.documentElement.setAttribute('data-theme', name);
    try { localStorage.setItem('yg_ai_theme', name); } catch (e) {}
    toastNote('🎨 ' + THEME_NAMES[name]);
    return true;
  }

  /* ---------------- 互动卡片 ---------------- */
  function card(body, init) {
    if (typeof pushCardFn === 'function') pushCardFn(body, init);
  }
  function cardShell(icon, title, body) {
    return '<div class="ix-card">' +
      '<div class="ix-card-head"><span class="ix-card-title">' + icon + ' ' + esc(title) + '</span>' +
      '<span class="ix-card-badge">互动</span></div>' +
      '<div class="ix-card-body">' + body + '</div></div>';
  }

  /* ---------------- 小工具实现 ---------------- */
  function utilCoin() {
    card(cardShell('🪙', '抛硬币', '<div class="coin-stage"><div class="coin-face">正</div></div>' +
      '<div class="ix-card-note">点一下硬币，再抛一次</div>'), function (root) {
      var coin = root.querySelector('.coin-face');
      var busy = false;
      function flip() {
        if (busy) return;
        busy = true;
        coin.classList.add('is-flipping');
        setTimeout(function () {
          coin.textContent = Math.random() < 0.5 ? '正' : '反';
          coin.classList.remove('is-flipping');
          SOUNDS.ding();
          busy = false;
        }, 720);
      }
      coin.addEventListener('click', flip);
      setTimeout(flip, 300);
    });
  }
  function utilDice() {
    card(cardShell('🎲', '掷骰子', '<div class="dice-stage"><div class="dice-face">?</div></div>' +
      '<div class="ix-card-note">点骰子重掷</div>'), function (root) {
      var face = root.querySelector('.dice-face');
      var busy = false;
      function roll() {
        if (busy) return;
        busy = true;
        var n = 0;
        var iv = setInterval(function () {
          face.textContent = 1 + Math.floor(Math.random() * 6);
        }, 80);
        face.classList.add('is-rolling');
        setTimeout(function () {
          clearInterval(iv);
          face.textContent = 1 + Math.floor(Math.random() * 6);
          face.classList.remove('is-rolling');
          SOUNDS.pop();
          busy = false;
        }, 900);
      }
      face.addEventListener('click', roll);
      setTimeout(roll, 300);
    });
  }
  function utilRandom(args) {
    var pool = String((args && args.text) || '').split(/[,，、;；\/|\n]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (pool.length < 2) pool = ['火锅', '烧烤', '外卖', '自己做饭'];
    card(cardShell('🎯', '随机选择', '<div class="slot-stage"><div class="slot-face">?</div></div>' +
      '<div class="slot-options">' + pool.map(function (p) { return '<span>' + esc(p) + '</span>'; }).join('') + '</div>' +
      '<div class="ix-card-note">候选：' + esc(pool.join(' / ')) + '</div>'), function (root) {
      var face = root.querySelector('.slot-face');
      var iv = setInterval(function () {
        face.textContent = pick(pool);
      }, 90);
      setTimeout(function () {
        clearInterval(iv);
        face.textContent = pick(pool);
        face.classList.add('slot-done');
        SOUNDS.success();
      }, 1400);
    });
  }
  function utilTimer(args) {
    var total = Math.min(3600, Math.max(5, num((args && (args.seconds || args.text)), 60)));
    var left = total;
    var running = true;
    card(cardShell('⏱️', '倒计时 ' + total + ' 秒', '<div class="timer-face">' + fmt(total) + '</div>' +
      '<div class="timer-bar"><i></i></div>' +
      '<div class="ix-card-actions"><button class="mini-btn" data-act="toggle">暂停</button>' +
      '<button class="mini-btn" data-act="reset">重置</button></div>'), function (root) {
      var face = root.querySelector('.timer-face');
      var bar = root.querySelector('.timer-bar i');
      var toggle = root.querySelector('[data-act="toggle"]');
      function paint() {
        face.textContent = fmt(left);
        bar.style.width = (left / total * 100) + '%';
      }
      paint();
      var iv = setInterval(function () {
        if (!running) return;
        left--;
        if (left <= 0) {
          left = 0;
          running = false;
          clearInterval(iv);
          face.textContent = '时间到';
          bar.style.width = '100%';
          SOUNDS.success();
          banner('⏰ 时间到！', 'soft', 2200);
          overlay('fx-flash', 380);
          return;
        }
        paint();
      }, 1000);
      toggle.addEventListener('click', function () {
        running = !running;
        toggle.textContent = running ? '暂停' : '继续';
      });
      root.querySelector('[data-act="reset"]').addEventListener('click', function () {
        left = total;
        running = true;
        toggle.textContent = '暂停';
        paint();
      });
    });
  }
  function fmt(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function utilBreathe() {
    card(cardShell('🫧', '4-7-8 呼吸练习', '<div class="breathe-stage"><div class="breathe-circle"><span>吸气</span></div></div>' +
      '<div class="ix-card-note">跟着圆圈呼吸：吸气 4 秒，屏住 7 秒，呼气 8 秒</div>' +
      '<div class="ix-card-actions"><button class="mini-btn" data-act="stop">停止</button></div>'), function (root) {
      var circle = root.querySelector('.breathe-circle');
      var label = circle.querySelector('span');
      var phases = [['吸气', 4, 'in'], ['屏住', 7, 'hold'], ['呼气', 8, 'out']];
      var pi = 0, sec = 0, stopped = false;
      function apply() {
        var p = phases[pi];
        label.textContent = p[0];
        circle.className = 'breathe-circle b-' + p[2];
        circle.style.animationDuration = p[1] + 's';
      }
      apply();
      var iv = setInterval(function () {
        if (stopped) return;
        sec++;
        if (sec >= phases[pi][1]) { sec = 0; pi = (pi + 1) % 3; apply(); }
      }, 1000);
      root.querySelector('[data-act="stop"]').addEventListener('click', function () {
        stopped = true;
        clearInterval(iv);
        label.textContent = '已停止';
        circle.className = 'breathe-circle';
      });
    });
  }
  function utilFocus() {
    document.body.classList.add('focus-mode');
    card(cardShell('🎧', '专注 25 分钟', '<div class="focus-face">25:00</div>' +
      '<div class="ix-card-note">专注模式已开启，杂念先放一边。</div>' +
      '<div class="ix-card-actions"><button class="mini-btn" data-act="end">结束专注</button></div>'), function (root) {
      var face = root.querySelector('.focus-face');
      var left = 25 * 60;
      var iv = setInterval(function () {
        if (left <= 0) {
          clearInterval(iv);
          face.textContent = '完成';
          document.body.classList.remove('focus-mode');
          SOUNDS.success();
          banner('🎉 专注完成，休息一下', 'soft', 2600);
          return;
        }
        left--;
        face.textContent = fmt(left);
      }, 1000);
      root.querySelector('[data-act="end"]').addEventListener('click', function () {
        clearInterval(iv);
        document.body.classList.remove('focus-mode');
        face.textContent = '已结束';
      });
    });
  }
  function utilMood() {
    var faces = [['😞', '低落'], ['😕', '有点闷'], ['😐', '平静'], ['🙂', '不错'], ['😄', '很好']];
    card(cardShell('🌤️', '心情打卡', '<div class="mood-faces">' + faces.map(function (f, i) {
      return '<button class="mood-face" data-i="' + i + '">' + f[0] + '<span>' + f[1] + '</span></button>';
    }).join('') + '</div><div class="mood-out">选一个最接近你现在的心情</div>'), function (root) {
      root.querySelectorAll('.mood-face').forEach(function (btn) {
        btn.addEventListener('click', function () {
          root.querySelectorAll('.mood-face').forEach(function (b) { b.classList.remove('on'); });
          btn.classList.add('on');
          var i = +btn.getAttribute('data-i');
          var out = root.querySelector('.mood-out');
          out.textContent = '今天的心情：' + faces[i][1] + ' ' + faces[i][0] + '（' + (i + 1) + '/5）';
          SOUNDS.ding();
        });
      });
    });
  }
  function utilQuote(args) {
    var quotes = [
      ['慢一点也没关系，你又不是在赶末班车。', '小谷'],
      ['把今天过好，明天自然会来。', '匿名'],
      ['真正的自由，是有勇气被别人讨厌。', '《被讨厌的勇气》'],
      ['所有的答案，都藏在你走过的路里。', '小谷'],
      ['不必发光，只要别熄灭。', '匿名'],
      ['你已经很棒了，只是还没发现。', '小谷']
    ];
    var q = (args && args.text) ? [args.text, '小谷'] : pick(quotes);
    card(cardShell('📜', '今日一句', '<blockquote class="quote-face">' + esc(q[0]) + '</blockquote>' +
      '<div class="quote-from">— ' + esc(q[1]) + '</div>'), function () { SOUNDS.chime(); });
  }
  function utilFortune() {
    var levels = [
      ['大吉', 5, '#ffd166'], ['中吉', 4, '#8b6cff'], ['小吉', 3, '#22d3ee'], ['平', 2, '#9d94bb']
    ];
    var f = pick(levels);
    var colors = ['雾紫', '薄荷绿', '珊瑚橙', '深海蓝', '奶油白'];
    card(cardShell('🔮', '今日运势', '<div class="fortune-top"><b>' + f[0] + '</b><span>' +
      '★★★★★'.slice(0, f[1]) + '☆☆☆☆☆'.slice(0, 5 - f[1]) + '</span></div>' +
      '<div class="fortune-grid"><div><em>幸运色</em><span style="color:' + f[2] + '">' + pick(colors) + '</span></div>' +
      '<div><em>幸运数字</em><span>' + (1 + Math.floor(Math.random() * 9)) + '</span></div>' +
      '<div><em>宜</em><span>' + pick(['摸鱼', '早睡', '喝奶茶', '大胆发言', '整理桌面']) + '</span></div>' +
      '<div><em>忌</em><span>' + pick(['熬夜', '内耗', '硬撑', '翻旧账', '空腹喝咖啡']) + '</span></div></div>'), function () {
      SOUNDS.chime();
    });
  }
  function utilRps() {
    card(cardShell('✊', '猜拳', '<div class="rps-row"><button data-m="✊">✊</button><button data-m="✌️">✌️</button><button data-m="✋">✋</button></div>' +
      '<div class="rps-out">选一个，我们三局两胜</div>'), function (root) {
      var out = root.querySelector('.rps-out');
      var moves = ['✊', '✌️', '✋'];
      var win = 0, lose = 0;
      root.querySelectorAll('.rps-row button').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var mine = btn.getAttribute('data-m');
          var ai = pick(moves);
          var res;
          if (mine === ai) res = '平局';
          else if ((mine === '✊' && ai === '✌️') || (mine === '✌️' && ai === '✋') || (mine === '✋' && ai === '✊')) { res = '你赢'; win++; }
          else { res = '我赢'; lose++; }
          out.innerHTML = '你 ' + mine + ' &nbsp;vs&nbsp; 我 ' + ai + ' → <b>' + res + '</b>　比分 ' + win + ':' + lose;
          SOUNDS[res === '你赢' ? 'success' : res === '我赢' ? 'pop' : 'ding']();
        });
      });
    });
  }
  function utilSpinner(args) {
    var pool = String((args && args.text) || '').split(/[,，、;；\/|\n]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (pool.length < 2) pool = ['火锅', '烤肉', '日料', '随便'];
    card(cardShell('🎡', '命运转盘', '<div class="spin-stage"><div class="spin-wheel"><div class="spin-center">转</div>' +
      '<div class="spin-pointer"></div></div></div><div class="spin-out">候选：' + esc(pool.join(' / ')) + '</div>'), function (root) {
      var center = root.querySelector('.spin-center');
      var wheel = root.querySelector('.spin-wheel');
      var out = root.querySelector('.spin-out');
      var busy = false;
      wheel.addEventListener('click', function () {
        if (busy) return;
        busy = true;
        var n = 0;
        var iv = setInterval(function () {
          center.textContent = pick(pool);
          n++;
        }, 90);
        var turns = 4 + Math.floor(Math.random() * 3);
        wheel.style.transition = 'transform 1.4s cubic-bezier(.2,.8,.2,1)';
        wheel.style.transform = 'rotate(' + (turns * 360 + Math.random() * 360) + 'deg)';
        setTimeout(function () {
          clearInterval(iv);
          var result = pick(pool);
          center.textContent = result;
          out.innerHTML = '结果：<b>' + esc(result) + '</b>';
          wheel.style.transition = 'none';
          wheel.style.transform = 'rotate(0deg)';
          SOUNDS.success();
          busy = false;
        }, 1500);
      });
    });
  }
  function utilScore(args) {
    var target = (args && args.text) ? args.text : '这次表现';
    var score = 60 + Math.floor(Math.random() * 40);
    var stars = Math.max(1, Math.round(score / 20));
    card(cardShell('📊', '评分卡', '<div class="score-subject">' + esc(target) + '</div>' +
      '<div class="score-num"><b>' + score + '</b><span>/ 100</span></div>' +
      '<div class="score-stars">' + '★'.repeat(stars) + '☆'.repeat(5 - stars) + '</div>' +
      '<div class="score-bar"><i style="width:' + score + '%"></i></div>'), function () { SOUNDS.chime(); });
  }

  /* =========================================================
   * 1. 表情回应（20）
   * ======================================================= */
  reg('emoji_joy', '😄', '开心', 'emoji', '浮起一串笑脸并迸出金色星光', function () {
    floatEmoji('😄', { count: 5, anim: 'float' });
    burst('spark', 26, { colors: ['#ffd166', '#fff3b0', '#8b6cff'], maxSpeed: 300, maxSize: 7 });
    SOUNDS.ding();
  });
  reg('emoji_laugh', '😂', '大笑', 'emoji', '笑脸乱跳并发出啵的一声', function () {
    floatEmoji('😂', { count: 5, anim: 'bounce' });
    bodyEffect('fx-nudge', 420);
    SOUNDS.pop();
  });
  reg('emoji_love', '😍', '喜欢', 'emoji', '爱心眼表情配爱心粒子', function () {
    floatEmoji('😍', { count: 4, anim: 'pulse', size: 52 });
    burst('heart', 18, { colors: ['#ff6b9d', '#ff8fab', '#ffd1dc'], gravity: 120, maxSpeed: 260 });
  });
  reg('emoji_think', '🤔', '思考', 'emoji', '飘出思考气泡和省略号', function () {
    floatEmoji('🤔', { count: 2, anim: 'drift', size: 54 });
    dotsBubble();
    tone(520, 0.18, 'sine', 0, 0.03);
  });
  reg('emoji_wow', '😮', '惊讶', 'emoji', '表情弹开并闪一下白光', function () {
    floatEmoji('😮', { count: 4, anim: 'pop', size: 50 });
    overlay('fx-flash', 320);
    SOUNDS.pop();
  });
  reg('emoji_sad', '😢', '难过', 'emoji', '蓝色雨滴和低低的表情', function () {
    floatEmoji('😢', { count: 4, anim: 'fall', size: 44 });
    burst('streak', 24, { colors: ['#7dd3fc', '#38bdf8', '#a5b4fc'], y: 0.1, gravity: 900, maxSpeed: 160, maxSize: 7 });
    tone(300, 0.4, 'sine', 0, 0.035, 220);
  });
  reg('emoji_angry', '😤', '生气', 'emoji', '屏幕轻震并冒出一团蒸汽', function () {
    floatEmoji('😤', { count: 3, anim: 'shake', size: 50 });
    floatEmoji('💨', { count: 4, anim: 'rise', size: 26 });
    bodyEffect('fx-shake', 420);
    SOUNDS.error();
  });
  reg('emoji_sleepy', '😴', '困了', 'emoji', '表情慢悠悠飘起，带一串 Z', function () {
    floatEmoji('😴', { count: 2, anim: 'drift', size: 50 });
    floatEmoji('Z', { count: 4, anim: 'rise', size: 26 });
    tone(660, 0.5, 'sine', 0, 0.03, 440);
  });
  reg('emoji_cool', '😎', '酷', 'emoji', '墨镜反光扫过屏幕', function () {
    floatEmoji('😎', { count: 3, anim: 'float', size: 48 });
    overlay('fx-shine', 1200);
    SOUNDS.ding();
  });
  reg('emoji_shy', '😳', '害羞', 'emoji', '脸颊浮起两团粉色红晕', function () {
    floatEmoji('😳', { count: 3, anim: 'pulse', size: 48 });
    overlay('fx-blush', 1600);
    tone(740, 0.3, 'sine', 0, 0.03, 880);
  });
  reg('emoji_wink', '😉', '眨眼', 'emoji', '一个眨眼和清脆的叮', function () {
    floatEmoji('😉', { count: 3, anim: 'blink', size: 50 });
    SOUNDS.ding();
  });
  reg('emoji_rofl', '🤣', '笑翻', 'emoji', '笑到屏幕都在抖', function () {
    floatEmoji('🤣', { count: 6, anim: 'shake', size: 46 });
    bodyEffect('fx-shake', 380);
    SOUNDS.pop();
  });
  reg('emoji_pray', '🙏', '拜托', 'emoji', '双手合十，风铃一声', function () {
    floatEmoji('🙏', { count: 3, anim: 'settle', size: 50 });
    SOUNDS.chime();
  });
  reg('emoji_clap', '👏', '鼓掌', 'emoji', '掌声和金色小星星', function () {
    floatEmoji('👏', { count: 6, anim: 'clap', size: 40 });
    burst('spark', 20, { colors: ['#ffd166', '#fff'], maxSpeed: 220 });
    SOUNDS.ding();
  });
  reg('emoji_ok', '👌', 'OK', 'emoji', '一个 OK 手势带出涟漪', function () {
    floatEmoji('👌', { count: 3, anim: 'ring', size: 50 });
    overlay('fx-ripple-ring', 1200);
    SOUNDS.ding();
  });
  reg('emoji_nope', '🙅', '拒绝', 'emoji', '表情滑出屏幕，配一声低音', function () {
    floatEmoji('🙅', { count: 3, anim: 'slide', size: 48 });
    SOUNDS.error();
  });
  reg('emoji_yes', '🙆', '同意', 'emoji', '表情点头，响起成功音阶', function () {
    floatEmoji('🙆', { count: 3, anim: 'nod', size: 48 });
    SOUNDS.success();
  });
  reg('emoji_heart', '🫶', '比心', 'emoji', '双手比心，爱心向上飘', function () {
    floatEmoji('🫶', { count: 3, anim: 'float', size: 52 });
    burst('heart', 22, { colors: ['#ff6b9d', '#ffb3c7', '#ffd1dc'], gravity: -40, maxSpeed: 240 });
  });
  reg('emoji_star', '✨', '星星眼', 'emoji', '满屏闪烁的小星星', function () {
    floatEmoji('✨', { count: 8, anim: 'twinkle', size: 32 });
    burst('star', 24, { colors: ['#ffd166', '#fff3b0', '#c084fc'], gravity: 40, maxSpeed: 200 });
  });
  reg('emoji_tea', '🍵', '喝茶', 'emoji', '茶香袅袅，提醒你慢一点', function () {
    floatEmoji('🍵', { count: 2, anim: 'rise', size: 54 });
    floatEmoji('💨', { count: 3, anim: 'rise', size: 22 });
    SOUNDS.chime();
  });

  /* =========================================================
   * 2. 陪伴动作（12）
   * ======================================================= */
  reg('hug', '🤗', '抱抱', 'gesture', '张开手臂给你一个抱抱，并飘出爱心', function () {
    gesture('🤗', '抱抱', 'hug');
    burst('heart', 16, { colors: ['#ff6b9d', '#ffb3c7'], y: 0.5, gravity: -30, maxSpeed: 220 });
    SOUNDS.chime();
  });
  reg('headpat', '🫳', '摸头', 'gesture', '一只手落下轻轻摸头', function () {
    gesture('🫳', '摸摸头，辛苦啦', 'pat');
    SOUNDS.ding();
  });
  reg('highfive', '✋', '击掌', 'gesture', '隔着屏幕和你击掌', function () {
    gesture('✋', '击掌！', 'highfive');
    overlay('fx-flash', 260);
    SOUNDS.pop();
  });
  reg('fistbump', '👊', '碰拳', 'gesture', '碰个拳，默契达成', function () {
    gesture('👊', '碰拳', 'fistbump');
    SOUNDS.pop();
  });
  reg('wave', '👋', '挥手', 'gesture', '朝你挥挥手', function () {
    gesture('👋', '嗨～我在这儿', 'wave');
    SOUNDS.ding();
  });
  reg('cheer', '🎉', '加油', 'gesture', '彩带和掌声一起给你打气', function () {
    gesture('🎉', '加油，你可以的！', 'cheer');
    confettiRain();
    SOUNDS.success();
  });
  reg('flower', '🌸', '送花', 'gesture', '把一朵花轻轻放在你面前', function () {
    gesture('🌸', '送你一朵花', 'flower');
    floatEmoji('🌸', { count: 8, anim: 'fall', size: 26 });
    SOUNDS.chime();
  });
  reg('gift', '🎁', '送礼', 'gesture', '礼物盒打开，蹦出小惊喜', function () {
    gesture('🎁', '礼物来啦', 'gift');
    setTimeout(function () {
      gesture('🎊', '拆开看看？', 'gift');
      burst('spark', 30, { colors: ['#ffd166', '#ff6b9d', '#8b6cff'], maxSpeed: 320 });
    }, 650);
    SOUNDS.pop();
  });
  reg('dance', '💃', '跳舞', 'gesture', '陪你一起摇摆几下', function () {
    gesture('💃', '一起摇摆', 'dance');
    bodyEffect('fx-dancing', 2400);
    SOUNDS.success();
  });
  reg('spin', '🌀', '转圈', 'gesture', '原地转个圈，带出涟漪', function () {
    gesture('🌀', '转圈圈', 'spin');
    overlay('fx-ripple-ring', 1400);
    SOUNDS.whoosh();
  });
  reg('jump', '🐰', '蹦一下', 'gesture', '开心地蹦一下', function () {
    gesture('🐰', '蹦！', 'jump');
    bodyEffect('fx-nudge', 300);
    SOUNDS.pop();
  });
  reg('bow', '🙇', '鞠躬', 'gesture', '认真地鞠一躬说谢谢', function () {
    gesture('🙇', '谢谢你', 'bow');
    SOUNDS.chime();
  });

  /* =========================================================
   * 3. 屏幕特效（18）
   * ======================================================= */
  reg('confetti', '🎊', '撒花', 'screen', '漫天彩纸从顶部落下', function () {
    confettiRain();
    SOUNDS.pop();
  });
  reg('fireworks', '🎆', '烟花', 'screen', '在屏幕各处炸开烟花', function () {
    ensureCanvas();
    for (var i = 0; i < 5; i++) {
      (function (k) {
        setTimeout(function () {
          burst(k % 2 ? 'star' : 'circle', 46, {
            x: rand(0.15, 0.85), y: rand(0.2, 0.55),
            colors: ['#ffd166', '#ff6b9d', '#22d3ee', '#8b6cff', '#7ef29d'],
            gravity: 180, maxSpeed: 360, minLife: 1.1, maxLife: 1.9
          });
          SOUNDS.pop();
        }, k * 260);
      })(i);
    }
  });
  reg('hearts_rain', '💕', '爱心雨', 'screen', '粉色爱心从天上落下来', function () {
    ensureCanvas();
    for (var i = 0; i < 46; i++) {
      addP({
        kind: 'heart', x: rand(0, W), y: rand(-H * 0.5, 0),
        vx: rand(-30, 30), vy: rand(70, 190), g: 20, size: rand(6, 16),
        color: pick(['#ff6b9d', '#ff8fab', '#ffb3c7', '#ffd1dc']),
        rot: rand(-0.4, 0.4), vr: rand(-1, 1), life: rand(2.6, 4), maxLife: 4
      });
    }
    SOUNDS.chime();
  });
  reg('snow', '❄️', '下雪', 'screen', '安静的雪落满屏幕', function () {
    ensureCanvas();
    for (var i = 0; i < 90; i++) {
      addP({
        kind: 'circle', x: rand(0, W), y: rand(-H, 0),
        vx: rand(-18, 18), vy: rand(28, 80), g: 0, size: rand(1.4, 4.2),
        color: 'rgba(255,255,255,.85)', life: rand(5, 8), maxLife: 8
      });
    }
    tone(1200, 1.2, 'sine', 0, 0.02, 900);
  });
  reg('rain', '🌧️', '下雨', 'screen', '蓝色的雨线和一点潮湿的声音', function () {
    ensureCanvas();
    for (var i = 0; i < 110; i++) {
      addP({
        kind: 'streak', x: rand(0, W), y: rand(-H * 0.5, H * 0.4),
        vx: rand(20, 60), vy: rand(700, 1100), g: 200, size: rand(5, 10),
        color: 'rgba(125,211,252,.65)', life: rand(0.5, 0.9), maxLife: 0.9
      });
    }
    noiseBurst(0.55, 0.06, 1400);
  });
  reg('bubbles', '🫧', '泡泡', 'screen', '透明泡泡慢慢升起来', function () {
    ensureCanvas();
    for (var i = 0; i < 34; i++) {
      addP({
        kind: 'bubble', x: rand(0, W), y: H + rand(0, 180),
        vx: rand(-12, 12), vy: rand(-90, -40), g: 0, size: rand(8, 26),
        color: 'rgba(190,220,255,.7)', life: rand(3.5, 6), maxLife: 6
      });
    }
    SOUNDS.ding();
  });
  reg('starfield', '🌌', '星空', 'screen', '星点在屏幕上闪烁', function () {
    ensureCanvas();
    for (var i = 0; i < 80; i++) {
      addP({
        kind: 'star', x: rand(0, W), y: rand(0, H), vx: rand(-6, 6), vy: rand(-6, 6),
        g: 0, size: rand(1.5, 4), color: pick(['#fff', '#c4b5fd', '#a5f3fc', '#fef3c7']),
        life: rand(3, 6), maxLife: 6
      });
    }
    tone(880, 1.4, 'sine', 0, 0.02, 1320);
  });
  reg('shake', '🫨', '震屏', 'screen', '整个页面轻轻震一下', function () {
    bodyEffect('fx-shake', 520);
    SOUNDS.error();
  });
  reg('flash', '⚡', '闪光', 'screen', '一记白色闪光划过', function () {
    overlay('fx-flash', 420);
    SOUNDS.whoosh();
  });
  reg('ripple', '💧', '水波纹', 'screen', '从屏幕中心荡开一圈水纹', function () {
    overlay('fx-ripple-ring', 1500);
    SOUNDS.ding();
  });
  reg('pulse', '💓', '心跳', 'screen', '屏幕跟着心跳轻轻一缩一放', function () {
    bodyEffect('fx-pulse', 1800);
    SOUNDS.heartbeat();
  });
  reg('glitch', '📺', '故障闪烁', 'screen', '画面像老电视一样抖两下', function () {
    bodyEffect('fx-glitch', 900);
    noiseBurst(0.25, 0.08, 1800);
  });
  reg('spotlight', '🔦', '聚光灯', 'screen', '一束光落在屏幕中央', function () {
    overlay('fx-spotlight', 2400);
    SOUNDS.whoosh();
  });
  reg('vignette', '🎬', '暗角聚焦', 'screen', '四周暗下来，只剩画面中央', function () {
    overlay('fx-vignette', 2400);
    tone(220, 0.8, 'sine', 0, 0.03, 180);
  });
  reg('matrix', '🟩', '数字雨', 'screen', '绿色字符像代码雨一样落下', function () {
    ensureCanvas();
    var chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノ';
    for (var i = 0; i < 110; i++) {
      addP({
        kind: 'char', x: rand(0, W), y: rand(-H * 1.2, 0),
        vx: 0, vy: rand(180, 460), g: 0, size: rand(10, 18),
        color: pick(['#7ef29d', '#34d399', '#a7f3d0']),
        char: chars.charAt(Math.floor(Math.random() * chars.length)),
        life: rand(2, 3.4), maxLife: 3.4
      });
    }
    noiseBurst(0.4, 0.05, 600);
  });
  reg('aurora', '🌠', '极光', 'screen', '一层流动的极光覆盖整个页面', function () {
    overlay('fx-aurora', 4200);
    SOUNDS.chime();
  });
  reg('sparkles', '✨', '粒子闪烁', 'screen', '细碎的闪光在四周炸开', function () {
    burst('spark', 70, {
      colors: ['#ffd166', '#fff', '#c084fc', '#22d3ee'],
      x: 0.5, y: 0.45, maxSpeed: 520, minLife: 0.8, maxLife: 1.8
    });
    SOUNDS.ding();
  });
  reg('finale', '🎇', '终场烟火', 'screen', '彩纸、烟花、闪光一起上', function () {
    confettiRain();
    overlay('fx-flash', 300);
    for (var i = 0; i < 6; i++) {
      (function (k) {
        setTimeout(function () {
          burst(k % 2 ? 'star' : 'circle', 52, {
            x: rand(0.1, 0.9), y: rand(0.15, 0.6),
            colors: ['#ffd166', '#ff6b9d', '#22d3ee', '#8b6cff', '#7ef29d'],
            gravity: 160, maxSpeed: 420
          });
        }, k * 220);
      })(i);
    }
    SOUNDS.success();
  });

  /* =========================================================
   * 4. 声音（8）
   * ======================================================= */
  reg('sound_ding', '🔔', '叮', 'sound', '清脆的一声叮', function () { SOUNDS.ding(); toastNote('🔔 叮'); });
  reg('sound_pop', '🫧', '啵', 'sound', '小小的气泡破裂声', function () { SOUNDS.pop(); toastNote('🫧 啵'); });
  reg('sound_success', '🎵', '成功音阶', 'sound', '四个音符一路向上', function () { SOUNDS.success(); toastNote('🎵 叮咚叮咚'); });
  reg('sound_error', '🔻', '错误低音', 'sound', '两声低沉的提示音', function () { SOUNDS.error(); toastNote('🔻 咚…咚'); });
  reg('sound_whoosh', '💨', '嗖', 'sound', '一阵风从耳边掠过', function () { SOUNDS.whoosh(); toastNote('💨 嗖——'); });
  reg('sound_chime', '🎐', '风铃', 'sound', '一串轻轻的风铃声', function () { SOUNDS.chime(); toastNote('🎐 叮铃'); });
  reg('sound_heartbeat', '💗', '心跳声', 'sound', '两声真实的心跳', function () { SOUNDS.heartbeat(); toastNote('💗 咚、咚'); });
  reg('sound_typing', '⌨️', '键盘声', 'sound', '一阵快速敲键盘的声音', function () { SOUNDS.typing(); toastNote('⌨️ 哒哒哒'); });

  /* =========================================================
   * 5. 主题（8）
   * ======================================================= */
  var themeDefs = [
    ['theme_dark', '🌙', '深夜紫', 'dark', '切回默认的深夜紫主题'],
    ['theme_light', '☀️', '日光白', 'light', '切换成明亮的日光白主题'],
    ['theme_cyber', '🌃', '赛博霓虹', 'cyber', '切换成霓虹紫青的赛博主题'],
    ['theme_forest', '🌿', '森林绿', 'forest', '切换成安静的森林绿主题'],
    ['theme_ocean', '🌊', '深海蓝', 'ocean', '切换成深海蓝主题'],
    ['theme_sunset', '🌇', '日落橙', 'sunset', '切换成温暖的日落橙主题'],
    ['theme_mono', '📷', '黑白胶片', 'mono', '切换成黑白胶片主题'],
    ['theme_aurora', '🌠', '极光', 'aurora', '切换成流动的极光主题']
  ];
  themeDefs.forEach(function (t) {
    reg(t[0], t[1], t[2], 'theme', t[4], function () {
      applyTheme(t[3]);
      SOUNDS.ding();
    });
  });

  /* =========================================================
   * 6. 小工具（12）
   * ======================================================= */
  reg('coin', '🪙', '抛硬币', 'utility', '抛一枚硬币，正反面随机', utilCoin);
  reg('dice', '🎲', '掷骰子', 'utility', '掷一个六面骰子', utilDice);
  reg('random_pick', '🎯', '随机选择', 'utility', '从你给的两个以上选项里随机挑一个，text 传选项', utilRandom);
  reg('timer', '⏱️', '倒计时', 'utility', '开始一个倒计时，seconds 传秒数，默认 60', utilTimer);
  reg('breathe', '🫧', '呼吸练习', 'utility', '4-7-8 呼吸引导，帮你放松', utilBreathe);
  reg('focus', '🎧', '专注模式', 'utility', '开启 25 分钟专注并弱化界面干扰', utilFocus);
  reg('mood', '🌤️', '心情打卡', 'utility', '五个心情按钮，记录此刻心情', utilMood);
  reg('quote', '📜', '今日一句', 'utility', '一张句子卡片，可传入你自己的句子', utilQuote);
  reg('fortune', '🔮', '今日运势', 'utility', '抽一张今天的运势卡', utilFortune);
  reg('rps', '✊', '猜拳', 'utility', '和 AI 猜拳，三局两胜', utilRps);
  reg('spinner', '🎡', '命运转盘', 'utility', '转盘随机选一个，text 传候选', utilSpinner);
  reg('score', '📊', '评分卡', 'utility', '给一件事打个分，text 传评分对象', utilScore);

  /* =========================================================
   * 7. 文字效果（8）
   * ======================================================= */
  reg('typewriter', '⌨️', '打字机', 'text', '文字逐字打出来', function (a) {
    banner((a && a.text) || '这句话正在一个字一个字地出现……', 'typewriter', 4200);
    SOUNDS.typing();
  });
  reg('rainbow_text', '🌈', '彩虹字', 'text', '把文字渲染成彩虹渐变', function (a) {
    banner((a && a.text) || '今天也要闪闪发光', 'rainbow', 3000);
    SOUNDS.chime();
  });
  reg('glitch_text', '📺', '故障字', 'text', '文字像信号出错的屏幕一样抖动', function (a) {
    banner((a && a.text) || '信 号 不 稳 定', 'glitch', 2600);
    noiseBurst(0.3, 0.06, 1200);
  });
  reg('sparkle_text', '✨', '闪光字', 'text', '文字周围炸开闪光粒子', function (a) {
    banner((a && a.text) || '你是今天的小星星', 'sparkle', 3000);
    burst('spark', 40, { x: 0.5, y: 0.36, colors: ['#ffd166', '#fff', '#c084fc'], maxSpeed: 300 });
  });
  reg('whisper_text', '🤫', '悄悄话', 'text', '用很小的字在屏幕底部说一句', function (a) {
    banner((a && a.text) || '过来，我只告诉你一个人……', 'whisper', 3600);
    tone(480, 0.5, 'sine', 0, 0.025, 380);
  });
  reg('shout_text', '📢', '大声喊', 'text', '超大字加震动，全场都听得见', function (a) {
    banner((a && a.text) || '我 超 开 心 的 ！', 'shout', 2400);
    bodyEffect('fx-shake', 600);
    SOUNDS.error();
  });
  reg('echo_text', '🗣️', '回声', 'text', '文字一层层淡出的回声效果', function (a) {
    banner((a && a.text) || '你好呀……你好呀……', 'echo', 3000);
    SOUNDS.chime();
  });
  reg('wave_text', '🌊', '波浪字', 'text', '每个字像波浪一样上下起伏', function (a) {
    banner((a && a.text) || '起 起 伏 伏 的 一 句 话', 'wave', 3200);
    SOUNDS.whoosh();
  });

  /* ---------------- 对外接口 ---------------- */
  function init() {
    ensureCanvas();
  }
  function play(id, args) {
    var def = byId[id];
    if (!def) return false;
    try {
      def.run(args || {});
    } catch (e) {
      console.warn('[ix]', id, e);
    }
    return true;
  }

  window.IX = {
    list: list,
    cats: CATS,
    themes: THEMES,
    themeNames: THEME_NAMES,
    init: init,
    play: play,
    get: function (id) { return byId[id]; },
    has: function (id) { return !!byId[id]; },
    setCardHandler: function (fn) { pushCardFn = fn; },
    setSound: function (on) { soundOn = !!on; },
    getSound: function () { return soundOn; },
    setTheme: function (name) {
      if (THEMES.indexOf(name) === -1) return false;
      document.documentElement.setAttribute('data-theme', name);
      try { localStorage.setItem('yg_ai_theme', name); } catch (e) {}
      return true;
    },
    currentTheme: function () {
      return document.documentElement.getAttribute('data-theme') || 'dark';
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
