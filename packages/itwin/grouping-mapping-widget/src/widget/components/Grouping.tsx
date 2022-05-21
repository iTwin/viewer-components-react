/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { CellProps } from "react-table";
import { useActiveIModelConnection } from "@itwin/appui-react";
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CreateTypeFromInterface } from "../utils";
import {
  Button,
  DropdownMenu,
  IconButton,
  MenuItem,
  ProgressRadial,
  Table,
  toaster,
  ToggleSwitch,
} from "@itwin/itwinui-react";
import {
  SvgAdd,
  SvgDelete,
  SvgEdit,
  SvgList,
  SvgMore,
} from "@itwin/itwinui-icons-react";
import DeleteModal from "./DeleteModal";
import "./Grouping.scss";
import type { IModelConnection } from "@itwin/core-frontend";
import { PropertyMenu } from "./PropertyMenu";
import {
  clearEmphasizedOverriddenElements,
  clearHiddenElements,
  emphasisElementsById,
  emphasizeElements,
  hideElements,
  hideElementsById,
  overrideElements,
  overrideElementsById,
  showElements,
  showElementsByIds,
  zoomToElements,
} from "./viewerUtils";
import { fetchIdsFromQuery, handleError, WidgetHeader } from "./utils";
import GroupAction from "./GroupAction";
import type { Group, Mapping } from "@itwin/insights-client";
import { ReportingClient } from "@itwin/insights-client";
import type { Api } from "./GroupingMapping";
import { ApiContext } from "./GroupingMapping";
import { FeatureAppearance, FeatureOverrideType } from "@itwin/core-common";

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

