/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { Text } from "@itwin/itwinui-react";

export interface PropertyNameCellProps<T extends { name: string }> {
  rule: T;
  onClickModify?: (value: T) => void;
}

export const PropertyNameCell = <T extends { name: string }>({ rule, onClickModify }: PropertyNameCellProps<T>) =>
  onClickModify ? (
    <div className="iui-anchor" onClick={() => onClickModify(rule)}>
      {rule.name}
    </div>
  ) : (
    <Text>{rule.name}</Text>
  );
