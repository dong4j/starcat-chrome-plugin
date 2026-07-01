/*
 * GitHub repository page integration.
 *
 * GitHub uses client-side navigation, so this script treats URL/DOM changes as
 * hints and always debounces before reading the page. Starcat surfaces are split
 * across native GitHub regions instead of a single README panel:
 * - sidebar BorderGrid: recommendations and private notes;
 * - pagehead actions: Health and OpenSSF signals;
 * - repository toolbar: Wiki and Starcat action dropdowns.
 */

(function () {
  const ROOT_SELECTOR = "[data-starcat-companion]";
  const DEBOUNCE_MS = 500;
  const CACHE_TTL_MS = 60 * 1000;
  const MISSING_CONFIG_COOLDOWN_MS = 60 * 1000;

  let scheduledTimer = null;
  let lastURL = location.href;
  let missingConfigUntil = 0;
  let suppressMutations = false;
  const contextCache = new Map();
  const inFlight = new Map();

  function scheduleRefresh(reason, options = {}) {
    window.clearTimeout(scheduledTimer);
    scheduledTimer = window.setTimeout(() => {
      refreshSurfaces(reason, options).catch(() => {
        removeStarcatNodes();
      });
    }, DEBOUNCE_MS);
  }

  async function refreshSurfaces(_reason, options = {}) {
    const repo = StarcatCompanion.parseGitHubRepo(location.href);
    if (!repo) {
      removeStarcatNodes();
      return;
    }

    if (Date.now() < missingConfigUntil) {
      removeStarcatNodes();
      return;
    }

    const config = await StarcatCompanion.loadConfig();
    if (!config.token) {
      missingConfigUntil = Date.now() + MISSING_CONFIG_COOLDOWN_MS;
      removeStarcatNodes();
      return;
    }

    const client = StarcatCompanion.createClient(config);
    const context = await loadContext(client, repo, options.force === true);
    renderSurfaces(context, repo, client);
  }

  async function loadContext(client, repo, force) {
    const key = repo.fullName.toLowerCase();
    const cached = contextCache.get(key);
    if (!force && cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
      return cached.value;
    }
    if (inFlight.has(key)) {
      return inFlight.get(key);
    }

    const request = client.repoContext(repo)
      .then((value) => {
        contextCache.set(key, { value, loadedAt: Date.now() });
        return value;
      })
      .finally(() => {
        inFlight.delete(key);
      });
    inFlight.set(key, request);
    return request;
  }

  function renderSurfaces(context, repo, client) {
    suppressMutations = true;
    try {
      removeStarcatNodes();
      const isPro = context?.entitlement?.is_pro === true;

      renderSidebarRows(context, repo, client, isPro);
      renderSignalButtons(context, isPro);
      renderToolbarDropdowns(context, repo, client, isPro);
    } finally {
      window.setTimeout(() => {
        suppressMutations = false;
      }, 0);
    }
  }

  function renderSidebarRows(context, repo, client, isPro) {
    const sidebar = findSidebarBorderGrid();
    if (!sidebar) return;

    sidebar.append(renderRecommendationsRow(context?.recommendations || [], isPro));
    if (context?.note?.editable) {
      sidebar.append(renderNoteRow(context.note, repo, client));
    }
  }

  function findSidebarBorderGrid() {
    return document.querySelector('rails-partial[data-partial-name="codeViewRepoRoute.Sidebar"] .BorderGrid')
      || document.querySelector(".Layout-sidebar .BorderGrid")
      || document.querySelector("[data-testid='repository-sidebar'] .BorderGrid")
      || document.querySelector("[data-testid='repository-sidebar']")
      || document.querySelector(".Layout-sidebar");
  }

  function renderRecommendationsRow(items, isPro) {
    const row = borderGridRow("starcat-recommendations-row");
    row.querySelector(".BorderGrid-cell").append(
      sectionTitle("Similar repositories"),
      isPro && items.length ? recommendationsList(items) : proLockedNotice("Upgrade to Starcat Pro to view similar repositories.")
    );
    return row;
  }

  function recommendationsList(items) {
    const list = element("div", "starcat-sidebar-list");
    for (const item of items.slice(0, 5)) {
      const anchor = element("a", "starcat-sidebar-repo");
      anchor.href = `https://github.com/${item.full_name}`;
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      anchor.append(
        element("span", "starcat-sidebar-repo__name", item.full_name),
        element("span", "starcat-sidebar-repo__meta", recommendationMeta(item))
      );
      list.append(anchor);
    }
    return list;
  }

  function recommendationMeta(item) {
    const parts = [];
    if (item.language) parts.push(item.language);
    if (Number.isFinite(item.stars)) parts.push(`${item.stars.toLocaleString()} stars`);
    if (typeof item.score === "number") parts.push(`score ${item.score.toFixed(2)}`);
    return parts.join(" · ");
  }

  function renderNoteRow(note, repo, client) {
    const row = borderGridRow("starcat-note-row");
    const textarea = element("textarea", "form-control width-full starcat-note");
    textarea.value = note.content || "";
    textarea.rows = 4;
    textarea.maxLength = 20000;
    textarea.placeholder = "Private note";

    const footer = element("div", "starcat-note-footer");
    const status = element("span", "starcat-muted");
    const button = element("button", "btn btn-sm btn-primary", "Save");
    button.type = "button";
    button.addEventListener("click", async () => {
      button.disabled = true;
      status.textContent = "Saving...";
      try {
        await client.saveNote(repo, textarea.value);
        status.textContent = "Saved";
        contextCache.delete(repo.fullName.toLowerCase());
        window.setTimeout(() => {
          if (status.textContent === "Saved") status.textContent = "";
        }, 2000);
      } catch {
        status.textContent = "Save failed";
      } finally {
        button.disabled = false;
      }
    });

    footer.append(status, button);
    row.querySelector(".BorderGrid-cell").append(sectionTitle("Starcat notes"), textarea, footer);
    return row;
  }

  function renderSignalButtons(context, isPro) {
    const pageheadActions = findPageheadActions();
    if (!pageheadActions) return;

    pageheadActions.append(
      signalListItem("Health", context?.health ? `${formatScore(context.health.score)} ${context.health.grade || ""}`.trim() : "Pro", isPro),
      signalListItem("OpenSSF", context?.openssf ? formatScore(context.openssf.score) : "Pro", isPro)
    );
  }

  function findPageheadActions() {
    const starCounter = document.querySelector("#repo-stars-counter-star");
    let node = starCounter;
    while (node && node !== document.body) {
      if (node.matches?.("ul.pagehead-actions")) return node;
      node = node.parentElement;
    }
    return document.querySelector("ul.pagehead-actions");
  }

  function signalListItem(label, value, enabled) {
    const li = element("li", "starcat-pagehead-li");
    li.dataset.starcatCompanion = "signal";
    const button = element("button", "btn btn-sm starcat-pagehead-btn");
    button.type = "button";
    button.disabled = !enabled;
    button.append(
      element("span", "starcat-pagehead-label", label),
      element("span", "Counter", value)
    );
    li.append(button);
    return li;
  }

  function renderToolbarDropdowns(context, repo, client, isPro) {
    const toolbar = findRepoToolbar();
    if (!toolbar) return;

    const wikiLinks = context?.wiki_links || [];
    const wiki = toolbarDropdown({
      id: "starcat-wiki-dropdown",
      label: "Wiki",
      enabled: isPro && wikiLinks.length > 0,
      disabledText: "Starcat Pro",
      items: wikiLinks.map((link) => ({
        label: link.title || link.source,
        href: link.url
      }))
    });

    const actions = toolbarDropdown({
      id: "starcat-actions-dropdown",
      label: "Starcat",
      enabled: isPro && (context?.actions?.codeflow || context?.actions?.codebase),
      disabledText: "Starcat Pro",
      items: [
        {
          label: "CodeFlow",
          enabled: context?.actions?.codeflow === true,
          onClick: () => client.openAction(repo, "codeflow")
        },
        {
          label: "Codebase",
          enabled: context?.actions?.codebase === true,
          onClick: () => client.openAction(repo, "codebase")
        }
      ]
    });

    toolbar.insertBefore(wiki, toolbar.firstChild);
    toolbar.insertBefore(actions, toolbar.firstChild);
  }

  function findRepoToolbar() {
    const addFile = [...document.querySelectorAll("button,summary,a")]
      .find((node) => /Add file/i.test(textOf(node)) || /Add file/i.test(node.getAttribute("aria-label") || ""));
    const codeButton = [...document.querySelectorAll("button")]
      .find((node) => textOf(node) === "Code" && node.getAttribute("data-variant") === "primary");
    let node = addFile;
    while (node && node !== document.body) {
      if (codeButton && node.contains(codeButton)) return node;
      node = node.parentElement;
    }
    return addFile?.parentElement || codeButton?.parentElement || null;
  }

  function toolbarDropdown({ id, label, enabled, disabledText, items }) {
    const details = element("details", "details-reset details-overlay position-relative starcat-toolbar-dropdown");
    details.id = id;
    details.dataset.starcatCompanion = "toolbar";

    const summary = element("summary", "btn starcat-toolbar-summary");
    summary.setAttribute("role", "button");
    summary.setAttribute("aria-disabled", enabled ? "false" : "true");
    summary.append(document.createTextNode(label), octiconTriangleDown());

    const menu = element("div", "SelectMenu right-0 starcat-toolbar-menu");
    const list = element("div", "SelectMenu-list");
    const visibleItems = items.filter((item) => item.href || item.onClick || item.enabled !== false);
    if (enabled && visibleItems.length) {
      for (const item of visibleItems) {
        list.append(toolbarMenuItem(item, details));
      }
    } else {
      list.append(element("div", "SelectMenu-item color-fg-muted", disabledText));
    }
    menu.append(list);
    details.append(summary, menu);
    return details;
  }

  function toolbarMenuItem(item, details) {
    if (item.href) {
      const anchor = element("a", "SelectMenu-item", item.label);
      anchor.href = item.href;
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      return anchor;
    }

    const button = element("button", "SelectMenu-item width-full", item.label);
    button.type = "button";
    button.disabled = item.enabled === false;
    button.addEventListener("click", async () => {
      if (button.disabled || typeof item.onClick !== "function") return;
      button.disabled = true;
      try {
        await item.onClick();
        details.open = false;
      } finally {
        button.disabled = false;
      }
    });
    return button;
  }

  function borderGridRow(id) {
    const row = element("div", "BorderGrid-row");
    row.id = id;
    row.dataset.starcatCompanion = "sidebar";
    row.append(element("div", "BorderGrid-cell"));
    return row;
  }

  function sectionTitle(title) {
    return element("h2", "h4 mb-3", title);
  }

  function proLockedNotice(message) {
    const notice = element("div", "starcat-pro-locked");
    notice.append(
      element("span", "starcat-pro-locked__title", "Starcat Pro"),
      element("span", "starcat-pro-locked__body", message)
    );
    return notice;
  }

  function formatScore(value) {
    return typeof value === "number" ? value.toFixed(1) : "N/A";
  }

  function octiconTriangleDown() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("class", "octicon octicon-triangle-down ml-1");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "m4.427 7.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z");
    svg.append(path);
    return svg;
  }

  function removeStarcatNodes() {
    document.querySelectorAll(ROOT_SELECTOR).forEach((node) => node.remove());
  }

  function textOf(node) {
    return (node?.innerText || node?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const observer = new MutationObserver(() => {
    if (suppressMutations) return;
    if (location.href !== lastURL) {
      lastURL = location.href;
      contextCache.clear();
    }
    scheduleRefresh("mutation");
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("popstate", () => scheduleRefresh("popstate", { force: true }));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.starcatCompanionPort || changes.starcatCompanionToken)) {
      contextCache.clear();
      missingConfigUntil = 0;
      scheduleRefresh("config", { force: true });
    }
  });

  scheduleRefresh("initial");
})();
