/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { FeatureOverrideProvider, FeatureSymbology, Viewport } from "@itwin/core-frontend";
import React, { useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { IModelApp } from "@itwin/core-frontend";
import { useOnMountInRenderOrder } from "../utils/basic-hooks";
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
    const attach = () => {
      for (const vp of IModelApp.viewManager) {
        if (!viewFilter || viewFilter(vp)) {
          vp.addFeatureOverrideProvider(impl);
        }
      }
    };
    attach();

    const removeListener = IModelApp.viewManager.onViewOpen.addListener(attach);
    return () => {
      for (const vp of IModelApp.viewManager) {
        if (!viewFilter || viewFilter(vp)) {
          vp.dropFeatureOverrideProvider(impl);
        }
      }
      removeListener();
    };
  }, [impl, viewFilter]);

  const invalidate = useCallback(() => {
    for (const vp of IModelApp.viewManager) {
      if (!viewFilter || viewFilter(vp)) {
        vp.setFeatureOverrideProviderChanged();
      }
    }
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
    [providers, invalidate]
  );

  return (
    <FeatureSymbologyContext.Provider value={state}>
      {children}
    </FeatureSymbologyContext.Provider>
  );
};
