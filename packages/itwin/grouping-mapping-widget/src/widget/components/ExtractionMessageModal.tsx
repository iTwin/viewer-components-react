/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Button, DefaultCell, Icon, Modal, ModalButtonBar, ModalContent, Table, tableFilters, Text } from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { CreateTypeFromInterface } from "../utils";
import type { ExtractionMessageData} from "./hooks/useMappingsOperations";
import { useMappingsOperations } from "./hooks/useMappingsOperations";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import { useMappingClient } from "./context/MappingClientContext";
import "./ExtractionMessageModal.scss";
import { SvgClock } from "@itwin/itwinui-icons-react";
import type { CellRendererProps, Column } from "react-table";
import { StatusIcon } from "./StatusIcon";
import { ExtractionLogCustomFilter } from "./ExtractionLogCustomFilter";

export interface ExtractionMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  extractionMessageData: ExtractionMessageData[];
  timestamp: string;
}

export const ExtractionMessageModal = ({ isOpen, onClose, extractionMessageData, timestamp }: ExtractionMessageModalProps) => {
  const [formattedTimestamp, setFormattedTimestamp] = useState<string>("");
  const groupingMappingApiConfig = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const [mappingId, setMappingId] = useState<string>("");
  const [groupId, setGroupId]  = useState<string>("");
  const { mappings } = useMappingsOperations({...groupingMappingApiConfig, mappingClient});
  useEffect(() => {
    extractionMessageData.forEach((extractionMessage) => {
      if(extractionMessage.message.includes("iModel")){
        extractionMessage.message = extractionMessage.message.replace(/iModel [\w-]+/, "iModel");
      }
    });
  }, [extractionMessageData]);
  const setMappingandGroupNames = useCallback (async (extractionMessage: ExtractionMessageData) => {
    if(mappingId){
      const mappingName = mappings.filter((mapping) => {return mapping.id === mappingId;});
      const accessToken = await groupingMappingApiConfig.getAccessToken();
      const groups = await mappingClient.getGroups(
        accessToken,
        groupingMappingApiConfig.iModelId,
        mappingId
      );
      const groupName = groups.filter((group) => {return group.id === groupId;});
      extractionMessage.message = extractionMessage.message.replace(/MappingId: [\w-]+/, `Mapping: ${  mappingName[0].mappingName}`);
      extractionMessage.message = extractionMessage.message.replace(/GroupingId: [\w-]+/, `Group: ${  groupName[0].groupName}`);
    }
  }, [mappingId, groupId, groupingMappingApiConfig, mappings, mappingClient]);
  useEffect(() => {
    extractionMessageData.forEach(async (extractionMessage) => {
      if(extractionMessage.message.includes("MappingId:")){
        const splittedMessage = extractionMessage.message.split(" ");
        setMappingId(splittedMessage[splittedMessage.indexOf("MappingId:") + 1]);
        setGroupId(splittedMessage[splittedMessage.indexOf("GroupingId:") + 1]);
        await setMappingandGroupNames(extractionMessage);
      }
    });
  }, [extractionMessageData, setMappingandGroupNames]);
  useEffect(() => {
    const newDateTime: Date = new Date(timestamp);
    const options: Intl.DateTimeFormatOptions = {
      day: "numeric", month: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    };
    setFormattedTimestamp(newDateTime.toLocaleString(undefined, options));
  }, [timestamp]);

  const translatedLabels = useMemo(() => ({
    filter: "Filter",
    clear: "Clear",
  }), []);
  const columns = useMemo(
    (): Column<CreateTypeFromInterface<ExtractionMessageData>>[] => [
      {
        id: "category",
        Header: "Category",
        accessor: "category",
        fieldType: "text",
        Filter: ExtractionLogCustomFilter,
        filter: "equals",
      },
      {
        id: "level",
        Header: "Level",
        accessor: "level",
        cellRenderer: ({ cellElementProps, cellProps }: CellRendererProps<CreateTypeFromInterface<ExtractionMessageData>>) => {
          const level = cellProps.row.original.level;
          return (
            <DefaultCell
              cellElementProps={cellElementProps}
              cellProps={cellProps}
              startIcon={
                level === "Error" ? (
                  <StatusIcon status='error' />
                ) : level === "Warning" ? (
                  <StatusIcon status='warning' />
                ) : level === "Info" ? (
                  <StatusIcon status='informational' />
                ) : <StatusIcon status='trace' />
              }
            >
              {level}
            </DefaultCell>
          );
        },
        Filter: ExtractionLogCustomFilter,
        filter: "equals",
      },
      {
        id: "message",
        Header: "Message",
        accessor: "message",
        width: "25vw",
        fieldType: "text",
        Filter: tableFilters.TextFilter(translatedLabels),
      },
    ],
    [translatedLabels]
  );
  return (
    <Modal className="gmw-message-modal-container"
      title="Extraction Logs"
      isOpen={isOpen}
      onClose={onClose}
      closeOnExternalClick={false}
    >
      <ModalContent>
        <div className="gmw-timestamp-icon">
          <Icon
            title="Extraction Timestamp"
            size="medium"
          >
            <SvgClock />
          </Icon>
          <Text>{formattedTimestamp}</Text>
        </div>
        <Table<CreateTypeFromInterface<ExtractionMessageData>>
          columns={columns}
          data={extractionMessageData}
          emptyTableContent={""}
          emptyFilteredTableContent="No results match filters."
          className="gmw-extraction-message-table-container"
        />
      </ModalContent>
      <ModalButtonBar>
        <Button
          onClick={onClose}
          styleType="high-visibility"
        >
            Close
        </Button>
      </ModalButtonBar>
    </Modal>
  );
};
