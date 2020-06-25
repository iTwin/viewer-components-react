/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * Licensed under the MIT License. See LICENSE.md in the project root for license terms.
 *--------------------------------------------------------------------------------------------*/
import "./Widget.scss";
import classnames from "classnames";
import memoize from "memoize-one";
import * as React from "react";
import Highlighter from "react-highlight-words";
import {
  BackgroundMapType,
  CartographicRange,
  ContextRealityModelProps,
  SpatialClassificationProps,
} from "@bentley/imodeljs-common";
import {
  ContextRealityModelState,
  findAvailableUnattachedRealityModels,
  IModelApp,
  ScreenViewport,
  SpatialModelState,
  SpatialViewState,
  Viewport,
} from "@bentley/imodeljs-frontend";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { RealityDataClient } from "@bentley/reality-data-client";
import { RelativePosition as Position } from "@bentley/ui-abstract";
import { LoadingSpinner, SearchBox, SpinnerSize } from "@bentley/ui-core";
import {
  ConfigurableCreateInfo,
  ConfigurableUiManager,
  WidgetControl,
} from "@bentley/ui-framework";
import { AppContext, PartialAppContext } from "../reality-data-react";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
} from "./ContextMenu";
import { AttachedRealityModel, Entry } from "../api/Entry";
import { Item } from "./Item";
import ModalDialog, { ModalDialogProps } from "./ModalDialog";
import RealityData from "../api/RealityData";
import { SettingsManager } from "./SettingsManager";

/**
 * create a RegExp given a query in the simple search language
 * currently simple search is just a caseless text search with a wildcard character, '*'
 * the wildcard character matches any non-space text
 */
export const regexFromSearchQuery = (query: string): RegExp => {
  const escapeChar = (char: string, str: string) =>
    str.replace(new RegExp("\\" + char, "g"), "\\" + char);
  return new RegExp(
    ["\\", "$", "^", "(", ")", "[", "]", "{", "}", "|", "?", ".", "+", ":"]
      // escape regexp metachars
      .reduce((prev, char) => escapeChar(char, prev), query)
      // convert wildcard definition
      .replace(/\*/g, "\\S*"),
    "i"
  );
};

/** Type of the optional component map prop of the Widget component */
export interface ExchangableComponents {
  Header: React.ComponentType<HeaderProps>;
  Content: React.ComponentType<ContentProps>;
  ModalDialog: React.ComponentType<ModalDialogProps>;
}

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

/** Content component, displays the reality data content (i.e. map, reality data items) */
export class Content extends React.Component<ContentProps> {
  private _bingMapElement = React.createRef<HTMLElement>();
  public render() {
    const props = this.props;
    const { appContext } = props;
    const wantHighlighting = !!appContext.features?.wantHighlighting;
    return (
      <div className="reality-data-content">
        <ul className="reality-data-list">
          {props.isMapVisible() && appContext.iModelConnection.isGeoLocated ? (
            <li
              className="reality-data-item"
              key={"bingMap"}
              onClick={props.onToggleBingMapVisibility}
            >
              <span
                className={
                  props.isMapEnabled
                    ? "icon icon-visibility"
                    : "icon icon-visibility-hide-2"
                }
              />
              <a>
                <span className="reality-data-name">
                  {wantHighlighting ? (
                    <Highlighter
                      caseSensitive={false}
                      searchWords={
                        wantHighlighting && this.props.filter !== undefined
                          ? [this.props.filter]
                          : []
                      }
                      textToHighlight={RealityData.translate("bingMap")}
                    />
                  ) : (
                    RealityData.translate("bingMap")
                  )}
                </span>
              </a>
              <span
                className="icon icon-more-2"
                onClick={props.onOpenMapTypes}
                ref={this._bingMapElement}
              />
              <ContextMenu
                parent={this._bingMapElement.current}
                isOpened={props.isMapTypesOpen}
                onClickOutside={props.onCloseMapTypes}
                position={Position.BottomRight}
              >
                <ContextMenuItem
                  name={RealityData.translate("hybrid")}
                  checked={props.bingMapType === BackgroundMapType.Hybrid}
                  onClick={() =>
                    props.onChangeMapType(BackgroundMapType.Hybrid)
                  }
                />
                <ContextMenuItem
                  name={RealityData.translate("aerial")}
                  checked={props.bingMapType === BackgroundMapType.Aerial}
                  onClick={() =>
                    props.onChangeMapType(BackgroundMapType.Aerial)
                  }
                />
                <ContextMenuItem
                  name={RealityData.translate("street")}
                  checked={props.bingMapType === BackgroundMapType.Street}
                  onClick={() =>
                    props.onChangeMapType(BackgroundMapType.Street)
                  }
                />
                <ContextMenuSeparator />
                <ContextMenuItem
                  name={RealityData.translate("settings")}
                  onClick={props.onOpenSettings}
                />
              </ContextMenu>
            </li>
          ) : null}
          {!props.isMapOnly &&
            props.filteredRealityData.map((_item: Entry) => (
              <Item
                key={_item.url}
                highlightWords={
                  this.props.filter ? [this.props.filter] : undefined
                }
                item={_item}
                onVisibilityChange={() => props.onChangeItemVisibility(_item)}
                appContext={appContext}
              />
            ))}
        </ul>
      </div>
    );
  }
}

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

