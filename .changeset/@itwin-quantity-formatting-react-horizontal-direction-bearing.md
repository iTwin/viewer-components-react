---
"@itwin/quantity-formatting-react": patch
---

Switching a horizontal-direction format (for example `Units.HORIZONTAL_DIR_ARC_DEG`) to bearing or azimuth now uses horizontal-direction revolution and base units. Previously it used angle units, which the formatter cannot convert to, so formatting failed.
