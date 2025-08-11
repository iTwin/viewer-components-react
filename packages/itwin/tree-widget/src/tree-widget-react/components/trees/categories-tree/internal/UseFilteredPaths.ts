/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useMemo, useState } from "react";
import { assert } from "@itwin/core-bentley";
import { HierarchyFilteringPath, HierarchyNodeIdentifier } from "@itwin/presentation-hierarchies";
import { CLASS_NAME_DefinitionContainer, CLASS_NAME_SubCategory } from "../../common/internal/ClassNameDefinitions.js";
import { getClassesByView } from "../../common/internal/Utils.js";
import { FilterLimitExceededError } from "../../common/TreeErrors.js";
import { useTelemetryContext } from "../../common/UseTelemetryContext.js";
import { CategoriesTreeDefinition } from "../CategoriesTreeDefinition.js";

import type { VisibilityTreeProps } from "../../common/components/VisibilityTree.js";
import type { CategoriesTreeHierarchyConfiguration } from "../CategoriesTreeDefinition.js";
import type { CategoriesTreeIdsCache } from "./CategoriesTreeIdsCache.js";
import type { CategoryId, ElementId, ModelId, SubCategoryId } from "../../common/internal/Types.js";
import type { CategoryInfo } from "../../common/CategoriesVisibilityUtils.js";

/** @internal */
export type CategoriesTreeFilteringError = "tooManyFilterMatches" | "unknownFilterError";

type HierarchyFilteringPaths = Awaited<ReturnType<Required<VisibilityTreeProps>["getFilteredPaths"]>>;

/** @internal */
export function useFilteredPaths({
  filter,
  viewType,
  hierarchyConfiguration,
  getCategoriesTreeIdsCache,
  onCategoriesFiltered,
  onFilteredPathsChanged,
}: {
  viewType: "2d" | "3d";
  filter?: string;
  hierarchyConfiguration: CategoriesTreeHierarchyConfiguration;
  getCategoriesTreeIdsCache: () => CategoriesTreeIdsCache;
  onCategoriesFiltered?: (categories: { categories: CategoryInfo[] | undefined; models?: Array<ModelId> }) => void;
  onFilteredPathsChanged: (paths: HierarchyFilteringPaths | undefined) => void;
}): {
  getPaths: VisibilityTreeProps["getFilteredPaths"] | undefined;
  filteringError: CategoriesTreeFilteringError | undefined;
} {
  const [filteringError, setFilteringError] = useState<CategoriesTreeFilteringError | undefined>();
  const { onFeatureUsed } = useTelemetryContext();

  useEffect(() => {
    setFilteringError(undefined);
    onCategoriesFiltered?.({ categories: undefined, models: undefined });
    if (!filter) {
      onFilteredPathsChanged(undefined);
    }
  }, [filter, onCategoriesFiltered, onFilteredPathsChanged]);

  const getFilteredPaths = useMemo<VisibilityTreeProps["getFilteredPaths"] | undefined>(() => {
    if (!filter) {
      return undefined;
    }

    return async ({ imodelAccess }) => {
      onFeatureUsed({ featureId: "filtering", reportInteraction: true });
      try {
        const paths = await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          label: filter,
          viewType,
          idsCache: getCategoriesTreeIdsCache(),
          hierarchyConfig: hierarchyConfiguration,
        });
        onFilteredPathsChanged(paths);
        const { elementClass, modelClass } = getClassesByView(viewType);
        onCategoriesFiltered?.(await getCategoriesFromPaths(paths, getCategoriesTreeIdsCache(), elementClass, modelClass));
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
  }, [onCategoriesFiltered, filter, onFilteredPathsChanged, onFeatureUsed, viewType, getCategoriesTreeIdsCache, hierarchyConfiguration]);

  return {
    getPaths: getFilteredPaths,
    filteringError,
  };
}

async function getCategoriesFromPaths(
  paths: HierarchyFilteringPaths,
  idsCache: CategoriesTreeIdsCache,
  elementClassName: string,
  modelsClassName: string,
): Promise<{ categories: CategoryInfo[] | undefined; models?: Array<ModelId> }> {
  if (!paths) {
    return { categories: undefined };
  }

  const rootFilteredElementIds = new Set<ElementId>();
  const subModelIds = new Set<ModelId>();

  const categories = new Map<CategoryId, Array<SubCategoryId>>();
  for (const path of paths) {
    const currPath = HierarchyFilteringPath.normalize(path).path;
    if (currPath.length === 0) {
      continue;
    }

    let category: HierarchyNodeIdentifier;
    let subCategory: HierarchyNodeIdentifier | undefined;

    let lastNodeInfo: { lastNode: HierarchyNodeIdentifier; nodeIndex: number } | undefined;

    for (let i = 0; i < currPath.length; ++i) {
      const currentNode = currPath[i];
      if (!HierarchyNodeIdentifier.isInstanceNodeIdentifier(currentNode)) {
        continue;
      }
      if (currentNode.className === elementClassName) {
        rootFilteredElementIds.add(currentNode.id);
        for (let j = i + 1; j < currPath.length; ++j) {
          const childNode = currPath[j];
          if (!HierarchyNodeIdentifier.isInstanceNodeIdentifier(childNode)) {
            continue;
          }
          if (childNode.className === modelsClassName) {
            subModelIds.add(childNode.id);
          }
        }
        break;
      }
      lastNodeInfo = { lastNode: currentNode, nodeIndex: i };
    }

    assert(lastNodeInfo !== undefined && HierarchyNodeIdentifier.isInstanceNodeIdentifier(lastNodeInfo.lastNode));

    if (lastNodeInfo.lastNode.className === CLASS_NAME_DefinitionContainer) {
      const definitionContainerCategories = await idsCache.getAllContainedCategories(lastNodeInfo.lastNode.id);
      for (const categoryId of definitionContainerCategories) {
        const value = categories.get(categoryId);
        if (value === undefined) {
          categories.set(categoryId, []);
        }
      }
      continue;
    }

    if (lastNodeInfo.lastNode.className === CLASS_NAME_SubCategory) {
      const secondToLastNode = lastNodeInfo.nodeIndex > 0 ? currPath[lastNodeInfo.nodeIndex - 1] : undefined;
      assert(secondToLastNode !== undefined && HierarchyNodeIdentifier.isInstanceNodeIdentifier(secondToLastNode));

      subCategory = lastNodeInfo.lastNode;
      category = secondToLastNode;
    } else {
      category = lastNodeInfo.lastNode;
    }

    let entry = categories.get(category.id);
    if (entry === undefined) {
      entry = [];
      categories.set(category.id, entry);
    }

    if (subCategory) {
      entry.push(subCategory.id);
    }
  }
  const rootElementModelMap = await idsCache.getFilteredElementsModels(rootFilteredElementIds);
  const models = [...subModelIds, ...new Set(rootElementModelMap.values())];
  return {
    categories: [...categories.entries()].map(([categoryId, subCategoryIds]) => ({
      categoryId,
      subCategoryIds: subCategoryIds.length === 0 ? undefined : subCategoryIds,
    })),
    models,
  };
}
