/* 小谷联网搜索：维基百科（中/英，跨域开放）+ 必应 RSS（经公开跨域代理）+ DuckDuckGo 即时答案
   全部失败时不编造，交给模型如实说「没查到」。 */
window.WEBSEARCH = (function () {
  var cache = { q: '', at: 0, data: null };

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

  function getText(url, ms) {
    return timed(fetch(url, { mode: 'cors', credentials: 'omit' })
      .then(function (r) { return r.ok ? r.text() : ''; })
      .catch(function () { return ''; }), ms);
  }

  function getJSON(url, ms) {
    return timed(fetch(url, { mode: 'cors', credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; }), ms);
  }

  /* ---------------- 维基百科 ---------------- */
  function wikiApi(lang, params) {
    return getJSON('https://' + lang + '.wikipedia.org/w/api.php?format=json&origin=*&' + qs(params), 6000);
  }

  function searchLang(lang, q) {
    return wikiApi(lang, { action: 'query', list: 'search', srsearch: q, srlimit: 4, utf8: 1 }).then(function (j) {
      var hits = (j && j.query && j.query.search) || [];
      if (!hits.length) return [];
      var titles = hits.map(function (h) { return h.title; });
      return wikiApi(lang, {
        action: 'query', prop: 'extracts', exintro: 1, explaintext: 1,
        exlimit: 'max', redirects: 1, titles: titles.join('|')
      }).then(function (ex) {
        var pages = {};
        if (ex && ex.query && ex.query.pages) {
          Object.keys(ex.query.pages).forEach(function (k) {
            pages[ex.query.pages[k].title] = ex.query.pages[k];
          });
        }
        return hits.map(function (h) {
          var p = pages[h.title] || {};
          var body = String(p.extract || '').replace(/\s+/g, ' ').trim();
          return {
            title: h.title,
            snippet: body ? body.slice(0, 240) : String(h.snippet || '').replace(/<[^>]+>/g, ''),
            url: 'https://' + lang + '.wikipedia.org/wiki/' + encodeURIComponent(h.title.replace(/ /g, '_')),
            source: lang === 'zh' ? '维基百科' : 'Wikipedia'
          };
        });
      });
    });
  }

  /* ---------------- 必应 RSS（借公开代理取回，解析成条目） ---------------- */
  function parseBing(xml, q) {
    if (!xml) return [];
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
    return out.length ? out : [];
  }

  function bing(q) {
    var target = 'https://cn.bing.com/search?format=rss&mkt=zh-CN&q=' + encodeURIComponent(q);
    var proxies = [
      'https://api.allorigins.win/raw?url=' + encodeURIComponent(target),
      'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(target)
    ];
    return Promise.all(proxies.map(function (p) { return getText(p, 8000); })).then(function (texts) {
      for (var i = 0; i < texts.length; i++) {
        var list = parseBing(texts[i], q);
        if (list.length) return list;
      }
      return [];
    });
  }

  /* ---------------- DuckDuckGo 即时答案 ---------------- */
  function duck(q) {
    return getJSON('https://api.duckduckgo.com/?q=' + encodeURIComponent(q) + '&format=json&no_html=1&skip_disambig=1', 6000)
      .then(function (j) {
        if (!j || !j.AbstractText) return [];
        return [{
          title: j.Heading || q,
          snippet: String(j.AbstractText).slice(0, 240),
          url: j.AbstractURL || '',
          source: 'DuckDuckGo'
        }];
      });
  }

  function merge(a, b) {
    var out = (a || []).slice();
    var seen = {};
    out.forEach(function (x) { seen[x.title] = 1; });
    (b || []).forEach(function (x) { if (!seen[x.title]) { seen[x.title] = 1; out.push(x); } });
    return out.slice(0, 5);
  }

  function search(q) {
    var text = String(q || '').trim();
    if (!text) return Promise.resolve([]);
    if (cache.q === text && Date.now() - cache.at < 60000) return Promise.resolve(cache.data);

    // 第一轮：中文维基 + 必应（并行，谁先回谁算）
    return Promise.all([searchLang('zh', text), bing(text)]).then(function (r) {
      var list = merge(r[0], r[1]);
      if (list.length >= 3) return list;
      // 第二轮：英文维基 + DuckDuckGo
      return Promise.all([searchLang('en', text), duck(text)]).then(function (r2) {
        return merge(list, merge(r2[0], r2[1]));
      });
    }).catch(function () { return []; }).then(function (list) {
      cache = { q: text, at: Date.now(), data: list || [] };
      return list || [];
    });
  }

  return { search: search };
})();
