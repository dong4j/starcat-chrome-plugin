# Chrome Web Store Listing 填写稿

> 本文件是 `0.1.0` 当前功能的文案草稿。字段长度、分类和地区选项以提交当日 Developer Dashboard 为准。

## 基础字段

| 字段 | 建议值 |
|---|---|
| Name | `Starcat for GitHub` |
| Summary | `Bring your local Starcat repository context to GitHub and Google results.` |
| Category | Productivity |
| 价格 | Free |
| 平台要求 | Requires the Starcat app for macOS and one-time local pairing. |
| Homepage URL | Starcat 官方产品页（提交前填入长期 HTTPS URL） |
| Support URL | 公开、长期可访问的支持页或 GitHub Issues URL |
| Privacy policy | 公开、长期可访问的隐私政策 HTTPS URL |

若提交时保留 manifest 的 `Starcat Browser Plugin` 名称，商店名称、截图与审核备注也必须使用该名称，不能混用两个产品名称。

## Detailed description

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

## 发布前替换项

- [ ] 用实际官网、支持页和隐私政策 URL 替换表格中的占位说明。
- [ ] 确认文字不承诺未实现的 AI、自动采集、所有搜索引擎或跨平台能力。
- [ ] 如移除 Google 搜索功能，同步删改本文件、`PRIVACY_DISCLOSURE.md`、截图和审核说明。
- [ ] 为英文和简体中文准备一致的 listing 本地化；不同语言不得描述不同功能集。
