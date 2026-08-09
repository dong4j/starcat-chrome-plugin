/*
 * Browser action popup controller.
 *
 * The popup is a status-first pairing surface. Opening it may ping the saved
 * local service, but it must never rewrite configuration until the user presses
 * Save or Test Connection.
 */

(async function () {
  const THEME_KEY = "starcatOptionsTheme";
  const extensionAPI = StarcatCompanion.extensionAPI || globalThis.chrome;
  const form = document.querySelector("#popup-form");
  const serviceURLInput = document.querySelector("#service-url");
  const tokenInput = document.querySelector("#token");
  const saveButton = document.querySelector("#save");
  const testButton = document.querySelector("#test");
  const openOptionsButton = document.querySelector("#open-options");
  const versionBadge = document.querySelector("#version");
  const connectionCard = document.querySelector("#connection-card");
  const connectionStatus = document.querySelector("#connection-status");
  const connectionTitle = document.querySelector("#connection-title");
  const connectionDescription = document.querySelector("#connection-description");
  const connectionServiceURL = document.querySelector("#connection-service-url");
  const lastChecked = document.querySelector("#last-checked");
  const formFeedback = document.querySelector("#form-feedback");

  await applyStoredTheme();
  versionBadge.textContent = `v${extensionAPI.runtime.getManifest().version}`;

  const config = await StarcatCompanion.loadConfig();
  serviceURLInput.value = config.serviceURL;
  tokenInput.value = config.token;
  updateServiceMetadata(config);
  await checkConnection(config);

  async function applyStoredTheme() {
    const preferences = await extensionAPI.storage.local.get([THEME_KEY]);
    const theme = preferences[THEME_KEY];
    if (theme === "light" || theme === "dark") {
      document.documentElement.dataset.theme = theme;
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  function setConnectionState(state, details = {}) {
    const states = {
      checking: {
        label: "Checking",
        title: "Checking local connection…",
        description: "Looking for the Starcat app on this Mac.",
        checked: "Checking…"
      },
      connected: {
        label: "Connected",
        title: `${details.app || "Starcat"} is connected and ready.`,
        description: "The browser plugin can use your local Starcat data.",
        checked: formatTime(new Date())
      },
      setup: {
        label: "Setup required",
        title: "Finish local pairing.",
        description: "Enter the service URL and Local API Key from Starcat Settings.",
        checked: "Not checked"
      },
      ready: {
        label: "Not tested",
        title: "Connection settings were saved.",
        description: "Run Test Connection to verify the updated pairing.",
        checked: "Not checked"
      },
      error: {
        label: "Unavailable",
        title: "Starcat is not reachable.",
        description: details.message || "Open Starcat and make sure Browser Plugin Service is enabled.",
        checked: formatTime(new Date())
      }
    };
    const content = states[state] || states.error;
    connectionCard.dataset.state = state;
    connectionStatus.textContent = content.label;
    connectionTitle.textContent = content.title;
    connectionDescription.textContent = content.description;
    connectionDescription.title = content.description;
    lastChecked.textContent = content.checked;
  }

  function setFormFeedback(message, tone = "") {
    formFeedback.textContent = message;
    formFeedback.title = message;
    if (tone) {
      formFeedback.dataset.tone = tone;
    } else {
      delete formFeedback.dataset.tone;
    }
  }

  function formConfig() {
    return {
      serviceURL: serviceURLInput.value,
      token: tokenInput.value
    };
  }

  function updateServiceMetadata(current) {
    const serviceURL = current.serviceURL || "Not configured";
    connectionServiceURL.textContent = serviceURL;
    connectionServiceURL.title = serviceURL;
  }

  function formatTime(date) {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(date);
  }

  async function saveCurrentConfig() {
    await StarcatCompanion.saveConfig(formConfig());
    const saved = await StarcatCompanion.loadConfig();
    serviceURLInput.value = saved.serviceURL;
    tokenInput.value = saved.token;
    updateServiceMetadata(saved);
    return saved;
  }

  async function checkConnection(current) {
    updateServiceMetadata(current);
    if (!current.serviceURL || !current.token) {
      setConnectionState("setup");
      return { ok: false, message: "Local pairing is incomplete." };
    }

    setConnectionState("checking");
    try {
      const client = StarcatCompanion.createClient(current);
      const pong = await client.ping();
      setConnectionState("connected", { app: pong.app || "Starcat" });
      return { ok: true };
    } catch (error) {
      const message = error?.message || String(error);
      setConnectionState("error", { message });
      return { ok: false, message };
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    saveButton.disabled = true;
    setFormFeedback("Saving…");
    try {
      const saved = await saveCurrentConfig();
      setConnectionState(saved.token ? "ready" : "setup");
      setFormFeedback("Saved.", "success");
    } catch (error) {
      setFormFeedback(`Save failed: ${error.message}`, "error");
    } finally {
      saveButton.disabled = false;
    }
  });

  testButton.addEventListener("click", async () => {
    saveButton.disabled = true;
    testButton.disabled = true;
    setFormFeedback("Testing connection…");
    try {
      const saved = await saveCurrentConfig();
      const result = await checkConnection(saved);
      if (result.ok) {
        setFormFeedback("Connection verified.", "success");
      } else {
        setFormFeedback(result.message, "error");
      }
    } catch (error) {
      setConnectionState("error", { message: error.message });
      setFormFeedback(`Connection failed: ${error.message}`, "error");
    } finally {
      saveButton.disabled = false;
      testButton.disabled = false;
    }
  });

  openOptionsButton.addEventListener("click", () => {
    extensionAPI.runtime.openOptionsPage();
  });
})();
