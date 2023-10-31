/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";

import { Dialog, Icon, Listbox, ListboxItem, ListboxValue, WebFontIcon } from "@itwin/core-react";
import { UiFramework } from "@itwin/appui-react";
import { DialogButtonType } from "@itwin/appui-abstract";
import { Button, LabeledInput } from "@itwin/itwinui-react";
import "./ApiKeySettings.scss";
import { ApiKeyItem } from "../Interfaces";
import { ApiKeysStorage } from "../../ApiKeysStorage";
import { ApiKeyMappingStorage } from "../../ApiKeyMappingStorage";

interface ApiKeyEditDialogProps {
  item?: ApiKeyItem;
  onOkResult?: (params: ApiKeyItem) => void;
  onCancelResult?: () => void;
}
// eslint-disable-next-line @typescript-eslint/naming-convention
export function ApiKeyEditDialog(props: ApiKeyEditDialogProps) {
  const [item, setItem] = React.useState(() => props.item ?? {name: "", key: {key: "", value: ""}});

  const readyToSave = React.useCallback(() => {
    return ((item.name.trim().length > 0) && (item.key.key.trim().length > 0)  && (item.key.value.trim().length > 0)  );
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
        <LabeledInput label="Key Param" value={item.key.key} onChange={(event)=>setItem({...item, key: {key: event.target.value, value: item.key.value}})} />
        <LabeledInput label="Key Value" value={item.key.value} onChange={(event)=>setItem({...item, key: {key: item.key.key , value: event.target.value}})} />
      </>
    </Dialog>
  );
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function ApiKeySettingsPanel() {

  const [storage] = React.useState(() => new ApiKeysStorage());
  const [mappingStorage] = React.useState(() => new ApiKeyMappingStorage());

  const [keys, setKeys] = React.useState<ApiKeyItem[]>(() => storage.get(undefined) ?? []);

  const [listItemUnderCursor, setListItemUnderCursor] = React.useState<string | undefined>();
  const [selectedValue, setSelectedValue] = React.useState<string | undefined>();
  const [uniqueId, setUniqueId] = React.useState(0);

  /*
   Handle Remove layer button clicked
   */
  const onItemRemoveButtonClicked = React.useCallback((name: string, event) => {
    event.stopPropagation();  // We don't want the owning ListBox to react on mouse click.
    const filtered = keys.filter((item) => item.name !== name);
    setKeys(filtered);
    storage.delete(name);

    // Cascade delete to api key mapping
    mappingStorage.deleteMatchingContent({apiKeyName: name});
  }, [keys, mappingStorage, storage]);

  const clearListBoxSelectValue = React.useCallback(() => {
    setSelectedValue(`${uniqueId+1}`); // workaround to display the new added item
    setUniqueId(uniqueId+1);
  }, [uniqueId]);

  const onCancelEdit = React.useCallback(() => {
    UiFramework.dialogs.modal.close();
    clearListBoxSelectValue();
  }, [clearListBoxSelectValue]);

  const onOkEdit = React.useCallback((params: ApiKeyItem) => {

    UiFramework.dialogs.modal.close();

    storage.save(params.name, params);
    setKeys([...keys, params]);
    setSelectedValue(`${uniqueId+1}`); // workaround to display the new added item
    setUniqueId(uniqueId+1);

  }, [keys, storage, uniqueId]);

  const handleAddClick = React.useCallback(() => {
    UiFramework.dialogs.modal.open(
      <ApiKeyEditDialog
        onOkResult={onOkEdit}
        onCancelResult={onCancelEdit}
      />);
    return;
  }, [onCancelEdit, onOkEdit]);

  const onListboxValueChange = React.useCallback((newValue: ListboxValue, _isControlOrCommandPressed?: boolean)=> {
    const item = keys.find((key)=> key.name === newValue);
    if (item)
      UiFramework.dialogs.modal.open(<ApiKeyEditDialog item={item} onOkResult={onOkEdit} onCancelResult={onCancelEdit}/>);

    return;
  }, [keys, onCancelEdit, onOkEdit]);

  return (
    <div className="map-manager-settings-terrain-container">
      {/* <fieldset>
        <legend>API keys</legend> */}
      <div className="apiKeySettings-enterprise-clientIds">
        <div className="apiKeySettings-enterprise-header">
          <b><span className="map-manager-overlays-label">API keys</span></b>
          <button className="apiKeySettings-enterprise-add-clientId-button" onClick={()=> handleAddClick()}>
            <WebFontIcon iconName="icon-add" />
          </button>
        </div>
        <div className="apiKeySettings-clientIds">
          <Listbox
            selectedValue={selectedValue}
            onListboxValueChange={onListboxValueChange}
            className="apiKeySettings-clientIds-list" >
            {
              keys?.map((key) =>
                <ListboxItem
                  key={key.name}
                  className="apiKeySettings-clientIds-entry"
                  value={key.name}
                  onMouseEnter={() => setListItemUnderCursor(key.name)}
                  onMouseLeave={() => setListItemUnderCursor(undefined)}
                >
                  <span className="apiKeySettings-clientIds-entry-name" title={key.name}>{key.name}</span>

                  { // Display the delete icon only when the mouse over a specific item otherwise list feels cluttered.
                    (listItemUnderCursor && listItemUnderCursor === key.name) &&
                  <>
                    <Button
                      className="apiKeySettings-clientIds-entry-button"
                      onClick={(event) => {onItemRemoveButtonClicked(key.name, event);}}>
                      <Icon iconSpec="icon-delete" />
                    </Button>
                  </>}

                </ListboxItem>
              )
            }
          </Listbox>
        </div>
      </div>
      {/* </fieldset> */}
    </div>
  );
}
