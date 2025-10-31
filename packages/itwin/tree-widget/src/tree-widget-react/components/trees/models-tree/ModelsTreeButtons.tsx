/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useMemo, useState } from "react";
import { IconButton } from "@stratakit/bricks";
import toggle2DSvg from "@stratakit/icons/2d.svg";
import toggle3DSvg from "@stratakit/icons/3d.svg";
import focusModeSvg from "@stratakit/icons/cursor-click.svg";
import visibilityHideSvg from "@stratakit/icons/visibility-hide.svg";
import visibilityInvertSvg from "@stratakit/icons/visibility-invert.svg";
import visibilityShowSvg from "@stratakit/icons/visibility-show.svg";
import { TreeWidget } from "../../../TreeWidget.js";
import { useFocusedInstancesContext } from "../common/FocusedInstancesContext.js";
import {
  CLASS_NAME_Element,
  CLASS_NAME_GeometricElement3d,
  CLASS_NAME_GeometricModel3d,
  CLASS_NAME_InformationPartitionElement,
} from "../common/internal/ClassNameDefinitions.js";
import { areAllModelsVisible, hideAllModels, invertAllModels, showAll, toggleModels } from "../common/Utils.js";

import type { Id64String } from "@itwin/core-bentley";
import type { GeometricModel3dProps, ModelQueryParams } from "@itwin/core-common";
import type { IModelConnection } from "@itwin/core-frontend";
import type { TreeToolbarButtonProps } from "../../tree-header/SelectableTree.js";
import type { TreeWidgetViewport } from "../common/TreeWidgetViewport.js";

/**
 * Information about a single Model.
 * @public
 */
export interface ModelInfo {
  id: string;
  isPlanProjection?: boolean;
}

/**
 * Props that get passed to `ModelsTreeComponent` header button renderer.
 * @see ModelTreeComponentProps.headerButtons
 * @public
 */
export interface ModelsTreeHeaderButtonProps extends TreeToolbarButtonProps {
  /** A list of models available in the iModel. */
  models: ModelInfo[];
}

/**
 * Custom hook that creates props required to render `ModelsTreeComponent` header button.
 *
 * Example:
 * ```tsx
 * const { buttonProps, onModelsFiltered } = useModelsTreeButtonProps({ imodel, viewport });
 * <TreeWithHeader
 *   buttons={[
 *     <ModelsTreeComponent.ShowAllButton {...buttonProps} />,
 *     <ModelsTreeComponent.HideAllButton {...buttonProps} />,
 *   ]}
 * >
 *   <ModelsTree {...treeProps} onModelsFiltered={onModelsFiltered} />
 * </TreeWithHeader>
 * ```
 *
 *
 * @public
 */
export function useModelsTreeButtonProps({ imodel, viewport }: { imodel: IModelConnection; viewport: TreeWidgetViewport }): {
  buttonProps: Pick<ModelsTreeHeaderButtonProps, "models" | "viewport">;
  onModelsFiltered: (models: Id64String[] | undefined) => void;
} {
  const [filteredModels, setFilteredModels] = useState<Id64String[] | undefined>();

  const models = useAvailableModels(imodel);
  const availableModels = useMemo(() => (!filteredModels ? models : models.filter((model) => filteredModels.includes(model.id))), [models, filteredModels]);
  return {
    buttonProps: {
      models: availableModels,
      viewport,
    },
    onModelsFiltered: setFilteredModels,
  };
}

function useAvailableModels(imodel: IModelConnection): ModelInfo[] {
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);

  useEffect(() => {
    queryModelsForHeaderActions(imodel)
      .then((modelInfos: ModelInfo[]) => {
        setAvailableModels(modelInfos);
      })
      .catch(() => {
        setAvailableModels([]);
      });
  }, [imodel]);

  return availableModels;
}

async function queryModelsForHeaderActions(iModel: IModelConnection) {
  const queryParams: ModelQueryParams = {
    from: CLASS_NAME_GeometricModel3d,
    where: `
        EXISTS (
          SELECT 1
          FROM ${CLASS_NAME_Element} e
          WHERE e.ECClassId IS (${CLASS_NAME_GeometricElement3d}, ${CLASS_NAME_InformationPartitionElement})
            AND e.ECInstanceId = GeometricModel3d.ModeledElement.Id
        )
      `,
    wantPrivate: false,
  };

  const modelProps = await iModel.models.queryProps(queryParams);
  return modelProps.map(({ id, isPlanProjection }: GeometricModel3dProps) => ({ id, isPlanProjection })).filter(({ id }) => id) as ModelInfo[];
}

