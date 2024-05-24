/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { ComponentPropsWithoutRef, Fragment, useState } from "react";
import { useActiveIModelConnection, useActiveViewport } from "@itwin/appui-react";
import { IModelConnection, ScreenViewport } from "@itwin/core-frontend";
import { SvgCursorClick } from "@itwin/itwinui-icons-react";
import { IconButton } from "@itwin/itwinui-react";
import { SelectionStorage, UnifiedSelectionProvider } from "@itwin/presentation-hierarchies-react";
import { TreeHeader } from "../../../tree-header/TreeHeader";
import { AutoSizer } from "../../../utils/AutoSizer";
import {
  HideAllButton, InvertButton, ModelsTreeHeaderButtonProps, ShowAllButton, useAvailableModels, View2DButton, View3DButton,
} from "../../models-tree/ModelsTreeButtons";
import { useFocusedInstancesContext } from "../common/FocusedInstancesContext";
import { FocusedInstancesContextProvider } from "../common/FocusedInstancesContextProvider";
import { StatelessModelsTree } from "./ModelsTree";

type StatelessModelsTreeProps = ComponentPropsWithoutRef<typeof StatelessModelsTree>;

interface StatelessModelsTreeComponentProps
  extends Pick<StatelessModelsTreeProps, "getSchemaContext" | "density" | "hierarchyLevelConfig" | "selectionMode"> {
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

  return (
    <div className="tree-widget-tree-with-header">
      <UnifiedSelectionProvider storage={selectionStorage}>
        <FocusedInstancesContextProvider selectionStorage={selectionStorage} imodelKey={iModel.key}>
          <TreeHeader onFilterClear={() => setFilter("")} onFilterStart={(newFilter) => setFilter(newFilter)} onSelectedChanged={() => {}} density={density}>
            {headerButtons
              ? headerButtons.map((btn, index) => <Fragment key={index}>{btn({ viewport, models: availableModels })}</Fragment>)
              : [
                  <ShowAllButton viewport={viewport} models={availableModels} key="show-all-btn" density={density} />,
                  <HideAllButton viewport={viewport} models={availableModels} key="hide-all-btn" density={density} />,
                  <InvertButton viewport={viewport} models={availableModels} key="invert-all-btn" density={density} />,
                  <View2DButton viewport={viewport} models={availableModels} key="view-2d-btn" density={density} />,
                  <View3DButton viewport={viewport} models={availableModels} key="view-3d-btn" density={density} />,
                  <ToggleInstancesFocusButton key="toggle-instances-focus-btn" density={density} />,
                ]}
          </TreeHeader>
          <AutoSizer>
            {({ width, height }) => (
              <StatelessModelsTree {...treeProps} imodel={iModel} activeView={viewport} width={width} height={height} filter={filter} />
            )}
          </AutoSizer>
        </FocusedInstancesContextProvider>
      </UnifiedSelectionProvider>
    </div>
  );
}

function ToggleInstancesFocusButton({ density }: { density?: "default" | "enlarged" }) {
  const { enabled, toggle } = useFocusedInstancesContext();
  const title = enabled ? "Disabled Instances Focus" : "Enable Instances Focus";
  return (
    <IconButton styleType="borderless" size={density === "enlarged" ? "large" : "small"} title={title} onClick={() => toggle()} isActive={enabled}>
      <SvgCursorClick />
    </IconButton>
  );
}
