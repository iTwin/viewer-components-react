/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { Button } from "@itwin/itwinui-react";
import * as React from "react";
import { ReportsConfigWidget } from "../../ReportsConfigWidget";
import "./ActionPanel.scss";
import { LoadingSpinner } from "./utils";

export interface ActionPanelProps {
  actionLabel: string;
  onAction: () => Promise<void>;
  onCancel?: () => void;
  isCancelDisabled?: boolean;
  isSavingDisabled?: boolean;
  isLoading?: boolean;
}

const ActionPanel = ({
  actionLabel,
  onAction,
  onCancel,
  isCancelDisabled = false,
  isSavingDisabled = false,
  isLoading = false,
}: ActionPanelProps): React.ReactElement => {
  return (
    <div className="rcw-action-panel">
      {isLoading && <LoadingSpinner />}
      <Button disabled={isSavingDisabled || isLoading} styleType="high-visibility" onClick={onAction}>
        {actionLabel}
      </Button>
      {onCancel && (
        <Button styleType="default" type="button" onClick={onCancel} disabled={isCancelDisabled || isLoading}>
          {ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Cancel")}
        </Button>
      )}
    </div>
  );
};

export default ActionPanel;
