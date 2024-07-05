/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { Button } from "@itwin/itwinui-react";
import * as React from "react";
import "./ActionPanel.scss";
import { LoadingSpinner } from "@itwin/core-react";

export interface ActionPanelProps {
  onSave: () => void;
  onSaveCapture?: () => void;
  onCancel?: () => void;
  onCancelCapture?: () => void;
  isCancelDisabled?: boolean;
  isSavingDisabled?: boolean;
  isLoading?: boolean;
}

const ActionPanel = ({
  onSave,
  onSaveCapture,
  onCancel,
  onCancelCapture,
  isCancelDisabled = false,
  isSavingDisabled = false,
  isLoading = false,
}: ActionPanelProps): JSX.Element => {
  return (
    <div id="action" className="gmw-action-panel-container">
      <div className="gmw-action-panel">
        {isLoading && <LoadingSpinner />}
        <Button disabled={isSavingDisabled || isLoading} styleType="high-visibility" id="save-app" onClick={onSave} onClickCapture={onSaveCapture}>
          Save
        </Button>
        {onCancel && (
          <Button styleType="default" type="button" id="cancel" onClick={onCancel} disabled={isCancelDisabled || isLoading} onClickCapture={onCancelCapture}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
};

export default ActionPanel;
