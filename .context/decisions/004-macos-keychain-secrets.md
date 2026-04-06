# ADR-004: macOS Keychain for Secret Storage

**Status:** Accepted
**Date:** 2026-04-05
**Version:** 1.0

## Context

The app stores sensitive credentials: Discord bot token, OpenAI API key, and connector tokens. These must not be stored in plaintext config files.

## Decision

Use macOS Keychain (via the `security-framework` Rust crate) to securely store all API tokens and secrets. The keychain service name is the app identifier. Config files only store non-sensitive settings.

## Consequences

- **Positive:** OS-level encryption and access control for secrets
- **Positive:** Secrets survive app reinstalls if Keychain is preserved
- **Negative:** macOS-only — would need a different approach for Windows/Linux
- **Negative:** Keychain access may prompt for user permission on first use

## History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-05 | Initial decision |
