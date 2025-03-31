/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "@itwin/components-react";
import { IconButton } from "@itwin/itwinui-react/bricks";
import { TreeWidget } from "../../../TreeWidget.js";
import { hideAllCategories, invertAllCategories, loadCategoriesFromViewport } from "../common/CategoriesVisibilityUtils.js";
import { createIModelAccess } from "../common/internal/Utils.js";
import { hideAllModels, showAll } from "../common/Utils.js";
import { getClassesByView } from "./internal/CategoriesTreeIdsCache.js";

import type { CategoryInfo } from "../common/CategoriesVisibilityUtils.js";
import type { TreeToolbarButtonProps } from "../../tree-header/SelectableTree.js";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { SchemaContext } from "@itwin/ecschema-metadata";

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
 * @public
 */
export function useCategoriesTreeButtonProps({
  viewport,
  getSchemaContext,
}: {
  viewport: Viewport;
  getSchemaContext: (imodel: IModelConnection) => SchemaContext;
}): {
  buttonProps: Pick<CategoriesTreeHeaderButtonProps, "categories" | "viewport" | "models">;
  onCategoriesFiltered: (props: { categories: CategoryInfo[] | undefined; models?: Id64Array }) => void;
} {
  const [filteredCategories, setFilteredCategories] = useState<CategoryInfo[] | undefined>();
  const [filteredModels, setFilteredModels] = useState<Id64Array | undefined>();
  const categories = useCategories(viewport);
  const models = useAvailableModels(viewport, getSchemaContext);
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

const visibilityShowSvg = new URL("@itwin/itwinui-icons/visibility-show.svg", import.meta.url).href;

/** @public */
export function ShowAllButton(props: CategoriesTreeHeaderButtonProps) {
  return (
    <IconButton
      variant={"ghost"}
      label={TreeWidget.translate("categoriesTree.buttons.showAll.tooltip")}
      onClick={() => {
        props.onFeatureUsed?.(`categories-tree-showall`);
        void showAll({ models: props.models, viewport: props.viewport, categories: props.categories.map((category) => category.categoryId) });
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
        void hideAllModels(props.models, props.viewport);
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

function useAvailableModels(viewport: Viewport, getSchemaContext: (imodel: IModelConnection) => SchemaContext): Id64Array {
  const [availableModels, setAvailableModels] = useState<Id64Array>([]);
  const imodel = viewport.iModel;
  const viewType = viewport.view.is2d() ? "2d" : "3d";
  useEffect(() => {
    queryModelsForHeaderActions(imodel, viewType, getSchemaContext)
      .then((models) => {
        setAvailableModels(models);
      })
      .catch(() => {
        setAvailableModels([]);
      });
  }, [imodel, viewType, getSchemaContext]);

  return availableModels;
}

async function queryModelsForHeaderActions(
  iModel: IModelConnection,
  viewType: "2d" | "3d",
  getSchemaContext: (imodel: IModelConnection) => SchemaContext,
): Promise<Id64Array> {
  const { categoryModelClass } = getClassesByView(viewType);
  const models = new Array<Id64String>();
  const query = `
    SELECT
      m.ECInstanceId id
    FROM
      ${categoryModelClass} m
    WHERE
      m.IsPrivate = false
  `;
  const imodelAccess = createIModelAccess({ imodel: iModel, getSchemaContext });
  for await (const _row of imodelAccess.createQueryReader(
    { ecsql: query },
    { restartToken: "tree-widget/categories-tree/is-definition-container-supported-query", rowFormat: "ECSqlPropertyNames" },
  )) {
    models.push(_row.id);
  }
  return models;
}
