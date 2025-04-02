/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { assert } from "@itwin/core-bentley";
import { Icon } from "@itwin/itwinui-react/bricks";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { HierarchyFilteringPath, HierarchyNodeIdentifier } from "@itwin/presentation-hierarchies";
import { EmptyTreeContent, FilterUnknownError, NoFilterMatches, TooManyFilterMatches } from "../common/components/EmptyTree.js";
import { DEFINITION_CONTAINER_CLASS_NAME, SUB_CATEGORY_CLASS_NAME } from "../common/internal/ClassNameDefinitions.js";
import { useIModelChangeListener } from "../common/internal/UseIModelChangeListener.js";
import { getClassesByView } from "../common/internal/Utils.js";
import { FilterLimitExceededError } from "../common/TreeErrors.js";
import { useTelemetryContext } from "../common/UseTelemetryContext.js";
import { CategoriesTreeDefinition, defaultHierarchyConfiguration } from "./CategoriesTreeDefinition.js";
import { CategoriesTreeIdsCache } from "./internal/CategoriesTreeIdsCache.js";
import { createCategoriesTreeVisibilityHandler } from "./internal/CategoriesTreeVisibilityHandler.js";

import type { ReactNode } from "react";
import type { Id64Array } from "@itwin/core-bentley";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { VisibilityTreeProps } from "../common/components/VisibilityTree.js";
import type { VisibilityTreeRendererProps } from "../common/components/VisibilityTreeRenderer.js";
import type { CategoryInfo } from "../common/CategoriesVisibilityUtils.js";
import type { CategoriesTreeHierarchyConfiguration } from "./CategoriesTreeDefinition.js";
import type { CategoryId, ElementId, ModelId, SubCategoryId, SubModelId } from "../common/internal/Types.js";

type CategoriesTreeFilteringError = "tooManyFilterMatches" | "unknownFilterError";
type HierarchyFilteringPaths = Awaited<ReturnType<Required<VisibilityTreeProps>["getFilteredPaths"]>>;

/** @beta */
export interface UseCategoriesTreeProps {
  activeView: Viewport;
  onCategoriesFiltered?: (props: { categories: CategoryInfo[] | undefined; models?: Id64Array }) => void;
  filter?: string;
  emptyTreeContent?: ReactNode;
  hierarchyConfig?: Partial<CategoriesTreeHierarchyConfiguration>;
}

/** @beta */
interface UseCategoriesTreeResult {
  categoriesTreeProps: Pick<
    VisibilityTreeProps,
    "treeName" | "getHierarchyDefinition" | "getFilteredPaths" | "visibilityHandlerFactory" | "highlight" | "emptyTreeContent"
  >;
  rendererProps: Required<Pick<VisibilityTreeRendererProps, "getDecorations" | "getSublabel">>;
}

function createVisibilityHandlerFactory(
  activeView: Viewport,
  idsCacheGetter: () => CategoriesTreeIdsCache,
  hierarchyConfig: CategoriesTreeHierarchyConfiguration,
  filteredPaths?: HierarchyFilteringPath[],
): VisibilityTreeProps["visibilityHandlerFactory"] {
  return ({ imodelAccess }) =>
    createCategoriesTreeVisibilityHandler({ viewport: activeView, idsCache: idsCacheGetter(), imodelAccess, filteredPaths, hierarchyConfig });
}

function useIdsCache(imodel: IModelConnection, viewType: "2d" | "3d", filteredPaths?: HierarchyFilteringPath[]) {
  const cacheRef = useRef<CategoriesTreeIdsCache | undefined>(undefined);
  const clearCacheRef = useRef(() => () => {
    cacheRef.current?.[Symbol.dispose]?.();
    cacheRef.current = undefined;
  });
  const createCacheGetterRef = useRef((currImodel: IModelConnection, currViewType: "2d" | "3d") => () => {
    if (cacheRef.current === undefined) {
      cacheRef.current = new CategoriesTreeIdsCache(createECSqlQueryExecutor(currImodel), currViewType);
    }
    return cacheRef.current;
  });
  const [getCache, setCacheGetter] = useState<() => CategoriesTreeIdsCache>(() => createCacheGetterRef.current(imodel, viewType));

  useEffect(() => {
    // clear cache in case it was created before `useEffect` was run first time
    clearCacheRef.current();

    // make sure all cache users rerender
    setCacheGetter(() => createCacheGetterRef.current(imodel, viewType));
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      clearCacheRef.current();
    };
  }, [imodel, viewType]);

  useEffect(() => {
    cacheRef.current?.clearFilteredElementsModels();
  }, [filteredPaths]);

  useIModelChangeListener({
    imodel,
    action: useCallback(() => {
      clearCacheRef.current();
      // make sure all cache users rerender
      setCacheGetter(() => createCacheGetterRef.current(imodel, viewType));
    }, [imodel, viewType]),
  });

  return {
    getCache,
  };
}

function useCachedVisibility(activeView: Viewport, hierarchyConfig: CategoriesTreeHierarchyConfiguration, viewType: "2d" | "3d") {
  const [filteredPaths, setFilteredPaths] = useState<HierarchyFilteringPath[]>();
  const { getCache: getCategoriesTreeIdsCache } = useIdsCache(activeView.iModel, viewType, filteredPaths);

  const [visibilityHandlerFactory, setVisibilityHandlerFactory] = useState<VisibilityTreeProps["visibilityHandlerFactory"]>(() =>
    createVisibilityHandlerFactory(activeView, getCategoriesTreeIdsCache, hierarchyConfig, filteredPaths),
  );

  useEffect(() => {
    setVisibilityHandlerFactory(() => createVisibilityHandlerFactory(activeView, getCategoriesTreeIdsCache, hierarchyConfig, filteredPaths));
  }, [activeView, getCategoriesTreeIdsCache, hierarchyConfig, filteredPaths]);

  return {
    getCategoriesTreeIdsCache,
    visibilityHandlerFactory,
    onFilteredPathsChanged: useCallback((paths: HierarchyFilteringPath[] | undefined) => setFilteredPaths(paths), []),
  };
}

