---
"@itwin/tree-widget-react": minor
---

#### Search and loading

- **Built-in widget-header search.** Search can be enabled per tree with `TreeDefinition.isSearchable`, and the debounced value is delivered through `searchText`. The UI includes no-results, too-many-results, and instance-focus warning states. ([#1186](https://github.com/iTwin/viewer-components-react/pull/1186), [#1235](https://github.com/iTwin/viewer-components-react/pull/1235), [#1240](https://github.com/iTwin/viewer-components-react/pull/1240), [#1289](https://github.com/iTwin/viewer-components-react/pull/1289))
- **Loading placeholders for built-in and custom trees.** Trees show skeletons during initial loading and search, the widget header has a loading state, and the exported `SkeletonTree` lets custom trees use the same placeholder. ([#1252](https://github.com/iTwin/viewer-components-react/pull/1252), [#1299](https://github.com/iTwin/viewer-components-react/pull/1299), [#1504](https://github.com/iTwin/viewer-components-react/pull/1504))
- **Categories trees can search for elements by ID.** ([#1710](https://github.com/iTwin/viewer-components-react/pull/1710))
- **Search result limits are configurable.** `useCategoriesTree`, `useModelsTree`, and `useClassificationsTree` accept `searchLimit` as a number or `"unbounded"`. Searches supplied to `useClassificationsTreeDefinition` support the same values through `search.limit`. ([#1636](https://github.com/iTwin/viewer-components-react/pull/1636))

#### Customization

- **Standard tree nodes can be identified through exported helpers.** The `ModelsTreeNode`, `CategoriesTreeNode`, and `ClassificationsTreeNode` namespaces provide type guards for individual node types and a `getType` helper for identifying any supported type from node metadata. ([#1548](https://github.com/iTwin/viewer-components-react/pull/1548), [#1742](https://github.com/iTwin/viewer-components-react/pull/1742))
- **Tree renderers expose the underlying StrataKit tree props.** Applications can pass supported props through exported renderers to customize the underlying `Tree.Root` and `Tree.Item` elements. ([#1540](https://github.com/iTwin/viewer-components-react/pull/1540))
- **Building blocks for custom node actions and icons are exported.** `TreeActionBase` and `TreeActionBaseAttributes` define custom actions, `TreeNodeRenameAction`, `TreeNodeFilterAction`, and `VisibilityAction` provide the standard ones, and `ModelsTreeIcon`, `CategoriesTreeIcon`, `ClassificationsTreeIcon`, `IModelContentTreeIcon`, and `ExternalSourcesTreeIcon` render the standard node icons. ([#1534](https://github.com/iTwin/viewer-components-react/pull/1534), [#1557](https://github.com/iTwin/viewer-components-react/pull/1557))

#### Hierarchies

- **Configurable Categories tree hierarchy.** The new `hierarchyConfig` prop controls which nodes are included in a Categories tree:

  - `elements.nodes` includes or excludes element nodes. Element nodes are excluded by default.
  - `elements.excludedClasses` omits elements whose class is, or derives from, one of the supplied EC class names. Descendants of omitted elements are also omitted from the hierarchy. This option is available when `elements.nodes` is `"include"`.
  - `categories.withoutElements` includes or excludes categories that contain no elements. Empty categories are excluded by default.
  - `subCategories.nodes` includes or excludes sub-category nodes. Sub-category nodes are included by default.

  Excluding elements changes only the hierarchy: those elements may still be rendered in the viewport. The visibility handler therefore accounts for omitted elements when calculating ancestor state and updates omitted descendants when an ancestor's visibility changes. ([#1247](https://github.com/iTwin/viewer-components-react/pull/1247), [#1265](https://github.com/iTwin/viewer-components-react/pull/1265), [#1735](https://github.com/iTwin/viewer-components-react/pull/1735), [#1738](https://github.com/iTwin/viewer-components-react/pull/1738))

- **Models tree hierarchies can exclude element classes.** Set `hierarchyConfig.elements.excludedClasses` to omit elements whose class is, or derives from, one of the supplied EC class names. Descendants of an omitted element are omitted from the hierarchy as well. ([#1735](https://github.com/iTwin/viewer-components-react/pull/1735))
- **New Classifications tree.** v4 introduces a complete Classifications tree for displaying classification tables, classifications, and the 3D geometric elements assigned to them:

  - `ClassificationsTreeComponent` provides the ready-to-use tree with selection, visibility controls, node actions, label editing, and search.
  - `hierarchyConfig.rootClassificationSystemCode` selects the classification system to display, while `hierarchyConfig.elements.excludedClasses` omits specified element classes and their subclasses.
  - Search supports labels, classification or element instance keys, and element IDs, with a configurable or unbounded result limit.
  - Classification visibility is controlled through associated categories. `visibilityHandlerConfig.classificationToCategoriesRelationshipSpecification` can specify a custom classification-to-category relationship.
  - `useClassificationsTree` exposes the building blocks for custom rendering. `useClassificationsTreeDefinition` exposes the hierarchy definition for fully custom trees, can operate on one or multiple versions of an iModel, and reports matching paths through `onSearchPathsChanged`.
  - The Classifications tree and its related APIs are available as `@beta`.

  ([#1331](https://github.com/iTwin/viewer-components-react/pull/1331), [#1334](https://github.com/iTwin/viewer-components-react/pull/1334), [#1342](https://github.com/iTwin/viewer-components-react/pull/1342), [#1361](https://github.com/iTwin/viewer-components-react/pull/1361), [#1380](https://github.com/iTwin/viewer-components-react/pull/1380), [#1524](https://github.com/iTwin/viewer-components-react/pull/1524), [#1529](https://github.com/iTwin/viewer-components-react/pull/1529), [#1536](https://github.com/iTwin/viewer-components-react/pull/1536), [#1579](https://github.com/iTwin/viewer-components-react/pull/1579), [#1610](https://github.com/iTwin/viewer-components-react/pull/1610), [#1626](https://github.com/iTwin/viewer-components-react/pull/1626), [#1710](https://github.com/iTwin/viewer-components-react/pull/1710), [#1790](https://github.com/iTwin/viewer-components-react/pull/1790))
