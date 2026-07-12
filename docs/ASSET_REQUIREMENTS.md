# Chrome 商店素材清单

所有截图必须来自待提交版本，且不包含 Local API Key、私人笔记、测试账号、GitHub token 或未发布功能。

## 必备文件

| 文件 | 规格 | 内容 |
|---|---|---|
| `chrome-01-pairing-1280x800.png` | 1280×800 PNG | Popup 或 Options 中的本地配对入口；Key 必须遮挡。 |
| `chrome-02-github-context-1280x800.png` | 1280×800 PNG | GitHub repo 页的推荐、笔记或健康信息。 |
| `chrome-03-google-results-1280x800.png` | 1280×800 PNG | Google 搜索页的 `Open in Starcat` 与 Health 徽标。 |
| `chrome-04-actions-1280x800.png` | 1280×800 PNG | GitHub Code 菜单或打开 Starcat 动作。 |
| `chrome-05-notes-1280x800.png` | 1280×800 PNG | 已 Star 仓库的笔记编辑/保存状态。 |
| `chrome-promo-440x280.png` | 440×280 PNG/JPEG | Chrome Web Store 小型推广图。 |
| `chrome-marquee-1400x560.png` | 1400×560 PNG/JPEG | 可选 Marquee 图。 |

`src/assets/icons/icon-128.png` 可作为 extension 图标来源；不要把它直接放大成推广图。

## 保存位置与检查

将生成文件放进 `docs/assets/`，发布时单独上传到 Dashboard，**不要**打入 extension ZIP。

- [ ] 每张图为真实界面，清晰、无拉伸、无敏感信息。
- [ ] 至少保留一张 GitHub 与一张 Google 搜索页截图，证明权限用途。
- [ ] 文案、图标和商店名称与最终 manifest / listing 一致。
- [ ] 记录素材来源版本号，避免新版本继续使用过期截图。
