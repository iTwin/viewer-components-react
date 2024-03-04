/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./CustomParamEditDialog.scss";
import * as React from "react";
import { UiFramework } from "@itwin/appui-react";
import { Dialog } from "@itwin/core-react";
import { Button, LabeledInput, ToggleSwitch } from "@itwin/itwinui-react";
import { CustomParamsStorage } from "../../CustomParamsStorage";
import { MapLayersUI } from "../../mapLayers";
import { CustomParamItem } from "../Interfaces";

interface CustomParamEditDialogProps {
  item?: CustomParamItem;
  onOkResult?: (newItem: CustomParamItem, oldIem?: CustomParamItem) => void;
  onCancelResult?: () => void
  ;
}
// eslint-disable-next-line @typescript-eslint/naming-convention
export function CustomParamEditDialog(props: CustomParamEditDialogProps) {
  const [originalItemName] = React.useState<string|undefined>(() => props.item ? props.item.name : undefined);
  const [item, setItem] = React.useState<CustomParamItem>(() => props.item ?? {name: "", key: "", value: "", secret: true});
  const [cpStorage] = React.useState(() => new CustomParamsStorage());

  const handleCancel = React.useCallback(() => {
    if (props.onCancelResult) {
      props.onCancelResult();
      return;
    }
    UiFramework.dialogs.modal.close();
  }, [props]);

  const handleOk = React.useCallback(() => {
    if (props.onOkResult) {
      props.onOkResult(item, props.item);
      return;
    }
    UiFramework.dialogs.modal.close();
  }, [item, props]);

  const nameAlreadyExists = React.useMemo<boolean>(() => {
    const itemExistInStorage = () => item.name ? !!cpStorage.get(item.name) : false;
    return originalItemName ? originalItemName !== item.name && itemExistInStorage() : itemExistInStorage();
  }, [cpStorage, item.name, originalItemName]);

  const readyToSave = React.useCallback(() => {
    return ((item.name.trim().length > 0) && (item.key.trim().length > 0)  && (item.value.trim().length > 0) && !nameAlreadyExists  );
  }, [item.key, item.name, item.value, nameAlreadyExists]);

  function renderFooter() {

    return (
      <div className="custom-param-edit-dialog-footer">
        <div className="custom-param-edit-dialog-footer-buttons">
          <Button
            className="custom-param-edit-dialog-footer-button"
            styleType='high-visibility'
            onClick={handleOk}
            disabled={!readyToSave()}
          >
            {props.item ? MapLayersUI.translate("Dialog.Edit") : MapLayersUI.translate("Dialog.Add")}
          </Button>
          <Button
            className="custom-param-edit-dialog-footer-button"
            styleType='default'
            onClick={handleCancel}
          >
            {MapLayersUI.translate("Dialog.Cancel")}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <Dialog
      title={MapLayersUI.translate(props.item ? "CustomParamEditDialog.DialogTitleEdit": "CustomParamEditDialog.DialogTitleAdd")}
      opened={true}
      resizable={true}
      movable={true}
      modal={true}
      onClose={handleCancel}
      onEscape={handleCancel}
      minHeight={120}
      maxWidth={120}
      trapFocus={false}
    >
      <>
        <LabeledInput className="custom-param-edit-dialog-input" label={MapLayersUI.translate("CustomParamEditDialog.ParamNameLabel")} value={item.name} onChange={(event)=>setItem({...item, name: event.target.value})} status={nameAlreadyExists ? "warning" : undefined} message={nameAlreadyExists ? MapLayersUI.translate("CustomParamEditDialog.NameExists"): undefined}/>
        <LabeledInput className="custom-param-edit-dialog-input" label={MapLayersUI.translate("CustomParamEditDialog.ParamKeyLabel")} value={item.key} onChange={(event)=>setItem({...item, key: event.target.value})}  />
        <LabeledInput className="custom-param-edit-dialog-input"label={MapLayersUI.translate("CustomParamEditDialog.ParamValueLabel")} type={item.secret ? "password" : ""} value={item.value} onChange={(event)=>setItem({...item, value: event.target.value}) } message={!item.secret ? MapLayersUI.translate("CustomParamEditDialog.ParamValueNonPrivateMessage"): undefined}/>
        <div className="custom-param-edit-dialog-secret custom-param-edit-dialog-input" title={MapLayersUI.translate("CustomParamEditDialog.PrivateToggleTooltip")}>
          <ToggleSwitch checked={item.secret} label={MapLayersUI.translate("CustomParamEditDialog.PrivateToggleLabel")} onChange={(event)=>setItem({...item, secret: event.target.checked})} />
        </div>
        {renderFooter()}
      </>
    </Dialog>
  );
}
