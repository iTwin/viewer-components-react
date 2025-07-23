/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Id64Array, Id64String } from "@itwin/core-bentley";
import { useEffect, useMemo, useState } from "react";
import { HierarchyNodeIdentifier, HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { useFocusedInstancesContext } from "../../common/FocusedInstancesContext.js";
import { CLASS_NAME_GeometricModel3d, CLASS_NAME_Subject } from "../../common/internal/ClassNameDefinitions.js";
import { FilterLimitExceededError } from "../../common/TreeErrors.js";
import { useTelemetryContext } from "../../common/UseTelemetryContext.js";
import { ModelsTreeDefinition } from "../ModelsTreeDefinition.js";

import type { GroupingHierarchyNode, HierarchyFilteringPath, InstancesNodeKey } from "@itwin/presentation-hierarchies";
import type { VisibilityTreeProps } from "../../common/components/VisibilityTree.js";
import type { ECClassHierarchyInspector, InstanceKey } from "@itwin/presentation-shared";
import type { ClassGroupingHierarchyNode, ElementsGroupInfo, ModelsTreeHierarchyConfiguration } from "../ModelsTreeDefinition.js";
import type { ModelsTreeIdsCache } from "./ModelsTreeIdsCache.js";

/** @internal */
export type ModelsTreeFilteringError = "tooManyFilterMatches" | "tooManyInstancesFocused" | "unknownFilterError" | "unknownInstanceFocusError";

/** @internal */
export function useFilteredPaths({
  hierarchyConfiguration,
  filter,
  getFilteredPaths,
  getModelsTreeIdsCache,
  onModelsFiltered,
  onFilteredPathsChanged,
}: {
  hierarchyConfiguration: ModelsTreeHierarchyConfiguration;
  filter?: string;
  getFilteredPaths?: (props: {
    /** A function that creates filtering paths based on provided target instance keys or node label. */
    createInstanceKeyPaths: (props: { targetItems: Array<InstanceKey | ElementsGroupInfo> } | { label: string }) => Promise<HierarchyFilteringPath[]>;
    /** Filter which would be used to create filter paths if `getFilteredPaths` wouldn't be provided. */
    filter?: string;
  }) => Promise<HierarchyFilteringPath[]>;
  getModelsTreeIdsCache: () => ModelsTreeIdsCache;
  onModelsFiltered?: (modelIds: Id64String[] | undefined) => void;
  onFilteredPathsChanged: (paths: HierarchyFilteringPath[] | undefined) => void;
}): {
  getPaths: VisibilityTreeProps["getFilteredPaths"] | undefined;
  filteringError: ModelsTreeFilteringError | undefined;
} {
  const [filteringError, setFilteringError] = useState<ModelsTreeFilteringError | undefined>(undefined);

  const { onFeatureUsed } = useTelemetryContext();
  const { loadFocusedItems } = useFocusedInstancesContext();

  useEffect(() => {
    setFilteringError(undefined);
    onModelsFiltered?.(undefined);

    // reset filtered paths if there is no filters applied. This allows to keep current filtered paths until new paths are loaded.
    if (!loadFocusedItems && !getFilteredPaths && !filter) {
      onFilteredPathsChanged(undefined);
    }
  }, [loadFocusedItems, getFilteredPaths, filter, onModelsFiltered, onFilteredPathsChanged]);

  const getPaths = useMemo<VisibilityTreeProps["getFilteredPaths"] | undefined>(() => {
    const handlePaths = async (filteredPaths: HierarchyFilteringPath[], classInspector: ECClassHierarchyInspector) => {
      onFilteredPathsChanged(filteredPaths);
      if (!onModelsFiltered) {
        return;
      }

      const modelIds = await getModels(filteredPaths, getModelsTreeIdsCache(), classInspector);
      onModelsFiltered(modelIds);
    };

    if (loadFocusedItems) {
      return async ({ imodelAccess }) => {
        try {
          const focusedItems = await collectFocusedItems(loadFocusedItems);
          const paths = await ModelsTreeDefinition.createInstanceKeyPaths({
            imodelAccess,
            idsCache: getModelsTreeIdsCache(),
            targetItems: focusedItems,
            hierarchyConfig: hierarchyConfiguration,
          });
          void handlePaths(paths, imodelAccess);
          return paths.map((path) => ("path" in path ? path : { path, options: { autoExpand: true } }));
        } catch (e) {
          const newError = e instanceof FilterLimitExceededError ? "tooManyInstancesFocused" : "unknownInstanceFocusError";
          if (newError !== "tooManyInstancesFocused") {
            const feature = e instanceof Error && e.message.includes("query too long to execute or server is too busy") ? "error-timeout" : "error-unknown";
            onFeatureUsed({ featureId: feature, reportInteraction: false });
          }
          setFilteringError(newError);
          return [];
        }
      };
    }

    if (getFilteredPaths) {
      return async ({ imodelAccess }) => {
        try {
          const paths = await getFilteredPaths({
            createInstanceKeyPaths: async (props) =>
              ModelsTreeDefinition.createInstanceKeyPaths({
                ...props,
                imodelAccess,
                idsCache: getModelsTreeIdsCache(),
                hierarchyConfig: hierarchyConfiguration,
                limit: "unbounded",
              }),
            filter,
          });
          void handlePaths(paths, imodelAccess);
          return paths;
        } catch (e) {
          const newError = e instanceof FilterLimitExceededError ? "tooManyFilterMatches" : "unknownFilterError";
          if (newError !== "tooManyFilterMatches") {
            const feature = e instanceof Error && e.message.includes("query too long to execute or server is too busy") ? "error-timeout" : "error-unknown";
            onFeatureUsed({ featureId: feature, reportInteraction: false });
          }
          setFilteringError(newError);
          return [];
        }
      };
    }

    if (filter) {
      return async ({ imodelAccess }) => {
        onFeatureUsed({ featureId: "filtering", reportInteraction: true });
        try {
          const paths = await ModelsTreeDefinition.createInstanceKeyPaths({
            imodelAccess,
            label: filter,
            idsCache: getModelsTreeIdsCache(),
            hierarchyConfig: hierarchyConfiguration,
          });
          void handlePaths(paths, imodelAccess);
          return paths.map((path) => ("path" in path ? path : { path, options: { autoExpand: true } }));
        } catch (e) {
          const newError = e instanceof FilterLimitExceededError ? "tooManyFilterMatches" : "unknownFilterError";
          if (newError !== "tooManyFilterMatches") {
            const feature = e instanceof Error && e.message.includes("query too long to execute or server is too busy") ? "error-timeout" : "error-unknown";
            onFeatureUsed({ featureId: feature, reportInteraction: false });
          }
          setFilteringError(newError);
          return [];
        }
      };
    }
    return undefined;
  }, [filter, loadFocusedItems, getModelsTreeIdsCache, onFeatureUsed, getFilteredPaths, hierarchyConfiguration, onModelsFiltered, onFilteredPathsChanged]);

  return {
    getPaths,
    filteringError,
  };
}

async function getModels(paths: HierarchyFilteringPath[], idsCache: ModelsTreeIdsCache, classInspector: ECClassHierarchyInspector) {
  if (!paths) {
    return undefined;
  }

  const targetModelIds = new Set<Id64String>();
  const targetSubjectIds = new Set<Id64String>();
  for (const path of paths) {
    const currPath = Array.isArray(path) ? path : path.path;
    for (let i = 0; i < currPath.length; i++) {
      const currStep = currPath[i];
      if (!HierarchyNodeIdentifier.isInstanceNodeIdentifier(currStep)) {
        break;
      }

      // if paths end with subject need to get all models under that subject
      if (i === currPath.length - 1 && currStep.className === CLASS_NAME_Subject) {
        targetSubjectIds.add(currStep.id);
        break;
      }

      // collect all the models from the filtered path
      if (await classInspector.classDerivesFrom(currStep.className, CLASS_NAME_GeometricModel3d)) {
        targetModelIds.add(currStep.id);
      }
    }
  }

  const matchingModels = await idsCache.getSubjectModelIds([...targetSubjectIds]);
  return [...targetModelIds, ...matchingModels];
}

async function collectFocusedItems(loadFocusedItems: () => AsyncIterableIterator<InstanceKey | GroupingHierarchyNode>) {
  const focusedItems: Array<InstanceKey | ElementsGroupInfo> = [];
  const groupingNodeInfos: Array<{
    parentKey: InstancesNodeKey;
    parentType: "element" | "category";
    groupingNode: ClassGroupingHierarchyNode;
    modelIds: Id64Array;
  }> = [];
  for await (const key of loadFocusedItems()) {
    if ("id" in key) {
      focusedItems.push(key);
      continue;
    }

    if (!HierarchyNodeKey.isClassGrouping(key.key)) {
      continue;
    }

    const groupingNode = key as ClassGroupingHierarchyNode;
    if (!groupingNode.nonGroupingAncestor || !HierarchyNodeKey.isInstances(groupingNode.nonGroupingAncestor.key)) {
      continue;
    }

    const parentKey = groupingNode.nonGroupingAncestor.key;
    const type = groupingNode.nonGroupingAncestor.extendedData?.isCategory ? "category" : "element";
    const modelIds = ((groupingNode.nonGroupingAncestor.extendedData?.modelIds as Id64String[][]) ?? []).flatMap((ids) => ids);
    groupingNodeInfos.push({ groupingNode, parentType: type, parentKey, modelIds });
  }
  focusedItems.push(
    ...groupingNodeInfos.map(({ parentKey, parentType, groupingNode, modelIds }) => ({
      parent:
        parentType === "element"
          ? { type: "element" as const, ids: parentKey.instanceKeys.map((key) => key.id) }
          : { type: "category" as const, ids: parentKey.instanceKeys.map((key) => key.id), modelIds },
      groupingNode,
    })),
  );
  return focusedItems;
}
