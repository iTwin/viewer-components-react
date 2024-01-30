/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "../VisibilityTreeBase.scss";
import classNames from "classnames";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SelectionMode, TreeImageLoader, TreeRenderer } from "@itwin/components-react";
import { isPresentationTreeNodeItem, PresentationTree, PresentationTreeNodeRenderer, useFilterablePresentationTree } from "@itwin/presentation-components";
import { TreeWidget } from "../../../TreeWidget";
import { useContextMenu } from "../common/ContextMenu";
import { ClassGroupingOption } from "../common/Types";
import { useVisibilityTreeState } from "../common/UseVisibilityTreeState";
import { addCustomTreeNodeItemLabelRenderer, addTreeNodeItemCheckbox, combineTreeNodeItemCustomizations } from "../common/Utils";
import { createVisibilityTreeRenderer, VisibilityTreeNodeCheckbox, VisibilityTreeNoFilteredData } from "../VisibilityTreeRenderer";
import { ModelsTreeEventHandler } from "./ModelsTreeEventHandler";
import { ModelsVisibilityHandler, SubjectModelIdsCache } from "./ModelsVisibilityHandler";
import { addModelsTreeNodeItemIcons, createRuleset, createSearchRuleset } from "./Utils";

import type { NodeCheckboxRenderProps } from "@itwin/core-react";
import type { TreeRendererBaseProps } from "../common/TreeRenderer";
import type { VisibilityTreeEventHandlerParams } from "../VisibilityTreeEventHandler";
import type { Ruleset, SingleSchemaClassSpecification } from "@itwin/presentation-common";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { AbstractTreeNodeLoaderWithProvider, TreeModelNode, TreeNodeItem, TreeNodeRendererProps, TreeRendererProps } from "@itwin/components-react";
import type { IFilteredPresentationTreeDataProvider, IPresentationTreeDataProvider } from "@itwin/presentation-components";
import type { BaseFilterableTreeProps } from "../common/Types";
import type { ModelsTreeSelectionPredicate, ModelsVisibilityHandlerProps } from "./ModelsVisibilityHandler";
const PAGING_SIZE = 20;
const EXPANSION_TOGGLE_WIDTH = 24;
const imageLoader = new TreeImageLoader();

/**
 * Props for configuring the hierarchy in [[ModelsTree]].
 * @public
 */
export interface ModelsTreeHierarchyConfiguration {
  /** Should the tree group displayed element nodes by class. Defaults to `ClassGroupingOption.No`. */
  enableElementsClassGrouping?: ClassGroupingOption;
  /**
   * Defines the `bis.GeometricElement3d` sub-class that should be used to load element nodes.
   * Defaults to `bis.GeometricElement3d`. It's expected for the given class to derive from it.
   */
  elementClassSpecification?: SingleSchemaClassSpecification;
  /** Should the tree show models without elements. */
  showEmptyModels?: boolean;
}

/**
 * Props for [[ModelsTree]] component.
 * @public
 */
export interface ModelsTreeProps extends BaseFilterableTreeProps {
  /**
   * Predicate which indicates whether node can be selected or no
   */
  selectionPredicate?: ModelsTreeSelectionPredicate;
  /**
   * Active view used to determine and control visibility
   */
  activeView: Viewport;
  /**
   * Configuration options for the hierarchy loaded in the component.
   */
  hierarchyConfig?: ModelsTreeHierarchyConfiguration;
  /**
   * Auto-update the hierarchy when data in the iModel changes.
   * @alpha
   */
  enableHierarchyAutoUpdate?: boolean;
  /**
   * Custom visibility handler.
   */
  modelsVisibilityHandler?: ModelsVisibilityHandler | ((props: ModelsVisibilityHandlerProps) => ModelsVisibilityHandler);
  /**
   * Flag that determines if hierarchy level filtering will be enabled for this tree.
   * @beta
   */
  isHierarchyFilteringEnabled?: boolean;
}

/**
 * A tree component that shows a subject - model - category - element
 * hierarchy along with checkboxes that represent and allow changing
 * the display of those instances.
 * This tree can have hierarchy level filtering capabilities enabled with the isHierarchyLevelFilteringEnabled flag.
 * @public
 */
