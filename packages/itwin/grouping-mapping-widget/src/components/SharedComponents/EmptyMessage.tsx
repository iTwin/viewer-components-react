/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Text } from "@itwin/itwinui-react";
import React from "react";
import type { EmptyMessageProps } from "./utils";

export const EmptyMessage = ({ message }: EmptyMessageProps) => (
  <div className='gmw-center-overlay'>
    <Text>{message}</Text>
  </div>
);
