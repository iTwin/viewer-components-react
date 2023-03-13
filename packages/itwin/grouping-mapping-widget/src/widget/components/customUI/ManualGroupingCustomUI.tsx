/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import { Button, LabeledTextarea, Text } from "@itwin/itwinui-react";
import { LoadingSpinner } from "../utils";
import "./ManualGroupingCustomUI.scss";
import type { GroupingCustomUIProps } from "./GroupingMappingCustomUI";

export const ManualGroupingCustomUI = ({
  updateQuery,
  isUpdating,
  resetView,
}: GroupingCustomUIProps) => {
  const [manualInput, setManualInput] = React.useState("");

  return (
    <div className='gmw-manual-form'>
      <Text>
        Generate group using an ECSQL query. Please select ECInstanceId and ECClassId columns in the query.
      </Text>
      <LabeledTextarea
        label='Query'
        required
        value={manualInput}
        onChange={(event) => setManualInput(event.target.value)}
        disabled={isUpdating}
        placeholder={`E.g. "SELECT ECInstanceId, ECClassId FROM BisCore:PhysicalElement"`}
      />
      <div className='gmw-manual-actions'>
        {isUpdating && <LoadingSpinner />}
        <Button disabled={isUpdating} onClick={() => updateQuery(manualInput)}>
          Apply
        </Button>
        <Button
          disabled={isUpdating}
          onClick={async () => {
            updateQuery("");
            setManualInput("");
            if (resetView) {
              await resetView();
            }
          }}
        >
          Clear
        </Button>
      </div>
    </div>
  );
};
