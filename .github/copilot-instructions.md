# Copilot Instructions

## Changesets

When creating a changeset, whether requested by a developer or initiated by AI:

- Follow [scripts/create-changeset.js](../scripts/create-changeset.js): use `.changeset/<prefix>-<unique-name>.md`, where the prefix is the package name with `/` replaced by `-` (keep `@`), or `multi-package` for multiple packages.
- List affected packages and release types (`patch`, `minor`, or `major`) in the YAML block at the top of each changeset file. Skip changesets when no release is needed; never create empty ones.
- Keep release notes concise and user-facing: explain what changed and why it matters. Omit internal implementation details, test results, and repetition.
- Include short code examples when they clarify new or changed usage, and migration steps for breaking changes. Keep snippets minimal, using fenced code blocks with a language tag.
