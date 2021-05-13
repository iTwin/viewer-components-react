/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/


import {
  Code,
  ColorDef,
  SheetProps,
  ViewStateProps,
} from "@bentley/imodeljs-common";
import {
  AppearanceOverrideProps,
  DisplayStyle3dState,
  DrawingViewState,
  EmphasizeElements,
  FeatureOverrideType,
  IModelConnection,
  SheetViewState,
  SpatialViewState,
  Viewport,
  ViewState2d,
} from "@bentley/imodeljs-frontend";

import {
  PerModelCategoryVisibilityProps,
  SavedViewData,
} from "../util/SavedViewTypes";

/** Parses all the emphasize elements props and data from the viewport and puts it into the SavedViewData
 * @deprecated Use EmphasizeElements.toJSON from @bentley/imodeljs-frontend instead
*/
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
 * Convert given object to string or undefined if it's undefined.
 * @param args name of the argument object.
 */
const jsonStringify = <T>(args: T): string | undefined => {
  return args !== undefined ? JSON.stringify(args) : undefined;
};

/**
 * Creates 2D view props that is common to both sheet and drawings.
 * @param vp the name of the view port.
 * @deprecated Use createViewStateProps instead.
 */
const create2dViewProps = (vp: Viewport): SavedViewData => {
  const viewState = vp.view as ViewState2d;
  const categorySelectorProps = viewState.categorySelector?.toJSON();
  const viewDefinitionProps = viewState.toJSON();
  const displayStyleProps = viewState.displayStyle?.toJSON();
  const emphasizedElementsProps = EmphasizeElements.get(vp)?.toJSON(vp);

  return {
    categorySelectorProps: jsonStringify(categorySelectorProps),
    displayStyleProps: jsonStringify(displayStyleProps),
    emphasizedElementsProps: jsonStringify(emphasizedElementsProps),
    is2d: true,
    viewDefinitionProps: jsonStringify(viewDefinitionProps),
  };
};

/**
 * Created 2D saved view data either sheet or drawing on the basis of view state type.
 * @param vp name of the view port.
 * @param viewStateType name fo the view state type.
 * @deprecated Use createViewStateProps instead
 */
export const create2DSavedView = (
  vp: Viewport,
  viewStateType: string
): SavedViewData => {
  if (vp.view === undefined) {
    throw new Error("Invalid viewport");
  }
  const common2dViewProps = create2dViewProps(vp);
  if (viewStateType === DrawingViewState.name) {
    return common2dViewProps;
  }
  if (viewStateType === SheetViewState.name) {
    const viewState = vp.view as SheetViewState;
    const sheetSize = viewState.sheetSize;
    const sheetProps: SheetProps = {
      width: sheetSize.x,
      height: sheetSize.y,
      model: viewState.model,
      classFullName: SheetViewState.classFullName,
      code: Code.createEmpty(),
    };
    common2dViewProps.sheetAttachments = viewState.attachmentIds;
    common2dViewProps.sheetProps = jsonStringify(sheetProps);
    return common2dViewProps;
  }
  throw new Error("Invalid view state type");
};

/**
 * Creates 3d saved view data
 * @param vp View port from which view definition to be made
 * @deprecated Use createViewStateProps instead
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
    cameraPosition: viewState.camera?.getEyePoint()?.toJSON(),
    extents: viewState.extents?.toJSON(),
    flags: viewState.viewFlags,
    isCameraOn: viewState.isCameraOn,
    origin: viewState.origin?.toJSON(),
    rotation: viewState.rotation?.toJSON(),
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
    categories,
    changeSetId,
    displayStyleProps: jsonStringify(viewState?.displayStyle?.toJSON()),
    iModelId,
    is2d: false,
    models,
    neverDrawn,
    perModelCategoryVisibility,
    projectId,
    sourceId,
    state,
    userView: true,
    version,
  };

  // Parse all data from emphasize elements (e.g. colorization, isolates, hidden, emphasize)
  parseFromEmphasizeElements(vp, data);

  return data;
};

/**
 * Determines whether or not given saved view is spatial.
 * @param view name of the Saved View.
 * @deprecated Use isSpatialViewProps instead
 */
export const isSpatialSavedView = (view: SavedViewData) => {
  // view.is2d can be undefined for spatialSavedView that are added before 2D saved view feature is added.
  return !view.is2d && "models" in view;
};

/**
 * Determines whether or not given view is Drawing.
 * @param view name fo the Saved View.
 * @deprecated Use isSheetViewProps and isSpatialViewProps instead
 */
export const isDrawingSavedView = (view: SavedViewData) => {
  return view.is2d && !("sheetProps" in view);
};

/**
 * Determines whether or not given view is Sheet.
 * @param view name of the Saved View.
 * @deprecated Use isSheetViewProps instead
 */
export const isSheetSavedView = (view: SavedViewData) => {
  return view.is2d && "sheetProps" in view;
};

/**
 * Creates 2d(sheet or drawing on the basis of viewStateType) view state from gived savedView.
 * @param iModelConnection name of the iModelConnection.
 * @param savedView name of the saved view data to create view state props.
 * @param viewStateType name fo the view state type to distinguish between sheet and drawing.
 * @deprecated Use createViewStateAsync instead.
 */
export const create2dViewState = async (
  iModelConnection: IModelConnection,
  savedView: SavedViewData,
  viewStateType: string
): Promise<ViewState2d> => {
  const props: ViewStateProps = {
    viewDefinitionProps: savedView.viewDefinitionProps
      ? JSON.parse(savedView.viewDefinitionProps)
      : undefined,
    categorySelectorProps: savedView.categorySelectorProps
      ? JSON.parse(savedView.categorySelectorProps)
      : undefined,
    displayStyleProps: savedView.displayStyleProps
      ? JSON.parse(savedView.displayStyleProps)
      : undefined,
    sheetProps: savedView.sheetProps
      ? JSON.parse(savedView.sheetProps)
      : undefined,
    sheetAttachments: savedView.sheetAttachments,
  };
  const viewState =
    viewStateType === SheetViewState.name
      ? SheetViewState.createFromProps(props, iModelConnection)
      : DrawingViewState.createFromProps(props, iModelConnection);
  await viewState.load();
  return viewState;
};

/**
 * Creates a markup saved view data from the viewport, it could return a
 * View2d(Sheet or Drawings) or a View3d(Spatial views) object
 * @param vp the name of the view port.
 * @deprecated Use createViewStateProps instead
 */
export const createMarkupSavedViewData = (vp: Viewport): SavedViewData => {
  if (vp.view.isSpatialView()) {
    return createSavedViewData(vp);
  } else if (vp.view.isDrawingView()) {
    return create2DSavedView(vp, DrawingViewState.name);
  } else {
    return create2DSavedView(vp, SheetViewState.name);
  }
};