/**
 * Header component, displays the interactive header over the reality data content
 * default offers visibility and search-based filtering functionality of content
 */
class Header extends React.Component<HeaderProps> {
  public render() {
    const props = this.props;
    return (
      <div
        className={classnames(
          "reality-data-header",
          props.showSearch && "show-search"
        )}
      >
        <div
          className={"reality-data-header-buttons"}
          ref={props.visibilityButtonsWrapperRef}
        >
          <span
            title={RealityData.translate("showAll")}
            className="icon icon-visibility"
            onClick={props.onShowAll}
          />
          <span
            title={RealityData.translate("hideAll")}
            className="icon icon-visibility-hide-2"
            onClick={props.onHideAll}
          />
          <span
            title={RealityData.translate("invertDisplay")}
            className="icon icon-visibility-invert"
            onClick={props.onInvertVisible}
          />
        </div>
        {props.renderSearch()}
      </div>
    );
  }
}

/** Default components (non-overridden) for the composable Widget subcomponents */
export const defaultComponents: ExchangableComponents = {
  Header,
  Content,
  ModalDialog,
};

/** Type of props for the Widget component */
export interface WidgetProps {
  appContext: PartialAppContext;
  components?: ExchangableComponents;
}

interface WidgetState {
  items: Entry[] /** Items displayed in picker */;
  filter: string;
  isMapEnabled: boolean;
  showMapTypes: boolean;
  bingMapType: BackgroundMapType;
  showSearchBox: boolean;
  initialized: boolean;
  isSettingsOpen: boolean;
}

/** Reality Data Widget component */
export class Widget extends React.Component<WidgetProps, WidgetState> {
  private _availableModels: ContextRealityModelProps[] = [];
  private _attachedModels: AttachedRealityModel[] = [];
  private _searchBox = React.createRef<SearchBox>();
  private _visibilityButtonsWrapper = React.createRef<HTMLDivElement>();
  private _removeListener: () => void;
  private _vp: ScreenViewport | undefined;
  private _unmounted = false;
  private _components: ExchangableComponents;

  private _memoMakeFullAppContext: (
    ctx: PartialAppContext
  ) => AppContext = memoize((appContext: PartialAppContext) => ({
    ...appContext,
    trackEvent: appContext.trackEvent || (() => {}),
    features: appContext.features || {},
    viewManager: appContext.viewManager || IModelApp.viewManager,
    iModelId: appContext.iModelConnection.iModelId as string,
    handleError: appContext.handleError || (() => {}),
  }));

