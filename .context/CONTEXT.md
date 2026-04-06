# Domain Context

## Overview

Reportly is a macOS desktop app for professionals who write daily work reports. It stores reports as Markdown files in an Obsidian vault, supports sending them to Discord channels, and can auto-generate report drafts by collecting activity from multiple work platforms (GitLab, GitHub, Jira, Confluence, Discord DMs) and summarizing them with OpenAI. The primary user is a developer/manager who tracks daily work across these platforms.

## Domain

### Core Entities

| Entity | Responsibility |
|--------|----------------|
| `Report` | A single daily report (Markdown file) identified by date (DD.MM.YY) |
| `AppConfig` | Persistent app configuration (vault path, Discord channel, schedule, connectors) |
| `DigestResult` | Output of AI digest: per-platform summaries + today's suggestions |
| `ConnectorsConfig` | Configuration for each data source (Discord read, GitLab, GitHub, Jira, Confluence) |
| `ScheduleConfig` | When to trigger report sending (days, time, auto vs. approval) |

### Modules/Packages

```
src/                        # React frontend
├── components/             # Reusable UI (editor, preview, sidebar, dialogs)
├── pages/                  # Route pages (Dashboard, Editor, Digest, History, Settings)
├── lib/                    # Shared utilities (tauri IPC wrappers, types, date helpers)
└── hooks/                  # Custom React hooks (currently empty)

src-tauri/src/              # Rust backend
├── commands/               # Tauri command handlers (IPC boundary)
├── connectors/             # Platform data collectors (gitlab, github, jira, etc.)
├── vault.rs                # Obsidian vault file I/O
├── config.rs               # App config persistence
├── discord.rs              # Discord message sending
├── keychain.rs             # macOS Keychain secret storage
├── digest.rs               # Multi-platform digest orchestration
├── openai.rs               # OpenAI API client
├── scheduler.rs            # macOS LaunchAgent management
└── claude_mcp.rs           # MCP server auto-detection
```

## Architecture

### System Overview

Reportly is a Tauri v2 desktop application with a React/TypeScript frontend and a Rust backend. The frontend communicates with the backend exclusively through Tauri's IPC `invoke` mechanism. The app follows a single-window design with a sidebar navigation pattern and macOS-native titlebar overlay. Data is stored as Markdown files in a user-specified Obsidian vault directory, with secrets in macOS Keychain and config in the app's data directory.

### Directory Structure

```
reportly/
├── src/                    # React frontend (TypeScript, Tailwind)
│   ├── components/         # Shared UI components (5 files)
│   ├── pages/              # Route-level page components (5 files)
│   ├── lib/                # IPC wrappers, types, date utils
│   ├── App.tsx             # Root component with routing and global event listeners
│   ├── main.tsx            # React entry point with BrowserRouter
│   └── styles.css          # CSS variables (dark theme) + Tailwind import
├── src-tauri/              # Rust backend (Tauri v2)
│   ├── src/                # All Rust source modules
│   │   ├── commands/       # Tauri IPC command handlers
│   │   └── connectors/     # Platform-specific data collectors
│   ├── icons/              # App icons (macOS, Windows, Android, iOS)
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri window/bundle config
├── assets/                 # Static assets (app icon source)
├── index.html              # Vite HTML entry point
├── package.json            # Frontend dependencies (pnpm)
├── tsconfig.json           # TypeScript config
└── vite.config.ts          # Vite + React + Tailwind plugin config
```

### Key Dependencies

| Category | Dependency | Purpose |
|----------|-----------|---------|
| Framework (FE) | React 19 | UI rendering |
| Framework (BE) | Tauri 2 | Desktop app shell, IPC, system tray |
| Bundler | Vite 6 | Frontend dev server and build |
| Styling | Tailwind CSS 4 | Utility-first CSS |
| Editor | CodeMirror 6 | Markdown code editor with syntax highlighting |
| Markdown | react-markdown + remark-gfm | Markdown preview rendering |
| Routing | react-router-dom 7 | Client-side page routing |
| HTTP (BE) | reqwest 0.12 | Discord API, OpenAI API calls |
| Secrets (BE) | security-framework 3 | macOS Keychain access |
| Async (BE) | tokio 1 | Async runtime for Rust |
| Time (BE) | chrono 0.4 | Date parsing and formatting |
| Serialization (BE) | serde + serde_json | Config and IPC data serialization |
| Plugins | tauri-plugin-dialog, shell, notification, log | Tauri platform plugins |

### Data Flow

