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
import type { Group } from "@itwin/insights-client";

export interface ExtractionMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  extractionMessageData: ExtractionMessageData[];
  timestamp: string;
}

export const ExtractionMessageModal = ({ isOpen, onClose, extractionMessageData, timestamp }: ExtractionMessageModalProps) => {
  const [formattedTimestamp, setFormattedTimestamp] = useState<string>("");
  const [formattedExtractionMessage, setFormattedExtractionMessage] = useState<ExtractionMessageData[]>([]);
  const groupingMappingApiConfig = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const { mappings } = useMappingsOperations({...groupingMappingApiConfig, mappingClient});
  
  const getMappingName = useCallback(async (mappingId: string) => {
    return mappings.find((mapping) => {return mapping.id === mappingId;})?.mappingName ?? "";
  }, [mappings]);
  
  const getGroupNames = useCallback(async (mappingId: string, groupId: string, groupsCache: Map<string, Group[]>) => {
    const accessToken = await groupingMappingApiConfig.getAccessToken();
    if(!groupsCache.has(mappingId)){
      const groups = await mappingClient.getGroups(
        accessToken,
        groupingMappingApiConfig.iModelId,
        mappingId
      );
      groupsCache.set(mappingId, groups);
    }
    return groupsCache.get(mappingId)?.find((group) => {return group.id === groupId;})?.groupName ?? "";
  }, [groupingMappingApiConfig, mappingClient]);
  
  useEffect(() => {
    const formatMessages = async () => {
      const groupsCache = new Map<string,Group[]>();
      const extractionMessageDataPromises = extractionMessageData.map(async (extractionMessage) => {
        let replacedMessage = extractionMessage.message;
        if(extractionMessage.message.includes("iModel")){
          replacedMessage = replacedMessage.replace(/iModel [\w-]+/, "iModel");
        }
        if(replacedMessage.includes("MappingId:")){
          const splittedMessage = replacedMessage.split(" ");
          const mappingId = splittedMessage[splittedMessage.indexOf("MappingId:") + 1];
          const groupId = splittedMessage[splittedMessage.indexOf("GroupId:") + 1];
          const mappingName = await getMappingName(mappingId);
          const groupName = await getGroupNames(mappingId, groupId, groupsCache);
          replacedMessage = replacedMessage.replace(/MappingId: [\w-]+/, `Mapping: ${mappingName}`);
          replacedMessage = replacedMessage.replace(/GroupId: [\w-]+/, `Group: ${groupName}`);
        }
        return {...extractionMessage, message: replacedMessage};
      });

      const newMessages = await Promise.all(extractionMessageDataPromises);
      setFormattedExtractionMessage(newMessages);
    };
    void formatMessages();
  }, [extractionMessageData, groupingMappingApiConfig, mappings, mappingClient, getGroupNames, getMappingName]);

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
          data={formattedExtractionMessage}
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
