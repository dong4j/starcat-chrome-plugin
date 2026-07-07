/*
 * Options page controller.
 *
 * The test button only calls /plugin/v1/ping. It does not fetch GitHub data or
 * trigger Starcat business actions, so users can safely validate pairing.
 */

(async function () {
  const PREF_KEYS = {
    theme: "starcatOptionsTheme",
    locale: "starcatOptionsLocale"
  };

  const I18N = {
    en: {
      "theme.system": "System",
      "theme.light": "Light",
      "theme.dark": "Dark",
      "hero.eyebrow": "GitHub companion",
      "hero.title": "Starcat Browser Plugin",
      "hero.lead": "Bring Starcat context into GitHub repository pages while keeping data routed through the local Starcat app.",
      "pairing.eyebrow": "Pairing",
      "pairing.title": "Local service",
      "pairing.description": "Use the service URL from Browser Plugin and the Local API Key from Starcat Settings > Integrations > Local API Key.",
      "field.serviceURL": "Service URL",
      "field.token": "Local API Key",
      "action.save": "Save",
      "action.test": "Test Connection",
      "links.eyebrow": "Resources",
      "links.title": "Links",
      "links.website.title": "Starcat website",
      "links.website.body": "Product updates and downloads",
      "links.privacy.title": "Privacy policy",
      "links.privacy.body": "How Starcat handles local and network data",
      "links.open": "Open",
      "notice.title": "Local-first boundary",
      "notice.body": "The extension stores only the service URL and Local API Key. Repository context and notes stay owned by Starcat.",
      "surfaces.eyebrow": "GitHub surfaces",
      "surfaces.title": "What appears where",
      "surfaces.about.label": "About sidebar",
      "surfaces.about.value": "Similar repos, private notes",
      "surfaces.signals.label": "Watch/Fork/Starred row",
      "surfaces.signals.value": "Health, OpenSSF",
      "surfaces.toolbar.label": "Add file/Code toolbar",
      "surfaces.toolbar.value": "Wiki, CodeFlow, Codebase",
      "pro.eyebrow": "Starcat Pro",
      "pro.title": "Premium capabilities",
      "pro.free.label": "Free",
      "pro.free.body": "Local pairing, GitHub page entry points, and private notes for starred repositories.",
      "pro.pro.label": "Pro",
      "pro.pro.body": "Similar repositories, Wiki links, Health, OpenSSF, CodeFlow, and Codebase actions.",
      "pro.note": "Non-Pro users still see the entry points, but Pro-only controls are disabled and no Pro data is returned.",
      "setup.eyebrow": "Setup",
      "setup.title": "How to use",
      "setup.step1": "Open Starcat and enable Browser Plugin Service.",
      "setup.step2": "Copy the service URL and Local API Key into this page.",
      "setup.step3": "Click Test Connection and confirm the Starcat app responds.",
      "setup.step4": "Open a GitHub repository page and refresh it once.",
      "troubleshooting.eyebrow": "Troubleshooting",
      "troubleshooting.title": "Quick checks",
      "troubleshooting.check1": "Starcat must be running, and the Browser Plugin Service must be enabled.",
      "troubleshooting.check2": "The extension must be reloaded after local plugin files change.",
      "troubleshooting.check3": "GitHub pages may need a hard refresh after changing the service URL or Local API Key.",
      "troubleshooting.check4": "Requests go to <code>127.0.0.1</code>; firewall or proxy tools can block them.",
      "status.saved": "Saved.",
      "status.testing": "Testing connection...",
      "status.connected": "Connected to {app}.",
      "status.failed": "Connection failed: {message}"
    },
    zh: {
      "theme.system": "跟随系统",
      "theme.light": "明亮",
      "theme.dark": "深色",
      "hero.eyebrow": "GitHub 伴侣",
      "hero.title": "Starcat 浏览器插件",
      "hero.lead": "将 Starcat 上下文引入 GitHub 仓库页面，同时保持数据通过本地 Starcat 应用程序路由。",
      "pairing.eyebrow": "配对",
      "pairing.title": "本地服务",
      "pairing.description": "使用 Starcat 设置 > 浏览器插件中的服务地址，以及设置 > 集成 > 本地 API Key 中的 key。",
      "field.serviceURL": "服务地址",
      "field.token": "本地 API Key",
      "action.save": "保存",
      "action.test": "测试连接",
      "links.eyebrow": "资源",
      "links.title": "链接",
      "links.website.title": "Starcat 网站",
      "links.website.body": "产品更新和下载",
      "links.privacy.title": "隐私政策",
      "links.privacy.body": "Starcat 如何处理本地和网络数据",
      "links.open": "打开",
      "notice.title": "局部优先边界",
      "notice.body": "该扩展程序仅存储服务地址和本地 API Key。仓库上下文和备注仍归 Starcat 所有。",
      "surfaces.eyebrow": "GitHub 区域",
      "surfaces.title": "功能出现在哪里",
      "surfaces.about.label": "About 侧栏",
      "surfaces.about.value": "相似仓库、私有笔记",
      "surfaces.signals.label": "Watch/Fork/Starred 行",
      "surfaces.signals.value": "Health、OpenSSF",
      "surfaces.toolbar.label": "Add file/Code 工具栏",
      "surfaces.toolbar.value": "Wiki、CodeFlow、Codebase",
      "pro.eyebrow": "Starcat Pro",
      "pro.title": "高级能力",
      "pro.free.label": "免费",
      "pro.free.body": "本地配对、GitHub 页面入口，以及已收藏仓库的私有笔记。",
      "pro.pro.label": "Pro",
      "pro.pro.body": "相似仓库、Wiki 链接、Health、OpenSSF、CodeFlow 和 Codebase 操作。",
      "pro.note": "非 Pro 用户仍会看到入口，但 Pro 专属控件会置灰，并且不会返回 Pro 数据。",
      "setup.eyebrow": "设置",
      "setup.title": "如何使用",
      "setup.step1": "打开 Starcat，并启用浏览器插件服务。",
      "setup.step2": "将服务地址和本地 API Key复制到此页面。",
      "setup.step3": "点击测试连接，确认 Starcat 应用程序已响应。",
      "setup.step4": "打开 GitHub 仓库页面并刷新一次。",
      "troubleshooting.eyebrow": "故障排查",
      "troubleshooting.title": "快速检查",
      "troubleshooting.check1": "Starcat 必须正在运行，且浏览器插件服务必须已启用。",
      "troubleshooting.check2": "本地插件文件变化后，需要重新加载扩展程序。",
      "troubleshooting.check3": "更改服务地址或本地 API Key 后，GitHub 页面可能需要强制刷新。",
      "troubleshooting.check4": "请求会发送到 <code>127.0.0.1</code>；防火墙或代理工具可能会阻止它。",
      "status.saved": "已保存。",
      "status.testing": "正在测试连接...",
      "status.connected": "已连接到 {app}。",
      "status.failed": "连接失败：{message}"
    }
  };

  const form = document.querySelector("#options-form");
  const serviceURLInput = document.querySelector("#service-url");
  const tokenInput = document.querySelector("#token");
  const testButton = document.querySelector("#test");
  const status = document.querySelector("#status");
  const themeButtons = [...document.querySelectorAll("[data-theme-option]")];
  const localeButtons = [...document.querySelectorAll("[data-locale-option]")];

  const storedPrefs = await chrome.storage.local.get([PREF_KEYS.theme, PREF_KEYS.locale]);
  let currentTheme = normalizeTheme(storedPrefs[PREF_KEYS.theme]);
  let currentLocale = normalizeLocale(storedPrefs[PREF_KEYS.locale]);

  const config = await StarcatCompanion.loadConfig();
  serviceURLInput.value = config.serviceURL;
  tokenInput.value = config.token;

  applyTheme(currentTheme);
  applyLocale(currentLocale);

  function t(key, values = {}) {
    let text = I18N[currentLocale]?.[key] || I18N.en[key] || key;
    for (const [name, value] of Object.entries(values)) {
      text = text.replace(`{${name}}`, value);
    }
    return text;
  }

  function normalizeTheme(value) {
    return ["system", "light", "dark"].includes(value) ? value : "system";
  }

  function normalizeLocale(value) {
    return value === "zh" ? "zh" : "en";
  }

  function applyTheme(theme) {
    currentTheme = normalizeTheme(theme);
    if (currentTheme === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.dataset.theme = currentTheme;
    }
    themeButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.themeOption === currentTheme));
    });
  }

  function applyLocale(locale) {
    currentLocale = normalizeLocale(locale);
    document.documentElement.lang = currentLocale === "zh" ? "zh-Hans" : "en";
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      node.textContent = t(node.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-html]").forEach((node) => {
      node.innerHTML = t(node.dataset.i18nHtml);
    });
    localeButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.localeOption === currentLocale));
    });
  }

  function setStatus(message, tone = "") {
    status.textContent = message;
    if (tone) {
      status.dataset.tone = tone;
    } else {
      delete status.dataset.tone;
    }
  }

  function formConfig() {
    return {
      serviceURL: serviceURLInput.value,
      token: tokenInput.value
    };
  }

  themeButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      applyTheme(button.dataset.themeOption);
      await chrome.storage.local.set({ [PREF_KEYS.theme]: currentTheme });
    });
  });

  localeButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      applyLocale(button.dataset.localeOption);
      await chrome.storage.local.set({ [PREF_KEYS.locale]: currentLocale });
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await StarcatCompanion.saveConfig(formConfig());
    serviceURLInput.value = (await StarcatCompanion.loadConfig()).serviceURL;
    setStatus(t("status.saved"), "success");
  });

  testButton.addEventListener("click", async () => {
    testButton.disabled = true;
    setStatus(t("status.testing"));
    try {
      const current = formConfig();
      await StarcatCompanion.saveConfig(current);
      const saved = await StarcatCompanion.loadConfig();
      serviceURLInput.value = saved.serviceURL;
      const client = StarcatCompanion.createClient(saved);
      const pong = await client.ping();
      setStatus(t("status.connected", { app: pong.app || "Starcat" }), "success");
    } catch (error) {
      setStatus(t("status.failed", { message: error.message }), "error");
    } finally {
      testButton.disabled = false;
    }
  });
})();
