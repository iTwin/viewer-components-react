/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useState } from "react";
import { firstValueFrom, forkJoin, mergeAll, mergeMap, of, toArray } from "rxjs";
import { useAsyncValue } from "@itwin/components-react";
import { IconButton } from "@stratakit/bricks";
import visibilityHideSvg from "@stratakit/icons/visibility-hide.svg";
import visibilityInvertSvg from "@stratakit/icons/visibility-invert.svg";
import visibilityShowSvg from "@stratakit/icons/visibility-show.svg";
import { TreeWidget } from "../../../TreeWidget.js";
import { hideAllCategories, invertAllCategories } from "../common/CategoriesVisibilityUtils.js";
import { useSharedTreeContextInternal } from "../common/internal/SharedTreeWidgetContextProviderInternal.js";
import { useErrorState } from "../common/internal/UseErrorState.js";
import { useGuid } from "../common/internal/useGuid.js";
import { getClassesByView } from "../common/internal/Utils.js";
import { hideAllModels, showAll } from "../common/Utils.js";

import type { Id64Array } from "@itwin/core-bentley";
import type { TreeToolbarButtonProps } from "../../tree-header/SelectableTree.js";
import type { CategoryInfo } from "../common/CategoriesVisibilityUtils.js";
import type { ModelId } from "../common/internal/Types.js";
import type { TreeWidgetViewport } from "../common/TreeWidgetViewport.js";

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
  const componentId = useGuid();
  return (
    <IconButton
      variant={"ghost"}
      label={TreeWidget.translate("categoriesTree.buttons.showAll.tooltip")}
      onClick={() => {
        // cspell:disable-next-line
        props.onFeatureUsed?.(`categories-tree-showall`);
        void showAll({
          models: props.models,
          viewport: props.viewport,
          categories: props.categories.map((category) => category.categoryId),
          componentId,
        }).catch(() => {});
      }}
      icon={visibilityShowSvg}
    />
  );
}

/** @public */
export function HideAllButton(props: CategoriesTreeHeaderButtonProps) {
  return (
    <IconButton
      variant={"ghost"}
      label={TreeWidget.translate("categoriesTree.buttons.hideAll.tooltip")}
      onClick={() => {
        // cspell:disable-next-line
        props.onFeatureUsed?.(`categories-tree-hideall`);
        void hideAllCategories(
          props.categories.map((category) => category.categoryId),
          props.viewport,
        );
        hideAllModels(props.models, props.viewport);
      }}
      icon={visibilityHideSvg}
    />
  );
}

/** @public */
export function InvertAllButton(props: CategoriesTreeHeaderButtonProps) {
  return (
    <IconButton
      variant={"ghost"}
      label={TreeWidget.translate("categoriesTree.buttons.invert.tooltip")}
      onClick={() => {
        props.onFeatureUsed?.(`categories-tree-invert`);
        void invertAllCategories(props.categories, props.viewport);
      }}
      icon={visibilityInvertSvg}
    />
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
