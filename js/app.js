/* 前台通用逻辑：数据读取（data/*.json）、渲染、工具 */
(function () {
  'use strict';

  var CATEGORIES = {
    campus:   { name: '校园新闻', desc: '校园动态 · 一线报道' },
    notice:   { name: '通知公告', desc: '教务通知 · 官方公告' },
    activity: { name: '活动报道', desc: '文体活动 · 精彩瞬间' }
  };

  /* ---------- 数据 ----------
     唯一来源：data/index.json + data/<id>.json（编辑器自动写入）。
     注意：需要通过 HTTP 访问（本地服务器或托管）才能读取。 */
  var _articles = null;

  function fetchJson(url) {
    return fetch(url).then(function (r) { return r.ok ? r.json() : null; });
  }

  function loadRemote() {
    if (location.protocol === 'file:') return Promise.resolve([]);
    return fetchJson('data/index.json').then(function (ids) {
      if (!Array.isArray(ids) || !ids.length) return [];
      return Promise.all(ids.map(function (id) {
        return fetchJson('data/' + encodeURIComponent(id) + '.json').catch(function () { return null; });
      })).then(function (arr) { return arr.filter(Boolean); });
    }).catch(function () { return []; });
  }

  // 页面就绪：文章数据加载完成后再执行渲染
  function ready(fn) {
    if (_articles) return fn();
    loadRemote().then(function (remote) {
      _articles = remote.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
      fn();
    });
  }

  // file:// 双击打开时浏览器拦截 fetch、读不到 data/ —— 显示说明横幅
  function mountFileWarning() {
    if (location.protocol !== 'file:') return;
    var banner = document.createElement('div');
    banner.className = 'file-warn';
    banner.innerHTML =
      '<div class="container">' +
        '<b>当前以「双击打开」方式访问，无法读取 data/ 文件夹中的新闻。</b>' +
        '<p>这是浏览器的安全限制（file:// 页面不能 fetch 本地文件）。请改用本地服务器访问：</p>' +
        '<pre>python -m http.server 8000 --directory "' + location.pathname.replace(/index\.html?$/, '') + '"</pre>' +
        '<p>然后浏览器打开 <code>http://localhost:8000/</code> 即可正常显示。编辑器不受此限制。</p>' +
      '</div>';
    var header = document.querySelector('.site-header');
    if (header) header.after(banner); else document.body.prepend(banner);
  }

  function getArticles() { return _articles || []; }

  function findArticle(id) {
    return getArticles().filter(function (a) { return String(a.id) === String(id); })[0];
  }

  /* ---------- 工具 ---------- */
  function qs(s, root) { return (root || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // 规范化封面路径：自动补全 assets/img/ 前缀（兼容旧数据）
  function normalizeCover(cover) {
    cover = String(cover || '').trim();
    if (!cover) return '';
    if (/^(https?:)?\/\//.test(cover) || cover.indexOf('data:') === 0 || cover.indexOf('assets/img/') === 0) {
      return cover;
    }
    if (cover.charAt(0) === '/') return cover;
    return 'assets/img/' + cover;
  }

  // 封面：有图显示图；图片加载失败或无图显示 CSS 占位
  function coverHtml(a, cls) {
    var img = '<div class="card-cover ' + (cls || '') + '">';
    if (a.cover) {
      var src = normalizeCover(a.cover);
      img += '<img src="' + esc(src) + '" alt="' + esc(a.title) + '" loading="lazy" ' +
             'onerror="this.style.display=\'none\';this.parentNode.classList.add(\'noimg\')">';
    } else {
      img += '<div class="ph"></div>';
    }
    img += '</div>';
    return img;
  }

  function formatDate(d) {
    if (!d) return '';
    var p = String(d).split('-');
    return p.length >= 2 ? (+p[1]) + ' 月 ' + (+p[2]) + ' 日' : d;
  }

  /* ---------- 组件渲染 ---------- */
  function renderNav(active) {
    var links = [
      { href: 'index.html', key: 'home', text: '首页' }
    ];
    Object.keys(CATEGORIES).forEach(function (k) {
      links.push({ href: 'list.html?cat=' + k, key: k, text: CATEGORIES[k].name });
    });
    links.push({ href: 'editor.html', key: 'editor', text: '新闻编辑', editor: true });

    return links.map(function (l) {
      var cls = 'nav-link' + (active === l.key ? ' active' : '') + (l.editor ? ' nav-editor' : '');
      return '<a class="' + cls + '" href="' + l.href + '">' + l.text + '</a>';
    }).join('');
  }

  function mountNav(activeKey, titleText) {
    var html =
      '<header class="site-header">' +
        '<div class="container header-inner">' +
          '<a class="brand" href="index.html">' +
            '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
              '<path d="M4 20h16"/><path d="M6 20V9l6-5 6 5v11"/><path d="M10 20v-6h4v6"/>' +
            '</svg>' +
            '<span class="brand-text"><b>' + esc(titleText) + '</b><i>校园新闻站</i></span>' +
          '</a>' +
          '<nav class="nav" id="nav">' + renderNav(activeKey) + '</nav>' +
          '<button class="nav-toggle" id="navToggle" aria-label="打开菜单" aria-expanded="false">' +
            '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>' +
          '</button>' +
        '</div>' +
      '</header>';

    var holder = qs('#site-header');
    if (holder) {
      holder.outerHTML = html;
      var toggle = qs('#navToggle'), nav = qs('#nav');
      toggle.addEventListener('click', function () {
        var open = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
  }

  function renderFooter(titleText) {
    var holder = qs('#site-footer');
    if (holder) {
      holder.outerHTML =
        '<footer class="site-footer">' +
          '<div class="container footer-inner">' +
            '<div>' +
              '<div class="footer-brand">' + esc(titleText) + ' · 校园新闻站</div>' +
              '<p class="footer-desc">记录校园点滴，传递师生声音。</p>' +
            '</div>' +
            '<div class="footer-links">' +
              '<a href="index.html">首页</a>' +
              '<a href="list.html?cat=campus">校园新闻</a>' +
              '<a href="list.html?cat=notice">通知公告</a>' +
              '<a href="list.html?cat=activity">活动报道</a>' +
              '<a href="editor.html">新闻编辑</a>' +
            '</div>' +
          '</div>' +
          '<div class="container footer-copy">© 2026 ' + esc(titleText) + ' · 保留所有权利</div>' +
        '</footer>';
    }
  }

  /* 新闻卡片 */
  function articleCard(a) {
    return (
      '<a class="card" href="article.html?id=' + encodeURIComponent(a.id) + '">' +
        coverHtml(a) +
        '<div class="card-body">' +
          '<div class="card-meta">' +
            '<span class="tag tag-' + esc(a.category) + '">' + esc((CATEGORIES[a.category] || {}).name || a.category) + '</span>' +
            '<time>' + esc(formatDate(a.date)) + '</time>' +
          '</div>' +
          '<h3 class="card-title">' + esc(a.title) + '</h3>' +
          '<p class="card-summary">' + esc(a.summary || '') + '</p>' +
        '</div>' +
      '</a>'
    );
  }

  /* 空状态 */
  function emptyState(message, tip) {
    return (
      '<div class="empty">' +
        '<svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>' +
        '</svg>' +
        '<p class="empty-title">' + esc(message) + '</p>' +
        (tip ? '<p class="empty-tip">' + esc(tip) + '</p>' +
              '<a class="btn btn-primary" href="editor.html">去写第一篇新闻</a>' : '') +
      '</div>'
    );
  }

  /* 导出 */
  window.Site = {
    CATEGORIES: CATEGORIES,
    ready: ready,
    mountFileWarning: mountFileWarning,
    getArticles: getArticles,
    findArticle: findArticle,
    qs: qs,
    esc: esc,
    coverHtml: coverHtml,
    formatDate: formatDate,
    mountNav: mountNav,
    renderFooter: renderFooter,
    articleCard: articleCard,
    emptyState: emptyState
  };
})();