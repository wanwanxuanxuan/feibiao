/* ============================================================
    《超级家长模拟器》 — 引擎层
    ============================================================ */
import * as THREE from 'three';
import { World } from './scene.js';
import { SCRIPT, MOODS, ENDINGS, EGG } from './story.js';

/* ---------------- DOM ---------------- */
const $ = (id) => document.getElementById(id);
const app = $('app');
const canvas = $('gl');
const topbar = $('topbar');
const chapterName = $('chapterName');
const chapterSub = $('chapterSub');
const dialogue = $('dialogue');
const whoEl = $('who');
const txtEl = $('txt');
const nextEl = $('next');
const choicesEl = $('choices');
const taskEl = $('taskpanel');
const modal = $('modal');
const modalTitle = $('modalTitle');
const modalBody = $('modalBody');
const modalFoot = $('modalFoot');
const toasts = $('toasts');
const inventory = $('inventory');
const cracksEl = $('cracks');
const redpulse = $('redpulse');
const flash = $('flash');
const startScreen = $('startScreen');
const endScreen = $('endScreen');

const statEls = {
  ob: { root: $('statOb'), val: $('statOb').querySelector('b'), bar: $('statOb').querySelector('i') },
  tr: { root: $('statTr'), val: $('statTr').querySelector('b'), bar: $('statTr').querySelector('i') },
  fa: { root: $('statFa'), val: $('statFa').querySelector('b'), bar: $('statFa').querySelector('i') },
};

/* 黑场遮蔽 */
const fade = document.createElement('div');
fade.className = 'fx';
fade.style.cssText = 'z-index:8;background:#000;opacity:0;transition:opacity .9s ease;pointer-events:none';
app.appendChild(fade);

/* 点击提示条 */
const hint = document.createElement('div');
hint.style.cssText = 'position:absolute;left:50%;bottom:calc(120px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:24;display:none;align-items:center;gap:10px;background:rgba(12,10,8,.78);border:1px solid rgba(240,180,90,.4);border-radius:999px;padding:8px 14px;font-size:13px;color:#e9e4da;backdrop-filter:blur(8px);pointer-events:auto;white-space:nowrap';
app.appendChild(hint);

/* ---------------- 状态 ---------------- */
const state = { ob: 0, tr: 0, fa: 0, l1: null, l2: null, l3: null, l4: null, items: [], ach: [], stop: false };
let world = null;
let waitState = 'idle';       // idle | say | typing | choice | popup | pick | ending
let sayResolve = null;
let typeTimer = null;
let fullText = '';

