/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { ColorDef } from "@bentley/imodeljs-common";
import {
  AppearanceOverrideProps,
  DisplayStyle3dState,
  EmphasizeElements,
  FeatureOverrideType,
  SpatialViewState,
  Viewport,
} from "@bentley/imodeljs-frontend";

import {
  PerModelCategoryVisibilityProps,
  SavedViewData,
} from "../util/SavedViewTypes";

/** Parses all the emphasize elements props and data from the viewport and puts it into the SavedViewData */
export const parseFromEmphasizeElements = (
  vp: Viewport,
  data: SavedViewData
) => {
  const ee = EmphasizeElements.get(vp);
  if (!ee) {
    return;
  }

  const props = ee.toJSON(vp);

  // Isolate and Emphasized
  if (props.isAlwaysDrawnExclusive) {
    // Isolate
    data.alwaysDrawn = props.alwaysDrawn ? props.alwaysDrawn : undefined;
  } else if (props.alwaysDrawn) {
    // Non Grayed Elements / Emphasized Elements
    data.nonGrayedElements = props.alwaysDrawn ? props.alwaysDrawn : undefined;
  }

  // Hidden Elements
  if (props.neverDrawn) {
    data.neverDrawn = props.neverDrawn ? props.neverDrawn : undefined;
  }

  // Color Overrides
  if (props.appearanceOverride) {
    data.overrides = [];
    props.appearanceOverride.forEach((value: AppearanceOverrideProps) => {
      if (value?.color) {
        const colorDef = ColorDef.create(value.color);
        const color =
          value.overrideType === FeatureOverrideType.AlphaOnly
            ? undefined
            : colorDef.getRgb() << 8 || 0xff;
        const alpha =
          value.overrideType === FeatureOverrideType.ColorOnly
            ? undefined
            : 255 - colorDef.getAlpha(); // We actually want transparency, not alpha, but they called it alpha in the service incorrectly
        // Push to overrides
        if (data.overrides) {
          data.overrides.push({
            color,
            alpha,
            ids: value.ids ? value.ids : [],
          });
        }
      }
    });
  }
};

/**
 * Creates saved view data
 * @param vp View port from which view definition to be made
 * @param thumbName name of the thumb name.
 */
export const createSavedViewData = (vp: Viewport): SavedViewData => {
  const viewState = vp.view as SpatialViewState;
  if (!viewState) {
    throw new Error("Invalid viewport");
  }
  const categories: string[] = [];
  viewState.categorySelector.categories.forEach((value: string) => {
    if (viewState.viewsCategory(value)) {
      categories.push(value);
    }
  });

  const models: string[] = [];
  viewState.modelSelector.models.forEach((value: string) => {
    if (viewState.viewsModel(value)) {
      models.push(value);
    }
  });

  let alwaysDrawn: string[] | undefined;
  if (vp.alwaysDrawn && vp.alwaysDrawn.size !== 0) {
    alwaysDrawn = [];
    vp.alwaysDrawn.forEach((value: string) => {
      if (alwaysDrawn) {
        alwaysDrawn.push(value);
      }
    });
  }

  let neverDrawn: string[] | undefined;
  if (vp.neverDrawn && vp.neverDrawn.size !== 0) {
    neverDrawn = [];
    vp.neverDrawn.forEach((value: string) => {
      if (neverDrawn) {
        neverDrawn.push(value);
      }
    });
  }

  const version = "1.0.0";
  // TODO: This is not going to work as JS doesn't support 64 bits, but for now let it truncate it
  const sourceId = viewState.id;

  const { contextId: projectId, iModelId, changeSetId } = vp.iModel;

  const state = {
    cameraAngle: viewState.camera.getLensAngle().radians,
    cameraFocalLength: viewState.camera.focusDist,
    cameraPosition: viewState.camera.getEyePoint().toJSON(),
    extents: viewState.extents.toJSON(),
    flags: viewState.viewFlags,
    isCameraOn: viewState.isCameraOn,
    origin: viewState.origin.toJSON(),
    rotation: viewState.rotation.toJSON(),
  };

  // Ensure the skybox is turned off
  const displayStyle3d = viewState.displayStyle as DisplayStyle3dState;
  if (displayStyle3d) {
    displayStyle3d.environment.sky.display = false;
  }

  const perModelCategoryVisibility: PerModelCategoryVisibilityProps[] = [];
  vp.perModelCategoryVisibility.forEachOverride(
    (modelId: string, categoryId: string, visible: boolean) => {
      perModelCategoryVisibility.push({ modelId, categoryId, visible });
      return true;
    }
  );

  const data: SavedViewData = {
    alwaysDrawn,
    neverDrawn,
    categories,
    models,
    version,
    projectId,
    iModelId,
    changeSetId,
    sourceId,
    userView: true,
    state,
    displayStyleProps: JSON.stringify(viewState.displayStyle.toJSON()),
    perModelCategoryVisibility,
  };

  // Parse all data from emphasize elements (e.g. colorization, isolates, hidden, emphasize)
  parseFromEmphasizeElements(vp, data);

  return data;
};
