/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { PropertyValueFormat } from "@itwin/appui-abstract";
import type {
  AbstractTreeNodeLoaderWithProvider,
  DelayLoadedTreeNodeItem,
  HighlightableTreeProps,
  ITreeDataProvider,
  MutableTreeModel,
  MutableTreeModelNode,
  TreeCheckboxStateChangeEventArgs,
  TreeDataProvider,
  TreeModel,
  TreeModelChanges,
  TreeNodeItem,
  TreeNodeRendererProps,
  TreeRendererProps,
} from "@itwin/components-react";
import {
  ControlledTree,
  SelectionMode,
  TreeEventHandler,
  TreeImageLoader,
  TreeModelSource,
  TreeNodeLoader,
  TreeNodeRenderer,
  TreeRenderer,
  useTreeModel,
} from "@itwin/components-react";
import type { MapSubLayerProps, SubLayerId } from "@itwin/core-common";
import type { NodeCheckboxRenderProps } from "@itwin/core-react";
import { CheckBoxState, ImageCheckBox, ResizableContainerObserver, useDisposable } from "@itwin/core-react";
import { IconButton, Input } from "@itwin/itwinui-react";
import * as React from "react";
import type { SubLayersTreeExpandMode } from "./SubLayersDataProvider";
import { SubLayersDataProvider } from "./SubLayersDataProvider";
import "./SubLayersTree.scss";
import { MapLayersUI } from "../../mapLayers";
import { SvgCheckboxDeselect, SvgCheckboxSelect, SvgVisibilityHide, SvgVisibilityShow } from "@itwin/itwinui-icons-react";

