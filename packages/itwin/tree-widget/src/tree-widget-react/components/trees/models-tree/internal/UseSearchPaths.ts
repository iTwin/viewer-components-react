/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useMemo, useState } from "react";
import { firstValueFrom } from "rxjs";
import { HierarchyNodeIdentifier, HierarchyNodeKey, HierarchySearchPath } from "@itwin/presentation-hierarchies";
import { useFocusedInstancesContext } from "../../common/FocusedInstancesContext.js";
import { CLASS_NAME_GeometricModel3d, CLASS_NAME_Subject } from "../../common/internal/ClassNameDefinitions.js";
import { FilterLimitExceededError } from "../../common/TreeErrors.js";
import { useTelemetryContext } from "../../common/UseTelemetryContext.js";
import { joinHierarchySearchPaths } from "../../common/Utils.js";
import { ModelsTreeDefinition } from "../ModelsTreeDefinition.js";

import type { GuidString, Id64Array, Id64String } from "@itwin/core-bentley";
import type { GroupingHierarchyNode, HierarchyNodeIdentifiersPath, InstancesNodeKey } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector, InstanceKey } from "@itwin/presentation-shared";
import type { VisibilityTreeProps } from "../../common/components/VisibilityTree.js";
import type { NormalizedHierarchySearchPath } from "../../common/Utils.js";
import type { ClassGroupingHierarchyNode, ElementsGroupInfo, ModelsTreeHierarchyConfiguration } from "../ModelsTreeDefinition.js";
import type { ModelsTreeIdsCache } from "./ModelsTreeIdsCache.js";

/** @internal */
export type ModelsTreeSearchError = "tooManySearchMatches" | "tooManyInstancesFocused" | "unknownSearchError" | "unknownInstanceFocusError";
/** @internal */
export type ModelsTreeSubTreeError = "unknownSubTreeError";

