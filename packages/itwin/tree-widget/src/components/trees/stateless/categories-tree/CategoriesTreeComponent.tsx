/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import classNames from "classnames";
import { Fragment, useState } from "react";
import { useActiveIModelConnection, useActiveViewport } from "@itwin/appui-react";
import { IModelApp } from "@itwin/core-frontend";
import { UnifiedSelectionProvider } from "@itwin/presentation-hierarchies-react";
import { TreeHeader } from "../../../tree-header/TreeHeader";
import { AutoSizer } from "../../../utils/AutoSizer";
import { HideAllButton, InvertAllButton, ShowAllButton } from "../../category-tree/CategoriesTreeButtons";
import { useCategories } from "../../category-tree/CategoryVisibilityHandler";
import { StatelessCategoriesTree, StatelessCategoriesTreeId } from "./CategoriesTree";

import type { ComponentPropsWithoutRef } from "react";
import type { IModelConnection, ScreenViewport } from "@itwin/core-frontend";
import type { SelectionStorage } from "@itwin/presentation-hierarchies-react";
import type { CategoriesTreeHeaderButtonProps } from "../../category-tree/CategoriesTreeButtons";

type StatelessCategoriesTreeProps = ComponentPropsWithoutRef<typeof StatelessCategoriesTree>;

interface StatelessCategoriesTreeComponentProps
  extends Pick<
    StatelessCategoriesTreeProps,
    "getSchemaContext" | "density" | "hierarchyLevelConfig" | "selectionMode" | "onPerformanceMeasured" | "onFeatureUsed"
  > {
  headerButtons?: Array<(props: CategoriesTreeHeaderButtonProps) => React.ReactNode>;
  selectionStorage: SelectionStorage;
}

/**
 * A component that renders [[StatelessCategoriesTree]] and a header with filtering capabilities and header buttons.
 * @beta
 */
export const StatelessCategoriesTreeComponent = (props: StatelessCategoriesTreeComponentProps) => {
  const iModel = useActiveIModelConnection();
  const viewport = useActiveViewport();

  if (!iModel || !viewport) {
    return null;
  }

  return <CategoriesTreeComponentImpl {...props} iModel={iModel} viewport={viewport} />;
};

function CategoriesTreeComponentImpl({
  iModel,
  viewport,
  headerButtons,
  selectionStorage,
  ...treeProps
}: StatelessCategoriesTreeComponentProps & { iModel: IModelConnection; viewport: ScreenViewport }) {
  const categories = useCategories(IModelApp.viewManager, iModel, viewport);
  const [filter, setFilter] = useState("");
  const density = treeProps.density;

  const onCategoriesTreeFeatureUsed = (feature: string) => {
    if (treeProps.onFeatureUsed) {
      treeProps.onFeatureUsed(`${StatelessCategoriesTreeId}-${feature}`);
    }
  };

  return (
    <div className="tree-widget-tree-with-header">
      <UnifiedSelectionProvider storage={selectionStorage}>
        <TreeHeader onFilterClear={() => setFilter("")} onFilterStart={(newFilter) => setFilter(newFilter)} onSelectedChanged={() => {}} density={density}>
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
        <div className={classNames("tree-widget-tree-content", density === "enlarged" && "enlarge")}>
          <AutoSizer>
            {({ width, height }) => (
              <StatelessCategoriesTree
                {...treeProps}
                imodel={iModel}
                categories={categories}
                activeView={viewport}
                width={width}
                height={height}
                filter={filter}
              />
            )}
          </AutoSizer>
        </div>
      </UnifiedSelectionProvider>
    </div>
  );
}
