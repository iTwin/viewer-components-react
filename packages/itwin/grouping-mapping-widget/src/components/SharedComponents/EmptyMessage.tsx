/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Text } from "@itwin/itwinui-react";
import React from "react";
import type { EmptyMessageProps } from "./utils";
import "./EmptyMessage.scss";

export const EmptyMessage = ({ message }: EmptyMessageProps) => (
  <div className='gmw-empty-message-center-overlay'>
    <Text>{message}</Text>
  </div>
);