  private get fullAppContext() {
    return this._memoMakeFullAppContext(this.props.appContext);
  }

  /** Creates a ModelSelectorWidget */
  constructor(props: WidgetProps) {
    super(props);
    this._removeListener = () => {};
    this.state = {
      items: [],
      filter: "",
      isMapEnabled: false,
      showMapTypes: false,
      bingMapType: BackgroundMapType.Hybrid,
      initialized: false,
      showSearchBox: false,
      isSettingsOpen: false,
    };
    this._components = new Proxy(
      {},
      {
        get: (_, key: keyof ExchangableComponents) =>
          (this.props.components && this.props.components[key]) ||
          defaultComponents[key],
      }
    ) as ExchangableComponents;
  }

  /** Initialize listeners and category/model rulesets */
  public async componentDidMount() {
    this._unmounted = false;

    // get selected viewport
    const vp = this.fullAppContext.viewManager.selectedView;

    // if view exists bind update routine to onRender loop, otherwise do so once the onViewOpen event runs
    if (vp) {
      await this._updateStateFromView(vp);
    } else {
      this.fullAppContext.viewManager.onViewOpen.addListener(
        this._updateStateFromView,
        this
      );
    }
  }

  private async _onViewOpen(
    vp: Viewport
  ): Promise<{ isMapEnabled: boolean; bingMapType: BackgroundMapType }> {
    this._vp = vp as ScreenViewport;

    await this._initializeRealityModels();

    this._removeListener = vp.onDisplayStyleChanged.addListener(
      this._refreshFromView,
      this
    );

    const view = vp.view as SpatialViewState;

    return {
      isMapEnabled: view.viewFlags.backgroundMap,
      bingMapType: view.getDisplayStyle3d().backgroundMap.settings.mapType,
    };
  }

  private async _updateStateFromView(vp: Viewport) {
    const { isMapEnabled, bingMapType } = await this._onViewOpen(vp);

    if (!this._unmounted) {
      this.fullAppContext.trackEvent({ name: "showRealityDataPanel" });
      this.setState({ isMapEnabled, bingMapType });
    }
  }

  /** Get rid of listeners */
  public componentWillUnmount() {
    this._unmounted = true;
    if (this._removeListener) this._removeListener();
  }

  /** Initializes reality model data. */
  private _initializeRealityModels = async () => {
    this._availableModels = [];
    const appContext = this.fullAppContext;
    if (!appContext.iModelConnection.contextId)
      throw new Error("Invalid iModelToken/Context Id");

    if (
      appContext.iModelConnection &&
      appContext.iModelConnection.ecefLocation
    ) {
      // Should query online
      const projectCartographicRange = new CartographicRange(
        appContext.iModelConnection.projectExtents,
        appContext.iModelConnection.ecefLocation!.getTransform()
      );
      this._availableModels = await findAvailableUnattachedRealityModels(
        appContext.iModelConnection.contextId,
        appContext.iModelConnection,
        projectCartographicRange
      );
    } else if (appContext.iModelConnection.isGeoLocated) {
      this._availableModels = await findAvailableUnattachedRealityModels(
        appContext.iModelConnection.contextId,
        appContext.iModelConnection
      );
    }

    const query = { from: SpatialModelState.classFullName, wantPrivate: false };
    const props = await this.fullAppContext.iModelConnection.models.queryProps(
      query
    );
    for (const prop of props)
      if (
        prop.jsonProperties !== undefined &&
        prop.jsonProperties.tilesetUrl !== undefined &&
        prop.id !== undefined &&
        prop.name !== undefined
      ) {
        this._attachedModels.push(
          new AttachedRealityModel(
            prop.id!,
            prop.name,
            prop.jsonProperties.tilesetUrl
          )
        );
      }
    this._setRealityDataEntries(); // tslint:disable-line:no-floating-promises
  };