/* ---------------- 音效（WebAudio 合成，无需素材） ---------------- */
const SFX = (() => {
  let ctx = null, on = true;
  const ensure = () => {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { on = false; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  function tone(freq, dur, type = 'sine', gain = 0.06, slideTo) {
    const c = ensure(); if (!c || !on) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(gain, c.currentTime + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dur + 0.03);
  }
  function noise(dur = 0.35, gain = 0.16, lp = 2400) {
    const c = ensure(); if (!c || !on) return;
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
    const g = c.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(c.destination); src.start();
  }
  return {
    unlock: ensure,
    tick: () => tone(880, 0.05, 'square', 0.03),
    ding: () => { tone(1046, 0.12, 'sine', 0.05); setTimeout(() => tone(1568, 0.2, 'sine', 0.045), 90); },
    smash: () => { noise(0.45, 0.22, 5200); tone(140, 0.25, 'sawtooth', 0.05, 60); },
    stab: () => { tone(220, 0.5, 'sawtooth', 0.05, 90); noise(0.5, 0.1, 900); },
    pop: () => tone(520, 0.09, 'triangle', 0.04),
  };
})();

/* ---------------- 工具 ---------------- */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (s) => String(s)
  .replace(/\{ob\}/g, state.ob).replace(/\{tr\}/g, state.tr).replace(/\{fa\}/g, state.fa)
  .replace(/<tip>/g, '<span class="tip">').replace(/<\/tip>/g, '</span>')
  .replace(/<bad>/g, '<span class="warn">').replace(/<\/bad>/g, '</span>')
  .replace(/<good>/g, '<span class="good">').replace(/<\/good>/g, '</span>')
  .replace(/<stat>/g, '<span class="stat-line">').replace(/<\/stat>/g, '</span>')
  .replace(/<small>/g, '<span style="color:#8b8577;font-size:.92em">').replace(/<\/small>/g, '</span>');

const WHO_LABEL = { narrator: '旁白', system: '系统', self: '你', kid: '小杰', tv: '电视', boss: '系统' };

function updateStats(delta = {}) {
  for (const k of ['ob', 'tr', 'fa']) {
    if (delta[k] == null) continue;
    state[k] = Math.max(0, state[k] + delta[k]);
    const el = statEls[k];
    el.val.textContent = state[k];
    el.bar.style.width = Math.min(100, state[k]) + '%';
    el.root.classList.remove('bump'); void el.root.offsetWidth; el.root.classList.add('bump');
  }
}

function addItem(name) {
  if (!name || state.items.includes(name)) return;
  state.items.push(name);
  const d = document.createElement('div');
  d.className = 'item';
  d.textContent = '🎒 ' + name;
  inventory.appendChild(d);
  inventory.classList.add('on');
}

function showToast(o) {
  const d = document.createElement('div');
  d.className = 'toast';
  d.innerHTML = `<div class="t1">${fmt(o.title || '')}</div>
    <div class="t2">${fmt(o.line || '')}</div>${o.sub ? `<div class="t3">${fmt(o.sub)}</div>` : ''}`;
  toasts.appendChild(d);
  SFX.ding();
  setTimeout(() => d.remove(), 3800);
}

/* ---------------- 裂纹叠层 ---------------- */
let crackCount = 0;
let svgRoot = null;
function addCrack() {
  if (!svgRoot) {
    cracksEl.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none"></svg>';
    svgRoot = cracksEl.querySelector('svg');
  }
  const ns = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns, 'g');
  // 从边缘向内的树枝裂纹
  const edges = [
    { x: 0, y: Math.random() * 100, dx: 1, dy: (Math.random() - .5) },
    { x: 100, y: Math.random() * 100, dx: -1, dy: (Math.random() - .5) },
    { x: Math.random() * 100, y: 0, dx: (Math.random() - .5), dy: 1 },
    { x: Math.random() * 100, y: 100, dx: (Math.random() - .5), dy: -1 },
  ];
  const e = edges[crackCount % edges.length];
  function branch(x, y, dx, dy, len, depth) {
    const nx = x + dx * len, ny = y + dy * len;
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', `M${x.toFixed(2)},${y.toFixed(2)} L${nx.toFixed(2)},${ny.toFixed(2)}`);
    p.setAttribute('vector-effect', 'non-scaling-stroke');
    p.setAttribute('stroke-width', (1.25 - depth * 0.22).toFixed(2));
    g.appendChild(p);
    if (depth > 0) {
      const a = Math.atan2(dy, dx);
      branch(nx, ny, Math.cos(a + 0.55 + Math.random() * .3), Math.sin(a + 0.55 + Math.random() * .3), len * 0.55, depth - 1);
      branch(nx, ny, Math.cos(a - 0.55 - Math.random() * .3), Math.sin(a - 0.55 - Math.random() * .3), len * 0.5, depth - 1);
    }
  }
  const n = Math.hypot(e.dx, e.dy) || 1;
  branch(e.x, e.y, e.dx / n, e.dy / n * 0.6, 4 + Math.random() * 4, 3);
  svgRoot.appendChild(g);
  crackCount++;
  cracksEl.style.opacity = Math.min(1, 0.22 + crackCount * 0.26);
  SFX.stab();
}
function healCracks() {
  cracksEl.style.opacity = 0;
  setTimeout(() => { cracksEl.innerHTML = ''; svgRoot = null; }, 1600);
  crackCount = 0;
}
function doFlash(ms = 130) {
  flash.classList.add('hit');
  setTimeout(() => flash.classList.remove('hit'), ms);
}

/* ---------------- 对白 ---------------- */
function setWho(who) {
  whoEl.className = 'who ' + (who === 'tv' ? 'self' : who === 'boss' ? 'boss' : who);
  whoEl.textContent = WHO_LABEL[who] || '旁白';
}

function typeText(el, text, speed = 24) {
  return new Promise((resolve) => {
    clearTimeout(typeTimer);
    let i = 0;
    el.innerHTML = '';
    el.classList.add('typing');
    const step = () => {
      if (state.stop) return resolve();
      if (i >= text.length) { el.classList.remove('typing'); return resolve(); }
      // 按标签整体推进（简单处理：跳过 <...> 段落不加延迟）
      if (text[i] === '<') {
        const close = text.indexOf('>', i);
        if (close !== -1) { i = close + 1; el.innerHTML = text.slice(0, i); return step(); }
      }
      i++;
      el.innerHTML = text.slice(0, i) + (i < text.length ? '<span style="opacity:.0"></span>' : '');
      typeTimer = setTimeout(step, speed);
    };
    step();
  });
}

function showDialogue(who, text) {
  setWho(who);
  fullText = fmt(text);
  dialogue.classList.add('on');
  nextEl.style.display = 'none';
  waitState = 'typing';
  return new Promise((resolve) => {
    sayResolve = resolve;
    typeText(txtEl, fullText).then(() => {
      if (state.stop) return;
      waitState = 'say';
      nextEl.style.display = 'block';
    });
  });
}
function finishSay() {
  if (waitState === 'typing') {
    clearTimeout(typeTimer);
    txtEl.innerHTML = fullText;
    txtEl.classList.remove('typing');
    waitState = 'say';
    nextEl.style.display = 'block';
  } else if (waitState === 'say') {
    nextEl.style.display = 'none';
    waitState = 'idle';
    const r = sayResolve; sayResolve = null;
    if (r) r();
  }
}
function hideDialogue() {
  dialogue.classList.remove('on');
  waitState = 'idle';
}

/* ---------------- 弹窗 ---------------- */
function showPopup(node) {
  const kind = node.kind || 'guide';
  const colors = {
    warn: { b: 'rgba(220,180,60,.55)', c: '#ffd76a' },
    report: { b: 'rgba(120,170,220,.5)', c: '#a9d4f5' },
    green: { b: 'rgba(90,201,138,.5)', c: '#8ff0bb' },
    blood: { b: 'rgba(255,60,40,.7)', c: '#ff8a72' },
    guide: { b: 'rgba(240,180,90,.5)', c: '#f0b45a' },
  }[kind] || { b: 'rgba(240,180,90,.5)', c: '#f0b45a' };
  const card = modal.querySelector('.card');
  card.style.borderColor = colors.b;
  modalTitle.textContent = node.title || '系统提示';
  modalTitle.style.color = colors.c;
  modalBody.innerHTML = fmt(node.body || '');
  modalFoot.innerHTML = '';
  const btn = document.createElement('button');
  btn.className = 'btn primary';
  btn.textContent = node.btn || '继续';
  modalFoot.appendChild(btn);
  modal.classList.add('on');
  if (kind === 'blood') {
    if (world) { world.shake(1.2, 0.9); world.setMood(MOODS.sick_red); }
    redpulse.style.opacity = '1';
    SFX.stab();
  } else SFX.pop();
  return new Promise((resolve) => {
    waitState = 'popup';
    btn.addEventListener('click', () => {
      modal.classList.remove('on');
      redpulse.style.opacity = '0';
      waitState = 'idle';
      SFX.pop();
      resolve();
    }, { once: true });
  });
}

/* ---------------- 任务面板 ---------------- */
function showTask(node) {
  taskEl.style.display = 'block';
  taskEl.innerHTML = `<h3>任务面板</h3>
    <div class="row"><span class="k">任务目标</span><span class="v">${fmt(node.goal)}</span></div>
    <div class="row"><span class="k">推荐方案</span><span class="v ghost">${fmt(node.recommend)}</span></div>
    <div class="row"><span class="k">实际可用方案</span><span class="v arrow">${fmt(node.actual)}</span></div>`;
}
const hideTask = () => { taskEl.style.display = 'none'; };

/* ---------------- 选项 ---------------- */
function showChoice(node) {
  waitState = 'choice';
  const opts = node.options.filter((o) => !o.showIf || o.showIf(state));
  const defKey = node.def;
  choicesEl.style.display = 'flex';
  choicesEl.innerHTML =
    `<div class="head"><span class="${node.danger ? 'danger' : ''}">${node.danger ? '⚠ ' : ''}${node.prompt}</span>
      <span class="timerbar ${node.danger ? 'danger' : ''}"><i></i></span>
      <span class="tnum">${node.timer}s</span></div>`;
  const bar = choicesEl.querySelector('.timerbar i');
  const tnum = choicesEl.querySelector('.tnum');

  return new Promise((resolve) => {
    let done = false;
    const buttons = [];
    opts.forEach((o, idx) => {
      const b = document.createElement('button');
      b.className = 'choice' + (o.k === defKey ? ' auto' : '');
      b.style.animationDelay = (idx * 0.07) + 's';
      b.innerHTML = `<span class="tag">${o.k}</span><span>${fmt(o.label)}${
        o.notes ? `<br><span style="color:#8b8577;font-size:.88em">（${fmt(o.notes)}）</span>` : ''}</span>`;
      b.addEventListener('click', () => pick(o, idx), { once: true });
      choicesEl.appendChild(b);
      buttons.push(b);
    });

    // 倒计时
    let left = node.timer;
    const t0 = performance.now();
    let lastTick = Math.ceil(node.timer);
    const tickFn = () => {
      if (done) return;
      const elapsed = (performance.now() - t0) / 1000;
      const f = Math.max(0, 1 - elapsed / node.timer);
      bar.style.transform = `scaleX(${f})`;
      const l = Math.ceil(node.timer - elapsed);
      if (l !== lastTick) { lastTick = l; if (l > 0 && l <= 3) SFX.tick(); }
      tnum.textContent = Math.max(0, l) + 's';
      if (f <= 0) {
        done = true;
        const d = opts.find((o) => o.k === defKey) || opts[0];
        const db = buttons[opts.indexOf(d)];
        if (db) { db.classList.add('chosen'); sfxTimeout(db); }
        setTimeout(() => pick(d, opts.indexOf(d), true), 260);
        return;
      }
      requestAnimationFrame(tickFn);
    };
    function sfxTimeout(b) { SFX.stab(); }
    // 初始化条
    bar.style.transition = 'none';
    bar.style.transform = 'scaleX(1)';
    requestAnimationFrame(tickFn);

    function pick(o, idx, auto) {
      if (done && !auto) return;
      done = true;
      state[node.id] = o.k;
      SFX.pop();
      buttons.forEach((b) => { b.disabled = true; });
      const chosen = buttons[idx];
      if (chosen) chosen.classList.add('chosen');
      choicesEl.style.opacity = '0';
      choicesEl.style.transition = 'opacity .28s ease';
      setTimeout(() => {
        choicesEl.style.display = 'none';
        choicesEl.innerHTML = '';
        choicesEl.style.opacity = '1';
        waitState = 'idle';
        resolve(o);
      }, 300);
    }
  });
}

/* ---------------- 点击提示 / 3D 交互 ---------------- */
function showHint(text) {
  hint.style.display = 'flex';
  hint.innerHTML = `<span>👆 ${text}</span>`;
  const skip = document.createElement('button');
  skip.className = 'btn';
  skip.style.padding = '4px 12px'; skip.style.fontSize = '12px';
  skip.textContent = '跳过';
  hint.appendChild(skip);
  return skip;
}
async function doPick(node) {
  waitState = 'pick';
  const skip = showHint(node.hint);
  let done = false;
  const promise = new Promise((res) => {
    const fin = () => { if (done) return; done = true; hint.style.display = 'none'; waitState = 'idle'; res(); };
    skip.addEventListener('click', fin, { once: true });
    const tm = setTimeout(fin, 9000);
    if (world) world.setInteractable(node.name).then(() => { clearTimeout(tm); SFX.ding(); fin(); });
  });
  return promise;
}

/* ---------------- 场景切换 ---------------- */
let curSet = 'living';
function applyStage(node) {
  if (!world) return;
  if (node.set) {
    curSet = node.set;
    world.showSet(node.set, node.mood && MOODS[node.mood]);
  }
  if (node.shot) world.setCamera(curSet, node.shot, node.dur == null ? 1.5 : node.dur);
  if (node.kid) world.showKid(node.kid.pose, node.kid.pos, node.kid.rotY);
  else if (node.kid === null) world.hideKid();
}

/* ---------------- 结局 ---------------- */
function showEnding(key) {
  const e = ENDINGS[key];
  state.stop = true;
  waitState = 'ending';
  if (world) world.hideKid();
  const mb = modal;
  mb.classList.remove('on');
  hideDialogue();
  choicesEl.style.display = 'none';
  hideTask();
  endScreen.querySelector('#endSub').textContent = e.sub;
  endScreen.querySelector('#endTitle').textContent = e.title;
  endScreen.querySelector('#endBody').innerHTML = fmt(e.body);
  endScreen.querySelector('#endScore').textContent = e.score;
  endScreen.querySelector('#endStamp').textContent = e.stamp;
  endScreen.querySelector('#btnEgg').style.display = 'inline-block';
  endScreen.classList.add('on');
  SFX.ding();
}

function showEggScreen() {
  endScreen.querySelector('#endSub').textContent = '🎬';
  endScreen.querySelector('#endTitle').textContent = EGG.title;
  endScreen.querySelector('#endBody').innerHTML =
    EGG.lines.map((l) => `<div style="margin-bottom:10px">${fmt(l)}</div>`).join('') +
    `<div style="margin:16px 0;padding:12px 14px;border-radius:12px;border:1px solid rgba(240,180,90,.5);background:rgba(46,36,20,.6)">
      <div style="color:#f0b45a;font-size:13px;letter-spacing:.12em">${EGG.ach.title}</div>
      <div style="margin-top:6px">${EGG.ach.line}</div>
    </div>` +
    `<div style="white-space:pre-wrap;color:#b9b2a4;border-left:2px solid rgba(240,180,90,.5);padding-left:14px;margin:14px 0">${EGG.note}</div>` +
    `<div style="text-align:center;letter-spacing:.14em;color:#e9e4da;margin:18px 0 6px">${EGG.final}</div>` +
    `<div style="text-align:center;letter-spacing:.3em;color:#6d675e;font-size:12px">—— 全剧终 ——</div>`;
  endScreen.querySelector('#endScore').textContent = '';
  endScreen.querySelector('#endStamp').textContent = '';
  endScreen.querySelector('#btnEgg').style.display = 'none';
  endScreen.classList.add('on');
  endScreen.scrollTop = 0;
  showToast({ title: EGG.ach.title, line: EGG.ach.line });
  SFX.ding();
}

/* ---------------- 主流程 ---------------- */
async function handle(node) {
  if (state.stop) return;
  switch (node.t) {
    case 'black':
      if (node.on) { fade.style.opacity = '1'; await wait(900); }
      else { fade.style.opacity = '0'; await wait(900); }
      break;
    case 'chapter':
      chapterName.textContent = node.name;
      chapterSub.textContent = node.sub;
      topbar.classList.add('on');
      SFX.pop();
      await wait(450);
      break;
    case 'stage':
      hideTask();
      hideDialogue();
      await wait(120);
      applyStage(node);
      await wait(420);
      break;
    case 'say':
      hideTask();
      await showDialogue(node.who, node.text);
      await wait(90);
      break;
    case 'popup':
      hideDialogue();
      await showPopup(node);
      await wait(120);
      break;
    case 'task':
      showTask(node);
      SFX.pop();
      await wait(500);
      break;
    case 'toast':
      showToast(node);
      await wait(600);
      break;
    case 'tv':
      if (world) world.setTvScreen(node.kind);
      await wait(200);
      break;
    case 'monitor':
      if (world) world.setMonitor(node.kind);
      await wait(200);
      break;
    case 'pick':
      await doPick(node);
      break;
    case 'fx':
      await handleFx(node);
      break;
    case 'choice': {
      hideTask();
      hideDialogue();
      await wait(200);
      const o = await showChoice(node);
      updateStats(o.stats || {});
      if (o.ach) { showToast({ title: o.ach.title, line: o.ach.line }); }
      if (o.item) addItem(o.item);
      if (o.stats && (o.stats.tr > 0)) { if (world) world.shake(0.5, 0.5); }
      await wait(220);
      hideTask();
      for (const b of (o.beats || [])) { if (state.stop) return; await handle(b); }
      break;
    }
    case 'ending':
      showEnding(node.key);
      break;
  }
}

async function handleFx(node) {
  switch (node.what) {
    case 'shake': if (world) world.shake(0.8, 0.7); doFlash(90); await wait(240); break;
    case 'shatter':
      if (world) { world.crackPhone(); world.shatterPhone(new THREE.Vector3(-0.28, 0.62, -0.5)); }
      SFX.smash(); doFlash(160); await wait(500); break;
    case 'crack': addCrack(); await wait(500); break;
    case 'redpulse': redpulse.style.opacity = '1'; await wait(700); redpulse.style.opacity = '0.25'; await wait(300); break;
    case 'flip': if (world) world.flipOldPhoto(true); SFX.ding(); await wait(600); break;
    case 'heal': healCracks(); SFX.ding(); await wait(400); break;
  }
}

/* ---------------- 输入 ---------------- */
let inputLocked = false;
function advance() {
  if (waitState === 'typing' || waitState === 'say') finishSay();
}
app.addEventListener('pointerup', (e) => {
  if (inputLocked) return;
  if (e.target.closest('button') || e.target.closest('#modal')) return;
  if (waitState === 'typing' || waitState === 'say') advance();
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); advance(); }
});

