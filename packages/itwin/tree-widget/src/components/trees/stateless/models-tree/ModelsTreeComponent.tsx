/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "../Tree.scss";
import classNames from "classnames";
import { Fragment, useEffect, useRef, useState } from "react";
import { useActiveIModelConnection, useActiveViewport } from "@itwin/appui-react";
import { SvgCursorClick } from "@itwin/itwinui-icons-react";
import { Anchor, Flex, IconButton, Text } from "@itwin/itwinui-react";
import { UnifiedSelectionProvider } from "@itwin/presentation-hierarchies-react";
import { TreeWidget } from "../../../../TreeWidget";
import { TreeHeader } from "../../../tree-header/TreeHeader";
import { AutoSizer } from "../../../utils/AutoSizer";
import { HideAllButton, InvertButton, ShowAllButton, useAvailableModels, View2DButton, View3DButton } from "../../models-tree/ModelsTreeButtons";
import { useFocusedInstancesContext } from "../common/FocusedInstancesContext";
import { FocusedInstancesContextProvider } from "../common/FocusedInstancesContextProvider";
import { useFiltering } from "../common/UseFiltering";
import { StatelessModelsTree, StatelessModelsTreeId } from "./ModelsTree";

import type { ComponentPropsWithoutRef } from "react";
import type { IModelConnection, ScreenViewport } from "@itwin/core-frontend";
import type { SelectionStorage } from "@itwin/presentation-hierarchies-react";
import type { ModelsTreeHeaderButtonProps } from "../../models-tree/ModelsTreeButtons";

type StatelessModelsTreeProps = ComponentPropsWithoutRef<typeof StatelessModelsTree>;
type StatelessModelsTreeError = Parameters<Required<StatelessModelsTreeProps>["onError"]>[0];

interface StatelessModelsTreeComponentProps
  extends Pick<
    StatelessModelsTreeProps,
    "getSchemaContext" | "density" | "hierarchyLevelConfig" | "selectionMode" | "onPerformanceMeasured" | "onFeatureUsed" | "hierarchyConfig"
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
  const [error, setError] = useState<StatelessModelsTreeError | undefined>();
  const availableModels = useAvailableModels(iModel);
  const { filter, applyFilter } = useFiltering();
  const errorRef = useLatest(error);
  const density = treeProps.density;

  useEffect(() => {
    return selectionStorage.selectionChangeEvent.addListener(() => {
      if (isInstanceFocusError(errorRef.current)) {
        setError(undefined);
      }
    });
  }, [selectionStorage, errorRef]);

  const onModelsTreeFeatureUsed = (feature: string) => {
    if (feature === "instancesfocus" && isInstanceFocusError(error)) {
      setError(undefined);
    }
    if (treeProps.onFeatureUsed) {
      treeProps.onFeatureUsed(`${StatelessModelsTreeId}-${feature}`);
    }
  };

  const onFilterChanged = (newFilter: string) => {
    isFilterError(error) && setError(undefined);
    applyFilter(newFilter);
  };

  const getErrorMessage = () => {
    if (isFilterError(error)) {
      return <FilterError error={error!} />;
    }
    if (isInstanceFocusError(error)) {
      return <InstanceFocusError error={error!} onFeatureUsed={onModelsTreeFeatureUsed} />;
    }
    return undefined;
  };

  const renderContent = (width: number, height: number) => {
    if (error) {
      return (
        <Flex alignItems="center" justifyContent="center" flexDirection="column" style={{ width, height }}>
          {getErrorMessage()}
        </Flex>
      );
    }
    return <StatelessModelsTree {...treeProps} imodel={iModel} activeView={viewport} width={width} height={height} filter={filter} onError={setError} />;
  };

  return (
    <div className={classNames("tw-tree-with-header", density === "enlarged" && "enlarge")}>
      <UnifiedSelectionProvider storage={selectionStorage}>
        <FocusedInstancesContextProvider selectionStorage={selectionStorage} imodelKey={iModel.key}>
          <TreeHeader onFilterClear={() => onFilterChanged("")} onFilterStart={onFilterChanged} onSelectedChanged={() => {}} density={density}>
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
          <div className="tw-tree-content">
            <AutoSizer>{({ width, height }) => renderContent(width, height)}</AutoSizer>
          </div>
        </FocusedInstancesContextProvider>
      </UnifiedSelectionProvider>
    </div>
  );
}

function ToggleInstancesFocusButton({ density, onFeatureUsed }: { density?: "default" | "enlarged"; onFeatureUsed?: (feature: string) => void }) {
  const { enabled, toggle } = useFocusedInstancesContext();
  const title = enabled ? TreeWidget.translate("stateless.disableInstanceFocus") : TreeWidget.translate("stateless.enableInstanceFocus");
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

function isFilterError(error: StatelessModelsTreeError | undefined) {
  return error === "tooManyFilterMatches" || error === "unknownFilterError";
}

function FilterError({ error }: { error: StatelessModelsTreeError }) {
  return <Text>{TreeWidget.translate(`stateless.${error}`)}</Text>;
}

function isInstanceFocusError(error: StatelessModelsTreeError | undefined) {
  return error === "tooManyInstancesFocused" || error === "unknownInstanceFocusError";
}

function InstanceFocusError({ onFeatureUsed, error }: { onFeatureUsed: (feature: string) => void; error: StatelessModelsTreeError }) {
  const { toggle } = useFocusedInstancesContext();
  const localizedMessage = createLocalizedMessage(TreeWidget.translate(`stateless.${error}`), () => {
    onFeatureUsed?.("instancesfocus");
    toggle();
  });
  return <Text>{localizedMessage}</Text>;
}

function createLocalizedMessage(message: string, onClick?: () => void) {
  const exp = new RegExp("<link>(.*)</link>");
  const match = message.match(exp);

  if (!match) {
    return message;
  }

  const [fullText, innerText] = match;
  const [textBefore, textAfter] = message.split(fullText);

  return (
    <>
      {textBefore ? textBefore : null}
      <Anchor
        underline
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
      >
        {innerText}
      </Anchor>
      {textAfter ? textAfter : null}
    </>
  );
}

function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}
