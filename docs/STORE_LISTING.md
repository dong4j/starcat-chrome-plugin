# Chrome Web Store Listing 填写稿

> 本文件是 `1.0.0` 当前功能的文案草稿。字段长度、分类和地区选项以提交当日 Developer Dashboard 为准。

## 基础字段

| 字段 | 建议值 |
|---|---|
| Name | `Starcat Browser Plugin` |
| Summary | `Bring your local Starcat repository context to GitHub and Google results.` |
| Category | Productivity |
| 价格 | Free |
| 平台要求 | Requires the Starcat app for macOS and one-time local pairing. |
| Homepage URL | `https://starcat.ink` |
| Support URL | `https://github.com/starcat-app/starcat-chrome-plugin/issues` |
| Privacy policy | `https://starcat.ink/privacy.html`（部署包含 Browser Plugin 专节的当前版本后使用） |

商店名称、截图与审核备注统一使用 `Starcat Browser Plugin`。

## Detailed description

```text
Starcat Browser Plugin brings the repository context you already keep in the Starcat macOS app to GitHub repository pages and Google search results that link to GitHub repositories.

After you pair the extension with the Starcat app running on your Mac, you can:

• See Starcat recommendations, private notes, repository health, and OpenSSF signals on GitHub repository pages.
• Open a repository or supported Starcat analysis workflows directly in the Starcat app.
• Add an “Open in Starcat” action and a health signal to Google search results for GitHub repositories already starred in Starcat.
• Keep private notes in Starcat: note text is sent only to your locally running Starcat app when you save it.

The extension does not sign in to GitHub, call GitHub APIs, or send browsing data, notes, or API keys to Starcat servers. It communicates only with the Starcat Companion service on your own Mac at 127.0.0.1.

Requires Starcat for macOS and one-time local pairing in the extension settings.
```

## 简体中文本地化

| 字段 | 建议值 |
|---|---|
| 名称 | `Starcat Browser Plugin` |
| 摘要 | `在 GitHub 与 Google 搜索结果中显示本机 Starcat 仓库上下文。` |

```text
Starcat Browser Plugin 将 Starcat macOS 应用中已有的仓库上下文带到 GitHub 仓库页，以及包含 GitHub 仓库链接的 Google 搜索结果页。

与 Mac 上运行的 Starcat 完成本机配对后，你可以：

• 在 GitHub 仓库页查看 Starcat 推荐、私人笔记、仓库健康度和 OpenSSF 信号。
• 直接在 Starcat 应用中打开仓库或受支持的分析工作流。
• 为 Starcat 中已 Star 的 GitHub 仓库搜索结果显示“在 Starcat 中打开”和健康度信息。
• 在 GitHub 页面编辑私人笔记；只有点击保存时，笔记正文才会发送到本机运行的 Starcat。

插件不会登录 GitHub、调用 GitHub API，也不会把浏览数据、笔记或 Local API Key 发送到 Starcat 服务器。它只与同一台 Mac 上 127.0.0.1 地址的 Starcat Companion 服务通信。

需要 macOS 版 Starcat，并在插件设置中完成一次本机配对。
```

## 发布前替换项

- [x] 官网、支持页和隐私政策使用长期 HTTPS URL；隐私页须先部署包含 Browser Plugin 专节的当前版本。
- [ ] 确认文字不承诺未实现的 AI、自动采集、所有搜索引擎或跨平台能力。
- [x] 保留 Google 搜索功能，并在本文件、`PRIVACY_DISCLOSURE.md`、截图要求和审核说明中统一披露。
- [x] 英文和简体中文 listing 使用一致的名称、功能范围与隐私边界。
