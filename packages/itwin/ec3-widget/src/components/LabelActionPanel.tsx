/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Button } from "@itwin/itwinui-react";
import * as React from "react";
import "./LabelActionPanel.scss";
import { LoadingSpinner } from "./utils";
import {
  SvgSave,
  SvgExit
} from "@itwin/itwinui-icons-react";

export interface ActionPanelProps {
  onSave: () => void;
  onCancel: () => void;
  isCancelDisabled?: boolean;
  isSavingDisabled?: boolean;
  isLoading?: boolean;
}

const ActionPanel = ({
  onSave,
  onCancel,
  isCancelDisabled = false,
  isSavingDisabled = false,
  isLoading = false,
}: ActionPanelProps): JSX.Element => {
  return (
    <div id='action'>
      <div className='ec3-label-action-panel'>
        {isLoading &&
          <LoadingSpinner />
        }
        <Button
          startIcon={<SvgSave />}
          disabled={isSavingDisabled || isLoading}
          styleType='high-visibility'
          id='save-app'
          onClick={onSave}
        >
          Save
        </Button>
        <Button
          startIcon={<SvgExit />}
          styleType='default'
          type='button'
          id='cancel'
          onClick={onCancel}
          disabled={isCancelDisabled || isLoading}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default ActionPanel;
