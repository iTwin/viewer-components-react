---
"@itwin/map-layers": minor
---

Added `MapLayerOptions.readOnly` to show the Map Layers widget without actions that change the map layer setup or need the network, e.g. while the application is offline.

```tsx
<MapLayersWidget mapLayerOptions={{ readOnly: !isOnline }} />
```
