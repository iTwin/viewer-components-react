/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import { Button, LabeledTextarea, Text } from "@itwin/itwinui-react";
import type { GroupExtensionProps } from "../../utils";
import { LoadingSpinner } from "../utils";
import "./ManualExtension.scss";

const ManualExtension = ({ updateQuery, isUpdating, resetView }: GroupExtensionProps) => {
  const [manualInput, setManualInput] = React.useState("");

  return (
    <div className="gmw-manual-form">
      <Text>
        Generate group by user defined ECSQL query. Please select
        ECInstanceId column in the query.
      </Text>
      <LabeledTextarea
        label="Query"
        required
        value={manualInput}
        onChange={(event) => setManualInput(event.target.value)}
        disabled={isUpdating}
        placeholder={`E.g. "Select ECInstanceId From Biscore.Element`}
      />
      <div className="gmw-manual-actions">
        {isUpdating && <LoadingSpinner />}
        <Button
          disabled={isUpdating}
          onClick={() => updateQuery(manualInput)}
        >
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

export default ManualExtension;
