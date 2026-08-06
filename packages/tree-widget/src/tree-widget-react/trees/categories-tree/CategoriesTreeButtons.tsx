/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useState } from "react";
import { defaultIfEmpty, firstValueFrom, forkJoin, from, map, mergeAll, mergeMap, of, reduce, takeUntil, toArray } from "rxjs";
import { useAsyncValue } from "@itwin/components-react";
import { IconButton, Tooltip } from "@mui/material";
import visibilityHideSvg from "@stratakit/icons/visibility-hide.svg";
import visibilityInvertSvg from "@stratakit/icons/visibility-invert.svg";
import visibilityShowSvg from "@stratakit/icons/visibility-show.svg";
import { Icon } from "@stratakit/mui";
import { useTranslation } from "../../shared/components/LocalizationContext.js";
import { useErrorState } from "../../shared/internal/hooks/UseErrorState.js";
import { useSharedTreeContextInternal } from "../../shared/internal/SharedTreeContextProviderInternal.js";
import { getClassesByView } from "../../shared/internal/Utils.js";
import { hideAllCategories, invertAllCategories, showAll } from "../../shared/internal/VisibilityUtils.js";

import type { Observable } from "rxjs";
import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { BaseIdsCache } from "../../shared/internal/caches/BaseIdsCache.js";
import type { ModelId } from "../../shared/internal/Types.js";
import type { CategoryInfosMap } from "../../shared/internal/VisibilityUtils.js";
import type { TreeWidgetViewport } from "../../shared/TreeWidgetViewport.js";
import type { TreeToolbarButtonProps } from "../../tree-header/SelectableTree.js";

/**
 * Data structure that describes category.
 * @beta
 */
export interface CategoryInfo {
  categoryId: Id64String;
  subCategoryIds?: Id64Array;
}

/**
 * Props that get passed to `CategoriesTreeComponent` header button renderer.
 * @see CategoriesTreeComponentProps.headerButtons
 * @public
 */
export interface CategoriesTreeHeaderButtonProps extends TreeToolbarButtonProps {
  /** A list of categories available in the iModel */
  categories: CategoryInfo[];
  /** A list of models available in the iModel. */
  models: Id64Array;
}

/**
 * Custom hook that creates props required to render `CategoriesTreeComponent` header button.
 *
 * Example:
 * ```tsx
 * const { buttonProps, onCategoriesFiltered } = useCategoriesTreeButtonProps({ viewport });
 * <TreeWithHeader
 *   buttons={[
 *     <CategoriesTreeComponent.ShowAllButton {...buttonProps} />,
 *     <CategoriesTreeComponent.HideAllButton {...buttonProps} />,
 *   ]}
 * >
 *   <CategoriesTree {...treeProps} onCategoriesFiltered={onCategoriesFiltered} />
 * </TreeWithHeader>
 * ```
 *
 * **Note:** Requires `SharedTreeContextProvider` to be present in components tree above.
 * @public
 */
export function useCategoriesTreeButtonProps({ viewport }: { viewport: TreeWidgetViewport }): {
  buttonProps: Pick<CategoriesTreeHeaderButtonProps, "categories" | "viewport" | "models">;
  onCategoriesFiltered: (props: { categories: CategoryInfo[] | undefined; models?: Id64Array }) => void;
} {
  const [filteredCategories, setFilteredCategories] = useState<CategoryInfo[] | undefined>();
  const [filteredModels, setFilteredModels] = useState<Id64Array | undefined>();

  const categories = useCategories(viewport);
  const models = useAvailableModels(viewport);

  return {
    buttonProps: {
      viewport,
      categories: filteredCategories ?? categories,
      models: filteredModels ?? models,
    },
    onCategoriesFiltered: useCallback((props) => {
      setFilteredCategories(props.categories);
      setFilteredModels(props.models);
    }, []),
  };
}

/** @public */
export type CategoriesTreeHeaderButtonType = (props: CategoriesTreeHeaderButtonProps) => React.ReactElement | null;

/** @public */
export function ShowAllButton(props: CategoriesTreeHeaderButtonProps) {
  const { categories, viewport, onFeatureUsed, models } = props;
  const { cancelChangesInProgress, getBaseIdsCache } = useSharedTreeContextInternal();
  const viewType = viewport.viewType === "2d" ? "2d" : "3d";
  const baseIdsCache = getBaseIdsCache({ imodel: viewport.iModel, elementClassName: getClassesByView(viewType).elementClass, type: viewType });
  const translate = useTranslation();

  const onClick = async () => {
    // cspell:disable-next-line
    onFeatureUsed?.(`categories-tree-showall`);
    cancelChangesInProgress.next();
    // wrap in try catch for getCategoryInfos call
    try {
      const categoryInfos = await getCategoryInfos({ categoriesInfo: categories, baseIdsCache, cancel: cancelChangesInProgress });
      if (!categoryInfos) {
        return;
      }
      showAll({
        viewport,
        modelIds: models,
        categoryInfos,
      });
    } catch {}
  };

  return (
    <Tooltip title={translate("categoriesTree.buttons.showAll.tooltip")}>
      <IconButton
        size="small"
        aria-label={translate("categoriesTree.buttons.showAll.tooltip")}
        disabled={categories.length === 0}
        onClick={() => void onClick()}
      >
        <Icon href={visibilityShowSvg} />
      </IconButton>
    </Tooltip>
  );
}

