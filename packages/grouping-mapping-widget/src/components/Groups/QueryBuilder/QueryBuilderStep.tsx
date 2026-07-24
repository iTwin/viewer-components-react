/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import type { SelectOption } from "@itwin/itwinui-react";
import { ComboBox, Fieldset, Label, Text } from "@itwin/itwinui-react";
import { GroupingMappingWidget } from "../../../GroupingMappingWidget";
import type { QueryBuilderCustomUIProps } from "./QueryBuilderCustomUI";
import { QueryBuilderCustomUI } from "./QueryBuilderCustomUI";
import "./QueryBuilderStep.scss";

const getDefaultDisplayStrings = () => ({
  groupBy: GroupingMappingWidget.translate("groups.groupBy"),
});

export interface QueryBuilderStepProps extends QueryBuilderCustomUIProps {
  queryRowCount: number;
  isHidden: boolean;
  onChange: (value: string) => Promise<void>;
  getOptions: SelectOption<string>[];
  displayStrings?: Partial<ReturnType<typeof getDefaultDisplayStrings>>;
}

export const QueryBuilderStep = ({ queryRowCount, isHidden, onChange, getOptions, displayStrings: userDisplayStrings, ...rest }: QueryBuilderStepProps) => {
  const containerClassName = isHidden ? "gmw-hide" : "gmw-query-builder-container";

  const displayStrings = React.useMemo(() => ({ ...getDefaultDisplayStrings(), ...userDisplayStrings }), [userDisplayStrings]);

  return (
    <Fieldset legend={displayStrings.groupBy} className={containerClassName}>
      <span>
        <Label htmlFor="query-combo-input">{GroupingMappingWidget.translate("groups.queryGenerationTool")}</Label>
        <ComboBox
          value={rest.queryGenerationType}
          inputProps={{
            id: "query-combo-input",
          }}
          options={getOptions}
          onChange={onChange}
        />
      </span>
      <Text>{GroupingMappingWidget.translate("groups.rowCount", { queryRowCount: queryRowCount.toString() })}</Text>
      <QueryBuilderCustomUI {...rest} />
    </Fieldset>
  );
};
