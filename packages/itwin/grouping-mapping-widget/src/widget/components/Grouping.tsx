/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type {
  ActionType,
  CellProps,
  TableInstance,
  TableState,
} from "react-table";
import {
  actions,
} from "react-table";
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
  clearEmphasizedElements,
  visualizeElements,
  visualizeElementsById,
  zoomToElements,
} from "./viewerUtils";
import { fetchIdsFromQuery, handleError, WidgetHeader } from "./utils";
import GroupAction from "./GroupAction";
import type { Group, Mapping } from "@itwin/insights-client";
import { ReportingClient } from "@itwin/insights-client";
import type { Api } from "./GroupingMapping";
import { ApiContext } from "./GroupingMapping";

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
  apiContext: Api
) => {
  try {
    setIsLoading(true);
    const reportingClientApi = new ReportingClient(apiContext.prefix);
    const groups = await reportingClientApi.getGroups(apiContext.accessToken, iModelId, mappingId);
    setGroups(groups.groups ?? []);
  } catch (error: any) {
    handleError(error.status);
  } finally {
    setIsLoading(false);
  }
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
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});
  const [isLoadingQuery, setLoadingQuery] = useState<boolean>(false);
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    void fetchGroups(setGroups, iModelId, mapping.id ?? "", setIsLoading, apiContext);
  }, [apiContext, iModelId, mapping.id, setIsLoading]);

  const refresh = useCallback(async () => {
    setGroupsView(GroupsView.GROUPS);
    setSelectedGroup(undefined);
    setGroups([]);
    await fetchGroups(setGroups, iModelId, mapping.id ?? "", setIsLoading, apiContext);
  }, [apiContext, iModelId, mapping.id, setGroups]);

  const addGroup = () => {
    // TODO Retain selection in view without emphasizes. Goal is to make it so we can distinguish
    // hilited elements from regular elements without emphasis due to it blocking selection. For now clearing
    // selection.
    clearEmphasizedElements();
    setGroupsView(GroupsView.ADD);
  };

  const onModify = useCallback((value) => {
    clearEmphasizedElements();
    setSelectedGroup(value.row.original);
    setGroupsView(GroupsView.MODIFYING);
  }, []);

  const openProperties = useCallback((value) => {
    clearEmphasizedElements();
    setSelectedGroup(value.row.original);
    setGroupsView(GroupsView.PROPERTIES);
  }, []);

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
                    className='iui-anchor'
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
                      styleType='borderless'
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

  // Temp
  const stringToColor = function (str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    let colour = "#";
    for (let i = 0; i < 3; i++) {
      const value = (hash >> (i * 8)) & 0xff;
      colour += (`00${value.toString(16)}`).substr(-2);
    }
    return colour;
  };

  const onSelect = useCallback(
    async (selectedData: GroupType[] | undefined) => {
      clearEmphasizedElements();
      if (selectedData && selectedData.length > 0) {
        setLoadingQuery(true);
        let allIds: string[] = [];
        for (const row of selectedData) {
          const query = row.query ?? "";
          if (hilitedElements.current.has(query)) {
            const hilitedIds = hilitedElements.current.get(query) ?? [];
            visualizeElements(hilitedIds, stringToColor(row.id ?? ""));
            allIds = allIds.concat(hilitedIds);
          } else {
            try {
              const ids: string[] = await fetchIdsFromQuery(
                query,
                iModelConnection,
              );
              if (ids.length === 0) {
                toaster.warning(`${row.groupName}'s query is valid but produced no results.`);
              }
              const hiliteIds = await visualizeElementsById(
                ids,
                stringToColor(row.id ?? ""),
                iModelConnection,
              );
              hilitedElements.current.set(query, hiliteIds);

              allIds = allIds.concat(ids);
            } catch {
              const index = groups.findIndex((group) => group.id === row.id);
              setSelectedRows((rowIds) => {
                const selectedRowIds = { ...rowIds };
                delete selectedRowIds[index];
                return selectedRowIds;
              });
              toaster.negative(`Could not load ${row.groupName}. Query could not be resolved.`);

            }
          }
        }
        await zoomToElements(allIds);
        setLoadingQuery(false);
      }
    },
    [iModelConnection, groups],
  );

  const controlledState = useCallback(
    (state) => {
      return {
        ...state,
        selectedRowIds: { ...selectedRows },
      };
    },
    [selectedRows],
  );

  const propertyMenuGoBack = useCallback(async () => {
    clearEmphasizedElements();
    setGroupsView(GroupsView.GROUPS);
    await refresh();
  }, [refresh]);

  const tableStateReducer = (
    newState: TableState,
    action: ActionType,
    _previousState: TableState,
    instance?: TableInstance,
  ): TableState => {
    switch (action.type) {
      case actions.toggleRowSelected: {
        const newSelectedRows = {
          ...selectedRows,
        };
        if (action.value) {
          newSelectedRows[action.id] = true;
        } else {
          delete newSelectedRows[action.id];
        }
        setSelectedRows(newSelectedRows);
        newState.selectedRowIds = newSelectedRows;
        break;
      }
      case actions.toggleAllRowsSelected: {
        if (!instance?.rowsById) {
          break;
        }
        const newSelectedRows = {} as Record<string, boolean>;
        if (action.value) {
          Object.keys(instance.rowsById).forEach(
            (id) => (newSelectedRows[id] = true),
          );
        }
        setSelectedRows(newSelectedRows);
        newState.selectedRowIds = newSelectedRows;
        break;
      }
      default:
        break;
    }
    return newState;
  };

  switch (groupsView) {
    case GroupsView.ADD:
      return (
        <GroupAction
          iModelId={iModelId}
          mappingId={mapping.id ?? ""}
          goBack={async () => {
            clearEmphasizedElements();
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
            clearEmphasizedElements();
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
              clearEmphasizedElements();
              await goBack();
            }}
          />
          <div className='groups-container'>
            <Button
              startIcon={
                isLoadingQuery ? <ProgressRadial size="small" indeterminate /> : <SvgAdd />
              }
              styleType='high-visibility'
              disabled={isLoadingQuery}
              onClick={() => addGroup()}
            >
              {isLoadingQuery ? "Loading Group(s)" : "Add Group"}
            </Button>
            <Table<GroupType>
              data={groups}
              density='extra-condensed'
              columns={groupsColumns}
              emptyTableContent='No Groups available.'
              isSortable
              isSelectable
              onSelect={onSelect}
              isLoading={isLoading}
              isRowDisabled={() => isLoadingQuery}
              stateReducer={tableStateReducer}
              useControlledState={controlledState}
            />
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
