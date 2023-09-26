/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "../VisibilityTreeBase.scss";
import classNames from "classnames";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ControlledTree, SelectionMode, useTreeModel } from "@itwin/components-react";
import { useDisposable } from "@itwin/core-react";
import { isPresentationTreeNodeItem, usePresentationTreeNodeLoader } from "@itwin/presentation-components";
import { TreeWidget } from "../../../TreeWidget";
import { ClassGroupingOption } from "../common/Types";
import { addCustomTreeNodeItemLabelRenderer, addTreeNodeItemCheckbox, combineTreeNodeItemCustomizations } from "../common/Utils";
import { VisibilityTreeEventHandler } from "../VisibilityTreeEventHandler";
import { createVisibilityTreeRenderer, useVisibilityTreeFiltering, VisibilityTreeNoFilteredData } from "../VisibilityTreeRenderer";
import { ModelsVisibilityHandler, SubjectModelIdsCache } from "./ModelsVisibilityHandler";
import { addModelsTreeNodeItemIcons, createRuleset, createSearchRuleset } from "./Utils";

import type { SingleSchemaClassSpecification } from "@itwin/presentation-common";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { IFilteredPresentationTreeDataProvider, IPresentationTreeDataProvider } from "@itwin/presentation-components";
import type { BaseFilterableTreeProps } from "../common/Types";
import type { ModelsTreeSelectionPredicate } from "./ModelsVisibilityHandler";

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
  modelsVisibilityHandler?: ModelsVisibilityHandler;
}

/**
 * A tree component that shows a subject - model - category - element
 * hierarchy along with checkboxes that represent and allow changing
 * the display of those instances.
 * @public
 */
