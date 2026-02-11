/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { useCallback, useMemo, useState } from "react";
import type { CreateTypeFromInterface } from "../../common/utils";
import { InformationPanel, InformationPanelBody, InformationPanelHeader, Table, Text, toaster } from "@itwin/itwinui-react";
import "./OverlappedElementsInformationPanel.scss";
import type { GroupMinimal } from "@itwin/insights-client";
import type { OverlappedInfo } from "../context/GroupHilitedElementsContext";
import type { CellProps, Column } from "react-table";
import { useGroupHilitedElementsContext } from "../context/GroupHilitedElementsContext";
import { clearEmphasizedOverriddenElements, clearHiddenElements, visualizeElements, zoomToElements } from "../../common/viewerUtils";
import { GroupingMappingWidget } from "../../GroupingMappingWidget";

export interface OverlappedElementsInformationPanelProps {
  group?: GroupMinimal;
  onClose: () => void;
  overlappedElementsInfo: Map<string, OverlappedInfo[]>;
  groups: GroupMinimal[];
}

export interface OverlappedElementsDisplayProps {
  overlappedElements: string;
  groups: string[];
  elementsIds: string[];
}
type OverlappedTyped = CreateTypeFromInterface<OverlappedElementsDisplayProps>;

export const OverlappedElementsInformationPanel = ({ group, onClose, overlappedElementsInfo, groups }: OverlappedElementsInformationPanelProps) => {
  const [isOverlappedInfoLoading, setIsOverlappedInfoLoading] = useState<boolean>(false);
  const { setIsOverlappedColored } = useGroupHilitedElementsContext();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const columns = useMemo(
    (): Column<OverlappedTyped>[] => [
      {
        id: "number",
        Header: GroupingMappingWidget.translate("groups.overlappedElements"),
        accessor: "overlappedElements",
      },
      {
        id: "groups",
        Header: GroupingMappingWidget.translate("groups.overlappedGroups"),
        accessor: "groups",
        Cell: (value: CellProps<OverlappedTyped>) => {
          return (
            <div>
              {value.row.original.groups.map((groupName, index) => (
                <div key={index}>{groupName}</div>
              ))}
            </div>
          );
        },
      },
    ],
    [],
  );

  const key = group ? group.id : "";
  const overlappedInfo = overlappedElementsInfo.get(key);

  const arr: OverlappedElementsDisplayProps[] = useMemo(() => {
    setIsOverlappedInfoLoading(true);
    const result: OverlappedElementsDisplayProps[] = [];
    if (overlappedInfo) {
      setIsOverlappedColored(true);
      overlappedInfo.forEach((array) => {
        const groupNames: string[] = [];
        array.groupIds.forEach((groupId) => {
          const group = groups.find((group) => group.id === groupId);
          if (group) {
            groupNames.push(group.groupName);
          }
        });
        result.push({
          overlappedElements: array.elements.length.toString(),
          groups: groupNames,
          elementsIds: array.elements,
        });
      });
    }
    setIsOverlappedInfoLoading(false);
    return result;
  }, [overlappedInfo, groups, setIsOverlappedColored]);

  const handleClose = () => {
    setIsOverlappedColored(false);
    onClose();
  };

  const onSelect = useCallback(async (selectedData: CreateTypeFromInterface<OverlappedElementsDisplayProps>[] | undefined) => {
    try {
      setIsLoading(true);
      clearEmphasizedOverriddenElements();
      clearHiddenElements();
      if (selectedData && selectedData.length !== 0) {
        visualizeElements(selectedData[0].elementsIds, "red");
        await zoomToElements(selectedData[0].elementsIds);
      }
    } catch (error) {
      toaster.negative(GroupingMappingWidget.translate("groups.visualizingOverlappedError"));
      /* eslint-disable no-console */
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <InformationPanel isOpen={!!group} className="gmw-overlap-information">
      <InformationPanelHeader onClose={handleClose}>
        <Text variant="leading">{GroupingMappingWidget.translate("groups.overlapInfoOf", { groupName: group?.groupName ?? "" })}</Text>
      </InformationPanelHeader>
      <InformationPanelBody className="gmw-information-body">
        <Table<OverlappedTyped>
          columns={columns}
          data={arr}
          emptyTableContent={GroupingMappingWidget.translate("groups.noOverlaps")}
          isLoading={isOverlappedInfoLoading}
          isSortable={true}
          isSelectable
          selectionMode="single"
          onSelect={onSelect}
          isRowDisabled={() => isLoading}
        />
      </InformationPanelBody>
    </InformationPanel>
  );
};
