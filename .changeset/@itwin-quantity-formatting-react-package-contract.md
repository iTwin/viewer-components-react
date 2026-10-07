---
"@itwin/quantity-formatting-react": minor
---

Add `@itwin/core-common` and `@itwin/ecschema-metadata` as peer dependencies, since public types already reference them. Export the props types of all public components. `QuantityFormatting.startup` now shares a single in-flight initialization, and reading `QuantityFormatting.localization` before startup throws a descriptive error.
