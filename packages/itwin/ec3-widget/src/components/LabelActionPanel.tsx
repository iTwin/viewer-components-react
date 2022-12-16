/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Button } from "@itwin/itwinui-react";
import * as React from "react";
import "./LabelActionPanel.scss";
import { LoadingSpinner } from "./utils";

export interface ActionPanelProps {
  onSave: () => void;
  onCancel: () => void;
  isCancelDisabled?: boolean;
  isSavingDisabled?: boolean;
  isLoading?: boolean;
}

export const LabelActionPanel = ({
  onSave,
  onCancel,
  isCancelDisabled = false,
  isSavingDisabled,
  isLoading = false,
}: ActionPanelProps): JSX.Element => {
  return (
    <div className='ec3w-label-action-panel'>
      {isLoading &&
        <LoadingSpinner />
      }
      <Button
        disabled={isSavingDisabled || isLoading}
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
        disabled={isCancelDisabled || isLoading}
      >
        Cancel
      </Button>
    </div>
  );
};