export function ModelsTree(props: ModelsTreeProps) {
  const state = useModelsTreeState(props);

  const baseRendererProps = {
    contextMenuItems: props.contextMenuItems,
    nodeLabelRenderer: props.nodeLabelRenderer,
    density: props.density,
    nodeRendererProps: {
      iconsEnabled: true,
      descriptionEnabled: false,
      levelOffset: 10,
      disableRootNodeCollapse: true,
    },
  };

  // istanbul ignore next
  const noFilteredDataRenderer = useCallback(() => {
    return (
      <VisibilityTreeNoFilteredData title={TreeWidget.translate("modelTree.noModelFound")} message={TreeWidget.translate("modelTree.noMatchingModelNames")} />
    );
  }, []);

  if (!state) {
    return null;
  }

  const isFilterApplied = state.filteringResult?.filteredProvider !== undefined;
  const overlay = state.filteringResult?.isFiltering ? <div className="filteredTreeOverlay" /> : undefined;
  return (
    <div className={classNames("tree-widget-visibility-tree-base", "tree-widget-tree-container")}>
      <PresentationTree
        state={state}
        selectionMode={props.selectionMode || SelectionMode.None}
        treeRenderer={
          props.isHierarchyFilteringEnabled ? createModelsTreeRenderer(baseRendererProps, state?.nodeLoader) : createVisibilityTreeRenderer(baseRendererProps)
        }
        noDataRenderer={isFilterApplied ? noFilteredDataRenderer : undefined}
        width={props.width}
        height={props.height}
      />
      {overlay}
    </div>
  );
}

interface ModelsTreeRendererProps extends TreeRendererBaseProps {
  nodeRendererProps: ModelsTreeNodeRendererProps;
}

function createModelsTreeRenderer(
  { nodeRendererProps, ...restProps }: ModelsTreeRendererProps,
  nodeLoader: AbstractTreeNodeLoaderWithProvider<IPresentationTreeDataProvider>,
) {
  return function ModelsTreeRenderer(treeProps: TreeRendererProps) {
    const { onContextMenu, renderContextMenu } = useContextMenu({ contextMenuItems: restProps.contextMenuItems });
    const { onClearFilterClick, onFilterClick, filterDialog, containerRef } = useFilterablePresentationTree<HTMLDivElement>({ nodeLoader });
    const isEnlarged = restProps.density === "enlarged";
    const className = classNames("tree-widget-tree-nodes-list", { ["enlarge"]: isEnlarged });

    if (isEnlarged) {
      treeProps.nodeHeight = () => 43;
    }

    return (
      <div className={className} ref={containerRef}>
        <TreeRenderer
          {...restProps}
          {...treeProps}
          nodeRenderer={createModelsTreeNodeRenderer(
            { ...nodeRendererProps, isEnlarged },
            {
              onClearFilterClick,
              onFilterClick,
              onContextMenu,
            },
          )}
        />
        {renderContextMenu()}
        {filterDialog}
      </div>
    );
  };
}

interface ModelsTreeNodeActions {
  onClearFilterClick: (nodeId: string) => void;

  onFilterClick: (nodeId: string) => void;

  onContextMenu: (e: React.MouseEvent, node: TreeModelNode) => void;
}

export interface ModelsTreeNodeRendererProps {
  iconsEnabled: boolean;

  descriptionEnabled: boolean;

  levelOffset: number;

  disableRootNodeCollapse: boolean;

  isEnlarged?: boolean;
}

/**
 * Creates node renderer which renders node with eye checkbox.
 * @public
 */
function createModelsTreeNodeRenderer(
  { levelOffset, disableRootNodeCollapse, descriptionEnabled, isEnlarged }: ModelsTreeNodeRendererProps,
  { onClearFilterClick, onFilterClick, onContextMenu }: ModelsTreeNodeActions,
) {
  return function ModelsTreeNodeRenderer(treeNodeProps: TreeNodeRendererProps) {
    const expansionToggleWidth = isEnlarged ? EXPANSION_TOGGLE_WIDTH * 2 : EXPANSION_TOGGLE_WIDTH;
    const nodeOffset = treeNodeProps.node.depth * levelOffset + (treeNodeProps.node.numChildren === 0 ? expansionToggleWidth : 0);

    return (
      <PresentationTreeNodeRenderer
        {...treeNodeProps}
        onContextMenu={onContextMenu}
        onFilterClick={onFilterClick}
        onClearFilterClick={onClearFilterClick}
        checkboxRenderer={(checkboxProps: NodeCheckboxRenderProps) => (
          <div className="visibility-tree-checkbox-container" style={{ marginRight: `${nodeOffset}px` }}>
            <VisibilityTreeNodeCheckbox {...checkboxProps} />
          </div>
        )}
        descriptionEnabled={descriptionEnabled}
        imageLoader={imageLoader}
        className={classNames(
          "with-checkbox",
          (treeNodeProps.node.numChildren === 0 || (disableRootNodeCollapse && treeNodeProps.node.parentId === undefined)) && "disable-expander",
        )}
        node={{ ...treeNodeProps.node, depth: 0 }}
      />
    );
  };
}

