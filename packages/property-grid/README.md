# @itwin/property-grid-react

Copyright © Bentley Systems, Incorporated. All rights reserved.

The property-grid-react package provides React components to access the property grid within an iModel.

## Usage

### What to add in your ITwin AppUI based application

With a few short lines, you can add the Property Grid widget to your app.

### Call PropertyGridManager.initialize() **_before_** making use of the provided Property Grid Provider

```ts
import { PropertyGridManager } from "@itwin/property-grid-react";
...
await PropertyGridManager.initialize(IModelApp.localization);
```

### Register Property Grid Provider

```ts
import { UiItemsManager } from "@itwin/appui-abstract";
import { PropertyGridManager } from "@itwin/property-grid-react";
...
UiItemsManager.register(
  new PropertyGridUiItemsProvider({ ...PropertyGridProps })
);
```

### Property Grid options

```ts
interface PropertyGridProps {
  orientation?: Orientation;
  isOrientationFixed?: boolean;
  enableFavoriteProperties?: boolean;
  favoritePropertiesScope?: FavoritePropertiesScope;
  enableCopyingPropertyText?: boolean;
  enableNullValueToggle?: boolean;
  enablePropertyGroupNesting?: boolean;
  additionalContextMenuOptions?: ContextMenuItemInfo[];
  rulesetId?: string;
  rootClassName?: string;
  dataProvider?: PresentationPropertyDataProvider;
  onInfoButton?: () => void;
  onBackButton?: () => void;
  disableUnifiedSelection?: boolean;
}
```

### Adding your own options to the property grid context menu

It is possible to provide additional funcitonality to your users via the context menu of the property grid. This `additionalContextMenuOptions` props expects an array filled with `ContextMenuItemInfo` objects, which has the following members:

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
interface OnSelectEventArgs {
  dataProvider: IPresentationPropertyDataProvider;
  field?: Field;
  contextMenuArgs: PropertyGridContextMenuArgs;
}
```
