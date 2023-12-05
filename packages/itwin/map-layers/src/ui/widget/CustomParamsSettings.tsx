/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { Icon, Listbox, ListboxItem, ListboxValue } from "@itwin/core-react";
import { UiFramework } from "@itwin/appui-react";
import { Button, IconButton } from "@itwin/itwinui-react";
import { CustomParamItem } from "../Interfaces";
import { CustomParamsStorage } from "../../CustomParamsStorage";
import "./CustomParamsSettings.scss";
import { SvgAdd } from "@itwin/itwinui-icons-react";
import { CustomParamEditDialog } from "./CustomParamEditDialog";
import { CustomParamsMappingStorage } from "../../CustomParamsMappingStorage";
import { MapLayersUI } from "../../mapLayers";
interface CustomParamsMap {
  [paramName: string]: CustomParamItem;
}
// eslint-disable-next-line @typescript-eslint/naming-convention
export function CustomParamsSettingsPanel() {

  const [storage] = React.useState(() => new CustomParamsStorage());
  const [mappingStorage] = React.useState(() => new CustomParamsMappingStorage());

  const [params, setParams] = React.useState<CustomParamsMap>(() => {
    const paramsMap: CustomParamsMap ={};
    const paramsList = storage.get(undefined);
    if (paramsList) {
      for (const param of paramsList)
        paramsMap[param.name] = param;
    }
    return paramsMap;
  });

  const [listItemUnderCursor, setListItemUnderCursor] = React.useState<string | undefined>();
  const [selectedValue, setSelectedValue] = React.useState<string | undefined>();

  /*
   Handle Remove layer button clicked
   */
  const onItemRemoveButtonClicked = React.useCallback((name: string, event) => {
    event.stopPropagation();  // We don't want the owning ListBox to react on mouse click.

    const tmpParams = {...params};
    delete tmpParams[name];
    setParams(tmpParams);
    storage.delete(name);

    // Cascade delete to api key mapping
    const mappingContent = mappingStorage.getContent();
    if (mappingContent) {
      for (const itemKey of Object.keys(mappingContent)) {
        if (mappingContent[itemKey].customParamNames.includes(name)) {
          const newParamNames = mappingContent[itemKey].customParamNames.filter((value) => value !== name);
          newParamNames.length > 0 ?  mappingStorage.save(itemKey, {customParamNames: newParamNames}) : mappingStorage.delete(itemKey);
        }
      }
    }
  }, [mappingStorage, params, storage]);

  const onCancelEdit = React.useCallback(() => {
    UiFramework.dialogs.modal.close();
    setSelectedValue(undefined); // clear listbox focus
  }, []);

  const onOkEdit = React.useCallback((param: CustomParamItem) => {

    UiFramework.dialogs.modal.close();

    storage.save(param.name, param);

    const tmpParams = {...params};
    tmpParams[param.name] = param;
    setParams(tmpParams);
    setSelectedValue(undefined); // clear listbox focus
  }, [params, storage]);

  const handleAddClick = React.useCallback(() => {
    UiFramework.dialogs.modal.open(
      <CustomParamEditDialog
        onOkResult={onOkEdit}
        onCancelResult={onCancelEdit}
      />);
    return;
  }, [onCancelEdit, onOkEdit]);

  const onListboxValueChange = React.useCallback((newValue: ListboxValue, _isControlOrCommandPressed?: boolean)=> {
    const item = params[newValue];
    if (item)
      UiFramework.dialogs.modal.open(<CustomParamEditDialog item={item} onOkResult={onOkEdit} onCancelResult={onCancelEdit}/>);

    setSelectedValue(newValue);
    return;
  }, [params, onCancelEdit, onOkEdit]);

  return (
    <div className="customParamsSettings-container">
      <div className="customParamsSettings-header">
        <span className="customParamsSettings-header-label">{MapLayersUI.translate("CustomParamSettings.SectionLabel")}</span>
        <IconButton size="small" styleType="borderless" className="customParamsSettings-header-add-button" onClick={handleAddClick}>
          <SvgAdd/>
        </IconButton>
      </div>
      <div className="customParamsSettings-content">
        <Listbox
          selectedValue={selectedValue}
          onListboxValueChange={onListboxValueChange}
          className="customParamsSettings-content-listbox" >
          {
            Object.keys(params).map((keyName) =>
              <ListboxItem
                key={keyName}
                className="customParamsSettings-content-entry"
                value={keyName}
                onMouseEnter={() => setListItemUnderCursor(keyName)}
                onMouseLeave={() => setListItemUnderCursor(undefined)}
              >
                <span className="customParamsSettings-content-entry-name" title={keyName}>{keyName}</span>
                { // Display the delete icon only when the mouse over a specific item otherwise list feels cluttered.
                  (listItemUnderCursor && listItemUnderCursor === keyName) &&
                  <>
                    <Button
                      size="small"
                      styleType="borderless"
                      className="customParamsSettings-content-entry-button"
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