```
User Action (React UI)
  → invoke("command_name", { args })  [Tauri IPC]
  → commands/*.rs handler             [Rust command layer]
  → domain module (vault/discord/digest/config)
  → External I/O (filesystem, Discord API, OpenAI API, Keychain, CLI tools)
  → Result serialized back to frontend

Scheduled Send:
  lib.rs scheduler thread (60s poll)
  → emit("trigger-send" | "auto-send")  [Tauri event]
  → App.tsx event listener
  → ApprovalDialog or auto-send via sendToDiscord()

Digest Flow:
  User clicks "Gerar Digest"
  → generate_digest command
  → connectors collect activity (Discord DMs, GitLab MRs, GitHub PRs, Jira issues, Confluence pages)
  → OpenAI summarizes each platform
  → OpenAI generates today's suggestions
  → Results displayed in Digest page
  → User clicks "Aplicar" → writes to next business day's report file
```

## Conventions

### Naming Patterns

- **TypeScript:** camelCase for variables/functions, PascalCase for components and types
- **Rust:** snake_case for functions/variables, PascalCase for types/structs
- **Files:** PascalCase for React components (`ReportEditor.tsx`), snake_case for Rust modules (`discord_reader.rs`)
- **Date format:** DD.MM.YY everywhere (e.g. `05.04.26`)

### Error Handling

- **Frontend:** try/catch around `invoke` calls, errors displayed as toast notifications
- **Backend:** `Result<T, String>` return types from Tauri commands, `map_err(|e| e.to_string())` pattern throughout

### Testing Style

No test framework is currently configured. No test files exist.

### Import Organization

- **TypeScript:** React hooks first, then react-router, then Tauri API, then local components, then local lib modules, then types
- **Rust:** `mod` declarations first, then `use` statements grouped by external crates then internal modules

### State Management

React `useState` + `useEffect` hooks per component. No global state management library. Each page manages its own state independently. Tauri backend is the source of truth.

### API Response Format

Not applicable — communication is via Tauri IPC `invoke` with typed Rust structs serialized as JSON.

## Main Flows

### Report Editing

```
1. User navigates to /editor or /editor/:date
2. Frontend calls getReport(date) → Rust reads Markdown file from vault
3. Content displayed in split pane: CodeMirror editor | Markdown preview
4. User edits → local state updates (dirty flag)
5. Save → saveReport(date, content) → Rust writes file to vault
6. Send → sendToDiscord(date) → Rust reads file, POSTs to Discord API
```

### AI Digest Generation

```
1. User opens Digest page, sees connector status badges
2. Clicks "Gerar Digest" with collection date
3. Backend collects activity from enabled connectors:
   - Discord: reads DMs via bot token
   - GitLab: runs glab CLI commands
   - GitHub: runs gh CLI commands
   - Jira/Confluence: calls MCP server endpoints
4. Each platform's raw data sent to OpenAI for summarization
5. OpenAI generates suggestions for today's planned work
6. Results shown with per-platform cards and editable suggestions
7. "Aplicar" writes combined content to next business day's report file
```

### Scheduled Sending

```
1. User configures schedule in Settings (days, time, auto vs. approval)
2. Save installs/updates macOS LaunchAgent
3. In-process scheduler thread polls every 60s
4. At scheduled time: emits "auto-send" or "trigger-send" event
5. auto-send: silently sends report to Discord
6. trigger-send: shows ApprovalDialog for user confirmation
```

## External Integrations

| System | Type | Description |
|--------|------|-------------|
| Discord | REST API (bot token) | Send daily reports as messages to a configured channel; read DMs for digest |
| OpenAI | REST API (API key) | Summarize platform activity and generate report suggestions |
| GitLab | CLI (`glab`) | Collect merge requests and activity via authenticated CLI |
| GitHub | CLI (`gh`) | Collect pull requests and activity via authenticated CLI |
| Jira | MCP Server | Collect issues and activity via Atlassian MCP |
| Confluence | MCP Server | Collect pages and activity via Atlassian MCP |
| macOS Keychain | Native API | Store API tokens and secrets securely |
| Obsidian Vault | Filesystem | Read/write daily report Markdown files |

## Glossary

| Term | Definition |
|------|------------|
| **Vault** | The Obsidian vault directory where report Markdown files are stored, organized by year/month |
| **Digest** | AI-generated summary of yesterday's activity across all enabled platforms |
| **Connector** | A data source integration (Discord, GitLab, GitHub, Jira, Confluence) that collects activity |
| **LaunchAgent** | macOS mechanism for scheduling the app to open and trigger report sending |
| **MCP** | Model Context Protocol — used for Jira/Confluence integration via Atlassian's MCP server |
