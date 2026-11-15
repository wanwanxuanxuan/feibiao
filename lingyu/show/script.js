/* 灵屿 · 一分钟自动演示 */
(() => {
  const DURATION = 60;
  const STARTS = [0, 7, 17, 28, 39, 49, 56];
  const showEl = document.getElementById('show');
  const scenes = [...document.querySelectorAll('.scene')];
  const chapterEls = [...document.querySelectorAll('#chapters button')];
  const barEl = document.getElementById('bar');
  const timeEl = document.getElementById('hudTime');
  const toggleEl = document.getElementById('toggle');
  const replayEl = document.getElementById('replay');
  const ticksEl = document.getElementById('ticks');
  const cursorEl = document.getElementById('flyCursor');

  /* 光标巡游脚本：鼠标滑到哪，哪一块开始演示 */
  const ROUTINES = [
    [
      { at: 900, pos: '.island-mini', hit: ['.island-mini'] },
      { at: 3400, pos: '.intro-wrap h1 em', hit: ['.intro-wrap h1 em'] },
      { at: 5600, pos: '.intro-foot' }
    ],
    [
      { at: 1400, pos: '.island-media', hit: ['.island', '.island-media'] },
      { at: 3600, pos: '.island-stats', hit: ['.island-stats'] },
      { at: 6200, pos: '.island-head', hit: ['.island-head'] },
      { at: 8400, pos: '.chips', hit: ['.chips'] }
    ],
    [0, 1, 2, 3, 4, 5].map((i) => ({
      at: 1400 + i * 1200,
      pos: `.ability:nth-child(${i + 1})`,
      hit: [`.ability:nth-child(${i + 1})`]
    })),
    [
      { at: 700, pos: '.ring', hit: ['.ring'] },
      { at: 5200, pos: '.focus-tags span:nth-child(1)', hit: ['.focus-tags span:nth-child(1)'] },
      { at: 6400, pos: '.focus-tags span:nth-child(2)', hit: ['.focus-tags span:nth-child(2)'] },
      { at: 7600, pos: '.focus-tags span:nth-child(3)', hit: ['.focus-tags span:nth-child(3)'] }
    ],
    [
      { at: 700, pos: '.desk-edge', hit: ['.desk-edge'], add: [['.desk-island', 'wake']] },
      { at: 4300, pos: '.desk-island', hit: ['.desk-island'], add: [['.desk-island', 'off']] },
      { at: 7800, pos: '.desk-hint', hit: ['.desk-hint'] }
    ],
    [
      { at: 600, pos: '.s-island', hit: ['.s-island'] },
      { at: 2400, pos: '.swatches', hit: ['.swatches'] },
      { at: 4400, pos: '.s-slider', hit: ['.s-slider'] }
    ],
    [{ at: 1200, pos: '.outro-mark', hit: ['.outro-mark'] }]
  ];

  let routineTimers = [];

  const jumpCursor = (x, y) => {
    cursorEl.style.transition = 'none';
    cursorEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    void cursorEl.offsetWidth;
    cursorEl.style.transition = '';
  };

  const glideCursor = (el) => {
    const r = el.getBoundingClientRect();
    const x = Math.min(Math.max(r.left + r.width / 2, 12), innerWidth - 12);
    const y = Math.min(Math.max(r.top + r.height / 2, 12), innerHeight - 12);
    cursorEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  const clickCursor = () => {
    cursorEl.classList.remove('tap');
    void cursorEl.offsetWidth;
    cursorEl.classList.add('tap');
    routineTimers.push(setTimeout(() => cursorEl.classList.remove('tap'), 620));
  };

  const runRoutine = (index) => {
    routineTimers.forEach(clearTimeout);
    routineTimers = [];
    cursorEl.classList.remove('tap');
    document.querySelectorAll('.hit').forEach((el) => el.classList.remove('hit'));
    document.querySelectorAll('.wake, .off').forEach((el) => el.classList.remove('wake', 'off'));

    const steps = ROUTINES[index] || [];
    if (!steps.length) return;

    cursorEl.classList.add('ready');
    jumpCursor(innerWidth * 0.16, innerHeight * 0.82);

    steps.forEach((step) => {
      routineTimers.push(setTimeout(() => {
        const target = document.querySelector(step.pos);
        if (target) glideCursor(target);
      }, Math.max(0, step.at - 780)));

      routineTimers.push(setTimeout(() => {
        (step.hit || []).forEach((sel) => {
          const target = document.querySelector(sel);
          if (!target) return;
          target.classList.remove('hit');
          void target.offsetWidth;
          target.classList.add('hit');
        });
        (step.add || []).forEach(([sel, cls]) => {
          const target = document.querySelector(sel);
          if (!target) return;
          if (cls === 'off') target.classList.remove('wake');
          target.classList.remove(cls);
          void target.offsetWidth;
          target.classList.add(cls);
        });
        clickCursor();
      }, step.at));
    });
  };


  let time = 0;
  let current = -1;
  let playing = true;
  let last = performance.now();

  const pad = (n) => String(Math.floor(n)).padStart(2, '0');
  const fmt = (s) => `${pad(s / 60)}:${pad(s % 60)}`;
  const indexAt = (t) => {
    for (let i = STARTS.length - 1; i >= 0; i--) {
      if (t >= STARTS[i]) return i;
    }
    return 0;
  };

  /* 章节刻度 */
  STARTS.slice(1).forEach((s) => {
    const tick = document.createElement('b');
    tick.style.left = `${(s / DURATION) * 100}%`;
    ticksEl.appendChild(tick);
  });

  const setScene = (index) => {
    if (index === current && scenes[index].classList.contains('active')) return;
    scenes.forEach((scene, i) => scene.classList.toggle('active', i === index));
    chapterEls.forEach((btn, i) => btn.classList.toggle('on', i === index));
    current = index;
    runRoutine(index);
  };

  const restartScene = (index) => {
    scenes.forEach((scene) => scene.classList.remove('active'));
    void scenes[index].offsetWidth;
    current = -1;
    setScene(index);
  };

  const setPlaying = (next) => {
    playing = next;
    showEl.classList.toggle('is-paused', !playing);
    toggleEl.textContent = playing ? '暂停' : '播放';
  };

  const seek = (seconds) => {
    time = Math.max(0, Math.min(DURATION - 0.001, seconds));
    const index = indexAt(time);
    restartScene(index);
    last = performance.now();
  };

  const frame = (now) => {
    const dt = Math.min(0.12, (now - last) / 1000);
    last = now;

    if (playing) {
      time += dt;
      if (time >= DURATION) time -= DURATION;
    }

    setScene(indexAt(time));
    barEl.style.width = `${(time / DURATION) * 100}%`;
    timeEl.textContent = `${fmt(time)} / 01:00`;
    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);

  toggleEl.addEventListener('click', () => setPlaying(!playing));

  replayEl.addEventListener('click', () => {
    seek(0);
    setPlaying(true);
  });

  chapterEls.forEach((btn) => {
    btn.addEventListener('click', () => {
      seek(Number(btn.dataset.jump));
      setPlaying(true);
    });
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      setPlaying(!playing);
    } else if (e.key === 'r' || e.key === 'R') {
      seek(0);
      setPlaying(true);
    } else if (e.key === 'ArrowRight') {
      seek(time + 5);
    } else if (e.key === 'ArrowLeft') {
      seek(time - 5);
    }
  });

  document.addEventListener('visibilitychange', () => {
    last = performance.now();
  });
})();
