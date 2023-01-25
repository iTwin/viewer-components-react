/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useActiveIModelConnection } from "@itwin/appui-react";
import React, { useCallback, useEffect, useState } from "react";
import type { CreateTypeFromInterface } from "../utils";
import {
  Button,
  ButtonGroup,
  DropdownMenu,
  IconButton,
  MenuItem,
  ProgressRadial,
  Surface,
  ToggleSwitch,
} from "@itwin/itwinui-react";
import {
  SvgAdd,
  SvgDelete,
  SvgEdit,
  SvgMore,
  SvgRefresh,
  SvgVisibilityHide,
  SvgVisibilityShow,
} from "@itwin/itwinui-icons-react";
import DeleteModal from "./DeleteModal";
import "./Grouping.scss";
import {
  clearEmphasizedElements,
  clearEmphasizedOverriddenElements,
  clearHiddenElements,
  hideElements,
  zoomToElements,
} from "./viewerUtils";
import {
  EmptyMessage,
  handleError,
  LoadingOverlay,
} from "./utils";
import type { Group, IMappingsClient, Mapping } from "@itwin/insights-client";
import { useMappingClient } from "./context/MappingClientContext";
import { HorizontalTile } from "./HorizontalTile";
import type { GetAccessTokenFn } from "./context/GroupingApiConfigContext";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import { useGroupingMappingCustomUI } from "./context/GroupingMappingCustomUIContext";
import { GroupingMappingCustomUIType } from "./customUI/groupingMappingCustomUI";
import type { ContextCustomUI, GroupingCustomUI } from "./customUI/groupingMappingCustomUI";
import { useGroupHilitedElementsContext } from "./context/GroupHilitedElementsContext";
import { getGroupColor, getHiliteIdsFromGroups, hideGroups, visualizeGroupColors } from "./groupsHelpers";

export type IGroupTyped = CreateTypeFromInterface<Group>;

export interface GroupingProps {
  mapping: Mapping;
  onClickAddGroup?: (queryGenerationType: string) => void;
  onClickGroupTitle?: (group: Group) => void;
  onClickGroupModify?: (group: Group, queryGenerationType: string) => void;
  onClickRenderContextCustomUI?: (contextCustomUI: Exclude<ContextCustomUI["uiComponent"], undefined>, group: Group) => void;
  emphasizeElements?: boolean;
}

const fetchGroups = async (
  setGroups: React.Dispatch<React.SetStateAction<IGroupTyped[]>>,
  iModelId: string,
  mappingId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  getAccessToken: GetAccessTokenFn,
  mappingsClient: IMappingsClient,
): Promise<void> => {
  try {
    setIsLoading(true);
    const accessToken = await getAccessToken();
    const groups = await mappingsClient.getGroups(
      accessToken,
      iModelId,
      mappingId,
    );
    setGroups(groups);
  } catch (error: any) {
    handleError(error.status);
  } finally {
    setIsLoading(false);
  }
};

