# reportly

> Tauri v2 desktop app for writing, managing, and sending daily reports to Discord — with AI-powered digest from multiple work platforms (GitLab, GitHub, Jira, Confluence, Discord DMs).

## Decision Compliance

**IMPORTANT:** Before implementing any change, check `.context/decisions/` for related ADRs.

If a requested change conflicts with an existing decision:
1. **Stop and inform the user** which ADR(s) would be affected
2. **Ask explicitly** if they want to:
   - Proceed and update the decision
   - Modify the approach to comply with existing decision
   - Cancel the change
3. **If updating a decision**, create a new version:
   - Change status to `Superseded by ADR-XXX`
   - Create new ADR with updated decision
   - Reference the previous ADR

## Stack

- **Frontend:** React 19, TypeScript 6, Vite 6, Tailwind CSS v4
- **Backend:** Rust (Tauri v2), reqwest, chrono, serde, tokio
- **Editor:** CodeMirror 6 (Markdown mode, One Dark theme)
- **Storage:** Markdown files in a user-configured Obsidian vault
- **AI:** OpenAI API (via Rust reqwest) for digest generation
- **Integrations:** Discord (send/read), GitLab (glab CLI), GitHub (gh CLI), Jira/Confluence (MCP)
- **Secrets:** macOS Keychain via security-framework crate
- **Package manager:** pnpm 10

## Commands

```bash
# Development (frontend + Tauri)
pnpm tauri dev

# Frontend only
pnpm dev

# Build
pnpm tauri build

# Type check + frontend build
pnpm build
```

## Critical Rules

1. **Always ask before assuming** - When there is ambiguity, multiple valid approaches, or decisions to be made, use the AskUserQuestion tool to clarify before proceeding. Never assume user intent.
2. **Date format is DD.MM.YY** - All dates use this format (e.g. `05.04.26`). The vault path structure is `{vault}/{year}/{MonthName}/Daily Reports/Daily Report - DD.MM.YY.md`.
3. **UI text is in Portuguese (pt-BR)** - All user-facing strings (buttons, labels, toasts) are in Portuguese. Keep this consistent.
4. **Dark theme only** - The app uses CSS custom properties (`--bg-primary`, `--accent`, etc.) defined in `styles.css`. No light mode.
5. **Secrets go to Keychain** - Never store API keys or tokens in config files. Use the `keychain.rs` module which wraps macOS Keychain.

## Architecture

### Frontend (React + Tauri IPC)

Pages: Dashboard, ReportEditor (split-pane Markdown editor + preview), Digest (AI-powered), ReportHistory, Settings. All Tauri commands are wrapped in `src/lib/tauri.ts` as typed functions using `invoke`.

### Backend (Rust)

Modules: `vault.rs` (Obsidian file I/O), `discord.rs` (send via bot token), `config.rs` (app config JSON), `keychain.rs` (macOS Keychain), `digest.rs` (multi-platform collection + OpenAI summarization), `scheduler.rs` (in-process 60s poll + macOS LaunchAgent), `connectors/` (GitLab, GitHub, Jira, Confluence, Discord reader), `openai.rs` (API client).

## Efficiency Rules

- **Read before changing** — Always read a file before editing it. Never modify code based on assumptions about its content.
- **Follow existing patterns** — Before implementing something new, look at how similar things are done in the codebase. Match the existing style, conventions, and patterns.
- **Scope reads to the task** — Only read files directly relevant to the change. Do not explore broadly before acting on focused tasks.
- **Load context progressively** — Start with the minimum files needed. Only expand to related files when the current context is insufficient to complete the task.
- **Code only** — When implementing changes, output code. Skip explanations, preamble, and commentary unless the user asks for them.
- **Skip summaries** — After making changes, do not summarize what you did unless asked. Show `git diff` instead.
- **Run targeted tests** — After a change, run only tests related to the modified files. Only run the full suite when asked or before committing.
- **Never read generated files** — Do not read lock files, build output, vendored dependencies, or source maps. These are listed in `.claudeignore`.

## Compact Instructions

When compacting, preserve:
- Test results and error output
- File paths and code changes made
- Key decisions and their rationale

Remove:
- Exploratory file reads that did not lead to changes
- Verbose command output that has been summarized
- Discussion of rejected approaches

---

## Additional Context

- Domain and architecture → `.context/CONTEXT.md`
- Architectural decisions → `.context/decisions/`
- Task-specific skills → `.claude/skills/`
- Bug reproduction guide → `.claude/skills/bug-reproduction/SKILL.md`
- Batch operations guide → `.claude/skills/batch-operations/SKILL.md`
- Git platform detection → `.claude/skills/git-platform/SKILL.md`