export function ModelsTree(props: ModelsTreeProps) {
  const { nodeLoader, onItemsRendered } = useModelsTreeNodeLoader(props);
  const [ objectsOutsideExtents, setObjectsOutsideExtents ] = useState(new Set<string>());
  const { filteredNodeLoader, isFiltering, nodeHighlightingProps } = useVisibilityTreeFiltering(nodeLoader, props.filterInfo, props.onFilterApplied);
  const filterApplied = filteredNodeLoader !== nodeLoader;

  const { activeView, modelsVisibilityHandler, selectionPredicate } = props;

  useEffect(() => {
    const getOuterSpatialElements = async () => {
      const range = props.iModel.projectExtents;
      const queryToFetchElementIds = `SELECT e.ECInstanceId, e.Model.Id 
        FROM bis.SpatialElement e JOIN bis.SpatialIndex i 
        ON e.ECInstanceId=i.ECInstanceId 
        WHERE NOT 
        (i.MinX<=${range.xHigh} AND i.MinY<=${range.yHigh} AND i.MinZ<=${range.zHigh} AND 
        i.MaxX >= ${range.xLow} AND i.MaxY >= ${range.yLow} AND i.MaxZ >= ${range.zLow})`;
      const elementIdsOutsideExtents = new Set<string>();
      const modelIds = new Set<string>();
      const subjectRefs = new Set<string>();

      for await (const element of props.iModel.createQueryReader(queryToFetchElementIds)) {
        elementIdsOutsideExtents.add(element[0] as string);
        modelIds.add(element[1] as string);
      }

      const queryToFetchSubjectRefs = `SELECT p.Parent.Id 
        FROM bis.InformationPartitionElement p INNER JOIN bis.GeometricModel3d m 
        ON m.ModeledElement.Id = p.ECInstanceId 
        WHERE NOT m.IsPrivate AND p.ECInstanceId IN (${Array.from(modelIds)})`;
      for await (const result of props.iModel.createQueryReader(queryToFetchSubjectRefs)) {
        subjectRefs.add(result[0] as string);
      }

      const queryToFetchSpatialCategoryIds = `SELECT DISTINCT TargetECInstanceId 
        FROM bis.GeometricElement3dIsInCategory 
        WHERE ECInstanceId in (${Array.from(elementIdsOutsideExtents)})`;
      for await (const result of props.iModel.createQueryReader(queryToFetchSpatialCategoryIds)) {
        elementIdsOutsideExtents.add(result[0] as string);
      }

      // element nesting child physical elements
      await recursivelyGetParentPhysicalElements(props.iModel, elementIdsOutsideExtents);
      // subject nesting child subjects
      await recursivelyGetParentPhysicalElements(props.iModel, subjectRefs);

      await recursivelyGetRootRefs(props.iModel, subjectRefs);
      setObjectsOutsideExtents(new Set([...elementIdsOutsideExtents, ...subjectRefs]));
    };

    void getOuterSpatialElements();
  }, [props.iModel, props.iModel.models]);

  const visibilityHandler = useVisibilityHandler(
    nodeLoader.dataProvider.rulesetId,
    props.iModel,
    activeView,
    modelsVisibilityHandler,
    getFilteredDataProvider(filteredNodeLoader.dataProvider),
    props.enableHierarchyAutoUpdate);
  const eventHandler = useDisposable(useCallback(() => new VisibilityTreeEventHandler({
    nodeLoader: filteredNodeLoader,
    visibilityHandler,
    selectionPredicate: (node) => !selectionPredicate || !isPresentationTreeNodeItem(node) ? true : selectionPredicate(node.key, ModelsVisibilityHandler.getNodeType(node)),
  }), [filteredNodeLoader, visibilityHandler, selectionPredicate]));

  const treeModel = useTreeModel(filteredNodeLoader.modelSource);
  const treeRenderer = createVisibilityTreeRenderer({
    contextMenuItems: props.contextMenuItems,
    nodeLabelRenderer: props.nodeLabelRenderer,
    density: props.density,
    nodeRendererProps: {
      iconsEnabled: true,
      descriptionEnabled: false,
      levelOffset: 10,
      disableRootNodeCollapse: true,
      objectsOutsideExtents,
    },
  });

  const overlay = isFiltering ? <div className="filteredTreeOverlay" /> : undefined;

  // istanbul ignore next
  const noFilteredDataRenderer = useCallback(() => {
    return <VisibilityTreeNoFilteredData
      title={TreeWidget.translate("modelTree.noModelFound")}
      message={TreeWidget.translate("modelTree.noMatchingModelNames")}
    />;
  }, []);

  return (
    <div className={classNames("tree-widget-visibility-tree-base", "tree-widget-tree-container")}>
      <ControlledTree
        nodeLoader={filteredNodeLoader}
        model={treeModel}
        selectionMode={props.selectionMode || SelectionMode.None}
        eventsHandler={eventHandler}
        treeRenderer={treeRenderer}
        nodeHighlightingProps={nodeHighlightingProps}
        noDataRenderer={filterApplied ? noFilteredDataRenderer : undefined}
        onItemsRendered={onItemsRendered}
        width={props.width}
        height={props.height}
      />
      {overlay}
    </div>
  );
}

const recursivelyGetRootRefs = async (iModel: IModelConnection, trackingSet: Set<string>) => {
  const queryToFetchParentOfRef = `SELECT Parent.Id parentId FROM bis.Subject WHERE ECInstanceId IN (${Array.from(trackingSet)})`;

  for await (const result of iModel.createQueryReader(queryToFetchParentOfRef)) {
    const parentId = result[0] as string;
    if(parentId === "0x1"){
      return;
    }
    trackingSet.add(parentId);
  }
  await recursivelyGetRootRefs(iModel, trackingSet);
};

const recursivelyGetParentPhysicalElements = async (iModel: IModelConnection, trackingSet: Set<string>) => {
  const queryToFetchParentOfNestElementIds = `SELECT DISTINCT SourceECInstanceId 
    FROM bis.ElementOwnsChildElements 
    WHERE TargetECInstanceId IN (${Array.from(trackingSet)})`;
  const initialSize = trackingSet.size;
  for await (const result of iModel.createQueryReader(queryToFetchParentOfNestElementIds)) {
    const parentId = result[0] as string;
    parentId === "0x1" ? null : trackingSet.add(parentId);
  }

  if(initialSize === trackingSet.size) {
    return;
  }
  await recursivelyGetParentPhysicalElements(iModel, trackingSet);
};

