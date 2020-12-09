/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  Code,
  SheetProps,
} from "@bentley/imodeljs-common";
import {
  DrawingViewState,
  EmphasizeElements,
  IModelConnection,
  SheetViewState,
  SpatialViewState,
  Viewport,
  ViewState,
} from "@bentley/imodeljs-frontend";

import { MarkupViewStateProps } from "./MarkupViewState";

/**
 * Serialize the view state (spatial, drawing, sheet) to markup view state props.
 * @param vp name of the view port.
 */
export const createViewStateProps = (vp: Viewport, markup: string): MarkupViewStateProps => {
  const viewState = vp.view.isSpatialView() ? vp.view as SpatialViewState : vp.view.isDrawingView() ? vp.view as DrawingViewState : vp.view as SheetViewState;
  const categorySelectorProps = viewState.categorySelector?.toJSON();
  const displayStyleProps = viewState.displayStyle?.toJSON();
  const emphasizedElementsProps = EmphasizeElements.get(vp)?.toJSON(vp);
  const modelExtents = viewState.getViewedExtents().toJSON();
  const viewDefinitionProps = viewState.toJSON();
  const markupViewStateProps: MarkupViewStateProps = {
    categorySelectorProps,
    displayStyleProps,
    emphasizedElementsProps,
    modelExtents,
    viewDefinitionProps: viewDefinitionProps,
  }
  if (vp.view.isSpatialView()) {
    markupViewStateProps.modelSelectorProps = (viewState as SpatialViewState).modelSelector.toJSON();
  }
  if (viewState instanceof SheetViewState) {
    const sheetSize = viewState.sheetSize;
    const sheetProps: SheetProps = {
      width: sheetSize.x,
      height: sheetSize.y,
      model: viewState.model,
      classFullName: SheetViewState.classFullName,
      code: Code.createEmpty(),
    };
    markupViewStateProps.sheetAttachments = viewState.attachmentIds;
    markupViewStateProps.sheetProps = sheetProps;
  }
  if (markup !== undefined) {
    markupViewStateProps.markup = markup;
  }
  return markupViewStateProps;
}

/**
 * Determines whether or not given view props is spatial.
 * @param viewStateProps name of thevmarkup View State Props.
 */
export const isSpatialViewProps = (viewStateProps: MarkupViewStateProps) => {
  return ("modelSelectorProps" in viewStateProps);
};

/**
 * Determines whether or not given view is Sheet.
 * @param viewStateProps name of the markup View State Props.
 */
export const isSheetViewProps = (viewStateProps: MarkupViewStateProps) => {
  return ("sheetProps" in viewStateProps);
};

/**
 * Creates view state from serialized view state including 2D(Sheets and Drawing) and 3D(Spatial only)
 * @param iModelConnection name of the iModel Connection.
 * @param viewStateProps name of the view state props.
 */
export const createViewStateAsync = async (
  iModelConnection: IModelConnection,
  viewStateProps: MarkupViewStateProps
): Promise<ViewState> => {
  const viewState = isSpatialViewProps(viewStateProps) ? SpatialViewState.createFromProps(viewStateProps, iModelConnection) :
    isSheetViewProps(viewStateProps)
      ? SheetViewState.createFromProps(viewStateProps, iModelConnection)
      : DrawingViewState.createFromProps(viewStateProps, iModelConnection);
  await viewState.load();
  return viewState;
};