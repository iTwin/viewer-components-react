/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useState } from "react";
import { defaultIfEmpty, firstValueFrom, forkJoin, from, map, mergeAll, mergeMap, of, reduce, takeUntil, toArray } from "rxjs";
import { IconButton } from "@mui/material";
import visibilityHideSvg from "@stratakit/icons/visibility-hide.svg";
import visibilityInvertSvg from "@stratakit/icons/visibility-invert.svg";
import visibilityShowSvg from "@stratakit/icons/visibility-show.svg";
import { Icon } from "@stratakit/mui";
import { useTranslation } from "../../shared/contexts/LocalizationContext.js";
import { useSharedTreeContext } from "../../shared/contexts/SharedTreeContext.js";
import { useTelemetryContext } from "../../shared/contexts/TelemetryContext.js";
import { useErrorState } from "../../shared/internal/hooks/UseErrorState.js";
import { getClassesByPerspective } from "../../shared/internal/Utils.js";
import { hideAllCategories, invertAllCategories, showAll } from "../../shared/internal/VisibilityUtils.js";

import type { Observable } from "rxjs";
import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { SharedIdsProvider } from "../../shared/internal/idsProviders/SharedIdsProvider.js";
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
 * Returned `isLoaded` tells whether available categories and models have been loaded. Until then, `buttonProps.categories` and `buttonProps.models` are empty.
 *
 * **Note:** Requires `TreeWidgetContextProvider` to be present in components tree above.
 * @public
 */
export function useCategoriesTreeButtonProps({ viewport }: { viewport: TreeWidgetViewport }): {
  buttonProps: Pick<CategoriesTreeHeaderButtonProps, "categories" | "viewport" | "models">;
  onCategoriesFiltered: (props: { categories: CategoryInfo[] | undefined; models?: Id64Array }) => void;
  isLoaded: boolean;
} {
  const [filteredCategories, setFilteredCategories] = useState<CategoryInfo[] | undefined>();
  const [filteredModels, setFilteredModels] = useState<Id64Array | undefined>();

  const { categories, models, isLoaded } = useCategoriesAndModels(viewport);

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
    isLoaded,
  };
}

/** @public */
export type CategoriesTreeHeaderButtonType = (props: CategoriesTreeHeaderButtonProps) => React.ReactElement | null;

