/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useMemo, useState } from "react";
import { useAsyncValue } from "@itwin/components-react";
import { IconButton } from "@itwin/itwinui-react/bricks";
import { TreeWidget } from "../../../TreeWidget.js";
import { hideAllCategories, invertAllCategories, loadCategoriesFromViewport, showAllCategories } from "../common/CategoriesVisibilityUtils.js";

import type { CategoryInfo } from "../common/CategoriesVisibilityUtils.js";
import type { TreeHeaderButtonProps } from "../../tree-header/TreeHeader.js";
import type { Viewport } from "@itwin/core-frontend";

const visibilityShowIcon = new URL("@itwin/itwinui-icons/visibility-show.svg", import.meta.url).href;
const visibilityHideIcon = new URL("@itwin/itwinui-icons/visibility-hide.svg", import.meta.url).href;
const visibilityHalfIcon = new URL("@itwin/itwinui-icons/placeholder.svg", import.meta.url).href;

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
export function useCategoriesTreeButtonProps({ viewport }: { viewport: Viewport }): {
  buttonProps: Pick<CategoriesTreeHeaderButtonProps, "categories" | "viewport">;
  onCategoriesFiltered: (categories: CategoryInfo[] | undefined) => void;
} {
  const [filteredCategories, setFilteredCategories] = useState<CategoryInfo[] | undefined>();
  const categories = useCategories(viewport);
  return {
    buttonProps: {
      viewport,
      categories: filteredCategories ?? categories,
    },
    onCategoriesFiltered: setFilteredCategories,
  };
}

/** @public */
export type CategoriesTreeHeaderButtonType = (props: CategoriesTreeHeaderButtonProps) => React.ReactElement | null;

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
      }}
      icon={visibilityShowIcon}
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
        props.onFeatureUsed?.(`categories-tree-hideall`);
        void hideAllCategories(
          props.categories.map((category) => category.categoryId),
          props.viewport,
        );
      }}
      icon={visibilityHideIcon}
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
      icon={visibilityHalfIcon}
    />
  );
}

const EMPTY_CATEGORIES_ARRAY: CategoryInfo[] = [];

export function useCategories(viewport: Viewport) {
  const categoriesPromise = useMemo(async () => loadCategoriesFromViewport(viewport), [viewport]);
  return useAsyncValue(categoriesPromise) ?? EMPTY_CATEGORIES_ARRAY;
}
