/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { Mapping } from "@itwin/insights-client";
import React, { useCallback, useEffect, useState } from "react";
import type { BeEvent } from "@itwin/core-bentley";
import { MappingViewActionGroup } from "./MappingViewActionGroup";
import { Anchor, ListItem } from "@itwin/itwinui-react";
import { ExtractionStates } from "./Extraction/ExtractionStatus";
import { ExtractionStatus } from "./Extraction/ExtractionStatus";
import { useExtractionStateJobContext } from "../context/ExtractionStateJobContext";
import { useFetchMappingExtractionStatus } from "./hooks/useFetchMappingExtractionStatus";
import "./MappingListItem.scss";
import { useGroupingMappingApiConfig } from "../context/GroupingApiConfigContext";
import { useQueryClient } from "@tanstack/react-query";

export interface MappingListItemProps {
  selected: boolean;
  mapping: Mapping;
  jobId: string;
  jobStartEvent: BeEvent<(mappingId: string) => void>;
  onSelectionChange?: (mapping: Mapping) => void;
  onClickMappingTitle?: (mapping: Mapping) => void;
  onClickMappingModify?: (mapping: Mapping) => void;
  onRefreshMappings: () => Promise<void>;
  onToggleExtraction: (mapping: Mapping) => Promise<void>;
  setShowDeleteModal: (mapping?: Mapping) => void;
  initialStateExtractionFlag?: boolean;
  setInitialExtractionStateFlag?: (initialStateExtractionFlag: boolean) => void;
}

export const MappingListItem = ({
  selected,
  onSelectionChange,
  mapping,
  jobId,
  jobStartEvent,
  onClickMappingModify,
  onClickMappingTitle,
  onRefreshMappings,
  onToggleExtraction,
  setShowDeleteModal,
}: MappingListItemProps) => {
  const [extractionState, setExtractionState] = useState<ExtractionStates | undefined>(ExtractionStates.None);
  const { mappingIdJobInfo, setMappingIdJobInfo } = useExtractionStateJobContext();
  const groupingMappingApiConfig = useGroupingMappingApiConfig();
  const [isJobStarted, setIsJobStarted] = useState<boolean>(false);
  const statusQuery = useFetchMappingExtractionStatus({ ...groupingMappingApiConfig, mapping, enabled: isJobStarted });
  const queryClient = useQueryClient();

  const onClickTile = useCallback(() => {
    onSelectionChange && onSelectionChange(mapping);
  }, [mapping, onSelectionChange]);

  // Check whether the job is still running when users refresh the mapping list
  // or modify any mappings
  useEffect(() => {
    if (mappingIdJobInfo.get(mapping.id)) {
      setIsJobStarted(true);
    }
  }, [mappingIdJobInfo, mapping.id]);

  const resolveTerminalExtractionStatus = useCallback(async () => {
    const state = statusQuery.data!.finalExtractionStateValue;
    if (state === ExtractionStates.Failed || state === ExtractionStates.Succeeded) {
      setIsJobStarted(false);
      setMappingIdJobInfo((prevMap: Map<string, string>) => {
        const newMap = new Map(prevMap);
        newMap.delete(mapping.id);
        return newMap;
      });
      await queryClient.invalidateQueries({ queryKey: ["iModelExtractionStatus"] });
    }
  }, [mapping.id, queryClient, setMappingIdJobInfo, statusQuery.data]);

  useEffect(() => {
    const listener = (startedMappingId: string) => {
      if (startedMappingId === mapping.id) {
        setExtractionState(ExtractionStates.Starting);
        setIsJobStarted(true);
      }
    };
    jobStartEvent.addListener(listener);

    return () => {
      jobStartEvent.removeListener(listener);
    };
  }, [jobStartEvent, mapping.id, jobId]);

  useEffect(() => {
    const isStatusReady = statusQuery.data && statusQuery.isFetched;
    if (isStatusReady) {
      setExtractionState(statusQuery.data.finalExtractionStateValue);
      // No need to await. We don't need to wait for the status to be resolved in invalidation.
      void resolveTerminalExtractionStatus();
    }
  }, [resolveTerminalExtractionStatus, statusQuery]);

  return (
    <ListItem
      actionable={!!onSelectionChange}
      className="gmw-mapping-list-item"
      active={selected}
      key={mapping.id}
      onClick={onClickTile}
      title={mapping.mappingName}
    >
      <ListItem.Content>
        {onClickMappingTitle ? <Anchor onClick={() => onClickMappingTitle(mapping)}>{mapping.mappingName}</Anchor> : mapping.mappingName}
        <ListItem.Description>{mapping.description}</ListItem.Description>
      </ListItem.Content>
      <ExtractionStatus
        state={extractionState}
        clearExtractionState={() => {
          setExtractionState(ExtractionStates.None);
        }}
      ></ExtractionStatus>
      <MappingViewActionGroup
        mapping={mapping}
        onToggleExtraction={onToggleExtraction}
        onRefresh={onRefreshMappings}
        onClickMappingModify={onClickMappingModify}
        setShowDeleteModal={setShowDeleteModal}
      />
    </ListItem>
  );
};
