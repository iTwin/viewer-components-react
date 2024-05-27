/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "../VisibilityTreeBase.scss";
import classNames from "classnames";
import { Fragment, useMemo } from "react";
import { useActiveIModelConnection, useActiveViewport } from "@itwin/appui-react";
import { TreeWidget } from "../../../TreeWidget";
import { TreeHeader } from "../../tree-header/TreeHeader";
import { useTreeFilteringState } from "../../TreeFilteringState";
import { AutoSizer } from "../../utils/AutoSizer";
import { ModelsTree } from "./ModelsTree";
import { HideAllButton, InvertButton, ShowAllButton, useAvailableModels, View2DButton, View3DButton } from "./ModelsTreeButtons";

import type { ModelsTreeProps } from "./ModelsTree";
import type { IModelConnection, ScreenViewport } from "@itwin/core-frontend";
import type { ModelsTreeHeaderButtonProps } from "./ModelsTreeButtons";

/**
 * Props for [[ModelsTreeComponent]].
 * @public
 */
export interface ModelTreeComponentProps extends Omit<ModelsTreeProps, "iModel" | "activeView" | "width" | "height" | "filterInfo" | "onFilterApplied"> {
  /**
   * Renderers of header buttons. Defaults to:
   * ```ts
   * [
   *   ModelsTreeComponent.ShowAllButton,
   *   ModelsTreeComponent.HideAllButton,
   *   ModelsTreeComponent.InvertButton,
   *   ModelsTreeComponent.View2DButton,
   *   ModelsTreeComponent.View3DButton,
   * ]
   * ```
   */
  headerButtons?: Array<(props: ModelsTreeHeaderButtonProps) => React.ReactNode>;
}

/**
 * A component that renders [[ModelsTree]] and a header with filtering capabilities
 * and header buttons.
 * @public
 */
export const ModelsTreeComponent = (props: ModelTreeComponentProps) => {
  const iModel = useActiveIModelConnection();
  const viewport = useActiveViewport();

  if (!iModel || !viewport) {
    return null;
  }

  return <ModelsTreeComponentImpl {...props} iModel={iModel} viewport={viewport} />;
};

/**
 * Renders a "Show all" button that enables display of all models.
 * @public
 */
ModelsTreeComponent.ShowAllButton = ShowAllButton;

/**
 * Renders a "Hide all" button that disables display of all models.
 * @public
 */
ModelsTreeComponent.HideAllButton = HideAllButton;

/**
 * Renders an "Invert all" button that inverts display of all models.
 * @public
 */
ModelsTreeComponent.InvertButton = InvertButton;

/**
 * Renders a "View 2D" button that enables display of all plan projection models and disables all others.
 * @public
 */
ModelsTreeComponent.View2DButton = View2DButton;

/**
 * Renders a "View 3D" button that enables display of all non-plan projection models and disables all plan projection ones.
 * @public
 */
ModelsTreeComponent.View3DButton = View3DButton;

/**
 * Id of the component. May be used when a creating a [[TreeDefinition]] for [[SelectableTree]].
 * @public
 */
ModelsTreeComponent.id = "models-tree";

/**
 * Label of the component. May be used when a creating a [[TreeDefinition]] for [[SelectableTree]].
 * @public
 */
ModelsTreeComponent.getLabel = () => TreeWidget.translate("models");

function ModelsTreeComponentImpl({
  iModel,
  viewport,
  headerButtons,
  ...treeProps
}: ModelTreeComponentProps & { iModel: IModelConnection; viewport: ScreenViewport }) {
  const availableModels = useAvailableModels(iModel);
  const density = treeProps.density;
  const { searchOptions, filterString, onFilterApplied } = useTreeFilteringState();
  const contentClassName = classNames("tree-widget-tree-content", density === "enlarged" && "enlarge");

  const filterInfo = useMemo(
    () => ({ filter: filterString, activeMatchIndex: searchOptions.activeMatchIndex }),
    [filterString, searchOptions.activeMatchIndex],
  );

  // istanbul ignore next
  const onModelsTreeFeatureUsed = (feature: string) => {
    if (treeProps.onFeatureUsed) {
      treeProps.onFeatureUsed(`${ModelsTreeComponent.id}-${feature}`);
    }
  };

  return (
    <div className="tree-widget-tree-with-header">
      <TreeHeader
        onFilterClear={searchOptions.onFilterCancel}
        onFilterStart={searchOptions.onFilterStart}
        onSelectedChanged={searchOptions.onResultSelectedChanged}
        resultCount={searchOptions.matchedResultCount}
        selectedIndex={searchOptions.activeMatchIndex}
        density={density}
      >
        {headerButtons
          ? headerButtons.map((btn, index) => (
              <Fragment key={index}>{btn({ viewport, models: availableModels, density: treeProps.density, onFeatureUsed: onModelsTreeFeatureUsed })}</Fragment>
            ))
          : [
              <ShowAllButton
                viewport={viewport}
                models={availableModels}
                key="show-all-btn"
                density={treeProps.density}
                onFeatureUsed={onModelsTreeFeatureUsed}
              />,
              <HideAllButton
                viewport={viewport}
                models={availableModels}
                key="hide-all-btn"
                density={treeProps.density}
                onFeatureUsed={onModelsTreeFeatureUsed}
              />,
              <InvertButton
                viewport={viewport}
                models={availableModels}
                key="invert-all-btn"
                density={treeProps.density}
                onFeatureUsed={onModelsTreeFeatureUsed}
              />,
              <View2DButton
                viewport={viewport}
                models={availableModels}
                key="view-2d-btn"
                density={treeProps.density}
                onFeatureUsed={onModelsTreeFeatureUsed}
              />,
              <View3DButton
                viewport={viewport}
                models={availableModels}
                key="view-3d-btn"
                density={treeProps.density}
                onFeatureUsed={onModelsTreeFeatureUsed}
              />,
            ]}
      </TreeHeader>
      <div className={contentClassName}>
        <AutoSizer>
          {({ width, height }) => (
            <ModelsTree
              {...treeProps}
              iModel={iModel}
              activeView={viewport}
              width={width}
              height={height}
              filterInfo={filterInfo}
              onFilterApplied={onFilterApplied}
            />
          )}
        </AutoSizer>
      </div>
    </div>
  );
}
