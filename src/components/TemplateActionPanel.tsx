/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Button } from "@itwin/itwinui-react";
import * as React from "react";
import "./ActionPanel.scss";
import { LoadingSpinner } from "./utils";

import {
  SvgSave,
  SvgExport,
  SvgExit
} from "@itwin/itwinui-icons-react";

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
    <div id='action' className='action-panel-container'>
      <div className='action-panel'>
        {isLoading &&
          <LoadingSpinner />
        }
        <Button
          disabled={isSavingDisabled || isLoading}
          startIcon={<SvgSave />}
          styleType='high-visibility'
          id='save-app'
          onClick={onSave}
        >
          Save
        </Button>
        <Button
          startIcon={<SvgExport />}
          styleType="high-visibility"
          onClick={onExport}
        >
          Export
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

export default TemplateActionPanel;