/** @internal */
export function useSearchPaths({
  hierarchyConfiguration,
  searchText,
  getSearchPaths,
  getSubTreePaths,
  getModelsTreeIdsCache,
  onModelsFiltered,
  onSearchPathsChanged,
  componentId,
}: {
  hierarchyConfiguration: ModelsTreeHierarchyConfiguration;
  searchText?: string;
  getSearchPaths?: (props: {
    /** A function that creates search paths based on provided target instance keys or node label. */
    createInstanceKeyPaths: (props: { targetItems: Array<InstanceKey | ElementsGroupInfo> } | { label: string }) => Promise<NormalizedHierarchySearchPath[]>;
    /** Search text which would be used to create search paths if `getSearchPaths` wouldn't be provided. */
    searchText?: string;
  }) => Promise<HierarchySearchPath[] | undefined>;
  getSubTreePaths?: (props: {
    /** A function that creates search paths based on provided target instance keys. */
    createInstanceKeyPaths: (props: { targetItems: Array<InstanceKey | ElementsGroupInfo> }) => Promise<NormalizedHierarchySearchPath[]>;
  }) => Promise<HierarchySearchPath[]>;
  getModelsTreeIdsCache: () => ModelsTreeIdsCache;
  onModelsFiltered?: (modelIds: Id64String[] | undefined) => void;
  onSearchPathsChanged: (paths: HierarchySearchPath[] | undefined) => void;
  componentId: GuidString;
}): {
  getPaths: VisibilityTreeProps["getSearchPaths"] | undefined;
  searchError: ModelsTreeSearchError | undefined;
  subTreeError: ModelsTreeSubTreeError | undefined;
} {
  const [searchError, setSearchError] = useState<ModelsTreeSearchError | undefined>(undefined);
  const [subTreeError, setSubTreeError] = useState<ModelsTreeSubTreeError | undefined>(undefined);

  const { onFeatureUsed } = useTelemetryContext();
  const { loadFocusedItems } = useFocusedInstancesContext();

  useEffect(() => {
    setSearchError(undefined);
    setSubTreeError(undefined);
    onModelsFiltered?.(undefined);

    // reset search paths if there is no search applied. This allows to keep current search paths until new paths are loaded.
    if (!loadFocusedItems && !getSearchPaths && !searchText && !getSubTreePaths) {
      onSearchPathsChanged(undefined);
    }
  }, [loadFocusedItems, getSearchPaths, getSubTreePaths, searchText, onModelsFiltered, onSearchPathsChanged]);

  const getSubTreePathsInternal = useMemo<
    ((...props: Parameters<Required<VisibilityTreeProps>["getSearchPaths"]>) => Promise<HierarchyNodeIdentifiersPath[]>) | undefined
  >(() => {
    if (!getSubTreePaths) {
      return undefined;
    }
    return async ({ imodelAccess, abortSignal }) => {
      try {
        const paths = await getSubTreePaths({
          createInstanceKeyPaths: async ({ targetItems }) =>
            ModelsTreeDefinition.createInstanceKeyPaths({
              imodelAccess,
              targetItems,
              idsCache: getModelsTreeIdsCache(),
              hierarchyConfig: hierarchyConfiguration,
              limit: "unbounded",
              abortSignal,
              componentId: `${componentId}/subTree`,
            }),
        });
        return paths.map(HierarchySearchPath.normalize).map(({ path }) => path);
      } catch {
        const newError = "unknownSubTreeError";
        setSubTreeError(newError);
        return [];
      }
    };
  }, [getModelsTreeIdsCache, hierarchyConfiguration, getSubTreePaths, componentId]);

  const getPaths = useMemo<VisibilityTreeProps["getSearchPaths"] | undefined>(() => {
    const handlePaths = async (searchPaths: HierarchySearchPath[] | undefined, classInspector: ECClassHierarchyInspector) => {
      onSearchPathsChanged(searchPaths);
      if (!onModelsFiltered) {
        return;
      }

      const modelIds = searchPaths ? await getModels(searchPaths, getModelsTreeIdsCache(), classInspector) : undefined;
      onModelsFiltered(modelIds);
    };

    if (loadFocusedItems) {
      return async ({ imodelAccess, abortSignal }) => {
        try {
          const focusedItems = await collectFocusedItems(loadFocusedItems);
          return await createSearchPathsResult({
            getSearchPaths: async () => {
              const paths = await ModelsTreeDefinition.createInstanceKeyPaths({
                imodelAccess,
                idsCache: getModelsTreeIdsCache(),
                targetItems: focusedItems,
                hierarchyConfig: hierarchyConfiguration,
                abortSignal,
                componentId,
              });
              return paths.map(({ path, options }) => ({ path, options: { ...options, reveal: true } }));
            },
            getSubTreePaths: async () => (getSubTreePathsInternal ? getSubTreePathsInternal({ imodelAccess, abortSignal }) : undefined),
            handlePaths: async (paths) => handlePaths(paths, imodelAccess),
          });
        } catch (e) {
          const newError = e instanceof FilterLimitExceededError ? "tooManyInstancesFocused" : "unknownInstanceFocusError";
          if (newError !== "tooManyInstancesFocused") {
            const feature = e instanceof Error && e.message.includes("query too long to execute or server is too busy") ? "error-timeout" : "error-unknown";
            onFeatureUsed({ featureId: feature, reportInteraction: false });
          }
          setSearchError(newError);
          return [];
        }
      };
    }

    if (getSearchPaths) {
      return async ({ imodelAccess, abortSignal }) => {
        try {
          return await createSearchPathsResult({
            getSearchPaths: async () => {
              const paths = await getSearchPaths({
                createInstanceKeyPaths: async (props) =>
                  ModelsTreeDefinition.createInstanceKeyPaths({
                    ...props,
                    imodelAccess,
                    idsCache: getModelsTreeIdsCache(),
                    hierarchyConfig: hierarchyConfiguration,
                    limit: "unbounded",
                    abortSignal,
                    componentId,
                  }),
                searchText,
              });
              return paths?.map(HierarchySearchPath.normalize);
            },
            getSubTreePaths: async () => (getSubTreePathsInternal ? getSubTreePathsInternal({ imodelAccess, abortSignal }) : undefined),
            handlePaths: async (paths) => handlePaths(paths, imodelAccess),
          });
        } catch (e) {
          const newError = e instanceof FilterLimitExceededError ? "tooManySearchMatches" : "unknownSearchError";
          if (newError !== "tooManySearchMatches") {
            const feature = e instanceof Error && e.message.includes("query too long to execute or server is too busy") ? "error-timeout" : "error-unknown";
            onFeatureUsed({ featureId: feature, reportInteraction: false });
          }
          setSearchError(newError);
          return [];
        }
      };
    }

    if (searchText) {
      return async ({ imodelAccess, abortSignal }) => {
        onFeatureUsed({ featureId: "search", reportInteraction: true });
        try {
          return await createSearchPathsResult({
            getSearchPaths: async () => {
              const paths = await ModelsTreeDefinition.createInstanceKeyPaths({
                imodelAccess,
                label: searchText,
                idsCache: getModelsTreeIdsCache(),
                hierarchyConfig: hierarchyConfiguration,
                abortSignal,
                componentId,
              });
              return paths.map(({ path, options }) => ({ path, options: { ...options, reveal: true } }));
            },
            getSubTreePaths: async () => (getSubTreePathsInternal ? getSubTreePathsInternal({ imodelAccess, abortSignal }) : undefined),
            handlePaths: async (paths) => handlePaths(paths, imodelAccess),
          });
        } catch (e) {
          const newError = e instanceof FilterLimitExceededError ? "tooManySearchMatches" : "unknownSearchError";
          if (newError !== "tooManySearchMatches") {
            const feature = e instanceof Error && e.message.includes("query too long to execute or server is too busy") ? "error-timeout" : "error-unknown";
            onFeatureUsed({ featureId: feature, reportInteraction: false });
          }
          setSearchError(newError);
          return [];
        }
      };
    }
    return getSubTreePathsInternal;
  }, [
    searchText,
    loadFocusedItems,
    getModelsTreeIdsCache,
    onFeatureUsed,
    getSearchPaths,
    hierarchyConfiguration,
    onModelsFiltered,
    onSearchPathsChanged,
    getSubTreePathsInternal,
    componentId,
  ]);

  return {
    getPaths,
    searchError,
    subTreeError,
  };
}

