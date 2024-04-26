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
import { usePerformanceReporting } from "../common/UsePerformanceReporting";
import { useVisibilityTreeState } from "../common/UseVisibilityTreeState";
import { addCustomTreeNodeItemLabelRenderer, addTreeNodeItemCheckbox, combineTreeNodeItemCustomizations } from "../common/Utils";
import { createVisibilityTreeRenderer, FilterableVisibilityTreeNodeRenderer, VisibilityTreeNoFilteredData } from "../VisibilityTreeRenderer";
import { createHierarchyBasedVisibilityHandler } from "./HierarchyBasedVisibilityHandler";
import { createElementIdsCache } from "./internal/ElementIdsCache";
import { createQueryHandler } from "./internal/QueryHandler";
import { createSubjectModelIdsCache } from "./internal/SubjectModelIdsCache";
import { addModelsTreeNodeItemIcons, createRuleset, createSearchRuleset } from "./internal/Utils";
import { ModelsTreeComponent } from "./ModelsTreeComponent";
import { ModelsTreeEventHandler } from "./ModelsTreeEventHandler";
import { ModelsVisibilityHandler } from "./ModelsVisibilityHandler";
import { NodeUtils } from "./NodeUtils";

import type { HierarchyBasedVisibilityHandlerProps, IHierarchyBasedVisibilityHandler } from "./HierarchyBasedVisibilityHandler";
import type { ModelsTreeNodeType } from "./NodeUtils";
import type { VisibilityTreeEventHandlerParams } from "../VisibilityTreeEventHandler";
import type { NodeKey, Ruleset, SingleSchemaClassSpecification } from "@itwin/presentation-common";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { TreeNodeItem } from "@itwin/components-react";
import type { IFilteredPresentationTreeDataProvider, PresentationTreeNodeRendererProps } from "@itwin/presentation-components";
import type { BaseFilterableTreeProps, HierarchyLevelConfig } from "../common/Types";
import type { ModelsVisibilityHandlerProps } from "./ModelsVisibilityHandler";
const PAGING_SIZE = 20;

/**
 * Type definition of predicate used to decide if node can be selected
 * @public
 */
export type ModelsTreeSelectionPredicate = (key: NodeKey, type: ModelsTreeNodeType) => boolean;

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
   * @deprecated in 2.0.1. It does not have any effect, auto update is always on.
   */
  enableHierarchyAutoUpdate?: boolean;
  /**
   * Custom visibility handler.
   * @deprecated in 3.x. Use [[hierarchyBasedVisibilityHandler]] instead.
   */
  // eslint-disable-next-line deprecation/deprecation
  modelsVisibilityHandler?: ModelsVisibilityHandler | ((props: ModelsVisibilityHandlerProps) => ModelsVisibilityHandler);
  /**
   * Custom visibility handler.
   */
  hierarchyBasedVisibilityHandler?: IHierarchyBasedVisibilityHandler | ((props: HierarchyBasedVisibilityHandlerProps) => IHierarchyBasedVisibilityHandler);
  /**
   * Props for configuring hierarchy level.
   * @beta
   */
  hierarchyLevelConfig?: HierarchyLevelConfig;
  /**
   * Reports performance of a feature.
   * @param featureId ID of the feature.
   * @param elapsedTime Elapsed time of the feature.
   * @beta
   */
  onPerformanceMeasured?: (featureId: string, elapsedTime: number) => void;
}

/**
 * A tree component that shows a subject - model - category - element
 * hierarchy along with checkboxes that represent and allow changing
 * the display of those instances.
 * @public
 */
