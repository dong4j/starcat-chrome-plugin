# Chrome Web Store 发布资料

本目录只保存上架准备资料，不会被打入 Chrome Web Store ZIP。所有描述以当前 `manifest.json` 与 `src/` 行为为准。

| 文件 | 用途 |
|---|---|
| [STORE_RELEASE_GUIDE.md](STORE_RELEASE_GUIDE.md) | 发布流程、阻断项、打包与提交步骤。 |
| [STORE_LISTING.md](STORE_LISTING.md) | 商店字段可粘贴文案。 |
| [PRIVACY_DISCLOSURE.md](PRIVACY_DISCLOSURE.md) | Privacy practices 勾选依据与权限说明。 |
| [REVIEW_KIT.md](REVIEW_KIT.md) | 审核员复现说明和提交前验收。 |
| [ASSET_REQUIREMENTS.md](ASSET_REQUIREMENTS.md) | 截图、推广图和图标的实物清单。 |
| [IMPLEMENTATION_GAPS.md](IMPLEMENTATION_GAPS.md) | 提交前必须决定或修改的实现项。 |
| `assets/` | 人工生成的商店素材存放位置；不得放入密钥或真实私人笔记。 |

## 使用顺序

1. 先解决 `IMPLEMENTATION_GAPS.md` 的阻断项，再完成 `PRIVACY_DISCLOSURE.md` 的代码/政策核验。
2. 在干净 Chrome Profile 完成 `REVIEW_KIT.md` 的验收。
3. 生成并检查 `ASSET_REQUIREMENTS.md` 要求的真实素材。
4. 复制 `STORE_LISTING.md` 字段到 Developer Dashboard。
5. 按 `STORE_RELEASE_GUIDE.md` 打包和提交。

> Google 搜索页功能与权限已确认保留；当前仍不能仅凭本目录发布，Local API Key 持久化策略、真实素材、审核构建和人工验收仍需在提交前完成。
