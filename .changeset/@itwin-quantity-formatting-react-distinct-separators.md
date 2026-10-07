---
"@itwin/quantity-formatting-react": patch
---

The decimal and thousands separators can no longer both be set to the same character while the thousands separator is enabled. Enabling it, or changing either separator while it is enabled, switches the other separator when they collide. Unset separators are compared using the formatter's locale defaults.
