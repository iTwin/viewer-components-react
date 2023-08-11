/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import { useMemo, useState } from "react";
import type { CreateTypeFromInterface } from "../utils";
import { InformationPanel, InformationPanelBody, InformationPanelHeader, Table, Text } from "@itwin/itwinui-react";
import "./OverlappedElementsInformationPanel.scss";
import type { Group } from "@itwin/insights-client";
import type { OverlappedInfo } from "./context/GroupHilitedElementsContext";
import type { CellProps } from "react-table";
import { OverlappedElementsRadioButton } from "./OverlappedElementsRadioButton";
import { useGroupHilitedElementsContext } from "./context/GroupHilitedElementsContext";

export interface OverlappedElementsInformationPanelProps {
  group?: Group;
  onClose: () => void;
  overlappedElementsInfo: Map<string, OverlappedInfo[]>;
  groups: Group[];
}

export interface OverlappedElementsDisplayProps {
  numberOfElements: string;
  groups: string[];
  elementsIds: string[];
}
type OverlappedTyped = CreateTypeFromInterface<OverlappedElementsDisplayProps>;

export const OverlappedElementsInformationPanel = ({ group, onClose, overlappedElementsInfo, groups }: OverlappedElementsInformationPanelProps) => {
  const [isOverlappedInfoLoading, setIsOverlappedInfoLoading] = useState<boolean>(false);
  const { setIsOverlappedColored } = useGroupHilitedElementsContext();
  const [activeToggleIndex, setActiveToggleIndex] = useState<number>(-1);

  const columns = useMemo(
    () => [
      {
        Header: "Table",
        columns: [
          {
            id: "number",
            Header: "Number of Overlapped elements",
            accessor: "numberOfElements",
          },
          {
            id: "groups",
            Header: "Groups",
            accessor: "groups",
            Cell: (value: CellProps<OverlappedTyped>) => {
              return (
                <div>
                  {value.row.original.groups.map((groupName, index) => (
                    <div key={index}>{groupName}</div>
                  ))}
                </div>);
            },
          },
          {
            id: "radio",
            width: 80,
            accessor: "elementsIds",
            Cell: ({ value, row }: CellProps<OverlappedTyped>) => {

              const isToggleActive = activeToggleIndex === row.index;

              return (<OverlappedElementsRadioButton
                color={"red"}
                ids={value}
                showOverlappedColor={isToggleActive}
                setShowOverlappedColor={() => {
                  setActiveToggleIndex(row.index);
                }}

                labelPosition="left" />);
            },
          },
        ],
      },
    ],
    [activeToggleIndex]
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
        result.push({ numberOfElements: array.elements.length.toString(), groups: groupNames, elementsIds: array.elements });
      });
    }
    setIsOverlappedInfoLoading(false);
    return result;
  }, [overlappedInfo, groups, setIsOverlappedColored]);

  const handleClose = () => {
    setActiveToggleIndex(-1);
    setIsOverlappedColored(false);
    onClose();
  };

  return (
    <InformationPanel isOpen={!!group} className="gmw-overlap-information">
      <InformationPanelHeader onClose={handleClose}>
        <Text variant="leading">{`${group?.groupName} Overlap Info`}</Text>
      </InformationPanelHeader>
      <InformationPanelBody className="gmw-information-body">
        <Table<OverlappedTyped>
          columns={columns}
          data={arr}
          emptyTableContent='No Overlaps.'
          isLoading={isOverlappedInfoLoading}
          isSortable={true}
        />
      </InformationPanelBody>
    </InformationPanel>
  );
};