async function getModels(paths: HierarchySearchPath[], idsCache: ModelsTreeIdsCache, classInspector: ECClassHierarchyInspector) {
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

      // collect all the models from the search path
      if (await classInspector.classDerivesFrom(currStep.className, CLASS_NAME_GeometricModel3d)) {
        targetModelIds.add(currStep.id);
      }
    }
  }

  const matchingModels = await firstValueFrom(idsCache.getSubjectModelIds(targetSubjectIds));
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

async function createSearchPathsResult({
  getSubTreePaths,
  getSearchPaths,
  handlePaths,
}: {
  getSubTreePaths: () => Promise<HierarchyNodeIdentifiersPath[] | undefined>;
  getSearchPaths: () => Promise<NormalizedHierarchySearchPath[] | undefined>;
  handlePaths: (searchPaths: HierarchySearchPath[] | undefined) => Promise<void>;
}): Promise<HierarchySearchPath[] | undefined> {
  const [subTreePaths, searchPaths] = await Promise.all([getSubTreePaths(), getSearchPaths()]);
  let joinedPaths: HierarchySearchPath[] | undefined;
  try {
    if (subTreePaths && searchPaths) {
      return (joinedPaths = joinHierarchySearchPaths(subTreePaths, searchPaths));
    }
    if (subTreePaths) {
      return (joinedPaths = subTreePaths);
    }
    if (searchPaths) {
      return (joinedPaths = searchPaths);
    }
  } finally {
    void handlePaths(joinedPaths);
  }
  return joinedPaths;
}
