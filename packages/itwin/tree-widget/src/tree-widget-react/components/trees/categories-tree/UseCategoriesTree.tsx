/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useMemo, useState } from "react";
import { assert } from "@itwin/core-bentley";
import categorySvg from "@itwin/itwinui-icons/bis-category-3d.svg";
import subcategorySvg from "@itwin/itwinui-icons/bis-category-subcategory.svg";
import definitionContainerSvg from "@itwin/itwinui-icons/bis-definitions-container.svg";
import { Text } from "@itwin/itwinui-react/bricks";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { HierarchyFilteringPath, HierarchyNodeIdentifier } from "@itwin/presentation-hierarchies";
import { TreeWidget } from "../../../TreeWidget.js";
import { EmptyTreeContent } from "../common/components/EmptyTreeContent.js";
import { FilterLimitExceededError } from "../common/TreeErrors.js";
import { useTelemetryContext } from "../common/UseTelemetryContext.js";
import { CategoriesTreeDefinition } from "./CategoriesTreeDefinition.js";
import { CategoriesTreeIdsCache } from "./internal/CategoriesTreeIdsCache.js";
import { CategoriesVisibilityHandler } from "./internal/CategoriesVisibilityHandler.js";
import { DEFINITION_CONTAINER_CLASS, SUB_CATEGORY_CLASS } from "./internal/ClassNameDefinitions.js";

import type { ReactNode } from "react";
import type { Id64String } from "@itwin/core-bentley";
import type { HierarchyNode } from "@itwin/presentation-hierarchies";
import type { VisibilityTreeProps } from "../common/components/VisibilityTree.js";
import type { Viewport } from "@itwin/core-frontend";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { VisibilityTreeRendererProps } from "../common/components/VisibilityTreeRenderer.js";
import type { CategoryInfo } from "../common/CategoriesVisibilityUtils.js";

type CategoriesTreeFilteringError = "tooManyFilterMatches" | "unknownFilterError";
type HierarchyFilteringPaths = Awaited<ReturnType<Required<VisibilityTreeProps>["getFilteredPaths"]>>;

/** @beta */
export interface UseCategoriesTreeProps {
  activeView: Viewport;
  onCategoriesFiltered?: (categories: CategoryInfo[] | undefined) => void;
  filter?: string;
  emptyTreeContent?: ReactNode;
}

/** @beta */
interface UseCategoriesTreeResult {
  categoriesTreeProps: Pick<
    VisibilityTreeProps,
    "treeName" | "getHierarchyDefinition" | "getFilteredPaths" | "visibilityHandlerFactory" | "highlight" | "emptyTreeContent"
  >;
  rendererProps: Required<Pick<VisibilityTreeRendererProps, "getIcon" | "getSublabel">>;
}

/**
 * Custom hook to create and manage state for the categories tree.
 * @beta
 */
