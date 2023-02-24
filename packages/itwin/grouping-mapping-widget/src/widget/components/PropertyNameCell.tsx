/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import { Text } from "@itwin/itwinui-react";

export const PropertyNameCell = <T,>({
  propertyName,
  property,
  onClickModify,
}: {
  propertyName: string;
  property: T;
  onClickModify?: (value: T) => void;
}) =>
  onClickModify ? (
    <div className="iui-anchor" onClick={() => onClickModify(property)}>
      {propertyName}
    </div>
  ) : (
    <Text>{propertyName}</Text>
  );
