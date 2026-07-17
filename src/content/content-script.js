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
  const GITHUB_STAR_CONFIRM_TIMEOUT_MS = 10 * 1000;
  const GITHUB_STAR_POLL_MS = 120;

  let scheduledTimer = null;
  let lastURL = location.href;
  let missingConfigUntil = 0;
  let suppressMutations = false;
  let latestRenderState = null;
  let eventSubscription = null;
  const contextCache = new Map();
  const inFlight = new Map();
  const noteDrafts = new Map();
  const pendingStarStates = new Map();
  const starStateSyncs = new Map();

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
    await Promise.all(targets.map(async (target) => {
      const { repo } = target;
      const context = await loadContext(client, repo, options.force === true).catch(() => null);
      if (context?.repo?.is_starred !== true) return;
      renderSearchResultBadges(target, repo, context, client);
    }));
  }

  async function loadContext(client, repo, force) {
    const key = repo.fullName.toLowerCase();
    const cached = contextCache.get(key);
    if (!force && cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
      return cached.value;
    }
    if (!force && inFlight.has(key)) {
      return inFlight.get(key);
    }
    if (force && inFlight.has(key)) {
      // A Star/Unstar confirmation must never reuse the request that started
      // before GitHub changed state. Wait for it to settle, then issue a new one.
      await inFlight.get(key).catch(() => null);
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
      installReadmeAISection(context, repo, client);
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

    sidebar.append(renderRecommendationsRow(context, repo, client, isPro));
    insertNoteRow(sidebar, renderLibraryRow(context, repo, client));
    if (context?.note?.editable) {
      insertNoteRow(sidebar, renderNoteRow(context.note, repo, client));
    }
    if (isStarcatLocalRepo(context)) {
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

  function renderRecommendationsRow(context, repo, client, isPro) {
    const row = borderGridRow("starcat-recommendations-row");
    const items = context?.recommendations || [];
    // An empty recommendation list is a data state, not an entitlement state.
    // Keep the Pro CTA exclusive to users whose Companion response is actually locked.
    const content = !isPro
      ? proLockedNotice("Upgrade to Starcat Pro to view similar repositories.")
      : items.length
        ? recommendationsList(items, context, repo, client, row)
        : element("div", "starcat-muted", "No similar repositories available yet.");
    row.querySelector(".BorderGrid-cell").append(
      sectionTitle("Recommends"),
      content
    );
    return row;
  }

  function recommendationsList(items, context, repo, client, row) {
    const list = element("div", "starcat-sidebar-list");
    for (const item of items) {
      list.append(recommendationCard(item));
    }
    if (context?.recommendations_has_more === true) {
      list.append(recommendationsLoadMore(context, repo, client, row));
    }
    return list;
  }

  function recommendationsLoadMore(context, repo, client, row) {
    const shell = element("div", "starcat-recommendations-more");
    const button = element("button", "starcat-recommendations-more__button", "Load More");
    const status = element("span", "starcat-muted starcat-recommendations-more__status");
    button.type = "button";
    button.addEventListener("click", async () => {
      if (button.disabled) return;
      button.disabled = true;
      button.textContent = "Loading...";
      status.textContent = "";
      try {
        const response = await client.loadMoreRecommendations(repo);
        context.recommendations = mergeRecommendations(
          context.recommendations || [],
          response?.recommendations || []
        );
        context.recommendations_has_more = response?.has_more === true;
        const cached = contextCache.get(repo.fullName.toLowerCase());
        if (cached?.value) {
          cached.value.recommendations = context.recommendations;
          cached.value.recommendations_has_more = context.recommendations_has_more;
        }
        row.replaceWith(renderRecommendationsRow(context, repo, client, true));
      } catch {
        button.disabled = false;
        button.textContent = "Load More";
        status.textContent = "Load failed";
      }
    });
    shell.append(button, status);
    return shell;
  }

  function mergeRecommendations(existing, added) {
    const merged = [];
    const seen = new Set();
    for (const item of [...existing, ...added]) {
      const key = item?.repo_id != null
        ? `id:${item.repo_id}`
        : `name:${String(item?.full_name || "").toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
    return merged;
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

  function renderLibraryRow(context, repo, client) {
    const row = borderGridRow("starcat-library-row");
    const state = currentLibraryState(context);
    const status = element("span", "starcat-muted starcat-library-status");
    const button = element("button", `starcat-library-button ${state === "in_library" ? "starcat-library-button--active" : ""}`.trim());
    button.type = "button";
    renderLibraryButton(button, state);
    button.addEventListener("click", async () => {
      if (button.disabled) return;

      const previousState = currentLibraryState(latestRenderState?.context || context);
      const nextState = previousState === "in_library" ? "outside_library" : "in_library";
      button.disabled = true;
      status.textContent = "Saving...";
      updateCachedLibraryState(repo, nextState);
      renderLibraryButton(button, nextState);

      try {
        const response = await saveLibraryStateWithConfirmation(client, repo, nextState);
        updateCachedLibraryState(repo, response?.library_state || nextState);
        renderLibraryButton(button, currentLibraryState(latestRenderState?.context || context));
        status.textContent = "Saved";
        showStarcatToast(nextState === "in_library" ? "Added to Starcat Library." : "Removed from Starcat Library.");
        scheduleRefresh("library-state", { force: true });
        window.setTimeout(() => {
          if (status.textContent === "Saved") status.textContent = "";
        }, 2000);
      } catch (error) {
        updateCachedLibraryState(repo, previousState);
        renderLibraryButton(button, previousState);
        status.textContent = "Save failed";
        showStarcatToast(libraryStateErrorMessage(error), true);
      } finally {
        button.disabled = false;
      }
    });

    const header = element("div", "starcat-library-header");
    header.append(sectionTitle("Library"), button);
    row.querySelector(".BorderGrid-cell").append(header, status);
    return row;
  }

  function renderLibraryButton(button, state) {
    const isInLibrary = state === "in_library";
    button.classList.toggle("starcat-library-button--active", isInLibrary);
    button.setAttribute("aria-pressed", String(isInLibrary));
    button.title = isInLibrary ? "Remove from Starcat Library" : "Add to Starcat Library";
    button.replaceChildren(
      element("span", "starcat-library-heart", isInLibrary ? "\u2665" : "\u2661"),
      element("span", "starcat-library-label", isInLibrary ? "In Library" : "Add")
    );
  }

  async function saveLibraryStateWithConfirmation(client, repo, state) {
    try {
      return await client.saveLibraryState(repo, state);
    } catch (error) {
      if (state !== "outside_library" || error?.body?.error !== "using_removal_requires_confirmation") {
        throw error;
      }
      const confirmed = window.confirm("This repo is marked as Using in Starcat. Removing it from Library will change status to Read. Continue?");
      if (!confirmed) throw error;
      return client.saveLibraryState(repo, state, { downgradeUsingStatus: true });
    }
  }

  function updateCachedLibraryState(repo, state) {
    const key = repo.fullName.toLowerCase();
    const cached = contextCache.get(key);
    if (cached?.value?.repo) {
      cached.value.repo.library_state = state;
      cached.value.repo.is_in_library = state === "in_library";
    }
    if (latestRenderState?.context?.repo && latestRenderState.repo?.fullName.toLowerCase() === key) {
      latestRenderState.context.repo.library_state = state;
      latestRenderState.context.repo.is_in_library = state === "in_library";
    }
  }

  function currentLibraryState(context) {
    return context?.repo?.library_state === "in_library" || context?.repo?.is_in_library === true
      ? "in_library"
      : "outside_library";
  }

  function isStarcatLocalRepo(context) {
    return context?.repo?.is_starred === true || currentLibraryState(context) === "in_library";
  }

  function libraryStateErrorMessage(error) {
    if (error?.body?.error === "using_removal_requires_confirmation") return "Removal cancelled. Repo stayed in Library.";
    if (error?.status === 404) return "Repo is not available in Starcat yet.";
    return "Could not update Starcat Library. Check that Starcat is running.";
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

    header.append(sectionTitle("Notes"), button);
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
    header.append(sectionTitle("Tags"), editButton);

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
      chip.append(element("span", "starcat-tag-name", tag.name || "Untitled"));
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
      sample.append(element("span", "starcat-tag-name", tag.name));
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
    if (event.type === "summary.updated") {
      handleSummaryEvent(payload, repo);
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

  function handleSummaryEvent(payload, repo) {
    const key = repo.fullName.toLowerCase();
    const cached = contextCache.get(key);
    if (cached?.value) cached.value.ai_summary = payload.ai_summary || null;
    if (latestRenderState?.context) latestRenderState.context.ai_summary = payload.ai_summary || null;

    const panel = document.querySelector("#starcat-ai-readme-panel");
    if (!panel || !latestRenderState) return;
    renderReadmeAIPanel(panel, latestRenderState.context, repo, latestRenderState.client);
  }

  function installReadmeAISection(context, repo, client) {
    if (context?.repo?.is_starred !== true) return;

    const placement = findReadmeTabPlacement();
    if (!placement || document.querySelector("#starcat-ai-readme-tab")) return;

    const tab = makeReadmeAITab(placement.readmeTab);
    tab.id = "starcat-ai-readme-tab";
    tab.dataset.starcatCompanion = "readme-ai";
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", "false");

    const panel = element("div", "starcat-ai-readme-panel");
    panel.id = "starcat-ai-readme-panel";
    panel.dataset.starcatCompanion = "readme-ai";
    panel.hidden = true;
    renderReadmeAIPanel(panel, context, repo, client);

    tab.addEventListener("click", () => {
      activateReadmeAITab(tab, panel, placement);
    });
    placement.readmeTab.addEventListener("click", () => {
      deactivateReadmeAITab(tab, panel, placement);
    });

    // Keep Starcat AI outside GitHub's managed tab list. GitHub recalculates
    // README tabs into the More menu based on direct children, so inserting our
    // own node there can accidentally collapse native tabs.
    placement.tabHost.append(tab);
    positionReadmeAITab(tab, placement);
    placement.body.parentElement.insertBefore(panel, placement.body.nextSibling);
    window.addEventListener("resize", () => positionReadmeAITab(tab, placement), { passive: true });
  }

  function makeReadmeAITab(_readmeTab) {
    const tab = element("button", "starcat-readme-tab");
    tab.type = "button";
    // 用 inline SVG 而不是外链图片:currentColor 可以继承 GitHub 主题变量,
    // 避免 dark/dimmed/high contrast 下图标固定成黑色或白色。
    tab.append(starcatMarkIcon("starcat-readme-tab__icon"), document.createTextNode("Starcat AI"));
    return tab;
  }

  function findReadmeTabPlacement() {
    const readmeTab = [...document.querySelectorAll("a, button, [role='tab']")]
      .find((node) => textOf(node) === "README" && node.offsetParent !== null);
    if (!readmeTab) return null;

    const tabBar = readmeTab.closest("[role='tablist'], nav, .UnderlineNav, .Box-header, .d-flex");
    const tabAnchor = findReadmeTabItem(readmeTab, tabBar);
    const tabParent = tabAnchor?.parentElement;
    const tabHost = tabBar?.closest(".Box-header") || tabBar?.parentElement;
    const box = readmeTab.closest(".Box") || document.querySelector("#readme")?.closest(".Box");
    const markdown = box?.querySelector(".markdown-body") || document.querySelector("#readme .markdown-body, article.markdown-body, .markdown-body");
    const body = markdown?.parentElement;
    if (!tabBar || !tabHost || !tabParent || !body || !body.parentElement) return null;
    return { readmeTab, tabBar, tabHost, tabParent, tabAnchor, body };
  }

  function findReadmeTabItem(readmeTab, tabBar) {
    let node = readmeTab;
    while (node?.parentElement && node.parentElement !== tabBar) {
      const siblings = [...node.parentElement.children].map(textOf).filter(Boolean);
      const hasNativeReadmeSiblings = siblings.some((text) => /Code of conduct|Contributing|MIT license|Security/.test(text));
      if (textOf(node) === "README" && hasNativeReadmeSiblings) return node;
      if (textOf(node.parentElement) !== "README") break;
      node = node.parentElement;
    }
    return textOf(node) === "README" ? node : readmeTab;
  }

  function positionReadmeAITab(tab, placement) {
    const editButton = findReadmeEditButton(placement.tabHost);
    const editButtonRect = editButton?.getBoundingClientRect?.();
    const hostRect = placement.tabHost.getBoundingClientRect();
    if (!hostRect.width) return;

    // 找"tab 链里最右边"的元素作为主锚 = 真实 Security tab(也可能
    // 是 Code of conduct / License 等,但一定是 tab 链尾部那个)。
    // 之前用 querySelectorAll 然后取最后一项,被 flex 布局里 readme tab
    // 自己或某个非 Security 元素劫持,top 比 Security 更高导致 Starcat AI
    // 跟 Security 不水平。换成按 getBoundingClientRect().right 取 max,
    // 几何上保证拿到 tab 链最右那个,跟文字标签无关。
    const tabBar = placement.tabBar;
    const tabElements = [...tabBar.querySelectorAll("a, button, [role='tab']")]
      .filter((node) => node.offsetParent !== null);
    const lastTab = tabElements.reduce((best, node) => {
      if (!best) return node;
      return node.getBoundingClientRect().right > best.getBoundingClientRect().right ? node : best;
    }, null) || placement.readmeTab;
    const lastTabRect = lastTab.getBoundingClientRect();

    placement.tabHost.classList.add("starcat-readme-tabbar-host");
    // width 由 JS 移除 inline 设定,改走 CSS `width: auto` 让按钮 fit-content
    // 自适应 "Starcat AI" 文本宽度。
    tab.style.removeProperty("width");
    // top / height 跟最后一个原生 tab 完全一致,保证水平对齐。
    tab.style.top = `${Math.max(0, lastTabRect.top - hostRect.top + 7)}px`;
    tab.style.height = `${lastTabRect.height}px`;
    // 主锚:最后一个原生 tab 右边 + 16px 间距(Starcat AI 跟在 tab 链尾部)。
    // 上限:编辑按钮左边 - 16px 间距(避免骑上笔图标)。
    // 上一版用"编辑按钮左边 - 96"做目标把 tab 推到 Security 上,
    // 根因是 findReadmeEditButton 命中了中间某个元素(不是真的笔图标)。
    // 这里退回"tab 链尾部 + 编辑按钮上限"双锚,逻辑最稳。
    const tabWidth = tab.offsetWidth;
    let left = lastTabRect.right - hostRect.left + 16;
    if (editButtonRect?.width) {
      const maxLeft = editButtonRect.left - hostRect.left - tabWidth - 16;
      if (left > maxLeft) left = Math.max(0, maxLeft);
    }
    left = Math.max(0, left);
    tab.style.left = `${left}px`;
    tab.style.right = "auto";
  }

  function findReadmeEditButton(tabHost) {
    return [...tabHost.querySelectorAll("a, button")]
      .filter((node) => node.offsetParent !== null)
      .find((node) => {
        const href = node.getAttribute("href") || "";
        const label = [
          node.getAttribute("aria-label"),
          node.getAttribute("title"),
          textOf(node)
        ].filter(Boolean).join(" ");
        const hasPencilIcon = Boolean(node.querySelector(".octicon-pencil, svg[class*='octicon-pencil']"));
        return /\/edit\//.test(href) || (hasPencilIcon && /edit|编辑/i.test(label));
      }) || null;
  }

  function findReadmeMoreTab(tabBar) {
    return [...tabBar.querySelectorAll("a, button, [role='tab'], div")]
      .filter((node) => node.offsetParent !== null && textOf(node) === "More")
      .sort((left, right) => {
        const leftWidth = left.getBoundingClientRect?.().width || 0;
        const rightWidth = right.getBoundingClientRect?.().width || 0;
        return leftWidth - rightWidth;
      })[0] || null;
  }

  function activateReadmeAITab(tab, panel, placement) {
    tab.classList.add("starcat-readme-tab--active");
    tab.setAttribute("aria-selected", "true");
    placement.readmeTab.classList.add("starcat-readme-tab__github-inactive");
    placement.tabAnchor.classList.add("starcat-readme-tab__github-inactive");
    placement.body.dataset.starcatReadmeBodyHidden = "true";
    placement.body.hidden = true;
    panel.hidden = false;
  }

  function deactivateReadmeAITab(tab, panel, placement) {
    tab.classList.remove("starcat-readme-tab--active");
    tab.setAttribute("aria-selected", "false");
    placement.readmeTab.classList.remove("starcat-readme-tab__github-inactive");
    placement.tabAnchor.classList.remove("starcat-readme-tab__github-inactive");
    panel.hidden = true;
    delete placement.body.dataset.starcatReadmeBodyHidden;
    placement.body.hidden = false;
  }

  function renderReadmeAIPanel(panel, context, repo, client) {
    panel.replaceChildren();
    const summary = context?.ai_summary;
    const actions = context?.actions || {};
    const header = element("div", "starcat-ai-readme-header");
    header.append(
      element("h2", "starcat-ai-readme-title", "Starcat AI"),
      renderSummaryMeta(summary)
    );
    panel.append(header);

    if (summary?.markdown) {
      panel.append(renderSummaryMarkdown(summary.markdown));
      return;
    }

    const empty = element("div", "starcat-ai-empty");
    empty.append(
      element("div", "starcat-ai-empty__title", "暂未生成"),
      element("p", "starcat-ai-empty__body", "可以在 Starcat 中打开该仓库并生成 AI 摘要。")
    );
    const button = element("button", "btn btn-sm btn-primary", "生成摘要");
    button.type = "button";
    button.disabled = actions.generate_summary !== true;
    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = "已发送";
      try {
        await client.openAction(repo, "generate-summary");
        empty.append(element("div", "starcat-ai-empty__status", "Starcat 已开始生成，完成后会自动同步到此页面。"));
      } catch {
        button.disabled = actions.generate_summary !== true;
        button.textContent = "生成摘要";
        empty.append(element("div", "starcat-ai-empty__status starcat-ai-empty__status--error", "发送失败，请确认 Starcat 正在运行。"));
      }
    });
    empty.append(button);
    panel.append(empty);
  }

  function renderSummaryMeta(summary) {
    const meta = element("div", "starcat-ai-readme-meta");
    if (!summary?.generated_at && !summary?.model) return meta;
    const parts = [];
    if (summary.model) parts.push(summary.model);
    if (summary.generated_at) parts.push(summary.generated_at);
    meta.textContent = parts.join(" · ");
    return meta;
  }

  function renderSummaryMarkdown(markdown) {
    const body = element("div", "starcat-ai-summary markdown-body");
    renderMarkdownBlocks(body, markdown);
    return body;
  }

  function renderMarkdownBlocks(container, markdown) {
    const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
    let index = 0;
    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) {
        index += 1;
        continue;
      }

      const fence = line.match(/^```(\w+)?\s*$/);
      if (fence) {
        const codeLines = [];
        index += 1;
        while (index < lines.length && !/^```\s*$/.test(lines[index])) {
          codeLines.push(lines[index]);
          index += 1;
        }
        if (index < lines.length) index += 1;
        const pre = element("pre");
        const code = element("code");
        if (fence[1]) code.className = `language-${fence[1]}`;
        code.textContent = codeLines.join("\n");
        pre.append(code);
        container.append(pre);
        continue;
      }

      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        const level = Math.min(6, heading[1].length + 1);
        const node = element(`h${level}`);
        appendInlineMarkdown(node, heading[2]);
        container.append(node);
        index += 1;
        continue;
      }

      if (/^\s*[-*]\s+/.test(line)) {
        const list = element("ul");
        while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
          const item = element("li");
          appendInlineMarkdown(item, lines[index].replace(/^\s*[-*]\s+/, ""));
          list.append(item);
          index += 1;
        }
        container.append(list);
        continue;
      }

      if (/^\s*\d+\.\s+/.test(line)) {
        const list = element("ol");
        while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
          const item = element("li");
          appendInlineMarkdown(item, lines[index].replace(/^\s*\d+\.\s+/, ""));
          list.append(item);
          index += 1;
        }
        container.append(list);
        continue;
      }

      const paragraphLines = [line.trim()];
      index += 1;
      while (index < lines.length && lines[index].trim() && !/^(#{1,6})\s+/.test(lines[index]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[index]) && !/^```/.test(lines[index])) {
        paragraphLines.push(lines[index].trim());
        index += 1;
      }
      const paragraph = element("p");
      appendInlineMarkdown(paragraph, paragraphLines.join(" "));
      container.append(paragraph);
    }
  }

  function appendInlineMarkdown(parent, text) {
    const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
    let cursor = 0;
    for (const match of String(text || "").matchAll(pattern)) {
      if (match.index > cursor) {
        parent.append(document.createTextNode(text.slice(cursor, match.index)));
      }
      const token = match[0];
      if (token.startsWith("`")) {
        parent.append(element("code", "", token.slice(1, -1)));
      } else if (token.startsWith("**")) {
        const strong = element("strong");
        strong.textContent = token.slice(2, -2);
        parent.append(strong);
      } else {
        const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        const anchor = element("a");
        anchor.textContent = link?.[1] || token;
        anchor.href = safeMarkdownURL(link?.[2]) || "#";
        anchor.rel = "noreferrer";
        anchor.target = "_blank";
        parent.append(anchor);
      }
      cursor = match.index + token.length;
    }
    if (cursor < text.length) {
      parent.append(document.createTextNode(text.slice(cursor)));
    }
  }

  function safeMarkdownURL(raw) {
    const value = String(raw || "").trim();
    if (/^(https?:|mailto:)/i.test(value)) return value;
    if (value.startsWith("#") || value.startsWith("/")) return value;
    return null;
  }

  function renderSignalButtons(context, repo, client, isPro) {
    const pageheadActions = findPageheadActions();
    if (!pageheadActions) return;
    if (!isStarcatLocalRepo(context)) return;

    pageheadActions.append(signalListItem("Health", context?.health, isPro, "health"));
  }

  function isGoogleSearchPage() {
    return isGoogleHost(location.hostname) && location.pathname === "/search";
  }

  function isGoogleHost(hostname) {
    const labels = String(hostname || "").toLowerCase().split(".").filter(Boolean);
    if (labels[0] === "www") labels.shift();
    // Chrome match patterns cannot express google.* country domains, so the
    // manifest matches /search broadly and this runtime gate keeps non-Google
    // search pages from reading the DOM or calling Starcat's local API.
    return labels.length >= 2 && labels[0] === "google";
  }

  function findSearchResultRepoTargets() {
    const seen = new Set();
    const targets = [];
    const anchors = [...document.querySelectorAll("a[href]")]
      .sort((left, right) => Number(Boolean(right.querySelector("h3"))) - Number(Boolean(left.querySelector("h3"))));
    for (const anchor of anchors) {
      const repo = parseGitHubRepoFromSearchLink(anchor.href);
      if (!repo) continue;

      const title = anchor.querySelector("h3") || anchor.closest("h3") || anchor;
      const result = findSearchResultContainer(anchor, title);
      if (!result || seen.has(repo.fullName.toLowerCase())) continue;

      seen.add(repo.fullName.toLowerCase());
      targets.push({ repo, result, title });
    }
    return targets.slice(0, 8);
  }

  function findSearchResultContainer(anchor, title) {
    const resultItem = anchor.closest("[data-sokoban-container], .MjjYud, .g");
    if (resultItem?.contains(title) && /github\.com/.test(textOf(resultItem))) {
      return resultItem;
    }

    const candidates = [];
    let node = anchor;
    while (node && node !== document.body) {
      if (node instanceof HTMLElement) candidates.push(node);
      node = node.parentElement;
    }

    return candidates.find((candidate) => {
      const text = textOf(candidate);
      return candidate.contains(title)
        && /github\.com/.test(text)
        && candidate.querySelector("h3");
    }) || resultItem || title.parentElement;
  }

  function parseGitHubRepoFromSearchLink(href) {
    const direct = StarcatCompanion.parseGitHubRepo(href);
    if (direct) return direct;

    try {
      const url = new URL(href);
      const params = ["q", "url", "u", "imgurl"]
        .map((key) => url.searchParams.get(key))
        .filter(Boolean);
      for (const value of params) {
        const repo = StarcatCompanion.parseGitHubRepo(value);
        if (repo) return repo;
      }

      const decoded = decodeURIComponent(href);
      const match = decoded.match(/https?:\/\/github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+/);
      return match ? StarcatCompanion.parseGitHubRepo(match[0]) : null;
    } catch {
      return null;
    }
  }

  function renderSearchResultBadges(target, repo, context, client) {
    const result = target?.result;
    if (!result || result.querySelector?.("[data-starcat-companion='search-result']")) return;

    const actions = element("div", "starcat-search-actions");
    actions.dataset.starcatCompanion = "search-result";
    actions.append(
      element("span", "starcat-search-separator", "·"),
      searchBadge("Open in Starcat", starcatSearchIcon(), async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await client.openAction(repo, "open-repo");
      }),
      searchMetaBadge("Health", formatScore(context?.health?.score), healthSearchIcon(), scoreToneClass(context?.health?.score, "health"))
    );
    const anchor = findSearchResultSnippetAnchor(result, target?.title, repo);
    // Insert directly after the snippet block so the actions visually belong
    // to this result, while still avoiding Google's URL/translation row.
    if (anchor?.parentElement && result.contains(anchor)) {
      anchor.parentElement.insertBefore(actions, anchor.nextSibling);
    } else {
      result.append(actions);
    }
  }

  function findSearchResultSnippetAnchor(result, title, repo) {
    const titleNode = title?.closest?.("h3") || title;
    const titleRect = titleNode?.getBoundingClientRect?.();
    const titleText = textOf(titleNode);
    const owner = escapeRegExp(repo.owner);
    const name = escapeRegExp(repo.repo);
    const repoPathPattern = new RegExp(`github\\.com\\s*(?:[›>\\/]\\s*)${owner}\\s*(?:[›>\\/]\\s*)${name}`, "i");
    const snippet = [...result.querySelectorAll("div, span")]
      .filter((node) => {
        if (node.offsetParent === null || node.contains(titleNode) || node.querySelector?.("h3")) return false;
        const text = textOf(node);
        if (text.length < 40 || text.includes(titleText)) return false;
        if (/github\.com/i.test(text) || repoPathPattern.test(text)) return false;
        const rect = node.getBoundingClientRect?.();
        return !titleRect || !rect || rect.top >= titleRect.bottom - 1;
      })
      .sort((left, right) => {
        const leftTop = left.getBoundingClientRect?.().top || 0;
        const rightTop = right.getBoundingClientRect?.().top || 0;
        if (Math.abs(leftTop - rightTop) > 1) return leftTop - rightTop;
        return textOf(left).length - textOf(right).length;
      })[0];
    if (!snippet) return null;

    let anchor = snippet;
    while (anchor.parentElement && anchor.parentElement !== result) {
      const parent = anchor.parentElement;
      if (parent.querySelector?.("h3")) break;
      const parentText = textOf(parent);
      if (!parentText.includes(textOf(anchor))) break;
      if (parentText.length > textOf(anchor).length + 120) break;
      anchor = parent;
    }
    return anchor;
  }

  function searchBadge(label, icon, onClick) {
    const button = element("button", "starcat-search-badge");
    button.type = "button";
    button.append(icon, document.createTextNode(label));
    button.addEventListener("click", onClick);
    return button;
  }

  function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function searchMetaBadge(label, value, icon, toneClass) {
    const badge = element("span", `starcat-search-health ${toneClass || ""}`.trim());
    badge.append(icon, document.createTextNode(`${label} ${value}`));
    return badge;
  }

  function starcatSearchIcon() {
    const image = element("img", "starcat-search-icon");
    image.src = chrome.runtime.getURL("src/assets/icons/icon-16.png");
    image.alt = "";
    image.decoding = "async";
    image.loading = "lazy";
    image.setAttribute("aria-hidden", "true");
    return image;
  }

  function healthSearchIcon() {
    return octicon("pulse", "starcat-search-icon starcat-search-icon--svg", "M6 2c.306 0 .582.187.696.471L10 10.731l1.304-3.26A.75.75 0 0 1 12 7h3.25a.75.75 0 0 1 0 1.5h-2.742l-1.812 4.529a.75.75 0 0 1-1.392 0L6 4.769 4.696 8.03A.75.75 0 0 1 4 8.5H.75a.75.75 0 0 1 0-1.5h2.742l1.812-4.529A.75.75 0 0 1 6 2Z");
  }

  function handleGitHubStarClick(event) {
    if (!(event.target instanceof Element) || event.defaultPrevented) return;
    const repo = StarcatCompanion.parseGitHubRepo(location.href);
    if (!repo) return;

    const control = findClickedGitHubStarControl(event.target);
    const previousState = githubStarState(control);
    if (previousState == null) return;

    const expectedState = !previousState;
    const pageURL = location.href;
    waitForGitHubStarState(repo, expectedState, pageURL).then((confirmed) => {
      if (confirmed) queueStarStateSync(repo, expectedState);
    });
  }

  function findClickedGitHubStarControl(target) {
    const clicked = target.closest("button, input[type='submit']");
    if (!clicked || clicked.offsetParent === null) return null;
    const active = findGitHubStarControl();
    return active === clicked || active?.contains(target) ? active : null;
  }

  function findGitHubStarControl() {
    const direct = [
      ...document.querySelectorAll("[data-testid='star-button'], button[aria-label*='Star this repository'], button[aria-label*='Unstar this repository']")
    ].find((node) => node.offsetParent !== null && githubStarState(node) != null);
    if (direct) return direct;

    const starCounter = document.querySelector("#repo-stars-counter-star");
    const scope = starCounter?.closest("li") || findPageheadActions();
    if (!scope) return null;
    return [...scope.querySelectorAll("button, input[type='submit']")]
      .find((node) => node.offsetParent !== null && githubStarState(node) != null) || null;
  }

  function githubStarState(control) {
    if (!control) return null;
    const label = [
      control.getAttribute?.("aria-label"),
      control.getAttribute?.("title"),
      control.getAttribute?.("value"),
      textOf(control)
    ].filter(Boolean).join(" ");
    if (/\bunstar\b|\bstarred\b/i.test(label)) return true;
    if (/\bstar\b/i.test(label)) return false;
    return null;
  }

  async function waitForGitHubStarState(repo, expectedState, pageURL) {
    const deadline = Date.now() + GITHUB_STAR_CONFIRM_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await new Promise((resolve) => window.setTimeout(resolve, GITHUB_STAR_POLL_MS));
      if (location.href !== pageURL) return false;
      const activeRepo = StarcatCompanion.parseGitHubRepo(location.href);
      if (!sameRepo(activeRepo, repo)) return false;
      if (githubStarState(findGitHubStarControl()) === expectedState) return true;
    }
    return false;
  }

  function queueStarStateSync(repo, isStarred) {
    const key = repo.fullName.toLowerCase();
    // Keep only the latest confirmed target. If the user quickly stars and
    // unstars again, the running loop will apply both in order without toggling.
    pendingStarStates.set(key, { repo, isStarred });
    if (starStateSyncs.has(key)) return;

    const task = (async () => {
      while (pendingStarStates.has(key)) {
        const target = pendingStarStates.get(key);
        pendingStarStates.delete(key);
        await syncStarStateWithStarcat(target.repo, target.isStarred);
      }
    })().finally(() => {
      starStateSyncs.delete(key);
    });
    starStateSyncs.set(key, task);
  }

  async function syncStarStateWithStarcat(repo, isStarred) {
    try {
      const config = await StarcatCompanion.loadConfig();
      if (!config.token) throw new Error("missing_token");
      const client = StarcatCompanion.createClient(config);
      showStarcatToast(isStarred ? "Syncing Star with Starcat..." : "Syncing Unstar with Starcat...");
      await client.syncStarState(repo, isStarred);

      contextCache.delete(repo.fullName.toLowerCase());
      const activeRepo = StarcatCompanion.parseGitHubRepo(location.href);
      if (sameRepo(activeRepo, repo)) {
        await refreshSurfaces("github-star-state", { force: true });
      }
      showStarcatToast(isStarred ? "Starcat Stars updated." : "Removed from Starcat Stars.");
    } catch (error) {
      showStarcatToast(starStateErrorMessage(error), true);
    }
  }

  function sameRepo(left, right) {
    return left?.fullName?.toLowerCase() === right?.fullName?.toLowerCase();
  }

  function starStateErrorMessage(error) {
    if (error?.body?.error === "github_not_authenticated") {
      return "Sign in to GitHub in Starcat, then try again.";
    }
    if (error?.message === "missing_token") {
      return "Configure the Starcat Local API Key first.";
    }
    return "GitHub changed, but Starcat could not refresh Stars.";
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
    if (!menu) return;

    insertCodeMenuOpenInStarcat(menu, latestRenderState);
    if (menu.querySelector("[data-starcat-code-panel='true']")) return;

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

  function insertCodeMenuOpenInStarcat(menu, { context, repo, client }) {
    if (!isStarcatLocalRepo(context) || context?.actions?.open_in_starcat !== true) return;
    if (menu.querySelector("[data-starcat-code-open='true']")) return;

    const target = findCodeMenuActionRow(menu, ["Open in GitHub Copilot app", "Open with GitHub Desktop", "Download ZIP"]);
    if (!target?.parentElement) return;

    const button = element("button", "starcat-code-native-action");
    button.type = "button";
    button.dataset.starcatCompanion = "code-menu";
    button.dataset.starcatCodeOpen = "true";
    button.append(
      starcatMarkIcon("starcat-code-item__icon"),
      element("span", "starcat-code-native-action__label", "Open in Starcat app")
    );
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await client.openAction(repo, "open-repo");
      } finally {
        button.disabled = false;
      }
    });
    target.parentElement.insertBefore(button, target);
  }

  function findCodeMenuActionRow(menu, labels) {
    const candidates = [...menu.querySelectorAll("a, button, [role='menuitem'], li, div")]
      .filter((node) => node.offsetParent !== null && labels.some((label) => textOf(node).includes(label)))
      .sort((left, right) => textOf(left).length - textOf(right).length);
    const node = candidates[0];
    if (!node) return null;
    const clickable = node.closest?.("a, button, [role='menuitem'], li");
    if (clickable) return clickable;

    let row = node;
    while (row.parentElement && row.parentElement !== menu) {
      const parentText = textOf(row.parentElement);
      const labelCount = labels.filter((label) => parentText.includes(label)).length;
      if (labelCount > 1 || parentText.length > textOf(row).length + 80) break;
      row = row.parentElement;
    }
    return row;
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
    // sidebar 三个 section 标题(Recommends/Notes/Tags)统一加 starcat icon,
    // 跟 makeReadmeAITab / code menu 的 starcatMarkIcon 复用同一个内联 SVG
    // 绘制风格(currentColor stroke,跟 GitHub 主题色联动)。不用 element(text)
    // 是因为 textContent 会清掉已 append 的子节点,改用显式 append(icon)+append(text)
    const node = element("h2", "h4 mb-3");
    node.append(
      starcatMarkIcon("starcat-section-title__icon"),
      document.createTextNode(title)
    );
    return node;
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

  function starcatMarkIcon(className) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("viewBox", "0 0 18 18");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("class", className);
    svg.setAttribute("fill", "none");

    const head = document.createElementNS("http://www.w3.org/2000/svg", "path");
    head.setAttribute("d", "M2.8 14.2V5.4L6 2L8 4.3H10L12 2L15.2 5.4V14.2Z");
    head.setAttribute("stroke", "currentColor");
    head.setAttribute("stroke-width", "1.8");
    head.setAttribute("stroke-linejoin", "round");

    const star = document.createElementNS("http://www.w3.org/2000/svg", "path");
    star.setAttribute("d", "M9 6.6L9.8 8.2L11.5 8.4L10.2 9.6L10.5 11.3L9 10.4L7.5 11.3L7.8 9.6L6.5 8.4L8.2 8.2Z");
    star.setAttribute("fill", "currentColor");

    svg.append(head, star);
    return svg;
  }

  function showStarcatToast(message, isError = false) {
    const existing = document.querySelector("#starcat-companion-toast");
    existing?.remove();

    const toast = element("div", `starcat-toast ${isError ? "starcat-toast--error" : ""}`.trim(), message);
    toast.id = "starcat-companion-toast";
    document.body.append(toast);
    window.setTimeout(() => toast.remove(), 3500);
  }

  function removeStarcatNodes() {
    closeEventSubscription();
    document.querySelectorAll("[data-starcat-readme-body-hidden='true']").forEach((node) => {
      node.hidden = false;
      delete node.dataset.starcatReadmeBodyHidden;
    });
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

  document.addEventListener("click", handleGitHubStarClick, true);
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
