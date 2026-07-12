# Chrome Web Store 上架指导

> 此文件已迁入 `docs/`，由 [发布资料索引](README.md) 统一导航。

> 适用仓库：`starcat-chrome-plugin`
> 当前源码基线：`manifest.json` 的 `0.1.0`
> 最后核对：2026-07-12
> 目标渠道：Chrome Web Store（公开发布）

本文档是 Starcat Chrome 插件的实际上架手册。它以当前 `manifest.json`、`src/` 和本仓库的隐私声明为准；不把计划中的功能当作已经实现的功能。

## 1. 发布结论与边界

当前状态为 **不可以直接提交（No-Go）**。源码可被打成 Chrome Web Store 的 MV3 ZIP，但提交前必须先完成本章的阻断项，尤其是“实际站点范围”和“隐私资料”一致性。

插件的单一目的应明确写为：

> 在 GitHub 仓库页和包含 GitHub 仓库结果的 Google 搜索页中，显示并打开用户本机 Starcat 已有的仓库上下文。

它不是 GitHub API 客户端，不登录 GitHub，不访问 Starcat 云端、AI provider 或 OpenSSF。它仅访问用户配置的 loopback Companion API：`http://127.0.0.1:{port}/plugin/v1/*`。

## 2. 当前源码事实（提交资料的唯一依据）

| 项目 | 当前事实 | 上架资料中的表述 |
|---|---|---|
| Manifest | Manifest V3，版本 `0.1.0` | Chrome extension / MV3 |
| 权限 | `storage` | 保存服务地址与 Local API Key，供用户后续配对 |
| 页面范围 | `github.com`、Google 各地区 `/search` 页 | 不能写成“仅 GitHub” |
| Host 权限 | GitHub、Google 搜索域名、`127.0.0.1`、`localhost` | 逐项解释，禁止泛称“访问所有网站” |
| 页面读取 | 读取当前 URL 与已渲染的 GitHub 仓库链接；Google 页最多识别 8 条 GitHub 仓库搜索结果 | 用于定位仓库并渲染 Starcat 徽标，不上传整页内容 |
| 本机通信 | `Authorization: Bearer <Local API Key>` | 请求只发往用户本机 Starcat，不发往远端服务器 |
| 本地保存 | service URL、Local API Key | 不保存笔记正文、完整网页内容或浏览历史 |
| 用户生成内容 | 用户编辑笔记时，笔记正文发送到本机 Starcat 并由 Starcat 保存 | 在隐私表中披露“用户内容在本机处理” |

Google 搜索页并非空权限：当前源码会为已 Star 的 GitHub 搜索结果添加 `Open in Starcat` 与 Health 徽标。因此，若产品决定只支持 GitHub，必须先改代码和 manifest；仅修改文案不能解决审核问题。

## 3. 上架阻断项

以下项目全部完成后，才能把本文件的状态从 No-Go 改为 Go。

- [ ] `README.md`、`README-ZH.md`、`PRIVACY.md`、Chrome Web Store 描述都明确涵盖 GitHub 与 Google 搜索页。
- [ ] 在 Chrome Web Store Privacy practices 中如实选择并解释：浏览活动 / 网站内容的本地处理、认证信息（Local API Key）本地保存、用户笔记内容发送至本机 Starcat。
- [ ] 确认 Local API Key 在浏览器扩展存储中的保护策略满足 Chrome 当期用户数据政策；不能仅凭“数据不出设备”省略该项核验。
- [ ] 完成干净 Chrome Profile 的端到端手测：未配对、错误 key、正确配对、GitHub 仓库页、Google 搜索页、保存笔记、Open in Starcat、关闭 Starcat App。
- [ ] 为审核员准备可下载的 Starcat macOS 测试版，以及从 App 内启用 Browser Plugin、取得 Local API Key 的可复现路径。
- [ ] 准备至少一张真实功能截图；建议准备 5 张，覆盖配对、GitHub 侧栏、Code 菜单、Google 搜索结果、错误/未配对状态。
- [ ] 在干净目录重新生成 ZIP，确认解压后 `manifest.json` 位于 ZIP 根目录，且不包含 `.git`、`.DS_Store`、`.idea`、`.claude` 或任何密钥文件。

