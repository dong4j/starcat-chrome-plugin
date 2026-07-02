/*
 * GitHub repository page integration.
 *
 * GitHub uses client-side navigation, so this script treats URL/DOM changes as
 * hints and always debounces before reading the page. Starcat surfaces are split
 * across native GitHub regions instead of a single README panel:
 * - sidebar BorderGrid: recommendations and private notes;
 * - pagehead actions: Health and OpenSSF signals;
 * - repository Code menu: Starcat wiki/action tab.
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
  let latestRenderState = null;
  let eventSubscription = null;
  const contextCache = new Map();
  const inFlight = new Map();
  const noteDrafts = new Map();

  function scheduleRefresh(reason, options = {}) {
    window.clearTimeout(scheduledTimer);
    scheduledTimer = window.setTimeout(() => {
      refreshSurfaces(reason, options).catch(() => {
        removeStarcatNodes();
      });
    }, DEBOUNCE_MS);
  }

  async function refreshSurfaces(_reason, options = {}) {
    if (isGoogleSearchPage()) {
      await refreshSearchResultSurfaces(options);
      return;
    }

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

  async function refreshSearchResultSurfaces(options = {}) {
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
    const targets = findSearchResultRepoTargets();
    await Promise.all(targets.map(async ({ repo, title }) => {
      const context = await loadContext(client, repo, options.force === true).catch(() => null);
      if (context?.repo?.is_starred !== true) return;
      renderSearchResultBadges(title, repo, context, client);
    }));
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

      latestRenderState = { context, repo, client, isPro };
      renderSidebarRows(context, repo, client, isPro);
      renderSignalButtons(context, repo, client, isPro);
      installCodeMenuHook();
      subscribeToRepoEvents(context, repo, client);
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
      insertNoteRow(sidebar, renderNoteRow(context.note, repo, client));
    }
    if (context?.repo?.is_starred === true) {
      insertNoteRow(sidebar, renderTagsRow(context, repo, client));
    }
  }

  function findSidebarBorderGrid() {
    return document.querySelector('rails-partial[data-partial-name="codeViewRepoRoute.Sidebar"] .BorderGrid')
      || document.querySelector(".Layout-sidebar .BorderGrid")
      || document.querySelector("[data-testid='repository-sidebar'] .BorderGrid")
      || document.querySelector("[data-testid='repository-sidebar']")
      || document.querySelector(".Layout-sidebar");
  }

  function insertNoteRow(sidebar, noteRow) {
    const aboutRow = findSidebarRowByTitle(sidebar, "About");
    if (aboutRow?.parentElement) {
      aboutRow.parentElement.insertBefore(noteRow, aboutRow.nextSibling);
      return;
    }
    sidebar.append(noteRow);
  }

  function findSidebarRowByTitle(sidebar, title) {
    return [...sidebar.querySelectorAll(".BorderGrid-row")]
      .find((row) => [...row.querySelectorAll("h2, h3, .h4, .h5")]
        .some((heading) => textOf(heading).startsWith(title)));
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
      list.append(recommendationCard(item));
    }
    return list;
  }

  function recommendationCard(item) {
    const fullName = item.full_name || "";
    const [owner, repoName] = fullName.split("/");
    const card = element("div", "Box d-flex p-3 width-full public source starcat-simrepo-card");
    const content = element("div", "pinned-item-list-item-content");
    const header = element("div", "d-flex width-full position-relative");
    const title = element("div", "flex-1");
    const link = element("a", "Link mr-1 text-bold wb-break-word");
    link.href = fullName ? `/${fullName}` : "#";
    link.append(
      element("span", "owner text-normal", owner ? `${owner}/` : ""),
      element("span", "repo", repoName || fullName)
    );

    title.append(octicon("repo", "octicon octicon-repo color-fg-muted mr-2", "M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75H4.5A2.5 2.5 0 0 1 2 11.5Zm2.5-1A1 1 0 0 0 3.5 2.5v9A1 1 0 0 0 4.5 12.5h8V1.5Zm.75 4.25a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5Z"), link);
    header.append(title);
    content.append(header);

    if (item.description) {
      content.append(element("p", "pinned-item-desc color-fg-muted text-small mt-2 mb-0", item.description));
    }

    const meta = element("p", "mb-0 mt-2 f6 color-fg-muted starcat-simrepo-meta");
    if (item.language) {
      const language = element("span", "d-inline-block mr-3");
      const dot = element("span", "repo-language-color");
      dot.style.backgroundColor = languageColor(item.language);
      language.append(dot, document.createTextNode(` ${item.language}`));
      meta.append(language);
    }
    if (Number.isFinite(item.stars)) {
      const stars = element("span", "d-inline-block mr-3");
      stars.append(octicon("star", "octicon octicon-star mr-1", "M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.212.612a.75.75 0 0 1 .416 1.279l-3.047 2.97.719 4.196a.75.75 0 0 1-1.088.791L8 12.347l-3.767 1.98a.75.75 0 0 1-1.088-.79l.72-4.197-3.048-2.97a.75.75 0 0 1 .416-1.28l4.212-.611L7.327.668A.75.75 0 0 1 8 .25Z"), document.createTextNode(item.stars.toLocaleString()));
      meta.append(stars);
    }
    if (typeof item.score === "number") {
      const score = element("span", "d-inline-block");
      score.append(octicon("flame", "octicon octicon-flame mr-1", "M7.998 14.5c-1.427 0-2.573-.443-3.34-1.21-.757-.755-1.158-1.84-1.158-3.04 0-1.154.51-2.285 1.14-3.233.639-.961 1.43-1.79 1.99-2.323.39-.37.64-.72.77-1.006.129-.285.128-.49.08-.638a.75.75 0 0 1 1.06-.88c.716.394 1.49 1.12 2.068 2.02.43.67.742 1.454.838 2.297.18-.15.35-.32.508-.51a.75.75 0 0 1 1.316.355c.353 1.746.214 3.63-.623 5.136C11.785 13.02 10.254 14.5 7.998 14.5Z"), document.createTextNode(`score ${item.score.toFixed(2)}`));
      meta.append(score);
    }
    content.append(meta);
    card.append(content);
    return card;
  }

  function renderNoteRow(note, repo, client) {
    const row = borderGridRow("starcat-note-row");
    const textarea = element("textarea", "form-control width-full starcat-note");
    const key = repo.fullName.toLowerCase();
    textarea.value = noteDrafts.has(key) ? noteDrafts.get(key) : note.content || "";
    textarea.rows = 4;
    textarea.maxLength = 20000;
    textarea.placeholder = "Private note";
    textarea.addEventListener("input", () => {
      noteDrafts.set(key, textarea.value);
    });

    const header = element("div", "starcat-note-header");
    const status = element("span", "starcat-muted starcat-note-status");
    const button = element("button", "btn btn-sm btn-primary", "Save");
    button.type = "button";
    button.addEventListener("click", async () => {
      button.disabled = true;
      status.textContent = "Saving...";
      try {
        await client.saveNote(repo, textarea.value);
        status.textContent = "Saved";
        noteDrafts.delete(key);
        const cached = contextCache.get(key);
        if (cached?.value?.note) cached.value.note.content = textarea.value;
        window.setTimeout(() => {
          if (status.textContent === "Saved") status.textContent = "";
        }, 2000);
      } catch {
        status.textContent = "Save failed";
      } finally {
        button.disabled = false;
      }
    });

    header.append(sectionTitle("Starcat notes"), button);
    row.querySelector(".BorderGrid-cell").append(header, textarea, status);
    return row;
  }

  function renderTagsRow(context, repo, client) {
    const row = borderGridRow("starcat-tags-row");
    const key = repo.fullName.toLowerCase();
    const assigned = Array.isArray(context?.tags) ? context.tags : [];
    const allTags = Array.isArray(context?.available_tags) ? context.available_tags : [];

    const header = element("div", "starcat-tags-header");
    const status = element("span", "starcat-muted starcat-tags-status");
    const editButton = element("button", "btn btn-sm", "Edit");
    editButton.type = "button";
    header.append(sectionTitle("Starcat tags"), editButton);

    const chips = element("div", "starcat-tag-chips");
    renderTagChips(chips, assigned, async (tag) => {
      const next = assigned.filter((item) => item.id !== tag.id).map((item) => item.id);
      await saveTags(client, repo, key, next, chips, status);
    });

    const editor = renderTagEditor(allTags, new Set(assigned.map((tag) => tag.id)), async () => {
      const selected = [...editor.querySelectorAll("input[type='checkbox']:checked")].map((node) => node.value);
      await saveTags(client, repo, key, selected, chips, status);
      editor.hidden = true;
    }, () => {
      editor.hidden = true;
    });
    editor.hidden = true;

    editButton.addEventListener("click", () => {
      editor.hidden = !editor.hidden;
    });

    row.querySelector(".BorderGrid-cell").append(header, chips, editor, status);
    return row;
  }

  function renderTagChips(container, tags, onRemove) {
    container.replaceChildren();
    if (!tags.length) {
      container.append(element("span", "starcat-muted", "No tags"));
      return;
    }
    for (const tag of tags) {
      const chip = element("span", "starcat-tag-chip");
      chip.style.setProperty("--starcat-tag-color", normalizeTagColor(tag.color));
      chip.append(
        element("span", "starcat-tag-icon", iconFallback(tag.icon)),
        element("span", "starcat-tag-name", tag.name || "Untitled")
      );
      const remove = element("button", "starcat-tag-remove", "×");
      remove.type = "button";
      remove.title = "Remove tag";
      remove.addEventListener("click", () => onRemove(tag));
      chip.append(remove);
      container.append(chip);
    }
  }

  function normalizeTagColor(value) {
    const color = String(value || "").trim();
    return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#0A84FF";
  }

  function iconFallback(icon) {
    const map = {
      tag: "•",
      folder: "▣",
      bookmark: "★",
      star: "★",
      hammer: "⚒",
      book: "▤",
      flame: "▲",
      bolt: "◆",
      heart: "♥",
      archive: "▥"
    };
    return map[String(icon || "").toLowerCase()] || "•";
  }

  function renderTagEditor(allTags, selectedIDs, onSave, onCancel) {
    const editor = element("div", "starcat-tag-editor");
    if (!allTags.length) {
      editor.append(element("div", "starcat-code-empty", "No tags in Starcat."));
      return editor;
    }

    const list = element("div", "starcat-tag-options");
    for (const tag of allTags) {
      const label = element("label", "starcat-tag-option");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = tag.id;
      input.checked = selectedIDs.has(tag.id);
      const sample = element("span", "starcat-tag-chip starcat-tag-chip--static");
      sample.style.setProperty("--starcat-tag-color", normalizeTagColor(tag.color));
      sample.append(element("span", "starcat-tag-icon", iconFallback(tag.icon)), element("span", "starcat-tag-name", tag.name));
      label.append(input, sample);
      list.append(label);
    }

    const actions = element("div", "starcat-tag-editor-actions");
    const cancel = element("button", "btn btn-sm", "Cancel");
    cancel.type = "button";
    cancel.addEventListener("click", onCancel);
    const save = element("button", "btn btn-sm btn-primary", "Save");
    save.type = "button";
    save.addEventListener("click", onSave);
    actions.append(cancel, save);
    editor.append(list, actions);
    return editor;
  }

  async function saveTags(client, repo, key, tagIDs, chips, status) {
    status.textContent = "Saving...";
    try {
      const response = await client.saveTags(repo, tagIDs);
      const tags = response.tags || [];
      const cached = contextCache.get(key);
      if (cached?.value) cached.value.tags = tags;
      renderTagChips(chips, tags, async (tag) => {
        const next = tags.filter((item) => item.id !== tag.id).map((item) => item.id);
        await saveTags(client, repo, key, next, chips, status);
      });
      status.textContent = "Saved";
      window.setTimeout(() => {
        if (status.textContent === "Saved") status.textContent = "";
      }, 2000);
    } catch {
      status.textContent = "Save failed";
    }
  }

  async function subscribeToRepoEvents(context, repo, client) {
    closeEventSubscription();
    const repoID = context?.repo?.repo_id;
    if (!repoID) return;

    try {
      eventSubscription = await client.events(
        { repoID },
        {
          onEvent: (event) => handleCompanionEvent(event, repo, repoID),
          onError: () => {
            closeEventSubscription();
          }
        }
      );
    } catch {
      closeEventSubscription();
    }
  }

  function closeEventSubscription() {
    eventSubscription?.close?.();
    eventSubscription = null;
  }

  function handleCompanionEvent(event, repo, repoID) {
    const payload = event.data || {};
    if (payload.repo_id && String(payload.repo_id) !== String(repoID)) return;
    if (event.type === "tags.updated") {
      handleTagsEvent(payload, repo);
      return;
    }
    if (event.type !== "note.updated") return;
    const note = payload.note;
    if (!note) return;

    const key = repo.fullName.toLowerCase();
    const cached = contextCache.get(key);
    if (cached?.value) {
      cached.value.note = note;
    }

    const textarea = document.querySelector("#starcat-note-row textarea.starcat-note");
    const status = document.querySelector("#starcat-note-row .starcat-note-status");
    if (!textarea) return;

    if (document.activeElement === textarea || noteDrafts.has(key)) {
      if (status) status.textContent = "Updated in Starcat";
      return;
    }

    textarea.value = note.content || "";
    if (status) {
      status.textContent = "Updated";
      window.setTimeout(() => {
        if (status.textContent === "Updated") status.textContent = "";
      }, 2000);
    }
  }

  function handleTagsEvent(payload, repo) {
    const tags = payload.tags || [];
    const key = repo.fullName.toLowerCase();
    const cached = contextCache.get(key);
    if (cached?.value) cached.value.tags = tags;

    const chips = document.querySelector("#starcat-tags-row .starcat-tag-chips");
    const status = document.querySelector("#starcat-tags-row .starcat-tags-status");
    if (!chips) return;
    renderTagChips(chips, tags, async (tag) => {
      const next = tags.filter((item) => item.id !== tag.id).map((item) => item.id);
      await saveTags(latestRenderState.client, repo, key, next, chips, status || element("span"));
    });
    if (status) {
      status.textContent = "Updated";
      window.setTimeout(() => {
        if (status.textContent === "Updated") status.textContent = "";
      }, 2000);
    }
  }

  function renderSignalButtons(context, repo, client, isPro) {
    const pageheadActions = findPageheadActions();
    if (!pageheadActions) return;
    if (context?.repo?.is_starred !== true) return;

    if (context?.actions?.open_in_starcat === true) {
      pageheadActions.append(openInStarcatItem(repo, client));
    }
    pageheadActions.append(signalListItem("Health", context?.health, isPro, "health"));
  }

  function isGoogleSearchPage() {
    return /^www\.google\./.test(location.hostname) && location.pathname === "/search";
  }

  function findSearchResultRepoTargets() {
    const seen = new Set();
    const targets = [];
    for (const anchor of document.querySelectorAll('a[href*="github.com/"]')) {
      const repo = parseGitHubRepoFromSearchLink(anchor.href);
      if (!repo) continue;

      const title = anchor.querySelector("h3") || anchor.closest("h3") || anchor;
      const result = anchor.closest("[data-sokoban-container], .MjjYud, .g") || title.parentElement;
      if (!result || seen.has(repo.fullName.toLowerCase())) continue;

      seen.add(repo.fullName.toLowerCase());
      targets.push({ repo, title: title.closest("a") || title });
    }
    return targets.slice(0, 8);
  }

  function parseGitHubRepoFromSearchLink(href) {
    const direct = StarcatCompanion.parseGitHubRepo(href);
    if (direct) return direct;

    try {
      const url = new URL(href);
      const redirected = url.searchParams.get("q") || url.searchParams.get("url");
      return redirected ? StarcatCompanion.parseGitHubRepo(redirected) : null;
    } catch {
      return null;
    }
  }

  function renderSearchResultBadges(title, repo, context, client) {
    if (!title || title.querySelector?.("[data-starcat-companion='search-result']")) return;

    const group = element("span", "starcat-search-badges");
    group.dataset.starcatCompanion = "search-result";
    group.append(
      searchBadge("Open in Starcat", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await client.openAction(repo, "open-repo");
      }),
      element("span", `starcat-search-health ${scoreToneClass(context?.health?.score, "health")}`, `Health ${formatScore(context?.health?.score)}`)
    );
    title.append(group);
  }

  function searchBadge(label, onClick) {
    const button = element("button", "starcat-search-badge", label);
    button.type = "button";
    button.addEventListener("click", onClick);
    return button;
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

  function signalListItem(label, signal, enabled, kind) {
    const li = element("li", "starcat-pagehead-li");
    li.dataset.starcatCompanion = "signal";
    const scoreText = enabled && signal ? formatSignalScore(signal) : "Pro";
    const button = element("button", `btn btn-sm starcat-pagehead-btn ${enabled && signal ? scoreToneClass(signal.score, kind) : "starcat-score--locked"}`);
    button.type = "button";
    button.disabled = !enabled || !signal;
    button.append(
      element("span", "starcat-pagehead-label", label),
      element("span", "Counter starcat-score-counter", scoreText)
    );
    li.append(button);
    return li;
  }

  function openInStarcatItem(repo, client) {
    const li = element("li", "starcat-pagehead-li");
    li.dataset.starcatCompanion = "signal";
    const button = element("button", "btn btn-sm starcat-pagehead-btn starcat-open-btn");
    button.type = "button";
    button.append(
      element("span", "starcat-pagehead-label", "Open in Starcat")
    );
    button.addEventListener("click", async () => {
      if (!repo || !client) return;
      button.disabled = true;
      try {
        await client.openAction(repo, "open-repo");
      } finally {
        button.disabled = false;
      }
    });
    li.append(button);
    return li;
  }

  function installCodeMenuHook() {
    const codeButton = [...document.querySelectorAll("button")]
      .find((node) => textOf(node) === "Code" && node.getAttribute("data-variant") === "primary");
    if (!codeButton || codeButton.dataset.starcatCompanionCodeHook === "true") return;

    codeButton.dataset.starcatCompanionCodeHook = "true";
    codeButton.addEventListener("click", () => {
      window.setTimeout(augmentCodeMenu, 80);
      window.setTimeout(augmentCodeMenu, 250);
    });
  }

  function augmentCodeMenu() {
    if (!latestRenderState) return;
    const menu = findOpenCodeMenu();
    if (!menu || menu.querySelector("[data-starcat-code-panel='true']")) return;

    const tabBar = findCodeMenuTabBar(menu);
    const starcatTab = element("button", "starcat-code-tab", "Starcat");
    starcatTab.type = "button";
    starcatTab.dataset.starcatCompanion = "code-menu";

    const panel = renderCodeMenuStarcatPanel(latestRenderState);
    panel.hidden = true;

    if (tabBar) {
      const tabShell = [...menu.children].find((node) => node.contains(tabBar)) || tabBar;
      const originalNodes = [...menu.children].filter((node) => node !== tabShell && node !== panel);
      starcatTab.addEventListener("click", (event) => {
        event.stopPropagation();
        starcatTab.classList.add("starcat-code-tab--active");
        originalNodes.forEach((node) => {
          if (node !== panel) node.classList.add("starcat-code-original-hidden");
        });
        panel.hidden = false;
      });

      tabBar.addEventListener("click", (event) => {
        if (event.target === starcatTab) return;
        starcatTab.classList.remove("starcat-code-tab--active");
        originalNodes.forEach((node) => node.classList.remove("starcat-code-original-hidden"));
        panel.hidden = true;
      });

      tabBar.append(starcatTab);
      menu.append(panel);
    } else {
      panel.hidden = false;
      menu.append(panel);
    }
  }

  function findOpenCodeMenu() {
    const localTab = [...document.querySelectorAll("[role='tab'], button")]
      .find((node) => textOf(node) === "Local");
    let node = localTab;
    while (node && node !== document.body) {
      if (/Clone|Codespaces|Download ZIP/.test(textOf(node))
        && (node.getAttribute("role") === "dialog" || /Overlay|AnchoredOverlay/.test(String(node.className)))) {
        return node;
      }
      node = node.parentElement;
    }

    const candidates = [...document.querySelectorAll("[role='dialog'], [class*='Overlay'], .Popover, .SelectMenu, .Box")]
      .filter((node) => node.offsetParent !== null && /Clone|Codespaces|Download ZIP/.test(textOf(node)));
    return candidates.sort((a, b) => textOf(a).length - textOf(b).length)[0] || null;
  }

  function findCodeMenuTabBar(menu) {
    return [...menu.querySelectorAll("[role='tablist'], nav, div")]
      .find((node) => {
        const childLabels = [...node.children].map(textOf).filter(Boolean);
        return node.children.length <= 6
          && childLabels.some((label) => label === "Local")
          && childLabels.some((label) => label === "Codespaces");
      });
  }

  function renderCodeMenuStarcatPanel({ context, repo, client, isPro }) {
    const panel = element("div", "starcat-code-panel");
    panel.dataset.starcatCodePanel = "true";
    panel.dataset.starcatCompanion = "code-menu";

    const wikiLinks = context?.wiki_links || [];
    const actions = context?.actions || {};
    panel.append(
      element("h3", "starcat-code-panel__title", "Starcat"),
      codeMenuGroup("Wiki", isPro && wikiLinks.length
        ? wikiLinks.map((link) => codeMenuLink(link.title || link.source || "Wiki", link.url, wikiIconFor(link)))
        : [codeMenuEmpty(isPro ? "No wiki links from Starcat." : "Starcat Pro required.")]),
      codeMenuGroup("Actions", [
        codeMenuAction("CodeFlow", isPro && actions.codeflow === true, codeMenuIcon("codeflow"), () => client.openAction(repo, "codeflow")),
        codeMenuAction("Codebase", isPro && actions.codebase === true, codeMenuIcon("codebase"), () => client.openAction(repo, "codebase"))
      ])
    );
    return panel;
  }

  function codeMenuGroup(title, children) {
    const group = element("div", "starcat-code-group");
    group.append(element("div", "starcat-code-group__title", title), ...children);
    return group;
  }

  function codeMenuLink(label, href, iconURL) {
    const anchor = element("a", "starcat-code-item");
    anchor.href = href;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.append(codeMenuIconNode(iconURL, label), element("span", "starcat-code-item__label", label));
    return anchor;
  }

  function codeMenuAction(label, enabled, iconURL, onClick) {
    const button = element("button", "starcat-code-item");
    button.type = "button";
    button.disabled = !enabled;
    button.append(codeMenuIconNode(iconURL, label), element("span", "starcat-code-item__label", label));
    button.addEventListener("click", async () => {
      if (button.disabled) return;
      button.disabled = true;
      try {
        await onClick();
      } finally {
        button.disabled = false;
      }
    });
    return button;
  }

  function codeMenuEmpty(text) {
    return element("div", "starcat-code-empty", text);
  }

  function wikiIconFor(link) {
    const source = `${link.source || ""} ${link.title || ""}`.toLowerCase();
    if (source.includes("deepwiki")) return codeMenuIcon("deepwiki");
    if (source.includes("zread")) return codeMenuIcon("zread");
    return codeMenuIcon("wiki");
  }

  function codeMenuIcon(kind) {
    const dark = prefersDarkMode();
    const localIcons = {
      deepwiki: dark ? "deepwiki-dark.png" : "deepwiki.png",
      zread: dark ? "zread-dark.png" : "zread.png"
    };
    if (localIcons[kind]) {
      return chrome.runtime.getURL(`src/assets/starcat-menu/${localIcons[kind]}`);
    }
    const remoteIcons = {
      codeflow: "https://github.com/braedonsaunders.png?size=64",
      codebase: "https://github.com/DeusData.png?size=64",
      wiki: "https://github.githubassets.com/favicons/favicon.svg"
    };
    return remoteIcons[kind] || remoteIcons.wiki;
  }

  function codeMenuIconNode(src, label) {
    const image = element("img", "starcat-code-item__icon");
    image.src = src;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => {
      image.hidden = true;
    }, { once: true });
    image.setAttribute("aria-hidden", "true");
    image.title = label;
    return image;
  }

  function prefersDarkMode() {
    const colorMode = document.documentElement.getAttribute("data-color-mode");
    if (colorMode === "dark") return true;
    if (colorMode === "light") return false;
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches === true;
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

  function formatSignalScore(signal) {
    const score = formatScore(signal.score);
    return signal.grade ? `${score} ${signal.grade}` : score;
  }

  function formatScore(value) {
    return typeof value === "number" ? value.toFixed(1) : "N/A";
  }

  function scoreToneClass(value, kind) {
    if (typeof value !== "number") return "starcat-score--unknown";
    const normalized = kind === "openssf" ? value * 10 : value;
    if (normalized >= 80) return "starcat-score--good";
    if (normalized >= 60) return "starcat-score--warn";
    return "starcat-score--danger";
  }

  function languageColor(language) {
    const colors = {
      TypeScript: "#3178c6",
      JavaScript: "#f1e05a",
      "C++": "#f34b7d",
      Swift: "#f05138",
      Python: "#3572a5",
      Rust: "#dea584",
      Go: "#00add8",
      Java: "#b07219",
      CSS: "#563d7c",
      HTML: "#e34c26",
      Ruby: "#701516",
      PHP: "#4f5d95",
      Kotlin: "#a97bff",
      Shell: "#89e051"
    };
    return colors[language] || "var(--fgColor-muted, #656d76)";
  }

  function octicon(name, className, pathData) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("class", className);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    svg.append(path);
    svg.dataset.octicon = name;
    return svg;
  }

  function removeStarcatNodes() {
    closeEventSubscription();
    document.querySelectorAll(ROOT_SELECTOR).forEach((node) => node.remove());
  }

  function isStarcatInputActive() {
    return document.activeElement?.closest?.(ROOT_SELECTOR) !== null;
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
      noteDrafts.clear();
      scheduleRefresh("url", { force: true });
      return;
    }
    if (isStarcatInputActive()) return;
    installCodeMenuHook();
    augmentCodeMenu();
    if ((StarcatCompanion.parseGitHubRepo(location.href) || isGoogleSearchPage()) && !document.querySelector(ROOT_SELECTOR)) {
      scheduleRefresh("mount-missing");
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("popstate", () => scheduleRefresh("popstate", { force: true }));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.starcatCompanionServiceURL || changes.starcatCompanionPort || changes.starcatCompanionToken)) {
      contextCache.clear();
      missingConfigUntil = 0;
      scheduleRefresh("config", { force: true });
    }
  });

  scheduleRefresh("initial");
})();
