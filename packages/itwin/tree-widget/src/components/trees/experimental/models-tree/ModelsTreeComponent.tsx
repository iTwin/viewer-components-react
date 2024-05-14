/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { ComponentPropsWithoutRef, Fragment, useEffect, useState } from "react";
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
import { IModelConnection, KeyinStatus, ScreenViewport } from "@itwin/core-frontend";
import { TreeHeader } from "../../../tree-header/TreeHeader";
import { AutoSizer } from "../../../utils/AutoSizer";
import { IconButton } from "@itwin/itwinui-react";
import { SvgCloseSmall, SvgCursorClick, SvgFind } from "@itwin/itwinui-icons-react";
import { InstanceKey } from "@itwin/presentation-shared";
import { Presentation } from "@itwin/presentation-frontend";
import { SelectionStorage, UnifiedSelectionProvider } from "@itwin/presentation-hierarchies-react";

type ExperimentalModelsTreeProps = ComponentPropsWithoutRef<typeof ExperimentalModelsTree>;

interface ExperimentalModelsTreeComponentProps extends Pick<ExperimentalModelsTreeProps, "getSchemaContext" | "density" | "hierarchyLevelConfig"> {
  headerButtons?: Array<(props: ModelsTreeHeaderButtonProps) => React.ReactNode>;
  selectionStorage: SelectionStorage;
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
  selectionStorage,
  ...treeProps
}: ExperimentalModelsTreeComponentProps & { iModel: IModelConnection; viewport: ScreenViewport }) {
  const availableModels = useAvailableModels(iModel);
  const [filter, setFilter] = useState("");
  const [focusInstances, setFocusInstances] = useState(false);
  const density = treeProps.density;
  const focusedInstanceKeys = useFocusedInstanceKeys({ enabled: focusInstances, imodel: iModel });

  return (
    <div className="tree-widget-tree-with-header">
      <UnifiedSelectionProvider storage={selectionStorage}>
        <TreeHeader onFilterClear={() => setFilter("")} onFilterStart={(newFilter) => setFilter(newFilter)} onSelectedChanged={() => {}} density={density}>
          {headerButtons
            ? headerButtons.map((btn, index) => <Fragment key={index}>{btn({ viewport, models: availableModels })}</Fragment>)
            : [
                <ShowAllButton viewport={viewport} models={availableModels} key="show-all-btn" density={density} />,
                <HideAllButton viewport={viewport} models={availableModels} key="hide-all-btn" density={density} />,
                <InvertButton viewport={viewport} models={availableModels} key="invert-all-btn" density={density} />,
                <View2DButton viewport={viewport} models={availableModels} key="view-2d-btn" density={density} />,
                <View3DButton viewport={viewport} models={availableModels} key="view-3d-btn" density={density} />,
                <ToggleInstancesFocusButton
                  enabled={focusInstances}
                  density={density}
                  onClick={() => setFocusInstances((prev) => !prev)}
                  key="toggle-instances-focus-btn"
                />,
              ]}
        </TreeHeader>
        <AutoSizer>
          {({ width, height }) => (
            <ExperimentalModelsTree
              {...treeProps}
              imodel={iModel}
              activeView={viewport}
              width={width}
              height={height}
              filter={filter}
              focusedInstanceKeys={focusedInstanceKeys}
            />
          )}
        </AutoSizer>
      </UnifiedSelectionProvider>
    </div>
  );
}

function useFocusedInstanceKeys({ enabled, imodel }: { enabled: boolean; imodel: IModelConnection }) {
  const [instanceKeys, setInstanceKeys] = useState<InstanceKey[]>();

  useEffect(() => {
    if (!enabled) {
      setInstanceKeys(undefined);
      return;
    }

    const onSelectionChanged = () => {
      console.log("Selection changed");
      const keys = Presentation.selection.getSelection(imodel);
      const selectedInstanceKeys: InstanceKey[] = [];
      keys.forEach((key) => {
        if ("id" in key) {
          selectedInstanceKeys.push(key);
        }
      });
      setInstanceKeys(selectedInstanceKeys.length === 0 ? undefined : selectedInstanceKeys);
    };

    onSelectionChanged();
    return Presentation.selection.selectionChange.addListener(onSelectionChanged);
  }, [enabled, imodel]);

  return instanceKeys;
}

function ToggleInstancesFocusButton({ enabled, onClick, density }: { enabled: boolean; onClick: () => void; density?: "default" | "enlarged" }) {
  const title = enabled ? "Disabled Instances Focus" : "Enable Instances Focus";
  return (
    <IconButton styleType="borderless" size={density === "enlarged" ? "large" : "small"} title={title} onClick={onClick} isActive={enabled}>
      <SvgCursorClick />
    </IconButton>
  );
}