const customizeTreeNodeItem = combineTreeNodeItemCustomizations([
  addCustomTreeNodeItemLabelRenderer,
  addTreeNodeItemCheckbox,
  addModelsTreeNodeItemIcons,
]);

function useModelsTreeNodeLoader(props: ModelsTreeProps) {
  const rulesets = {
    general: useMemo(() => createRuleset({
      enableElementsClassGrouping: !!props.hierarchyConfig?.enableElementsClassGrouping,
      elementClassSpecification: props.hierarchyConfig?.elementClassSpecification,
      showEmptyModels: props.hierarchyConfig?.showEmptyModels,
    }), [props.hierarchyConfig?.enableElementsClassGrouping, props.hierarchyConfig?.elementClassSpecification, props.hierarchyConfig?.showEmptyModels]),
    search: useMemo(() => createSearchRuleset({
      elementClassSpecification: props.hierarchyConfig?.elementClassSpecification,
      showEmptyModels: props.hierarchyConfig?.showEmptyModels,
    }), [props.hierarchyConfig?.elementClassSpecification, props.hierarchyConfig?.showEmptyModels]),
  };

  const { nodeLoader, onItemsRendered } = usePresentationTreeNodeLoader({
    imodel: props.iModel,
    ruleset: rulesets.general,
    appendChildrenCountForGroupingNodes: (props.hierarchyConfig?.enableElementsClassGrouping === ClassGroupingOption.YesWithCounts),
    pagingSize: PAGING_SIZE,
    enableHierarchyAutoUpdate: props.enableHierarchyAutoUpdate,
    customizeTreeNodeItem,
  });
  const { nodeLoader: searchNodeLoader, onItemsRendered: onSearchItemsRendered } = usePresentationTreeNodeLoader({
    imodel: props.iModel,
    ruleset: rulesets.search,
    pagingSize: PAGING_SIZE,
    enableHierarchyAutoUpdate: props.enableHierarchyAutoUpdate,
    customizeTreeNodeItem,
  });

  const activeNodeLoader = props.filterInfo?.filter ? searchNodeLoader : nodeLoader;
  const activeItemsRenderedCallback = props.filterInfo?.filter ? onSearchItemsRendered : onItemsRendered;

  return {
    nodeLoader: activeNodeLoader,
    onItemsRendered: activeItemsRenderedCallback,
  };
}

function useVisibilityHandler(
  rulesetId: string,
  iModel: IModelConnection,
  activeView: Viewport,
  visibilityHandler?: ModelsVisibilityHandler,
  filteredDataProvider?: IFilteredPresentationTreeDataProvider,
  hierarchyAutoUpdateEnabled?: boolean,
) {
  const subjectModelIdsCache = useMemo(() => new SubjectModelIdsCache(iModel), [iModel]);

  const defaultVisibilityHandler = useDisposable(useCallback(
    () =>
      new ModelsVisibilityHandler({ rulesetId, viewport: activeView, hierarchyAutoUpdateEnabled, subjectModelIdsCache }),
    [rulesetId, activeView, subjectModelIdsCache, hierarchyAutoUpdateEnabled])
  );

  const handler = visibilityHandler ?? defaultVisibilityHandler;

  useEffect(() => {
    handler && handler.setFilteredDataProvider(filteredDataProvider);
  }, [handler, filteredDataProvider]);

  return handler;
}

const isFilteredDataProvider = (dataProvider: IPresentationTreeDataProvider | IFilteredPresentationTreeDataProvider): dataProvider is IFilteredPresentationTreeDataProvider => {
  const filteredProvider = dataProvider as IFilteredPresentationTreeDataProvider;
  return filteredProvider.nodeMatchesFilter !== undefined && filteredProvider.getActiveMatch !== undefined && filteredProvider.countFilteringResults !== undefined;
};

const getFilteredDataProvider = (dataProvider: IPresentationTreeDataProvider | IFilteredPresentationTreeDataProvider): IFilteredPresentationTreeDataProvider | undefined => {
  return isFilteredDataProvider(dataProvider) ? dataProvider : undefined;
};
