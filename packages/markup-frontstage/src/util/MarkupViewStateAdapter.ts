/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/


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
  const props = viewState.toProps();
  const emphasizedElementsProps = EmphasizeElements.get(vp)?.toJSON(vp);
  const markupViewStateProps: MarkupViewStateProps = {
    ...props,
    emphasizedElementsProps,
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