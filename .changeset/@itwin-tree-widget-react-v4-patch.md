---
"@itwin/tree-widget-react": patch
---

#### Search

- **Models and Categories tree search now finds categories nested beneath sub-models.** (PRs: [#1619](https://github.com/iTwin/viewer-components-react/pull/1619))

#### Visibility handling

- **Visibility changes propagate through the complete nested hierarchy.** Changing an ancestor's visibility updates all nested child elements and sub-models, and ancestor visibility states account for the contents of nested sub-models. (PRs: [#1558](https://github.com/iTwin/viewer-components-react/pull/1558), [#1589](https://github.com/iTwin/viewer-components-react/pull/1589))
- **Children assigned to a different category from their parent are handled correctly.** Parent visibility accounts for each descendant's actual category, and changing parent visibility applies the appropriate per-category overrides to those descendants. (PRs: [#1686](https://github.com/iTwin/viewer-components-react/pull/1686), [#1687](https://github.com/iTwin/viewer-components-react/pull/1687), [#1694](https://github.com/iTwin/viewer-components-react/pull/1694), [#1716](https://github.com/iTwin/viewer-components-react/pull/1716))
- **Sub-category visibility is independent of model and per-model category state.** Sub-category visibility is no longer affected by per-model category overrides or model visibility, enabling a sub-category no longer makes other categories visible when their elements belong to a hidden model, and tree icons refresh after a sub-category visibility change. (PRs: [#1535](https://github.com/iTwin/viewer-components-react/pull/1535), [#1552](https://github.com/iTwin/viewer-components-react/pull/1552), [#1559](https://github.com/iTwin/viewer-components-react/pull/1559))
- **Tree visibility reflects the active view and complete category contents.** Models and Classifications trees keep displaying hierarchy nodes outside a 3D view, but their visibility controls are disabled. Categories tree visibility always accounts for descendant elements and sub-categories, including when they are omitted from the configured hierarchy. (PRs: [#1401](https://github.com/iTwin/viewer-components-react/pull/1401), [#1403](https://github.com/iTwin/viewer-components-react/pull/1403))
- **Filtered trees only change the visibility of their represented nodes.** While search is active, showing or hiding a node no longer affects elements, categories, sub-categories, or sub-models outside the search-results tree. Reported visibility is likewise scoped to the descendants represented by the filtered tree. (PRs: [#1406](https://github.com/iTwin/viewer-components-react/pull/1406), [#1568](https://github.com/iTwin/viewer-components-react/pull/1568))
- **Visibility controls remain consistent during rapid interaction.** Repeated clicks no longer leave the visibility icon out of sync, child states update optimistically, and the Show all, Hide all, and Invert header actions cancel superseded visibility changes. (PRs: [#1650](https://github.com/iTwin/viewer-components-react/pull/1650), [#1651](https://github.com/iTwin/viewer-components-react/pull/1651), [#1657](https://github.com/iTwin/viewer-components-react/pull/1657))
- **Visibility buttons and header controls report the correct state.** Buttons remain available for hidden and partially visible nodes, unresolved nodes initially appear visible rather than hidden, unavailable actions are not rendered, Categories tree grouping nodes no longer remain in a Determining visibility state, and the 2D toggle is no longer permanently disabled. Tooltips describe the available Show, Hide, Disabled, or Determining visibility action. (PRs: [#1211](https://github.com/iTwin/viewer-components-react/pull/1211), [#1216](https://github.com/iTwin/viewer-components-react/pull/1216), [#1276](https://github.com/iTwin/viewer-components-react/pull/1276), [#1278](https://github.com/iTwin/viewer-components-react/pull/1278), [#1286](https://github.com/iTwin/viewer-components-react/pull/1286), [#1331](https://github.com/iTwin/viewer-components-react/pull/1331), [#1751](https://github.com/iTwin/viewer-components-react/pull/1751))
- **Visibility and category query errors are handled safely.** `CategoriesTreeComponent` no longer logs a "no current row" error while loading category data, interrupted visibility queries no longer crash the application, and transient element IDs are not sent to backend visibility queries. (PRs: [#1505](https://github.com/iTwin/viewer-components-react/pull/1505), [#1543](https://github.com/iTwin/viewer-components-react/pull/1543), [#1728](https://github.com/iTwin/viewer-components-react/pull/1728))

#### Hierarchies

- **Template models are no longer displayed.** Template models and their contents are excluded from Models, Categories, and Classifications tree hierarchies. Header buttons no longer affect their display. (PRs: [#1819](https://github.com/iTwin/viewer-components-react/pull/1819), [#1821](https://github.com/iTwin/viewer-components-react/pull/1821))

#### Loading and extensibility

- **Trees display an error message and Retry action when loading fails.** (PRs: [#1217](https://github.com/iTwin/viewer-components-react/pull/1217))
- **Visibility buttons expose their current state in the DOM.** The button element includes a `data-visibility-state` attribute for styling, testing, and inspection. (PRs: [#1788](https://github.com/iTwin/viewer-components-react/pull/1788))

### Performance improvements

v4 loads the Models tree significantly faster and keeps the UI responsive, with the largest gains in large iModels.

**What was improved**

- **Optimized queries.** The structure of queries that load hierarchies and determine visibility was improved, making them run more efficiently.
- **Less work on hot paths.** The most frequently executed code paths were identified and streamlined, so less work is done for each node and visibility change.
- **More caching.** More data is cached and reused, avoiding repeated queries and calculations.
- **Shorter UI blocking.** Long-running tasks were minimized so they no longer block the UI for long periods of time.

**Faster loading**

Load times were measured for the Models tree on more than 40 real-world iModels of various sizes, opened both locally and through a remote backend. Each iModel was loaded three times in both v3 and v4, and its fastest time was kept. _v3_ and _v4_ show the total of those times across all iModels, and negative values mean v4 is faster. _Worst slowdown_ and _Best improvement_ show the largest change for a single iModel.

_Initial view_: loading the nodes displayed when the tree first opens.

| Backend |     v3 |     v4 | Difference | Percentage | Worst slowdown | Best improvement |
| :------ | -----: | -----: | ---------: | ---------: | -------------: | ---------------: |
| Local   |  9.6 s |  4.3 s |     -5.3 s |    🟢 -55% |       +0.146 s |         -4.752 s |
| Remote  | 67.1 s | 64.6 s |     -2.5 s |     🟢 -4% |       +0.178 s |         -4.536 s |

_First branch_: expanding the first node at every level, from the root down to elements. _Faster iModels_ and _Slower iModels_ show how many iModels loaded faster or slower in v4.

| Backend |      v3 |      v4 | Difference | Percentage | Faster iModels | Slower iModels | Worst slowdown | Best improvement |
| :------ | ------: | ------: | ---------: | ---------: | -------------: | -------------: | -------------: | ---------------: |
| Local   |  73.1 s |  16.5 s |    -56.6 s |    🟢 -77% |        45 / 46 |         1 / 46 |       +0.003 s |         -8.102 s |
| Remote  | 200.8 s | 107.6 s |    -93.2 s |    🟢 -46% |        42 / 42 |         0 / 42 |           None |        -19.858 s |

**More responsive UI**

In v3, users could encounter the UI being blocked for 400 ms or more at a time while visibility was updated in large hierarchies, making the tree feel sluggish and unresponsive. In v4, the longest measured block is around 110 ms, and **the UI should never be blocked for long periods of time**.

The following PRs improve tree loading, visibility, and search performance:

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
[#1730](https://github.com/iTwin/viewer-components-react/pull/1730),
[#1731](https://github.com/iTwin/viewer-components-react/pull/1731),
[#1794](https://github.com/iTwin/viewer-components-react/pull/1794),
[#1799](https://github.com/iTwin/viewer-components-react/pull/1799),
[#1801](https://github.com/iTwin/viewer-components-react/pull/1801),
[#1804](https://github.com/iTwin/viewer-components-react/pull/1804), and
[#1847](https://github.com/iTwin/viewer-components-react/pull/1847).
