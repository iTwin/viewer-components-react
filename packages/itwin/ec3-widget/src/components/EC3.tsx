/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import type { EC3Config } from "./EC3/EC3Config";
import { ApiContext, createApiContext } from "./api/APIContext";
import { Templates } from "./Templates";

export interface EC3Props {
  config: EC3Config;
}

export const EC3 = ({ config }: EC3Props) => {
  return (
    <ApiContext.Provider value={createApiContext(config)}>
      <div className="ec3w-container">
        <Templates config={config} />
      </div>
    </ApiContext.Provider>
  );
};
