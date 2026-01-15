/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { FeatureOverrideProvider } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import { cleanup, render } from "@testing-library/react";
import React from "react";
import { FeatureOverrideReactProvider, FeatureSymbologyContext, useFeatureOverrides } from "./useFeatureOverrides";

jest.mock("@itwin/core-frontend", () => ({
  IModelApp: {
    viewManager: {
      __viewports: [{
          featureOverrideProviders: new Array<FeatureOverrideProvider>(),
          onFeatureOverrideProviderChanged: {
            addListener: jest.fn(),
          },
          setFeatureOverrideProviderChanged: jest.fn(),
          addFeatureOverrideProvider(provider: FeatureOverrideProvider){
            this.featureOverrideProviders.push(provider);
          }
        }
      ],
      invalidateViewportScenes: jest.fn(),
      onViewOpen: {
        addListener: jest.fn(),
      },
      [Symbol.iterator]() {
        return this.__viewports[Symbol.iterator]();
      }
    },
  },
  FeatureOverrideProvider: class FeatureOverrideProvider { },
}));

describe("Hook useFeatureOverrides", () => {
  afterEach(() => {
    cleanup();
  })

  it("children are registered in tree order", () => {
    const unregister = jest.fn();
    const register = jest.fn();
    const invalidate = jest.fn();

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

  it("children unregistered on unmount", async () => {

    const [unregister, unregistered] = getAwaitableMock();
    const register = jest.fn();
    const invalidate = jest.fn();

    const A = () => {
      useFeatureOverrides({ overrider: jest.fn() }, []);
      return <></>;
    };
    const wrapper = render(
      <FeatureSymbologyContext.Provider value={{ register, unregister, invalidate }}>
        <A />
      </FeatureSymbologyContext.Provider>,
    );
    expect(register).toBeCalledTimes(1);
    expect(unregister).toBeCalledTimes(0);
    wrapper.unmount();
    await unregistered;
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
      useFeatureOverrides({ overrider: () => override("C"), completeOverride: true }, []);
      return <D />;
    };
    const D = () => {
      useFeatureOverrides({ overrider: () => override("D") }, []);
      return null;
    };
    render(
      <FeatureOverrideReactProvider>
        <A />
      </FeatureOverrideReactProvider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    for (const vp of IModelApp.viewManager) {
      for (const provider of vp.featureOverrideProviders) {
        provider.addFeatureOverrides(undefined!, vp);
      }
    }
    expect(override.mock.calls).toEqual([["C"], ["D"]]);
  });
});

function getAwaitableMock(): [jest.Mock<void>, Promise<void>] {
  let resolve: (() => void) | undefined;
  const promise = new Promise<void>((_resolve) => {resolve = _resolve});
  const callback = jest.fn(resolve);

  return [callback, promise];
}
