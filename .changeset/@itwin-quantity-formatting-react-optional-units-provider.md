---
"@itwin/quantity-formatting-react": minor
---

`unitsProvider` is now optional on `QuantityFormatPanel`, `FormatPanel`, and `FormatSample`. When omitted, the components use `IModelApp.quantityFormatter.unitsProvider` (the bundled BIS units unless the app replaces it) and update when `IModelApp.quantityFormatter.onUnitsProviderChanged` fires.
