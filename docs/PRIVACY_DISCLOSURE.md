# Chrome Privacy Practices 核对表

## 当前数据流

```text
GitHub / Google Search 页面
  → 当前 URL、GitHub 仓库 owner/repo、必要的已渲染 DOM
  → extension content script
  → http://127.0.0.1:{port}/plugin/v1/*（Bearer Local API Key）
  → 同一台 Mac 上运行的 Starcat App
```

扩展不请求 GitHub API、Starcat 后端、AI provider、OpenSSF 或广告/分析服务；用户点击保存时，笔记正文只发给本机 Starcat App。

## Dashboard 填写依据

| 项目 | 当前代码事实 | 提交时的说明 |
|---|---|---|
| Single purpose | 显示用户本机 Starcat 的仓库上下文 | `Show repository context from the user's local Starcat macOS app on GitHub repository pages and Google Search results that link to GitHub repositories.` |
| `storage` | 保存 service URL 与 Local API Key | 只用于用户完成本机配对和后续 loopback 认证。 |
| GitHub host | 读取仓库 URL、放置 UI | 仅 GitHub repo 页面。 |
| Google hosts | 识别搜索结果中 GitHub 仓库链接，最多处理 8 条 | 只为已 Star 仓库显示本机 Starcat 动作和 Health。 |
| Loopback hosts | 与 `127.0.0.1` / `localhost` 通信 | 只连接同机 Starcat Companion API。 |
| Browsing activity / website content | URL、仓库链接与最少 DOM 本地处理 | 仅为用户可见功能，不做广告、分析或出售。 |
| Authentication information | Local API Key 作为 Bearer token | 不发送给任何第三方或远端服务。 |
| User-generated content | 用户主动保存的笔记 | 点击保存时交给同机 Starcat；扩展不保存正文。 |

## 必须完成的政策核验

- [ ] Privacy practices 不能选择“does not collect data”；Chrome 对本地处理也要求准确披露。
- [ ] 核验 Local API Key 在 extension storage 中的持久化策略是否满足 Chrome 当期认证信息处理要求；未通过前不得勾选 Limited Use 认证。
- [ ] 核验公开隐私政策 `PRIVACY.md` 对 Google 搜索页、Local API Key 和笔记本机写入的描述与此文件一致。
- [ ] 若扩展未来新增远端请求、遥测、第三方 SDK 或更多站点权限，必须先更新本文件、隐私政策和 Dashboard，再发布代码。

## 不能使用的表述

- “只在 GitHub 页面运行”。
- “不处理任何浏览活动或网页内容”。
- “不会存储认证信息”。
- “不收集数据”，除非实现和 Dashboard 允许且经过重新核验。
