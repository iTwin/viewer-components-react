/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { Group } from "@itwin/insights-client";
import { SvgDelete, SvgEdit, SvgInfo, SvgMore } from "@itwin/itwinui-icons-react";
import { DropdownMenu, IconButton, MenuItem } from "@itwin/itwinui-react";
import React, { useCallback } from "react";
import type { ContextCustomUI, GroupingCustomUI } from "../customUI/GroupingMappingCustomUI";
import type { GroupsProps } from "./Groups";
import { useGroupingMappingApiConfig } from "../context/GroupingApiConfigContext";
import "./GroupMenuActions.scss";
import { useGroupHilitedElementsContext } from "../context/GroupHilitedElementsContext";

export interface GroupMenuActionsProps extends Omit<GroupsProps, "onClickAddGroup" | "onClickGroupTitle"> {
  group: Group;
  groupUIs: GroupingCustomUI[];
  contextUIs: ContextCustomUI[];
  setShowDeleteModal: (showDeleteModal: Group) => void;
  setActiveOverlapInfoPanelGroup?: (activeOverlapInfoPanelGroup: Group) => void;
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
  setActiveOverlapInfoPanelGroup,
}: GroupMenuActionsProps) => {
  const { iModelId } = useGroupingMappingApiConfig();
  const { showGroupColor } = useGroupHilitedElementsContext();
  const onModify = useCallback(async (group: Group, type: string) => {
    if (!onClickGroupModify) return;
    onClickGroupModify(group, type);
  }, [onClickGroupModify]);

  const createMenuItems = useCallback((close: () => void) => {
    const menuItems = [
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
    ];

    if (showGroupColor && setActiveOverlapInfoPanelGroup) {
      menuItems.push(
        <MenuItem
          key={3}
          onClick={() => {
            setActiveOverlapInfoPanelGroup(group);
            close();
          }}
          icon={<SvgInfo />}
          data-testid="gmw-overlap-menu-item"
        >
          Overlap Info
        </MenuItem>);
    }

    return menuItems;
  }, [groupUIs, disableActions, group, contextUIs, mapping, iModelId, showGroupColor, onModify, setActiveOverlapInfoPanelGroup, setShowDeleteModal, onClickGroupModify, onClickRenderContextCustomUI]);

  return (
    <div className="gmw-actions">
      {actionButtonRenderers &&
        actionButtonRenderers.map((actionButton, index) =>
          <React.Fragment key={index}>{actionButton({ group })}</React.Fragment>
        )}
      <DropdownMenu
        className="gmw-action-dropdown"
        disabled={disableActions}
        menuItems={createMenuItems}
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