interface ToolbarProps {
  searchField?: React.ReactNode;
  children?: React.ReactNode[];
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function Toolbar(props: ToolbarProps) {
  return (
    <div className="map-manager-sublayer-tree-toolbar">
      <div className="tree-toolbar-action-buttons">{props.children}</div>
      {props.searchField && <div className="tree-toolbar-searchbox">{props.searchField}</div>}
    </div>
  );
}

export type OnSubLayerStateChangeType = (subLayerId: SubLayerId, isSelected: boolean) => void;
export interface SubLayersPanelProps extends Omit<SubLayersTreeProps, "subLayers"> {
  subLayers?: MapSubLayerProps[];
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function SubLayersPanel(props: SubLayersPanelProps) {
  const [noneAvailableLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:SubLayers.NoSubLayers"));
  if (undefined === props.subLayers || 0 === props.subLayers.length) {
    return (
      <div className="map-manager-sublayer-panel">
        <div>{noneAvailableLabel}</div>
      </div>
    );
  } else {
    return <SubLayersTree subLayers={props.subLayers} {...props} />;
  }
}

export interface SubLayersTreeProps {
  checkboxStyle: "standard" | "eye";
  expandMode: SubLayersTreeExpandMode;
  subLayers: MapSubLayerProps[];
  singleVisibleSubLayer?: boolean;
  onSubLayerStateChange?: OnSubLayerStateChangeType;
  height?: number;
  width?: number;
}

/**
 * Tree Control that displays sub-layer hierarchy
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function SubLayersTree(props: SubLayersTreeProps) {
  const [width, setWidth] = React.useState<number | undefined>(props.width);
  const [height, setHeight] = React.useState<number | undefined>(props.height);

  const [placeholderLabel] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:SubLayers.SearchPlaceholder"));
  const [noResults] = React.useState(MapLayersUI.localization.getLocalizedString("mapLayers:SubLayers.NoResults"));
  const [subLayers, setSubLayers] = React.useState(props.subLayers);
  const [layerFilterString, setLayerFilterString] = React.useState<string>("");

  // create data provider to get some nodes to show in tree
  // `React.useMemo' is used avoid creating new object on each render cycle
  // We DO want a dependency on 'layerFilterString' (event though eslint doesn't like it)..
  // each time the filter is updated the provider must be refreshed otherwise the state of model is out of synch.
  const dataProvider = React.useMemo(
    () => new SubLayersDataProvider(subLayers, props.expandMode),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subLayers, props.expandMode, layerFilterString],
  );

  const { modelSource, nodeLoader, nodeHighlightingProps } = useTreeFiltering(dataProvider, layerFilterString);

  // create custom event handler. It handles all tree event same as `TreeEventHandler` but additionally
  // it selects/deselects node when checkbox is checked/unchecked and vice versa.
  // `useDisposable` takes care of disposing old event handler when new is created in case 'nodeLoader' has changed
  // `React.useCallback` is used to avoid creating new callback that creates handler on each render
  const eventHandler = useDisposable(
    React.useCallback(
      () => new SubLayerCheckboxHandler(subLayers, props.singleVisibleSubLayer ?? false, nodeLoader, props.onSubLayerStateChange),
      [nodeLoader, subLayers, props.onSubLayerStateChange, props.singleVisibleSubLayer],
    ),
  );

  // Get an immutable tree model from the model source. The model is regenerated every time the model source
  // emits the `onModelChanged` event.
  const treeModel = useTreeModel(modelSource);
  const changeAll = React.useCallback(
    async (visible: boolean) => {
      const tmpSubLayers = [...subLayers]; // deep copy to trigger state change
      if (tmpSubLayers) {
        tmpSubLayers?.forEach((subLayer: MapSubLayerProps) => {
          subLayer.visible = visible;
        });

        setSubLayers(tmpSubLayers);
      }

      if (props.onSubLayerStateChange) {
        props.onSubLayerStateChange(-1, visible);
      }
    },
    [subLayers, props],
  );

  const handleFilterTextChanged = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setLayerFilterString(event.target.value);
  }, []);

  return (
    <>
      <div className="map-manager-sublayer-tree">
        <Toolbar
          searchField={
            <Input
              type="text"
              className="map-manager-sublayer-tree-searchbox"
              placeholder={placeholderLabel}
              value={layerFilterString}
              onChange={handleFilterTextChanged}
              size="small"
            />
          }
        >
          {props.singleVisibleSubLayer
            ? undefined
            : [
                <IconButton
                  key="show-all-btn"
                  size="small"
                  title={props.checkboxStyle === "eye" ? MapLayersUI.translate("SubLayers.AllOn") : MapLayersUI.translate("SelectFeaturesDialog.AllOn")}
                  onClick={async () => changeAll(true)}
                >
                  {props.checkboxStyle === "eye" ? <SvgVisibilityShow /> : <SvgCheckboxSelect />}
                </IconButton>,
                <IconButton
                  style={{ marginLeft: "5px" }}
                  key="hide-all-btn"
                  size="small"
                  title={props.checkboxStyle === "eye" ? MapLayersUI.translate("SubLayers.AllOff") : MapLayersUI.translate("SelectFeaturesDialog.AllOff")}
                  onClick={async () => changeAll(false)}
                >
                  {props.checkboxStyle === "eye" ? <SvgVisibilityHide /> : <SvgCheckboxDeselect />}
                </IconButton>,
              ]}
        </Toolbar>
        <div className="map-manager-sublayer-tree-content">
          {props.width === undefined && props.height === undefined && (
            <ResizableContainerObserver
              onResize={(w, h) => {
                setWidth(w);
                setHeight(h);
              }}
            />
          )}
          {width !== undefined && height !== undefined && (
            <ControlledTree
              nodeLoader={nodeLoader}
              selectionMode={SelectionMode.None}
              eventsHandler={eventHandler}
              model={treeModel}
              treeRenderer={props.checkboxStyle === "eye" ? nodeWithEyeCheckboxTreeRenderer : undefined}
              nodeHighlightingProps={nodeHighlightingProps}
              width={width}
              height={height}
              noDataRenderer={() => <p className="components-controlledTree-errorMessage">{noResults}</p>}
            />
          )}
        </div>
      </div>
    </>
  );
}

/** TreeEventHandler derived class that handler processing changes to subLayer visibility */
class SubLayerCheckboxHandler extends TreeEventHandler {
  private _removeModelChangedListener: () => void;
  private _onSubLayerStateChange?: OnSubLayerStateChangeType;
  private _subLayers: MapSubLayerProps[];
  private _singleVisibleSubLayer?: boolean;

  constructor(
    subLayers: MapSubLayerProps[],
    singleVisibleSubLayer: boolean,
    nodeLoader: AbstractTreeNodeLoaderWithProvider<TreeDataProvider>,
    onSubLayerStateChange?: OnSubLayerStateChangeType,
  ) {
    super({ modelSource: nodeLoader.modelSource, nodeLoader, collapsedChildrenDisposalEnabled: true });
    this._subLayers = subLayers;
    this._singleVisibleSubLayer = singleVisibleSubLayer;
    this._onSubLayerStateChange = onSubLayerStateChange;
    this._removeModelChangedListener = this.modelSource.onModelChanged.addListener(this.onModelChanged);
  }

  public override dispose() {
    this._removeModelChangedListener();
    super.dispose();
  }

  // Cascade state
  // Children on unnamed groups must get disabled in the tree view, because
  // they get rendered anyway.
  private cascadeStateToAllChildren(model: MutableTreeModel, parentId?: string) {
    const children = model.getChildren(parentId);
    if (children === undefined) {
      return;
    }

    for (const childID of children) {
      const childNode = childID ? model.getNode(childID) : undefined;

      if (childNode) {
        this.syncNodeStateWithParent(model, childNode);
      }

      // Drill down the tree.
      this.cascadeStateToAllChildren(model, childID);
    }
  }

  private applyMutualExclusiveState(model: MutableTreeModel, nodeId: string) {
    const changedNode = model.getNode(nodeId);
    if (changedNode?.checkbox.state === CheckBoxState.Off) {
      return;
    }

    for (const node of model.iterateTreeModelNodes()) {
      if (node.id === changedNode?.id) {
        continue;
      }

      if (node && node.checkbox.state === CheckBoxState.On) {
        node.checkbox.state = CheckBoxState.Off;
      }
    }
  }

  //-----------------------------------------------------------------------
  // Listen to model changes
  //------------------------------------------------------------------------
  // This is required because nodes are delay loaded in the model until
  // they are made visible (i.e. parent node is expanded).  So even though
  // you might have created nodes in the data provided with a proper
  // initial state, by the time it gets loaded, their state might have became
  // out of date in the TreeView's active model.  So whenever a node
  // is added, when must confirm its state matches the current model
  // (i.e. state of their parent.)
  public onModelChanged = (args: [TreeModel, TreeModelChanges]) => {
    this.modelSource.modifyModel((model) => {
      const addedNodes = args[1].addedNodeIds.map((id) => model.getNode(id));
      addedNodes.forEach((node) => {
        if (!node) {
          return;
        }

        this.syncNodeStateWithParent(model, node);
      });
    });
  };

  private static isUnnamedGroup(subLayer: MapSubLayerProps | undefined): boolean {
    if (!subLayer) {
      return false;
    }

    return (!subLayer.name || subLayer.name.length === 0) && subLayer.children !== undefined && subLayer.children.length > 0;
  }

  // Ensure the state of changed node matches the state of its parent.
  private syncNodeStateWithParent(model: MutableTreeModel, changedNode: MutableTreeModelNode) {
    // Lookup node parent. If non exists, I assume thats the root node,
    // and it must have a proper initial state.
    const parentNode = changedNode.parentId ? model.getNode(changedNode.parentId) : undefined;
    if (!parentNode) {
      return;
    }

    if (!changedNode.checkbox) {
      return;
    } // don't see why this would happen, but if there is no checkbox, we cant do much here.

    const parentLayerId = undefined !== parentNode.item.extendedData?.subLayerId ? parentNode.item.extendedData?.subLayerId : parentNode.item.id;
    const parentSubLayer = this._subLayers?.find((subLayer) => subLayer.id === parentLayerId);

    // If parent is disabled, then children must be too.
    // Also, Non-visible unnamed group must have their children disabled (unamed groups have visibility inherence)
    if (parentNode.checkbox.isDisabled || (SubLayerCheckboxHandler.isUnnamedGroup(parentSubLayer) && parentNode.checkbox.state === CheckBoxState.Off)) {
      changedNode.checkbox.isDisabled = true;
      changedNode.checkbox.state = CheckBoxState.Off;
    } else {
      // Visibility state from StyleMapLayerSettings applies
      const subLayerId = undefined !== changedNode.item.extendedData?.subLayerId ? changedNode.item.extendedData?.subLayerId : changedNode.item.id;
      const foundSubLayer = this._subLayers?.find((subLayer) => subLayer.id === subLayerId);
      changedNode.checkbox.isDisabled = false;
      changedNode.checkbox.state = foundSubLayer?.visible ? CheckBoxState.On : CheckBoxState.Off;
    }
  }

  /** Changes nodes checkboxes states until event is handled or handler is disposed */
  public override onCheckboxStateChanged({ stateChanges }: TreeCheckboxStateChangeEventArgs) {
    // call base checkbox handling
    const baseHandling = super.onCheckboxStateChanged({ stateChanges });

    // subscribe to checkbox state changes to new checkbox states and do some additional work with them
    const selectionHandling = stateChanges.subscribe({
      next: (changes) => {
        changes.forEach((change) => {
          const isSelected = change.newState === CheckBoxState.On;
          const subLayerId = undefined !== change.nodeItem.extendedData?.subLayerId ? change.nodeItem.extendedData?.subLayerId : change.nodeItem.id;

          // Get the previously visible node if we are in 'singleVisibleSubLayer' node
          let prevVisibleSubLayers: SubLayerId[] = [];
          if (this._singleVisibleSubLayer) {
            prevVisibleSubLayers = this._subLayers.reduce((filtered: SubLayerId[], subLayer) => {
              if (subLayer.visible && subLayer.id !== undefined) {
                filtered.push(subLayer.id);
              }
              return filtered;
            }, []);
          }

          // Inform caller that subLayer state is going to change (i.e. update display style state)
          if (this._onSubLayerStateChange) {
            for (const slId of prevVisibleSubLayers) {
              this._onSubLayerStateChange(slId, false);
            }

            this._onSubLayerStateChange(subLayerId, isSelected);
          }

          // Update sublayer object, otherwise state would get out of sync with DisplayStyle each time the TreeView is re-rendered
          this._subLayers?.forEach((curSubLayer) => {
            if (curSubLayer.id !== undefined) {
              if (curSubLayer.id === subLayerId) {
                curSubLayer.visible = isSelected;
              } else if (prevVisibleSubLayers.includes(curSubLayer.id)) {
                curSubLayer.visible = false;
              }
            }
          });

          // Cascade state
          this.modelSource.modifyModel((model) => {
            if (this._singleVisibleSubLayer) {
              this.applyMutualExclusiveState(model, change.nodeItem.id);
            }
            this.cascadeStateToAllChildren(model, change.nodeItem.id);
          });
        });
      },
    });
    // stop handling selection when checkboxes handling is stopped
    baseHandling?.add(selectionHandling);
    return baseHandling;
  }
}

/** Custom checkbox renderer that renders checkbox as an eye */
const eyeCheckboxRenderer = (props: NodeCheckboxRenderProps) => (
  <ImageCheckBox
    checked={props.checked}
    disabled={props.disabled}
    imageOn="icon-visibility"
    imageOff="icon-visibility-hide-2"
    onClick={props.onChange}
    tooltip={props.title}
  />
);

/** Custom node renderer. It uses default 'TreeNodeRenderer' but overrides default checkbox renderer to render checkbox as an eye */
const imageLoader = new TreeImageLoader();
const nodeWithEyeCheckboxRenderer = (props: TreeNodeRendererProps) => (
  <TreeNodeRenderer {...props} checkboxRenderer={eyeCheckboxRenderer} imageLoader={imageLoader} />
);

/** Custom tree renderer. It uses default `TreeRenderer` but overrides default node renderer to render node with custom checkbox */
const nodeWithEyeCheckboxTreeRenderer = (props: TreeRendererProps) => <TreeRenderer {...props} nodeRenderer={nodeWithEyeCheckboxRenderer} />;

function useTreeFiltering(dataProvider: ITreeDataProvider, filter: string) {
  const nodeLoader = useFilteredProvider(dataProvider, filter);
  const nodeHighlightingProps = useNodeHighlightingProps(filter);
  return {
    nodeLoader,
    modelSource: nodeLoader.modelSource,
    nodeHighlightingProps,
  };
}

function useFilteredProvider(dataProvider: ITreeDataProvider, filter: string) {
  const filteredProvider = React.useMemo(() => {
    return new FilteredTreeDataProvider(dataProvider, filter);
  }, [dataProvider, filter]);

  const nodeLoader = React.useMemo(() => {
    return new TreeNodeLoader(filteredProvider, new TreeModelSource());
  }, [filteredProvider]);

  return nodeLoader;
}

function useNodeHighlightingProps(filter: string) {
  const [nodeHighlightingProps, setNodeHighlightingProps] = React.useState<HighlightableTreeProps>();

  React.useEffect(() => {
    if (filter === "") {
      setNodeHighlightingProps(undefined);
      return;
    }
    setNodeHighlightingProps({
      searchText: filter,
      activeMatch: undefined,
    });
  }, [filter]);

  return nodeHighlightingProps;
}

class FullTreeHierarchy {
  private _dataProvider: ITreeDataProvider;
  private _hierarchy = new Map<string | undefined, DelayLoadedTreeNodeItem[]>();
  private _init: Promise<void>;

  public constructor(dataProvider: ITreeDataProvider) {
    this._dataProvider = dataProvider;

    this._init = (async () => {
      await this.initNode();
    })();
  }

  private async initNode(parent?: TreeNodeItem) {
    const nodes = await this._dataProvider.getNodes(parent);
    this._hierarchy.set(parent?.id, nodes);
    for (const node of nodes) {
      await this.initNode(node);
    }
  }

  public async getHierarchy() {
    await this._init;
    return this._hierarchy;
  }
}

class FilteredTreeHierarchy {
  private _fullHierarchy: FullTreeHierarchy;
  private _filter: string;
  private _filtered = new Map<string | undefined, DelayLoadedTreeNodeItem[]>();
  private _init: Promise<void>;

  public constructor(dataProvider: ITreeDataProvider, filter: string) {
    this._fullHierarchy = new FullTreeHierarchy(dataProvider);
    this._filter = filter;

    this._init = (async () => {
      await this.init();
    })();
  }

  private async init() {
    const hierarchy = await this._fullHierarchy.getHierarchy();
    if (this._filter === "") {
      this._filtered = hierarchy;
      return;
    }
    this.filterNodes(hierarchy);
  }

  /** Initializes `this._filtered` field. Returns a node if it matches a filter. */
  private filterNodes(hierarchy: Map<string | undefined, DelayLoadedTreeNodeItem[]>, current?: DelayLoadedTreeNodeItem): DelayLoadedTreeNodeItem | undefined {
    const matches = current ? this.matchesFilter(current) : false;
    const children = hierarchy.get(current?.id);
    if (!children) {
      return matches ? current : undefined;
    }

    const matchedChildren = new Array<DelayLoadedTreeNodeItem>();
    for (const child of children) {
      const matchedChild = this.filterNodes(hierarchy, child);
      matchedChild && matchedChildren.push(matchedChild);
    }

    const hasChildren = matchedChildren.length > 0;
    const included = matches || hasChildren;
    let filtered: DelayLoadedTreeNodeItem | undefined;
    if (included) {
      this._filtered.set(current?.id, matchedChildren);

      // Return a modified copy of current node (to persist initial hierarchy when filter is cleared).
      if (current) {
        filtered = {
          ...current,
          hasChildren,
          autoExpand: hasChildren ? true : current.autoExpand,
        };
      }
    }
    return filtered;
  }

  private matchesFilter(node: TreeNodeItem) {
    if (node.label.value.valueFormat !== PropertyValueFormat.Primitive) {
      return false;
    }

    const value = node.label.value.displayValue?.toLowerCase();
    if (!value) {
      return false;
    }
    return value.includes(this._filter.toLowerCase());
  }

  public async getHierarchy() {
    await this._init;
    return this._filtered;
  }
}

class FilteredTreeDataProvider implements ITreeDataProvider {
  private _hierarchy: FilteredTreeHierarchy;

  public constructor(parentDataProvider: ITreeDataProvider, filter: string) {
    this._hierarchy = new FilteredTreeHierarchy(parentDataProvider, filter);
  }

  public async getNodes(parent?: TreeNodeItem) {
    const hierarchy = await this._hierarchy.getHierarchy();
    const nodes = hierarchy.get(parent?.id);
    return nodes || [];
  }

  public async getNodesCount(parent?: TreeNodeItem) {
    const hierarchy = await this._hierarchy.getHierarchy();
    const nodes = hierarchy.get(parent?.id);
    return nodes?.length || 0;
  }
}