const fetchGroups = async (
  setGroups: React.Dispatch<React.SetStateAction<GroupType[]>>,
  iModelId: string,
  mappingId: string,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  apiContext: Api,
) => {
  try {
    setIsLoading(true);
    const reportingClientApi = new ReportingClient(apiContext.prefix);
    const groups = await reportingClientApi.getGroups(
      apiContext.accessToken,
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

const goldenAngle = 180 * (3 - Math.sqrt(5));

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
  const [selectedGroups, setSelectedGroups] = useState<Group[]>([]);
  const [showGroupColor, setShowGroupColor] = useState<boolean>(false);
  const [hideGroups, setHideGroups] = useState<boolean>(false);

  useEffect(() => {
    void fetchGroups(
      setGroups,
      iModelId,
      mapping.id ?? "",
      setIsLoading,
      apiContext,
    );
  }, [apiContext, iModelId, mapping.id, setIsLoading]);

  const refresh = useCallback(async () => {
    setGroupsView(GroupsView.GROUPS);
    setSelectedGroup(undefined);
    setGroups([]);
    await fetchGroups(
      setGroups,
      iModelId,
      mapping.id ?? "",
      setIsLoading,
      apiContext,
    );
  }, [apiContext, iModelId, mapping.id, setGroups]);

  const addGroup = () => {
    // TODO Retain selection in view without emphasizes. Goal is to make it so we can distinguish
    // hilited elements from regular elements without emphasis due to it blocking selection. For now clearing
    // selection.
    setGroupsView(GroupsView.ADD);
  };

  const onModify = useCallback((value) => {
    setSelectedGroup(value.row.original);
    setGroupsView(GroupsView.MODIFYING);
  }, []);

  const openProperties = useCallback((value) => {
    setSelectedGroup(value.row.original);
    setGroupsView(GroupsView.PROPERTIES);
  }, []);

  const showHideGroup = useCallback(
    async (viewGroup: Group, hide: boolean) => {
      setLoadingQuery(true);
      let allIds: string[] = [];
      const query = viewGroup.query ?? "";
      if (hilitedElements.current.has(query)) {
        const hilitedIds = hilitedElements.current.get(query) ?? [];
        if (hide) {
          hideElements(hilitedIds, false);
        } else {
          showElements(hilitedIds);
        }
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
          if (hide) {
            const hiliteIds = await hideElementsById(
              ids,
              iModelConnection,
              false,
            );
            hilitedElements.current.set(query, hiliteIds);
          } else {
            const hiliteIds = await showElementsByIds(ids, iModelConnection);
            hilitedElements.current.set(query, hiliteIds);
          }
          allIds = allIds.concat(ids);
        } catch {
          toaster.negative(
            `Could not hide/show ${viewGroup.groupName}. Query could not be resolved.`,
          );
        }
      }
      await zoomToElements(allIds);
      setLoadingQuery(false);
    },
    [iModelConnection],
  );

  const groupsColumns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
          {
            id: "groupName",
            Header: "Group",
            accessor: "groupName",
            Cell: (value: CellProps<GroupType>) => (
              <>
                {isLoadingQuery ? (
                  value.row.original.groupName
                ) : (
                  <div
                    className="iui-anchor"
                    onClick={(e) => {
                      e.stopPropagation();
                      openProperties(value);
                    }}
                  >
                    {value.row.original.groupName}
                  </div>
                )}
              </>
            ),
          },
          {
            id: "description",
            Header: "Description",
            accessor: "description",
          },
          {
            id: "dropdown",
            Header: "",
            width: 80,
            Cell: (value: CellProps<GroupType>) => {
              return (
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu
                    disabled={isLoadingQuery}
                    menuItems={(close: () => void) => [
                      <MenuItem
                        key={0}
                        onClick={() => onModify(value)}
                        icon={<SvgEdit />}
                      >
                        Modify
                      </MenuItem>,
                      <MenuItem
                        key={1}
                        onClick={() => openProperties(value)}
                        icon={<SvgList />}
                      >
                        Properties
                      </MenuItem>,
                      <MenuItem
                        key={2}
                        onClick={() => {
                          setSelectedGroup(value.row.original);
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
              );
            },
          },
        ],
      },
    ],
    [isLoadingQuery, onModify, openProperties],
  );

  const getGroupColor = function (index: number) {
    return `hsl(${index * goldenAngle + 60}, 100%, 75%)`;
  };

  const visualizeGroupColors = useCallback(
    async (viewGroups: Group[], override: boolean) => {
      setLoadingQuery(true);
      clearEmphasizedOverriddenElements();
      let allIds: string[] = [];
      for (const group of viewGroups) {
        const index = groups.findIndex((g) => g.id === group.id);
        const query = group.query ?? "";
        if (hilitedElements.current.has(query)) {
          const hilitedIds = hilitedElements.current.get(query) ?? [];
          if (override) {
            overrideElements(
              hilitedIds,
              getGroupColor(index),
              FeatureOverrideType.ColorAndAlpha,
            );
          }
          emphasizeElements(
            hilitedIds,
            override ? undefined : FeatureAppearance.defaults
          );
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
            if (override) {
              await overrideElementsById(
                iModelConnection,
                ids,
                getGroupColor(index),
                FeatureOverrideType.ColorAndAlpha,
              );
            }
            const hiliteIds = await emphasisElementsById(
              iModelConnection,
              ids,
              override ? undefined : FeatureAppearance.defaults
            );
            hilitedElements.current.set(query, hiliteIds);
            allIds = allIds.concat(ids);
          } catch {
            setSelectedGroups(selectedGroups.filter((g) => g.id !== group.id));
            toaster.negative(
              `Could not load ${group.groupName}. Query could not be resolved.`,
            );
          }
        }
      }
      await zoomToElements(allIds);
      setLoadingQuery(false);
    },
    [iModelConnection, groups, selectedGroups],
  );

  const onSelect = useCallback(
    async (selectedData: GroupType[] | undefined) => {
      clearEmphasizedOverriddenElements();
      if (selectedData && selectedData.length > 0) {
        setSelectedGroups(selectedData);
        await visualizeGroupColors(selectedData, showGroupColor);
      }
    },
    [visualizeGroupColors, showGroupColor],
  );

  const propertyMenuGoBack = useCallback(async () => {
    setGroupsView(GroupsView.GROUPS);
    await refresh();
  }, [refresh]);

  const toggleGroupColor = useCallback(
    async (e: any) => {
      if (e.target.checked) {
        await visualizeGroupColors(selectedGroups, true);
        setShowGroupColor(true);
      } else {
        await visualizeGroupColors(selectedGroups, false);
        setShowGroupColor(false);
      }
    },
    [visualizeGroupColors, selectedGroups],
  );

  const toggleHideGroups = useCallback(
    async (e: any) => {
      if (e.target.checked) {
        selectedGroups.forEach(async (g) => {
          await showHideGroup(g, true);
          setHideGroups(true);
        });
      } else {
        clearHiddenElements();
        setHideGroups(false);
      }
    },
    [showHideGroup, selectedGroups],
  );

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
          <div className="groups-container">
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
              onClick={() => addGroup()}
            >
              {isLoadingQuery ? "Loading Group(s)" : "Add Group"}
            </Button>
            <Table<GroupType>
              data={groups}
              density="extra-condensed"
              columns={groupsColumns}
              emptyTableContent="No Groups available."
              isSortable
              isSelectable
              onSelect={onSelect}
              isLoading={isLoading}
              isRowDisabled={() => isLoadingQuery}
            />
            <ToggleSwitch
              label="Hide Selection"
              labelPosition="left"
              onChange={toggleHideGroups}
              checked={hideGroups}
              disabled={isLoading}
            ></ToggleSwitch>
            <ToggleSwitch
              label="View Group Color"
              labelPosition="left"
              onChange={toggleGroupColor}
              checked={showGroupColor}
              disabled={isLoading}
            ></ToggleSwitch>
          </div>
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
