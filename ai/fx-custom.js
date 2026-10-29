/**
 * 小谷 · AI 自定义特效运行时
 * AI 输出 <fx>…JS…</fx>，这里把代码放进 Web Worker + OffscreenCanvas 沙箱执行，
 * 不接触页面 DOM / 存储 / 主线程，超时自动终止。
 * 暴露 window.FXC = { run, stopAll, supported, count }
 */
(function () {
  'use strict';

  var MAX_LIVE = 2;
  var MAX_CODE = 12000;
  var PALETTE = ['#8b6cff', '#22d3ee', '#ff6ec7', '#ffd166', '#7ef29d', '#ffffff'];
  var live = [];

  var WORKER_SRC = [
    'var window=self;',
    'var document={createElement:function(t){return new OffscreenCanvas(1,1);}};',
    'var requestAnimationFrame=function(){return 0;};',
    'var cancelAnimationFrame=function(){};',
    'var devicePixelRatio=1;',
    'var CANVAS=null,CTX=null,FN=null,DUR=4000,START=0,LAST=0,RUN=false;',
    'self.onmessage=function(e){',
    '  var d=e.data;',
    '  if(!d||d.type==="stop"){RUN=false;return;}',
    '  CANVAS=d.canvas; CTX=CANVAS.getContext("2d"); DUR=d.duration||4000;',
    '  START=performance.now(); LAST=START; RUN=true;',
    '  try{ FN=new Function("ctx","W","H","t","time","dt","rnd","palette","clear",d.code); }',
    '  catch(err){ self.postMessage({type:"error",message:"语法错误："+(err&&err.message||err)}); return; }',
    '  function rnd(seed){ var x=Math.sin(seed*12.9898+START*0.001)*43758.5453; return x-Math.floor(x); }',
    '  function clear(){ CTX.clearRect(0,0,CANVAS.width,CANVAS.height); }',
    '  function frame(){',
    '    if(!RUN) return;',
    '    var now=performance.now(), time=now-START, dt=now-LAST; LAST=now;',
    '    var t=Math.min(1,time/DUR);',
    '    try{ FN(CTX,CANVAS.width,CANVAS.height,t,time,dt,rnd,d.palette,clear); }',
    '    catch(err){ self.postMessage({type:"error",message:"运行错误："+(err&&err.message||err)}); RUN=false; return; }',
    '    if(t<1) setTimeout(frame,16); else self.postMessage({type:"done"});',
    '  }',
    '  frame();',
    '};'
  ].join('\n');

  function supported() {
    return typeof window.OffscreenCanvas !== 'undefined' &&
      typeof window.Worker !== 'undefined' &&
      typeof window.URL !== 'undefined' &&
      typeof window.URL.createObjectURL === 'function' &&
      typeof HTMLCanvasElement !== 'undefined' &&
      !!HTMLCanvasElement.prototype.transferControlToOffscreen;
  }

  function stop(handle) {
    var i = live.indexOf(handle);
    if (i > -1) live.splice(i, 1);
    if (handle.timer) { clearTimeout(handle.timer); handle.timer = 0; }
    if (handle.worker) {
      try { handle.worker.postMessage({ type: 'stop' }); } catch (e) {}
      try { handle.worker.terminate(); } catch (e) {}
      handle.worker = null;
    }
    if (handle.canvas && handle.canvas.parentNode) {
      handle.canvas.style.opacity = '0';
      var c = handle.canvas;
      setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); }, 260);
    }
  }

  function stopAll() {
    live.slice().forEach(stop);
  }

  /**
   * @param {string} code   AI 写的逐帧绘制函数体
   * @param {object} opts   { duration, onError, onDone }
   * @returns {object|null} 句柄（可 .stop()）
   */
  function run(code, opts) {
    opts = opts || {};
    if (!supported()) {
      if (opts.onError) opts.onError('当前浏览器不支持 AI 自定义特效');
      return null;
    }
    code = String(code || '').trim();
    if (!code) return null;
    if (code.length > MAX_CODE) code = code.slice(0, MAX_CODE);
    if (live.length >= MAX_LIVE) stop(live[0]);

    var duration = Math.max(1500, Math.min(12000, parseInt(opts.duration, 10) || 4000));

    var canvas = document.createElement('canvas');
    canvas.className = 'fx-custom-canvas';
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:903;opacity:1;transition:opacity .25s';
    var dpr = Math.min(1.5, window.devicePixelRatio || 1);
    canvas.width = Math.max(320, Math.round(window.innerWidth * dpr));
    canvas.height = Math.max(240, Math.round(window.innerHeight * dpr));
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);

    var handle = { canvas: canvas, worker: null, timer: 0 };
    live.push(handle);

    try {
      var off = canvas.transferControlToOffscreen();
      var blob = new Blob([WORKER_SRC], { type: 'text/javascript' });
      var url = URL.createObjectURL(blob);
      var worker = new Worker(url);
      URL.revokeObjectURL(url);
      handle.worker = worker;

      worker.onmessage = function (e) {
        var d = e.data || {};
        if (d.type === 'error') {
          if (opts.onError) opts.onError(d.message);
          stop(handle);
        } else if (d.type === 'done') {
          if (opts.onDone) opts.onDone();
          stop(handle);
        }
      };
      worker.onerror = function (e) {
        if (opts.onError) opts.onError((e && e.message) || '特效脚本异常');
        stop(handle);
      };

      worker.postMessage({ canvas: off, code: code, duration: duration, palette: PALETTE }, [off]);
    } catch (err) {
      stop(handle);
      if (opts.onError) opts.onError((err && err.message) || '特效启动失败');
      return null;
    }

    handle.timer = setTimeout(function () { stop(handle); }, duration + 1500);
    return handle;
  }

  window.FXC = {
    run: run,
    stopAll: stopAll,
    supported: supported,
    get count() { return live.length; },
    palette: PALETTE.slice()
  };
})();
