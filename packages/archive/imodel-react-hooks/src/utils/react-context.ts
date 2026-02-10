/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/


import React from "react";

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