/** @public */
export function HideAllButton(props: CategoriesTreeHeaderButtonProps) {
  const { categories, viewport, onFeatureUsed } = props;
  const { cancelChangesInProgress, getBaseIdsCache } = useSharedTreeContextInternal();
  const viewType = viewport.viewType === "2d" ? "2d" : "3d";
  const baseIdsCache = getBaseIdsCache({ imodel: viewport.iModel, elementClassName: getClassesByView(viewType).elementClass, type: viewType });
  const translate = useTranslation();

  const onClick = async () => {
    // cspell:disable-next-line
    onFeatureUsed?.(`categories-tree-hideall`);
    cancelChangesInProgress.next();
    // wrap in try catch for getCategoryInfos call
    try {
      const categoryInfos = await getCategoryInfos({ categoriesInfo: categories, baseIdsCache, cancel: cancelChangesInProgress });
      if (!categoryInfos) {
        return;
      }
      hideAllCategories({
        viewport,
        categoryInfos,
      });
    } catch {}
  };
  return (
    <Tooltip title={translate("categoriesTree.buttons.hideAll.tooltip")}>
      <IconButton
        size="small"
        aria-label={translate("categoriesTree.buttons.hideAll.tooltip")}
        disabled={categories.length === 0}
        onClick={() => void onClick()}
      >
        <Icon href={visibilityHideSvg} />
      </IconButton>
    </Tooltip>
  );
}

/** @public */
export function InvertAllButton(props: CategoriesTreeHeaderButtonProps) {
  const { categories, viewport, onFeatureUsed, models } = props;
  const { cancelChangesInProgress, getBaseIdsCache } = useSharedTreeContextInternal();
  const viewType = viewport.viewType === "2d" ? "2d" : "3d";
  const baseIdsCache = getBaseIdsCache({ imodel: viewport.iModel, elementClassName: getClassesByView(viewType).elementClass, type: viewType });
  const translate = useTranslation();

  const onClick = async () => {
    // cspell:disable-next-line
    onFeatureUsed?.(`categories-tree-invert`);
    cancelChangesInProgress.next();
    // wrap in try catch for getCategoryInfos call
    try {
      const categoryInfos = await getCategoryInfos({ categoriesInfo: categories, baseIdsCache, cancel: cancelChangesInProgress });
      if (!categoryInfos) {
        return;
      }
      invertAllCategories({
        viewport,
        modelIds: models,
        categoryInfos,
      });
    } catch {}
  };

  return (
    <Tooltip title={translate("categoriesTree.buttons.invert.tooltip")}>
      <IconButton
        size="small"
        aria-label={translate("categoriesTree.buttons.invert.tooltip")}
        disabled={categories.length === 0}
        onClick={() => void onClick()}
      >
        <Icon href={visibilityInvertSvg} />
      </IconButton>
    </Tooltip>
  );
}

const EMPTY_CATEGORIES_ARRAY: CategoryInfo[] = [];

function useCategories(viewport: TreeWidgetViewport) {
  const setErrorState = useErrorState();
  const { getBaseIdsCache } = useSharedTreeContextInternal();
  const baseIdsCache =
    viewport.viewType !== "other"
      ? getBaseIdsCache({ imodel: viewport.iModel, elementClassName: getClassesByView(viewport.viewType).elementClass, type: viewport.viewType })
      : undefined;
  // eslint-disable-next-line react-hooks/use-memo
  const categoriesPromise = useMemo(async () => {
    try {
      if (baseIdsCache) {
        return await firstValueFrom(
          baseIdsCache.getAllCategoriesOfElements().pipe(
            mergeAll(),
            mergeMap((categoryId) => forkJoin({ categoryId: of(categoryId), subCategories: baseIdsCache.getSubCategories({ categoryId }) })),
            toArray(),
          ),
        );
      }
      return [];
    } catch (error) {
      setErrorState(error);
      return [];
    }
  }, [baseIdsCache, setErrorState]);
  return useAsyncValue(categoriesPromise) ?? EMPTY_CATEGORIES_ARRAY;
}

function useAvailableModels(viewport: TreeWidgetViewport): Array<ModelId> {
  const [availableModels, setAvailableModels] = useState<Array<ModelId>>([]);
  const setErrorState = useErrorState();
  const imodel = viewport.iModel;
  const { getBaseIdsCache } = useSharedTreeContextInternal();
  const baseIdsCache =
    viewport.viewType !== "other"
      ? getBaseIdsCache({ imodel: viewport.iModel, elementClassName: getClassesByView(viewport.viewType).elementClass, type: viewport.viewType })
      : undefined;
  useEffect(() => {
    const getModels = async () => {
      try {
        if (baseIdsCache) {
          const models = await firstValueFrom(baseIdsCache.getAllModels());
          setAvailableModels(models);
        }
        return;
      } catch (error) {
        setErrorState(error);
        setAvailableModels([]);
      }
    };
    void getModels();
  }, [imodel, baseIdsCache, setErrorState]);

  return availableModels;
}

async function getCategoryInfos({
  categoriesInfo,
  baseIdsCache,
  cancel,
}: {
  categoriesInfo: CategoryInfo[];
  baseIdsCache: BaseIdsCache;
  cancel: Observable<void>;
}): Promise<CategoryInfosMap | undefined> {
  return firstValueFrom(
    from(categoriesInfo).pipe(
      mergeMap((categoryInfo) => {
        if (categoryInfo.subCategoryIds && categoryInfo.subCategoryIds.length > 0) {
          return of({ categoryId: categoryInfo.categoryId, subCategoryIds: categoryInfo.subCategoryIds });
        }
        return baseIdsCache
          .getSubCategories({ categoryId: categoryInfo.categoryId })
          .pipe(map((subCategoryIds) => ({ categoryId: categoryInfo.categoryId, subCategoryIds })));
      }),
      reduce((acc: CategoryInfosMap, category) => {
        acc.set(category.categoryId, category.subCategoryIds);
        return acc;
      }, new Map()),
      takeUntil(cancel),
      defaultIfEmpty(undefined),
    ),
  );
}
