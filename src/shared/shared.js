/*
 * Starcat Companion shared utilities.
 *
 * The extension deliberately stores only the local service URL and Companion bearer
 * token. GitHub data, notes, health scores, and actions remain owned by the
 * Starcat app and are fetched through the loopback API.
 */

(function () {
  const STORAGE_KEYS = {
    serviceURL: "starcatCompanionServiceURL",
    port: "starcatCompanionPort",
    token: "starcatCompanionToken"
  };

  const DEFAULT_SERVICE_URL = "http://127.0.0.1:5001";
  const REPO_SEGMENT_BLOCKLIST = new Set([
    "about",
    "apps",
    "codespaces",
    "collections",
    "customer-stories",
    "dashboard",
    "events",
    "explore",
    "features",
    "marketplace",
    "new",
    "notifications",
    "orgs",
    "pricing",
    "pulls",
    "search",
    "settings",
    "sponsors",
    "topics",
    "trending"
  ]);

  function normalizeServiceURL(value) {
    const raw = String(value || "").trim();
    if (!raw) return DEFAULT_SERVICE_URL;

    try {
      const url = new URL(raw);
      const isLoopback = url.hostname === "127.0.0.1" || url.hostname === "localhost";
      if (isLoopback && url.port) {
        // Starcat's loopback Companion service is plain HTTP. Normalizing any
        // accidental https:// input avoids Safari/Chrome trying TLS on 127.0.0.1.
        url.protocol = "http:";
        url.pathname = "";
        url.search = "";
        url.hash = "";
        return url.toString().replace(/\/$/, "");
      }
    } catch {
      // Fall through to the default. The local API should never be a relative URL.
    }
    return DEFAULT_SERVICE_URL;
  }

  function normalizeToken(value) {
    return String(value || "").trim();
  }

  async function loadConfig() {
    const stored = await chrome.storage.local.get([
      STORAGE_KEYS.serviceURL,
      STORAGE_KEYS.port,
      STORAGE_KEYS.token
    ]);
    const migratedURL = stored[STORAGE_KEYS.serviceURL]
      || (stored[STORAGE_KEYS.port] ? `http://127.0.0.1:${stored[STORAGE_KEYS.port]}` : DEFAULT_SERVICE_URL);
    return {
      serviceURL: normalizeServiceURL(migratedURL),
      token: normalizeToken(stored[STORAGE_KEYS.token])
    };
  }

  async function saveConfig(config) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.serviceURL]: normalizeServiceURL(config.serviceURL),
      [STORAGE_KEYS.token]: normalizeToken(config.token)
    });
  }

  function parseGitHubRepo(urlString) {
    let url;
    try {
      url = new URL(urlString);
    } catch {
      return null;
    }
    if (url.hostname !== "github.com") return null;

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const [owner, repo] = parts;
    if (REPO_SEGMENT_BLOCKLIST.has(owner)) return null;
    if (!/^[A-Za-z0-9._-]+$/.test(owner) || !/^[A-Za-z0-9._-]+$/.test(repo)) return null;

    return {
      owner,
      repo,
      fullName: `${owner}/${repo}`
    };
  }

  function createClient(config) {
    const baseURL = normalizeServiceURL(config.serviceURL);
    const token = normalizeToken(config.token);

    async function request(path, options = {}) {
      if (!token) {
        throw new Error("missing_token");
      }

      const response = await fetch(`${baseURL}${path}`, {
        ...options,
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(options.headers || {})
        }
      });

      const text = await response.text();
      let body = null;
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = { raw: text };
        }
      }

      if (!response.ok) {
        const error = new Error(body?.error || `http_${response.status}`);
        error.status = response.status;
        error.body = body;
        throw error;
      }
      return body;
    }

    async function streamEvents(params, handlers) {
      if (!token) {
        throw new Error("missing_token");
      }

      const query = new URLSearchParams();
      if (params.repoID) query.set("repo_id", String(params.repoID));
      const controller = new AbortController();
      const response = await fetch(`${baseURL}/plugin/v1/events?${query.toString()}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "text/event-stream"
        },
        signal: controller.signal
      });
      if (!response.ok || !response.body) {
        throw new Error(`events_http_${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      (async () => {
        try {
          while (!controller.signal.aborted) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split("\n\n");
            buffer = parts.pop() || "";
            for (const part of parts) {
              const event = parseSSE(part);
              if (event) handlers.onEvent?.(event);
            }
          }
        } catch (error) {
          if (!controller.signal.aborted) handlers.onError?.(error);
        }
      })();

      return {
        close() {
          controller.abort();
          reader.cancel().catch(() => {});
        }
      };
    }

    function parseSSE(chunk) {
      const lines = chunk.split("\n");
      let type = "message";
      let data = "";
      for (const line of lines) {
        if (line.startsWith(":")) continue;
        if (line.startsWith("event:")) type = line.slice(6).trim();
        if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) return null;
      try {
        return { type, data: JSON.parse(data) };
      } catch {
        return null;
      }
    }

    return {
      ping() {
        return request("/plugin/v1/ping");
      },
      repoContext(repo) {
        const params = new URLSearchParams({ owner: repo.owner, repo: repo.repo });
        return request(`/plugin/v1/repo-context?${params.toString()}`);
      },
      saveNote(repo, content) {
        return request("/plugin/v1/notes", {
          method: "PATCH",
          body: JSON.stringify({ owner: repo.owner, repo: repo.repo, content })
        });
      },
      saveTags(repo, tagIDs) {
        return request("/plugin/v1/tags", {
          method: "PATCH",
          body: JSON.stringify({ owner: repo.owner, repo: repo.repo, tag_ids: tagIDs })
        });
      },
      saveLibraryState(repo, state, options = {}) {
        return request("/plugin/v1/library-state", {
          method: "PATCH",
          body: JSON.stringify({
            owner: repo.owner,
            repo: repo.repo,
            state,
            downgrade_using_status: options.downgradeUsingStatus === true
          })
        });
      },
      openAction(repo, action) {
        return request("/plugin/v1/actions/open", {
          method: "POST",
          body: JSON.stringify({ owner: repo.owner, repo: repo.repo, action })
        });
      },
      events(params, handlers) {
        return streamEvents(params, handlers);
      }
    };
  }

  globalThis.StarcatCompanion = {
    DEFAULT_SERVICE_URL,
    normalizeServiceURL,
    loadConfig,
    saveConfig,
    parseGitHubRepo,
    createClient
  };
})();
