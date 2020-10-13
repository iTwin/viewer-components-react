// Copyright (c) Bentley Systems, Incorporated. All rights reserved.

import React from "react";

/**
 * @deprecated use "makeContextWithProviderRequired" instead
 * @see makeContextWithProviderRequired
 */
export const makeInvalidContext = <T extends any>() =>
  makeContextWithProviderRequired<T>();

/**
 * like React.createContext, but the default state (the one used when no provider is found by a consumer),
 * throws errors on usage, useful for when consuming without a provider should be considered programmer error.
 */
export const makeContextWithProviderRequired = <T extends any>(
  name = "UntitledContext"
) =>
  React.createContext<T>(
    new Proxy(
      {},
      {
        get(): never {
          throw Error(`Consuming the ${name} is invalid without a provider`);
        },
      }
    ) as T
  );
