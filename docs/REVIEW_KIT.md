# Chrome 审核与验收资料

## 审核员说明稿

将下方方括号替换为可用、长期有效的信息后，填入 Chrome Web Store 的 test instructions。

```text
This extension is a companion for the Starcat macOS app. It has no cloud account or GitHub sign-in flow.

Test environment:
1. Download and open the Starcat macOS review build: [HTTPS URL].
2. In Starcat, open Settings > Integrations > Browser Plugin and enable the local service.
3. Copy the service URL and Local API Key from Starcat Settings > Integrations > Local API Key.
4. Open the extension popup, enter the service URL and Local API Key, then click Test Connection.
5. Open [GitHub repository URL] to inspect the Starcat context surfaces.
6. Open [Google Search URL containing the same GitHub repository] to inspect the “Open in Starcat” and Health badges.

The extension sends requests only to the locally running Starcat app at 127.0.0.1. It does not call GitHub APIs or a remote Starcat service.
```

## 发布前人工验收

- [ ] 新建 Chrome Profile，加载候选版本。
- [ ] 未填 Local API Key 时，页面不报错、不泄露内容。
- [ ] 错误 Local API Key 时，连接测试给出可理解失败结果。
- [ ] 正确配对后 GitHub repo 页面显示预期上下文。
- [ ] 已 Star 与未 Star 仓库分别验证；未 Star 仓库不显示私人笔记编辑。
- [ ] Google 搜索页只为已 Star 的 GitHub 结果显示功能，且不改写其他搜索结果。
- [ ] 保存笔记后，Starcat App 内能看到相同内容。
- [ ] `Open in Starcat` 可激活 App；Starcat 未运行时浏览器页面无异常。
- [ ] 关闭并重开 Chrome 后配对行为符合产品预期。

## 审核环境材料

- [ ] Starcat macOS 审核构建 HTTPS 下载地址。
- [ ] 用于 GitHub/Google 演示的公开仓库 URL。
- [ ] 审核联系人姓名、邮箱、电话。
- [ ] 说明本插件仅支持 macOS 上已安装 Starcat 的用户。
- [ ] 审核前确认不在说明、截图或 ZIP 中泄露真实 Local API Key。
