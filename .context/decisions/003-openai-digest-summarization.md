# ADR-003: OpenAI for Digest Summarization

**Status:** Accepted
**Date:** 2026-04-05
**Version:** 1.0

## Context

The digest feature collects raw activity data from multiple platforms (Discord, GitLab, GitHub, Jira, Confluence). This data needs to be summarized into concise report sections. Options: manual summarization, local LLM, or cloud LLM API.

## Decision

Use OpenAI's API (gpt-4o-mini default, configurable) to summarize each platform's raw activity and generate suggestions for today's planned work. The API is called from the Rust backend via reqwest.

## Consequences

- **Positive:** High-quality summaries with minimal prompt engineering
- **Positive:** User can choose model (gpt-4o-mini for cost, gpt-4o for quality)
- **Negative:** Requires OpenAI API key and internet connection
- **Negative:** Per-use cost (displayed to user as token count + cost per digest)
- **Negative:** Work activity data is sent to OpenAI's API

## History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-05 | Initial decision |