export function useCategoriesTree({ filter, activeView, onCategoriesFiltered, emptyTreeContent }: UseCategoriesTreeProps): UseCategoriesTreeResult {
  const [filteringError, setFilteringError] = useState<CategoriesTreeFilteringError | undefined>();

  const viewType = activeView.view.is2d() ? "2d" : "3d";
  const iModel = activeView.iModel;

  const idsCache = useMemo(() => {
    return new CategoriesTreeIdsCache(createECSqlQueryExecutor(iModel), viewType);
  }, [viewType, iModel]);

  const visibilityHandlerFactory = useCallback(() => {
    const visibilityHandler = new CategoriesVisibilityHandler({
      viewport: activeView,
      idsCache,
    });
    return {
      getVisibilityStatus: async (node: HierarchyNode) => visibilityHandler.getVisibilityStatus(node),
      changeVisibility: async (node: HierarchyNode, on: boolean) => visibilityHandler.changeVisibility(node, on),
      onVisibilityChange: visibilityHandler.onVisibilityChange,
      dispose: () => visibilityHandler.dispose(),
    };
  }, [activeView, idsCache]);
  const { onFeatureUsed } = useTelemetryContext();

  const getHierarchyDefinition = useCallback<VisibilityTreeProps["getHierarchyDefinition"]>(
    (props) => {
      return new CategoriesTreeDefinition({ ...props, viewType, idsCache });
    },
    [viewType, idsCache],
  );

  const getFilteredPaths = useMemo<VisibilityTreeProps["getFilteredPaths"] | undefined>(() => {
    setFilteringError(undefined);
    onCategoriesFiltered?.(undefined);
    if (!filter) {
      return undefined;
    }
    return async ({ imodelAccess }) => {
      onFeatureUsed({ featureId: "filtering", reportInteraction: true });
      try {
        const paths = await CategoriesTreeDefinition.createInstanceKeyPaths({ imodelAccess, label: filter, viewType, idsCache });
        onCategoriesFiltered?.(await getCategoriesFromPaths(paths, idsCache));
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
  }, [filter, viewType, onFeatureUsed, onCategoriesFiltered, idsCache]);

  return {
    categoriesTreeProps: {
      treeName: "categories-tree-v2",
      getHierarchyDefinition,
      getFilteredPaths,
      visibilityHandlerFactory,
      emptyTreeContent: getEmptyTreeContentComponent(filter, filteringError, emptyTreeContent),
      highlight: filter ? { text: filter } : undefined,
    },
    rendererProps: {
      getIcon,
      getSublabel,
    },
  };
}

async function getCategoriesFromPaths(paths: HierarchyFilteringPaths, idsCache: CategoriesTreeIdsCache): Promise<CategoryInfo[] | undefined> {
  if (!paths) {
    return undefined;
  }

  const categories = new Map<Id64String, Id64String[]>();
  for (const path of paths) {
    const currPath = HierarchyFilteringPath.normalize(path).path;
    if (currPath.length === 0) {
      continue;
    }

    let category: HierarchyNodeIdentifier;
    let subCategory: HierarchyNodeIdentifier | undefined;
    const lastNode = currPath[currPath.length - 1];

    if (!HierarchyNodeIdentifier.isInstanceNodeIdentifier(lastNode)) {
      continue;
    }

    if (lastNode.className === DEFINITION_CONTAINER_CLASS) {
      const definitionContainerCategories = await idsCache.getAllContainedCategories([lastNode.id]);
      for (const categoryId of definitionContainerCategories) {
        const value = categories.get(categoryId);
        if (value === undefined) {
          categories.set(categoryId, []);
        }
      }
      continue;
    }

    if (lastNode.className === SUB_CATEGORY_CLASS) {
      const secondToLastNode = currPath.length > 1 ? currPath[currPath.length - 2] : undefined;
      assert(secondToLastNode !== undefined && HierarchyNodeIdentifier.isInstanceNodeIdentifier(secondToLastNode));

      subCategory = lastNode;
      category = secondToLastNode;
    } else {
      category = lastNode;
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

  return [...categories.entries()].map(([categoryId, subCategoryIds]) => ({
    categoryId,
    subCategoryIds: subCategoryIds.length === 0 ? undefined : subCategoryIds,
  }));
}

function getEmptyTreeContentComponent(filter?: string, error?: CategoriesTreeFilteringError, emptyTreeContent?: React.ReactNode) {
  if (error) {
    return <Text variant={"body-sm"}>{TreeWidget.translate(`categoriesTree.filtering.${error}`)}</Text>;
  }
  if (filter) {
    return <Text variant={"body-sm"}>{TreeWidget.translate("categoriesTree.filtering.noMatches", { filter })}</Text>;
  }
  if (emptyTreeContent) {
    return emptyTreeContent;
  }
  return <EmptyTreeContent icon={categorySvg} />;
}


function getIcon(node: PresentationHierarchyNode): string | undefined {
  if (node.extendedData?.imageId === undefined) {
    return undefined;
  }

  switch (node.extendedData.imageId) {
    case "icon-layers":
      return categorySvg;
    case "icon-layers-isolate":
      return subcategorySvg;
    case "icon-definition-container":
      return definitionContainerSvg;
  }

  return undefined;
}

function getSublabel(node: PresentationHierarchyNode) {
  return node.extendedData?.description;
}
