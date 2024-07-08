/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { SvgVisibilityHalf, SvgVisibilityHide, SvgVisibilityShow } from "@itwin/itwinui-icons-react";
import { IconButton } from "@itwin/itwinui-react";
import { TreeWidget } from "../../../TreeWidget";
import { hideAllCategories, invertAllCategories, showAllCategories } from "../common/CategoriesVisibilityUtils";

import type { CategoryInfo } from "../common/CategoriesVisibilityUtils";
import type { TreeHeaderButtonProps } from "../../tree-header/TreeHeader";

/**
 * Props that get passed to `CategoriesTreeComponent` header button renderer.
 * @see CategoriesTreeComponentProps.headerButtons
 * @public
 */
export interface CategoriesTreeHeaderButtonProps extends TreeHeaderButtonProps {
  /** A list of categories available in the iModel */
  categories: CategoryInfo[];
  /** In case the tree is filtered, a list of filtered categories. */
  filteredCategories?: CategoryInfo[];
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
          (props.filteredCategories ?? props.categories).map((category) => category.categoryId),
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
          (props.filteredCategories ?? props.categories).map((category) => category.categoryId),
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
        void invertAllCategories(props.filteredCategories ?? props.categories, props.viewport);
      }}
    >
      <SvgVisibilityHalf />
    </IconButton>
  );
}
