/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { Mapping } from "@itwin/insights-client";
import React, { useCallback, useEffect, useState } from "react";
import type { BeEvent } from "@itwin/core-bentley";
import { MappingUIActionGroup } from "./MappingViewActionGroup";
import { Anchor, ListItem, Text } from "@itwin/itwinui-react";
import { ExtractionStates } from "./Extraction/ExtractionStatus";
import { ExtractionStatus } from "./Extraction/ExtractionStatus";
import { useExtractionStateJobContext } from "../context/ExtractionStateJobContext";
import { useFetchMappingExtractionStatus } from "./hooks/useFetchMappingExtractionStatus";
import "./MappingListItem.scss";
import { useGroupingMappingApiConfig } from "../context/GroupingApiConfigContext";

export interface MappingListItemProps {
  selected: boolean;
  onSelectionChange: (mapping: Mapping) => void;
  mapping: Mapping;
  jobId: string;
  jobStartEvent: BeEvent<(mappingId: string) => void>;
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
  initialStateExtractionFlag,
  setInitialExtractionStateFlag,
}: MappingListItemProps) => {
  const [extractionState, setExtractionState] = useState<ExtractionStates | undefined>(ExtractionStates.None);
  const { mappingIdJobInfo, setMappingIdJobInfo } = useExtractionStateJobContext();
  const groupingMappingApiConfig = useGroupingMappingApiConfig();
  const [isJobStarted, setIsJobStarted] = useState<boolean>(false);
  const statusQuery = useFetchMappingExtractionStatus({ ...groupingMappingApiConfig, mapping, enabled: isJobStarted });

  const onClickTile = () => {
    onSelectionChange(mapping);
  };

  useEffect(() => {
    // Only apply to all mappings when the page is reloaded, not the list component
    // or when users modify mappings
    if (initialStateExtractionFlag && setInitialExtractionStateFlag) {
      setIsJobStarted(true);
      setInitialExtractionStateFlag(false);
    }
  }, [initialStateExtractionFlag, setInitialExtractionStateFlag]);

  // Check whether the job is still running when users refresh the mapping list
  // or modify any mappings
  useEffect(() => {
    if(mappingIdJobInfo.get(mapping.id)){
      setIsJobStarted(true);
    }
  }, [mappingIdJobInfo, mapping.id]);

  const resolveTerminalExtractionStatus = useCallback(async () => {
    if(statusQuery.data!.finalExtractionStateValue === ExtractionStates.Failed || statusQuery.data!.finalExtractionStateValue === ExtractionStates.Succeeded){
      setIsJobStarted(false);
      setMappingIdJobInfo((prevMap: Map<string, string>) => {
        const newMap = new Map(prevMap);
        newMap.delete(mapping.id);
        return newMap;
      });
      // await resetMappingExtractionStatus(queryClient);
    }
  }, [mapping.id, setMappingIdJobInfo, statusQuery.data]);

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
    const isStatusReady = statusQuery.data && statusQuery.isFetched && !statusQuery.isStale;
    if (isStatusReady) {
      setExtractionState(statusQuery.data.finalExtractionStateValue);
      // No need to await. We don't need to wait for the status to be resolved in invalidation.
      void resolveTerminalExtractionStatus();
    }
  }, [resolveTerminalExtractionStatus, statusQuery]);

  return (
    <ListItem actionable
      className="gmw-list-item-container"
      active={selected}
      key={mapping.id}
      onClick={onClickTile}
      title={mapping.mappingName}>
      <ListItem.Content>
        <Anchor onClick={onClickMappingTitle ? () => onClickMappingTitle?.(mapping) : undefined}>{mapping.mappingName ? mapping.mappingName : "Untitled"}</Anchor>
        {mapping.description && <Text className="gmw-body-text" isMuted={true} title={mapping.description} variant="small">{mapping.description}</Text>}
      </ListItem.Content>
      <ExtractionStatus
        state={extractionState}
        clearExtractionState={() => {
          setExtractionState(ExtractionStates.None);
        }}
      ></ExtractionStatus >
      <MappingUIActionGroup
        mapping={mapping}
        onToggleExtraction={onToggleExtraction}
        onRefresh={onRefreshMappings}
        onClickMappingModify={onClickMappingModify}
        setShowDeleteModal={setShowDeleteModal}
      />
    </ListItem>
  );
};
