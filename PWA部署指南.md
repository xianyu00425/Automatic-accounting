# PWA 部署指南

## 文件结构

```
自动记账/
├── 自动记账.html      # 主应用（已添加 PWA 支持）
├── manifest.json      # PWA 清单
├── sw.js              # Service Worker
└── icons/
    ├── icon-192.png   # 应用图标
    └── icon-512.png   # 高清图标
```

## 部署方式

### 方式 1：本地 HTTP 服务器（开发/个人使用）

使用任意 HTTP 服务器启动即可：

```bash
# Python
python -m http.server 8080

# Node.js (需要 http-server)
npx http-server -p 8080

# PHP
php -S localhost:8080
```

然后浏览器访问 `http://localhost:8080/自动记账.html`

### 方式 2：GitHub Pages（推荐，免费）

1. 创建 GitHub 仓库
2. 推送所有文件（`自动记账.html`、`manifest.json`、`sw.js`、`icons/`）
3. 在仓库 Settings → Pages 启用 GitHub Pages
4. 访问 `https://你的用户名.github.io/仓库名/自动记账.html`

### 方式 3：Vercel / Netlify（免费）

直接拖拽文件夹或连接 GitHub 仓库部署。

## 重要：HTTPS 要求

PWA 的 Service Worker **必须**通过 HTTPS 或 `localhost` 运行。
- 本地开发：`localhost` 可以工作
- 公网部署：必须使用 HTTPS

## 使用方法

### 首次使用
1. 用 Chrome/Safari 打开部署后的 URL
2. Chrome 会自动弹出"添加到主屏幕"提示
3. Safari：点击分享按钮 → "添加到主屏幕"
4. 安装后即可像原生应用一样使用

### 多用户使用
不同用户访问同一 URL，各自手机上的数据独立存储（通过浏览器 localStorage 隔离），互不影响。

### 产品更新
1. 修改 `自动记账.html` 文件并重新部署
2. 修改 `sw.js` 中的 `CACHE_VERSION` 版本号（如 `'v1'` → `'v2'`）
3. 用户下次打开应用时自动加载新版本
4. 或用户会看到"新版本已就绪"提示，刷新即可

## 注意事项

- 每次修改 HTML 或相关资源后，需要递增 `sw.js` 中的 `CACHE_VERSION` 以触发缓存更新
- 桌面端打开应用会显示居中的手机视图（与当前行为一致）
- 所有数据存储在设备本地，不会同步到其他设备