export function ModelsTree(props: ModelsTreeProps) {
  const { hierarchyLevelConfig, density, height, width, selectionMode } = props;
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
          hierarchyLevelConfig?.isFilteringEnabled
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

interface UseVisibilityHandlerProps {
  rulesetId: string;
  iModel: IModelConnection;
  activeView: Viewport;
  hierarchyAutoUpdateEnabled?: boolean;
  legacyHandler?: UseTreeProps["modelsVisibilityHandler"];
}

function useTreeState({
  // eslint-disable-next-line deprecation/deprecation
  modelsVisibilityHandler,
  hierarchyBasedVisibilityHandler,
  activeView,
  selectionPredicate,
  hierarchyConfig,
  iModel,
  ruleset,
  filterInfo,
  onFilterApplied,
  hierarchyLevelConfig,
  onPerformanceMeasured,
}: UseTreeProps) {
  const commonHandlerProps = {
    rulesetId: ruleset.id,
    iModel,
    activeView,
  };
  const legacyVisibilityHandler = useLegacyVisibilityHandler({
    ...commonHandlerProps,
    legacyHandler: modelsVisibilityHandler,
    hierarchyAutoUpdateEnabled: true,
  });

  const hierarchyVisibilityHandler = useHierarchyBasedVisibilityHandler({
    ...commonHandlerProps,
    legacyHandler: modelsVisibilityHandler,
    hierarchyBasedHandler: hierarchyBasedVisibilityHandler,
    hierarchyAutoUpdateEnabled: true,
  });

  const selectionPredicateRef = useRef(selectionPredicate);
  useEffect(() => {
    selectionPredicateRef.current = selectionPredicate;
  }, [selectionPredicate]);

  const onFilterChange = useCallback(
    (dataProvider?: IFilteredPresentationTreeDataProvider, matchesCount?: number) => {
      if (onFilterApplied && dataProvider && matchesCount !== undefined) {
        onFilterApplied(dataProvider, matchesCount);
      }

      // eslint-disable-next-line deprecation/deprecation
      if (legacyVisibilityHandler) {
        legacyVisibilityHandler.setFilteredDataProvider(dataProvider);
      }

      if (hierarchyVisibilityHandler) {
        hierarchyVisibilityHandler.filteredDataProvider = dataProvider;
      }
    },
    [onFilterApplied, legacyVisibilityHandler, hierarchyVisibilityHandler],
  );

  const reporting = usePerformanceReporting({
    treeIdentifier: ModelsTreeComponent.id,
    onPerformanceMeasured,
  });

  return useVisibilityTreeState({
    imodel: iModel,
    ruleset,
    pagingSize: PAGING_SIZE,
    appendChildrenCountForGroupingNodes: hierarchyConfig?.enableElementsClassGrouping === ClassGroupingOption.YesWithCounts,
    enableHierarchyAutoUpdate: true,
    customizeTreeNodeItem,
    visibilityHandler: legacyVisibilityHandler ?? hierarchyVisibilityHandler,
    filterInfo,
    onFilterChange,
    selectionPredicate: useCallback(
      (node: TreeNodeItem) =>
        !selectionPredicateRef.current || !isPresentationTreeNodeItem(node) ? true : selectionPredicateRef.current(node.key, NodeUtils.getNodeType(node)),
      [],
    ),
    eventHandler: eventHandlerFactory,
    hierarchyLevelSizeLimit: hierarchyLevelConfig?.sizeLimit,
    onNodeLoaded: filterInfo ? undefined : reporting.onNodeLoaded,
  });
}

function eventHandlerFactory(props: VisibilityTreeEventHandlerParams) {
  return new ModelsTreeEventHandler(props);
}

function useLegacyVisibilityHandler({ legacyHandler, rulesetId, activeView, hierarchyAutoUpdateEnabled, iModel }: UseVisibilityHandlerProps) {
  const subjectModelIdsCache = useMemo(() => createSubjectModelIdsCache(createQueryHandler(iModel)), [iModel]);
  // eslint-disable-next-line deprecation/deprecation
  const [state, setState] = useState<ModelsVisibilityHandler>();

  useEffect(() => {
    // eslint-disable-next-line deprecation/deprecation
    if (legacyHandler && typeof legacyHandler !== "function") {
      return;
    }

    // eslint-disable-next-line deprecation/deprecation
    const visibilityHandlerProps: ModelsVisibilityHandlerProps = {
      rulesetId,
      viewport: activeView,
      hierarchyAutoUpdateEnabled,
      subjectModelIdsCache,
    };

    // eslint-disable-next-line deprecation/deprecation
    const handler = legacyHandler ? legacyHandler(visibilityHandlerProps) : new ModelsVisibilityHandler(visibilityHandlerProps);
    setState(handler);
    return () => {
      handler.dispose();
    };
  }, [rulesetId, activeView, hierarchyAutoUpdateEnabled, subjectModelIdsCache, legacyHandler]);

  return legacyHandler && typeof legacyHandler !== "function" ? legacyHandler : state;
}

function useHierarchyBasedVisibilityHandler({
  legacyHandler,
  hierarchyBasedHandler,
  rulesetId,
  activeView,
  hierarchyAutoUpdateEnabled,
  iModel,
}: UseVisibilityHandlerProps & {
  hierarchyBasedHandler?: UseTreeProps["hierarchyBasedVisibilityHandler"];
}) {
  const [state, setState] = useState<IHierarchyBasedVisibilityHandler>();
  const queryHandler = useMemo(() => createQueryHandler(iModel), [iModel]);
  const subjectModelIdsCache = useMemo(() => createSubjectModelIdsCache(createQueryHandler(iModel)), [iModel]);
  const elementIdsCache = useMemo(() => createElementIdsCache(iModel, rulesetId), [iModel, rulesetId]);

  useEffect(() => {
    if (legacyHandler || (hierarchyBasedHandler && typeof hierarchyBasedHandler !== "function")) {
      return;
    }

    const visibilityHandlerProps: HierarchyBasedVisibilityHandlerProps = {
      viewport: activeView,
      subjectModelIdsCache,
      elementIdsCache,
      queryHandler,
      hierarchyAutoUpdateEnabled,
    };

    const handler = hierarchyBasedHandler ? hierarchyBasedHandler(visibilityHandlerProps) : createHierarchyBasedVisibilityHandler(visibilityHandlerProps);
    setState(handler);
    return () => {
      handler.dispose();
    };
  }, [rulesetId, activeView, hierarchyAutoUpdateEnabled, queryHandler, subjectModelIdsCache, elementIdsCache, legacyHandler, hierarchyBasedHandler]);

  if (legacyHandler) {
    return undefined;
  }

  return hierarchyBasedHandler && typeof hierarchyBasedHandler !== "function" ? hierarchyBasedHandler : state;
}

const customizeTreeNodeItem = combineTreeNodeItemCustomizations([addCustomTreeNodeItemLabelRenderer, addTreeNodeItemCheckbox, addModelsTreeNodeItemIcons]);
