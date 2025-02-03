/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useMemo, useRef, useState } from "react";
import { SvgArchive, SvgLayers } from "@itwin/itwinui-icons-react";
import { Text } from "@itwin/itwinui-react";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { HierarchyFilteringPath, HierarchyNodeIdentifier } from "@itwin/presentation-hierarchies";
import { TreeWidget } from "../../../TreeWidget.js";
import { FilterLimitExceededError } from "../common/TreeErrors.js";
import { useTelemetryContext } from "../common/UseTelemetryContext.js";
import { CategoriesTreeDefinition } from "./CategoriesTreeDefinition.js";
import { CategoriesTreeIdsCache } from "./internal/CategoriesTreeIdsCache.js";
import { CategoriesVisibilityHandler } from "./internal/CategoriesVisibilityHandler.js";
import { DEFINITION_CONTAINER_CLASS, SUB_CATEGORY_CLASS } from "./internal/ClassNameDefinitions.js";

import type { ReactElement } from "react";
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
  const idsCacheRef = useRef<CategoriesTreeIdsCache>();

  const viewType = activeView.view.is2d() ? "2d" : "3d";
  const iModel = activeView.iModel;
  const getCategoriesTreeIdsCache = useCallback(() => {
    if (!idsCacheRef.current) {
      idsCacheRef.current = new CategoriesTreeIdsCache(createECSqlQueryExecutor(iModel), viewType);
    }
    return idsCacheRef.current;
  }, [viewType, iModel]);

  const visibilityHandlerFactory = useCallback(() => {
    const visibilityHandler = new CategoriesVisibilityHandler({
      viewport: activeView,
      idsCache: getCategoriesTreeIdsCache(),
    });
    return {
      getVisibilityStatus: async (node: HierarchyNode) => visibilityHandler.getVisibilityStatus(node),
      changeVisibility: async (node: HierarchyNode, on: boolean) => visibilityHandler.changeVisibility(node, on),
      onVisibilityChange: visibilityHandler.onVisibilityChange,
      dispose: () => visibilityHandler.dispose(),
    };
  }, [activeView, getCategoriesTreeIdsCache]);
  const { onFeatureUsed } = useTelemetryContext();

  const getHierarchyDefinition = useCallback<VisibilityTreeProps["getHierarchyDefinition"]>(
    (props) => {
      return new CategoriesTreeDefinition({ ...props, viewType, idsCache: getCategoriesTreeIdsCache() });
    },
    [viewType, getCategoriesTreeIdsCache],
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
        const paths = await CategoriesTreeDefinition.createInstanceKeyPaths({ imodelAccess, label: filter, viewType, idsCache: getCategoriesTreeIdsCache() });
        onCategoriesFiltered?.(getCategoriesFromPaths(paths));
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
  }, [filter, viewType, onFeatureUsed, onCategoriesFiltered, getCategoriesTreeIdsCache]);

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

function getCategoriesFromPaths(paths: HierarchyFilteringPaths): CategoryInfo[] | undefined {
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

    if (!HierarchyNodeIdentifier.isInstanceNodeIdentifier(lastNode) || lastNode.className === DEFINITION_CONTAINER_CLASS) {
      continue;
    }

    if (lastNode.className === SUB_CATEGORY_CLASS) {
      const secondToLastNode = currPath.length > 1 ? currPath[currPath.length - 2] : undefined;
      if (
        secondToLastNode === undefined ||
        !HierarchyNodeIdentifier.isInstanceNodeIdentifier(secondToLastNode) ||
        secondToLastNode.className === DEFINITION_CONTAINER_CLASS
      ) {
        continue;
      }
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

function getNoDataMessage(filter: string, error?: CategoriesTreeFilteringError) {
  if (error) {
    return <Text>{TreeWidget.translate(`categoriesTree.filtering.${error}`)}</Text>;
  }
  if (filter) {
    return <Text>{TreeWidget.translate("categoriesTree.filtering.noMatches", { filter })}</Text>;
  }
  return undefined;
}

function SvgLayersIsolate() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
      <g>
        <path d="M13,3.4938L6.5,0L0,3.4938l6.5,3.4938L13,3.4938z" />
        <polygon points="6.5,8.21 7,7.94 7,9.24 6.5,9.51 0,6.01 1.22,5.36  " />
        <polygon points="13,6.01 11.16,7 8.74,7 11.78,5.36  " />
        <polygon points="7,10.37 7,11.67 6.5,11.94 0,8.45 1.22,7.8 6.5,10.64  " />
      </g>
      <g transform="translate(-1-1)">
        <path d="M9,13.5714h3.4286V17H9V13.5714z" />
        <path d="M9,9v3.4286h3.4286V9H9z M11.8571,11.8571H9.5714V9.5714h2.2857V11.8571z" />
        <path d="M13.5714,9v3.4286H17V9H13.5714 M16.4286,11.8571h-2.2857V9.5714h2.2857V11.8571" />
        <path d="M13.5714,13.5714V17H17v-3.4286H13.5714z M16.4286,16.4286h-2.2857v-2.2857h2.2857V16.4286z" />
      </g>
    </svg>
  );
}

function getIcon(node: PresentationHierarchyNode): ReactElement | undefined {
  if (node.extendedData?.imageId === undefined) {
    return undefined;
  }

  switch (node.extendedData.imageId) {
    case "icon-layers":
      return <SvgLayers />;
    case "icon-layers-isolate":
      return <SvgLayersIsolate />;
    case "icon-archive":
      return <SvgArchive />;
  }

  return undefined;
}

function getSublabel(node: PresentationHierarchyNode) {
  return node.extendedData?.description;
}
