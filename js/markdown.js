/* 轻量 Markdown 解析器（无外部依赖，支持离线 file:// 打开）
   支持：标题、粗体、斜体、删除线、行内代码、代码块、
        引用、无序/有序列表、链接、图片、分割线、表格、段落 */
(function (global) {
  // 注意：这里不转义 ">"，否则引用语法 /^>\s?/ 永远匹配不到。
  // 文本内容中 ">" 无需转义，转义 "<" 与 "&" 已足以防止标签注入。
  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
  }

  // 转义后的文本中做行内替换（链接/图片先行，再行内标记）
  function inline(s) {
    var img = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    var lnk = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    var holder = [];
    // 先抽取图片和链接，避免内部内容再被其他规则处理
    s = s.replace(img, function (m, alt, src) {
      holder.push('<img src="' + src + '" alt="' + alt + '" loading="lazy">');
      return '\u0000' + (holder.length - 1) + '\u0000';
    });
    s = s.replace(lnk, function (m, text, href) {
      var ext = /^https?:\/\//.test(href) ? ' target="_blank" rel="noopener"' : '';
      holder.push('<a href="' + href + '"' + ext + '>' + text + '</a>');
      return '\u0000' + (holder.length - 1) + '\u0000';
    });
    s = s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>');
    // 还原占位
    s = s.replace(/\u0000(\d+)\u0000/g, function (m, i) { return holder[+i]; });
    return s;
  }

  function renderTable(lines, startIdx) {
    // lines[startIdx] 为表头，下一行为 |---|---|
    var rows = [];
    var i = startIdx;
    var header = lines[i].split('|').map(function (c) { return c.trim(); })
      .filter(function (c, idx, arr) { return !(idx === 0 && c === '') && !(idx === arr.length - 1 && c === ''); });
    i += 2; // 跳过分隔行
    while (i < lines.length && /^\s*\|/.test(lines[i])) {
      var cells = lines[i].split('|').map(function (c) { return c.trim(); })
        .filter(function (c, idx, arr) { return !(idx === 0 && c === '') && !(idx === arr.length - 1 && c === ''); });
      rows.push(cells);
      i++;
    }
    var html = '<div class="md-table-wrap"><table><thead><tr>';
    header.forEach(function (h) { html += '<th>' + inline(h) + '</th>'; });
    html += '</tr></thead><tbody>';
    rows.forEach(function (r) {
      html += '<tr>';
      header.forEach(function (h, ci) { html += '<td>' + inline(r[ci] || '') + '</td>'; });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return { html: html, next: i };
  }

  function markdownToHtml(md) {
    if (!md) return '';
    var lines = escapeHtml(md).replace(/\r\n?/g, '\n').split('\n');
    var out = [], i = 0, html;

    while (i < lines.length) {
      var line = lines[i];

      // 空行
      if (/^\s*$/.test(line)) { i++; continue; }

      // 代码块 ```
      if (/^```/.test(line)) {
        var buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        out.push('<pre><code>' + buf.join('\n') + '</code></pre>');
        continue;
      }
      // 标题
      var h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        out.push('<h' + h[1].length + '>' + inline(h[2]) + '</h' + h[1].length + '>');
        i++; continue;
      }
      // 分割线
      if (/^\s*([-*_])\s*\1\s*\1[\s\1]*$/.test(line)) { out.push('<hr>'); i++; continue; }
      // 表格
      if (/\|/.test(line) && i + 1 < lines.length &&
          /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1]) && /-/.test(lines[i + 1])) {
        var t = renderTable(lines, i);
        out.push(t.html); i = t.next; continue;
      }
      // 引用
      if (/^>\s?/.test(line)) {
        var q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          q.push(lines[i].replace(/^>\s?/, '')); i++;
        }
        out.push('<blockquote>' + inline(q.join('<br>')) + '</blockquote>');
        continue;
      }
      // 无序列表
      if (/^\s*[-*+]\s+/.test(line)) {
        var ul = [];
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
          ul.push('<li>' + inline(lines[i].replace(/^\s*[-*+]\s+/, '')) + '</li>'); i++;
        }
        out.push('<ul>' + ul.join('') + '</ul>'); continue;
      }
      // 有序列表
      if (/^\s*\d+\.\s+/.test(line)) {
        var ol = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          ol.push('<li>' + inline(lines[i].replace(/^\s*\d+\.\s+/, '')) + '</li>'); i++;
        }
        out.push('<ol>' + ol.join('') + '</ol>'); continue;
      }
      // 段落：连续非空行合并
      var p = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) &&
             !/^(#{1,6}\s|>|```|\s*[-*+]\s|\s*\d+\.\s)/.test(lines[i]) &&
             !/^\s*([-*_])\s*\1\s*\1[\s\1]*$/.test(lines[i])) {
        p.push(lines[i]); i++;
      }
      out.push('<p>' + inline(p.join('<br>')) + '</p>');
    }
    return out.join('\n');
  }

  global.Markdown = { toHtml: markdownToHtml };
})(window);