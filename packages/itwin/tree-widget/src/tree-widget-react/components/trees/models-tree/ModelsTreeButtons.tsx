/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useMemo, useState } from "react";
import { Button, Icon, IconButton, Tooltip } from "@itwin/itwinui-react/bricks";
import { TreeWidget } from "../../../TreeWidget.js";
import { useFocusedInstancesContext } from "../common/FocusedInstancesContext.js";
import { areAllModelsVisible, hideAllModels, invertAllModels, showAllModels, toggleModels } from "./internal/ModelsTreeVisibilityHandler.js";

import type { Id64String } from "@itwin/core-bentley";
import type { GeometricModel3dProps, ModelQueryParams } from "@itwin/core-common";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import type { TreeToolbarButtonProps } from "../../tree-header/SelectableTree.js";

const visibilityShowIcon = new URL("@itwin/itwinui-icons/visibility-show.svg", import.meta.url).href;
const visibilityHideIcon = new URL("@itwin/itwinui-icons/visibility-hide.svg", import.meta.url).href;
const visibilityHalfIcon = new URL("@itwin/itwinui-icons/placeholder.svg", import.meta.url).href; // temporary icon
const cursorClickIcon = new URL("@itwin/itwinui-icons/placeholder.svg", import.meta.url).href; // temporary icon

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
export function useModelsTreeButtonProps({ imodel, viewport }: { imodel: IModelConnection; viewport: Viewport }): {
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
    from: "BisCore.GeometricModel3d",
    where: `
        EXISTS (
          SELECT 1
          FROM BisCore.Element e
          WHERE e.ECClassId IS (BisCore.GeometricElement3d, BisCore.InformationPartitionElement)
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
        props.onFeatureUsed?.("models-tree-showall");
        void showAllModels(
          props.models.map((model) => model.id),
          props.viewport,
        );
      }}
      icon={visibilityShowIcon}
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
        props.onFeatureUsed?.("models-tree-hideall");
        void hideAllModels(
          props.models.map((model) => model.id),
          props.viewport,
        );
      }}
      icon={visibilityHideIcon}
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
        void invertAllModels(
          props.models.map((model) => model.id),
          props.viewport,
        );
      }}
      icon={visibilityHalfIcon}
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
    return props.viewport.onViewedModelsChanged.addListener((vp: Viewport) => setIs2dToggleActive(areAllModelsVisible(models2d, vp)));
  }, [models2d, props.viewport]);

  return (
    <Tooltip content={TreeWidget.translate("modelsTree.buttons.toggle2d.tooltip")}>
      <Button
        variant={"ghost"}
        onClick={() => {
          props.onFeatureUsed?.("models-tree-view2d");
          void toggleModels(models2d, is2dToggleActive, props.viewport);
        }}
        disabled={models2d.length === 0}
      >
        {TreeWidget.translate("modelsTree.buttons.toggle2d.label")}
        <Icon href={is2dToggleActive ? visibilityShowIcon : visibilityHideIcon} />
      </Button>
    </Tooltip>
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
    return props.viewport.onViewedModelsChanged.addListener((vp: Viewport) => setIs3dToggleActive(areAllModelsVisible(models3d, vp)));
  }, [models3d, props.viewport]);

  return (
    <Tooltip content={TreeWidget.translate("modelsTree.buttons.toggle3d.tooltip")}>
      <Button
        variant={"ghost"}
        onClick={() => {
          props.onFeatureUsed?.("models-tree-view3d");
          void toggleModels(models3d, is3dToggleActive, props.viewport);
        }}
        disabled={models3d.length === 0}
      >
        {TreeWidget.translate("modelsTree.buttons.toggle3d.label")}
        <Icon href={is3dToggleActive ? visibilityShowIcon : visibilityHideIcon} />
      </Button>
    </Tooltip>
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
        onFeatureUsed?.("models-tree-instancesfocus");
        toggle();
      }}
      aria-disabled={disabled}
      isActive={enabled}
      icon={cursorClickIcon}
    />
  );
}
