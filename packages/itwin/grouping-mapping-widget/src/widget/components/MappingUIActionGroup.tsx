import React from "react";
import {
  DropdownMenu,
  IconButton,
  MenuItem,
} from "@itwin/itwinui-react";
import {
  SvgDelete,
  SvgEdit,
  SvgMore,
  SvgProcess,
} from "@itwin/itwinui-icons-react";
import "./Mapping.scss";
import type { Mapping } from "@itwin/insights-client";

interface MappingUIActionGroupProps {
  mapping: Mapping;
  onToggleExtraction: (mapping: Mapping) => Promise<void>;
  onRefresh: () => Promise<void>;
  onClickMappingModify?: (mapping: Mapping) => void;
  setShowDeleteModal: (mapping?: Mapping) => void;
}

export const MappingUIActionGroup = ({
  mapping,
  onToggleExtraction,
  onRefresh,
  onClickMappingModify,
  setShowDeleteModal,
}: MappingUIActionGroupProps) => {
  return (
    <DropdownMenu
      menuItems={(close: () => void) => [
        onClickMappingModify ? (
          <MenuItem
            key={0}
            onClick={() => {
              onClickMappingModify(mapping);
              close();
            }}
            icon={<SvgEdit />}
          >
            Modify
          </MenuItem>
        ) : [],
        <MenuItem
          key={1}
          onClick={async () => {
            close();
            await onToggleExtraction(mapping);
            await onRefresh();
          }}
          icon={<SvgProcess />}
        >
          {mapping.extractionEnabled ? "Disable extraction" : "Enable extraction"}
        </MenuItem>,
        <MenuItem
          key={2}
          onClick={() => {
            setShowDeleteModal(mapping);
            close();
          }}
          icon={<SvgDelete />}
        >
          Remove
        </MenuItem>,
      ].flatMap((m) => m)}
    >
      <IconButton styleType="borderless" title='Mapping Options'>
        <SvgMore
          style={{
            width: "16px",
            height: "16px",
          }}
        />
      </IconButton>
    </DropdownMenu>
  );
};