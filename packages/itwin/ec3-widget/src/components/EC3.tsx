/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import { EC3Config } from "./EC3/EC3Config";
import Templates from "./Templates";
import "./Templates.scss";

export interface EC3Props {
  config: EC3Config,
}

const EC3 = ({ config }: EC3Props) => {
  return (
    <div className="ec3-container">
      <Templates
        config={config} />
    </div>
  );
};

export default EC3;
