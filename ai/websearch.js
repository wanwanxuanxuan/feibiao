/* 小谷联网搜索
   主力：百度百科（JSONP，国内直连、秒回）
   补充：维基百科中/英（直连 + 公开跨域代理）、必应 RSS（代理）、DuckDuckGo。
   谁先回先用谁；全都没结果时返回空数组，由模型如实说「没查到」，绝不编造。 */
window.WEBSEARCH = (function () {
  var cache = { q: '', at: 0, data: null };
  var PROXY = 'https://api.allorigins.win/raw?url=';
  var seq = 0;

  function qs(params) {
    return Object.keys(params).map(function (k) {
      return k + '=' + encodeURIComponent(params[k]);
    }).join('&');
  }

  function timed(promise, ms) {
    return Promise.race([promise, new Promise(function (resolve) {
      setTimeout(function () { resolve(null); }, ms);
    })]);
  }

  function get(url, ms, asJSON) {
    return timed(fetch(url, { mode: 'cors', credentials: 'omit' })
      .then(function (r) { return r.ok ? (asJSON ? r.json() : r.text()) : null; })
      .catch(function () { return null; }), ms);
  }

  function jsonp(url, ms) {
    return new Promise(function (resolve) {
      var cb = '__xg_cb_' + (++seq);
      var script = document.createElement('script');
      var timer = setTimeout(function () { done(null); }, ms || 6000);
      function done(data) {
        clearTimeout(timer);
        try { delete window[cb]; } catch (e) { window[cb] = null; }
        if (script.parentNode) script.parentNode.removeChild(script);
        resolve(data);
      }
      window[cb] = function (data) { done(data); };
      script.onerror = function () { done(null); };
      script.src = url + '&callback=' + cb;
      document.head.appendChild(script);
    });
  }

  /* ---------------- 百度百科（主力） ---------------- */
  function baikeKeys(q) {
    var s = String(q)
      .replace(/[？?！!。，,、：:；;“”"'《》]/g, ' ')
      .replace(/(帮我|请问|告诉我|查一下|搜一下|了解一下)/g, ' ')
      .replace(/(最近|今天|现在|目前|有什么|有哪些|是什么|为什么|怎么|怎样|如何|多少|谁是|吗|呢|啊|吧)/g, ' ')
      .replace(/(拿过哪些奖|有哪些奖|是谁唱的|是谁|哪一年|什么时候|怎么样|在哪里|的资料|的简介|简介|介绍|资料)/g, ' ')
      .replace(/\s+/g, ' ').trim();
    var keys = [];
    if (s) keys.push(s.slice(0, 20));
    s.split(' ').forEach(function (x) {
      if (x.length >= 2 && keys.indexOf(x) === -1) keys.push(x);
    });
    return keys.slice(0, 3);
  }

  function baikeOne(key) {
    return jsonp('https://baike.baidu.com/api/openapi/BaikeLemmaCardApi?scope=103&format=json&appid=379020&bk_length=1200' +
      '&bk_key=' + encodeURIComponent(key), 6000).then(function (j) {
      if (!j || !j.title) return [];
      var body = String(j.abstract || j.desc || '').replace(/\s+/g, ' ').trim();
      return [{
        title: j.title,
        snippet: body.slice(0, 240),
        url: j.url || ('https://baike.baidu.com/item/' + encodeURIComponent(j.title)),
        source: '百度百科'
      }];
    });
  }

  function baike(q) {
    var keys = baikeKeys(q);
    if (!keys.length) return Promise.resolve([]);
    return Promise.all(keys.map(baikeOne)).then(function (lists) {
      return lists.filter(function (l) { return l && l.length; })[0] || [];
    });
  }

  /* ---------------- 维基百科 ---------------- */
  function wiki(lang, q, proxy) {
    var url = 'https://' + lang + '.wikipedia.org/w/api.php?format=json&origin=*&' + qs({
      action: 'query', list: 'search', srsearch: q, srlimit: 4, utf8: 1, srprop: 'snippet'
    });
    return get(proxy ? PROXY + encodeURIComponent(url) : url, proxy ? 12000 : 6000, true).then(function (j) {
      var hits = (j && j.query && j.query.search) || [];
      return hits.map(function (h) {
        return {
          title: h.title,
          snippet: String(h.snippet || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
          url: 'https://' + lang + '.wikipedia.org/wiki/' + encodeURIComponent(String(h.title).replace(/ /g, '_')),
          source: lang === 'zh' ? '维基百科' : 'Wikipedia'
        };
      });
    });
  }

  /* ---------------- 必应 RSS（代理） ---------------- */
  function bing(q) {
    var target = 'https://cn.bing.com/search?format=rss&mkt=zh-CN&q=' + encodeURIComponent(q);
    return get(PROXY + encodeURIComponent(target), 12000, false).then(function (xml) { return parseRss(xml); });
  }

  function parseRss(xml) {
    if (!xml || xml.indexOf('<item') === -1) return [];
    var doc;
    try { doc = new DOMParser().parseFromString(xml, 'text/xml'); } catch (e) { return []; }
    var items = doc.getElementsByTagName('item');
    var out = [];
    for (var i = 0; i < items.length && out.length < 4; i++) {
      var t = items[i].getElementsByTagName('title')[0];
      var l = items[i].getElementsByTagName('link')[0];
      var d = items[i].getElementsByTagName('description')[0];
      var title = t ? String(t.textContent || '').replace(/\s+/g, ' ').trim() : '';
      var url = l ? String(l.textContent || '').trim() : '';
      var desc = d ? String(d.textContent || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';
      if (!title || !/^https?:\/\//.test(url)) continue;
      out.push({ title: title, snippet: desc.slice(0, 220), url: url, source: '必应' });
    }
    return out;
  }

  /* ---------------- DuckDuckGo 即时答案 ---------------- */
  function duck(q) {
    return get('https://api.duckduckgo.com/?q=' + encodeURIComponent(q) + '&format=json&no_html=1&skip_disambig=1', 6000, true)
      .then(function (j) {
        if (!j || !j.AbstractText) return [];
        return [{ title: j.Heading || q, snippet: String(j.AbstractText).slice(0, 240), url: j.AbstractURL || '', source: 'DuckDuckGo' }];
      });
  }

  function merge(a, b) {
    var out = (a || []).slice();
    var seen = {};
    out.forEach(function (x) { seen[x.title] = 1; });
    (b || []).forEach(function (x) { if (!seen[x.title]) { seen[x.title] = 1; out.push(x); } });
    return out.slice(0, 5);
  }

  function mergeAll(lists) {
    var out = [];
    lists.forEach(function (l) { out = merge(out, l); });
    return out;
  }

  /* 收满 count 条就提前返回，最多等 ms 毫秒（不让慢代理拖住聊天） */
  function gather(promises, count, ms) {
    return new Promise(function (resolve) {
      var parts = [], done = false;
      var timer = setTimeout(function () { finish(); }, ms);
      function finish() {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(mergeAll(parts));
      }
      promises.forEach(function (p) {
        p.then(function (list) {
          if (done || !list || !list.length) return;
          parts.push(list);
          if (mergeAll(parts).length >= count) finish();
        });
      });
    });
  }

  function search(q) {
    var text = String(q || '').trim();
    if (!text) return Promise.resolve([]);
    if (cache.q === text && Date.now() - cache.at < 60000) return Promise.resolve(cache.data);

    return gather([
      baike(text),
      wiki('zh', text, false),
      wiki('zh', text, true),
      bing(text)
    ], 3, 6000).then(function (list) {
      if (list.length >= 2) return list;
      return gather([wiki('en', text, false), wiki('en', text, true), duck(text)], 1, 5000).then(function (more) {
        return merge(list, more);
      });
    }).then(function (list) {
      cache = { q: text, at: Date.now(), data: list || [] };
      return list || [];
    });
  }

  return { search: search };
})();
