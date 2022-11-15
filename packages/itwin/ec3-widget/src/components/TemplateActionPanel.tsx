/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Button } from "@itwin/itwinui-react";
import * as React from "react";
import "./TemplateActionPanel.scss";
import { LoadingSpinner } from "./utils";

export interface TemplateActionPanelProps {
  onSave: () => void;
  onCancel: () => void;
  onExport: () => void;
  isCancelDisabled?: boolean;
  isSavingDisabled?: boolean;
  isLoading?: boolean;
}

const TemplateActionPanel = ({
  onSave,
  onCancel,
  onExport,
  isCancelDisabled = false,
  isSavingDisabled = false,
  isLoading = false,
}: TemplateActionPanelProps): JSX.Element => {
  return (
    <div id='action' className='ec3w-action-panel-container'>
      <div className='ec3w-template-action-panel'>
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
          styleType="high-visibility"
          onClick={onExport}
        >
          Export
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
    </div>
  );
};

export default TemplateActionPanel;
