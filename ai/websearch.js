/* 小谷联网搜索
   源：维基百科中/英（直连 + 经公开跨域代理，照顾国内网络）+ 必应 RSS（经代理）+ DuckDuckGo 即时答案。
   全部失败时返回空数组，由模型如实说「没查到」，不编造。 */
window.WEBSEARCH = (function () {
  var cache = { q: '', at: 0, data: null };
  var PROXY = 'https://api.allorigins.win/raw?url=';

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

  /* ---------------- 维基百科 ---------------- */
  function wiki(lang, q, proxy) {
    var url = 'https://' + lang + '.wikipedia.org/w/api.php?format=json&origin=*&' + qs({
      action: 'query', list: 'search', srsearch: q, srlimit: 4, utf8: 1, srprop: 'snippet'
    });
    return get(proxy ? PROXY + encodeURIComponent(url) : url, proxy ? 9000 : 6000, true).then(function (j) {
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

  /* ---------------- 必应 RSS（经代理） ---------------- */
  function bing(q) {
    var target = 'https://cn.bing.com/search?format=rss&mkt=zh-CN&q=' + encodeURIComponent(q);
    return get(PROXY + encodeURIComponent(target), 10000, false).then(function (xml) { return parseRss(xml); });
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

  function search(q) {
    var text = String(q || '').trim();
    if (!text) return Promise.resolve([]);
    if (cache.q === text && Date.now() - cache.at < 60000) return Promise.resolve(cache.data);

    // 第一轮：中文维基（直连 + 代理）+ 必应 RSS（代理），三路并行
    return Promise.all([wiki('zh', text, false), wiki('zh', text, true), bing(text)]).then(function (r) {
      var list = merge(merge(r[0], r[2]), r[1]);
      if (list.length >= 2) return list;
      // 第二轮：英文维基（直连 + 代理）+ DuckDuckGo
      return Promise.all([wiki('en', text, false), wiki('en', text, true), duck(text)]).then(function (r2) {
        return merge(merge(list, merge(r2[0], r2[2])), r2[1]);
      });
    }).catch(function () { return []; }).then(function (list) {
      cache = { q: text, at: Date.now(), data: list || [] };
      return list || [];
    });
  }

  return { search: search };
})();
