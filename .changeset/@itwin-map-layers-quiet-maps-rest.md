---
"@itwin/map-layers": minor
---

Added `MapLayerOptions.readOnly` to show the Map Layers widget in read-only mode, e.g. while the application is offline. Attached layers can still be shown, hidden and made transparent, but layers cannot be attached, detached, reordered or signed in to, and the base map provider and map settings cannot be changed. Base map visibility, transparency and color stay editable. Map layer sources are not loaded. Defaults to `false`, so existing consumers are not affected.

```tsx
<MapLayersWidget mapLayerOptions={{ readOnly: !isOnline }} />
```
