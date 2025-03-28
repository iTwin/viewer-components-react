/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "@itwin/components-react";
import { IconButton } from "@itwin/itwinui-react/bricks";
import { TreeWidget } from "../../../TreeWidget.js";
import { hideAllCategories, invertAllCategories, loadCategoriesFromViewport, showAllCategories } from "../common/CategoriesVisibilityUtils.js";
import { hideAllModels, invertAllModels } from "../common/Utils.js";
import { getClassesByView } from "./internal/CategoriesTreeIdsCache.js";
import { showAllModelsCategoriesTree } from "./internal/CategoriesTreeVisibilityHandler.js";

import type { CategoryInfo } from "../common/CategoriesVisibilityUtils.js";
import type { TreeToolbarButtonProps } from "../../tree-header/SelectableTree.js";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { ModelQueryParams } from "@itwin/core-common";
import type { CategoriesTreeHierarchyConfiguration } from "./CategoriesTreeDefinition.js";
import type { Id64Array, Id64String } from "@itwin/core-bentley";

/**
 * Props that get passed to `CategoriesTreeComponent` header button renderer.
 * @see CategoriesTreeComponentProps.headerButtons
 * @public
 */
export interface CategoriesTreeHeaderButtonProps extends TreeToolbarButtonProps {
  /** A list of categories available in the iModel */
  categories: CategoryInfo[];
  /** A list of models available in the iModel. */
  models?: Id64Array;
  /**  */
  hierarchyConfig?: Partial<CategoriesTreeHierarchyConfiguration>;
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
 * @public
 */
export function useCategoriesTreeButtonProps({
  viewport,
  hierarchyConfig,
}: {
  viewport: Viewport;
  hierarchyConfig?: Partial<CategoriesTreeHierarchyConfiguration>;
}): {
  buttonProps: Pick<CategoriesTreeHeaderButtonProps, "categories" | "viewport" | "models" | "hierarchyConfig">;
  onCategoriesFiltered: (props: { categories: CategoryInfo[] | undefined; models?: Id64Array }) => void;
} {
  const [filteredCategories, setFilteredCategories] = useState<CategoryInfo[] | undefined>();
  const [filteredModels, setFilteredModels] = useState<Id64Array | undefined>();
  const categories = useCategories(viewport);
  const models = useAvailableModels(viewport, hierarchyConfig?.showElements);
  return {
    buttonProps: {
      viewport,
      categories: filteredCategories ?? categories,
      models: filteredModels ?? models,
      hierarchyConfig,
    },
    onCategoriesFiltered: useCallback((props) => {
      setFilteredCategories(props.categories);
      setFilteredModels(props.models);
    }, []),
  };
}

/** @public */
export type CategoriesTreeHeaderButtonType = (props: CategoriesTreeHeaderButtonProps) => React.ReactElement | null;

const visibilityShowSvg = new URL("@itwin/itwinui-icons/visibility-show.svg", import.meta.url).href;

/** @public */
export function ShowAllButton(props: CategoriesTreeHeaderButtonProps) {
  return (
    <IconButton
      variant={"ghost"}
      label={TreeWidget.translate("categoriesTree.buttons.showAll.tooltip")}
      onClick={() => {
        props.onFeatureUsed?.(`categories-tree-showall`);
        void showAllCategories(
          props.categories.map((category) => category.categoryId),
          props.viewport,
        );
        if (props.hierarchyConfig?.showElements && props.models) {
          void showAllModelsCategoriesTree(props.models, props.viewport);
        }
      }}
      icon={visibilityShowSvg}
    />
  );
}

const visibilityHideSvg = new URL("@itwin/itwinui-icons/visibility-hide.svg", import.meta.url).href;

/** @public */
export function HideAllButton(props: CategoriesTreeHeaderButtonProps) {
  return (
    <IconButton
      variant={"ghost"}
      label={TreeWidget.translate("categoriesTree.buttons.hideAll.tooltip")}
      onClick={() => {
        props.onFeatureUsed?.(`categories-tree-hideall`);
        void hideAllCategories(
          props.categories.map((category) => category.categoryId),
          props.viewport,
        );
        if (props.models && props.hierarchyConfig?.showElements) {
          void hideAllModels(props.models, props.viewport);
        }
      }}
      icon={visibilityHideSvg}
    />
  );
}

const visibilityInvertSvg = new URL("@itwin/itwinui-icons/visibilty-invert.svg", import.meta.url).href;

/** @public */
export function InvertAllButton(props: CategoriesTreeHeaderButtonProps) {
  return (
    <IconButton
      variant={"ghost"}
      label={TreeWidget.translate("categoriesTree.buttons.invert.tooltip")}
      onClick={() => {
        props.onFeatureUsed?.(`categories-tree-invert`);
        void invertAllCategories(props.categories, props.viewport);
        if (props.hierarchyConfig?.showElements && props.models) {
          void invertAllModels(props.models, props.viewport);
        }
      }}
      icon={visibilityInvertSvg}
    />
  );
}

const EMPTY_CATEGORIES_ARRAY: CategoryInfo[] = [];

export function useCategories(viewport: Viewport) {
  const categoriesPromise = useMemo(async () => loadCategoriesFromViewport(viewport), [viewport]);
  return useAsyncValue(categoriesPromise) ?? EMPTY_CATEGORIES_ARRAY;
}

function useAvailableModels(viewport: Viewport, getModels?: boolean): Id64Array | undefined {
  const [availableModels, setAvailableModels] = useState<Id64Array | undefined>();
  const imodel = viewport.iModel;
  const viewType = viewport.view.is2d() ? "2d" : "3d";
  useEffect(() => {
    if (getModels) {
      queryModelsForHeaderActions(imodel, viewType)
        .then((models) => {
          setAvailableModels(models);
        })
        .catch(() => {
          setAvailableModels([]);
        });
    }
  }, [imodel, viewType, getModels]);

  return availableModels;
}

async function queryModelsForHeaderActions(iModel: IModelConnection, viewType: "2d" | "3d"): Promise<Id64Array> {
  const { categoryModelClass } = getClassesByView(viewType);
  const queryParams: ModelQueryParams = {
    from: categoryModelClass,
    where: `
        EXISTS (
          SELECT 1
          FROM BisCore.Element e
          WHERE e.ECClassId IS (${categoryModelClass}, BisCore.InformationPartitionElement)
            AND e.ECInstanceId = GeometricModel${viewType}.ModeledElement.Id
        )
      `,
    wantPrivate: false,
  };

  const modelProps = await iModel.models.queryProps(queryParams);
  return modelProps.map(({ id }) => id).filter((id): id is Id64String => id !== undefined);
}
