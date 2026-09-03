---
"@itwin/tree-widget-react": patch
---

#### Search

- **Models and Categories tree search now finds categories nested beneath sub-models.** ([#1619](https://github.com/iTwin/viewer-components-react/pull/1619))

#### Visibility handling

- **Visibility changes propagate through the complete nested hierarchy.** Changing an ancestor's visibility updates all nested child elements and sub-models, and ancestor visibility states account for the contents of nested sub-models. ([#1558](https://github.com/iTwin/viewer-components-react/pull/1558), [#1589](https://github.com/iTwin/viewer-components-react/pull/1589))
- **Children assigned to a different category from their parent are handled correctly.** Parent visibility accounts for each descendant's actual category, and changing parent visibility applies the appropriate per-category overrides to those descendants. ([#1686](https://github.com/iTwin/viewer-components-react/pull/1686), [#1687](https://github.com/iTwin/viewer-components-react/pull/1687), [#1694](https://github.com/iTwin/viewer-components-react/pull/1694), [#1716](https://github.com/iTwin/viewer-components-react/pull/1716))
- **Sub-category visibility is independent of model and per-model category state.** Sub-category visibility is no longer affected by per-model category overrides or model visibility, enabling a sub-category no longer makes other categories visible when their elements belong to a hidden model, and tree icons refresh after a sub-category visibility change. ([#1535](https://github.com/iTwin/viewer-components-react/pull/1535), [#1552](https://github.com/iTwin/viewer-components-react/pull/1552), [#1559](https://github.com/iTwin/viewer-components-react/pull/1559))
- **Tree visibility reflects the active view and complete category contents.** Models and Classifications trees display data and determine visibility only in 3D view. Categories tree visibility always accounts for descendant elements and sub-categories, including when they are omitted from the configured hierarchy. ([#1401](https://github.com/iTwin/viewer-components-react/pull/1401), [#1403](https://github.com/iTwin/viewer-components-react/pull/1403))
- **Filtered trees only change the visibility of their represented nodes.** While search is active, showing or hiding a node no longer affects elements, categories, sub-categories, or sub-models outside the search-results tree. Reported visibility is likewise scoped to the descendants represented by the filtered tree. ([#1406](https://github.com/iTwin/viewer-components-react/pull/1406), [#1568](https://github.com/iTwin/viewer-components-react/pull/1568))
- **Visibility controls remain consistent during rapid interaction.** Repeated clicks no longer leave the visibility icon out of sync, child states update optimistically, and the Show all, Hide all, and Invert header actions cancel superseded visibility changes. ([#1650](https://github.com/iTwin/viewer-components-react/pull/1650), [#1651](https://github.com/iTwin/viewer-components-react/pull/1651), [#1657](https://github.com/iTwin/viewer-components-react/pull/1657))
- **Visibility buttons and header controls report the correct state.** Buttons remain available for hidden and partially visible nodes, unresolved nodes initially appear visible rather than hidden, unavailable actions are not rendered, Categories tree grouping nodes no longer remain in a Determining visibility state, and the 2D toggle is no longer permanently disabled. Tooltips describe the available Show, Hide, Disabled, or Determining visibility action. ([#1211](https://github.com/iTwin/viewer-components-react/pull/1211), [#1216](https://github.com/iTwin/viewer-components-react/pull/1216), [#1276](https://github.com/iTwin/viewer-components-react/pull/1276), [#1278](https://github.com/iTwin/viewer-components-react/pull/1278), [#1286](https://github.com/iTwin/viewer-components-react/pull/1286), [#1331](https://github.com/iTwin/viewer-components-react/pull/1331), [#1751](https://github.com/iTwin/viewer-components-react/pull/1751))
- **Visibility and category query errors are handled safely.** `CategoriesTreeComponent` no longer logs a "no current row" error while loading category data, interrupted visibility queries no longer crash the application, and transient element IDs are not sent to backend visibility queries. ([#1505](https://github.com/iTwin/viewer-components-react/pull/1505), [#1543](https://github.com/iTwin/viewer-components-react/pull/1543), [#1728](https://github.com/iTwin/viewer-components-react/pull/1728))

#### Loading and extensibility

- **Trees display an error message and Retry action when loading fails.** ([#1217](https://github.com/iTwin/viewer-components-react/pull/1217))
- **Visibility buttons expose their current state in the DOM.** The button element includes a `data-visibility-state` attribute for styling, testing, and inspection. ([#1788](https://github.com/iTwin/viewer-components-react/pull/1788))

#### Performance improvements

The following PRs improve tree visibility and search performance:

[#1280](https://github.com/iTwin/viewer-components-react/pull/1280),
[#1492](https://github.com/iTwin/viewer-components-react/pull/1492),
[#1527](https://github.com/iTwin/viewer-components-react/pull/1527),
[#1532](https://github.com/iTwin/viewer-components-react/pull/1532),
[#1537](https://github.com/iTwin/viewer-components-react/pull/1537),
[#1571](https://github.com/iTwin/viewer-components-react/pull/1571),
[#1572](https://github.com/iTwin/viewer-components-react/pull/1572),
[#1578](https://github.com/iTwin/viewer-components-react/pull/1578),
[#1584](https://github.com/iTwin/viewer-components-react/pull/1584),
[#1586](https://github.com/iTwin/viewer-components-react/pull/1586),
[#1588](https://github.com/iTwin/viewer-components-react/pull/1588),
[#1593](https://github.com/iTwin/viewer-components-react/pull/1593),
[#1597](https://github.com/iTwin/viewer-components-react/pull/1597),
[#1599](https://github.com/iTwin/viewer-components-react/pull/1599),
[#1600](https://github.com/iTwin/viewer-components-react/pull/1600),
[#1610](https://github.com/iTwin/viewer-components-react/pull/1610),
[#1620](https://github.com/iTwin/viewer-components-react/pull/1620),
[#1629](https://github.com/iTwin/viewer-components-react/pull/1629),
[#1646](https://github.com/iTwin/viewer-components-react/pull/1646),
[#1652](https://github.com/iTwin/viewer-components-react/pull/1652),
[#1661](https://github.com/iTwin/viewer-components-react/pull/1661),
[#1662](https://github.com/iTwin/viewer-components-react/pull/1662),
[#1667](https://github.com/iTwin/viewer-components-react/pull/1667),
[#1673](https://github.com/iTwin/viewer-components-react/pull/1673),
[#1680](https://github.com/iTwin/viewer-components-react/pull/1680),
[#1681](https://github.com/iTwin/viewer-components-react/pull/1681),
[#1682](https://github.com/iTwin/viewer-components-react/pull/1682),
[#1726](https://github.com/iTwin/viewer-components-react/pull/1726),
[#1730](https://github.com/iTwin/viewer-components-react/pull/1730), and
[#1731](https://github.com/iTwin/viewer-components-react/pull/1731).
