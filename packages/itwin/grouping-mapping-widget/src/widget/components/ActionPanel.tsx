/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Button } from "@itwin/itwinui-react";
import * as React from "react";
import "./ActionPanel.scss";
import { LoadingSpinner } from "./utils";

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
        {isLoading &&
          <LoadingSpinner />
        }
        <Button
          disabled={disabled || isLoading}
          styleType='high-visibility'
          id='save-app'
          onClick={onSave}
        >
          Save
        </Button>
        <Button
          styleType='default'
          type='button'
          id='cancel'
          onClick={onCancel}
          disabled={disabled || isLoading}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default ActionPanel;
