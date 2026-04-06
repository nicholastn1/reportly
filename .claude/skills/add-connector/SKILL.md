# Skill: Add a New Connector

## When to Use

When adding a new data source (platform) to the digest system.

## Steps

### 1. Create the Connector Module

Add a new file in `src-tauri/src/connectors/` (e.g., `slack.rs`):

- Implement an async function that collects activity for a given date
- Return raw text/data that can be summarized by OpenAI
- Follow the pattern of existing connectors (e.g., `gitlab.rs` for CLI-based, `jira.rs` for MCP-based)

### 2. Register in Connectors Module

Update `src-tauri/src/connectors/mod.rs` to export the new module.

### 3. Add Config Types

In `src-tauri/src/config.rs`:
- Add a new config struct (use `CliConnectorConfig` for CLI-based or `McpConnectorConfig` for MCP-based)
- Add the field to `ConnectorsConfig` with `#[serde(default)]`

### 4. Add to Digest Orchestration

In `src-tauri/src/digest.rs`:
- Add the new connector to the collection loop
- Follow the pattern: check if enabled → collect data → send to OpenAI for summarization

### 5. Add Keychain Support (if needed)

In `src-tauri/src/keychain.rs`:
- Add save/load functions for the new connector's token

### 6. Update Frontend Types

In `src/lib/types.ts`:
- Add the connector to `ConnectorsConfig` interface
- Add to `ConnectorsStatus` interface

### 7. Add Settings UI

In `src/pages/Settings.tsx`:
- Add a `ConnectorToggle` or `McpConnectorSection` block under the Conectores section
- Follow the existing pattern for similar connector types

### 8. Add Tauri Commands (if new IPC needed)

In `src-tauri/src/commands/`:
- Add any new commands and register them in `lib.rs` invoke_handler

## Checklist

- [ ] Connector module created in `src-tauri/src/connectors/`
- [ ] Config struct added with `#[serde(default)]`
- [ ] Digest orchestration updated
- [ ] Frontend types updated
- [ ] Settings UI added
- [ ] Platform icon added to `Digest.tsx` PLATFORM_ICONS
