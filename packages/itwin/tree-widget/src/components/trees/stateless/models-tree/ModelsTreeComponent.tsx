/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Fragment, useState } from "react";
import { useActiveIModelConnection, useActiveViewport } from "@itwin/appui-react";
import { SvgCursorClick } from "@itwin/itwinui-icons-react";
import { IconButton } from "@itwin/itwinui-react";
import { UnifiedSelectionProvider } from "@itwin/presentation-hierarchies-react";
import { TreeHeader } from "../../../tree-header/TreeHeader";
import { AutoSizer } from "../../../utils/AutoSizer";
import { HideAllButton, InvertButton, ShowAllButton, useAvailableModels, View2DButton, View3DButton } from "../../models-tree/ModelsTreeButtons";
import { useFocusedInstancesContext } from "../common/FocusedInstancesContext";
import { FocusedInstancesContextProvider } from "../common/FocusedInstancesContextProvider";
import { StatelessModelsTree, StatelessModelsTreeId } from "./ModelsTree";

import type { ComponentPropsWithoutRef } from "react";
import type { IModelConnection, ScreenViewport } from "@itwin/core-frontend";
import type { SelectionStorage } from "@itwin/presentation-hierarchies-react";
import type { ModelsTreeHeaderButtonProps } from "../../models-tree/ModelsTreeButtons";

type StatelessModelsTreeProps = ComponentPropsWithoutRef<typeof StatelessModelsTree>;

interface StatelessModelsTreeComponentProps
  extends Pick<
    StatelessModelsTreeProps,
    "getSchemaContext" | "density" | "hierarchyLevelConfig" | "selectionMode" | "onPerformanceMeasured" | "onFeatureUsed"
  > {
  headerButtons?: Array<(props: ModelsTreeHeaderButtonProps) => React.ReactNode>;
  selectionStorage: SelectionStorage;
}

/**
 * A component that renders [[StatelessModelsTree]] and a header with filtering capabilities
 * and header buttons.
 * @beta
 */
export const StatelessModelsTreeComponent = (props: StatelessModelsTreeComponentProps) => {
  const iModel = useActiveIModelConnection();
  const viewport = useActiveViewport();

  if (!iModel || !viewport) {
    return null;
  }

  return <ModelsTreeComponentImpl {...props} iModel={iModel} viewport={viewport} />;
};

function ModelsTreeComponentImpl({
  iModel,
  viewport,
  headerButtons,
  selectionStorage,
  ...treeProps
}: StatelessModelsTreeComponentProps & { iModel: IModelConnection; viewport: ScreenViewport }) {
  const availableModels = useAvailableModels(iModel);
  const [filter, setFilter] = useState("");
  const density = treeProps.density;

  const onModelsTreeFeatureUsed = (feature: string) => {
    if (treeProps.onFeatureUsed) {
      treeProps.onFeatureUsed(`${StatelessModelsTreeId}-${feature}`);
    }
  };

  return (
    <div className="tree-widget-tree-with-header">
      <UnifiedSelectionProvider storage={selectionStorage}>
        <FocusedInstancesContextProvider selectionStorage={selectionStorage} imodelKey={iModel.key}>
          <TreeHeader onFilterClear={() => setFilter("")} onFilterStart={(newFilter) => setFilter(newFilter)} onSelectedChanged={() => {}} density={density}>
            {headerButtons
              ? headerButtons.map((btn, index) => (
                  <Fragment key={index}>{btn({ viewport, models: availableModels, onFeatureUsed: onModelsTreeFeatureUsed })}</Fragment>
                ))
              : [
                  <ShowAllButton viewport={viewport} models={availableModels} key="show-all-btn" density={density} onFeatureUsed={onModelsTreeFeatureUsed} />,
                  <HideAllButton viewport={viewport} models={availableModels} key="hide-all-btn" density={density} onFeatureUsed={onModelsTreeFeatureUsed} />,
                  <InvertButton viewport={viewport} models={availableModels} key="invert-all-btn" density={density} onFeatureUsed={onModelsTreeFeatureUsed} />,
                  <View2DButton viewport={viewport} models={availableModels} key="view-2d-btn" density={density} onFeatureUsed={onModelsTreeFeatureUsed} />,
                  <View3DButton viewport={viewport} models={availableModels} key="view-3d-btn" density={density} onFeatureUsed={onModelsTreeFeatureUsed} />,
                  <ToggleInstancesFocusButton key="toggle-instances-focus-btn" density={density} onFeatureUsed={onModelsTreeFeatureUsed} />,
                ]}
          </TreeHeader>
          <AutoSizer>
            {({ width, height }) => <StatelessModelsTree {...treeProps} imodel={iModel} activeView={viewport} width={width} height={height} filter={filter} />}
          </AutoSizer>
        </FocusedInstancesContextProvider>
      </UnifiedSelectionProvider>
    </div>
  );
}

function ToggleInstancesFocusButton({ density, onFeatureUsed }: { density?: "default" | "enlarged"; onFeatureUsed?: (feature: string) => void }) {
  const { enabled, toggle } = useFocusedInstancesContext();
  const title = enabled ? "Disabled Instances Focus" : "Enable Instances Focus";
  return (
    <IconButton
      styleType="borderless"
      size={density === "enlarged" ? "large" : "small"}
      title={title}
      onClick={() => {
        onFeatureUsed?.("instancesfocus");
        toggle();
      }}
      isActive={enabled}
    >
      <SvgCursorClick />
    </IconButton>
  );
}