## 4. 商店后台填写稿

以下英文为建议初稿。提交时必须与实际版本、截图和隐私页保持一致。

### 4.1 名称与摘要

| 字段 | 建议值 |
|---|---|
| Name | `Starcat for GitHub` |
| Summary | `Bring your local Starcat repository context to GitHub and Google results.` |
| Category | Productivity |
| 适用平台说明 | Requires the Starcat app for macOS and local pairing. |

若保持 manifest 中的 `Starcat Browser Plugin` 名称，商店标题、截图和审核备注也必须使用同一名称，避免审核员认为是不同产品。

### 4.2 Detailed description

```text
Starcat for GitHub brings the repository context you already keep in the Starcat macOS app to GitHub repository pages and Google search results that link to GitHub repositories.

After you pair the extension with the Starcat app running on your Mac, you can:

• See Starcat recommendations, private notes, repository health, and OpenSSF signals on GitHub repository pages.
• Open a repository or supported Starcat analysis workflows directly in the Starcat app.
• Add an “Open in Starcat” action and a health signal to Google search results for GitHub repositories already starred in Starcat.
• Keep private notes in Starcat: note text is sent only to your locally running Starcat app when you save it.

The extension does not sign in to GitHub, call GitHub APIs, or send browsing data, notes, or API keys to Starcat servers. It communicates only with the Starcat Companion service on your own Mac at 127.0.0.1.

Requires Starcat for macOS and one-time local pairing in the extension settings.
```

不要加入“AI summary”“自动采集”“所有搜索引擎”“所有浏览器”或任何当前版本没有的能力。

### 4.3 URL

| 字段 | 应填写内容 |
|---|---|
| Homepage URL | Starcat 官方产品页 |
| Support URL | 公开、长期可访问的问题反馈页或 GitHub Issues 页面 |
| Privacy policy | 公开、稳定的隐私政策 URL；内容必须以本文件第 2 节为准 |
| Official URL（可选） | 经 Google Search Console 验证归属的 Starcat 官方域名 |

不要填写会失效的下载链接、私有 GitHub 地址或 `raw.githubusercontent.com` 临时链接作为唯一隐私政策入口。

## 5. Privacy practices 填写原则

Chrome 要求最小权限、单一目的和准确的数据处理披露。以下是审核说明稿；实际 checkbox 名称以提交当日 Developer Dashboard 为准。

### 5.1 Single purpose description

```text
Show repository context from the user's local Starcat macOS app on GitHub repository pages and Google Search results that link to GitHub repositories.
```

### 5.2 Permissions justification

| 权限 / Host | 英文说明 |
|---|---|
| `storage` | Stores only the user-entered local Starcat service URL and Local API Key needed for local pairing. |
| `https://github.com/*` | Reads the current GitHub repository URL and injects Starcat context into repository page UI. |
| Google `/search` patterns | Detects GitHub repository links in Google search results and shows local Starcat actions only for repositories already starred by the user. |
| `http://127.0.0.1:*/*` and `http://localhost:*/*` | Communicates only with the Starcat Companion service running on the same Mac after the user completes local pairing. |

### 5.3 数据使用声明

不要勾选“does not collect data”。Chrome 将本地处理也视为用户数据处理。提交前逐项核对：

| 数据类别 | 当前实现 | 建议披露 |
|---|---|---|
| Browsing activity / Website content | 读取当前页 URL、GitHub 仓库链接和必要的 DOM 位置 | 本地用于识别仓库并渲染功能，不用于广告或分析 |
| Authentication information | Local API Key 保存在 extension local storage，并作为 loopback Bearer token | 仅用于认证同一 Mac 上的 Starcat Companion API，不共享给第三方 |
| User-generated content | 用户主动保存的笔记正文 | 仅在用户点击保存时发给本机 Starcat；扩展不在自身 storage 中保存正文 |

在 Limited Use certification 中，仅在所有声明准确、没有将这些数据用于广告/画像/出售、且没有未披露的人工访问后才勾选认证。

