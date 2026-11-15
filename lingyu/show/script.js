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
