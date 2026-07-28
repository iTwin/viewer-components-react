/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { DropdownMenu, IconButton, MenuItem } from "@itwin/itwinui-react";
import { SvgDelete, SvgEdit, SvgMore, SvgProcess } from "@itwin/itwinui-icons-react";
import type { Mapping } from "@itwin/insights-client";
import { GroupingMappingWidget } from "../../GroupingMappingWidget";

interface MappingUIActionGroupProps {
  mapping: Mapping;
  onToggleExtraction: (mapping: Mapping) => Promise<void>;
  onRefresh: () => Promise<void>;
  onClickMappingModify?: (mapping: Mapping) => void;
  setShowDeleteModal: (mapping?: Mapping) => void;
}

export const MappingViewActionGroup = ({ mapping, onToggleExtraction, onClickMappingModify, setShowDeleteModal }: MappingUIActionGroupProps) => {
  return (
    <DropdownMenu
      menuItems={(close: () => void) =>
        [
          onClickMappingModify ? (
            <MenuItem
              key={0}
              onClick={() => {
                onClickMappingModify(mapping);
                close();
              }}
              icon={<SvgEdit />}
            >
              {GroupingMappingWidget.translate("common.modify")}
            </MenuItem>
          ) : (
            []
          ),
          <MenuItem
            key={1}
            onClick={async () => {
              close();
              await onToggleExtraction(mapping);
            }}
            icon={<SvgProcess />}
          >
            {mapping.extractionEnabled ? GroupingMappingWidget.translate("mappings.disableExtraction") : GroupingMappingWidget.translate("mappings.enableExtraction")}
          </MenuItem>,
          <MenuItem
            key={2}
            onClick={() => {
              setShowDeleteModal(mapping);
              close();
            }}
            icon={<SvgDelete />}
          >
            {GroupingMappingWidget.translate("common.remove")}
          </MenuItem>,
        ].flat()
      }
    >
      <IconButton styleType="borderless" title={GroupingMappingWidget.translate("mappings.mappingOptions")}>
        <SvgMore />
      </IconButton>
    </DropdownMenu>
  );
};
