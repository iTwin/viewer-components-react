/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Extraction } from "./Extraction";
import { Reports } from "./Reports";
import "./ReportsContainer.scss";

const ReportsContainer = () => {

  return (
    <div className='reports-container'>
      <Reports />
      <Extraction />
    </div>
  );
};

export default ReportsContainer;
