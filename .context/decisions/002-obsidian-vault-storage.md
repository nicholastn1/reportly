# ADR-002: Obsidian Vault as Report Storage

**Status:** Accepted
**Date:** 2026-04-05
**Version:** 1.0

## Context

Daily reports need persistent storage. Options: local SQLite database, custom file format, or Markdown files in an Obsidian vault.

## Decision

Store reports as Markdown files in a user-configured Obsidian vault, organized as `{vault}/{year}/{MonthName}/Daily Reports/Daily Report - DD.MM.YY.md`. This makes reports accessible and searchable within Obsidian, leveraging the user's existing knowledge management workflow.

## Consequences

- **Positive:** Reports are plain Markdown, portable, version-controllable, and editable outside the app
- **Positive:** Integrates naturally with Obsidian for linking, tagging, and searching
- **Positive:** No database to manage or migrate
- **Negative:** No structured querying — listing/searching requires filesystem traversal
- **Negative:** Vault path must be configured correctly; app cannot function without it

## History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-05 | Initial decision |