export const Groupings = ({
  mapping,
  onClickAddGroup,
  onClickGroupTitle,
  onClickGroupModify,
  onClickRenderContextCustomUI,
  emphasizeElements = true,
}: GroupingProps) => {
  const iModelConnection = useActiveIModelConnection();
  const { getAccessToken, iModelId } = useGroupingMappingApiConfig();
  const { showGroupColor, setShowGroupColor, hiddenGroupsIds, setHiddenGroupsIds, hilitedElementsQueryCache, groups, setGroups } = useGroupHilitedElementsContext();
  const mappingClient = useMappingClient();
  const groupUIs: GroupingCustomUI[] = useGroupingMappingCustomUI().customUIs
    .filter((p) => p.type === GroupingMappingCustomUIType.Grouping) as GroupingCustomUI[];
  const contextUIs: ContextCustomUI[] = useGroupingMappingCustomUI().customUIs
    .filter((p) => p.type === GroupingMappingCustomUIType.Context) as ContextCustomUI[];

  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedGroup, setSelectedGroup] = useState<Group | undefined>(
    undefined,
  );
  const [isLoadingQuery, setLoadingQuery] = useState<boolean>(false);

  const getHiliteIdsFromGroupsWrapper = useCallback(
    async (groups: Group[]): Promise<string[]> =>
      iModelConnection
        ? getHiliteIdsFromGroups(
          iModelConnection,
          groups,
          hilitedElementsQueryCache
        )
        : [],
    [iModelConnection, hilitedElementsQueryCache]
  );

  const visualizeGroupColorsWrapper = useCallback(
    async (viewGroups: Group[]) => {
      if (!iModelConnection) return;
      setLoadingQuery(true);
      await visualizeGroupColors(iModelConnection, groups, viewGroups, hiddenGroupsIds, hilitedElementsQueryCache, emphasizeElements);
      setLoadingQuery(false);
    },
    [iModelConnection, groups, hiddenGroupsIds, hilitedElementsQueryCache, emphasizeElements],
  );

  useEffect(() => {
    const initialize = async () => {
      await fetchGroups(
        setGroups,
        iModelId,
        mapping.id,
        setIsLoading,
        getAccessToken,
        mappingClient,
      );
    };
    void initialize();
  }, [getAccessToken, mappingClient, iModelId, mapping.id, setGroups]);

  useEffect(() => {
    const visualize = async () => {
      if (groups && showGroupColor) {
        await visualizeGroupColorsWrapper(groups);
      } else {
        clearEmphasizedOverriddenElements();
      }
    };
    void visualize();
  }, [groups, showGroupColor, visualizeGroupColorsWrapper]);

  const hideGroupsWrapper = useCallback(
    async (viewGroups: Group[]) => {
      if (!iModelConnection) return;
      setLoadingQuery(true);
      await hideGroups(iModelConnection, viewGroups, hilitedElementsQueryCache);
      setLoadingQuery(false);
    },
    [hilitedElementsQueryCache, iModelConnection],
  );

  const showGroup = useCallback(
    async (viewGroup: Group) => {
      clearHiddenElements();

      // hide group Ids filter
      const newHiddenGroups: Group[] = hiddenGroupsIds
        .map((id) => groups.find((g) => g.id === id))
        .filter((g): g is Group => !!g && g.id !== viewGroup.id);

      // view group Ids filter
      const viewIds = await getHiliteIdsFromGroupsWrapper(
        groups.filter((g) => !newHiddenGroups.find((hg) => hg.id === g.id)),
      );
      let hiddenIds = await getHiliteIdsFromGroupsWrapper(newHiddenGroups);
      hiddenIds = hiddenIds.filter((id) => !viewIds.includes(id));
      hideElements(hiddenIds);
    },
    [groups, hiddenGroupsIds, getHiliteIdsFromGroupsWrapper],
  );

  const addGroup = (type: string) => {
    if (!onClickAddGroup) return;
    onClickAddGroup(type);
    clearEmphasizedElements();
  };

  const onModify = async (group: Group, type: string) => {
    if (!onClickGroupModify) return;
    if (group.id && hiddenGroupsIds.includes(group.id)) {
      await showGroup(group);
      setHiddenGroupsIds(hiddenGroupsIds.filter((id) => id !== group.id));
    }
    clearEmphasizedElements();
    onClickGroupModify(group, type);
  };

  const colorGroup = async (group: Group) => {
    if (showGroupColor && hiddenGroupsIds.includes(group.id)) {
      await showGroup(group);
      setHiddenGroupsIds(hiddenGroupsIds.filter((id) => id !== group.id));
    }

  };

  const refresh = useCallback(async () => {
    setSelectedGroup(undefined);
    setGroups([]);
    await fetchGroups(
      setGroups,
      iModelId,
      mapping.id,
      setIsLoading,
      getAccessToken,
      mappingClient,
    );
  }, [getAccessToken, mappingClient, iModelId, mapping.id, setGroups]);

  const showAll = async () => {
    setLoadingQuery(true);

    clearHiddenElements();
    setHiddenGroupsIds([]);
    const allIds = await getHiliteIdsFromGroupsWrapper(groups);
    await zoomToElements(allIds);

    setLoadingQuery(false);
  };

  const hideAll = useCallback(async () => {
    await hideGroupsWrapper(groups);
    setHiddenGroupsIds(
      groups.map((g) => g.id).filter((id): id is string => !!id),
    );
    const allIds = await getHiliteIdsFromGroupsWrapper(groups);
    await zoomToElements(allIds);
  }, [setHiddenGroupsIds, groups, hideGroupsWrapper, getHiliteIdsFromGroupsWrapper]);

  const toggleGroupColor = useCallback(
    async (e: any) => {
      if (e.target.checked) {
        await visualizeGroupColorsWrapper(groups);
        setShowGroupColor(true);
      } else {
        clearEmphasizedOverriddenElements();
        setShowGroupColor(false);
      }
    },
    [groups, visualizeGroupColorsWrapper, setShowGroupColor],
  );

  return (
    <>
      <Surface className='gmw-groups-container'>
        <div className='gmw-toolbar'>
          {onClickAddGroup && groupUIs.length > 0 &&
            <DropdownMenu
              className='gmw-custom-ui-dropdown'
              disabled={isLoadingQuery}
              menuItems={() =>
                groupUIs.map((p, index) => (
                  <MenuItem
                    key={index}
                    onClick={() => addGroup(p.name)}
                    icon={p.icon}
                    className='gmw-menu-item'
                    data-testid={`gmw-add-${index}`}
                  >
                    {p.displayLabel}
                  </MenuItem>
                ))
              }
            >
              <Button
                data-testid="gmw-add-group-button"
                className='add-load-button'
                startIcon={
                  isLoadingQuery ? (
                    <ProgressRadial size='small' indeterminate />
                  ) : (
                    <SvgAdd />
                  )
                }
                styleType='high-visibility'
                disabled={isLoadingQuery}
              >
                {isLoadingQuery ? "Loading" : "Add Group"}
              </Button>
            </DropdownMenu>}
          {iModelConnection &&
            <ButtonGroup className='gmw-toolbar-buttons'>
              <ToggleSwitch
                label='Color by Group'
                labelPosition='left'
                className='gmw-toggle'
                disabled={isLoadingQuery}
                checked={showGroupColor}
                onChange={toggleGroupColor}
              ></ToggleSwitch>
              <IconButton
                title='Show All'
                onClick={showAll}
                disabled={isLoadingQuery}
                styleType='borderless'
                className='gmw-group-view-icon'
              >
                <SvgVisibilityShow />
              </IconButton>
              <IconButton
                title='Hide All'
                onClick={hideAll}
                disabled={isLoadingQuery}
                styleType='borderless'
                className='gmw-group-view-icon'
              >
                <SvgVisibilityHide />
              </IconButton>
              <IconButton
                title="Refresh"
                onClick={refresh}
                disabled={isLoading || isLoadingQuery}
                styleType='borderless'
              >
                <SvgRefresh />
              </IconButton>
            </ButtonGroup>}
        </div>
        {isLoading ? (
          <LoadingOverlay />
        ) : groups.length === 0 ? (
          <EmptyMessage message='No Groups available.' />
        ) : (
          <div className='gmw-group-list'>
            {groups
              .sort(
                (a, b) =>
                  a.groupName?.localeCompare(b.groupName ?? "") ?? 1,
              )
              .map((g) => (
                <HorizontalTile
                  key={g.id}
                  title={g.groupName ? g.groupName : "Untitled"}
                  subText={g.description}
                  actionGroup={
                    <div className='gmw-actions'>
                      {iModelConnection && <>
                        {showGroupColor && (
                          <IconButton
                            styleType='borderless'
                            className='gmw-group-view-icon'
                          >
                            <div
                              className="gmw-color-legend"
                              style={{
                                backgroundColor: getGroupColor(groups.findIndex((group) => g.id === group.id)),
                              }}
                            />
                          </IconButton>
                        )}
                        {g.id && hiddenGroupsIds.includes(g.id) ? (
                          <IconButton
                            disabled={isLoadingQuery}
                            styleType='borderless'
                            className='gmw-group-view-icon'
                            onClick={async () => {
                              await showGroup(g);
                              setHiddenGroupsIds(
                                hiddenGroupsIds.filter((id) => g.id !== id),
                              );
                            }}
                          >
                            <SvgVisibilityHide />
                          </IconButton>
                        ) : (
                          <IconButton
                            disabled={isLoadingQuery}
                            styleType='borderless'
                            className='gmw-group-view-icon'
                            onClick={async () => {
                              await hideGroupsWrapper([g]);
                              setHiddenGroupsIds(
                                hiddenGroupsIds.concat(g.id ? [g.id] : []),
                              );
                            }}
                          >
                            <SvgVisibilityShow />
                          </IconButton>
                        )}
                      </>}
                      <DropdownMenu
                        className='gmw-custom-ui-dropdown'
                        disabled={isLoadingQuery}
                        menuItems={(close: () => void) =>
                          [...(groupUIs.length > 0 && onClickAddGroup ?
                            [<MenuItem
                              key={0}
                              icon={<SvgEdit />}
                              disabled={isLoadingQuery}
                              data-testid="gmw-context-menu-item"
                              subMenuItems={
                                groupUIs.map((p, index) => (
                                  <MenuItem
                                    key={index}
                                    className='gmw-menu-item'
                                    data-testid={`gmw-edit-${index}`}
                                    onClick={async () => onModify(g, p.name)}
                                    icon={p.icon}
                                  >
                                    {p.displayLabel}
                                  </MenuItem>
                                ))
                              }
                            >
                              Edit
                            </MenuItem>] : []),
                          ...contextUIs.map((p) => {
                            return <MenuItem
                              key={p.name}
                              onClick={async () => {
                                showGroupColor && await showGroup(g);
                                if (p.uiComponent && onClickRenderContextCustomUI) {
                                  onClickRenderContextCustomUI(p.uiComponent, g);
                                }
                                if (p.onClick) {
                                  p.onClick(g, mapping, iModelId);
                                }
                                close();
                              }}
                              icon={p.icon}
                              data-testid="gmw-context-menu-item"
                            >
                              {p.displayLabel}
                            </MenuItem>;
                          }),
                          <MenuItem
                            key={2}
                            onClick={() => {
                              setSelectedGroup(g);
                              setShowDeleteModal(true);
                              close();
                            }}
                            icon={<SvgDelete />}
                            data-testid="gmw-context-menu-item"
                          >
                            Remove
                          </MenuItem>,
                          ]
                        }
                      >
                        <IconButton
                          disabled={isLoadingQuery}
                          styleType='borderless'
                          data-testid="gmw-more-button"
                        >
                          <SvgMore />
                        </IconButton>
                      </DropdownMenu>
                    </div>
                  }
                  onClickTitle={
                    onClickGroupTitle && !isLoadingQuery ?
                      async () => {
                        await colorGroup(g);
                        onClickGroupTitle(g);
                      } : undefined
                  }
                />
              ))}
          </div>
        )}
      </Surface>
      <DeleteModal
        entityName={selectedGroup?.groupName ?? ""}
        show={showDeleteModal}
        setShow={setShowDeleteModal}
        onDelete={async () => {
          const accessToken = await getAccessToken();
          await mappingClient.deleteGroup(
            accessToken,
            iModelId,
            mapping.id,
            selectedGroup?.id ?? "",
          );
        }}
        refresh={refresh}
      />
    </>
  );
};
