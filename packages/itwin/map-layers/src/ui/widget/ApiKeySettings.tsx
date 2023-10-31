/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { Dialog, Icon, Listbox, ListboxItem, ListboxValue, WebFontIcon } from "@itwin/core-react";
import { UiFramework } from "@itwin/appui-react";
import { DialogButtonType } from "@itwin/appui-abstract";
import { Button, IconButton, LabeledInput } from "@itwin/itwinui-react";
import { ApiKeyItem } from "../Interfaces";
import { ApiKeysStorage } from "../../ApiKeysStorage";
import { ApiKeyMappingStorage } from "../../ApiKeyMappingStorage";
import "./ApiKeySettings.scss";
import { SvgAdd } from "@itwin/itwinui-icons-react";

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
interface ApiKeyMap {
  [key: string]: ApiKeyItem;
}
// eslint-disable-next-line @typescript-eslint/naming-convention
export function ApiKeySettingsPanel() {

  const [storage] = React.useState(() => new ApiKeysStorage());
  const [mappingStorage] = React.useState(() => new ApiKeyMappingStorage());

  const [keys, setKeys] = React.useState<ApiKeyMap>(() => {
    const keyMap: ApiKeyMap ={};
    const keyList = storage.get(undefined);
    if (keyList) {
      for (const key of keyList)
        keyMap[key.name] = key;
    }
    return keyMap;
  });

  const [listItemUnderCursor, setListItemUnderCursor] = React.useState<string | undefined>();
  const [selectedValue, setSelectedValue] = React.useState<string | undefined>();

  /*
   Handle Remove layer button clicked
   */
  const onItemRemoveButtonClicked = React.useCallback((name: string, event) => {
    event.stopPropagation();  // We don't want the owning ListBox to react on mouse click.

    const tmpKeys = {...keys};
    delete tmpKeys[name];
    setKeys(tmpKeys);
    storage.delete(name);

    // Cascade delete to api key mapping
    mappingStorage.deleteMatchingContent({apiKeyName: name});
  }, [keys, mappingStorage, storage]);

  const onCancelEdit = React.useCallback(() => {
    UiFramework.dialogs.modal.close();
    setSelectedValue(undefined); // clear listbox focus
  }, []);

  const onOkEdit = React.useCallback((params: ApiKeyItem) => {

    UiFramework.dialogs.modal.close();

    storage.save(params.name, params);

    const tmpKeys = {...keys};
    tmpKeys[params.name] = params;
    setKeys(tmpKeys);
    setSelectedValue(undefined); // clear listbox focus
  }, [keys, storage]);

  const handleAddClick = React.useCallback(() => {
    UiFramework.dialogs.modal.open(
      <ApiKeyEditDialog
        onOkResult={onOkEdit}
        onCancelResult={onCancelEdit}
      />);
    return;
  }, [onCancelEdit, onOkEdit]);

  const onListboxValueChange = React.useCallback((newValue: ListboxValue, _isControlOrCommandPressed?: boolean)=> {
    const item = keys[newValue];
    if (item)
      UiFramework.dialogs.modal.open(<ApiKeyEditDialog item={item} onOkResult={onOkEdit} onCancelResult={onCancelEdit}/>);

    setSelectedValue(newValue);
    return;
  }, [keys, onCancelEdit, onOkEdit]);

  return (
    <div className="apiKeySettings-container">
      <div className="apiKeySettings-header">
        <span className="apiKeySettings-header-label">API keys</span>
        <IconButton size="small" styleType="borderless" className="apiKeySettings-header-add-button" onClick={handleAddClick}>
          <SvgAdd/>
        </IconButton>

      </div>
      <div className="apiKeySettings-content">
        <Listbox
          selectedValue={selectedValue}
          onListboxValueChange={onListboxValueChange}
          className="apiKeySettings-content-listbox" >
          {
            Object.keys(keys).map((keyName) =>
              <ListboxItem
                key={keyName}
                className="apiKeySettings-content-entry"
                value={keyName}
                onMouseEnter={() => setListItemUnderCursor(keyName)}
                onMouseLeave={() => setListItemUnderCursor(undefined)}
              >
                <span className="apiKeySettings-content-entry-name" title={keyName}>{keyName}</span>

                { // Display the delete icon only when the mouse over a specific item otherwise list feels cluttered.
                  (listItemUnderCursor && listItemUnderCursor === keyName) &&
                  <>
                    <Button
                      size="small"
                      styleType="borderless"
                      className="apiKeySettings-content-entry-button"
                      onClick={(event) => {onItemRemoveButtonClicked(keyName, event);}}>
                      <Icon iconSpec="icon-delete" />
                    </Button>
                  </>}
              </ListboxItem>
            )
          }
        </Listbox>
      </div>
    </div>
  );
}
