# @bentley/tree-widget-react

Copyright © Bentley Systems, Incorporated. All rights reserved.

The tree-widget-react package provides a controller class - `TreeWidgetControl` - which can be plugged into a 9-zone widget to
provide access to the following features:

- Spatial Containment Tree

- Models Tree

- Categories Tree

The package also provides the component which underlies `TreeWidgetControl` - `TreeWidgetComponent` - which you can wrap within your own custom widget controller and pass in your own custom trees to display.

## Sample usage

### TreeWidgetControl props

This is the data that can be passed in through the `applicationData` property on a 9-zone `<Widget>` element.

Note that `iModelConnection` is **required**

```ts
export interface TreeWidgetControlOptions {
  iModelConnection: IModelConnection;
  activeView?: Viewport;
  enablePreloading?: boolean;
  enableElementsClassGrouping?: boolean;
  allViewports?: boolean;
  additionalTrees?: SelectableContentDefinition[];
  additionalProps?: {
    modelsTree: {};
    categoriesTree: {};
    spatialTree: {};
  };
}
```

### Call TreeWidget.initialize() **_before_** making use of the provided widget controller

```ts
import { TreeWidget } from "@bentley/tree-widget-react";

async function myInitializationFunction() {
  await TreeWidget.initialize(IModelApp.i18n);
}
```

### Assign the TreeWidgetControl widget controller to a widget

```ts
<Widget
  id="VisibilityTree"
  defaultState={WidgetState.Closed}
  iconSpec="icon-hierarchy-tree"
  control={TreeWidgetControl}
  applicationData={{
    iModelConnection: iModelConnection,
  }}
/>
```

### Full frontstage example

```ts
import * as React from "react";
import {
  ConfigurableCreateInfo,
  ContentControl,
  ContentGroup,
  ContentLayoutDef,
  CoreTools,
  Frontstage,
  FrontstageProps,
  FrontstageProvider,
  UiFramework,
} from "@bentley/ui-framework";
import { TreeWidgetControl } from "@bentley/tree-widget-react";

export class TreeWidgetFrontstage extends FrontstageProvider {
  private _contentLayoutDef: ContentLayoutDef;

  constructor() {
    super();

    // Create the content layouts.
    this._contentLayoutDef = new ContentLayoutDef({});
  }

  public get frontstage(): React.ReactElement<FrontstageProps> {
    const contentGroup: ContentGroup = new ContentGroup({
      // Content group props
    });

    return (
      <Frontstage
        id="TreeWidget"
        defaultTool={CoreTools.selectElementCommand}
        defaultLayout={this._contentLayoutDef}
        contentGroup={contentGroup}
        isInFooterMode={false}
        centerRight={
          <Zone
            allowsMerging={true}
            widgets={TreeWidgetFrontstage.getCenterRightWidgets()}
          />
        }
      />
    );
  }

  public static getCenterRightWidgets() {
      return (
      <Widget
        id="VisibilityTree"
        defaultState={WidgetState.Closed}
        fillZone={true}
        iconSpec="icon-hierarchy-tree"
        control={TreeWidgetControl}
        applicationData={{
          // The usage of the App class here is for illustration purposes.
          // This example assumes that you can provide an iModelConnection
          // and an AccessToken to the tree widget controller
          iModelConnection: App.iModelConnection,
        }}
      />,
    );
  }
}
```

### Rolling your own custom widget control

This example showcases how to write your own widget controller with the `TreeWidgetComponent`.

This controller only sends in one tree to display via the `TreeWidgetComponent`.

```ts
import {
  WidgetControl,
  ConfigurableCreateInfo,
  SpatialContainmentTree,
  ClassGroupingOption,
  UiFramework,
} from "@bentley/ui-framework";
import React from "react";
import { IModelConnection, Viewport } from "@bentley/imodeljs-frontend";
import { SelectableContentDefinition } from "@bentley/ui-components";
import { TreeWidgetComponent } from "./TreeWidgetComponent";

export interface TreeWidgetControlOptions {
  iModelConnection: IModelConnection;
}

export class TreeWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: TreeWidgetControlOptions) {
    super(info, options);

    const { iModelConnection } = options;

    const spatialContainmentComponent = () => (
      <SpatialContainmentTree
        iModel={iModelConnection}
        enablePreloading={enablePreloading}
        enableElementsClassGrouping={ClassGroupingOption.No}
        {...spatialTreeProps}
      />
    );

    const trees: SelectableContentDefinition[] = [
      {
        label: UiFramework.translate("visibilityWidget.containment"),
        id: "spatial-containment-tree",
        render: spatialContainmentComponent,
      },
    ];

    this.reactNode = <TreeWidgetComponent trees={trees} />;
  }
}
```
