/* 编辑器页面逻辑（Node.js 服务器版）
   通过 /api/* 接口读写 data/ 文件夹，无需任何授权：
   - GET  /api/list    列出全部文章
   - POST /api/save    保存（服务端写 data/<id>.json）
   - POST /api/delete  删除
   未发布草稿仍自动暂存于浏览器，防误关丢失。 */
(function () {
  'use strict';

  var S = window.Site;
  var DRAFT_KEY = 'cnuhs_news_draft';
  var editingId = null;

  function qs(s) { return document.querySelector(s); }
  function toast(msg) {
    var t = qs('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }
  function nowTime() {
    return new Date().toLocaleTimeString('zh-CN', { hour12: false });
  }

  /* ============ 服务器 API ============ */
  function api(method, url, body) {
    return fetch(url, {
      method: method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function listArticles() { return api('GET', 'api/list'); }
  function saveToServer(a) { return api('POST', 'api/save', { article: a }); }
  function deleteFromServer(id) { return api('POST', 'api/delete', { id: id }); }

  /* ============ 草稿自动保存（防误关丢失，发布后清除） ============ */
  var draftTimer = null;
  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        editingId: editingId,
        title: qs('#fTitle').value,
        category: qs('#fCat').value,
        author: qs('#fAuthor').value,
        date: qs('#fDate').value,
        cover: qs('#fCover').value,
        summary: qs('#fSummary').value,
        content: qs('#fContent').value
      }));
    } catch (e) {}
    var t = qs('#draftStatus');
    if (t) t.textContent = '草稿已自动保存 ' + nowTime();
  }
  function scheduleDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 600);
  }
  function restoreDraft() {
    try {
      var d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (!d) return false;
      editingId = d.editingId || null;
      qs('#fTitle').value = d.title || '';
      qs('#fCat').value = d.category || 'campus';
      qs('#fAuthor').value = d.author || '';
      qs('#fDate').value = d.date || new Date().toISOString().slice(0, 10);
      qs('#fCover').value = d.cover || '';
      qs('#fSummary').value = d.summary || '';
      qs('#fContent').value = d.content || '';
      return true;
    } catch (e) { return false; }
  }
  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    var t = qs('#draftStatus');
    if (t) t.textContent = '';
  }

  /* ============ 表单读写 ============ */
  function readForm() {
    return {
      id: editingId || ('n' + Date.now().toString(36)),
      title: qs('#fTitle').value.trim(),
      category: qs('#fCat').value,
      author: qs('#fAuthor').value.trim(),
      date: qs('#fDate').value || new Date().toISOString().slice(0, 10),
      cover: qs('#fCover').value.trim(),
      summary: qs('#fSummary').value.trim(),
      content: qs('#fContent').value
    };
  }

  function fillForm(a) {
    editingId = a ? a.id : null;
    qs('#fTitle').value = a ? a.title : '';
    qs('#fCat').value = a ? (a.category || 'campus') : 'campus';
    qs('#fAuthor').value = a ? (a.author || '') : '';
    qs('#fDate').value = a ? (a.date || '') : new Date().toISOString().slice(0, 10);
    qs('#fCover').value = a ? (a.cover || '') : '';
    qs('#fSummary').value = a ? (a.summary || '') : '';
    qs('#fContent').value = a ? (a.content || '') : '';
    renderPreview();
    saveDraft();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ============ 预览 ============ */
  function renderPreview() {
    qs('#preview').innerHTML = Markdown.toHtml(qs('#fContent').value) ||
      '<p style="color:var(--muted)">开始输入正文，右侧将实时显示排版效果……</p>';
  }

  /* ============ Markdown 工具栏 ============ */
  function wrap(before, after, placeholder) {
    var ta = qs('#fContent');
    var start = ta.selectionStart, end = ta.selectionEnd;
    var sel = ta.value.slice(start, end) || placeholder;
    ta.setRangeText(before + sel + after, start, end, 'end');
    ta.focus();
    renderPreview();
  }

  function insertImage() {
    var src = prompt('请输入图片路径（如 assets/img/news/example.jpg）：\n提示：请先把图片文件放入 assets/img/ 目录', 'assets/img/news/');
    if (src === null) return;
    var desc = prompt('图片说明（alt 文本，可留空）：', '') || '';
    var ta = qs('#fContent');
    var pos = ta.selectionStart;
    ta.setRangeText('![' + desc + '](' + src.trim() + ')', pos, pos, 'end');
    ta.focus();
    renderPreview();
  }

  function buildToolbar() {
    var tools = [
      { label: 'B', title: '粗体', run: function () { wrap('**', '**', '粗体'); } },
      { label: 'I', title: '斜体', run: function () { wrap('*', '*', '斜体'); } },
      { label: 'S', title: '删除线', run: function () { wrap('~~', '~~', '删除线'); } },
      { label: 'H2', title: '二级标题', run: function () { wrap('\n## ', '\n', '标题'); } },
      { label: 'H3', title: '三级标题', run: function () { wrap('\n### ', '\n', '小标题'); } },
      { label: '“ ”', title: '引用', run: function () { wrap('\n> ', '\n', '引用内容'); } },
      { label: '• 列表', title: '无序列表', run: function () { wrap('\n- ', '', '列表项'); } },
      { label: '1. 列表', title: '有序列表', run: function () { wrap('\n1. ', '', '列表项'); } },
      { label: '&lt;/&gt;', title: '行内代码', run: function () { wrap('`', '`', '代码'); } },
      { label: '⌗ 链接', title: '链接', run: function () { wrap('[', '](https://)', '链接文字'); } },
      { label: '🖼 图片', title: '插入图片', run: insertImage },
      { label: '―', title: '分割线', run: function () { var ta = qs('#fContent'); ta.setRangeText('\n\n---\n\n', ta.selectionStart, ta.selectionEnd, 'end'); ta.focus(); renderPreview(); } },
      { label: '表格', title: '插入表格', run: function () { wrap('\n\n| 表头1 | 表头2 | 表头3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |\n', '', ''); } }
    ];
    qs('#toolbar').innerHTML = tools.map(function (t, i) {
      return '<button type="button" class="tool-btn" data-i="' + i + '" title="' + t.title + '">' + t.label + '</button>';
    }).join('');
    qs('#toolbar').addEventListener('click', function (e) {
      var b = e.target.closest('.tool-btn');
      if (b) tools[+b.dataset.i].run();
    });
  }

  /* ============ 保存（直接写服务器） ============ */
  async function save() {
    var a = readForm();
    if (!a.title) { toast('请填写标题'); qs('#fTitle').focus(); return false; }
    if (!a.content.trim()) { toast('请填写正文内容'); qs('#fContent').focus(); return false; }
    try {
      var r = await saveToServer(a);
      var existed = r.list.some(function (x) { return x.id === a.id && x.date === a.date; });
      editingId = a.id;
      clearDraft();
      renderManage(r.list);
      updateStatus(true);
      toast((existed ? '已更新：' : '已发布：') + a.title);
      return true;
    } catch (e) {
      updateStatus(false);
      toast('保存失败：服务器未运行或不可达');
      return false;
    }
  }

  /* ============ 管理表 ============ */
  function renderManage(list) {
    var body = qs('#manageBody');
    if (!body) return;
    var render = function (arr) {
      if (!arr.length) {
        body.innerHTML = '<tr><td colspan="5" class="mt-empty">data 文件夹中还没有文章。撰写完成后点击「保存并发布」。</td></tr>';
        return;
      }
      var catNames = { campus: '校园新闻', notice: '通知公告', activity: '活动报道' };
      body.innerHTML = arr.map(function (a) {
        return '<tr>' +
          '<td class="row-title">' + S.esc(a.title) + '</td>' +
          '<td>' + S.esc(catNames[a.category] || a.category) + '</td>' +
          '<td>' + S.esc(a.author || '—') + '</td>' +
          '<td>' + S.esc(a.date || '') + '</td>' +
          '<td><div class="mt-actions">' +
            '<button class="btn btn-outline btn-sm" data-act="view" data-id="' + a.id + '">查看</button>' +
            '<button class="btn btn-outline btn-sm" data-act="edit" data-id="' + a.id + '">编辑</button>' +
            '<button class="btn btn-danger btn-sm" data-act="del" data-id="' + a.id + '">删除</button>' +
          '</div></td>' +
        '</tr>';
      }).join('');
    };
    if (list) { render(list); return; }
    listArticles().then(render).catch(function () {
      body.innerHTML = '<tr><td colspan="5" class="mt-empty">无法连接服务器——请先启动 server.js（双击「启动新闻站.bat」）。</td></tr>';
    });
  }

  function bindManage() {
    qs('#manageBody').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-act]');
      if (!b) return;
      b.disabled = true;
      handleManage(b.dataset.act, b.dataset.id).finally(function () { b.disabled = false; });
    });
  }

  async function handleManage(act, id) {
    var list;
    try { list = await listArticles(); }
    catch (e) { toast('无法连接服务器'); return; }
    var a = list.filter(function (x) { return x.id === id; })[0];
    if (!a) return;

    if (act === 'view') {
      window.open('article.html?id=' + encodeURIComponent(id), '_blank');
    } else if (act === 'edit') {
      if (hasDraftConflict() && !confirm('检测到未发布的草稿。打开这篇文章会覆盖草稿，继续？')) return;
      fillForm(a);
      toast('正在编辑：' + a.title + '，改完点「保存并发布」覆盖原文件');
    } else if (act === 'del') {
      if (!confirm('确定删除「' + a.title + '」？\n将删除 data/' + id + '.json 文件。')) return;
      try {
        await deleteFromServer(id);
        if (editingId === id) { editingId = null; clearDraft(); fillForm(null); }
        renderManage();
        toast('已删除');
      } catch (e) { toast('删除失败：服务器未运行或不可达'); }
    }
  }

  /* ============ 编辑指定文章（editor.html?id=xxx） ============ */
  async function openFromUrl() {
    var qid = new URLSearchParams(location.search).get('id');
    if (!qid) return;
    try {
      var list = await listArticles();
      var a = list.filter(function (x) { return x.id === qid; })[0];
      if (a) {
        if (hasDraftConflict() && !confirm('检测到未发布的草稿。打开这篇文章会覆盖草稿，继续？')) return;
        fillForm(a);
        toast('正在编辑：' + a.title + '，改完点「保存并发布」覆盖原文件');
      } else {
        toast('未找到 id 为 ' + qid + ' 的文章');
      }
    } catch (e) {
      toast('无法连接服务器——请先启动 server.js');
    }
  }
  function hasDraftConflict() {
    try {
      var d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      return d && (d.title || d.content);
    } catch (e) { return false; }
  }

  /* ============ 状态 ============ */
  function updateStatus(ok) {
    var el = qs('#syncStatus');
    if (!el) return;
    el.textContent = ok ? '服务器已连接 · 自动保存中' : '无法连接服务器——请先启动 server.js';
    el.classList.toggle('ok', !!ok);
  }

  /* ============ 初始化 ============ */
  function init() {
    qs('#fDate').value = new Date().toISOString().slice(0, 10);

    var restored = restoreDraft();

    buildToolbar();
    renderPreview();
    bindManage();

    // 检查服务器并加载文章列表 / 打开指定文章
    listArticles().then(function (list) {
      updateStatus(true);
      renderManage(list);
      if (restored) toast('已恢复上次未发布的草稿');
      return openFromUrl();
    }).catch(function () {
      updateStatus(false);
      renderManage();
      if (restored) toast('已恢复上次未发布的草稿');
    });

    ['fTitle', 'fCat', 'fAuthor', 'fDate', 'fCover', 'fSummary', 'fContent'].forEach(function (id) {
      var el = qs('#' + id);
      el.addEventListener('input', scheduleDraft);
      el.addEventListener('change', scheduleDraft);
    });

    qs('#fContent').addEventListener('input', renderPreview);
    qs('#fContent').addEventListener('keydown', function (e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        this.setRangeText('  ', this.selectionStart, this.selectionEnd, 'end');
        renderPreview();
      }
    });
    window.addEventListener('beforeunload', saveDraft);

    qs('#btnSave').addEventListener('click', function () { save(); });
    qs('#btnPreview').addEventListener('click', async function () {
      if (await save()) window.open('article.html?id=' + encodeURIComponent(readForm().id), '_blank');
    });
    qs('#btnClear').addEventListener('click', function () {
      if (confirm('清空当前表单（未保存的内容将丢失）？')) fillForm(null);
    });
  }

  window.Editor = { init: init };
})();
