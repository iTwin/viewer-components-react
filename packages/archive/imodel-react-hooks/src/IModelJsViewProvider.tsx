/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { DecorateContext, Decorator, Viewport } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import React, { useCallback, useEffect, useMemo, useRef } from "react";

import type { IModelJsMarker } from "./Marker/useMarker";
import { makeContextWithProviderRequired } from "./utils/react-context";

/**
 * @internal the MarkerDecorationContext is for internal use only and
 * does not guarantee a stable api
 */
export interface MarkerDecorationContextType {
  decoration: Decorator;
  register: (m: IModelJsMarker) => void;
  unregister: (m: IModelJsMarker) => void;
  refreshPosition: (m: IModelJsMarker) => void;
  enqueueViewInvalidation: () => void;
}

export const MarkerDecorationContext = makeContextWithProviderRequired<MarkerDecorationContextType>(
  "MarkerDecorationContext"
);

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
    [viewFilter]
  );

  useEffect(() => {
    return IModelApp.viewManager.addDecorator(decoratorInstance);
  }, [decoratorInstance]);

  const enqueueViewInvalidation = useCallback(
    () =>
      setTimeout(() => {
        for (const vp of IModelApp.viewManager) {
          if (viewFilter?.(vp) ?? true) {
            vp.invalidateDecorations();
          }
        }
      }),
    [viewFilter]
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
  }, [enqueueViewInvalidation]);

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

  // clear order list before rendering?

  return (
    <MarkerDecorationContext.Provider value={contextState}>
      {children}
    </MarkerDecorationContext.Provider>
  );
};
