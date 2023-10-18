/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ProgressRadial, Text } from "@itwin/itwinui-react";
import React from "react";
import "./LoadingOverlay.scss";

export const LoadingOverlay = () => (
  <div className='gmw-loading-center-overlay'>
    <Text>Loading</Text>
    <ProgressRadial indeterminate />
    <Text>Please wait...</Text>
  </div>
);
