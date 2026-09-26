# cnuhs-news-node-js 校园新闻站（Node.js 版）

Node.js 服务器 + 纯静态前台，**零依赖**（只用 Node 内置模块）。
保存/删除文章直接由服务器写入 `data/` 文件夹——**无需任何浏览器授权**。

## 启动

双击 `start-server.bat`（会自动打开浏览器）。

或手动启动：

```powershell
D:\nodejs\node.exe "C:\Users\az\Desktop\cnuhs-news-node-js\server.js"
```

然后访问 `http://localhost:8000/`。

启动后控制台会显示本机和局域网访问地址（例如 `http://192.168.x.x:8000/`），
**局域网内其他电脑用该地址即可访问网站**（他们也能编辑，编辑无门槛）。

> 前提：Windows 防火墙首次会询问是否允许 Node 访问网络，选择“允许”。

## 拷贝到没有 Node.js 的电脑（免安装便携版）

文件夹里已自带 `node.exe`（绿色免安装），目标电脑**什么都不用装**：

1. 把整个 `cnuhs-news-node-js` 文件夹拷到 U 盘/网盘（约 70 MB）
2. **跳过这三项不拷**：`node_modules`、`package.json`、`package-lock.json`（是打包工具的残留，无用）
3. 目标电脑上双击 `启动新闻站-免安装.bat`——浏览器自动打开，即用

该脚本优先用文件夹内的 `node.exe`；若你删除了它，会退回系统 PATH 里的 node（如果有）。

> 注意：`server.js` 端口固定从 8000 开始，被占用会自动换 8001~8020；重复双击不会报错（提示已在运行并直接打开浏览器）。

## 使用

1. 访问 `http://localhost:8000/editor.html`
2. 填写标题、栏目、记者、日期、封面图路径、摘要，用 Markdown 写正文（草稿自动暂存）
3. 点「保存并发布」→ 服务器立即写入 `data/<文章id>.json`，所有人可见

编辑已有文章：文章页「编辑本文」按钮，或编辑器管理表里的「编辑」。
删除同理，直接删掉对应的 json 文件。

## 文章存储

```
data/
├── index.json      # 文章 id 列表（服务器自动维护）
├── nabc123.json    # 每篇文章一个文件，文件名 = 文章 id
└── ...
```

## API（服务器提供）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/list` | 全部文章（日期倒序） |
| POST | `/api/save` | 保存文章，body: `{"article": {...}}` |
| POST | `/api/delete` | 删除文章，body: `{"id": "..."}` |

## 图片

放入 `assets/img/`（建议 `assets/img/news/`），编辑器里填相对路径
如 `assets/img/news/example.jpg`。留空封面显示占位底图。

## 栏目

- `campus` → 校园新闻
- `notice` → 通知公告
- `activity` → 活动报道

修改站点名称：搜索各 HTML 中的 `CNUHS` 字样替换。

## 与纯静态版（cnuhs-news）的区别

| | 纯静态版 | Node 版 |
|---|---|---|
| 启动 | 双击 HTML 即可看（但读不到 data/） | 需先启动服务器 |
| 编辑保存 | 浏览器文件夹授权（首次选择、重启后点一下恢复） | 完全自动，无授权 |
| 双击 file:// 打开 | 前台读不到文章 | 不适用（统一走 http） |
| 局域网他人编辑 | 需各自授权 | 直接访问即可编辑 |
