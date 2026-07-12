# Chrome 提交前实现缺口

本文档区分“必须改代码/配置”和“必须完成决策或人工材料”。未完成这些项时，`STORE_RELEASE_GUIDE.md` 的状态仍是 No-Go。

## 必须改动

### 1. Manifest 描述必须覆盖 Google 搜索页

当前 `manifest.json` 的 `description` 仍是：

```text
Show Starcat context on GitHub repository pages.
```

它遗漏了已经声明权限并实现的 Google 搜索结果增强。发布版本必须改为与实际范围一致的简短描述，例如：

```text
Show local Starcat context on GitHub repository pages and Google Search results.
```

修改后同步复查 Chrome 商店 Summary、Detailed description、截图、`README*` 与 `PRIVACY.md`。

## 必须做出产品/安全决策

### 2. Google 搜索权限策略

当前 manifest 以 374 个 Google 域名作为必需 host permissions，content script 会自动在 `/search` 页运行。这是实际功能，不可在商店申报为 GitHub-only。

发布前二选一：

1. **保留 Google 功能**：维持当前行为，使用发布资料完整披露其最小用途，并用真实 Google 截图和审核步骤证明用户价值。
2. **收敛为 GitHub-only**：删除 Google manifest patterns、Google 搜索 DOM 处理、相关 web-accessible resource matches 和所有商店资料中的 Google 表述。

若要在用户明确开启后才启用 Google，需另行设计 optional host permissions、授权 UI 和动态 content-script 注册；这不是仅改文案的工作。

### 3. Local API Key 存储策略

当前实现将 Local API Key 写入 `chrome.storage.local`，并在请求同机 `127.0.0.1` Companion API 时作为 Bearer token 使用。

提交前必须由安全负责人确认该持久化方式能满足 Chrome 当期认证信息与用户数据处理要求。若结论不满足，应改为短期配对凭据、可撤销授权或其他更安全的本机授权方案；这会同时影响 Starcat App 的 API、配对 UI、扩展 storage 和审核资料。

## 不需要改代码但不能缺失

- 真实商店截图与推广素材。
- 可供审核员下载安装的 Starcat macOS build 和配对说明。
- 公开、稳定的隐私政策 HTTPS URL。
- Private / trusted-testers 发布演练和干净 Chrome Profile 端到端验收。
