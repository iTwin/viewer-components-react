/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { Text } from "@itwin/itwinui-react";
import "./RequiredFieldsNotice.scss";

export const RequiredFieldsNotice = () => (
  <Text variant="small" className="ec3w-template-field-legend">
    Asterisk * indicates mandatory fields.
  </Text>
);