/* ---------------- 启动 ---------------- */
function boot() {
  try {
    world = new World(canvas);
  } catch (err) {
    console.warn('WebGL 初始化失败，降级为纯文字模式：', err);
    canvas.style.display = 'none';
    document.body.style.background = 'radial-gradient(ellipse at 50% 40%, #1c1610, #06060a)';
    world = null;
  }
  updateStats({});
  $('btnStart').addEventListener('click', start);
  $('btnQuick').addEventListener('click', () => { SFX.unlock(); quickTrueEnd(); });
  $('btnAgain').addEventListener('click', () => location.reload());
  $('btnEgg').addEventListener('click', showEggScreen);
}

async function quickTrueEnd() {
  state.stop = true;
  startScreen.classList.remove('on');
  topbar.classList.add('on');
  if (world) {
    world.showSet('living', MOODS.night_warm);
    world.setCamera('living', 'photo', 1.4);
    world.hideKid();
    await wait(1400);
    world.flipOldPhoto(true);
    await wait(800);
  }
  state.stop = false;
  showEnding('true');
}

async function start() {
  SFX.unlock();
  inputLocked = true;
  startScreen.classList.remove('on');
  topbar.classList.add('on');
  await wait(500);
  inputLocked = false;
  for (const node of SCRIPT) {
    if (state.stop) break;
    await handle(node);
  }
}

boot();