/** @public */
export type ModelsTreeHeaderButtonType = (props: ModelsTreeHeaderButtonProps) => React.ReactElement | null;

/** @public */
export function ShowAllButton(props: ModelsTreeHeaderButtonProps) {
  return (
    <IconButton
      variant={"ghost"}
      label={TreeWidget.translate("modelsTree.buttons.showAll.tooltip")}
      onClick={() => {
        // cspell:disable-next-line
        props.onFeatureUsed?.("models-tree-showall");
        void showAll({
          models: props.models.map((model) => model.id),
          viewport: props.viewport,
        });
      }}
      icon={visibilityShowSvg}
    />
  );
}

/** @public */
export function HideAllButton(props: ModelsTreeHeaderButtonProps) {
  return (
    <IconButton
      variant={"ghost"}
      label={TreeWidget.translate("modelsTree.buttons.hideAll.tooltip")}
      onClick={() => {
        // cspell:disable-next-line
        props.onFeatureUsed?.("models-tree-hideall");
        hideAllModels(
          props.models.map((model) => model.id),
          props.viewport,
        );
      }}
      icon={visibilityHideSvg}
    />
  );
}

/** @public */
export function InvertButton(props: ModelsTreeHeaderButtonProps) {
  return (
    <IconButton
      variant={"ghost"}
      label={TreeWidget.translate("modelsTree.buttons.invert.tooltip")}
      onClick={() => {
        props.onFeatureUsed?.("models-tree-invert");
        invertAllModels(
          props.models.map((model) => model.id),
          props.viewport,
        );
      }}
      icon={visibilityInvertSvg}
    />
  );
}

/** @public */
export function View2DButton(props: ModelsTreeHeaderButtonProps) {
  const models2d = useMemo(() => {
    return props.models.filter((model) => model.isPlanProjection).map((model) => model.id);
  }, [props.models]);

  const [is2dToggleActive, setIs2dToggleActive] = useState(false);

  useEffect(() => {
    setIs2dToggleActive(areAllModelsVisible(models2d, props.viewport));
    return props.viewport.onDisplayedModelsChanged.addListener(() => setIs2dToggleActive(areAllModelsVisible(models2d, props.viewport)));
  }, [models2d, props.viewport]);

  return (
    <IconButton
      variant={"ghost"}
      label={TreeWidget.translate("modelsTree.buttons.toggle2d.tooltip")}
      onClick={() => {
        props.onFeatureUsed?.("models-tree-view2d");
        toggleModels(models2d, is2dToggleActive, props.viewport);
      }}
      aria-disabled={models2d.length === 0}
      active={is2dToggleActive}
      icon={toggle2DSvg}
    />
  );
}

/** @public */
export function View3DButton(props: ModelsTreeHeaderButtonProps) {
  const models3d = useMemo(() => {
    return props.models.filter((model) => !model.isPlanProjection).map((model) => model.id);
  }, [props.models]);

  const [is3dToggleActive, setIs3dToggleActive] = useState(false);

  useEffect(() => {
    setIs3dToggleActive(areAllModelsVisible(models3d, props.viewport));
    return props.viewport.onDisplayedModelsChanged.addListener(() => setIs3dToggleActive(areAllModelsVisible(models3d, props.viewport)));
  }, [models3d, props.viewport]);

  return (
    <IconButton
      variant={"ghost"}
      label={TreeWidget.translate("modelsTree.buttons.toggle3d.tooltip")}
      onClick={() => {
        props.onFeatureUsed?.("models-tree-view3d");
        toggleModels(models3d, is3dToggleActive, props.viewport);
      }}
      aria-disabled={models3d.length === 0}
      active={is3dToggleActive}
      icon={toggle3DSvg}
    />
  );
}

/** @public */
export function ToggleInstancesFocusButton({ onFeatureUsed, disabled }: { onFeatureUsed?: (feature: string) => void; disabled?: boolean }) {
  const { enabled, toggle } = useFocusedInstancesContext();
  const label = disabled
    ? TreeWidget.translate("modelsTree.buttons.toggleFocusMode.disabled.tooltip")
    : enabled
      ? TreeWidget.translate("modelsTree.buttons.toggleFocusMode.disable.tooltip")
      : TreeWidget.translate("modelsTree.buttons.toggleFocusMode.enable.tooltip");
  return (
    <IconButton
      variant={"ghost"}
      label={label}
      onClick={() => {
        // cspell:disable-next-line
        onFeatureUsed?.("models-tree-instancesfocus");
        toggle();
      }}
      aria-disabled={disabled}
      active={enabled}
      icon={focusModeSvg}
    />
  );
}
