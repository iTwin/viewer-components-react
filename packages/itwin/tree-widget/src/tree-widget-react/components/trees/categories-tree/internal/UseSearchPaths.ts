/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useMemo, useState } from "react";
import { firstValueFrom } from "rxjs";
import { assert } from "@itwin/core-bentley";
import { HierarchyNodeIdentifier, HierarchySearchTree } from "@itwin/presentation-hierarchies";
import { CLASS_NAME_DefinitionContainer, CLASS_NAME_SubCategory } from "../../common/internal/ClassNameDefinitions.js";
import { getClassesByView } from "../../common/internal/Utils.js";
import { SearchLimitExceededError } from "../../common/TreeErrors.js";
import { useTelemetryContext } from "../../common/UseTelemetryContext.js";
import { CategoriesTreeDefinition } from "../CategoriesTreeDefinition.js";

import type { GuidString } from "@itwin/core-bentley";
import type { InstanceKey } from "@itwin/presentation-shared";
import type { CategoryInfo } from "../../common/CategoriesVisibilityUtils.js";
import type { VisibilityTreeProps } from "../../common/components/VisibilityTree.js";
import type { CategoryId, ElementId, ModelId, SubCategoryId } from "../../common/internal/Types.js";
import type { CategoriesTreeHierarchyConfiguration } from "../CategoriesTreeDefinition.js";
import type { CategoriesTreeIdsCache } from "./CategoriesTreeIdsCache.js";

/** @internal */
export type CategoriesTreeSearchError = "tooManySearchMatches" | "unknownSearchError";

/** @internal */
export function useSearchPaths({
  searchText,
  searchLimit,
  viewType,
  hierarchyConfiguration,
  idsCache,
  onCategoriesFiltered,
  onSearchPathsChanged,
  componentId,
}: {
  viewType: "2d" | "3d";
  searchText?: string;
  searchLimit?: number | "unbounded";
  hierarchyConfiguration: CategoriesTreeHierarchyConfiguration;
  idsCache: CategoriesTreeIdsCache;
  onCategoriesFiltered?: (categories: { categories: CategoryInfo[] | undefined; models?: Array<ModelId> }) => void;
  onSearchPathsChanged: (paths: HierarchySearchTree[] | undefined) => void;
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
      onFeatureUsed({ featureId: "search", reportInteraction: true });
      try {
        const iter = CategoriesTreeDefinition.createInstanceKeyPaths({
          imodelAccess,
          abortSignal,
          label: searchText,
          viewType,
          idsCache,
          hierarchyConfig: hierarchyConfiguration,
          componentId,
          limit: searchLimit,
        });
        const builder = HierarchySearchTree.createBuilder();
        for await (const { path } of iter) {
          builder.accept({ path: { path, options: { reveal: true } } });
        }
        const paths = builder.getTree();
        onSearchPathsChanged(paths);
        const { elementClass, modelClass } = getClassesByView(viewType);
        onCategoriesFiltered?.(await getCategoriesFromPaths(paths, idsCache, elementClass, modelClass, hierarchyConfiguration));
        return paths;
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
  }, [onCategoriesFiltered, searchText, searchLimit, onSearchPathsChanged, onFeatureUsed, viewType, idsCache, hierarchyConfiguration, componentId]);

  return {
    getPaths: getSearchPaths,
    searchError,
  };
}

async function getCategoriesFromPaths(
  trees: HierarchySearchTree[] | undefined,
  idsCache: CategoriesTreeIdsCache,
  elementClassName: string,
  modelsClassName: string,
  hierarchyConfig: CategoriesTreeHierarchyConfiguration,
): Promise<{ categories: CategoryInfo[] | undefined; models?: Array<ModelId> }> {
  if (!trees) {
    return { categories: undefined };
  }

  const rootFilteredElementIds = new Set<ElementId>();
  const subModelIds = new Set<ModelId>();
  const categories = new Map<CategoryId, Array<SubCategoryId>>();

  async function traverse(node: HierarchySearchTree, parent: InstanceKey | undefined): Promise<void> {
    const identifier = node.identifier;
    if (!HierarchyNodeIdentifier.isInstanceNodeIdentifier(identifier)) {
      return;
    }

    if (identifier.className === elementClassName) {
      rootFilteredElementIds.add(identifier.id);
      if (node.children) {
        collectSubModels(node.children);
      }
      return;
    }

    if (node.children) {
      await Promise.all(node.children.map(async (childrenTree) => traverse(childrenTree, identifier)));
      return;
    }

    if (identifier.className === CLASS_NAME_DefinitionContainer) {
      const definitionContainerCategories = await firstValueFrom(
        idsCache.getAllContainedCategories({ definitionContainerIds: identifier.id, includeEmptyCategories: hierarchyConfig.showEmptyCategories }),
      );
      for (const categoryId of definitionContainerCategories) {
        if (!categories.has(categoryId)) {
          categories.set(categoryId, []);
        }
      }
      return;
    }

    if (identifier.className === CLASS_NAME_SubCategory) {
      assert(!!parent);
      let entry = categories.get(parent.id);
      if (entry === undefined) {
        entry = [];
        categories.set(parent.id, entry);
      }
      entry.push(identifier.id);
      return;
    }

    // identifier represents a CLASS_NAME_Category
    if (!categories.has(identifier.id)) {
      categories.set(identifier.id, []);
    }
  }

  function collectSubModels(children: HierarchySearchTree[]): void {
    for (const child of children) {
      const id = child.identifier;
      if (HierarchyNodeIdentifier.isInstanceNodeIdentifier(id) && id.className === modelsClassName) {
        subModelIds.add(id.id);
      }
      if (child.children) {
        collectSubModels(child.children);
      }
    }
  }

  await Promise.all(trees.map(async (tree) => traverse(tree, undefined)));

  const rootElementModelMap = await firstValueFrom(idsCache.getFilteredElementsModels([...rootFilteredElementIds]));
  const models = [...subModelIds, ...new Set(rootElementModelMap.values())];
  return {
    categories: [...categories.entries()].map(([categoryId, subCategoryIds]) => ({
      categoryId,
      subCategoryIds: subCategoryIds.length === 0 ? undefined : subCategoryIds,
    })),
    models,
  };
}
