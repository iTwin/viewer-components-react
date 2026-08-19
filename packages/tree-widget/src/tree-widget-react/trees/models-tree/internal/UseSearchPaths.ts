/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useMemo, useState } from "react";
import { firstValueFrom } from "rxjs";
import { HierarchyNode, HierarchyNodeIdentifier, HierarchyNodeKey, HierarchySearchTree } from "@itwin/presentation-hierarchies";
import { useFocusedInstancesContext } from "../../../shared/contexts/FocusedInstancesContext.js";
import { useTelemetryContext } from "../../../shared/contexts/UseTelemetryContext.js";
import { CLASS_NAME_GeometricModel3d, CLASS_NAME_Subject } from "../../../shared/internal/ClassNameDefinitions.js";
import { SearchLimitExceededError } from "../../../shared/TreeErrors.js";
import { joinHierarchySearchTrees } from "../../../shared/Utils.js";
import { ModelsTreeDefinition } from "../ModelsTreeDefinition.js";
import { ModelsTreeNode } from "../ModelsTreeNode.js";

import type { GuidString, Id64Array, Id64String } from "@itwin/core-bentley";
import type { GroupingHierarchyNode, InstancesNodeKey } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector, InstanceKey } from "@itwin/presentation-shared";
import type { VisibilityTreeProps } from "../../../shared/components/VisibilityTree.js";
import type { ClassGroupingHierarchyNode, ElementsGroupInfo, RequiredModelsTreeHierarchyConfiguration } from "../ModelsTreeDefinition.js";
import type { ModelsTreeIdsCache } from "./ModelsTreeIdsCache.js";

/** @internal */
export type ModelsTreeSearchError = "tooManySearchMatches" | "tooManyInstancesFocused" | "unknownSearchError" | "unknownInstanceFocusError";
/** @internal */
export type ModelsTreeSubTreeError = "unknownSubTreeError";

