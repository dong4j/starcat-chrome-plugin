# Starcat Chrome Plugin

<!-- starcat-promo:start -->
<div align="center">
<a href="https://starcat.ink"><img src="https://raw.githubusercontent.com/starcat-app/starcat-pro/main/banner.webp" width="100%" alt="Starcat" /></a>

<p><strong>Chrome/Chromium companion extension that brings Starcat context to GitHub pages.</strong></p>
<p>Starcat is a native macOS app that turns GitHub Stars into a searchable, organized and AI-assisted local knowledge base. Version 1.3.0 includes README rendering, knowledge-base RAG, My Projects, library and repository insights, macOS desktop widgets, tags and private notes, release tracking, repository health signals, AI summaries, semantic search, browser plugins, Alfred / uTools / Raycast search integrations, and self-hostable support APIs.</p>

<a href="https://github.com/starcat-app/homebrew-starcat"><img src="https://img.shields.io/badge/Install%20with-Homebrew-FBBF24?style=for-the-badge&logo=homebrew&logoColor=white" width="220" alt="Install with Homebrew"/></a>
<br/>
<sub><a href="./README-ZH.md">中文说明</a></sub>
</div>

<div align="center">
<a href="https://starcat.ink"><img src="https://img.shields.io/badge/website-starcat.ink-38BDF8?style=flat&color=blue" alt="website"/></a>
<a href="https://github.com/starcat-app/starcat-pro"><img src="https://img.shields.io/badge/support-starcat--pro-lightgrey.svg?style=flat&color=blue" alt="support"/></a>
<a href="https://github.com/starcat-app/homebrew-starcat"><img src="https://img.shields.io/badge/install-homebrew-lightgrey.svg?style=flat&color=blue" alt="homebrew"/></a>
<a href="https://github.com/starcat-app/starcat-localization"><img src="https://img.shields.io/badge/localization-open-lightgrey.svg?style=flat&color=blue" alt="localization"/></a>
</div>

<div align="center">
<img width="900" src="https://raw.githubusercontent.com/starcat-app/starcat-pro/main/main.webp" alt="Starcat main window"/>
</div>

**Preferred install method:**

```bash
brew tap starcat-app/starcat
brew trust starcat-app/starcat
brew install --cask starcat
```

**Useful links:**

- Home and downloads: https://starcat.ink
- Public support and release notes: https://github.com/starcat-app/starcat-pro
- Starcat App Homebrew tap: https://github.com/starcat-app/homebrew-starcat
- CLI / MCP: [starcat-cli](https://github.com/starcat-app/starcat-cli) / [Homebrew tap](https://github.com/starcat-app/homebrew-starcat-cli)
- AI Agent Skill: https://github.com/starcat-app/starcat-skill
- Browser plugins: [Chrome](https://github.com/starcat-app/starcat-chrome-plugin) / [Safari](https://github.com/starcat-app/starcat-safari-plugin)
- Documentation: https://github.com/starcat-app/starcat-docs
- Website source: https://github.com/starcat-app/starcat-site
- Localization: https://github.com/starcat-app/starcat-localization

**Self-hostable support APIs:**

- [starcat-sharing-api](https://github.com/starcat-app/starcat-sharing-api)
- [starcat-trending-api](https://github.com/starcat-app/starcat-trending-api)
- [starcat-weekly-api](https://github.com/starcat-app/starcat-weekly-api)
- [starcat-wiki-api](https://github.com/starcat-app/starcat-wiki-api)
- [starcat-recommend-api](https://github.com/starcat-app/starcat-recommend-api)
- [starcat-discovery-api](https://github.com/starcat-app/starcat-discovery-api)
<!-- starcat-promo:end -->

Starcat Chrome Plugin enhances GitHub repository pages and Google search results with context already stored in Starcat. It can show local Starcat entry points and Health information for starred GitHub repositories without directly accessing the GitHub API, Starcat backends, OpenSSF, or an AI provider.

## Features

- Show similar repository recommendations on GitHub repository pages.
- Link to known Wiki providers.
- Read and save private Starcat notes.
- Display Health and OpenSSF scores cached by Starcat.
- Trigger CodeFlow and Codebase actions in the Starcat app.
- Add `Open in Starcat` and Health badges to starred GitHub repositories in Google search results.

## Load Locally

1. Open `chrome://extensions/` in Chrome.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select `supports/extensions/starcat-chrome-plugin`.
5. In Starcat, open Settings → Integrations → Browser Plugin and enable the service. Then open Settings → Integrations → Local API Key and copy the key.
6. Left-click the Starcat toolbar icon and enter the endpoint port and Local API Key in the popup.
7. Click Test.

The full configuration page remains available through Open full options in the popup.

## Communication Boundary

The extension communicates only with the local HTTP service exposed by the Starcat app:

```text
http://127.0.0.1:{port}/plugin/v1
```

Every business request requires:

```text
Authorization: Bearer <local-api-key>
```

The Starcat Local API Key authorizes only the local loopback interface. It is not a GitHub token, AI key, or Starcat backend API key.

## Repository Layout

| Path | Purpose |
|---|---|
| `manifest.json` | Chrome MV3 entry manifest. |
| `LICENSE` | Open-source license. |
| `PRIVACY.md` | Privacy and data-boundary documentation. |
| `SECURITY.md` | Security boundaries and vulnerability reporting. |
| `CONTRIBUTING.md` | Local development and contribution guidelines. |
| `CHANGELOG.md` | Version history. |
| `src/shared/shared.js` | Configuration storage, GitHub repository URL parsing, and local API client. |
| `src/popup/` | Quick-pairing popup shown when the toolbar icon is left-clicked. |
| `src/options/` | Endpoint port, Local API Key, and connection testing. |
| `src/content/` | Page injection and rendering for GitHub repositories and Google search results. |
| `docs/` | Store submission materials, privacy disclosures, review notes, and asset requirements. |

## Release Materials

Read [docs/README.md](docs/README.md) before preparing a store release. The documents follow the current source behavior, especially the permissions used on Google search pages, Local API Key pairing, and the local Companion API data boundary.

## Validation

```bash
python3 -m json.tool supports/extensions/starcat-chrome-plugin/manifest.json >/dev/null
node --check supports/extensions/starcat-chrome-plugin/src/shared/shared.js
node --check supports/extensions/starcat-chrome-plugin/src/popup/popup.js
node --check supports/extensions/starcat-chrome-plugin/src/options/options.js
node --check supports/extensions/starcat-chrome-plugin/src/content/content-script.js
```
