# Chrome 提交前实现缺口

本文档区分“必须改代码/配置”和“必须完成决策或人工材料”。未完成这些项时，`STORE_RELEASE_GUIDE.md` 的状态仍是 No-Go。

## 已完成的代码与产品决策

### 1. Manifest 描述已覆盖 Google 搜索页

`manifest.json` 的 `description` 已统一为：

```text
Show local Starcat context on GitHub repository pages and Google Search results.
```

Chrome 商店 Summary、Detailed description、截图要求、`README*` 与 `PRIVACY.md` 均按同一功能范围准备。

### 2. Google 搜索权限策略：保留

当前 manifest 以 374 个 Google 域名作为必需 host permissions，content script 会自动在 `/search` 页运行。这是实际功能，不可在商店申报为 GitHub-only。

发布版保留 Google 功能，维持当前行为；发布资料完整披露其最小用途，并要求用真实 Google 截图和审核步骤证明用户价值。

## 仍需完成的安全与人工材料

### 3. Local API Key 存储策略确认

当前实现将 Local API Key 写入 `chrome.storage.local`，并在请求同机 `127.0.0.1` Companion API 时作为 Bearer token 使用。

提交前必须由安全负责人确认该持久化方式能满足 Chrome 当期认证信息与用户数据处理要求。若结论不满足，应改为短期配对凭据、可撤销授权或其他更安全的本机授权方案；这会同时影响 Starcat App 的 API、配对 UI、扩展 storage 和审核资料。

## 不需要改代码但不能缺失

- 真实商店截图与推广素材。
- 可供审核员下载安装的 Starcat macOS build 和配对说明。
- 公开、稳定的隐私政策 HTTPS URL。
- Private / trusted-testers 发布演练和干净 Chrome Profile 端到端验收。
