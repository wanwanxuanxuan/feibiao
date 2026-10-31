/* 小谷放歌：iTunes Search API（JSONP）在线搜歌，播放 30 秒官方试听片段 */
window.MUSIC = (function () {
  var seq = 0;
  var audio = null;
  var curCard = null;
  var curBtn = null;

  function jsonp(params, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var cb = '__music_cb_' + (++seq);
      var url = 'https://itunes.apple.com/search?' + Object.keys(params).map(function (k) {
        return k + '=' + encodeURIComponent(params[k]);
      }).join('&') + '&callback=' + cb;
      var script = document.createElement('script');
      var timer = setTimeout(function () { cleanup(); reject(new Error('timeout')); }, timeoutMs || 8000);

      function cleanup() {
        clearTimeout(timer);
        try { delete window[cb]; } catch (e) { window[cb] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      }
      window[cb] = function (data) { cleanup(); resolve(data); };
      script.onerror = function () { cleanup(); reject(new Error('network')); };
      script.src = url;
      document.head.appendChild(script);
    });
  }

  function search(q) {
    // 注意：不能带 country=cn，苹果中国区音乐库为空，会返回 0 条
    return jsonp({
      term: q,
      media: 'music',
      entity: 'song',
      limit: 6
    }).then(function (data) {
      return (data && data.results ? data.results : []).filter(function (t) {
        return t && t.previewUrl;
      });
    }).catch(function () { return []; });
  }

  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = 'auto';
    return audio;
  }

  function resetCard() {
    if (curCard) {
      curCard.classList.remove('is-playing');
      var bar = curCard.querySelector('.mc-progress i');
      if (bar) bar.style.width = '0%';
    }
    if (curBtn) curBtn.textContent = '▶';
    curCard = null;
    curBtn = null;
  }

  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    return (sec < 10 ? '0' : '') + sec;
  }

  function show(track, host) {
    if (!host) return;
    var card = document.createElement('div');
    card.className = 'music-card';
    var cover = String(track.artworkUrl100 || '').replace('/100x100bb', '/300x300bb');
    card.innerHTML =
      '<div class="mc-cover"' + (cover ? ' style="background-image:url(\'' + cover.replace(/"/g, '%22') + '\')"' : '') + '>' +
        '<button type="button" class="mc-play" aria-label="播放">▶</button>' +
      '</div>' +
      '<div class="mc-main">' +
        '<div class="mc-title"></div>' +
        '<div class="mc-artist"></div>' +
        '<div class="mc-row"><div class="mc-progress"><i></i></div><span class="mc-time">00 / 00</span></div>' +
        '<div class="mc-note">网络试听 · 30 秒</div>' +
      '</div>';
    card.querySelector('.mc-title').textContent = track.trackName || '未命名歌曲';
    card.querySelector('.mc-artist').textContent = (track.artistName || '未知歌手') + (track.collectionName ? ' · ' + track.collectionName : '');
    host.appendChild(card);

    var btn = card.querySelector('.mc-play');
    var prog = card.querySelector('.mc-progress i');
    var time = card.querySelector('.mc-time');

    function paint() {
      var a = ensureAudio();
      var d = isFinite(a.duration) && a.duration ? a.duration : 30;
      var p = Math.min(1, (a.currentTime || 0) / d);
      prog.style.width = (p * 100).toFixed(1) + '%';
      time.textContent = fmt(a.currentTime) + ' / ' + fmt(d);
    }

    function playThis() {
      var a = ensureAudio();
      if (curCard && curCard !== card) resetCard();
      if (a.src !== track.previewUrl) {
        a.pause();
        a.src = track.previewUrl;
      }
      a.onloadedmetadata = null;
      a.ontimeupdate = paint;
      a.onended = function () {
        card.classList.remove('is-playing');
        btn.textContent = '▶';
      };
      var pr = a.play();
      if (pr && pr.catch) {
        pr.catch(function () {
          card.classList.add('is-blocked');
          btn.textContent = '▶';
          toastLike('点一下播放按钮就能听');
        });
      }
      card.classList.add('is-playing');
      btn.textContent = '❚❚';
      curCard = card;
      curBtn = btn;
      paint();
    }

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var a = ensureAudio();
      if (card.classList.contains('is-playing') && !a.paused) {
        a.pause();
        card.classList.remove('is-playing');
        btn.textContent = '▶';
      } else {
        playThis();
      }
    });

    // 自动播放（可能被浏览器拦截，失败时保留按钮可点）
    setTimeout(playThis, 40);
    return card;
  }

  function toastLike(msg) {
    var box = document.getElementById('toasts');
    if (!box) return;
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, 2200);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2800);
  }

  function play(q, host) {
    var query = String(q || '').trim() || '轻音乐 piano';
    return search(query).then(function (list) {
      if (!list.length) return null;
      show(list[0], host);
      return list[0];
    });
  }

  function pause() {
    if (audio) audio.pause();
    resetCard();
  }

  return { play: play, pause: pause };
})();
