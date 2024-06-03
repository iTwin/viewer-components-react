/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import type { SelectOption } from "@itwin/itwinui-react";
import { ComboBox, Fieldset, Label, Text } from "@itwin/itwinui-react";
import type { QueryBuilderCustomUIProps } from "./QueryBuilderCustomUI";
import { QueryBuilderCustomUI } from "./QueryBuilderCustomUI";
import "./QueryBuilderStep.scss";

const defaultDisplayStrings = {
  groupBy: "Group By",
};

export interface QueryBuilderStepProps extends QueryBuilderCustomUIProps {
  queryRowCount: number;
  isHidden: boolean;
  onChange: (value: string) => Promise<void>;
  getOptions: SelectOption<string>[];
  displayStrings?: Partial<typeof defaultDisplayStrings>;
}

export const QueryBuilderStep = ({ queryRowCount, isHidden, onChange, getOptions, displayStrings: userDisplayStrings, ...rest }: QueryBuilderStepProps) => {
  const containerClassName = isHidden ? "gmw-hide" : "gmw-query-builder-container";

  const displayStrings = React.useMemo(() => ({ ...defaultDisplayStrings, ...userDisplayStrings }), [userDisplayStrings]);

  return (
    <Fieldset legend={displayStrings.groupBy} className={containerClassName}>
      <span>
        <Label htmlFor="query-combo-input">Query Generation Tool</Label>
        <ComboBox
          value={rest.queryGenerationType}
          inputProps={{
            id: "query-combo-input",
          }}
          options={getOptions}
          onChange={onChange}
        />
      </span>
      <Text>{`Row Count: ${queryRowCount}`}</Text>
      <QueryBuilderCustomUI {...rest} />
    </Fieldset>
  );
};
