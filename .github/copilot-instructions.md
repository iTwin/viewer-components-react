# Copilot Instructions

## Changesets

When creating a changeset, whether requested by a developer or initiated by AI:

- Follow [scripts/create-changeset.js](../scripts/create-changeset.js): use `.changeset/<prefix>-<unique-name>.md`, where the prefix is the exact `name` from the package's `package.json` (not its directory name) with `/` replaced by `-` (keep `@`), or `multi-package` for multiple packages. For example, `.changeset/@itwin-tree-widget-react-fix-selection.md` for `@itwin/tree-widget-react`, or `.changeset/multi-package-fix-selection.md` for a changeset affecting both `@itwin/property-grid-react` and `@itwin/map-layers`.
- List affected packages using their exact `package.json` names and release types (`patch`, `minor`, or `major`) in the YAML block at the top of each changeset file. Skip changesets when no release is needed; never create empty ones.
- Keep release notes concise and user-facing: explain what changed and why it matters. Omit internal implementation details, test results, and repetition.
- Include short code examples when they clarify new or changed usage, and migration steps for breaking changes. Keep snippets minimal, using fenced code blocks with a language tag.
