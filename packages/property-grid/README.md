# @bentley/property-grid-react

Copyright © Bentley Systems, Incorporated. All rights reserved.

The property-grid-react package provides React components to access the property grid within an iModel.

## Sample usage

### PropertyGridWidget props

This is the data that can be passed in through the `applicationData` property on a 9-zone `<Widget>` element.

Note the required props.

```ts
export interface PropertyGridProps {
  iModelConnection: IModelConnection;
  accessToken: AccessToken;
  projectId: string;
  orientation?: Orientation;
  isOrientationFixed?: boolean;
  enableFavoriteProperties?: boolean;
  enableCopyingPropertyText?: boolean;
  additionalContextMenuOptions?: ContextMenuItemInfo[];
  debugLog?: (message: string) => void;
  featureTracking?: PropertyGridFeatureTracking;
  rulesetId?: string;
  rootClassName?: string;
}
```

### Adding your own options to the property grid context menu

It is possible to provide additional funcitonality to your users via the context menu of the property grid. You can add your own options to this context menu via the `additionalContextMenuOptions` prop which can be passed in through the `applicationData` property on a 9-zone `<Widget>` element which has the `PropertyGridWidgetControl` as its controller.

This `additionalContextMenuOptions` props expects an array filled with `ContextMenuItemInfo` objects, which has the following members:

```ts
/** Function that will be called when the option is selected from the context menu */
onSelect?: (event: OnSelectEventArgs) => void;
/** Icon to display in the left margin. */
icon?: string | React.ReactNode;
/** Disables any onSelect calls, hover/keyboard highlighting, and grays item. */
disabled?: boolean;
/** Badge to be overlaid on the item. */
badgeType?: BadgeType;
/** Set whether or not the option is selected */
isSelected?: boolean;
/** Label for the option in the context menu */
label: string
```

The `OnSelectEventArgs` object that is passed to the provided `onSelect` callback by the property grid takes the following form:

```ts
export interface OnSelectEventArgs {
  dataProvider: IPresentationPropertyDataProvider;
  field?: Field;
  contextMenuArgs: PropertyGridContextMenuArgs;
}
```

### Call PropertyGridManager.initialize() **_before_** making use of the provided widget controller

```ts
import { PropertyGridManager } from "@bentley/property-grid-react";

async function myInitializationFunction() {
  await PropertyGridManager.initialize(IModelApp.i18n);
}
```

### Assign the PropertyGridControl widget controller to a widget

```ts
<Widget
  id="PropertyPanel"
  fillZone={true}
  defaultState={WidgetState.Hidden}
  iconSpec="icon-info"
  labelKey="App:properties"
  applicationData={{
  orientation: Orientation.Horizontal,
  isOrientationFixed: true,
  iModelConnection: App.iModelConnection,
  accessToken: App.accessToken,
  projectId: App.projectId,
  enableFavoriteProperties: true,
  }}
  control={PropertyGridWidgetControl}
/>,
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
import { PropertyGridControl } from "@bentley/property-grid-react";

export class PropertyGridFrontstage extends FrontstageProvider {
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
        id="PropertyGrid"
        defaultTool={CoreTools.selectElementCommand}
        defaultLayout={this._contentLayoutDef}
        contentGroup={contentGroup}
        isInFooterMode={false}
        centerRight={
          <Zone
            allowsMerging={true}
            widgets={PropertyGridFrontstage.getCenterRightWidgets()}
          />
        }
      />
    );
  }

  public static getCenterRightWidgets() {
      return (
      <Widget
        id="PropertyPanel"
        fillZone={true}
        defaultState={WidgetState.Hidden}
        iconSpec="icon-info"
        labelKey="App:properties"
        applicationData={{
        orientation: Orientation.Horizontal,
        isOrientationFixed: true,
        iModelConnection: App.iModelConnection,
        accessToken: App.accessToken,
        projectId: App.projectId,
        enableFavoriteProperties: true,
        }}
        control={PropertyGridWidgetControl}
      />,
    );
  }
}
```
