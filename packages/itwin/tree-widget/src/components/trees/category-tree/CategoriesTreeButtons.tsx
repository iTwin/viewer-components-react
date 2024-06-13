/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { SvgVisibilityHalf, SvgVisibilityHide, SvgVisibilityShow } from "@itwin/itwinui-icons-react";
import { IconButton } from "@itwin/itwinui-react";
import { TreeWidget } from "../../../TreeWidget";
import type { TreeHeaderButtonProps } from "../../tree-header/TreeHeader";
import { CategoriesTreeComponent } from "./CategoriesTreeComponent";
import { hideAllCategories, invertAllCategories, showAllCategories } from "./CategoryVisibilityHandler";

/**
 * Data structure that describes category.
 * @public
 */
export interface CategoryInfo {
  categoryId: string;
  subCategoryIds?: string[];
}

/**
 * Props that get passed to [[CategoriesTreeComponent]] header button renderer.
 * @see CategoriesTreeComponentProps.headerButtons
 * @public
 */
export interface CategoriesTreeHeaderButtonProps extends TreeHeaderButtonProps {
  /** A list of categories available in the iModel */
  categories: CategoryInfo[];
  /** In case the tree is filtered, a list of filtered categories. */
  filteredCategories?: CategoryInfo[];
}

/** @internal */
export function ShowAllButton(props: CategoriesTreeHeaderButtonProps) {
  return (
    <IconButton
      size={props.density === "enlarged" ? "large" : "small"}
      styleType="borderless"
      title={TreeWidget.translate("showAll")}
      onClick={() => {
        props.onFeatureUsed?.(`${CategoriesTreeComponent.id}-showall`);
        void showAllCategories(
          (props.filteredCategories ?? props.categories).map((category) => category.categoryId),
          props.viewport,
        );
      }}
    >
      <SvgVisibilityShow />
    </IconButton>
  );
}

/** @internal */
export function HideAllButton(props: CategoriesTreeHeaderButtonProps) {
  return (
    <IconButton
      size={props.density === "enlarged" ? "large" : "small"}
      styleType="borderless"
      title={TreeWidget.translate("hideAll")}
      onClick={() => {
        props.onFeatureUsed?.(`${CategoriesTreeComponent.id}-hideall`);
        void hideAllCategories(
          (props.filteredCategories ?? props.categories).map((category) => category.categoryId),
          props.viewport,
        );
      }}
    >
      <SvgVisibilityHide />
    </IconButton>
  );
}

/** @internal */
export function InvertAllButton(props: CategoriesTreeHeaderButtonProps) {
  return (
    <IconButton
      title={TreeWidget.translate("invert")}
      size={props.density === "enlarged" ? "large" : "small"}
      styleType="borderless"
      onClick={() => {
        props.onFeatureUsed?.(`${CategoriesTreeComponent.id}-invert`);
        void invertAllCategories(props.filteredCategories ?? props.categories, props.viewport);
      }}
    >
      <SvgVisibilityHalf />
    </IconButton>
  );
}