  private _refreshFromView = async () => {
    const items = await this._loadAvailableItems();
    this.setState({
      items,
      isMapEnabled: this._vp!.view.viewFlags.backgroundMap,
      initialized: true,
    });
  };

  private _setRealityDataEntries = async () => {
    const items = await this._loadAvailableItems();
    this.setState({
      items,
      initialized: true,
    });
  };

  private _loadAvailableItems = async () => {
    const _items: Entry[] = [];
    const view = this._vp!.view as SpatialViewState;

    const models: ContextRealityModelState[] = [];
    view.displayStyle.forEachRealityModel(
      (modelState: ContextRealityModelState) => models.push(modelState)
    );

    for (const modelState of models) {
      let group = "";
      let size = "";
      const tilesetUrl = modelState.toJSON().tilesetUrl || modelState.url;
      const realityData = await this._fetchRealityData(tilesetUrl);
      if (realityData) {
        group = realityData.group || "";
        size = realityData.size || "";
      }

      // convert SpatialClassifiers to SpatialClassificationProps.Properties[] since that is what is needed for ContextRealityModelProps
      const classifiers: SpatialClassificationProps.Properties[] = [];
      if (modelState.classifiers) {
        for (const classifier of Array.from(modelState.classifiers)) {
          classifiers.push(classifier as SpatialClassificationProps.Properties);
        }
      }

      _items.push({
        model: modelState,
        url: modelState.url,
        name: modelState.name,
        description: "",
        enabled: true,
        group,
        size,
        classifiers,
      });
    }

    for (const props of this._availableModels) {
      if (this._isUniqueUrl(props.tilesetUrl, _items)) {
        let group = "";
        let size = "";
        const realityData = await this._fetchRealityData(props.tilesetUrl);
        if (realityData) {
          group = realityData.group || "";
          size = realityData.size || "";
        }

        _items.push({
          model: new ContextRealityModelState(
            props,
            this._vp!.iModel,
            view.displayStyle
          ),
          url: props.tilesetUrl,
          name: props.name || "",
          description: props.description || "",
          enabled: false,
          group,
          size,
        });
      }
    }
    const modelSelector = (this._vp!.view as SpatialViewState).modelSelector;
    for (const attachedModel of this._attachedModels) {
      _items.push({
        model: attachedModel,
        url: attachedModel.url,
        name: attachedModel.name,
        description: "",
        enabled: modelSelector.has(attachedModel.id),
        group: "",
        size: "",
        attached: true,
      });
    }

    _items.sort((a: Entry, b: Entry) => {
      if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;
      if (a.name.toLowerCase() > b.name.toLowerCase()) return 1;
      return 0;
    });

    return _items;
  };

  private _fetchRealityData = async (titlesetUrl: string) => {
    const appContext = this.fullAppContext;
    if (!appContext.accessToken) return null;
    const requestContext = new AuthorizedClientRequestContext(
      appContext.accessToken
    ); // might want to pass in as prop
    const client = new RealityDataClient();
    const realityDataId = client.getRealityDataIdFromUrl(titlesetUrl);
    if (realityDataId) {
      const realityData = await client.getRealityData(
        requestContext,
        this.fullAppContext.projectId,
        realityDataId
      );
      return realityData;
    }
    return null;
  };

  private _isUniqueUrl = (url: string, items: Entry[]) => {
    for (const item of items) {
      if (url === item.url) return false;
    }

    const view = this._vp!.view as SpatialViewState;

    const models: ContextRealityModelState[] = [];
    view.displayStyle.forEachRealityModel(
      (modelState: ContextRealityModelState) => models.push(modelState)
    );

    for (const model of models) {
      if (url === model.url) return false;
    }

    return true;
  };

  /**
   * Toggles tree item and display of selected item.
   * @param item  RealityDataEntry selected in picker.
   */
  private _onVisibilityChange = (item: Entry) => {
    item.enabled ? this._disableItem(item) : this._enableItem(item);
  };

