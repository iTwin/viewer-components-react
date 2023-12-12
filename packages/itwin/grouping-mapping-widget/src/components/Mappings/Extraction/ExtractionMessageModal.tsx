/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Button, DefaultCell, Icon, Modal, ModalButtonBar, ModalContent, Table, tableFilters, Text } from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { CreateTypeFromInterface } from "../../../common/utils";
import "./ExtractionMessageModal.scss";
import { SvgClock } from "@itwin/itwinui-icons-react";
import type { CellRendererProps, Column } from "react-table";
import { StatusIcon } from "../../SharedComponents/StatusIcon";
import { ExtractionLogCustomFilter } from "./ExtractionLogCustomFilter";
import { useGroupingMappingApiConfig } from "../../context/GroupingApiConfigContext";
import { useMappingClient } from "../../context/MappingClientContext";
import { useMappingsOperations } from "../hooks/useMappingsOperations";
import type { Mapping } from "@itwin/insights-client";
import { useQueries } from "@tanstack/react-query";
import { useMemoizedCollectionPick } from "../../../common/hooks/useMemoizedCollectionPick";

export interface ExtractionMessageData {
  date: string;
  category: string;
  level: string;
  message: string;
}

export interface ExtractionMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  extractionMessageData: ExtractionMessageData[];
  timestamp: string;
}

export const ExtractionMessageModal = ({ isOpen, onClose, extractionMessageData, timestamp }: ExtractionMessageModalProps) => {
  const [formattedExtractionMessage, setFormattedExtractionMessage] = useState<ExtractionMessageData[] | undefined>(undefined);
  const groupingMappingApiConfig = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const { mappings, isLoading: isMappingsLoading } = useMappingsOperations({ ...groupingMappingApiConfig, mappingClient });
  const [formattedTimestamp, setFormattedTimestamp] = useState<string>("");

  const getMappingName = useCallback((mappingId: string, mappings: Mapping[]) => {
    return mappings.find((mapping) => mapping.id === mappingId)?.mappingName ?? "";
  }, []);

  // Extract groupIds and mappingIds from messages
  const extractionInfo = useMemo(() => {
    return extractionMessageData.reduce<{
      mappingId: string;
      groupId: string;
    }[]>((acc, message) => {
      const splittedMessage = message.message.split(" ");
      const mappingId = splittedMessage[splittedMessage.indexOf("MappingId:") + 1]?.match(/^([^,]+),$/)?.[1];
      const groupId = splittedMessage[splittedMessage.indexOf("GroupId:") + 1]?.match(/^([^,]+).$/)?.[1];

      if (mappingId && groupId) {
        acc.push({ mappingId, groupId });
      }
      return acc;
    }, []);
  }, [extractionMessageData]);

  // useQueries to fetch all group names
  const groupQueriesResults = useQueries({
    queries: extractionInfo.map(({ mappingId, groupId }) => ({
      queryKey: ["groups", mappingId, groupId],
      queryFn: async () => {
        const accessToken = await groupingMappingApiConfig.getAccessToken();
        const groups = await mappingClient.getGroups(
          accessToken,
          groupingMappingApiConfig.iModelId,
          mappingId
        );
        return groups.find((group) => group.id === groupId)?.groupName ?? "";
      },
    })),
  });

  // Workaround to get data from useQueries with more stability
  const pickedResult = useMemoizedCollectionPick(groupQueriesResults, ["data", "error", "isLoading", "isSuccess"]);

  useEffect(() => {
    if (pickedResult.every((query) => query.isSuccess) && mappings) {
      const formattedMessages = extractionMessageData.map((extractionMessage, index) => {
        let replacedMessage: string = extractionMessage.message;

        const { mappingId } = extractionInfo[index];
        const groupName = pickedResult[index].data;

        if (replacedMessage.includes("MappingId:")) {
          const mappingName = getMappingName(mappingId, mappings);
          replacedMessage = replacedMessage.replace(/MappingId: [\w-]+/, `Mapping: ${mappingName}`);
        }

        if (replacedMessage.includes("GroupId:")) {
          replacedMessage = replacedMessage.replace(/GroupId: [\w-]+/, `Group: ${groupName ? groupName : "<Not Found>"}`);
        }

        return { ...extractionMessage, message: replacedMessage };
      });

      setFormattedExtractionMessage(formattedMessages);
    }
  }, [extractionMessageData, mappings, extractionInfo, getMappingName, pickedResult]);

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
  const isLoading = pickedResult.some((query) => query.isLoading) || isMappingsLoading;

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
          data={formattedExtractionMessage ?? []}
          emptyTableContent={""}
          emptyFilteredTableContent="No results match filters."
          className="gmw-extraction-message-table-container"
          isLoading={isLoading}
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