/** @internal */
export function useSearchPaths({
  hierarchyConfig,
  searchText,
  searchLimit,
  getSearchPaths,
  getSubTreePaths,
  idsCache,
  onModelsFiltered,
  onSearchPathsChanged,
  componentId,
}: {
  hierarchyConfig: RequiredModelsTreeHierarchyConfiguration;
  searchText?: string;
  searchLimit?: number | "unbounded";
  getSearchPaths?: (props: {
    /**
     * A function that creates search paths based on provided target instance keys or node label.
     */
    createInstanceKeyPaths: (props: { targetItems: Array<InstanceKey | ElementsGroupInfo> } | { label: string }) => Promise<HierarchySearchTree[]>;
    /**
     * Search text which would be used to create search paths if `getSearchPaths` wouldn't be provided.
     */
    searchText?: string;
  }) => Promise<HierarchySearchTree[] | undefined>;
  getSubTreePaths?: (props: {
    /**
     * A function that creates search paths based on provided target instance keys.
     */
    createInstanceKeyPaths: (props: { targetItems: Array<InstanceKey | ElementsGroupInfo> }) => Promise<HierarchySearchTree[]>;
  }) => Promise<HierarchySearchTree[]>;
  idsCache: ModelsTreeIdsCache;
  onModelsFiltered?: (modelIds: Id64String[] | undefined) => void;
  onSearchPathsChanged: (paths: HierarchySearchTree[] | undefined) => void;
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchError(undefined);
    setSubTreeError(undefined);
    onModelsFiltered?.(undefined);

    // reset search paths if there is no search applied. This allows to keep current search paths until new paths are loaded.
    if (!loadFocusedItems && !getSearchPaths && !searchText && !getSubTreePaths) {
      onSearchPathsChanged(undefined);
    }
  }, [loadFocusedItems, getSearchPaths, getSubTreePaths, searchText, onModelsFiltered, onSearchPathsChanged]);

  const getSubTreePathsInternal = useMemo<
    ((...props: Parameters<Required<VisibilityTreeProps>["getSearchPaths"]>) => Promise<HierarchySearchTree[]>) | undefined
  >(() => {
    if (!getSubTreePaths) {
      return undefined;
    }
    return async ({ imodelAccess, abortSignal }) => {
      try {
        return await getSubTreePaths({
          createInstanceKeyPaths: async ({ targetItems }) =>
            createHierarchySearchTree(
              ModelsTreeDefinition.createInstanceKeyPaths({
                imodelAccess,
                targetItems,
                idsCache,
                hierarchyConfig,
                limit: "unbounded",
                abortSignal,
                componentId: `${componentId}/subTree`,
              }),
            ),
        });
      } catch {
        const newError = "unknownSubTreeError";
        setSubTreeError(newError);
        return [];
      }
    };
  }, [idsCache, hierarchyConfig, getSubTreePaths, componentId]);

  const getPaths = useMemo<VisibilityTreeProps["getSearchPaths"] | undefined>(() => {
    const handlePaths = async (searchPaths: HierarchySearchTree[] | undefined, classInspector: ECClassHierarchyInspector) => {
      onSearchPathsChanged(searchPaths);
      if (!onModelsFiltered) {
        return;
      }

      const modelIds = searchPaths ? await getModels(searchPaths, idsCache, classInspector) : undefined;
      onModelsFiltered(modelIds);
    };

    if (loadFocusedItems) {
      return async ({ imodelAccess, abortSignal }) => {
        try {
          const focusedItems = await collectFocusedItems(loadFocusedItems);
          return await createSearchPathsResult({
            getSearchPaths: async () =>
              createHierarchySearchTree(
                ModelsTreeDefinition.createInstanceKeyPaths({
                  imodelAccess,
                  idsCache,
                  targetItems: focusedItems,
                  hierarchyConfig,
                  limit: searchLimit,
                  abortSignal,
                  componentId,
                }),
                { revealTargets: true },
              ),
            getSubTreePaths: async () => (getSubTreePathsInternal ? getSubTreePathsInternal({ imodelAccess, abortSignal }) : undefined),
            handlePaths: async (paths) => handlePaths(paths, imodelAccess),
          });
        } catch (e) {
          const newError = e instanceof SearchLimitExceededError ? "tooManyInstancesFocused" : "unknownInstanceFocusError";
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
              return getSearchPaths({
                createInstanceKeyPaths: async (props) =>
                  createHierarchySearchTree(
                    ModelsTreeDefinition.createInstanceKeyPaths({
                      ...props,
                      imodelAccess,
                      idsCache,
                      hierarchyConfig,
                      limit: searchLimit,
                      abortSignal,
                      componentId,
                    }),
                    { revealTargets: true },
                  ),
                searchText,
              });
            },
            getSubTreePaths: async () => (getSubTreePathsInternal ? getSubTreePathsInternal({ imodelAccess, abortSignal }) : undefined),
            handlePaths: async (paths) => handlePaths(paths, imodelAccess),
          });
        } catch (e) {
          const newError = e instanceof SearchLimitExceededError ? "tooManySearchMatches" : "unknownSearchError";
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
            getSearchPaths: async () =>
              createHierarchySearchTree(
                ModelsTreeDefinition.createInstanceKeyPaths({
                  imodelAccess,
                  label: searchText,
                  idsCache,
                  hierarchyConfig,
                  limit: searchLimit,
                  abortSignal,
                  componentId,
                }),
                { revealTargets: true },
              ),
            getSubTreePaths: async () => (getSubTreePathsInternal ? getSubTreePathsInternal({ imodelAccess, abortSignal }) : undefined),
            handlePaths: async (paths) => handlePaths(paths, imodelAccess),
          });
        } catch (e) {
          const newError = e instanceof SearchLimitExceededError ? "tooManySearchMatches" : "unknownSearchError";
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
    searchLimit,
    loadFocusedItems,
    idsCache,
    onFeatureUsed,
    getSearchPaths,
    hierarchyConfig,
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

async function getModels(trees: HierarchySearchTree[], idsCache: ModelsTreeIdsCache, classInspector: ECClassHierarchyInspector) {
  const targetModelIds = new Set<Id64String>();
  const targetSubjectIds = new Set<Id64String>();

  async function traverse(node: HierarchySearchTree): Promise<void> {
    const identifier = node.identifier;
    if (!HierarchyNodeIdentifier.isInstanceNodeIdentifier(identifier)) {
      return;
    }

    // If this is a leaf subject node, collect it
    if (!node.children && identifier.className === CLASS_NAME_Subject) {
      targetSubjectIds.add(identifier.id);
      return;
    }

    // Collect model ids
    if (await classInspector.classDerivesFrom(identifier.className, CLASS_NAME_GeometricModel3d)) {
      targetModelIds.add(identifier.id);
    }

    if (node.children) {
      await Promise.all(node.children.map(async (child) => traverse(child)));
    }
  }
  await Promise.all(trees.map(async (tree) => traverse(tree)));

  const subjectModelIds = await firstValueFrom(idsCache.getSubjectModelIds(targetSubjectIds));
  return [...targetModelIds, ...subjectModelIds];
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
    if (ModelsTreeNode.isCategoryNode(groupingNode.nonGroupingAncestor)) {
      groupingNodeInfos.push({ groupingNode, parentType: "category", parentKey, modelIds: groupingNode.nonGroupingAncestor.extendedData.modelIds });
      continue;
    }
    groupingNodeInfos.push({ groupingNode, parentType: "element", parentKey, modelIds: [] });
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
  getSubTreePaths: () => Promise<HierarchySearchTree[] | undefined>;
  getSearchPaths: () => Promise<HierarchySearchTree[] | undefined>;
  handlePaths: (searchPaths: HierarchySearchTree[] | undefined) => Promise<void>;
}): Promise<HierarchySearchTree[] | undefined> {
  const [subTreePaths, searchPaths] = await Promise.all([getSubTreePaths(), getSearchPaths()]);
  let joinedPaths: HierarchySearchTree[] | undefined;
  try {
    if (subTreePaths && searchPaths) {
      return (joinedPaths = joinHierarchySearchTrees(subTreePaths, searchPaths));
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

async function createHierarchySearchTree(pathsIter: ReturnType<typeof ModelsTreeDefinition.createInstanceKeyPaths>, options?: { revealTargets?: boolean }) {
  const builder = HierarchySearchTree.createBuilder();
  for await (const { path, target } of pathsIter) {
    builder.accept({
      path: {
        path,
        options: options?.revealTargets
          ? { reveal: typeof target === "string" ? true : { groupingLevel: HierarchyNode.getGroupingNodeLevel(target.groupingNode) } }
          : undefined,
      },
    });
  }
  return builder.getTree();
}
