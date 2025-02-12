/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./CustomParamsSettings.scss";
import * as React from "react";
import { UiFramework } from "@itwin/appui-react";
import { SvgTechnicalPreviewMini } from "@itwin/itwinui-icons-color-react";
import { SvgAdd, SvgDelete, SvgEdit } from "@itwin/itwinui-icons-react";
import { Icon, IconButton, List, ListItem } from "@itwin/itwinui-react";
import { CustomParamsMappingStorage } from "../../CustomParamsMappingStorage";
import { CustomParamsStorage } from "../../CustomParamsStorage";
import { MapLayersUI } from "../../mapLayers";
import { CustomParamEditDialog } from "./CustomParamEditDialog";

import type { CustomParamItem } from "../Interfaces";
interface CustomParamsMap {
  [paramName: string]: CustomParamItem;
}

interface CustomParamsSettingsPanelProps {
  onHandleOutsideClick?: (shouldHandle: boolean) => void;
}
export function CustomParamsSettingsPanel({ onHandleOutsideClick }: CustomParamsSettingsPanelProps) {
  const [storage] = React.useState(() => new CustomParamsStorage());
  const [mappingStorage] = React.useState(() => new CustomParamsMappingStorage());

  const [params, setParams] = React.useState<CustomParamsMap>(() => {
    const paramsMap: CustomParamsMap = {};
    const paramsList = storage.get(undefined);
    if (Array.isArray(paramsList)) {
      for (const param of paramsList) {
        paramsMap[param.name] = param;
      }
    }
    return paramsMap;
  });

  const [listItemUnderCursor, setListItemUnderCursor] = React.useState<string | undefined>();

  const deleteMapping = React.useCallback(
    (name: string) => {
      const tmpParams = { ...params };
      delete tmpParams[name];
      setParams(tmpParams);
      storage.delete(name);

      // Cascade delete to api key mapping
      const mappingContent = mappingStorage.getContent();
      if (mappingContent) {
        for (const itemKey of Object.keys(mappingContent)) {
          if (mappingContent[itemKey].customParamNames.includes(name)) {
            const newParamNames = mappingContent[itemKey].customParamNames.filter((value) => value !== name);
            newParamNames.length > 0 ? mappingStorage.save(itemKey, { customParamNames: newParamNames }) : mappingStorage.delete(itemKey);
          }
        }
      }
    },
    [mappingStorage, params, storage],
  );

  const resumeOutsideClick = React.useCallback(() => {
    if (onHandleOutsideClick) {
      onHandleOutsideClick(true);
    }
  }, [onHandleOutsideClick]);
  /*
   Handle Remove layer button clicked
   */
  const onItemRemoveButtonClicked = React.useCallback(
    (name: string, event: React.MouseEvent) => {
      event.stopPropagation(); // We don't want the owning ListBox to react on mouse click.
      deleteMapping(name);
      if (onHandleOutsideClick) {
        onHandleOutsideClick(false);
      };
    },
    [deleteMapping, onHandleOutsideClick],
  );

  const onCancelEdit = React.useCallback(() => {
    UiFramework.dialogs.modal.close();
    resumeOutsideClick();
  }, [resumeOutsideClick]);

  const onOkEdit = React.useCallback(
    (newItem: CustomParamItem, oldItem?: CustomParamItem) => {
      UiFramework.dialogs.modal.close();

      // If the edited item has a new name, delete the entry first.
      const tmpParams = { ...params };
      if (oldItem && oldItem.name !== newItem.name) {
        delete tmpParams[oldItem.name];
        setParams(tmpParams);
        storage.delete(oldItem.name);

        const mappingContent = mappingStorage.getContent();
        if (mappingContent) {
          for (const itemKey of Object.keys(mappingContent)) {
            if (mappingContent[itemKey].customParamNames.includes(oldItem.name)) {
              const newParamNames = mappingContent[itemKey].customParamNames.filter((value) => value !== oldItem.name);
              newParamNames.push(newItem.name);
              mappingStorage.save(itemKey, { customParamNames: newParamNames });
            }
          }
        }
      }
      storage.save(newItem.name, newItem);

      tmpParams[newItem.name] = newItem;
      if (onHandleOutsideClick) {
        onHandleOutsideClick(false);
      };
      setParams(tmpParams);
    },
    [mappingStorage, params, storage, onHandleOutsideClick],
  );

  const handleAddClick = React.useCallback(() => {
    if (onHandleOutsideClick) {
      onHandleOutsideClick(false);
    }
    UiFramework.dialogs.modal.open(<CustomParamEditDialog onOkResult={onOkEdit} onCancelResult={onCancelEdit} />);

    return;
  }, [onCancelEdit, onOkEdit, onHandleOutsideClick]);

  const onListboxValueChange = React.useCallback(
    (newValue: string, event: React.MouseEvent) => {
      event.stopPropagation();;
      const item = params[newValue];
      if (item) {
        UiFramework.dialogs.modal.open(<CustomParamEditDialog item={item} onOkResult={onOkEdit} onCancelResult={onCancelEdit} />);
      }
      if (onHandleOutsideClick) {
        onHandleOutsideClick(false);
      }
      return;
    },
    [params, onCancelEdit, onOkEdit, onHandleOutsideClick],
  );

  return (
    <div className="customParamsSettings-container">
      <div className="customParamsSettings-header">
        <span className="customParamsSettings-header-label">
          {MapLayersUI.translate("CustomParamSettings.SectionLabel")}
          <div title={MapLayersUI.translate("Labels.TechPreviewBadgeTooltip")} className="customParamsSettings-previewBadge">
            <Icon size="small">
              <SvgTechnicalPreviewMini />
            </Icon>
          </div>
        </span>

        <IconButton label="Add" size="small" styleType="borderless" className="customParamsSettings-header-add-button" onClick={handleAddClick}>
          <SvgAdd />
        </IconButton>
      </div>
      <div className="customParamsSettings-content">
        <List as="div" className="customParamsSettings-content-listbox">
          {Object.keys(params).map((keyName) => (
            <ListItem
              as="div"
              key={keyName}
              actionable
              className="customParamsSettings-content-entry"
              onClick={(e: React.MouseEvent) => onListboxValueChange(keyName, e)}
              onMouseEnter={() => setListItemUnderCursor(keyName)}
              onMouseLeave={() => setListItemUnderCursor(undefined)}
            >
              <ListItem.Content className="customParamsSettings-content-entry-name">
                {keyName}
              </ListItem.Content>
              {
                // Display the delete icon only when the mouse over a specific item otherwise list feels cluttered.
                listItemUnderCursor && listItemUnderCursor === keyName && (
                  <>
                    <IconButton
                      size="small"
                      styleType="borderless"
                      className="map-source-list-entry-button"
                      label={MapLayersUI.translate("CustomParamSettings.EditButtonTitle")}
                    >
                      <SvgEdit />
                    </IconButton>
                    <IconButton
                      size="small"
                      styleType="borderless"
                      className="customParamsSettings-content-entry-button"
                      label={MapLayersUI.translate("CustomParamSettings.DeleteButtonTitle")}
                      onClick={(event) => {
                        onItemRemoveButtonClicked(keyName, event);
                      }}
                    >
                      <SvgDelete />
                    </IconButton>
                  </>
                )
              }
            </ListItem>
          ))}
        </List>
      </div>
    </div>
  );
}
