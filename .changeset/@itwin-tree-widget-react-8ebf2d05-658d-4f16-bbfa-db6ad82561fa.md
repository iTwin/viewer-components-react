---
"@itwin/tree-widget-react": major
---

Refactored localization to use new `LocalizationContextProvider` API. This is a breaking change as consumers will need to register localization namespaces instead of relying on `TreeWidget.initialize`. See example usage in `README.md`.
