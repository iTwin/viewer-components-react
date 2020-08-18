/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * Licensed under the MIT License. See LICENSE.md in the project root for license terms.
 *--------------------------------------------------------------------------------------------*/

import "./PropertyGrid.scss";

import * as React from "react";

import {
  AuthorizedFrontendRequestContext,
  IModelApp,
  IModelConnection,
} from "@bentley/imodeljs-frontend";
import { Field } from "@bentley/presentation-common";
import {
  IPresentationPropertyDataProvider,
  propertyGridWithUnifiedSelection,
} from "@bentley/presentation-components";
import { Presentation } from "@bentley/presentation-frontend";
import { SettingsStatus } from "@bentley/product-settings-client";
import { PropertyRecord } from "@bentley/ui-abstract";
import {
  ActionButtonRenderer,
  ActionButtonRendererProps,
  PropertyData,
  PropertyGrid as CorePropertyGrid,
  PropertyGridContextMenuArgs,
  PropertyValueRendererManager,
} from "@bentley/ui-components";
import {
  ContextMenuItem,
  ContextMenuItemProps,
  GlobalContextMenu,
  Orientation,
} from "@bentley/ui-core";
import { ConfigurableCreateInfo, WidgetControl } from "@bentley/ui-framework";

import { PropertyDataProvider } from "../api/PropertyGridDataProvider";
import { copyToClipboard } from "../api/WebUtilities";
import { PropertyGridManager } from "../PropertyGridManager";

const sharedNamespace = "favoriteProperties";
const sharedName = "sharedProps";
type ContextMenuItemInfo = ContextMenuItemProps &
  React.Attributes & { label: string };

export interface PropertyGridFeatureTracking {
  trackCopyPropertyText: () => void;
}

export interface OnSelectEventArgs {
  dataProvider: IPresentationPropertyDataProvider;
  field?: Field;
  contextMenuArgs: PropertyGridContextMenuArgs;
}

