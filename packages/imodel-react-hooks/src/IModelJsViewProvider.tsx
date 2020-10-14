/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/


import {
  DecorateContext,
  Decorator,
  IModelApp,
  Viewport,
} from "@bentley/imodeljs-frontend";
import React, { useCallback, useEffect, useMemo, useRef } from "react";

import { IModelJsMarker } from "./Marker";
import { makeContextWithProviderRequired } from "./utils";

/**
 * @internal the MarkerDecorationContext is for internal use only and
 * does not guarantee a stable api
 */
export interface MarkerDecorationContext {
  decoration: Decorator;
  register: (m: IModelJsMarker) => void;
  unregister: (m: IModelJsMarker) => void;
  refreshPosition: (m: IModelJsMarker) => void;
  enqueueViewInvalidation: () => void;
}

export const MarkerDecorationContext = makeContextWithProviderRequired<
  MarkerDecorationContext
>("MarkerDecorationContext");

const isViewportValidForDecorations = (v: Viewport) =>
  "invalidateDecorations" in v;

/** @internal */
export class MarkerDecoration implements Decorator {
  private _markersRef: readonly IModelJsMarker[];
  public viewFilter: (vp: Viewport) => boolean;

  public constructor(
    markersRef: readonly IModelJsMarker[],
    inViewFilter?: (vp: Viewport) => boolean
  ) {
    this._markersRef = markersRef;
    this.viewFilter = inViewFilter ?? isViewportValidForDecorations;
  }

  public decorate(context: DecorateContext): void {
    if (this.viewFilter(context.viewport)) {
      this._markersRef.forEach((m) => m.addDecoration(context));
    }
  }
}

export interface IModelJsViewProviderProps extends React.PropsWithChildren<{}> {
  viewFilter?: (vp: Viewport) => boolean;
}

export const IModelJsViewProvider = ({
  children,
  viewFilter,
}: IModelJsViewProviderProps) => {
  const markers = useRef<IModelJsMarker[]>([]);

  const decoratorInstance = useMemo(
    () => new MarkerDecoration(markers.current, viewFilter),
    [markers]
  );

  useEffect(() => {
    if (viewFilter) {
      decoratorInstance.viewFilter = viewFilter;
    }
  }, [viewFilter]);

  useEffect(() => {
    IModelApp.viewManager.addDecorator(decoratorInstance);
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    () => () => IModelApp.viewManager.dropDecorator(decoratorInstance);
  }, [decoratorInstance]);

  const enqueueViewInvalidation = useCallback(
    () =>
      setTimeout(() => IModelApp.viewManager.invalidateDecorationsAllViews()),
    []
  );

  const register = useCallback((toAdd: IModelJsMarker) => {
    markers.current.push(toAdd);
  }, []);

  /** NOTE: might make this strong ordering optional in the future for
   * performance reasons but it should be fine so doing it always for now.
   * A better implementation would be a separate "registered set" and "order list"
   * and the order list can be push only and cleared at the end of the tree render
   */
  const refreshPosition = useCallback((toRefresh: IModelJsMarker) => {
    const index = markers.current.findIndex((m) => m === toRefresh);
    if (index > -1) {
      markers.current.splice(index, 1);
      markers.current.unshift(toRefresh);
    }
  }, []);

  const unregister = useCallback((toRemove: IModelJsMarker) => {
    const index = markers.current.findIndex((m) => m === toRemove);
    if (index > -1) {
      markers.current.splice(index, 1);
      enqueueViewInvalidation();
    }
  }, []);

  const contextState = useMemo(
    () => ({
      decoration: decoratorInstance,
      register,
      unregister,
      enqueueViewInvalidation,
      refreshPosition,
    }),
    [
      decoratorInstance,
      register,
      unregister,
      enqueueViewInvalidation,
      refreshPosition,
    ]
  );

  //clear order list before rendering?

  return (
    <MarkerDecorationContext.Provider value={contextState}>
      {children}
    </MarkerDecorationContext.Provider>
  );
};
