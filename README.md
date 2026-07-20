# Starcat Chrome Plugin

<!-- starcat-promo:start -->
<div align="center">
<a href="https://starcat.ink"><img src="https://raw.githubusercontent.com/dong4j/starcat-pro/main/banner.webp" width="100%" alt="Starcat" /></a>

<p><strong>Chrome/Chromium companion extension that brings Starcat context to GitHub pages.</strong></p>
<p>Starcat is a native macOS app that turns GitHub Stars into a searchable, organized and AI-assisted knowledge base. It supports README rendering, tags, private notes, release tracking, repository health signals, AI summaries, semantic search, browser plugin workflows and self-hostable support APIs.</p>

<a href="https://github.com/dong4j/homebrew-starcat"><img src="https://img.shields.io/badge/Install%20with-Homebrew-FBBF24?style=for-the-badge&logo=homebrew&logoColor=white" width="220" alt="Install with Homebrew"/></a>
<br/>
<sub><a href="./README-ZH.md">中文说明</a></sub>
</div>

<div align="center">
<a href="https://starcat.ink"><img src="https://img.shields.io/badge/website-starcat.ink-38BDF8?style=flat&color=blue" alt="website"/></a>
<a href="https://github.com/dong4j/starcat-pro"><img src="https://img.shields.io/badge/support-starcat--pro-lightgrey.svg?style=flat&color=blue" alt="support"/></a>
<a href="https://github.com/dong4j/homebrew-starcat"><img src="https://img.shields.io/badge/install-homebrew-lightgrey.svg?style=flat&color=blue" alt="homebrew"/></a>
<a href="https://github.com/starcat-app/starcat-localization"><img src="https://img.shields.io/badge/localization-open-lightgrey.svg?style=flat&color=blue" alt="localization"/></a>
</div>

<div align="center">
<img width="900" src="https://raw.githubusercontent.com/dong4j/starcat-pro/main/main.webp" alt="Starcat main window"/>
</div>

**Preferred install method:**

```bash
brew tap dong4j/starcat
brew trust dong4j/starcat
brew install --cask starcat
```

**Useful links:**

- Home: https://starcat.ink
- Download: https://starcat.ink/downloads/Starcat-1.1.0-arm64.dmg
- Public support and release notes: https://github.com/dong4j/starcat-pro
- Homebrew tap: https://github.com/dong4j/homebrew-starcat
- Browser plugins: [Chrome](https://github.com/dong4j/starcat-chrome-plugin) / [Safari](https://github.com/dong4j/starcat-safari-plugin)
- Localization: https://github.com/starcat-app/starcat-localization

**Starcat ecosystem:**

- [starcat-sharing-api](https://github.com/dong4j/starcat-sharing-api)
- [starcat-trending-api](https://github.com/dong4j/starcat-trending-api)
- [starcat-weekly-api](https://github.com/dong4j/starcat-weekly-api)
- [starcat-wiki-api](https://github.com/dong4j/starcat-wiki-api)
- [starcat-recommend-api](https://github.com/dong4j/starcat-recommend-api)
- [starcat-discovery-api](https://github.com/dong4j/starcat-discovery-api)
- [starcat-license-api](https://github.com/dong4j/starcat-license-api)
<!-- starcat-promo:end -->

Starcat Chrome Plugin 是 Starcat 的 GitHub 与 Google 搜索结果增强插件。它在 GitHub repo 页面展示 Starcat 已有上下文，并在 Google 搜索结果中为已 Star 的 GitHub 仓库显示本机 Starcat 入口和 Health 信息；它不直接访问 GitHub API、Starcat 后端、OpenSSF 或 AI provider。

## 功能范围

- 在 GitHub repo 页面展示相似仓库推荐。
- 展示已收录的 Wiki 入口。
- 读取、保存 Starcat 私人笔记。
- 展示 Starcat 已缓存的 Health / OpenSSF 分数。
- 触发 Starcat App 内的 CodeFlow / Codebase 动作。
- 在 Google 搜索结果中为已 Star 的 GitHub 仓库展示 `Open in Starcat` 和 Health 徽标。

## 本地加载

1. 在 Chrome 打开 `chrome://extensions/`。
2. 开启 Developer mode。
3. 点击 Load unpacked。
4. 选择本目录: `supports/extensions/starcat-chrome-plugin`。
5. 在 Starcat 打开 Settings → Integrations → Browser Plugin, 启用服务; 然后到 Settings → Integrations → Local API Key 复制 key。
6. 左键点击工具栏里的 Starcat 插件图标, 在弹窗中填入 endpoint 端口和 Local API Key。
7. 点击 Test。

完整配置页仍可从弹窗中的 Open full options 打开。

## 通信边界

插件只通过 Starcat App 暴露的本机 HTTP 服务通信:

```text
http://127.0.0.1:{port}/plugin/v1
```

所有业务请求都需要:

```text
Authorization: Bearer <local-api-key>
```

Starcat Local API Key 只授权本机 loopback 接口, 不等同于 GitHub token、AI key 或 Starcat 后端 API key。

## 文件说明

| 文件 | 说明 |
|---|---|
| `manifest.json` | Chrome MV3 入口声明。 |
| `LICENSE` | 开源许可证。 |
| `PRIVACY.md` | 隐私与数据边界说明。 |
| `SECURITY.md` | 安全边界与漏洞反馈说明。 |
| `CONTRIBUTING.md` | 本地开发与贡献约定。 |
| `CHANGELOG.md` | 版本变更记录。 |
| `src/shared/shared.js` | 配置读写、GitHub repo URL 解析、本机 API client。 |
| `src/popup/` | 左键点击插件图标时显示的快速配对弹窗。 |
| `src/options/` | 端口、Local API Key 配置与连接测试页。 |
| `src/content/` | GitHub repo 页面板注入与渲染。 |
| `docs/` | 商店上架资料、隐私披露、审核说明与素材规范。 |

## 发布资料

商店发布前请先阅读 [docs/README.md](docs/README.md)。其中的资料以当前源码行为为准；特别是 Google 搜索页权限、Local API Key 配对和本机 Companion API 的数据边界。

## 验证

```bash
python3 -m json.tool supports/extensions/starcat-chrome-plugin/manifest.json >/dev/null
node --check supports/extensions/starcat-chrome-plugin/src/shared/shared.js
node --check supports/extensions/starcat-chrome-plugin/src/popup/popup.js
node --check supports/extensions/starcat-chrome-plugin/src/options/options.js
node --check supports/extensions/starcat-chrome-plugin/src/content/content-script.js
```
