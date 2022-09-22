/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useActiveIModelConnection } from "@itwin/appui-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { CreateTypeFromInterface } from "../utils";
import {
  Button,
  ButtonGroup,
  DropdownMenu,
  IconButton,
  MenuItem,
  ProgressRadial,
  Surface,
  toaster,
  ToggleSwitch,
} from "@itwin/itwinui-react";
import {
  SvgAdd,
  SvgCursor,
  SvgDelete,
  SvgDraw,
  SvgEdit,
  SvgList,
  SvgMore,
  SvgSearch,
  SvgVisibilityHide,
  SvgVisibilityShow,
} from "@itwin/itwinui-icons-react";
import DeleteModal from "./DeleteModal";
import "./Grouping.scss";
import type { IModelConnection } from "@itwin/core-frontend";
import { PropertyMenu } from "./PropertyMenu";
import {
  clearEmphasizedElements,
  clearEmphasizedOverriddenElements,
  clearHiddenElements,
  clearOverriddenElements,
  emphasizeElements,
  getHiliteIds,
  hideElements,
  hideElementsByQuery,
  overrideElements,
  zoomToElements,
} from "./viewerUtils";
import {
  EmptyMessage,
  handleError,
  LoadingOverlay,
  WidgetHeader,
} from "./utils";
import GroupAction from "./GroupAction";
import type { Group, IMappingsClient, Mapping } from "@itwin/insights-client";
import { useMappingClient } from "./context/MappingClientContext";
import { FeatureOverrideType } from "@itwin/core-common";
import { HorizontalTile } from "./HorizontalTile";
import type { GetAccessTokenFn } from "./context/GroupingApiConfigContext";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import { useGroupingMappingCustomUI } from "./context/GroupingMappingCustomUIContext";
import { GroupingMappingCustomUIType } from "./customUI/GroupingMappingCustomUI";
import type { ContextCustomUI, GroupingCustomUI } from "./customUI/GroupingMappingCustomUI";
import { Presentation } from "@itwin/presentation-frontend";

export type IGroupTyped = CreateTypeFromInterface<Group>;

export const defaultUIMetadata = [
  {
    name: "Selection",
    displayLabel: "Selection",
    icon: <SvgCursor />,
  },
  {
    name: "Search",
    displayLabel: "Query Keywords",
    icon: <SvgSearch />,
  },
  {
    name: "Manual",
    displayLabel: "Manual Query",
    icon: <SvgDraw />,
  },
];

enum GroupsView {
  Add,          // Add group view
  Groups,       // Group list page
  CustomUI,     // Context custom UI view
  Modifying,    // Modify group view
  Properties,   // Group properties view
}

interface GroupsTreeProps {
  mapping: Mapping;
  goBack: () => Promise<void>;
}

const goldenAngle = 180 * (3 - Math.sqrt(5));

const fetchGroups = async (
  setGroups: React.Dispatch<React.SetStateAction<IGroupTyped[]>>,
  iModelId: string,
  mappingId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  getAccessToken: GetAccessTokenFn,
  mappingsClient: IMappingsClient,
): Promise<Group[] | undefined> => {
  try {
    setIsLoading(true);
    const accessToken = await getAccessToken();
    const groups = await mappingsClient.getGroups(
      accessToken,
      iModelId,
      mappingId,
    );
    setGroups(groups);
    return groups;
  } catch (error: any) {
    handleError(error.status);
  } finally {
    setIsLoading(false);
  }
  return undefined;
};