  /**
   * Enable tree item and display of selected item.
   * @param item  RealityDataEntry to enable.
   */
  private _enableItem = (item: Entry) => {
    this._enableTreeItems([item]);
    this._enableDisplayItems([item]);
  };

  /**
   * Disable tree item and display of selected item.
   * @param item  RealityDataEntry to disable.
   */
  private _disableItem = (item: Entry) => {
    this._disableTreeItems([item]);
    this._disableDisplayItems([item]);
  };

  /**
   * Enable item in tree.
   * @param item  RealityDataEntry to enable tree item for.
   */
  private _enableTreeItems = (entries: Entry[]) => {
    const items = this.state.items;
    entries.forEach((entry) => {
      entry.enabled = true;
      const index = items.indexOf(entry);
      items.splice(index, 1, entry);
    });

    this.setState((_prevState) => {
      return {
        items,
      };
    });
  };

  /**
   * Enable display item in viewport.
   * @param item  RealityDataEntry to enable display for.
   */
  private _enableDisplayItems = (entries: Entry[]) => {
    const view = this._vp!.view as SpatialViewState;

    for (const entry of entries) {
      if (entry.model instanceof AttachedRealityModel) {
        this._vp!.addViewedModels((entry.model as AttachedRealityModel).id); // tslint:disable-line:no-floating-promises
        return;
      }
      const props = {
        tilesetUrl: entry.model.url,
        name: entry.model.name,
        description: entry.description,
        classifiers: entry.classifiers ? entry.classifiers : [],
      };

      const existingRealityModels: ContextRealityModelState[] = [];
      view.displayStyle.forEachRealityModel(
        (modelState: ContextRealityModelState) =>
          existingRealityModels.push(modelState)
      );

      const found = existingRealityModels.find((model) => {
        if (model.url === props.tilesetUrl) return true;
        return false;
      });

      if (!found) view.displayStyle.attachRealityModel(props);
    }

    this._vp!.invalidateScene();
  };

  /**
   * Disable tree item and display of selected item.
   * @param item  RealityDataEntry to disable.
   */
  private _disableTreeItems = (entries: Entry[]) => {
    const items = this.state.items;
    for (const entry of entries) {
      entry.enabled = false;
      if (entry.model instanceof AttachedRealityModel) {
        this._vp!.changeModelDisplay(
          (entry.model as AttachedRealityModel).id,
          false
        );
      }

      const index = items.indexOf(entry);
      items.splice(index, 1, entry);
    }

    this.setState((_prevState) => {
      return {
        items,
      };
    });
  };

  /**
   * Disable display item in viewport.
   * @param item  RealityDataEntry to disable display for.
   */
  private _disableDisplayItems = (entries: Entry[]) => {
    if (!this._vp) return;

    const view = this._vp!.view as SpatialViewState;
    const models: ContextRealityModelState[] = [];
    view.displayStyle.forEachRealityModel(
      (modelState: ContextRealityModelState) => models.push(modelState)
    );

    entries.forEach((entry) => {
      if (entry.model) {
        const index = models.findIndex((state: ContextRealityModelState) => {
          return entry.model.url.includes(state.url);
        });
        if (-1 !== index) view.displayStyle.detachRealityModelByIndex(index);
      }
    });

    this._vp!.invalidateScene();
  };

  /** Enable all tree items and corresponding display items. */
  private _showAllRealityData = () => {
    this._setEnableMap(true);
    this._enableTreeItems(this.state.items);
    this._enableDisplayItems(this.state.items);
  };

  /** Disable all tree items and corresponding display items. */
  private _hideAllRealityData = () => {
    this._setEnableMap(false);
    this._disableTreeItems(this.state.items);
    this._disableAllDisplayItems();
  };

