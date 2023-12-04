/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { Dialog } from "@itwin/core-react";
import { UiFramework } from "@itwin/appui-react";
import { DialogButtonType } from "@itwin/appui-abstract";
import { LabeledInput, ToggleSwitch } from "@itwin/itwinui-react";
import { CustomParamItem } from "../Interfaces";

interface CustomParamEditDialogProps {
  item?: CustomParamItem;
  onOkResult?: (params: CustomParamItem) => void;
  onCancelResult?: () => void;
}
// eslint-disable-next-line @typescript-eslint/naming-convention
export function CustomParamEditDialog(props: CustomParamEditDialogProps) {
  const [item, setItem] = React.useState<CustomParamItem>(() => props.item ?? {name: "", key: "", value: "", secret: false});

  const readyToSave = React.useCallback(() => {
    return ((item.name.trim().length > 0) && (item.key.trim().length > 0)  && (item.value.trim().length > 0)  );
  }, [item]);

  const handleCancel = React.useCallback(() => {
    if (props.onCancelResult) {
      props.onCancelResult();
      return;
    }
    UiFramework.dialogs.modal.close();
  }, [props]);

  const handleOk = React.useCallback(() => {
    if (props.onOkResult) {
      props.onOkResult(item);
      return;
    }
    UiFramework.dialogs.modal.close();
  }, [item, props]);

  const buttonCluster = React.useMemo(() => [
    { type: DialogButtonType.OK, onClick: handleOk, disabled: !readyToSave() },
    { type: DialogButtonType.Cancel, onClick: handleCancel },
  ], [readyToSave, handleCancel, handleOk]);

  return (
    <Dialog
      title="Edit API key"
      opened={true}
      resizable={true}
      movable={true}
      modal={true}
      buttonCluster={buttonCluster}
      onClose={handleCancel}
      onEscape={handleCancel}
      minHeight={120}
      maxWidth={120}
      trapFocus={false}
    >
      <>
        <LabeledInput label="Name" value={item.name} onChange={(event)=>setItem({...item, name: event.target.value})} />
        <LabeledInput label="Key" value={item.key} onChange={(event)=>setItem({...item, key: event.target.value})} />
        <LabeledInput label="Value" value={item.value} onChange={(event)=>setItem({...item, value: event.target.value})} />
        <span className="map-manager-settings-label">Private</span>
        <ToggleSwitch checked={item.secret}  onChange={(event)=>setItem({...item, secret: event.target.checked})} />
      </>
    </Dialog>
  );
}