export interface PropertyGridProps {
  iModelConnection: IModelConnection;
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

interface PropertyGridState {
  title?: PropertyRecord;
  className: string;
  contextMenu?: PropertyGridContextMenuArgs;
  contextMenuItemInfos?: ContextMenuItemInfo[];
  sharedFavorites: string[];
}

export class PropertyGrid extends React.Component<
  PropertyGridProps,
  PropertyGridState
> {
  private static _unifiedSelectionPropertyGrid = propertyGridWithUnifiedSelection(
    CorePropertyGrid
  );

  private _dataProvider: PropertyDataProvider;
  private _dataChangedHandler: () => void;
  private _unmounted = false;
  constructor(props: PropertyGridProps) {
    super(props);

    this._dataProvider = new PropertyDataProvider(
      props.iModelConnection,
      props.rulesetId,
      props.enableFavoriteProperties
    );

    this._dataChangedHandler = this._onDataChanged.bind(this);
    this.state = { className: "", sharedFavorites: [] };
  }

  public async componentDidMount() {
    if (this.props.iModelConnection)
      this._dataProvider.onDataChanged.addListener(this._dataChangedHandler);

    let currentData = await this._dataProvider.getData();
    currentData = await this._addSharedFavsToData(currentData);
    const title = currentData.label;
    if (currentData && !this._unmounted) {
      this.setState({
        title,
        className: currentData.description ? currentData.description : "",
      });
    }
  }

  public componentWillUnmount() {
    if (this.props.debugLog) this.props.debugLog(`Unmounting Properties Grid`);
    if (this.props.iModelConnection)
      this._dataProvider.onDataChanged.removeListener(this._dataChangedHandler);

    this._unmounted = true;
  }

  public componentWillReceiveProps(nextProps: PropertyGridProps) {
    if (this.props.iModelConnection) {
      // Remove old listener, create a new data provider, and re-add the listener
      if (nextProps.iModelConnection) {
        this._dataProvider.onDataChanged.removeListener(
          this._dataChangedHandler
        );
        this._dataProvider = new PropertyDataProvider(
          this.props.iModelConnection!,
          nextProps.rulesetId
        );
        this._dataProvider.onDataChanged.addListener(this._dataChangedHandler);
      }
    }
  }

  private async _addSharedFavsToData(propertyData: PropertyData) {
    // Get shared favorites & add to data
    let newSharedFavs: string[] = [];
    if (this.props.projectId) {
      const requestContext = await AuthorizedFrontendRequestContext.create();
      const result = await IModelApp.settings.getSharedSetting(
        requestContext,
        sharedNamespace,
        sharedName,
        false,
        this.props.projectId,
        this.props.iModelConnection.iModelId
      );
      if (result.setting?.slice) {
        newSharedFavs = (result.setting as string[]).slice();
      }
      this.setState({ sharedFavorites: newSharedFavs });
    }
    if (propertyData.categories[0]?.name !== "Favorite") {
      propertyData.categories.unshift({
        name: "Favorite",
        label: "Favorite",
        expand: true,
      });
      propertyData.records.Favorite = [];
    }
    const dataFavs = propertyData.records.Favorite;

    for (const cat of propertyData.categories) {
      if (cat.name !== "Favorite") {
        for (const rec of propertyData.records[cat.name]) {
          const propName = rec.property.name;
          const shared =
            newSharedFavs &&
            newSharedFavs?.findIndex(
              (fav: string) => rec.property.name === fav
            ) >= 0;
          if (
            shared &&
            !dataFavs.find(
              (favRec: PropertyRecord) => favRec.property.name === propName
            )
          ) {
            // if shared & not already in favorites
            dataFavs.push(rec);
            const propertyField = await this._dataProvider?.getFieldByPropertyRecord(
              rec
            );
            if (propertyField) {
              await Presentation.favoriteProperties.add(
                propertyField,
                this.props.projectId
              );
            }
          }
        }
      }
    }
    return this._dataProvider.getData();
  }

  private async _onDataChanged() {
    let propertyData: PropertyData = await this._dataProvider.getData();
    propertyData = await this._addSharedFavsToData(propertyData);
    // Sometimes, we may change stage while selection occurs (for version compare property comparison)
    // This causes the _onDataChanged to get called, but it may take time for the await to come through and we end up
    // Setting the state of this component after it has been unmounted
    const title = propertyData.label;
    if (!this._unmounted)
      this.setState({
        title,
        className: propertyData.description ? propertyData.description : "",
      });
  }

  private _onAddFavorite = async (propertyField: Field) => {
    // tslint:disable-next-line: no-floating-promises
    Presentation.favoriteProperties.add(propertyField, this.props.projectId);
    this.setState({ contextMenu: undefined });
  };

  private _onRemoveFavorite = async (propertyField: Field) => {
    // tslint:disable-next-line: no-floating-promises
    Presentation.favoriteProperties.remove(propertyField, this.props.projectId);
    this.setState({ contextMenu: undefined });
  };

  private _onShareFavorite = async (propName: string) => {
    if (!this.props.projectId || !this.state.sharedFavorites) {
      this.setState({ contextMenu: undefined });
      return;
    }
    this.state.sharedFavorites.push(propName);

    const requestContext = await AuthorizedFrontendRequestContext.create();
    const result = await IModelApp.settings.saveSharedSetting(
      requestContext,
      this.state.sharedFavorites,
      sharedNamespace,
      sharedName,
      false,
      this.props.projectId,
      this.props.iModelConnection.iModelId
    );
    if (result.status !== SettingsStatus.Success) {
      throw new Error(
        "Could not share favoriteProperties: " + result.errorMessage
      );
    }
    const result2 = await IModelApp.settings.getSharedSetting(
      requestContext,
      sharedNamespace,
      sharedName,
      false,
      this.props.projectId,
      this.props.iModelConnection.iModelId
    );
    if (result2.status !== SettingsStatus.Success) {
      throw new Error(
        "Could not share favoriteProperties: " + result2.errorMessage
      );
    }
    this.setState({ contextMenu: undefined });
  };

  private _onUnshareFavorite = async (propName: string) => {
    if (!this.props.projectId || !this.state.sharedFavorites) {
      this.setState({ contextMenu: undefined });
      return;
    }
    const index = this.state.sharedFavorites.indexOf(propName);
    if (index > -1) {
      this.state.sharedFavorites.splice(index, 1);
    }
    const requestContext = await AuthorizedFrontendRequestContext.create();
    const result = await IModelApp.settings.saveSharedSetting(
      requestContext,
      this.state.sharedFavorites,
      sharedNamespace,
      sharedName,
      false,
      this.props.projectId,
      this.props.iModelConnection.iModelId
    );
    if (result.status !== SettingsStatus.Success) {
      throw new Error(
        "Could not unshare favoriteProperties: " + result.errorMessage
      );
    }
    this.setState({ contextMenu: undefined });
  };

  private _shareActionButtonRenderer: ActionButtonRenderer = (
    props: ActionButtonRendererProps
  ) => {
    const shared =
      this.state.sharedFavorites !== undefined &&
      this.state.sharedFavorites?.findIndex(
        (fav: string) => props.property.property.name === fav
      ) >= 0;
    return (
      <div>
        {shared && (
          <span
            className="icon icon-share"
            style={{ paddingRight: "5px" }}
          ></span>
        )}
      </div>
    );
  };

  private _onCopyText = async (property: PropertyRecord) => {
    if (property.description) copyToClipboard(property.description);
    else if (this.props.debugLog)
      this.props.debugLog(
        "PROPERTIES COPY TEXT FAILED TO RUN DUE TO UNDEFINED PROPERTY RECORD DESCRIPTION"
      );
    this.setState({ contextMenu: undefined });
  };

  private _onPropertyContextMenu = (args: PropertyGridContextMenuArgs) => {
    args.event.persist();
    this.setState({
      contextMenu: args.propertyRecord.isMerged ? undefined : args,
    });
    // tslint:disable-next-line: no-floating-promises
    this._buildContextMenu(args);
  };
  private _onContextMenuOutsideClick = () => {
    this.setState({ contextMenu: undefined });
  };
  private _onContextMenuEsc = () => {
    this.setState({ contextMenu: undefined });
  };

  private async _buildContextMenu(args: PropertyGridContextMenuArgs) {
    const field = await this._dataProvider.getFieldByPropertyRecord(
      args.propertyRecord
    );
    const items: ContextMenuItemInfo[] = [];
    if (field !== undefined && this.props.enableFavoriteProperties) {
      if (
        this.state.sharedFavorites &&
        this.state.sharedFavorites?.findIndex(
          (fav: string) => args.propertyRecord.property.name === fav
        ) >= 0
      ) {
        // i.e. if shared
        items.push({
          key: "unshare-favorite",
          onSelect: () =>
            this._onUnshareFavorite(args.propertyRecord.property.name),
          title: PropertyGridManager.translate(
            "context-menu.unshare-favorite.description"
          ),
          label: PropertyGridManager.translate(
            "context-menu.unshare-favorite.label"
          ),
        });
      } else if (
        Presentation.favoriteProperties.has(field, this.props.projectId)
      ) {
        items.push({
          key: "share-favorite",
          onSelect: () =>
            this._onShareFavorite(args.propertyRecord.property.name),
          title: PropertyGridManager.translate(
            "context-menu.share-favorite.description"
          ),
          label: PropertyGridManager.translate(
            "context-menu.share-favorite.label"
          ),
        });
        items.push({
          key: "remove-favorite",
          onSelect: () => this._onRemoveFavorite(field),
          title: PropertyGridManager.translate(
            "context-menu.remove-favorite.description"
          ),
          label: PropertyGridManager.translate(
            "context-menu.remove-favorite.label"
          ),
        });
      } else {
        items.push({
          key: "add-favorite",
          onSelect: () => this._onAddFavorite(field),
          title: PropertyGridManager.translate(
            "context-menu.add-favorite.description"
          ),
          label: PropertyGridManager.translate(
            "context-menu.add-favorite.label"
          ),
        });
      }
    }

    if (this.props.enableCopyingPropertyText) {
      items.push({
        key: "copy-text",
        onSelect: async () => {
          if (this.props.featureTracking)
            this.props.featureTracking.trackCopyPropertyText();
          await this._onCopyText(args.propertyRecord);
        },
        title: PropertyGridManager.translate(
          "context-menu.copy-text.description"
        ),
        label: PropertyGridManager.translate("context-menu.copy-text.label"),
      });
    }

    if (
      this.props.additionalContextMenuOptions &&
      this.props.additionalContextMenuOptions.length > 0
    ) {
      for (const option of this.props.additionalContextMenuOptions) {
        items.push({
          ...option,
          onSelect: () => {
            if (option.onSelect) {
              (option.onSelect as (args: OnSelectEventArgs) => void)({
                contextMenuArgs: args,
                field,
                dataProvider: this._dataProvider,
              });
            }

            this.setState({ contextMenu: undefined });
          },
        });
      }
    }

    this.setState({
      contextMenuItemInfos: items.length > 0 ? items : undefined,
    });
  }

  private _renderContextMenu() {
    if (!this.state.contextMenu || !this.state.contextMenuItemInfos)
      return undefined;

    const items: React.ReactNode[] = [];
    this.state.contextMenuItemInfos.forEach((info: ContextMenuItemInfo) =>
      items.push(
        <ContextMenuItem
          key={info.key}
          onSelect={info.onSelect}
          title={info.title}
        >
          {info.label}
        </ContextMenuItem>
      )
    );

    return (
      <GlobalContextMenu
        opened={true}
        onOutsideClick={this._onContextMenuOutsideClick}
        onEsc={this._onContextMenuEsc}
        identifier="PropertiesWidget"
        x={this.state.contextMenu!.event.clientX}
        y={this.state.contextMenu!.event.clientY}
      >
        {items}
      </GlobalContextMenu>
    );
  }

  public render() {
    return (
      <div className={this.props.rootClassName}>
        <div className="property-grid-react-panel-label">
          {this.state.title &&
            PropertyValueRendererManager.defaultManager.render(
              this.state.title
            )}
        </div>
        <div className="property-grid-react-panel-class">
          {this.state.className}
        </div>
        <PropertyGrid._unifiedSelectionPropertyGrid
          orientation={this.props.orientation ?? Orientation.Horizontal}
          isOrientationFixed={this.props.isOrientationFixed ?? true}
          dataProvider={this._dataProvider}
          isPropertyHoverEnabled={true}
          isPropertySelectionEnabled={true}
          onPropertyContextMenu={this._onPropertyContextMenu}
          actionButtonRenderers={[this._shareActionButtonRenderer]}
        />
        {this._renderContextMenu()}
      </div>
    );
  }
}

export class PropertyGridWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactElement = (
      <PropertyGrid
        orientation={options.orientation}
        isOrientationFixed={options.isOrientationFixed}
        enableCopyingPropertyText={options.enableCopyingPropertyText}
        enableFavoriteProperties={options.enableFavoriteProperties}
        iModelConnection={options.iModelConnection}
        projectId={options.projectId}
        debugLog={options.debugLog}
        additionalContextMenuOptions={options.additionalContextMenuOptions}
        rootClassName={options.rootClassName}
        featureTracking={options.featureTracking}
        rulesetId={options.rulesetId}
      />
    );
  }
}
