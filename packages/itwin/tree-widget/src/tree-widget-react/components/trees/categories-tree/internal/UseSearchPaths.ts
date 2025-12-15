/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useMemo, useState } from "react";
import { firstValueFrom } from "rxjs";
import { assert } from "@itwin/core-bentley";
import { HierarchyNodeIdentifier, HierarchySearchPath } from "@itwin/presentation-hierarchies";
import { CLASS_NAME_DefinitionContainer, CLASS_NAME_SubCategory } from "../../common/internal/ClassNameDefinitions.js";
import { getClassesByView } from "../../common/internal/Utils.js";
import { FilterLimitExceededError } from "../../common/TreeErrors.js";
import { useTelemetryContext } from "../../common/UseTelemetryContext.js";
import { CategoriesTreeDefinition } from "../CategoriesTreeDefinition.js";

import type { GuidString } from "@itwin/core-bentley";
import type { CategoryInfo } from "../../common/CategoriesVisibilityUtils.js";
import type { VisibilityTreeProps } from "../../common/components/VisibilityTree.js";
import type { CategoryId, ElementId, ModelId, SubCategoryId } from "../../common/internal/Types.js";
import type { CategoriesTreeHierarchyConfiguration } from "../CategoriesTreeDefinition.js";
import type { CategoriesTreeIdsCache } from "./CategoriesTreeIdsCache.js";

/** @internal */
export type CategoriesTreeSearchError = "tooManySearchMatches" | "unknownSearchError";

type HierarchySearchPaths = Awaited<ReturnType<Required<VisibilityTreeProps>["getSearchPaths"]>>;

/** @internal */
export function useSearchPaths({
  searchText,
  viewType,
  hierarchyConfiguration,
  getCategoriesTreeIdsCache,
  onCategoriesFiltered,
  onSearchPathsChanged,
  componentId,
}: {
  viewType: "2d" | "3d";
  searchText?: string;
  hierarchyConfiguration: CategoriesTreeHierarchyConfiguration;
  getCategoriesTreeIdsCache: () => CategoriesTreeIdsCache;
  onCategoriesFiltered?: (categories: { categories: CategoryInfo[] | undefined; models?: Array<ModelId> }) => void;
  onSearchPathsChanged: (paths: HierarchySearchPaths | undefined) => void;
  componentId: GuidString;
}): {
  getPaths: VisibilityTreeProps["getSearchPaths"] | undefined;
  searchError: CategoriesTreeSearchError | undefined;
} {
  const [searchError, setSearchError] = useState<CategoriesTreeSearchError | undefined>();
  const { onFeatureUsed } = useTelemetryContext();

  useEffect(() => {
    setSearchError(undefined);
    onCategoriesFiltered?.({ categories: undefined, models: undefined });
    if (!searchText) {
      onSearchPathsChanged(undefined);
    }
  }, [searchText, onCategoriesFiltered, onSearchPathsChanged]);

  const getSearchPaths = useMemo<VisibilityTreeProps["getSearchPaths"] | undefined>(() => {
    if (!searchText) {
      return undefined;
    }

    return async ({ imodelAccess, abortSignal }) => {
      onFeatureUsed({ featureId: "filtering", reportInteraction: true });
      try {
        const paths = await CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          abortSignal,
          label: searchText,
          viewType,
          idsCache: getCategoriesTreeIdsCache(),
          hierarchyConfig: hierarchyConfiguration,
          componentId,
        });
        onSearchPathsChanged(paths);
        const { elementClass, modelClass } = getClassesByView(viewType);
        onCategoriesFiltered?.(await getCategoriesFromPaths(paths, getCategoriesTreeIdsCache(), elementClass, modelClass, hierarchyConfiguration));
        return paths;
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
  }, [onCategoriesFiltered, searchText, onSearchPathsChanged, onFeatureUsed, viewType, getCategoriesTreeIdsCache, hierarchyConfiguration, componentId]);

  return {
    getPaths: getSearchPaths,
    searchError,
  };
}

async function getCategoriesFromPaths(
  paths: HierarchySearchPaths,
  idsCache: CategoriesTreeIdsCache,
  elementClassName: string,
  modelsClassName: string,
  hierarchyConfig: CategoriesTreeHierarchyConfiguration,
): Promise<{ categories: CategoryInfo[] | undefined; models?: Array<ModelId> }> {
  if (!paths) {
    return { categories: undefined };
  }

  const rootFilteredElementIds = new Set<ElementId>();
  const subModelIds = new Set<ModelId>();

  const categories = new Map<CategoryId, Array<SubCategoryId>>();
  for (const path of paths) {
    const currPath = HierarchySearchPath.normalize(path).path;
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
      const definitionContainerCategories = await firstValueFrom(
        idsCache.getAllContainedCategories({ definitionContainerIds: lastNodeInfo.lastNode.id, includeEmptyCategories: hierarchyConfig.showEmptyCategories }),
      );
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
  const rootElementModelMap = await firstValueFrom(idsCache.getFilteredElementsModels(rootFilteredElementIds));
  const models = [...subModelIds, ...new Set(rootElementModelMap.values())];
  return {
    categories: [...categories.entries()].map(([categoryId, subCategoryIds]) => ({
      categoryId,
      subCategoryIds: subCategoryIds.length === 0 ? undefined : subCategoryIds,
    })),
    models,
  };
}