## 6. 截图与素材

Chrome Web Store 至少需要一张 `1280×800` 或 `640×400` 的真实截图；建议使用 `1280×800 PNG`，最多上传 5 张。额外准备 `440×280` 小型推广图；`1400×560` marquee 图可选。

建议命名并归档到发布工作目录（不必加入插件运行时 ZIP）：

```text
store-assets/
  chrome-01-pairing-1280x800.png
  chrome-02-github-context-1280x800.png
  chrome-03-notes-1280x800.png
  chrome-04-code-menu-1280x800.png
  chrome-05-google-results-1280x800.png
  chrome-promo-440x280.png
  chrome-marquee-1400x560.png
```

截图必须来自真实版本，且不能显示 Local API Key、私人笔记、GitHub token、测试邮箱或误导性的“已获推荐”徽章。

## 7. 审核员测试说明

把以下内容放入 Developer Dashboard 的 test instructions / review notes，并将方括号替换为可用信息。

```text
This extension is a companion for the Starcat macOS app. It has no cloud account or GitHub sign-in flow.

Test environment:
1. Download and open the Starcat macOS review build: [HTTPS URL].
2. In Starcat, open Settings > Integrations > Browser Plugin and enable the local service.
3. Copy the service URL and Local API Key from Starcat Settings > Integrations > Local API Key.
4. Open the extension popup, enter the service URL and Local API Key, then click Test Connection.
5. Open [GitHub repository URL] to inspect the Starcat context surfaces.
6. Open [Google Search URL containing the same GitHub repository] to inspect the “Open in Starcat” and Health badges.

The extension reads GitHub repository links and the minimum rendered page context needed to place its UI. It sends requests only to the locally running Starcat app at 127.0.0.1. It does not call GitHub APIs or any remote Starcat service.
```

若不能为审核员提供可运行的 macOS 环境与一键配对路径，先不要提交；这不是可以用“源码开源”替代的审核条件。

## 8. 打包与提交

仅在完成第 3 节并人工验收后执行。以下命令是操作说明，不应在日常开发中替代测试。

```bash
cd supports/extensions/starcat-chrome-plugin
python3 -m json.tool manifest.json >/dev/null
node --check src/shared/shared.js
node --check src/popup/popup.js
node --check src/options/options.js
node --check src/content/content-script.js
zip -r ../starcat-chrome-plugin-0.1.0.zip manifest.json src -x '*.DS_Store'
unzip -l ../starcat-chrome-plugin-0.1.0.zip
```

上传步骤：

1. 使用已开启两步验证、长期可维护的 Google 账号注册 Chrome Web Store developer，并完成一次性注册费支付。
2. 在 Developer Dashboard 上传 ZIP；第一次上传后记录 extension ID，后续更新不得更换 ID。
3. 填写 Store listing、Privacy practices 与 Distribution；先选择 Private（trusted testers）完成商店审核路径验证，再切换 Public。
4. 选择发布地区，上传真实截图和隐私政策 URL。
5. 提交审核后，保存 ZIP 的 SHA-256、manifest 版本、提交时间、审核备注和后台截图到发布记录。

## 9. 版本与回滚

- 每次上传必须递增 `manifest.json` 的 `version`，同时更新 `CHANGELOG.md`。
- 商店名称、隐私政策、截图、审核说明与 manifest 范围必须随版本同步更新。
- 出现隐私或权限误报时，立即停止公开发布；先修正代码/声明并用新版本重新审核，不要仅改商店文案掩盖旧行为。

## 10. 官方参考

- Chrome Web Store：<https://developer.chrome.com/docs/webstore>
- Store listing：<https://developer.chrome.com/docs/webstore/cws-dashboard-listing>
- Privacy practices：<https://developer.chrome.com/docs/webstore/cws-dashboard-privacy>
- User Data Policy：<https://developer.chrome.com/docs/webstore/user_data>
- Developer 注册：<https://developer.chrome.com/docs/webstore/register>
- 审核流程：<https://developer.chrome.com/docs/webstore/review-process>
