/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Fragment } from "react";
import { useActiveIModelConnection } from "@itwin/appui-react";
import { Skeleton } from "@mui/material";
import { SharedTreeContextProvider, useSharedTreeContext } from "../../shared/contexts/SharedTreeContext.js";
import { TelemetryContextProvider } from "../../shared/contexts/UseTelemetryContext.js";
import { useActiveTreeWidgetViewport } from "../../shared/internal/hooks/UseActiveTreeWidgetViewport.js";
import { getClassesByView } from "../../shared/internal/Utils.js";
import { SelectableTree } from "../../tree-header/SelectableTree.js";
import { CategoriesTree } from "./CategoriesTree.js";
import { HideAllButton, InvertAllButton, ShowAllButton, useCategoriesTreeButtonProps } from "./CategoriesTreeButtons.js";

import type { JSX, ReactNode } from "react";
import type { IModelConnection } from "@itwin/core-frontend";
import type { TreeWidgetViewport } from "../../shared/TreeWidgetViewport.js";
import type { StandardTreeLabels } from "../../TreeWidgetComponentImpl.js";
import type { CategoriesTreeProps } from "./CategoriesTree.js";
import type { CategoriesTreeHeaderButtonProps, CategoriesTreeHeaderButtonType } from "./CategoriesTreeButtons.js";

/** @public */
interface CategoriesTreeComponentProps extends Pick<
  CategoriesTreeProps,
  | "selectionStorage"
  | "hierarchyLevelConfig"
  | "selectionMode"
  | "searchText"
  | "emptyTreeContent"
  | "getInlineActions"
  | "getMenuActions"
  | "getContextMenuActions"
  | "getTreeItemProps"
  | "hierarchyConfig"
  | "treeLabel"
> {
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
  /**
   * Viewport used for visibility controls.
   *
   * When viewport is not provided, `IModelApp.viewManager.selectedView` will be used.
   */
  viewport?: TreeWidgetViewport;
  onPerformanceMeasured?: (featureId: string, duration: number) => void;
  onFeatureUsed?: (feature: string) => void;
}

/** @public */
interface CategoriesTreeComponentType {
  (props: CategoriesTreeComponentProps): JSX.Element | null;
  /** Renders a "Show all" button that enables display of all categories and their subcategories. */
  ShowAllButton: CategoriesTreeHeaderButtonType;
  /** Renders a "Hide all" button that disables display of all categories. */
  HideAllButton: CategoriesTreeHeaderButtonType;
  /** Renders an "Invert all" button that inverts display of all categories. */
  InvertAllButton: CategoriesTreeHeaderButtonType;
  /** Id of the component. May be used when a creating a `TreeDefinition` for `SelectableTree`. */
  id: string;
  /** Label of the component. May be used when a creating a `TreeDefinition` for `SelectableTree`. */
  getLabel({ standardLabels }: { standardLabels: StandardTreeLabels }): string;
}

/**
 * A component that renders `CategoriesTree` and a header with search capabilities and header buttons.
 *
 * **Note:** Wrap tree components with a single `TreeWidgetContextProvider` to provide shared tree resources.
 * @public
 */
export const CategoriesTreeComponent: CategoriesTreeComponentType = (props: CategoriesTreeComponentProps) => {
  const iModel = useActiveIModelConnection();
  const viewport = useActiveTreeWidgetViewport({ treeWidgetViewport: props.viewport });

  if (!iModel || !viewport) {
    return null;
  }

  return (
    <SharedTreeContextProvider showWarning={true}>
      <CategoriesTreeComponentImpl {...props} iModel={iModel} viewport={viewport} />
    </SharedTreeContextProvider>
  );
};

CategoriesTreeComponent.ShowAllButton = ShowAllButton as CategoriesTreeHeaderButtonType;

CategoriesTreeComponent.HideAllButton = HideAllButton as CategoriesTreeHeaderButtonType;

CategoriesTreeComponent.InvertAllButton = InvertAllButton as CategoriesTreeHeaderButtonType;

CategoriesTreeComponent.id = "categories-tree-v2";

CategoriesTreeComponent.getLabel = ({ standardLabels }: { standardLabels: StandardTreeLabels }) => standardLabels.categories;

function CategoriesTreeComponentImpl({
  iModel,
  viewport,
  headerButtons,
  onPerformanceMeasured,
  onFeatureUsed,
  searchText,
  treeLabel,
  ...treeProps
}: CategoriesTreeComponentProps & { iModel: IModelConnection; viewport: TreeWidgetViewport }) {
  const { buttonProps, onCategoriesFiltered } = useCategoriesTreeButtonProps({ viewport });
  const { getBaseIdsCache } = useSharedTreeContext();
  const viewType = viewport.viewType === "2d" ? "2d" : "3d";
  const isLoaded =
    buttonProps.categories.length > 0 ||
    getBaseIdsCache({ imodel: viewport.iModel, elementClassName: getClassesByView(viewType).elementClass, type: viewType }).elementModelCategoriesLoaded();

  const buttons: ReactNode = isLoaded
    ? headerButtons
      ? headerButtons.map((btn, index) => <Fragment key={index}>{btn({ ...buttonProps, onFeatureUsed })}</Fragment>)
      : [
          <ShowAllButton {...buttonProps} key="show-all-btn" onFeatureUsed={onFeatureUsed} />,
          <HideAllButton {...buttonProps} key="hide-all-btn" onFeatureUsed={onFeatureUsed} />,
          <InvertAllButton {...buttonProps} key="invert-all-btn" onFeatureUsed={onFeatureUsed} />,
        ]
    : Array.from({ length: headerButtons?.length ?? 3 }, (_, index) => <Skeleton variant={"rounded"} width={24} height={24} key={index} />);

  return (
    <TelemetryContextProvider componentIdentifier={CategoriesTreeComponent.id} onFeatureUsed={onFeatureUsed} onPerformanceMeasured={onPerformanceMeasured}>
      <SelectableTree buttons={buttons}>
        <CategoriesTree
          {...treeProps}
          imodel={iModel}
          activeView={viewport}
          searchText={searchText}
          treeLabel={treeLabel}
          onCategoriesFiltered={onCategoriesFiltered}
        />
      </SelectableTree>
    </TelemetryContextProvider>
  );
}
