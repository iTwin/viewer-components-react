/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useMemo, useState } from "react";
import { SvgLayers } from "@itwin/itwinui-icons-react";
import { Text } from "@itwin/itwinui-react/bricks";
import { HierarchyNodeIdentifier } from "@itwin/presentation-hierarchies";
import { TreeWidget } from "../../../TreeWidget.js";
import { FilterLimitExceededError } from "../common/TreeErrors.js";
import { useTelemetryContext } from "../common/UseTelemetryContext.js";
import { CategoriesTreeDefinition } from "./CategoriesTreeDefinition.js";
import { CategoriesVisibilityHandler } from "./CategoriesVisibilityHandler.js";

import type { HierarchyNode } from "@itwin/presentation-hierarchies";
import type { VisibilityTreeProps } from "../common/components/VisibilityTree.js";
import type { Viewport } from "@itwin/core-frontend";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { VisibilityTreeRendererProps } from "../common/components/VisibilityTreeRenderer.js";
import type { Id64String } from "@itwin/core-bentley";
import type { CategoryInfo } from "../common/CategoriesVisibilityUtils.js";

type CategoriesTreeFilteringError = "tooManyFilterMatches" | "unknownFilterError";
type HierarchyFilteringPaths = Awaited<ReturnType<Required<VisibilityTreeProps>["getFilteredPaths"]>>;

/** @beta */
export interface UseCategoriesTreeProps {
  filter: string;
  activeView: Viewport;
  onCategoriesFiltered?: (categories: CategoryInfo[] | undefined) => void;
}

/** @beta */
interface UseCategoriesTreeResult {
  categoriesTreeProps: Pick<
    VisibilityTreeProps,
    "treeName" | "getHierarchyDefinition" | "getFilteredPaths" | "visibilityHandlerFactory" | "highlight" | "noDataMessage"
  >;
  rendererProps: Required<Pick<VisibilityTreeRendererProps, "getIcon" | "getSublabel">>;
}

/**
 * Custom hook to create and manage state for the categories tree.
 * @beta
 */
export function useCategoriesTree({ filter, activeView, onCategoriesFiltered }: UseCategoriesTreeProps): UseCategoriesTreeResult {
  const [filteringError, setFilteringError] = useState<CategoriesTreeFilteringError | undefined>();
  const visibilityHandlerFactory = useCallback(() => {
    const visibilityHandler = new CategoriesVisibilityHandler({
      viewport: activeView,
    });
    return {
      getVisibilityStatus: async (node: HierarchyNode) => visibilityHandler.getVisibilityStatus(node),
      changeVisibility: async (node: HierarchyNode, on: boolean) => visibilityHandler.changeVisibility(node, on),
      onVisibilityChange: visibilityHandler.onVisibilityChange,
      dispose: () => visibilityHandler.dispose(),
    };
  }, [activeView]);
  const { onFeatureUsed } = useTelemetryContext();

  const getHierarchyDefinition = useCallback<VisibilityTreeProps["getHierarchyDefinition"]>(
    (props) => {
      return new CategoriesTreeDefinition({ ...props, viewType: activeView.view.is2d() ? "2d" : "3d" });
    },
    [activeView],
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
        const paths = await CategoriesTreeDefinition.createInstanceKeyPaths({ imodelAccess, label: filter, viewType: activeView.view.is2d() ? "2d" : "3d" });
        onCategoriesFiltered?.(getCategories(paths));
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
  }, [filter, activeView, onFeatureUsed, onCategoriesFiltered]);

  return {
    categoriesTreeProps: {
      treeName: "categories-tree-v2",
      getHierarchyDefinition,
      getFilteredPaths,
      visibilityHandlerFactory,
      noDataMessage: getNoDataMessage(filter, filteringError),
      highlight: filter ? { text: filter } : undefined,
    },
    rendererProps: {
      getIcon,
      getSublabel,
    },
  };
}

function getCategories(paths: HierarchyFilteringPaths): CategoryInfo[] | undefined {
  if (!paths) {
    return undefined;
  }

  const categories = new Map<Id64String, Id64String[]>();
  for (const path of paths) {
    const currPath = Array.isArray(path) ? path : path.path;
    const [category, subCategory] = currPath;

    if (!HierarchyNodeIdentifier.isInstanceNodeIdentifier(category)) {
      continue;
    }

    if (!categories.has(category.id)) {
      categories.set(category.id, []);
    }

    if (subCategory && HierarchyNodeIdentifier.isInstanceNodeIdentifier(subCategory)) {
      categories.get(category.id)!.push(subCategory.id);
    }
  }

  return [...categories.entries()].map(([categoryId, subCategoryIds]) => ({
    categoryId,
    subCategoryIds: subCategoryIds.length === 0 ? undefined : subCategoryIds,
  }));
}

function getNoDataMessage(filter: string, error?: CategoriesTreeFilteringError) {
  if (error) {
    return <Text>{TreeWidget.translate(`categoriesTree.filtering.${error}`)}</Text>;
  }
  if (filter) {
    return <Text>{TreeWidget.translate("categoriesTree.filtering.noMatches", { filter })}</Text>;
  }
  return undefined;
}

function getIcon() {
  return <SvgLayers />;
}

function getSublabel(node: PresentationHierarchyNode) {
  return node.extendedData?.description;
}
