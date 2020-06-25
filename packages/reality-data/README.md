# @bentley\reality-data-react

Copyright © Bentley Systems, Incorporated. All rights reserved.

The reality-data package provides React components to access reality data within an iModel

## Sample usage

### The Reality Data `<Widget>`

The main entry point provided by this package into reality data is through the `<Widget>` component. This component takes the following props:

```ts
/** Type of props for the Widget component */
export interface WidgetProps {
  appContext: PartialAppContext;
  components?: ExchangableComponents;
}
```

#### AppContext

`appContext` is used to override the default behavior of the widget or provide additional functionality. `appContext` is composed as such:

```ts
/**
 * sealed version of PartialAppContext with defaults
 * ensured, hence non-optional types
 */
export interface AppContext extends PartialAppContext {
  features: WidgetFeatures;
  trackEvent: (e: TelemetryEvent) => void;
  viewManager: ViewManager;
  handleError: (e: Error | any) => void;
}

/**
 * context of the subscribing iModel app,
 * for custom handling and optional features
 */
export interface PartialAppContext {
  projectId: string;
  iModelConnection: IModelConnection;
  accessToken: AccessToken;
  features?: WidgetFeatures;
  trackEvent?: (e: TelemetryEvent) => void;
  viewManager?: ViewManager;
  handleError?: (e: Error | any) => void;
}
```

Note that those members that are contained within `AppContext` are **required**, but are given sensible **defaults** should they be omitted. Those members that are contained within `PartialAppContext` are mostly optional save for `projectId`, `iModelConnection` and `accessToken` which do **not** have defaults and thus must be provided by the user.

#### Enabling or disabling features

The following features can be enabled or disabled via the `PartialAppContext` `features` object:

```ts
/** Map of features that can be enabled for the reality data widget */
export interface WidgetFeatures {
  /* allow enhanced configuring of bing map  */
  useBingMapEnhancedSettings?: boolean;
  /* allow configuring elevation */
  bingElevationUseSettings?: boolean;
  /* allow classification */
  classification?: boolean;
  /* CURRENTLY BROKEN: highlights search results in the widget in yellow */
  wantHighlighting?: boolean;
}
```

#### Replacing components within the widget with your own

It is possible to replace those components that the reality data widget uses with your own via the `components` prop on the `<Widget>` component.

```ts
/** Type of the optional component map prop of the Widget component */
export interface ExchangableComponents {
  Header: React.ComponentType<HeaderProps>;
  Content: React.ComponentType<ContentProps>;
  ModalDialog: React.ComponentType<ModalDialogProps>;
}
```

##### Replacing the header component

You can replace the header component by overriding the `Header` member of the `components` prop on the `<Widget>` component. This component displays the interactive header over the reality data content. The default offers visibility and search-based filtering functionality of content.

The header component will receive the following props:

```ts
/** Props for the Header component */
export interface HeaderProps {
  appContext: AppContext;
  showSearch: boolean;
  visibilityButtonsWrapperRef: React.RefObject<HTMLDivElement>;
  onShowAll: () => void;
  onHideAll: () => void;
  onInvertVisible: () => void;
  renderSearch: () => JSX.Element;
  onFilterChange: (filter: string) => void;
}
```

##### Replacing the content component

You can replace the content component by overriding the `Content` member of the `components` prop on the `<Widget>` component. This component displays the reality data content (i.e. map, reality data items).

The content component will receive the following props:

```ts
/** Props for the Content component */
export interface ContentProps {
  filter?: string;
  filteredRealityData: Entry[];
  isMapVisible: () => boolean;
  isMapEnabled: boolean;
  appContext: AppContext;
  onToggleBingMapVisibility: () => void;
  onOpenMapTypes: (evt: any) => void;
  isMapTypesOpen: boolean;
  onCloseMapTypes: () => void;
  bingMapType: BackgroundMapType;
  onChangeMapType: (type: BackgroundMapType) => void;
  onOpenSettings: () => void;
  onChangeItemVisibility: (item: Entry) => void;
  isMapOnly: boolean;
}
```

##### Replacing the modal component

You can replace the modal dialog component by overriding the `ModalDialog` member of the `components` prop on the `<Widget>` component. This component displays the dialog which shows the available settings for a given reality data instance.

The modal dialog component will receive the following props:

```ts
/** Props for the SettingsModalWrapper component */
export interface ModalDialogProps {
  appContext: AppContext;
  isOpen: boolean;
  title: string;
  onCancel?: () => void;
  onConfirm?: () => void;
}
```

### Example usage of the `<Widget>` component in a frontstage

```ts
import * as React from "react";
import {
  ConfigurableCreateInfo,
  ContentControl,
  ContentGroup,
  ContentLayoutDef,
  CoreTools,
  Frontstage,
  WidgetControl,
  FrontstageProps,
  FrontstageProvider,
  UiFramework,
  Zone,
} from "@bentley/ui-framework";
import { Widget, PartialAppContext } from "@bentley/reality-data-react";
import { IModelConnection, IModelApp } from "@bentley/imodeljs-frontend";
import { AccessToken } from "@bentley/itwin-client";
export class RealityDataFrontstage extends FrontstageProvider {
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
        id="RealityData"
        defaultTool={CoreTools.selectElementCommand}
        defaultLayout={this._contentLayoutDef}
        contentGroup={contentGroup}
        isInFooterMode={false}
        centerRight={
          <Zone
            allowsMerging={true}
            widgets={RealityDataFrontstage.getCenterRightWidgets()}
          />
        }
      />
    );
  }
  public static getCenterRightWidgets() {
      return (
      <Widget
        id="RealityData"
        defaultState={WidgetState.Closed}
        fillZone={true}
        iconSpec="icon-hierarchy-tree"
        control={RealityDataViewerControl}
        applicationData={{
          // The usage of the App class here is for illustration purposes.
          // This example assumes that you can provide an iModelConnection
          // and an AccessToken to the tree widget controller
          iModelConnection: App.iModelConnection,
          accessToken: App.accessToken,
        }}
      />,
    );
  }
}


export class RealityDataViewerControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactElement = (
      <div
        style={{
          padding: "2px 4px 0px 4px",
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
        }}
      >
        <RealityDataWidget iModel={options.iModelConnection} accessToken={options.accessToken} />;
      </div>
    );
  }
}

export interface RealityDataWidgetProps {
  iModel: IModelConnection;
  accessToken?: AccessToken;
}

export const RealityDataWidget = (props: RealityDataWidgetProps) => {
  return (
    <Widget
      appContext={
        {
          projectId: props.iModel.contextId,
          iModelConnection: props.iModel,
          accessToken: props.accessToken,
          features: {
            useBingMapEnhancedSettings: true,
            bingElevationUseSettings: true,
            classification: false,
          },
          viewManager: IModelApp.viewManager,
        } as PartialAppContext
      }
    />
  );
};
```