/**
 * Custom hook to create and manage state for the categories tree.
 * @beta
 */
export function useCategoriesTree({
  filter,
  activeView,
  onCategoriesFiltered,
  emptyTreeContent,
  hierarchyConfig,
}: UseCategoriesTreeProps): UseCategoriesTreeResult {
  const [filteringError, setFilteringError] = useState<CategoriesTreeFilteringError | undefined>();
  const hierarchyConfiguration = useMemo<CategoriesTreeHierarchyConfiguration>(
    () => ({
      ...defaultHierarchyConfiguration,
      ...hierarchyConfig,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    Object.values(hierarchyConfig ?? {}),
  );
  const viewType = activeView.view.is2d() ? "2d" : "3d";

  const { getCategoriesTreeIdsCache, visibilityHandlerFactory, onFilteredPathsChanged } = useCachedVisibility(activeView, hierarchyConfiguration, viewType);

  const { onFeatureUsed } = useTelemetryContext();

  const getHierarchyDefinition = useCallback<VisibilityTreeProps["getHierarchyDefinition"]>(
    (props) => {
      return new CategoriesTreeDefinition({ ...props, viewType, idsCache: getCategoriesTreeIdsCache(), hierarchyConfig: hierarchyConfiguration });
    },
    [viewType, getCategoriesTreeIdsCache, hierarchyConfiguration],
  );

  const getFilteredPaths = useMemo<VisibilityTreeProps["getFilteredPaths"] | undefined>(() => {
    setFilteringError(undefined);
    onCategoriesFiltered?.({ categories: undefined, models: undefined });
    if (!filter) {
      onFilteredPathsChanged(undefined);
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
    categoriesTreeProps: {
      treeName: "categories-tree-v2",
      getHierarchyDefinition,
      getFilteredPaths,
      visibilityHandlerFactory,
      emptyTreeContent: getEmptyTreeContentComponent(filter, filteringError, emptyTreeContent),
      highlight: filter ? { text: filter } : undefined,
    },
    rendererProps: {
      getDecorations: (node) => <CategoriesTreeIcon node={node} />,
      getSublabel,
    },
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
  const subModelIds = new Set<SubModelId>();

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

    if (lastNodeInfo.lastNode.className === DEFINITION_CONTAINER_CLASS_NAME) {
      const definitionContainerCategories = await idsCache.getAllContainedCategories([lastNodeInfo.lastNode.id]);
      for (const categoryId of definitionContainerCategories) {
        const value = categories.get(categoryId);
        if (value === undefined) {
          categories.set(categoryId, []);
        }
      }
      continue;
    }

    if (lastNodeInfo.lastNode.className === SUB_CATEGORY_CLASS_NAME) {
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
  const rootElementModelMap = await idsCache.getFilteredElementsModels([...rootFilteredElementIds]);
  const models = [...subModelIds, ...new Set(rootElementModelMap.values())];
  return {
    categories: [...categories.entries()].map(([categoryId, subCategoryIds]) => ({
      categoryId,
      subCategoryIds: subCategoryIds.length === 0 ? undefined : subCategoryIds,
    })),
    models,
  };
}

const categorySvg = new URL("@itwin/itwinui-icons/bis-category-3d.svg", import.meta.url).href;

function getEmptyTreeContentComponent(filter?: string, error?: CategoriesTreeFilteringError, emptyTreeContent?: React.ReactNode) {
  if (error) {
    if (error === "tooManyFilterMatches") {
      return <TooManyFilterMatches base={"categoriesTree"} />;
    }
    return <FilterUnknownError base={"categoriesTree"} />;
  }
  if (filter) {
    return <NoFilterMatches base={"categoriesTree"} />;
  }
  if (emptyTreeContent) {
    return emptyTreeContent;
  }
  return <EmptyTreeContent icon={categorySvg} />;
}

const subcategorySvg = new URL("@itwin/itwinui-icons/bis-category-subcategory.svg", import.meta.url).href;
const definitionContainerSvg = new URL("@itwin/itwinui-icons/bis-definitions-container.svg", import.meta.url).href;
const classSvg = new URL("@itwin/itwinui-icons/bis-class.svg", import.meta.url).href;
const elementSvg = new URL("@itwin/itwinui-icons/bis-element.svg", import.meta.url).href;

/** @beta */
export function CategoriesTreeIcon({ node }: { node: PresentationHierarchyNode }) {
  if (node.extendedData?.imageId === undefined) {
    return undefined;
  }

  const getIcon = () => {
    switch (node.extendedData!.imageId) {
      case "icon-layers":
        return categorySvg;
      case "icon-layers-isolate":
        return subcategorySvg;
      case "icon-definition-container":
        return definitionContainerSvg;
      case "icon-item":
        return elementSvg;
      case "icon-ec-class":
        return classSvg;
      default:
        return undefined;
    }
  };

  return <Icon href={getIcon()} />;
}

function getSublabel(node: PresentationHierarchyNode) {
  return node.extendedData?.description;
}
