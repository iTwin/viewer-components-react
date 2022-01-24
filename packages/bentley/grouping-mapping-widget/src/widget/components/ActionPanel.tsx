/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Button, IconButton, ProgressRadial } from "@itwin/itwinui-react";
import * as React from "react";
import "./ActionPanel.scss";

export interface ActionPanelProps {
  onSave: () => void;
  onCancel: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}

const ActionPanel = ({
  onSave,
  onCancel,
  disabled = false,
  isLoading = false,
}: ActionPanelProps): JSX.Element => {
  return (
    <div id='action' className='action-panel-container'>
      <div className='action-panel'>
        {isLoading ? (
          <IconButton styleType='high-visibility'>
            <ProgressRadial indeterminate />
          </IconButton>
        ) : (
          <Button
            disabled={disabled}
            styleType='high-visibility'
            id='save-app'
            onClick={onSave}
          >
            Save
          </Button>
        )}
        <Button
          styleType='default'
          type='button'
          id='cancel'
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default ActionPanel;
