/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useMemo } from "react";
import { useAsyncValue } from "@itwin/components-react";
import { SvgVisibilityHalf, SvgVisibilityHide, SvgVisibilityShow } from "@itwin/itwinui-icons-react";
import { IconButton } from "@itwin/itwinui-react";
import { TreeWidget } from "../../../TreeWidget";
import { hideAllCategories, invertAllCategories, loadCategoriesFromViewport, showAllCategories } from "../common/CategoriesVisibilityUtils";

import type { CategoryInfo } from "../common/CategoriesVisibilityUtils";
import type { TreeHeaderButtonProps } from "../../tree-header/TreeHeader";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";

/**
 * Props that get passed to `CategoriesTreeComponent` header button renderer.
 * @see CategoriesTreeComponentProps.headerButtons
 * @public
 */
export interface CategoriesTreeHeaderButtonProps extends TreeHeaderButtonProps {
  /** A list of categories available in the iModel */
  categories: CategoryInfo[];
}

/**
 * Custom hook that creates props required to render `CategoriesTreeComponent` header button.
 * @public
 */
export function useCategoriesTreeButtonProps({
  viewport,
}: {
  imodel: IModelConnection;
  viewport: Viewport;
}): Pick<CategoriesTreeHeaderButtonProps, "categories" | "viewport"> {
  const categories = useCategories(viewport);
  return {
    viewport,
    categories,
  };
}

/** @public */
export function ShowAllButton(props: CategoriesTreeHeaderButtonProps) {
  return (
    <IconButton
      size={props.density === "enlarged" ? "large" : "small"}
      styleType="borderless"
      title={TreeWidget.translate("categoriesTree.buttons.showAll.tooltip")}
      onClick={() => {
        props.onFeatureUsed?.(`categories-tree-showall`);
        void showAllCategories(
          props.categories.map((category) => category.categoryId),
          props.viewport,
        );
      }}
    >
      <SvgVisibilityShow />
    </IconButton>
  );
}

/** @public */
export function HideAllButton(props: CategoriesTreeHeaderButtonProps) {
  return (
    <IconButton
      size={props.density === "enlarged" ? "large" : "small"}
      styleType="borderless"
      title={TreeWidget.translate("categoriesTree.buttons.hideAll.tooltip")}
      onClick={() => {
        props.onFeatureUsed?.(`categories-tree-hideall`);
        void hideAllCategories(
          props.categories.map((category) => category.categoryId),
          props.viewport,
        );
      }}
    >
      <SvgVisibilityHide />
    </IconButton>
  );
}

/** @public */
export function InvertAllButton(props: CategoriesTreeHeaderButtonProps) {
  return (
    <IconButton
      title={TreeWidget.translate("categoriesTree.buttons.invert.tooltip")}
      size={props.density === "enlarged" ? "large" : "small"}
      styleType="borderless"
      onClick={() => {
        props.onFeatureUsed?.(`categories-tree-invert`);
        void invertAllCategories(props.categories, props.viewport);
      }}
    >
      <SvgVisibilityHalf />
    </IconButton>
  );
}

const EMPTY_CATEGORIES_ARRAY: CategoryInfo[] = [];

export function useCategories(viewport: Viewport) {
  const categoriesPromise = useMemo(async () => loadCategoriesFromViewport(viewport), [viewport]);
  return useAsyncValue(categoriesPromise) ?? EMPTY_CATEGORIES_ARRAY;
}
