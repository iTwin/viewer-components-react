/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useMemo, useState } from "react";
import type { GeometricModel3dProps, ModelQueryParams } from "@itwin/core-common";
import { SvgVisibilityHalf, SvgVisibilityHide, SvgVisibilityShow } from "@itwin/itwinui-icons-react";
import { Button, IconButton } from "@itwin/itwinui-react";
import { TreeWidget } from "../../../TreeWidget";
import { areAllModelsVisible, hideAllModels, invertAllModels, showAllModels, toggleModels } from "./internal/ModelsTreeVisibilityHandler";

import type { TreeHeaderButtonProps } from "../../tree-header/TreeHeader";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
/**
 * Information about a single Model.
 * @public
 */
export interface ModelInfo {
  id: string;
  isPlanProjection?: boolean;
}

/**
 * Props that get passed to [[ModelsTreeComponent]] header button renderer.
 * @see ModelTreeComponentProps.headerButtons
 * @public
 */
export interface ModelsTreeHeaderButtonProps extends TreeHeaderButtonProps {
  /** A list of models available in the iModel. */
  models: ModelInfo[];
}

/** @internal */
export function useAvailableModels(imodel: IModelConnection) {
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

/** @internal */
export function ShowAllButton(props: ModelsTreeHeaderButtonProps) {
  return (
    <IconButton
      size={props.density === "enlarged" ? "large" : "small"}
      styleType="borderless"
      title={TreeWidget.translate("showAll")}
      onClick={() => {
        props.onFeatureUsed?.("showall");
        void showAllModels(
          props.models.map((model) => model.id),
          props.viewport,
        );
      }}
    >
      <SvgVisibilityShow />
    </IconButton>
  );
}

/** @internal */
export function HideAllButton(props: ModelsTreeHeaderButtonProps) {
  return (
    <IconButton
      size={props.density === "enlarged" ? "large" : "small"}
      styleType="borderless"
      title={TreeWidget.translate("hideAll")}
      onClick={() => {
        props.onFeatureUsed?.("hideall");
        void hideAllModels(
          props.models.map((model) => model.id),
          props.viewport,
        );
      }}
    >
      <SvgVisibilityHide />
    </IconButton>
  );
}

/** @internal */
export function InvertButton(props: ModelsTreeHeaderButtonProps) {
  return (
    <IconButton
      size={props.density === "enlarged" ? "large" : "small"}
      styleType="borderless"
      title={TreeWidget.translate("invert")}
      onClick={() => {
        props.onFeatureUsed?.("invert");
        void invertAllModels(
          props.models.map((model) => model.id),
          props.viewport,
        );
      }}
    >
      <SvgVisibilityHalf />
    </IconButton>
  );
}

/** @internal */
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
    <Button
      size={props.density === "enlarged" ? "large" : "small"}
      styleType="borderless"
      title={TreeWidget.translate("toggle2DViews")}
      onClick={() => {
        props.onFeatureUsed?.("view2d");
        void toggleModels(models2d, is2dToggleActive, props.viewport);
      }}
      disabled={models2d.length === 0}
      endIcon={is2dToggleActive ? <SvgVisibilityShow /> : <SvgVisibilityHide />}
    >
      {TreeWidget.translate("label2D")}
    </Button>
  );
}

/** @internal */
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
    <Button
      size={props.density === "enlarged" ? "large" : "small"}
      styleType="borderless"
      title={TreeWidget.translate("toggle3DViews")}
      onClick={() => {
        props.onFeatureUsed?.("view3d");
        void toggleModels(models3d, is3dToggleActive, props.viewport);
      }}
      disabled={models3d.length === 0}
      endIcon={is3dToggleActive ? <SvgVisibilityShow /> : <SvgVisibilityHide />}
    >
      {TreeWidget.translate("label3D")}
    </Button>
  );
}