  /**
   * Enable or disable map.
   * @param isEnabled specifies wether to enable or disable map.
   */
  private _setEnableMap = (isEnabled: boolean) => {
    const view = this._vp!.view as SpatialViewState;
    const newFlags = view.viewFlags.clone();
    newFlags.backgroundMap = isEnabled;
    this._vp!.viewFlags = newFlags;

    if (isEnabled) {
      if (
        (view.getDisplayStyle3d().settings.backgroundMap
          .providerName as string) !== "BingProvider"
      ) {
        this._vp!.changeBackgroundMapProps({
          providerName: "BingProvider",
          providerData: { mapType: this.state.bingMapType },
        });
      }

      this._vp!.synchWithView(false);
    }

    this.setState({
      isMapEnabled: isEnabled,
    });
    this._vp!.invalidateScene();
  };

  /** Disable all display items. */
  private _disableAllDisplayItems = () => {
    if (!this._vp) return;

    const view = this._vp!.view as SpatialViewState;

    const models: ContextRealityModelState[] = [];
    view.displayStyle.forEachRealityModel(
      (modelState: ContextRealityModelState) => models.push(modelState)
    );

    for (const model of models)
      view.displayStyle.detachRealityModelByNameAndUrl(model.name, model.url);
  };

  /** Invert all tree items and corresponding display items. */
  private _invertAllRealityData = () => {
    const items = this.state.items;
    const enabledItems: Entry[] = [];
    const disabledItems: Entry[] = [];
    items.forEach((item) => {
      item.enabled ? enabledItems.push(item) : disabledItems.push(item);
    });

    this._toggleBingMap();

    this._enableTreeItems(disabledItems);
    this._enableDisplayItems(disabledItems);

    this._disableTreeItems(enabledItems);
    this._disableDisplayItems(enabledItems);
  };

  /** @hidden */
  public render() {
    const wantsHighlight = !!this.props.appContext?.features?.wantHighlighting;
    return (
      <div className="reality-data-widget">
        {!this.state.initialized && (
          <LoadingSpinner size={SpinnerSize.Medium} />
        )}
        {this.state.initialized &&
          this.state.items.length === 0 &&
          !this.fullAppContext.iModelConnection.isGeoLocated && (
            <div className="reality-data-empty-msg">
              {RealityData.translate("noneAvailable")}
            </div>
          )}
        {this.state.initialized &&
          (this.state.items.length !== 0 ||
            this.fullAppContext.iModelConnection.isGeoLocated) && (
            <div className="reality-data-viewer">
              <this._components.Header
                appContext={this.fullAppContext}
                showSearch={this.state.showSearchBox}
                visibilityButtonsWrapperRef={this._visibilityButtonsWrapper}
                onShowAll={this._showAllRealityData}
                onHideAll={this._hideAllRealityData}
                onInvertVisible={this._invertAllRealityData}
                renderSearch={this._getSearch}
                onFilterChange={this._handleSearchValueChanged}
              />
              <this._components.Content
                filter={wantsHighlight ? this.state.filter : undefined}
                appContext={this.fullAppContext}
                filteredRealityData={this._getFilteredRealityData()}
                isMapVisible={this._isMapVisible}
                isMapEnabled={this.state.isMapEnabled}
                onToggleBingMapVisibility={this._toggleBingMap}
                onOpenMapTypes={this._onShowMapTypes}
                isMapTypesOpen={this.state.showMapTypes}
                onCloseMapTypes={this._onCloseMapTypesMenu}
                bingMapType={this.state.bingMapType}
                onChangeMapType={this._onChanged}
                onOpenSettings={this._onSettingsOpened}
                onChangeItemVisibility={this._onVisibilityChange}
                isMapOnly={this.state.items.length === 0}
              />
              <SettingsManager
                opened={this.state.isSettingsOpen}
                appContext={this.fullAppContext}
                ModalDialogComponent={this._components.ModalDialog}
                onCancel={() => {
                  this.setState({ isSettingsOpen: false });
                }}
                onConfirm={() => {
                  this.setState({ isSettingsOpen: false });
                }}
              />
            </div>
          )}
      </div>
    );
  }

