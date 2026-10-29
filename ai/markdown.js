/*!
 * 小谷 Markdown / 特殊标签渲染器
 * 支持：标题、列表、引用、代码、表格、链接、图片、删除线、分割线、
 *       反斜杠转义、HTML 实体、LaTeX、<cite>、<search>、<img>、<video> 等
 * 全程先转义再渲染，避免任何 HTML 注入。
 */
(function () {
  'use strict';

  var MARK = '\u0000';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function escAttr(s) {
    return esc(s).replace(/`/g, '&#96;');
  }

  function getAttr(attrs, name) {
    var re = new RegExp('(^|\\s)' + name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i');
    var m = attrs.match(re);
    if (!m) return '';
    return m[3] != null ? m[3] : m[4] != null ? m[4] : m[5] != null ? m[5] : '';
  }

  function safeUrl(url, allowData) {
    var u = String(url || '').trim().replace(/^<|>$/g, '');
    if (!u) return '';
    if (/^(javascript|vbscript|file):/i.test(u)) return '';
    if (/^data:/i.test(u)) {
      return allowData && /^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml);/i.test(u) ? u : '';
    }
    if (/^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(u)) return u;
    if (/^[\w.-]+\.[a-z]{2,}(\/|$|\?)/i.test(u)) return 'https://' + u;
    return '';
  }

  function normalizeMarkdown(src) {
    return String(src == null ? '' : src).replace(/\r\n?/g, '\n');
  }

  function render(src) {
    var toks = [];
    function add(html) {
      toks.push(html);
      return MARK + (toks.length - 1) + MARK;
    }

    // ---------- 1. 先保护代码块 / 公式 / 媒体标签 ----------
    function codeBlock(code, lang) {
      var l = String(lang || '').trim().split(/\s+/)[0].replace(/[^\w+#.-]/g, '');
      var label = l || 'text';
      return '<div class="code-block">' +
        '<div class="code-head"><span class="code-lang">' + esc(label) + '</span>' +
        '<button class="code-copy" type="button" data-copy="1">复制</button></div>' +
        '<pre><code class="language-' + esc(label) + '">' + esc(code.replace(/\n$/, '')) + '</code></pre>' +
        '</div>';
    }

    var text = normalizeMarkdown(src);

    // 兜底保护：<fx>/<fx_code>/<fx_html> 若泄漏到正文，按代码块保护，
    // 避免其中的 *、$、` 被 Markdown 行内规则破坏（正常由 app.js 提前抽离）。
    text = text.replace(/<(fx|fx_code|fx_html)\b([^>]*)>([\s\S]*?)<\/\1>/gi, function (m, tag, attrs, body) {
      var lang = tag === 'fx_html' ? 'html' : 'js';
      return add(codeBlock(String(body || ''), lang));
    });
    text = text.replace(/<(fx|fx_code|fx_html)\b[^>]*>[\s\S]*$/gi, '');

    // 闭合的代码围栏
    text = text.replace(/```([^\n`]*)\n([\s\S]*?)```/g, function (m, lang, code) {
      return add(codeBlock(code, lang));
    });
    // 流式输出中尚未闭合的代码围栏
    text = text.replace(/```([^\n`]*)\n([\s\S]*)$/g, function (m, lang, code) {
      return add(codeBlock(code, lang));
    });

    // 行内代码
    text = text.replace(/`([^`\n]+)`/g, function (m, code) {
      return add('<code class="md-inline-code">' + esc(code) + '</code>');
    });

    // 块级公式 $$...$$
    text = text.replace(/\$\$([\s\S]+?)\$\$/g, function (m, tex) {
      return add('<div class="math-block" data-tex="' + escAttr(tex) + '">' + esc(tex) + '</div>');
    });
    // 行内公式 $...$
    text = text.replace(/\$([^$\n]+?)\$/g, function (m, tex) {
      return add('<span class="math-inline" data-tex="' + escAttr(tex) + '">' + esc(tex) + '</span>');
    });

    // <img>
    text = text.replace(/<img\b([^>]*?)\/?>/gi, function (m, attrs) {
      var srcUrl = safeUrl(getAttr(attrs, 'src'), true);
      if (!srcUrl) return '';
      var alt = getAttr(attrs, 'alt') || '图片';
      var title = getAttr(attrs, 'title');
      return add('<img class="md-img" src="' + escAttr(srcUrl) + '" alt="' + escAttr(alt) + '"' +
        (title ? ' title="' + escAttr(title) + '"' : '') + ' loading="lazy" referrerpolicy="no-referrer">');
    });

    // <video>
    text = text.replace(/<video\b([^>]*?)>([\s\S]*?)<\/video>/gi, function (m, attrs, inner) {
      var srcUrl = safeUrl(getAttr(attrs, 'src'), false);
      if (!srcUrl) {
        var source = inner.match(/<source\b[^>]*src\s*=\s*["']([^"']+)["']/i);
        if (source) srcUrl = safeUrl(source[1], false);
      }
      if (!srcUrl) return '';
      var poster = safeUrl(getAttr(attrs, 'poster'), true);
      return add('<video class="md-video" controls preload="metadata" src="' + escAttr(srcUrl) + '"' +
        (poster ? ' poster="' + escAttr(poster) + '"' : '') + '></video>');
    });
    text = text.replace(/<video\b([^>]*?)\/>/gi, function (m, attrs) {
      var srcUrl = safeUrl(getAttr(attrs, 'src'), false);
      if (!srcUrl) return '';
      return add('<video class="md-video" controls preload="metadata" src="' + escAttr(srcUrl) + '"></video>');
    });

    // <cite> / <search>
    text = text.replace(/<(cite|search)\b[^>]*>([\s\S]*?)<\/\1>/gi, function (m, tag, inner) {
      var kind = tag.toLowerCase();
      return add('<span class="md-tag md-tag-' + kind + '">' +
        '<span class="md-tag-ico">' + (kind === 'cite' ? '❝' : '🔍') + '</span>' +
        '<span class="md-tag-txt">' + esc(inner.trim()) + '</span></span>');
    });

    // <thinking> 兜底（正常由 app.js 提前抽离）
    text = text.replace(/<(thinking|thought|reason|analysis)\b[^>]*>([\s\S]*?)<\/\1>/gi, function (m, tag, inner) {
      return add('<details class="md-thinking"><summary>思考过程</summary><div class="md-thinking-body">' +
        esc(inner.trim()) + '</div></details>');
    });

    // 清理不该显示的控制标签
    text = text.replace(/<\/?output\b[^>]*>/gi, '');
    text = text.replace(/<(?:tool_call|function_call|ix)\b[\s\S]*?<\/(?:tool_call|function_call|ix)>/gi, '');
    text = text.replace(/<ix\b[^>]*\/?>/gi, '');

    // ---------- 2. HTML 实体 & 反斜杠转义 ----------
    text = text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&');

    text = text.replace(/\\n/g, '\n').replace(/\\t/g, '    ');
    text = text.replace(/\\([\\`*_{}\[\]()#+\-.!~>|$])/g, function (m, ch) {
      return add(esc(ch));
    });

    // 从这里开始全部是纯文本，统一转义
    text = esc(text);

    // ---------- 3. 行内渲染 ----------
    function inline(s) {
      s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (m, alt, url) {
        var u = safeUrl(url, true);
        if (!u) return alt;
        return '<img class="md-img" src="' + escAttr(u) + '" alt="' + escAttr(alt) + '" loading="lazy" referrerpolicy="no-referrer">';
      });
      s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, label, url) {
        var u = safeUrl(url, false);
        if (!u) return label;
        return '<a href="' + escAttr(u) + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
      });
      s = s.replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>');
      s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/___([^_\n]+)___/g, '<strong><em>$1</em></strong>');
      s = s.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
      s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
      s = s.replace(/(^|[^_\w])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>');
      s = s.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
      return s;
    }

    function splitRow(row) {
      var r = row.trim();
      if (r.charAt(0) === '|') r = r.slice(1);
      if (r.charAt(r.length - 1) === '|') r = r.slice(0, -1);
      return r.split('|').map(function (c) { return c.trim(); });
    }

    function isTableSep(row) {
      if (!row || row.indexOf('|') === -1) return false;
      var cells = splitRow(row);
      return cells.length > 0 && cells.every(function (c) {
        return /^:?-{3,}:?$/.test(c);
      });
    }

    function buildList(items, start, indent) {
      var ordered = items[start].ordered;
      var html = ordered ? '<ol>' : '<ul>';
      var i = start;
      while (i < items.length && items[i].indent >= indent) {
        if (items[i].indent > indent) {
          var sub = buildList(items, i, items[i].indent);
          html += sub.html;
          i = sub.next;
          continue;
        }
        var content = items[i].text;
        i++;
        var nested = '';
        if (i < items.length && items[i].indent > indent) {
          var sub2 = buildList(items, i, items[i].indent);
          nested = sub2.html;
          i = sub2.next;
        }
        html += '<li>' + inline(content).replace(/\n/g, '<br>') + nested + '</li>';
        if (i < items.length && items[i].indent === indent && items[i].ordered !== ordered) break;
      }
      html += ordered ? '</ol>' : '</ul>';
      return { html: html, next: i };
    }

    // ---------- 4. 块级解析 ----------
    function parseBlocks(lines) {
      var out = [];
      var i = 0;
      function blank(l) { return !l || !l.trim(); }
      function isBlockStart(line, idx) {
        return /^\s*#{1,6}\s+/.test(line) ||
          /^\s*&gt;/.test(line) ||
          /^\s*(?:[-*+]|\d+[.)])\s+/.test(line) ||
          /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line) ||
          (line.indexOf('|') !== -1 && idx + 1 < lines.length && isTableSep(lines[idx + 1]));
      }

      while (i < lines.length) {
        var line = lines[i];
        if (blank(line)) { i++; continue; }

        var trimmed = line.trim();
        if (/^\u0000\d+\u0000$/.test(trimmed)) {
          out.push(trimmed);
          i++;
          continue;
        }

        // 标题
        var h = line.match(/^\s*(#{1,6})\s+(.*)$/);
        if (h) {
          var lvl = h[1].length;
          out.push('<h' + lvl + '>' + inline(h[2].replace(/\s+#+\s*$/, '')) + '</h' + lvl + '>');
          i++;
          continue;
        }

        // 分割线
        if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
          out.push('<hr class="md-hr">');
          i++;
          continue;
        }

        // 引用（支持 >> 嵌套）
        if (/^\s*&gt;/.test(line)) {
          var quoteLines = [];
          while (i < lines.length && (/^\s*&gt;/.test(lines[i]) ||
            (blank(lines[i]) && i + 1 < lines.length && /^\s*&gt;/.test(lines[i + 1])))) {
            quoteLines.push(lines[i].replace(/^\s*&gt;\s?/, ''));
            i++;
          }
          out.push('<blockquote class="md-quote">' + parseBlocks(quoteLines) + '</blockquote>');
          continue;
        }

        // 表格
        if (line.indexOf('|') !== -1 && i + 1 < lines.length && isTableSep(lines[i + 1])) {
          var head = splitRow(line);
          var sep = splitRow(lines[i + 1]);
          var align = sep.map(function (c) {
            var left = c.charAt(0) === ':';
            var right = c.charAt(c.length - 1) === ':';
            return left && right ? 'center' : right ? 'right' : left ? 'left' : '';
          });
          var table = '<div class="table-wrap"><table class="md-table"><thead><tr>';
          head.forEach(function (c, j) {
            table += '<th' + (align[j] ? ' style="text-align:' + align[j] + '"' : '') + '>' + inline(c) + '</th>';
          });
          table += '</tr></thead><tbody>';
          i += 2;
          while (i < lines.length && lines[i].indexOf('|') !== -1 && lines[i].trim()) {
            if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])) break;
            var cells = splitRow(lines[i]);
            table += '<tr>';
            head.forEach(function (_, j) {
              table += '<td' + (align[j] ? ' style="text-align:' + align[j] + '"' : '') + '>' + inline(cells[j] || '') + '</td>';
            });
            table += '</tr>';
            i++;
          }
          table += '</tbody></table></div>';
          out.push(table);
          continue;
        }

        // 列表
        if (/^\s*(?:[-*+]|\d+[.)])\s+/.test(line)) {
          var items = [];
          while (i < lines.length) {
            var l = lines[i];
            var mm = l.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
            if (mm) {
              items.push({
                indent: mm[1].replace(/\t/g, '    ').length,
                ordered: /\d/.test(mm[2]),
                text: mm[3]
              });
              i++;
              continue;
            }
            if (blank(l)) {
              if (i + 1 < lines.length && /^\s*(?:[-*+]|\d+[.)])\s+/.test(lines[i + 1])) { i++; continue; }
              break;
            }
            if (/^\s{2,}\S/.test(l) && items.length) {
              items[items.length - 1].text += '\n' + l.trim();
              i++;
              continue;
            }
            break;
          }
          var res = buildList(items, 0, items[0].indent);
          out.push(res.html);
          while (res.next < items.length) {
            res = buildList(items, res.next, items[res.next].indent);
            out.push(res.html);
          }
          continue;
        }

        // 段落
        var buf = [];
        while (i < lines.length && !blank(lines[i]) && !isBlockStart(lines[i], i) &&
          !/^\u0000\d+\u0000$/.test(lines[i].trim())) {
          buf.push(lines[i]);
          i++;
        }
        if (!buf.length) {
          out.push(inline(lines[i]));
          i++;
          continue;
        }
        out.push('<p>' + inline(buf.join('\n')).replace(/\n/g, '<br>') + '</p>');
      }
      return out.join('\n');
    }

    var html = parseBlocks(text.split('\n'));

    // ---------- 5. 还原受保护内容 ----------
    return html.replace(/\u0000(\d+)\u0000/g, function (m, idx) {
      return toks[+idx] || '';
    });
  }

  // 流式输出时去掉末尾不完整的特殊标签，避免闪出半截源码
  function stripIncomplete(text) {
    var s = String(text == null ? '' : text);
    s = s.replace(/<(?:ix|tool_call|function_call|thinking|thought|output|cite|search|img|video)\b[^>]*$/i, '');
    return s;
  }

  window.MD = { render: render, escape: esc, stripIncomplete: stripIncomplete };
})();
