/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useActiveIModelConnection } from "@itwin/appui-react";
import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
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
  SvgDelete,
  SvgEdit,
  SvgList,
  SvgMore,
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
  emphasisElementsById,
  emphasizeElements,
  getHiliteIds,
  hideElements,
  hideElementsById,
  overrideElements,
  overrideElementsById,
  zoomToElements,
} from "./viewerUtils";
import { EmptyMessage, fetchIdsFromQuery, handleError, LoadingOverlay, WidgetHeader } from "./utils";
import GroupAction from "./GroupAction";
import type { Group, Mapping } from "@itwin/insights-client";
import { ReportingClient } from "@itwin/insights-client";
import type { Api } from "./GroupingMapping";
import { ApiContext } from "./GroupingMapping";
import { FeatureOverrideType } from "@itwin/core-common";
import { GroupTile } from "./GroupTile";

export type GroupType = CreateTypeFromInterface<Group>;

enum GroupsView {
  GROUPS = "groups",
  MODIFYING = "modifying",
  ADD = "ADD",
  PROPERTIES = "properties",
}

interface GroupsTreeProps {
  mapping: Mapping;
  goBack: () => Promise<void>;
}

const goldenAngle = 180 * (3 - Math.sqrt(5));

const fetchGroups = async (
  setGroups: React.Dispatch<React.SetStateAction<GroupType[]>>,
  iModelId: string,
  mappingId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  apiContext: Api,
): Promise<Group[] | undefined> => {
  try {
    setIsLoading(true);
    const reportingClientApi = new ReportingClient(apiContext.prefix);
    const groups = await reportingClientApi.getGroups(
      apiContext.accessToken,
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
  const apiContext = useContext(ApiContext);
  const iModelId = useActiveIModelConnection()?.iModelId as string;
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [groupsView, setGroupsView] = useState<GroupsView>(GroupsView.GROUPS);
  const [selectedGroup, setSelectedGroup] = useState<GroupType | undefined>(
    undefined,
  );
  const hilitedElements = useRef<Map<string, string[]>>(new Map());
  const [isLoadingQuery, setLoadingQuery] = useState<boolean>(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [hiddenGroupsIds, setHiddenGroupsIds] = useState<string[]>([]);
  const [showGroupColor, setShowGroupColor] = useState<boolean>(false);

  useEffect(() => {
    void fetchGroups(
      setGroups,
      iModelId,
      mapping.id ?? "",
      setIsLoading,
      apiContext,
    );
  }, [apiContext, iModelId, mapping.id, setIsLoading]);

  const getGroupColor = function (index: number) {
    return `hsl(${index * goldenAngle + 60}, 100%, 75%)`;
  };

  const visualizeGroupColors = useCallback(
    async (viewGroups: Group[]) => {
      setLoadingQuery(true);
      clearEmphasizedOverriddenElements();
      let allIds: string[] = [];
      for (const group of viewGroups) {
        const index = groups.findIndex((g) => g.id === group.id);
        const query = group.query ?? "";
        if (hilitedElements.current.has(query)) {
          const hilitedIds = hilitedElements.current.get(query) ?? [];
          overrideElements(
            hilitedIds,
            getGroupColor(index),
            FeatureOverrideType.ColorAndAlpha,
          );
          emphasizeElements(hilitedIds, undefined);
          allIds = allIds.concat(hilitedIds);
        } else {
          try {
            const ids: string[] = await fetchIdsFromQuery(
              query,
              iModelConnection,
            );
            if (ids.length === 0) {
              toaster.warning(
                `${group.groupName}'s query is valid but produced no results.`,
              );
            }
            await overrideElementsById(
              iModelConnection,
              ids,
              getGroupColor(index),
              FeatureOverrideType.ColorAndAlpha,
            );
            const hiliteIds = await emphasisElementsById(
              iModelConnection,
              ids,
              undefined,
            );
            hilitedElements.current.set(query, hiliteIds);
            allIds = allIds.concat(ids);
          } catch {
            toaster.negative(
              `Could not load ${group.groupName}. Query could not be resolved.`,
            );
          }
        }
      }
      await zoomToElements(allIds);
      setLoadingQuery(false);
    },
    [iModelConnection, groups],
  );

  const addGroup = () => {
    clearEmphasizedElements();
    setGroupsView(GroupsView.ADD);
  };

  const onModify = useCallback((group) => {
    setSelectedGroup(group);
    setGroupsView(GroupsView.MODIFYING);
  }, []);

  const openProperties = useCallback((group) => {
    setSelectedGroup(group);
    setGroupsView(GroupsView.PROPERTIES);
  }, []);

  const refresh = useCallback(async () => {
    setGroupsView(GroupsView.GROUPS);
    setSelectedGroup(undefined);
    setGroups([]);
    const groups = await fetchGroups(
      setGroups,
      iModelId,
      mapping.id ?? "",
      setIsLoading,
      apiContext,
    );
    setHiddenGroupsIds([]);
    clearHiddenElements();
    if (groups) {
      if (showGroupColor) {
        await visualizeGroupColors(groups);
      } else {
        clearEmphasizedOverriddenElements();
      }
    }
  }, [
    apiContext,
    iModelId,
    mapping.id,
    setGroups,
    showGroupColor,
    visualizeGroupColors,
  ]);

  const hideGroups = useCallback(
    async (viewGroups: Group[], zoomTo: boolean = true) => {
      setLoadingQuery(true);
      let allIds: string[] = [];
      for (const viewGroup of viewGroups) {
        const query = viewGroup.query ?? "";
        if (hilitedElements.current.has(query)) {
          const hilitedIds = hilitedElements.current.get(query) ?? [];
          hideElements(hilitedIds);
          allIds = allIds.concat(hilitedIds);
        } else {
          try {
            const ids: string[] = await fetchIdsFromQuery(
              query,
              iModelConnection,
            );
            if (ids.length === 0) {
              toaster.warning(
                `${viewGroup.groupName}'s query is valid but produced no results.`,
              );
            }
            const hiliteIds = await hideElementsById(
              ids,
              iModelConnection,
              false,
            );
            hilitedElements.current.set(query, hiliteIds);
            allIds = allIds.concat(ids);
          } catch {
            toaster.negative(
              `Could not hide/show ${viewGroup.groupName}. Query could not be resolved.`,
            );
          }
        }
      }
      if (zoomTo) {
        await zoomToElements(allIds);
      }
      setLoadingQuery(false);
    },
    [iModelConnection],
  );

  const showGroup = useCallback(
    async (viewGroup: Group) => {
      clearHiddenElements();
      const newHiddenGroups: Group[] = [];
      for (const id of hiddenGroupsIds) {
        if (id === viewGroup.id) {
          continue;
        }
        const newHiddenGroup = groups.find((g) => g.id === id);
        if (newHiddenGroup) {
          newHiddenGroups.push(newHiddenGroup);
        }
      }
      await hideGroups(newHiddenGroups, false);

      // zoom to showed elements
      const query = viewGroup.query ?? "";
      if (hilitedElements.current.has(query)) {
        const hiliteIds = hilitedElements.current.get(query) ?? [];
        await zoomToElements(hiliteIds);
      } else {
        try {
          const ids: string[] = await fetchIdsFromQuery(
            query,
            iModelConnection,
          );
          if (ids.length === 0) {
            toaster.warning(
              `${viewGroup.groupName}'s query is valid but produced no results.`,
            );
          }
          const hiliteIds = await getHiliteIds(ids, iModelConnection);
          await zoomToElements(hiliteIds);
        } catch {
          toaster.negative(
            `Could not hide/show ${viewGroup.groupName}. Query could not be resolved.`,
          );
        }
      }
    },
    [groups, hiddenGroupsIds, hideGroups, iModelConnection, hilitedElements],
  );

  const showAll = useCallback(async () => {
    clearHiddenElements();
    setHiddenGroupsIds([]);
  }, [setHiddenGroupsIds]);

  const hideAll = useCallback(async () => {
    await hideGroups(groups);
    setHiddenGroupsIds(
      groups
        .filter((g) => g.id)
        .map((g) => (g.id ? g.id : "")),
    );
  }, [setHiddenGroupsIds, groups, hideGroups]);

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
    [groups, visualizeGroupColors, setShowGroupColor]);

  const propertyMenuGoBack = useCallback(async () => {
    setGroupsView(GroupsView.GROUPS);
    await refresh();
  }, [refresh]);

  switch (groupsView) {
    case GroupsView.ADD:
      return (
        <GroupAction
          iModelId={iModelId}
          mappingId={mapping.id ?? ""}
          goBack={async () => {
            setGroupsView(GroupsView.GROUPS);
            await refresh();
          }}
        />
      );
    case GroupsView.MODIFYING:
      return selectedGroup ? (
        <GroupAction
          iModelId={iModelId}
          mappingId={mapping.id ?? ""}
          group={selectedGroup}
          goBack={async () => {
            setGroupsView(GroupsView.GROUPS);
            await refresh();
          }}
        />
      ) : null;
    case GroupsView.PROPERTIES:
      return selectedGroup ? (
        <PropertyMenu
          iModelId={iModelId}
          mappingId={mapping.id ?? ""}
          group={selectedGroup}
          goBack={propertyMenuGoBack}
        />
      ) : null;
    default:
      return (
        <>
          <WidgetHeader
            title={mapping.mappingName ?? ""}
            disabled={isLoading || isLoadingQuery}
            returnFn={async () => {
              clearEmphasizedOverriddenElements();
              await goBack();
            }}
          />
          <Surface className="groups-container">
            <div className="toolbar">
              <Button
                startIcon={
                  isLoadingQuery ? (
                    <ProgressRadial size="small" indeterminate />
                  ) : (
                    <SvgAdd />
                  )
                }
                styleType="high-visibility"
                disabled={isLoadingQuery}
                onClick={addGroup}
              >
                {isLoadingQuery ? "Loading Group(s)" : "Add Group"}
              </Button>
              <ButtonGroup>
                <ToggleSwitch
                  label="Color by Group"
                  labelPosition="left"
                  className="group-view-icon toggle"
                  disabled={isLoadingQuery}
                  checked={showGroupColor}
                  onChange={toggleGroupColor}>
                </ToggleSwitch>
                <IconButton
                  disabled={isLoadingQuery}
                  styleType="borderless"
                  className="group-view-icon"
                >
                  <SvgVisibilityShow onClick={showAll}></SvgVisibilityShow>
                </IconButton>
                <IconButton
                  disabled={isLoadingQuery}
                  styleType="borderless"
                  className="group-view-icon"
                >
                  <SvgVisibilityHide onClick={hideAll}></SvgVisibilityHide>
                </IconButton>
              </ButtonGroup>
            </div>
            {isLoading ? (
              <LoadingOverlay />
            ) : groups.length === 0 ? (
              <EmptyMessage message="No Groups available." />
            ) : (
              <div className="group-list">
                {groups.map((g) => (
                  <GroupTile
                    key={g.id}
                    title={g.groupName ? g.groupName : "Untitled"}
                    subText={g.description}
                    actionGroup={
                      <div className="actions">
                        <IconButton
                          disabled={isLoadingQuery}
                          styleType="borderless"
                          className="group-view-icon"
                        >
                          {g.id && hiddenGroupsIds.includes(g.id) ? (
                            <SvgVisibilityHide
                              onClick={async () => {
                                await showGroup(g);
                                setHiddenGroupsIds(
                                  hiddenGroupsIds.filter((id) => g.id !== id),
                                );
                              }}
                            ></SvgVisibilityHide>
                          ) : (
                            <SvgVisibilityShow
                              onClick={async () => {
                                await hideGroups([g]);
                                setHiddenGroupsIds(
                                  hiddenGroupsIds.concat(g.id ? [g.id] : []),
                                );
                              }}
                            ></SvgVisibilityShow>
                          )}
                        </IconButton>
                        <DropdownMenu
                          disabled={isLoadingQuery}
                          menuItems={(close: () => void) => [
                            <MenuItem
                              key={0}
                              onClick={() => onModify(g)}
                              icon={<SvgEdit />}
                            >
                              Modify
                            </MenuItem>,
                            <MenuItem
                              key={1}
                              onClick={() => openProperties(g)}
                              icon={<SvgList />}
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
                            >
                              Remove
                            </MenuItem>,
                          ]}
                        >
                          <IconButton
                            disabled={isLoadingQuery}
                            styleType="borderless"
                          >
                            <SvgMore
                              style={{
                                width: "16px",
                                height: "16px",
                              }}
                            />
                          </IconButton>
                        </DropdownMenu>
                      </div>
                    }
                    onClickTitle={
                      isLoadingQuery ? undefined : () => openProperties(g)
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
              const reportingClientApi = new ReportingClient(apiContext.prefix);
              await reportingClientApi.deleteGroup(
                apiContext.accessToken,
                iModelId,
                mapping.id ?? "",
                selectedGroup?.id ?? "",
              );
            }}
            refresh={refresh}
          />
        </>
      );
  }
};
