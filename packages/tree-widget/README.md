# @itwin/tree-widget-react

Copyright © Bentley Systems, Incorporated. All rights reserved.

The tree-widget-react package provides React components to access Models and Categories within an iModel via a UiProvider, `TreeWidgetUiItemsProvider`.

The package also provides the underlying component, `TreeWidgetComponent`, which you can wrap within your own custom UiProvider and pass in your own custom trees to display.

## Usage

### What to add in your iTwin AppUI based application

With a few short lines, you can add the tree widget to your app.

#### Call TreeWidget.initialize() **_before_** making use of the provided Tree Widget Provider

```ts
import { TreeWidget } from "@itwin/tree-widget-react";
...
await TreeWidget.initialize(IModelApp.localization);
```

#### Register Tree Widget Provider

```ts
import { UiItemsManager } from "@itwin/appui-abstract";
import { TreeWidgetUiItemsProvider } from "@itwin/tree-widget-react";
...
UiItemsManager.register(
  new TreeWidgetUiItemsProvider({ ...TreeWidgetControlOptions })
);
```
