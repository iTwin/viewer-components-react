/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "../Tree.scss";
import classNames from "classnames";
import { Fragment } from "react";
import { useActiveIModelConnection, useActiveViewport } from "@itwin/appui-react";
import { IModelApp } from "@itwin/core-frontend";
import { UnifiedSelectionProvider } from "@itwin/presentation-hierarchies-react";
import { TreeWidget } from "../../../TreeWidget";
import { TreeHeader } from "../../tree-header/TreeHeader";
import { AutoSizer } from "../../utils/AutoSizer";
import { useFiltering } from "../common/UseFiltering";
import { CategoriesTree } from "./CategoriesTree";
import { HideAllButton, InvertAllButton, ShowAllButton } from "./CategoriesTreeButtons";
import { useCategories } from "./UseCategories";

import type { ComponentPropsWithoutRef } from "react";
import type { IModelConnection, ScreenViewport } from "@itwin/core-frontend";
import type { SelectionStorage } from "@itwin/presentation-hierarchies-react";
import type { CategoriesTreeHeaderButtonProps } from "./CategoriesTreeButtons";

type CategoriesTreeProps = ComponentPropsWithoutRef<typeof CategoriesTree>;

interface CategoriesTreeComponentProps
  extends Pick<CategoriesTreeProps, "getSchemaContext" | "density" | "hierarchyLevelConfig" | "selectionMode" | "onPerformanceMeasured" | "onFeatureUsed"> {
  /**
   * Renderers of header buttons. Defaults to:
   * ```ts
   * [
   *   CategoriesTreeComponent.ShowAllButton,
   *   CategoriesTreeComponent.HideAllButton,
   *   CategoriesTreeComponent.InvertAllButton,
   * ]
   * ```
   */
  headerButtons?: Array<(props: CategoriesTreeHeaderButtonProps) => React.ReactNode>;
  selectionStorage: SelectionStorage;
}

/**
 * A component that renders [[CategoriesTree]] and a header with filtering capabilities and header buttons.
 * @beta
 */
export const CategoriesTreeComponent = (props: CategoriesTreeComponentProps) => {
  const iModel = useActiveIModelConnection();
  const viewport = useActiveViewport();

  if (!iModel || !viewport) {
    return null;
  }

  return <CategoriesTreeComponentImpl {...props} iModel={iModel} viewport={viewport} />;
};

/**
 * Renders a "Show all" button that enables display of all categories and their subcategories.
 * @public
 */
CategoriesTreeComponent.ShowAllButton = ShowAllButton;

/**
 * Renders a "Hide all" button that disables display of all categories.
 * @public
 */
CategoriesTreeComponent.HideAllButton = HideAllButton;

/**
 * Renders an "Invert all" button that inverts display of all categories.
 * @public
 */
CategoriesTreeComponent.InvertAllButton = InvertAllButton;

/**
 * Id of the component. May be used when a creating a [[TreeDefinition]] for [[SelectableTree]].
 * @public
 */
CategoriesTreeComponent.id = "categories-tree-v2";

/**
 * Label of the component. May be used when a creating a [[TreeDefinition]] for [[SelectableTree]].
 * @public
 */
CategoriesTreeComponent.getLabel = () => TreeWidget.translate("categories");

function CategoriesTreeComponentImpl({
  iModel,
  viewport,
  headerButtons,
  selectionStorage,
  ...treeProps
}: CategoriesTreeComponentProps & { iModel: IModelConnection; viewport: ScreenViewport }) {
  const categories = useCategories(IModelApp.viewManager, iModel, viewport);
  const { filter, applyFilter, clearFilter } = useFiltering();
  const density = treeProps.density;

  const onCategoriesTreeFeatureUsed = (feature: string) => {
    if (treeProps.onFeatureUsed) {
      treeProps.onFeatureUsed(`${CategoriesTreeComponent.id}-${feature}`);
    }
  };

  return (
    <div className={classNames("tw-tree-with-header", density === "enlarged" && "enlarge")}>
      <UnifiedSelectionProvider storage={selectionStorage}>
        <TreeHeader onFilterStart={applyFilter} onFilterClear={clearFilter} onSelectedChanged={() => {}} density={density}>
          {headerButtons
            ? headerButtons.map((btn, index) => <Fragment key={index}>{btn({ viewport, categories, onFeatureUsed: onCategoriesTreeFeatureUsed })}</Fragment>)
            : [
                <ShowAllButton viewport={viewport} categories={categories} key="show-all-btn" density={density} onFeatureUsed={onCategoriesTreeFeatureUsed} />,
                <HideAllButton viewport={viewport} categories={categories} key="hide-all-btn" density={density} onFeatureUsed={onCategoriesTreeFeatureUsed} />,
                <InvertAllButton
                  viewport={viewport}
                  categories={categories}
                  key="invert-all-btn"
                  density={density}
                  onFeatureUsed={onCategoriesTreeFeatureUsed}
                />,
              ]}
        </TreeHeader>
        <div className="tw-tree-content">
          <AutoSizer>
            {({ width, height }) => (
              <CategoriesTree {...treeProps} imodel={iModel} categories={categories} activeView={viewport} width={width} height={height} filter={filter} />
            )}
          </AutoSizer>
        </div>
      </UnifiedSelectionProvider>
    </div>
  );
}