  private _getSearch = () => {
    const leftSpacingInPx = 6;
    const self = this;
    return (
      <div
        className="search-wrapper"
        style={{
          width:
            self.state.showSearchBox && self._visibilityButtonsWrapper.current
              ? `${
                  self._visibilityButtonsWrapper.current.parentElement!
                    .clientWidth -
                  self._visibilityButtonsWrapper.current.clientWidth -
                  leftSpacingInPx
                }px`
              : "28px",
        }}
        onClick={(e) => {
          if (!self.state.showSearchBox) {
            e.stopPropagation();
            const showSearchBox = !self.state.showSearchBox;
            self.setState({ showSearchBox }, () => {
              self._searchBox.current!.focus();
            });
          }
        }}
      >
        <SearchBox
          placeholder={RealityData.translate("search")}
          onValueChanged={self._handleSearchValueChanged}
          valueChangedDelay={250}
          onClear={() => self.setState({ showSearchBox: false })}
          ref={self._searchBox}
        />
      </div>
    );
  };

  private _handleSearchValueChanged = (value: string): void => {
    this.setState((_prevState) => {
      return {
        filter: value,
      };
    });
  };

  private _onShowMapTypes = (event: any) => {
    event.stopPropagation();
    const view = this._vp!.view as SpatialViewState;
    const mapType = view.getDisplayStyle3d().backgroundMap.settings.mapType;
    const showMapTypes = !this.state.showMapTypes;
    this.setState({
      showMapTypes,
      bingMapType: mapType,
    });
  };

  private _onChanged = (mapType: BackgroundMapType) => {
    if (!this._vp) return;

    this._vp!.changeBackgroundMapProps({ providerData: { mapType } });
    this._vp!.synchWithView(false);

    this._vp!.invalidateScene();
    this.setState({ showMapTypes: false, bingMapType: mapType });
  };

  private _onSettingsOpened = () => {
    this.fullAppContext.trackEvent({ name: "backgroundMapSettings" });
    this.setState({ isSettingsOpen: true, showMapTypes: false });
  };

  private _onCloseMapTypesMenu = () => {
    this.setState({ showMapTypes: false });
  };

  private _isMapVisible = () => {
    const mapLabel = RealityData.translate("bingMap");
    return (
      this.state.filter.length === 0 ||
      regexFromSearchQuery(this.state.filter).test(mapLabel)
    );
  };

  private _toggleBingMap = () => {
    const view = this._vp!.view as SpatialViewState;
    const newFlags = view.viewFlags.clone();
    newFlags.backgroundMap = !view.viewFlags.backgroundMap;
    this._vp!.viewFlags = newFlags;
    const isMapEnabled = this._vp!.viewFlags.backgroundMap;

    if (isMapEnabled) {
      if (
        view.getDisplayStyle3d().settings.backgroundMap.providerName !==
        "BingProvider"
      ) {
        this._vp!.changeBackgroundMapProps({
          providerName: "BingProvider",
          providerData: { mapType: this.state.bingMapType },
        });
      }

      this._vp!.synchWithView(false);
    }

    this.setState(
      { isMapEnabled },
      () => this._vp && this._vp.invalidateScene()
    );
  };

  private _getFilteredRealityData = (): Entry[] => {
    if (!this.state.filter || this.state.filter === "") return this.state.items;
    const exp = regexFromSearchQuery(this.state.filter);

    let filteredData: Entry[] = [];
    if (this.state.items) {
      filteredData = this.state.items!.filter((item) => {
        return exp.test(item.name) || exp.test(item.description);
      });
    }
    return filteredData;
  };
}

/** Reality Data Widget Control component */
export class Control extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: WidgetProps) {
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
        <Widget {...options} />
      </div>
    );
  }
}

export default Control;

ConfigurableUiManager.registerControl("RealityDataWidget", Control);
