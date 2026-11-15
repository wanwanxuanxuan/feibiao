/* 灵屿官网 — 轻量动态效果，无外部依赖 */
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  /* 顶栏滚动状态 */
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 24);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* 实时时钟 */
  const clock = $('#liveClock');
  const tick = () => {
    if (!clock) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    clock.textContent = `${hh}:${mm}`;
  };
  tick();
  setInterval(tick, 1000);

  /* 光标光晕 */
  const glow = $('#cursorGlow');
  if (glow && !reduced && matchMedia('(pointer:fine)').matches) {
    let gx = innerWidth / 2, gy = innerHeight / 2, tx = gx, ty = gy;
    window.addEventListener('pointermove', (e) => {
      tx = e.clientX; ty = e.clientY;
      glow.style.opacity = '1';
    }, { passive: true });
    const loop = () => {
      gx += (tx - gx) * 0.12; gy += (ty - gy) * 0.12;
      glow.style.transform = `translate(${gx}px, ${gy}px) translate(-50%, -50%)`;
      requestAnimationFrame(loop);
    };
    loop();
  }

  /* 滚动出现 */
  const reveal = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      reveal.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  $$('.reveal').forEach((el, i) => {
    el.style.transitionDelay = `${Math.min((i % 4) * 60, 180)}ms`;
    reveal.observe(el);
  });

  /* 数字递增 */
  const counters = $$('[data-count]');
  const countObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = Number(el.dataset.count);
      if (reduced || !target) { el.textContent = String(target); countObserver.unobserve(el); return; }
      const start = performance.now();
      const dur = 900;
      const step = (t) => {
        const p = Math.min(1, (t - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = String(Math.round(target * eased));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      countObserver.unobserve(el);
    });
  }, { threshold: 0.7 });
  counters.forEach((el) => countObserver.observe(el));

  /* 卡片轻微倾斜 */
  if (!reduced && matchMedia('(pointer:fine)').matches) {
    $$('.tilt').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5;
        const y = (e.clientY - r.top) / r.height - .5;
        card.style.transform = `perspective(800px) rotateX(${(-y * 3).toFixed(2)}deg) rotateY(${(x * 3).toFixed(2)}deg) translateY(-2px)`;
      });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    });
  }

  /* 主视觉视差 */
  const stage = $('.hero-stage');
  const hero = $('.hero');
  if (stage && hero && !reduced && matchMedia('(pointer:fine)').matches) {
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5;
      const y = (e.clientY - r.top) / r.height - .5;
      stage.style.transform = `translate3d(${x * 10}px, ${y * 8}px, 0)`;
    });
    hero.addEventListener('pointerleave', () => { stage.style.transform = ''; });
  }

  /* 完全隐藏演示 */
  const wake = $('#edgeWake');
  const demo = $('#demoIsland');
  if (wake && demo) {
    let hideTimer;
    const show = () => {
      clearTimeout(hideTimer);
      demo.classList.add('show');
      hideTimer = setTimeout(() => demo.classList.remove('show'), 4600);
    };
    const hide = () => {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => demo.classList.remove('show'), 900);
    };
    wake.addEventListener('pointerenter', show);
    wake.addEventListener('click', show);
    wake.addEventListener('pointerleave', hide);
    demo.addEventListener('pointerenter', () => clearTimeout(hideTimer));
    demo.addEventListener('pointerleave', hide);
    setTimeout(show, 1800);
  }

  /* 星尘画布 */
  const canvas = $('#dust');
  if (canvas && !reduced) {
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr = Math.min(devicePixelRatio || 1, 2);
    let particles = [];
    const resize = () => {
      w = innerWidth; h = innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(46, Math.round(w / 30));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 1.6 + .4,
        vx: (Math.random() - .5) * .16,
        vy: (Math.random() - .5) * .12,
        a: Math.random() * .3 + .08
      }));
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < -10) p.x = w + 10; if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10; if (p.y > h + 10) p.y = -10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(24, 92, 48, ${p.a})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(raf); else draw();
    });
  }
})();
