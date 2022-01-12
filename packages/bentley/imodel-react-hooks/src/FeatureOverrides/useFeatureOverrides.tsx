/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/


import { Logger } from "@bentley/bentleyjs-core";
import {
  FeatureOverrideProvider,
  FeatureSymbology,
  IModelApp,
  Viewport,
} from "@bentley/imodeljs-frontend";
import React, { useContext, useEffect, useMemo, useRef } from "react";
import { useCallback } from "react";

import { useOnMountInRenderOrder } from "../utils";
import { makeContextWithProviderRequired } from "../utils/react-context";

export type FeatureOverrider = (
  overrides: FeatureSymbology.Overrides,
  viewport: Viewport
) => void;

export interface UseFeatureOverridesOpts {
  overrider: FeatureOverrider;
  /** skip other overrides. This can be used for performance reasons,
   * such as when you know previous layers are being completely overriden
   * and you want to skip their potentially expensive override calculations
   */
  completeOverride?: boolean;
}

/** @internal only exported for testing right now */
export interface FeatureSymbologyContext {
  register: (ref: React.MutableRefObject<UseFeatureOverridesOpts>) => void;
  unregister: (ref: React.MutableRefObject<UseFeatureOverridesOpts>) => void;
  invalidate: () => void;
}

/** @internal only exported for testing right now */
export const FeatureSymbologyContext = makeContextWithProviderRequired<
  FeatureSymbologyContext
>("FeatureSymbologyContext");

/** useFeatureOverrides allows components to declare and override features in a cascade,
 * components further down the component tree will be able to override their ancestors.
 * @param opts - the actual override implementation
 * @param deps - dependencies upon which to invalidate the overrides
 */
export const useFeatureOverrides = (
  overrider: UseFeatureOverridesOpts,
  deps: any[]
) => {
  const overrideRef = useRef(overrider);
  useEffect(() => {
    overrideRef.current = overrider;
  }, [overrider]);

  const symbologyCtx = useContext(FeatureSymbologyContext);

  useOnMountInRenderOrder(() => {
    symbologyCtx.register(overrideRef);
    return () => {
      symbologyCtx.unregister(overrideRef);
    };
  });

  useEffect(() => {
    symbologyCtx.invalidate();
  }, deps);
};

export type FeatureOverrideReactProviderProps = React.PropsWithChildren<{
  /** filter which viewports receive the descendant overrides */
  viewFilter?: (vp: Viewport) => boolean;
}>;

/** unfortunately "provider" in react jargon collides with the vanilla JS api class name */
export const FeatureOverrideReactProvider = ({
  children,
  viewFilter,
}: FeatureOverrideReactProviderProps) => {
  const providers = useRef<React.MutableRefObject<UseFeatureOverridesOpts>[]>(
    []
  );

  const impl: FeatureOverrideProvider = useMemo(
    () => ({
      addFeatureOverrides: (overrides, viewport) => {
        // get the rightmost (last) completely-overriding overrider, if
        // there are none, include all overriders by starting at the first
        if (providers.current.length === 0) {
          return;
        }
        let lastCompleteOverride = providers.current[0];
        for (let i = providers.current.length - 1; i >= 0; --i) {
          if (providers.current[i].current.completeOverride) {
            lastCompleteOverride = providers.current[i];
            break;
          }
        }
        const startIndex = providers.current.findIndex(
          (p) => p === lastCompleteOverride
        );
        const usedProviders = providers.current.slice(startIndex);
        usedProviders.forEach((provider) =>
          provider.current.overrider(overrides, viewport)
        );
      },
    }),
    []
  );

  useEffect(() => {
    const attach = () =>
      IModelApp.viewManager.forEachViewport((vp) => {
        if (!viewFilter || viewFilter(vp)) {
          vp.featureOverrideProvider = impl;
        }
      });
    attach();
    const unsubViewOpen = IModelApp.viewManager.onViewOpen.addListener(attach);
    return unsubViewOpen;
  }, [impl, viewFilter]);

  const invalidate = useCallback(() => {
    IModelApp.viewManager.forEachViewport((v) => {
      if (!viewFilter || viewFilter(v)) {
        v.setFeatureOverrideProviderChanged();
      }
    });
  }, [viewFilter]);

  const state = useMemo<FeatureSymbologyContext>(
    () => ({
      register(ref) {
        providers.current.push(ref);
      },
      unregister(ref) {
        const index = providers.current.findIndex((p) => p === ref);
        providers.current.splice(index, 1);
        invalidate();
      },
      invalidate,
    }),
    [providers, viewFilter]
  );

  return (
    <FeatureSymbologyContext.Provider value={state}>
      {children}
    </FeatureSymbologyContext.Provider>
  );
};
