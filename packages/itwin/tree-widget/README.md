# @itwin/tree-widget-react

Copyright © Bentley Systems, Incorporated. All rights reserved.

The `@itwin/tree-widget-react` package provides React components to build a widget with tree components' selector, along with all the building blocks that can be used individually.

![Widget example](./media/widget.png)

## 3.0 highlights

The new `3.0` version of the package contains a few notable changes, compared to the previous `2.x` generation.

- The underlying engine for building hierarchies has been changed from `@itwin/presentation-components` to `@itwin/presentation-hierarchies-react`. This is a significant change as the new library runs plain ECSQL queries and handles hierarchy creation on the frontend, as opposed to the previous version that relied on the backend to provide hierarchy data. This change allows this package to use more optimal queries and to be more flexible in terms of hierarchy creation.

- The tree components delivered with the package have been updated to use the [`Tree` component from `@itwin/itwinui-react` package](https://itwinui.bentley.com/docs/tree) instead of `ControlledTree` from `@itwin/components-react`. The new component is a little less dense, provides better accessibility and customization options.

  | 2.x                                             | 3.0                                             |
  | ----------------------------------------------- | ----------------------------------------------- |
  | ![Tree widget 2.x](./media/tree-widget-2.x.png) | ![Tree widget 3.0](./media/tree-widget-3.0.png) |

- The tree components now have hierarchy level [size limiting](#hierarchy-level-size-limiting) and [filtering](#hierarchy-level-filtering) features always turned on. The features were already available in `2.x` versions, but were not enabled by default.

- Models tree:
  - The label filtering feature has been expanded to filter not only up to Models, but the whole hierarchy. This allows filtering the hierarchy to additionally find Category or Element nodes.
  - [Focus mode](#focus-mode) feature has been added to allow automatic hierarchy filtering as the application selection changes.
  - Display states' control has been modified to be hierarchy based. This means changing display state of something deep in the hierarchy affects checkbox state of all its ancestors. And vice versa - changing display state of an ancestor affects all its descendants.

## Usage

Typically, the package is used with an [AppUI](https://github.com/iTwin/appui/tree/master/ui/appui-react) based application, but the building blocks may as well be used with any other iTwin.js React app.

In any case, **before** using any APIs or components delivered with the package, it needs to be initialized:

```ts
import { IModelApp } from "@itwin/core-frontend";
import { TreeWidget } from "@itwin/tree-widget-react";
...
await TreeWidget.initialize(IModelApp.localization);
```

In [AppUI](https://github.com/iTwin/appui/tree/master/ui/appui-react) based applications widgets are typically provided using `UiItemsProvider` implementations. The `@itwin/tree-widget-react` package delivers `TreeWidgetUiItemsProvider` that can be used to add the tree widget to UI:

```ts
import { UiItemsManager } from "@itwin/appui-react";
import { TreeWidgetUiItemsProvider } from "@itwin/tree-widget-react";
...
UiItemsManager.register(
  new TreeWidgetUiItemsProvider()
);
```

The above example uses default widget parameters and results in a component similar to the one visible at the top of this README. Customization is also possible:

```ts
import { UiItemsManager } from "@itwin/appui-react";
import { TreeWidgetUiItemsProvider, TreeWidgetId, ModelsTreeComponent } from "@itwin/tree-widget-react";
...
UiItemsManager.register(
  new TreeWidgetUiItemsProvider({
    // defaults to `StagePanelLocation.Right`
    defaultPanelLocation: StagePanelLocation.Left,
    // defaults to `StagePanelSection.Start`
    defaultPanelSection: StagePanelSection.End,
    // defaults to whatever the default `Widget.priority` in AppUI is
    defaultTreeWidgetPriority: 1000,
    // defaults to more dense "default" value
    density: "enlarged",
    // optional performance and feature telemetry reporting
    onPerformanceMeasured: (feature, elapsedTime) => logPerformance(`${TreeWidgetId}: ${feature}`, elapsedTime),
    onFeatureUsed: (feature) => logFeatureUsage(`${TreeWidgetId}: ${feature}`),
    // defaults to `ModelsTreeComponent` and `CategoriesTreeComponent`
    trees: [{
        id: ModelsTreeComponent.id,
        getLabel: ModelsTreeComponent.getLabel,
        render: () => <ModelsTreeComponent />,
    }, {
        id: "my-tree-id",
        getLabel: "My Custom Tree",
        render: () => <>This is my custom tree.</>,
        startIcon: <MyTreeIcon />;
    }];
  })
);
```

As seen in the above code snippet, `TreeWidgetUiItemsProvider` takes a list of trees that are displayed in the widget. This package delivers a number of tree components for everyone's use (see below), but providing custom trees is also an option.

## Components

While we expect this package to be mostly used with [AppUI](https://github.com/iTwin/appui/tree/master/ui/appui-react) and widget created through `TreeWidgetUiItemsProvider`, the package delivers components used within the widget to meet other use cases:

### Selectable tree

`SelectableTree` renders a tree selector and selected tree, based on the `trees` prop. Each tree definition contains a label, an optional icon and a render function that renders the component.

### Models tree

The component renders a tree that tries to replicate how a typical "Models" tree of the iModel would look like in the source application. There's also a header that renders models search box and various visibility control buttons.

![Models tree example](./media/models-tree.png)

Typical usage:

```tsx
import { IModelConnection } from "@itwin/core-frontend";
import { SchemaContext } from "@itwin/ecschema-metadata";
import { createStorage } from "@itwin/unified-selection";
import { StatelessModelsTreeComponent, ModelsTreeComponent } from "@itwin/tree-widget-react";

const unifiedSelectionStorage = createStorage();
IModelConnection.onClose.addListener((imodel) => {
  unifiedSelectionStorage.clearStorage({ imodelKey: imodel.key });
});

function getSchemaContext(imodel: IModelConnection): SchemaContext {
  // return cached schema context for the iModel
}

function MyWidget() {
  return (
    <StatelessModelsTreeComponent
      getSchemaContext={getSchemaContext}
      selectionStorage={unifiedSelectionStorage}
      headerButtons={[
        (props) => <ModelsTreeComponent.ShowAllButton {...props} />,
        (props) => <ModelsTreeComponent.HideAllButton {...props} />,
        (props) => <MyCustomButton />,
      ]}
      selectionMode={"extended"}
      hierarchyConfig={{
        elementClassGrouping: "enable",
      }}
    />
  );
}
```

Available header buttons:

- `ModelsTreeComponent.ShowAllButton` makes everything in the iModel displayed.
- `ModelsTreeComponent.HideAllButton` makes everything in the iModel hidden by turning off all models.
- `ModelsTreeComponent.InvertButton` inverts display of all models.
- `ModelsTreeComponent.View2DButton` toggles plan projection models' display.
- `ModelsTreeComponent.View3DButton` toggles non-plan projection models' display.

#### Focus mode

The Models tree can be used in a "focus mode" where the tree is automatically filtered to show only elements that are selected in the application. The mode can be controlled through a toggle button in the component's header. Since the feature is mutually exclusive with the "search" feature, enabling it automatically disables the search functionality.

![Models tree focus mode demo](./media/models-tree-focus-mode.gif)

### Categories tree

The component, based on the active view, renders a hierarchy of either spatial (3d) or drawing (2d) categories. The hierarchy consists of two levels - the category (spatial or drawing) and its sub-categories. There's also a header that renders categories search box and various visibility control buttons.

![Categories tree example](./media/categories-tree.png)

Typical usage:

```tsx
import { IModelConnection } from "@itwin/core-frontend";
import { SchemaContext } from "@itwin/ecschema-metadata";
import { createStorage } from "@itwin/unified-selection";
import { StatelessCategoriesTreeComponent, CategoriesTreeComponent } from "@itwin/tree-widget-react";

const unifiedSelectionStorage = createStorage();
IModelConnection.onClose.addListener((imodel) => {
  unifiedSelectionStorage.clearStorage({ imodelKey: imodel.key });
});

function getSchemaContext(imodel: IModelConnection): SchemaContext {
  // return cached schema context for the iModel
}

function MyWidget() {
  return (
    <CategoriesTreeComponent
      getSchemaContext={getSchemaContext}
      selectionStorage={unifiedSelectionStorage}
      headerButtons={[
        (props) => <CategoriesTreeComponent.ShowAllButton {...props} />,
        (props) => <CategoriesTreeComponent.HideAllButton {...props} />,
        (props) => <MyCustomButton />,
      ]}
    />
  );
}
```

Available header buttons:

- `ModelsTreeComponent.ShowAllButton` makes all categories and their subcategories displayed.
- `ModelsTreeComponent.HideAllButton` makes all categories hidden.
- `ModelsTreeComponent.InvertButton` inverts display of all categories.

### iModel content tree

The component renders a similar hierarchy to [Models tree](#models-tree), but with the following changes:

- Only the hierarchy, without a header is rendered.
- Visibility control is not allowed.
- There's less hiding of `Subject` and `Model` nodes.
- Show not only geometric, but all Models and Elements.

In general, the component is expected to be used by advanced users to inspect contents of the iModel.

![IModel content tree example](./media/imodel-content-tree.png)

Typical usage:

```tsx
import { IModelConnection } from "@itwin/core-frontend";
import { SchemaContext } from "@itwin/ecschema-metadata";
import { createStorage } from "@itwin/unified-selection";
import { StatelessIModelContentTreeComponent } from "@itwin/tree-widget-react";

const unifiedSelectionStorage = createStorage();
IModelConnection.onClose.addListener((imodel) => {
  unifiedSelectionStorage.clearStorage({ imodelKey: imodel.key });
});

function getSchemaContext(imodel: IModelConnection): SchemaContext {
  // return cached schema context for the iModel
}

function MyWidget() {
  return (
    <StatelessIModelContentTreeComponent
      getSchemaContext={getSchemaContext}
      selectionStorage={unifiedSelectionStorage}
    />
  );
}
```

### Hierarchy level size limiting

All tree components in this package enforce a hierarchy level size limit. This means that when a node is expanded, only a certain number of child nodes are loaded. The limit is enforced to prevent loading too many nodes at once and to keep the performance of the tree components at an acceptable level.

By default, the limit is set to `1000` nodes and components allow users to increase it to `10,000` for each hierarchy level individually:

![Hierarchy level size limit override example](./media/hierarchy-level-size-limit-override-example.gif)

### Hierarchy level filtering

All tree components in this package allow users to filter nodes at each hierarchy level. The filter is applied to a single hierarchy level, which allows users to reduce amount of nodes being loaded - this is especially useful when a [hierarchy level size limit](#hierarchy-level-size-limiting) is hit:

![Hierarchy level filtering example](./media/hierarchy-level-filtering-example.gif)

## Telemetry

### Performance tracking

Components from this package allows consumers to track performance of specific features.

This can be achieved by passing `onPerformanceMeasured` function to `CategoriesTreeComponent`, `ModelsTreeComponent`, `IModelContentTreeComponent` or `TreeWidgetUiItemsProvider`. The function is invoked with feature id and time elapsed as the component is being used. List of tracked features:

- `"{tree}-initial-load"` - time it takes to load initial nodes after the tree is created.
- `"{tree}-hierarchy-level-load"` - time it takes to load child nodes when a node is expanded.
- `"{tree}-reload"` - time it takes to reload the tree after data in the iModel changes or it's being reloaded due to filtering.

Where `{tree}` specifies which tree component the feature is of.

### Usage tracking

Components from this package allows consumers to track the usage of specific features.

This can be achieved by passing `onFeatureUsed` function to `CategoriesTreeComponent`, `ModelsTreeComponent`, `IModelContentTreeComponent` or `TreeWidgetUiItemsProvider`. The function is invoked with feature id as the component is being used. List of tracked features:

- `"choose-{tree}"` - when a tree is selected in the tree selector.
- `"use-{tree}"` - when an interaction with a tree hierarchy happens. This includes any kind of interaction with nodes, including them being expanded/collapsed, selected, filtered, their visibility change, etc.
- `"{tree}-visibility-change"` - when visibility is toggled using an "eye" button.
- `"models-tree-showall"` - when "Show All" button is used in `ModelsTreeComponent`.
- `"models-tree-hideall"` - when "Hide All" button is used in `ModelsTreeComponent`.
- `"models-tree-invert"` - when "Invert" button is used in `ModelsTreeComponent`.
- `"models-tree-view2d"` - when "Toggle 2D Views" button is used in `ModelsTreeComponent`.
- `"models-tree-view3d"` - when "Toggle 3D Views" button is used in `ModelsTreeComponent`.
- `"models-tree-zoom-to-node"` - when node is zoomed to in `ModelsTree`.
- `"models-tree-filtering"` - when a filter is applied in `ModelsTree`.
- `"models-tree-hierarchy-level-filtering"` - when a hierarchy level filter is applied in the `ModelsTree`.
- `"models-tree-hierarchy-level-size-limit-hit"` - when hierarchy level size limit is exceeded while loading nodes in the `ModelsTree`.
- `"categories-tree-showall"` - when "Show All" button is used in `CategoriesTreeComponent`.
- `"categories-tree-hideall"` - when "Hide All" button is used in `CategoriesTreeComponent`.
- `"categories-tree-invert"` - when "Invert" button is used in `CategoriesTreeComponent`.

Where `{tree}` specifies which tree component the feature is of.

### Example

```ts
import { UiItemsManager } from "@itwin/appui-react";
import { TreeWidgetUiItemsProvider } from "@itwin/tree-widget-react";

UiItemsManager.register(
  new TreeWidgetUiItemsProvider({
    onPerformanceMeasured={(feature, elapsedTime) => {
      telemetryClient.log(`TreeWidget [${feature}] took ${elapsedTime} ms`);
    }},
    onFeatureUsed={(feature) => {
      telemetryClient.log(`TreeWidget [${feature}] used`);
    }},
  })
);
```

For individual tree components the callbacks should be supplied through props:

```ts
import { StatelessModelsTreeComponent } from "@itwin/tree-widget-react";

function MyWidget() {
  return (
    <StatelessModelsTreeComponent
      {...otherProps}
      onPerformanceMeasured={(feature, elapsedTime) => {
        console.log(`TreeWidget [${feature}] took ${elapsedTime} ms`)
      }}
      onFeatureUsed={(feature) => {
        console.log(`TreeWidget [${feature}] used`)
      }}
    />
  );
}
```
