# ADR-001: Tauri v2 as Desktop Framework

**Status:** Accepted
**Date:** 2026-04-05
**Version:** 1.0

## Context

The app needs to be a native desktop application with filesystem access, system tray, macOS LaunchAgent scheduling, and Keychain integration. Options considered: Electron, Tauri v1, Tauri v2, native Swift.

## Decision

Use Tauri v2 with a React/TypeScript frontend and Rust backend. Tauri v2 provides native system access (tray, dialog, notification, shell plugins), small binary size, and a Rust backend that can directly use macOS system APIs (Keychain via security-framework crate).

## Consequences

- **Positive:** Small app bundle (~10MB vs Electron's ~150MB), native performance, Rust backend enables secure Keychain access and efficient HTTP clients
- **Positive:** Tauri v2 plugin ecosystem (dialog, shell, notification, log) reduces boilerplate
- **Negative:** Rust backend has steeper learning curve than JS-only Electron
- **Negative:** Tauri v2 is newer, smaller community than Electron

## History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-05 | Initial decision |
