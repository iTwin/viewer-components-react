/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Fragment } from "react";
import { useActiveIModelConnection } from "@itwin/appui-react";
import { TreeWidget } from "../../../TreeWidget";
import { TreeWithHeader } from "../../tree-header/TreeWithHeader";
import { useActiveViewport } from "../common/UseActiveViewport";
import { useFiltering } from "../common/UseFiltering";
import { TelemetryContextProvider } from "../common/UseTelemetryContext";
import { CategoriesTree } from "./CategoriesTree";
import { HideAllButton, InvertAllButton, ShowAllButton, useCategoriesTreeButtonProps } from "./CategoriesTreeButtons";

import type { CategoriesTreeProps } from "./CategoriesTree";
import type { ReactNode } from "react";
import type { IModelConnection, ScreenViewport } from "@itwin/core-frontend";
import type { CategoriesTreeHeaderButtonProps, CategoriesTreeHeaderButtonType } from "./CategoriesTreeButtons";

/** @public */
interface CategoriesTreeComponentProps
  extends Pick<CategoriesTreeProps, "getSchemaContext" | "selectionStorage" | "density" | "hierarchyLevelConfig" | "selectionMode"> {
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
  onPerformanceMeasured?: (featureId: string, duration: number) => void;
  onFeatureUsed?: (feature: string) => void;
}

/**
 * A component that renders `CategoriesTree` and a header with filtering capabilities and header buttons.
 * @public
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
CategoriesTreeComponent.ShowAllButton = ShowAllButton as CategoriesTreeHeaderButtonType;

/**
 * Renders a "Hide all" button that disables display of all categories.
 * @public
 */
CategoriesTreeComponent.HideAllButton = HideAllButton as CategoriesTreeHeaderButtonType;

/**
 * Renders an "Invert all" button that inverts display of all categories.
 * @public
 */
CategoriesTreeComponent.InvertAllButton = InvertAllButton as CategoriesTreeHeaderButtonType;

/**
 * Id of the component. May be used when a creating a `TreeDefinition` for `SelectableTree`.
 * @public
 */
CategoriesTreeComponent.id = "categories-tree-v2";

/**
 * Label of the component. May be used when a creating a `TreeDefinition` for `SelectableTree`.
 * @public
 */
CategoriesTreeComponent.getLabel = () => TreeWidget.translate("categoriesTree.label");

function CategoriesTreeComponentImpl({
  iModel,
  viewport,
  headerButtons,
  onPerformanceMeasured,
  onFeatureUsed,
  ...treeProps
}: CategoriesTreeComponentProps & { iModel: IModelConnection; viewport: ScreenViewport }) {
  const { buttonProps, onCategoriesFiltered } = useCategoriesTreeButtonProps({ viewport });
  const { filter, applyFilter, clearFilter } = useFiltering();
  const density = treeProps.density;

  const buttons: ReactNode = headerButtons
    ? headerButtons.map((btn, index) => <Fragment key={index}>{btn({ ...buttonProps, onFeatureUsed })}</Fragment>)
    : [
        <ShowAllButton {...buttonProps} key="show-all-btn" density={density} onFeatureUsed={onFeatureUsed} />,
        <HideAllButton {...buttonProps} key="hide-all-btn" density={density} onFeatureUsed={onFeatureUsed} />,
        <InvertAllButton {...buttonProps} key="invert-all-btn" density={density} onFeatureUsed={onFeatureUsed} />,
      ];

  return (
    <TelemetryContextProvider componentIdentifier={CategoriesTreeComponent.id} onFeatureUsed={onFeatureUsed} onPerformanceMeasured={onPerformanceMeasured}>
      <TreeWithHeader
        buttons={buttons}
        density={density}
        filteringProps={{
          onFilterStart: applyFilter,
          onFilterClear: clearFilter,
        }}
      >
        <CategoriesTree {...treeProps} imodel={iModel} activeView={viewport} filter={filter} onCategoriesFiltered={onCategoriesFiltered} />
      </TreeWithHeader>
    </TelemetryContextProvider>
  );
}
