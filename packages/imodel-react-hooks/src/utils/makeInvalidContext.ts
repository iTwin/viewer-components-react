/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// Copyright (c) Bentley Systems, Incorporated. All rights reserved.

import React from "react";

export const makeInvalidContext = <T extends any>() =>
  React.createContext<T>(
    new Proxy(
      {},
      {
        get(): never {
          throw new Error(
            "Consuming this context is invalid without a provider"
          );
        },
      }
    ) as T
  );
