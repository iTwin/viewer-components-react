/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "@itwin/components-react";
import { QueryRowFormat } from "@itwin/core-common";
import { IconButton } from "@stratakit/bricks";
import visibilityHideSvg from "@stratakit/icons/visibility-hide.svg";
import visibilityInvertSvg from "@stratakit/icons/visibility-invert.svg";
import visibilityShowSvg from "@stratakit/icons/visibility-show.svg";
import { TreeWidget } from "../../../TreeWidget.js";
import { hideAllCategories, invertAllCategories } from "../common/CategoriesVisibilityUtils.js";
import { getClassesByView } from "../common/internal/Utils.js";
import { loadCategoriesFromViewport } from "../common/internal/VisibilityUtils.js";
import { createTreeWidgetViewport, isTreeWidgetViewport } from "../common/TreeWidgetViewport.js";
import { hideAllModels, showAll } from "../common/Utils.js";

import type { IModelConnection, Viewport } from "@itwin/core-frontend";
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
 * @public
 */
export function useCategoriesTreeButtonProps({ viewport }: { viewport: Viewport | TreeWidgetViewport }): {
  buttonProps: Pick<CategoriesTreeHeaderButtonProps, "categories" | "viewport" | "models">;
  onCategoriesFiltered: (props: { categories: CategoryInfo[] | undefined; models?: Id64Array }) => void;
} {
  const [filteredCategories, setFilteredCategories] = useState<CategoryInfo[] | undefined>();
  const [filteredModels, setFilteredModels] = useState<Id64Array | undefined>();

  const treeWidgetViewport = useMemo(() => {
    return isTreeWidgetViewport(viewport) ? viewport : createTreeWidgetViewport(viewport);
  }, [viewport]);
  const categories = useCategories(treeWidgetViewport);
  const models = useAvailableModels(treeWidgetViewport);
  return {
    buttonProps: {
      viewport: treeWidgetViewport,
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
  const treeWidgetViewport = useMemo(() => {
    return isTreeWidgetViewport(props.viewport) ? props.viewport : createTreeWidgetViewport(props.viewport);
  }, [props.viewport]);

  return (
    <IconButton
      variant={"ghost"}
      label={TreeWidget.translate("categoriesTree.buttons.showAll.tooltip")}
      onClick={() => {
        // cspell:disable-next-line
        props.onFeatureUsed?.(`categories-tree-showall`);
        void showAll({ models: props.models, viewport: treeWidgetViewport, categories: props.categories.map((category) => category.categoryId) });
      }}
      icon={visibilityShowSvg}
    />
  );
}

/** @public */
export function HideAllButton(props: CategoriesTreeHeaderButtonProps) {
  const treeWidgetViewport = useMemo(() => {
    return isTreeWidgetViewport(props.viewport) ? props.viewport : createTreeWidgetViewport(props.viewport);
  }, [props.viewport]);
  return (
    <IconButton
      variant={"ghost"}
      label={TreeWidget.translate("categoriesTree.buttons.hideAll.tooltip")}
      onClick={() => {
        // cspell:disable-next-line
        props.onFeatureUsed?.(`categories-tree-hideall`);
        void hideAllCategories(
          props.categories.map((category) => category.categoryId),
          treeWidgetViewport,
        );
        void hideAllModels(props.models, treeWidgetViewport);
      }}
      icon={visibilityHideSvg}
    />
  );
}

/** @public */
export function InvertAllButton(props: CategoriesTreeHeaderButtonProps) {
  const treeWidgetViewport = useMemo(() => {
    return isTreeWidgetViewport(props.viewport) ? props.viewport : createTreeWidgetViewport(props.viewport);
  }, [props.viewport]);
  return (
    <IconButton
      variant={"ghost"}
      label={TreeWidget.translate("categoriesTree.buttons.invert.tooltip")}
      onClick={() => {
        props.onFeatureUsed?.(`categories-tree-invert`);
        void invertAllCategories(props.categories, treeWidgetViewport);
      }}
      icon={visibilityInvertSvg}
    />
  );
}

const EMPTY_CATEGORIES_ARRAY: CategoryInfo[] = [];

/** @internal */
export function useCategories(viewport: TreeWidgetViewport) {
  const categoriesPromise = useMemo(async () => loadCategoriesFromViewport(viewport), [viewport]);
  return useAsyncValue(categoriesPromise) ?? EMPTY_CATEGORIES_ARRAY;
}

function useAvailableModels(viewport: TreeWidgetViewport): Array<ModelId> {
  const [availableModels, setAvailableModels] = useState<Array<ModelId>>([]);
  const imodel = viewport.iModel;
  const viewType = viewport.viewType === "2d" ? "2d" : "3d";
  useEffect(() => {
    queryModelsForHeaderActions(imodel, viewType)
      .then((models) => {
        setAvailableModels(models);
      })
      .catch(() => {
        setAvailableModels([]);
      });
  }, [imodel, viewType]);

  return availableModels;
}

async function queryModelsForHeaderActions(iModel: IModelConnection, viewType: "2d" | "3d"): Promise<Array<ModelId>> {
  const { modelClass } = getClassesByView(viewType);
  const models = new Array<ModelId>();
  const query = `
    SELECT
      m.ECInstanceId id
    FROM
      ${modelClass} m
    WHERE
      m.IsPrivate = false
  `;
  for await (const _row of iModel.createQueryReader(query, undefined, {
    restartToken: "tree-widget/categories-tree/all-models-query",
    rowFormat: QueryRowFormat.UseECSqlPropertyNames,
  })) {
    models.push(_row.id);
  }
  return models;
}
