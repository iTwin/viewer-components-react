# @itwin/tree-widget-react

Copyright © Bentley Systems, Incorporated. All rights reserved.

The `@itwin/tree-widget-react` package provides React components to build a widget with tree components' selector, along with all the building blocks that can be used individually.

![Widget example](./media/widget.png)

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
import { TreeWidgetUiItemsProvider, ModelsTreeComponent } from "@itwin/tree-widget-react";
...
UiItemsManager.register(
  new TreeWidgetUiItemsProvider({
    // defaults to `StagePanelLocation.Right`
    defaultPanelLocation: StagePanelLocation.Left,
    // defaults to `StagePanelSection.Start`
    defaultPanelSection: StagePanelSection.End,
    // defaults to whatever the default `Widget.priority` in AppUI is
    defaultTreeWidgetPriority: 1000,
    // defaults to `ModelsTreeComponent` and `CategoriesTreeComponent`
    trees: [{
        id: ModelsTreeComponent.id,
        getLabel: ModelsTreeComponent.getLabel,
        render: () => <ModelsTreeComponent />,
    }, {
        id: "my-tree-id",
        getLabel: "My Custom Tree",
        render: () => <>This is my custom tree.</>,
    }];
  })
);
```

As seen in the above code snippet, `TreeWidgetUiItemsProvider` takes a list of trees that are displayed in the widget. This package delivers a number of tree components for everyone's use (see below), but providing custom trees is also an option.

## Components

While we expect this package to be mostly used with [AppUI](https://github.com/iTwin/appui/tree/master/ui/appui-react) and widget created through `TreeWidgetUiItemsProvider`, the package delivers components used within the widget to meet other use cases:

- `SelectableTree` renders a tree selector and selected tree (based on the `trees` prop).

- Visibility tree components help you build trees that look and feel like [Models](#models-tree) and [Categories](#categories-tree) trees, letting you control display of elements in the hierarchy.

  - `createVisibilityTreeRenderer` returns a tree renderer that renders nodes with "eye" checkboxes. Its building blocks:
    - `createVisibilityTreeNodeRenderer`
    - `VisibilityTreeNodeCheckbox`
  - `useVisibilityTreeFiltering` is used to filter the hierarchy.
  - `VisibilityTreeNoFilteredData` is used to render a "no results" when filtering.
  - `VisibilityTreeEventHandler` is an extension of [UnifiedSelectionTreeEventHandler](https://www.itwinjs.org/reference/presentation-components/tree/unifiedselectiontreeeventhandler/), that additionally handles checkbox events and calls provided `IVisibilityHandler` to get/set display of the elements in the hierarchy.
  - `useTreeTransientState` is used to persist tree scroll position when tree is used in [AppUI](https://github.com/iTwin/appui/tree/master/ui/appui-react) widget.

### Models tree

The component renders a tree that tries to replicate how a typical "Models" tree of the iModel would look like in the source application. There's also a header that renders models search box and various visibility control buttons.

![Models tree example](./media/models-tree.png)

Typical usage:

```tsx
import { ModelsTreeComponent, ClassGroupingOption } from "@itwin/tree-widget-react";
import { SelectionMode } from "@itwin/components-react";
...
function MyWidget() {
  return (
    <ModelsTreeComponent
      headerButtons={[
        (props) => <ModelsTreeComponent.ShowAllButton {...props} />,
        (props) => <ModelsTreeComponent.HideAllButton {...props} />,
        (props) => <MyCustomButton />,
      ]}
      selectionMode={SelectionMode.Extended}
      hierarchyConfig={{
        enableElementsClassGrouping: ClassGroupingOption.Yes,
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

`ModelsTreeComponent` building blocks:

- `ModelsTree` renders the tree without the header.
- `ModelsVisibilityHandler` knows how to get and control display of various concepts displayed in the Models tree: Subjects, Models, Categories, Elements.

### Categories tree

The component, based on the active view, renders a hierarchy of either spatial (3d) or drawing (2d) categories. The hierarchy consists of two levels - the category (spatial or drawing) and its sub-categories. There's also a header that renders categories search box and various visibility control buttons.

![Categories tree example](./media/categories-tree.png)

Typical usage:

```tsx
import { CategoriesTreeComponent } from "@itwin/tree-widget-react";
...
function MyWidget() {
  return (
    <CategoriesTreeComponent
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

`CategoriesTreeComponent` building blocks:

- `CategoryTree` renders the tree without the header.
- `CategoryVisibilityHandler` knows how to get and control display of Categories and SubCategories.

### IModel content tree

The component renders a similar hierarchy to [Models tree](#models-tree), but with the following changes:

- Only the hierarchy, without a header is rendered.
- Visibility control is not allowed.
- There's less hiding of `Subject` and `Model` nodes.
- Show not only geometric, but all Models.

In general, the component is expected to be used by advanced users to inspect contents of the iModel.

![IModel content tree example](./media/imodel-content-tree.png)

Typical usage:

```tsx
import { IModelContentTreeComponent } from "@itwin/tree-widget-react";
...
function MyWidget() {
  return (
    <IModelContentTreeComponent />
  );
}
```