/** @public */
export function ShowAllButton(props: CategoriesTreeHeaderButtonProps) {
  const { categories, viewport, models } = props;
  const { onFeatureUsed } = useTelemetryContext();
  const { cancelChangesInProgress, getSharedIdsProvider } = useSharedTreeContext();
  const perspective = viewport.viewType === "2d" ? "2d" : "3d";
  const sharedIdsProvider = getSharedIdsProvider({ imodel: viewport.iModel, elementClassName: getClassesByPerspective(perspective).elementClass, perspective });
  const translate = useTranslation();

  const onClick = async () => {
    // cspell:disable-next-line
    onFeatureUsed({ featureId: `categories-tree-showall`, reportInteraction: true });
    cancelChangesInProgress.next();
    // wrap in try catch for getCategoryInfos call
    try {
      const categoryInfos = await getCategoryInfos({ categoriesInfo: categories, sharedIdsProvider, cancel: cancelChangesInProgress });
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
    <IconButton size="small" label={translate("categoriesTree.buttons.showAll.tooltip")} disabled={categories.length === 0} onClick={onClick}>
      <Icon href={visibilityShowSvg} />
    </IconButton>
  );
}

/** @public */
export function HideAllButton(props: CategoriesTreeHeaderButtonProps) {
  const { categories, viewport } = props;
  const { onFeatureUsed } = useTelemetryContext();
  const { cancelChangesInProgress, getSharedIdsProvider } = useSharedTreeContext();
  const perspective = viewport.viewType === "2d" ? "2d" : "3d";
  const sharedIdsProvider = getSharedIdsProvider({ imodel: viewport.iModel, elementClassName: getClassesByPerspective(perspective).elementClass, perspective });
  const translate = useTranslation();

  const onClick = async () => {
    // cspell:disable-next-line
    onFeatureUsed({ featureId: `categories-tree-hideall`, reportInteraction: true });
    cancelChangesInProgress.next();
    // wrap in try catch for getCategoryInfos call
    try {
      const categoryInfos = await getCategoryInfos({ categoriesInfo: categories, sharedIdsProvider, cancel: cancelChangesInProgress });
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
    <IconButton size="small" label={translate("categoriesTree.buttons.hideAll.tooltip")} disabled={categories.length === 0} onClick={onClick}>
      <Icon href={visibilityHideSvg} />
    </IconButton>
  );
}

/** @public */
export function InvertAllButton(props: CategoriesTreeHeaderButtonProps) {
  const { categories, viewport, models } = props;
  const { onFeatureUsed } = useTelemetryContext();
  const { cancelChangesInProgress, getSharedIdsProvider } = useSharedTreeContext();
  const perspective = viewport.viewType === "2d" ? "2d" : "3d";
  const sharedIdsProvider = getSharedIdsProvider({ imodel: viewport.iModel, elementClassName: getClassesByPerspective(perspective).elementClass, perspective });
  const translate = useTranslation();

  const onClick = async () => {
    // cspell:disable-next-line
    onFeatureUsed({ featureId: `categories-tree-invert`, reportInteraction: true });
    cancelChangesInProgress.next();
    // wrap in try catch for getCategoryInfos call
    try {
      const categoryInfos = await getCategoryInfos({ categoriesInfo: categories, sharedIdsProvider, cancel: cancelChangesInProgress });
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
    <IconButton size="small" label={translate("categoriesTree.buttons.invert.tooltip")} disabled={categories.length === 0} onClick={onClick}>
      <Icon href={visibilityInvertSvg} />
    </IconButton>
  );
}

interface CategoriesAndModels {
  categories: CategoryInfo[];
  models: Array<ModelId>;
  isLoaded: boolean;
}

const EMPTY_CATEGORIES_AND_MODELS: CategoriesAndModels = { categories: [], models: [], isLoaded: true };

/** Loads categories and models together, so that buttons never get categories without models they're in. */
function useCategoriesAndModels(viewport: TreeWidgetViewport): CategoriesAndModels {
  const [categoriesAndModels, setCategoriesAndModels] = useState<CategoriesAndModels>({ categories: [], models: [], isLoaded: false });
  const setErrorState = useErrorState();
  const { getSharedIdsProvider } = useSharedTreeContext();
  const sharedIdsProvider =
    viewport.viewType !== "other"
      ? getSharedIdsProvider({
          imodel: viewport.iModel,
          perspective: viewport.viewType,
          elementClassName: getClassesByPerspective(viewport.viewType).elementClass,
        })
      : undefined;
  useEffect(() => {
    if (!sharedIdsProvider) {
      return;
    }
    let disposed = false;
    const load = async () => {
      try {
        const result = await firstValueFrom(
          forkJoin({
            categories: sharedIdsProvider.categories.getAllCategoriesOfPerspective().pipe(
              mergeAll(),
              mergeMap((categoryId) =>
                forkJoin({ categoryId: of(categoryId), subCategories: sharedIdsProvider.subCategories.getSubCategories({ categoryId }) }),
              ),
              toArray(),
            ),
            models: sharedIdsProvider.models.getAllModelsOfPerspective().pipe(map((models) => models.map(({ id }) => id))),
          }),
        );
        !disposed && setCategoriesAndModels({ ...result, isLoaded: true });
      } catch (error) {
        if (!disposed) {
          setErrorState(error);
          setCategoriesAndModels(EMPTY_CATEGORIES_AND_MODELS);
        }
      }
    };
    void load();
    return () => {
      disposed = true;
    };
  }, [sharedIdsProvider, setErrorState]);

  return sharedIdsProvider ? categoriesAndModels : EMPTY_CATEGORIES_AND_MODELS;
}

async function getCategoryInfos({
  categoriesInfo,
  sharedIdsProvider,
  cancel,
}: {
  categoriesInfo: CategoryInfo[];
  sharedIdsProvider: SharedIdsProvider;
  cancel: Observable<void>;
}): Promise<CategoryInfosMap | undefined> {
  return firstValueFrom(
    from(categoriesInfo).pipe(
      mergeMap((categoryInfo) => {
        if (categoryInfo.subCategoryIds && categoryInfo.subCategoryIds.length > 0) {
          return of({ categoryId: categoryInfo.categoryId, subCategoryIds: categoryInfo.subCategoryIds });
        }
        return sharedIdsProvider.subCategories
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
