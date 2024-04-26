/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { ComponentPropsWithoutRef, Fragment, useState } from "react";
import { ExperimentalModelsTree } from "./ModelsTree";
import {
  HideAllButton,
  InvertButton,
  ModelsTreeHeaderButtonProps,
  ShowAllButton,
  View2DButton,
  View3DButton,
  useAvailableModels,
} from "../../models-tree/ModelsTreeButtons";
import { useActiveIModelConnection, useActiveViewport } from "@itwin/appui-react";
import { IModelConnection, ScreenViewport } from "@itwin/core-frontend";
import { TreeHeader } from "../../../tree-header/TreeHeader";
import { AutoSizer } from "../../../utils/AutoSizer";

type ExperimentalModelsTreeProps = ComponentPropsWithoutRef<typeof ExperimentalModelsTree>;

interface ExperimentalModelsTreeComponentProps extends Pick<ExperimentalModelsTreeProps, "getSchemaContext" | "density" | "hierarchyLevelConfig"> {
  headerButtons?: Array<(props: ModelsTreeHeaderButtonProps) => React.ReactNode>;
}

/**
 * A component that renders [[ModelsTree]] and a header with filtering capabilities
 * and header buttons.
 * @public
 */
export const ExperimentalModelsTreeComponent = (props: ExperimentalModelsTreeComponentProps) => {
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
  ...treeProps
}: ExperimentalModelsTreeComponentProps & { iModel: IModelConnection; viewport: ScreenViewport }) {
  const availableModels = useAvailableModels(iModel);
  const [filter, setFilter] = useState("");
  const density = treeProps.density;

  return (
    <div className="tree-widget-tree-with-header">
      <TreeHeader onFilterClear={() => setFilter("")} onFilterStart={(newFilter) => setFilter(newFilter)} onSelectedChanged={() => {}} density={density}>
        {headerButtons
          ? headerButtons.map((btn, index) => <Fragment key={index}>{btn({ viewport, models: availableModels })}</Fragment>)
          : [
              <ShowAllButton viewport={viewport} models={availableModels} key="show-all-btn" density={density} />,
              <HideAllButton viewport={viewport} models={availableModels} key="hide-all-btn" density={density} />,
              <InvertButton viewport={viewport} models={availableModels} key="invert-all-btn" density={density} />,
              <View2DButton viewport={viewport} models={availableModels} key="view-2d-btn" density={density} />,
              <View3DButton viewport={viewport} models={availableModels} key="view-3d-btn" density={density} />,
            ]}
      </TreeHeader>
      <AutoSizer>
        {({ width, height }) => <ExperimentalModelsTree {...treeProps} imodel={iModel} activeView={viewport} width={width} height={height} filter={filter} />}
      </AutoSizer>
    </div>
  );
}
