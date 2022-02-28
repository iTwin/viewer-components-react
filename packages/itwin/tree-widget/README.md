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

### Additional trees avaialable

#### IModelContentTree

Component that displays a hierarchy with content of a given `IModelConnection`.

##### Resulting hierarchy

- Root Subject
  - Child Subjects
    - Target Model
      - Spatial Categories of top-assemblies in the Model (if model is a GeometricModel3d)
        - Top-assemblies in the model and category
          - Child elements of the assembly
      - Drawing Categories of top-assemblies in the Model (if model is a GeometricModel2d)
        - Top-assemblies in the model and category
          - Child elements of the assembly
      - Top-assemblies in the Model (if model is neither GeometricModel3d nor GeometricModel2d)
        - Child elements of the assembly

In addition, for every modeled element we show content of the model as children for the element's node.

More details about Subjects and Models can be found here:

- <https://www.imodeljs.org/bis/intro/information-hierarchy/>
- <https://www.imodeljs.org/bis/intro/organizing-models-and-elements/>

More details about the hierarchy can be found in the [presentation ruleset JSON file](./src/components/rulesets/IModelContent.json).
