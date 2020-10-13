/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp, Viewport } from "@bentley/imodeljs-frontend";
import { render } from "@testing-library/react";
import React from "react";

import {
  FeatureOverrideReactProvider,
  FeatureSymbologyContext,
  useFeatureOverrides,
} from "./useFeatureOverrides";

jest.mock("@bentley/bentleyjs-core");

jest.mock("@bentley/imodeljs-frontend", () => ({
  IModelApp: {
    viewManager: {
      __vp: {
        featureOverrideProvider: {},
        onFeatureOverrideProviderChanged: {
          addListener: jest.fn(),
        },
        setFeatureOverrideProviderChanged: jest.fn(),
      },
      forEachViewport(func: (vp: Viewport) => void) {
        func((this.__vp as any) as Viewport);
      },
      invalidateViewportScenes: jest.fn(),
      onViewOpen: {
        addListener: jest.fn(),
      },
    },
  },
  FeatureOverrideProvider: class FeatureOverrideProvider {},
}));

const register = jest.fn();
const unregister = jest.fn();
const invalidate = jest.fn();

describe("Hook useFeatureOverrides", () => {
  beforeEach(() => {
    register.mockClear();
    unregister.mockClear();
    invalidate.mockClear();
  });

  it("children are registered in tree order", () => {
    const a = { overrider: jest.fn() };
    const A = () => {
      useFeatureOverrides(a, []);
      return (
        <>
          <B />
          <C />
        </>
      );
    };
    const b = { overrider: jest.fn() };
    const B = () => {
      useFeatureOverrides(b, []);
      return null;
    };
    const c = { overrider: jest.fn() };
    const C = () => {
      useFeatureOverrides(c, []);
      return null;
    };
    render(
      <FeatureSymbologyContext.Provider
        value={{ register, unregister, invalidate }}
      >
        <A />
      </FeatureSymbologyContext.Provider>
    );
    expect(register.mock.calls[0][0].current).toEqual(a);
    expect(register.mock.calls[1][0].current).toEqual(b);
    expect(register.mock.calls[2][0].current).toEqual(c);
  });

  it("children unregistered on unmount", () => {
    const A = () => {
      useFeatureOverrides({ overrider: jest.fn() }, []);
      return <></>;
    };
    const wrapper = render(
      <FeatureSymbologyContext.Provider
        value={{ register, unregister, invalidate }}
      >
        <A />
      </FeatureSymbologyContext.Provider>
    );
    expect(register).toBeCalledTimes(1);
    expect(unregister).toBeCalledTimes(0);
    wrapper.unmount();
    expect(unregister).toBeCalledTimes(1);
  });

  it("should ignore components above in the tree when there is a 'complete override'", async () => {
    const override = jest.fn((arg) => {
      const test = arg;
      return test as any;
    });
    const A = () => {
      useFeatureOverrides({ overrider: () => override("A") }, []);
      return (
        <>
          <B />
          <C />
        </>
      );
    };
    const B = () => {
      useFeatureOverrides({ overrider: () => override("B") }, []);
      return null;
    };
    const C = () => {
      useFeatureOverrides(
        { overrider: () => override("C"), completeOverride: true },
        []
      );
      return <D />;
    };
    const D = () => {
      useFeatureOverrides({ overrider: () => override("D") }, []);
      return null;
    };
    render(
      <FeatureOverrideReactProvider>
        <A />
      </FeatureOverrideReactProvider>
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    IModelApp.viewManager.forEachViewport((vp) => {
      vp.featureOverrideProvider?.addFeatureOverrides(undefined!, vp!);
    });
    expect(override.mock.calls).toEqual([["C"], ["D"]]);
  });
});
