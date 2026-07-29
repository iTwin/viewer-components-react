/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { Alert, Button, LabeledTextarea } from "@itwin/itwinui-react";
import { LoadingSpinner } from "../SharedComponents/LoadingSpinner";
import "./ManualGroupingCustomUI.scss";
import type { GroupingCustomUIProps } from "./GroupingMappingCustomUI";
import { GroupingMappingWidget } from "../../GroupingMappingWidget";

/**
 * A default group query builder for the Grouping Mapping Widget that uses a manual input to generate queries.
 * @public
 */
export const ManualGroupingCustomUI = ({ updateQuery, isUpdating, resetView, initialEditModeQuery }: GroupingCustomUIProps) => {
  const [manualInput, setManualInput] = React.useState(initialEditModeQuery ?? "");

  return (
    <div className="gmw-manual-form">
      <Alert type="informational">{GroupingMappingWidget.translate("customUI.manualQueryAlert")}</Alert>
      <LabeledTextarea
        label={GroupingMappingWidget.translate("customUI.manualQueryLabel")}
        required
        value={manualInput}
        onChange={(event) => setManualInput(event.target.value)}
        disabled={isUpdating}
        placeholder={GroupingMappingWidget.translate("customUI.manualQueryPlaceholder")}
      />
      <div className="gmw-manual-actions">
        {isUpdating && <LoadingSpinner />}
        <Button disabled={isUpdating} onClick={() => updateQuery(manualInput)}>
          {GroupingMappingWidget.translate("common.apply")}
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
          {GroupingMappingWidget.translate("common.clear")}
        </Button>
      </div>
    </div>
  );
};
