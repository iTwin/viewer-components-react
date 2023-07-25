/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useMemo } from "react";
import type { EC3ConfigProps } from "./EC3/EC3Config";
import { EC3Config } from "./EC3/EC3Config";
import { ApiContext, createApiContext } from "./api/APIContext";

export type EC3ContextProps = EC3ConfigProps & {
  children?: React.ReactNode;
};

export const EC3Context = (props: EC3ContextProps) => {
  const apiConfig = useMemo(() => {
    const ec3Config = new EC3Config(props);
    return ({
      ...createApiContext(ec3Config),
      config: ec3Config,
    });
  }, [props]);

  return (
    <ApiContext.Provider value={apiConfig}>
      {props.children}
    </ApiContext.Provider>
  );
};