export const Groupings = ({ mapping, goBack }: GroupsTreeProps) => {
  const iModelConnection = useActiveIModelConnection() as IModelConnection;
  const { getAccessToken } = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const iModelId = useActiveIModelConnection()?.iModelId as string;
  const groupUIs: GroupingCustomUI[] = useGroupingMappingCustomUI()
    .filter((p) => p.type === GroupingMappingCustomUIType.Grouping) as GroupingCustomUI[];
  const contextUIs: ContextCustomUI[] = useGroupingMappingCustomUI()
    .filter((p) => p.type === GroupingMappingCustomUIType.Context) as ContextCustomUI[];

  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [groupsView, setGroupsView] = useState<GroupsView>(GroupsView.Groups);
  const [selectedGroup, setSelectedGroup] = useState<IGroupTyped | undefined>(
    undefined,
  );
  const hilitedElements = useRef<Map<string, string[]>>(new Map());
  const [isLoadingQuery, setLoadingQuery] = useState<boolean>(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [hiddenGroupsIds, setHiddenGroupsIds] = useState<string[]>([]);
  const [showGroupColor, setShowGroupColor] = useState<boolean>(false);

  const [queryGenerationType, setQueryGenerationType] =
    useState<string>("Selection");
  const [selectedContextCustomUI, setSelectedContextCustomUI] = useState<ContextCustomUI | undefined>(undefined);

  useEffect(() => {
    void fetchGroups(
      setGroups,
      iModelId,
      mapping.id,
      setIsLoading,
      getAccessToken,
      mappingClient,
    );
  }, [getAccessToken, mappingClient, iModelId, mapping.id, setIsLoading]);

  const getGroupColor = function (index: number) {
    return `hsl(${index * goldenAngle + 60}, 100%, 50%)`;
  };

  const getHiliteIdsFromGroups = useCallback(
    async (groups: Group[]) => {
      let allIds: string[] = [];
      for (const group of groups) {
        const query = group.query;
        let currentIds: string[] = [];
        if (hilitedElements.current.has(query)) {
          currentIds = hilitedElements.current.get(query) ?? [];
        } else {
          try {
            const queryRowCount = await iModelConnection.queryRowCount(query);
            if (queryRowCount === 0) {
              toaster.warning(
                `${group.groupName}'s query is valid but produced no results.`,
              );
            }
            currentIds = await getHiliteIds(query, iModelConnection);
            hilitedElements.current.set(query, currentIds);
          } catch {
            toaster.negative(
              `Could not hide/show ${group.groupName}. Query could not be resolved.`,
            );
          }
        }
        allIds = allIds.concat(currentIds);
      }
      return allIds;
    },
    [iModelConnection, hilitedElements],
  );

  const visualizeGroupColors = useCallback(
    async (viewGroups: Group[]) => {
      setLoadingQuery(true);
      clearEmphasizedOverriddenElements();
      let allIds: string[] = [];
      for (const group of viewGroups) {
        const index =
          viewGroups.length > groups.length
            ? viewGroups.findIndex((g) => g.id === group.id)
            : groups.findIndex((g) => g.id === group.id);
        const hilitedIds = await getHiliteIdsFromGroups([group]);
        overrideElements(
          hilitedIds,
          getGroupColor(index),
          FeatureOverrideType.ColorAndAlpha,
        );
        emphasizeElements(hilitedIds, undefined);
        if (!hiddenGroupsIds.includes(group.id)) {
          allIds = allIds.concat(hilitedIds);
        }
      }

      await zoomToElements(allIds);
      setLoadingQuery(false);
    },
    [groups, hiddenGroupsIds, getHiliteIdsFromGroups],
  );

  const hideGroups = useCallback(
    async (viewGroups: Group[]) => {
      setLoadingQuery(true);
      for (const viewGroup of viewGroups) {
        const query = viewGroup.query;
        if (hilitedElements.current.has(query)) {
          const hilitedIds = hilitedElements.current.get(query) ?? [];
          hideElements(hilitedIds);
        } else {
          try {
            const queryRowCount = await iModelConnection.queryRowCount(query);
            if (queryRowCount === 0) {
              toaster.warning(
                `${viewGroup.groupName}'s query is valid but produced no results.`,
              );
            }
            const hiliteIds = await hideElementsByQuery(
              query,
              iModelConnection,
              false,
            );
            hilitedElements.current.set(query, hiliteIds);
          } catch {
            toaster.negative(
              `Could not hide/show ${viewGroup.groupName}. Query could not be resolved.`,
            );
          }
        }
      }
      setLoadingQuery(false);
    },
    [iModelConnection],
  );

  const showGroup = useCallback(
    async (viewGroup: Group) => {
      clearHiddenElements();

      // hide group Ids filter
      const newHiddenGroups: Group[] = hiddenGroupsIds
        .map((id) => groups.find((g) => g.id === id))
        .filter((g): g is Group => !!g && g.id !== viewGroup.id);

      // view group Ids filter
      const viewIds = await getHiliteIdsFromGroups(
        groups.filter((g) => !newHiddenGroups.find((hg) => hg.id === g.id)),
      );
      let hiddenIds = await getHiliteIdsFromGroups(newHiddenGroups);
      hiddenIds = hiddenIds.filter((id) => !viewIds.includes(id));
      hideElements(hiddenIds);
    },
    [groups, hiddenGroupsIds, getHiliteIdsFromGroups],
  );

  const addGroup = (type: string) => {
    setQueryGenerationType(type);
    clearEmphasizedElements();
    setGroupsView(GroupsView.Add);
  };

  const onModify = async (group: Group, type: string) => {
    setQueryGenerationType(type);
    setSelectedGroup(group);
    setGroupsView(GroupsView.Modifying);
    if (group.id && hiddenGroupsIds.includes(group.id)) {
      await showGroup(group);
      setHiddenGroupsIds(hiddenGroupsIds.filter((id) => id !== group.id));
    }
    clearEmphasizedElements();
  };

  const openProperties = async (group: Group) => {
    setSelectedGroup(group);
    setGroupsView(GroupsView.Properties);
    if (group.id && hiddenGroupsIds.includes(group.id)) {
      await showGroup(group);
      setHiddenGroupsIds(hiddenGroupsIds.filter((id) => id !== group.id));
    }
  };

  const refresh = useCallback(async () => {
    setGroupsView(GroupsView.Groups);
    setSelectedGroup(undefined);
    setSelectedContextCustomUI(undefined);
    setGroups([]);
    const groups = await fetchGroups(
      setGroups,
      iModelId,
      mapping.id,
      setIsLoading,
      getAccessToken,
      mappingClient,
    );
    if (groups) {
      if (showGroupColor) {
        await visualizeGroupColors(groups);
      } else {
        clearEmphasizedOverriddenElements();
      }
    }
  }, [
    getAccessToken,
    mappingClient,
    iModelId,
    mapping.id,
    setGroups,
    showGroupColor,
    visualizeGroupColors,
  ]);

  const resetView = async () => {
    if (groups) {
      if (showGroupColor) {
        await visualizeGroupColors(groups);
      } else {
        clearOverriddenElements();
      }
      clearEmphasizedElements();
    }
  };

  const showAll = async () => {
    setLoadingQuery(true);

    clearHiddenElements();
    setHiddenGroupsIds([]);
    const allIds = await getHiliteIdsFromGroups(groups);
    await zoomToElements(allIds);

    setLoadingQuery(false);
  };

  const hideAll = useCallback(async () => {
    await hideGroups(groups);
    setHiddenGroupsIds(
      groups.map((g) => g.id).filter((id): id is string => !!id),
    );
    const allIds = await getHiliteIdsFromGroups(groups);
    await zoomToElements(allIds);
  }, [setHiddenGroupsIds, groups, hideGroups, getHiliteIdsFromGroups]);

  const toggleGroupColor = useCallback(
    async (e: any) => {
      if (e.target.checked) {
        await visualizeGroupColors(groups);
        setShowGroupColor(true);
      } else {
        clearEmphasizedOverriddenElements();
        setShowGroupColor(false);
      }
    },
    [groups, visualizeGroupColors, setShowGroupColor],
  );

  const propertyMenuGoBack = useCallback(async () => {
    setGroupsView(GroupsView.Groups);
    await refresh();
  }, [refresh]);

  switch (groupsView) {
    case GroupsView.Add:
      return (
        <GroupAction
          iModelId={iModelId}
          mappingId={mapping.id}
          queryGenerationType={queryGenerationType}
          goBack={async () => {
            setGroupsView(GroupsView.Groups);
            await refresh();
          }}
          resetView={resetView}
        />
      );
    case GroupsView.Modifying:
      return selectedGroup ? (
        <GroupAction
          iModelId={iModelId}
          mappingId={mapping.id}
          group={selectedGroup}
          queryGenerationType={queryGenerationType}
          goBack={async () => {
            setGroupsView(GroupsView.Groups);
            await refresh();
          }}
          resetView={resetView}
        />
      ) : null;
    case GroupsView.Properties:
      return selectedGroup ? (
        <PropertyMenu
          iModelId={iModelId}
          mappingId={mapping.id}
          group={selectedGroup}
          goBack={propertyMenuGoBack}
        />
      ) : null;
    case GroupsView.Groups:
      return (
        <>
          <WidgetHeader
            title={mapping.mappingName}
            disabled={isLoading || isLoadingQuery}
            returnFn={async () => {
              clearEmphasizedOverriddenElements();
              await goBack();
            }}
          />

          <Surface className='gmw-groups-container'>
            <div className='gmw-toolbar'>
              <DropdownMenu
                className='gmw-custom-ui-dropdown'
                disabled={isLoadingQuery}
                menuItems={() =>
                  (groupUIs.length > 0
                    ? groupUIs
                    : defaultUIMetadata)
                    .map((p, index) => (
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
              </DropdownMenu>
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
              </ButtonGroup>
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
                                await hideGroups([g]);
                                setHiddenGroupsIds(
                                  hiddenGroupsIds.concat(g.id ? [g.id] : []),
                                );
                              }}
                            >
                              <SvgVisibilityShow />
                            </IconButton>
                          )}
                          <DropdownMenu
                            className='gmw-custom-ui-dropdown'
                            disabled={isLoadingQuery}
                            menuItems={(close: () => void) =>
                              [
                                <MenuItem
                                  key={0}
                                  icon={<SvgEdit />}
                                  disabled={isLoadingQuery}
                                  data-testid="gmw-context-menu-item"
                                  subMenuItems={
                                    (groupUIs.length > 0
                                      ? groupUIs
                                      : defaultUIMetadata)
                                      .map((p, index) => (
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
                                </MenuItem>,
                                <MenuItem
                                  key={1}
                                  onClick={async () => openProperties(g)}
                                  icon={<SvgList />}
                                  data-testid="gmw-context-menu-item"
                                >
                                  Properties
                                </MenuItem>,
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
                              ].concat(
                                contextUIs.map((p) => {
                                  return <MenuItem
                                    key={p.name}
                                    onClick={() => {
                                      if(p.uiComponent) {
                                        setSelectedGroup(g);
                                        setSelectedContextCustomUI(p);
                                        setGroupsView(GroupsView.CustomUI);
                                      }
                                      if(p.onClick) {
                                        p.onClick(g.id, mapping.id, iModelId);
                                      }
                                      close();
                                    }}
                                    icon={p.icon}
                                    data-testid="gmw-context-menu-item"
                                  >
                                    {p.displayLabel}
                                  </MenuItem>;
                                })
                              )
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
                        isLoadingQuery
                          ? undefined
                          : async () => openProperties(g)
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
    case GroupsView.CustomUI:
      return selectedContextCustomUI && selectedContextCustomUI.uiComponent && selectedGroup
        ? (
          <>
            <WidgetHeader
              title={selectedContextCustomUI.displayLabel}
              returnFn={async () => {
                Presentation.selection.clearSelection(
                  "GroupingMappingWidget",
                  iModelConnection,
                );
                await refresh();
              }}
            />
            {React.createElement(selectedContextCustomUI.uiComponent, {
              iModelId,
              mappingId: mapping.id,
              groupId: selectedGroup.id,
            })}
          </>
        )
        : null;
    default:
      return (
        <EmptyMessage message="No given group view"/>
      );
  }
};
