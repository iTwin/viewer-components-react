---
"@itwin/quantity-formatting-react": patch
---

Format trait checkboxes such as "Show unit label" now recognize persisted traits regardless of casing (for example `ShowUnitLabel`), and toggling a trait removes every casing variant instead of leaving duplicates behind.
