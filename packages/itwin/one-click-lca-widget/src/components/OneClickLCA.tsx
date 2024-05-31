/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { Reports } from "./Reports";
import "./Reports.scss";

import type { ReportProps } from "./Reports";

const OneClickLCA = (props: ReportProps) => {
  return (
    <div className="oclca-container">
      <Reports {...props} />
    </div>
  );
};

export default OneClickLCA;
