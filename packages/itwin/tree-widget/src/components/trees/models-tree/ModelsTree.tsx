/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "../VisibilityTreeBase.scss";
import classNames from "classnames";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SelectionMode } from "@itwin/components-react";
import { isPresentationTreeNodeItem, PresentationTree } from "@itwin/presentation-components";
import { TreeWidget } from "../../../TreeWidget";
import { FilterableTreeRenderer } from "../common/TreeRenderer";
import { ClassGroupingOption } from "../common/Types";
import { useVisibilityTreeState } from "../common/UseVisibilityTreeState";
import { addCustomTreeNodeItemLabelRenderer, addTreeNodeItemCheckbox, combineTreeNodeItemCustomizations } from "../common/Utils";
import { createVisibilityTreeRenderer, FilterableVisibilityTreeNodeRenderer, VisibilityTreeNoFilteredData } from "../VisibilityTreeRenderer";
import { ModelsTreeEventHandler } from "./ModelsTreeEventHandler";
import { ModelsVisibilityHandler, SubjectModelIdsCache } from "./ModelsVisibilityHandler";
import { addModelsTreeNodeItemIcons, createRuleset, createSearchRuleset } from "./Utils";

import type { VisibilityTreeEventHandlerParams } from "../VisibilityTreeEventHandler";
import type { Ruleset, SingleSchemaClassSpecification } from "@itwin/presentation-common";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { TreeNodeItem } from "@itwin/components-react";
import type { IFilteredPresentationTreeDataProvider, PresentationTreeNodeRendererProps } from "@itwin/presentation-components";
import type { BaseFilterableTreeProps } from "../common/Types";
import type { ModelsTreeSelectionPredicate, ModelsVisibilityHandlerProps } from "./ModelsVisibilityHandler";
const PAGING_SIZE = 20;

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
  isHierarchyLevelFilteringEnabled?: boolean;
}

/**
 * A tree component that shows a subject - model - category - element
 * hierarchy along with checkboxes that represent and allow changing
 * the display of those instances.
 * @public
 */
export function ModelsTree(props: ModelsTreeProps) {
  const { isHierarchyLevelFilteringEnabled, density, height, width, selectionMode } = props;
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
        selectionMode={selectionMode || SelectionMode.None}
        treeRenderer={
          isHierarchyLevelFilteringEnabled
            ? (rendererProps) => (
                <FilterableTreeRenderer
                  {...rendererProps}
                  {...baseRendererProps}
                  nodeLoader={state.nodeLoader}
                  nodeRenderer={(nodeProps) => <ModelsTreeNodeRenderer {...nodeProps} density={density} />}
                />
              )
            : createVisibilityTreeRenderer(baseRendererProps)
        }
        noDataRenderer={isFilterApplied ? noFilteredDataRenderer : undefined}
        width={width}
        height={height}
      />
      {overlay}
    </div>
  );
}

function ModelsTreeNodeRenderer(props: PresentationTreeNodeRendererProps & { density?: "default" | "enlarged" }) {
  return (
    <FilterableVisibilityTreeNodeRenderer
      {...props}
      iconsEnabled={true}
      descriptionEnabled={false}
      levelOffset={10}
      disableRootNodeCollapse={true}
      isEnlarged={props.density === "enlarged"}
    />
  );
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