function useModelsTreeState({ filterInfo, onFilterApplied, ...props }: ModelsTreeProps) {
  const rulesets = {
    general: useMemo(
      () =>
        createRuleset({
          enableElementsClassGrouping: !!props.hierarchyConfig?.enableElementsClassGrouping,
          elementClassSpecification: props.hierarchyConfig?.elementClassSpecification,
          showEmptyModels: props.hierarchyConfig?.showEmptyModels,
        }),
      [props.hierarchyConfig?.enableElementsClassGrouping, props.hierarchyConfig?.elementClassSpecification, props.hierarchyConfig?.showEmptyModels],
    ),
    search: useMemo(
      () =>
        createSearchRuleset({
          elementClassSpecification: props.hierarchyConfig?.elementClassSpecification,
          showEmptyModels: props.hierarchyConfig?.showEmptyModels,
        }),
      [props.hierarchyConfig?.elementClassSpecification, props.hierarchyConfig?.showEmptyModels],
    ),
  };

  const treeState = useTreeState({
    ...props,
    ruleset: rulesets.general,
  });

  const filteredTreeState = useTreeState({
    ...props,
    ruleset: rulesets.search,
    filterInfo,
    onFilterApplied,
  });

  return filterInfo?.filter ? filteredTreeState : treeState;
}

interface UseTreeProps extends ModelsTreeProps {
  ruleset: Ruleset;
}

function useTreeState({
  modelsVisibilityHandler,
  activeView,
  selectionPredicate,
  hierarchyConfig,
  iModel,
  ruleset,
  enableHierarchyAutoUpdate,
  filterInfo,
  onFilterApplied,
}: UseTreeProps) {
  const visibilityHandler = useVisibilityHandler(ruleset.id, iModel, activeView, modelsVisibilityHandler);
  const selectionPredicateRef = useRef(selectionPredicate);
  useEffect(() => {
    selectionPredicateRef.current = selectionPredicate;
  }, [selectionPredicate]);

  const onFilterChange = useCallback(
    (dataProvider?: IFilteredPresentationTreeDataProvider, matchesCount?: number) => {
      if (onFilterApplied && dataProvider && matchesCount !== undefined) {
        onFilterApplied(dataProvider, matchesCount);
      }

      if (visibilityHandler) {
        visibilityHandler.setFilteredDataProvider(dataProvider);
      }
    },
    [onFilterApplied, visibilityHandler],
  );

  return useVisibilityTreeState({
    imodel: iModel,
    ruleset,
    pagingSize: PAGING_SIZE,
    appendChildrenCountForGroupingNodes: hierarchyConfig?.enableElementsClassGrouping === ClassGroupingOption.YesWithCounts,
    enableHierarchyAutoUpdate,
    customizeTreeNodeItem,
    visibilityHandler,
    filterInfo,
    onFilterChange,
    selectionPredicate: useCallback(
      (node: TreeNodeItem) =>
        !selectionPredicateRef.current || !isPresentationTreeNodeItem(node)
          ? true
          : selectionPredicateRef.current(node.key, ModelsVisibilityHandler.getNodeType(node)),
      [],
    ),
    eventHandler: eventHandlerFactory,
  });
}

function eventHandlerFactory(props: VisibilityTreeEventHandlerParams) {
  return new ModelsTreeEventHandler(props);
}

function useVisibilityHandler(
  rulesetId: string,
  iModel: IModelConnection,
  activeView: Viewport,
  visibilityHandler?: ModelsVisibilityHandler | ((props: ModelsVisibilityHandlerProps) => ModelsVisibilityHandler),
  hierarchyAutoUpdateEnabled?: boolean,
) {
  const subjectModelIdsCache = useMemo(() => new SubjectModelIdsCache(iModel), [iModel]);
  const [state, setState] = useState<ModelsVisibilityHandler>();

  useEffect(() => {
    if (visibilityHandler && typeof visibilityHandler !== "function") {
      return;
    }

    const visibilityHandlerProps: ModelsVisibilityHandlerProps = {
      rulesetId,
      viewport: activeView,
      hierarchyAutoUpdateEnabled,
      subjectModelIdsCache,
    };

    const handler = visibilityHandler ? visibilityHandler(visibilityHandlerProps) : new ModelsVisibilityHandler(visibilityHandlerProps);
    setState(handler);
    return () => {
      handler.dispose();
    };
  }, [rulesetId, activeView, hierarchyAutoUpdateEnabled, subjectModelIdsCache, visibilityHandler]);

  return visibilityHandler && typeof visibilityHandler !== "function" ? visibilityHandler : state;
}

const customizeTreeNodeItem = combineTreeNodeItemCustomizations([addCustomTreeNodeItemLabelRenderer, addTreeNodeItemCheckbox, addModelsTreeNodeItemIcons]);
