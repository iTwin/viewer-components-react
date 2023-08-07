/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { Group } from "@itwin/insights-client";
import { SvgDelete, SvgEdit, SvgMore } from "@itwin/itwinui-icons-react";
import { DropdownMenu, IconButton, MenuItem } from "@itwin/itwinui-react";
import React, { useCallback } from "react";
import type { ContextCustomUI, GroupingCustomUI } from "./customUI/GroupingMappingCustomUI";
import type { GroupingProps } from "./Grouping";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import "./GroupMenuActions.scss";

export interface GroupMenuActionsProps extends Omit<GroupingProps, "onClickAddGroup" | "onClickGroupTitle"> {
  group: Group;
  groupUIs: GroupingCustomUI[];
  contextUIs: ContextCustomUI[];
  setShowDeleteModal: (showDeleteModal: Group) => void;
}

export const GroupMenuActions = ({
  mapping,
  group,
  actionButtonRenderers,
  onClickGroupModify,
  onClickRenderContextCustomUI,
  groupUIs,
  contextUIs,
  disableActions,
  setShowDeleteModal,
}: GroupMenuActionsProps) => {
  const { iModelId } = useGroupingMappingApiConfig();

  const onModify = useCallback(async (group: Group, type: string) => {
    if (!onClickGroupModify) return;
    onClickGroupModify(group, type);
  }, [onClickGroupModify]);

  return (
    <div className="gmw-actions">
      {actionButtonRenderers &&
        actionButtonRenderers.map((actionButton, index) =>
          <React.Fragment key={index}>{actionButton({ group })}</React.Fragment>
        )}
      <DropdownMenu
        className="gmw-action-dropdown"
        disabled={disableActions}
        menuItems={(close: () => void) => [
          ...(groupUIs.length > 0 && onClickGroupModify
            ? [
              <MenuItem
                key={0}
                icon={<SvgEdit />}
                disabled={disableActions}
                data-testid="gmw-context-menu-item"
                subMenuItems={groupUIs.map((p, index) => (
                  <MenuItem
                    key={p.name}
                    className="gmw-menu-item"
                    data-testid={`gmw-edit-${index}`}
                    onClick={async () => {
                      await onModify(group, p.name);
                      close();
                    }}
                    icon={p.icon}
                  >
                    {p.displayLabel}
                  </MenuItem>
                ))}
              >
                Edit
              </MenuItem>,
            ]
            : []),
          ...contextUIs.map((p) => {
            return (
              <MenuItem
                key={p.name}
                onClick={async () => {
                  if (
                    p.uiComponent &&
                    onClickRenderContextCustomUI
                  ) {
                    onClickRenderContextCustomUI(
                      p.uiComponent,
                      group,
                      p.displayLabel
                    );
                  }
                  if (p.onClick) {
                    p.onClick(group, mapping, iModelId);
                  }
                  close();
                }}
                icon={p.icon}
                data-testid="gmw-context-menu-item"
              >
                {p.displayLabel}
              </MenuItem>
            );
          }),
          <MenuItem
            key={2}
            onClick={() => {
              setShowDeleteModal(group);
              close();
            }}
            icon={<SvgDelete />}
            data-testid="gmw-context-menu-item"
          >
            Remove
          </MenuItem>,
        ]}
      >
        <IconButton
          disabled={disableActions}
          styleType="borderless"
          data-testid="gmw-more-button"
          title='Group Options'
        >
          <SvgMore />
        </IconButton>
      </DropdownMenu>
    </div>
  );
};
