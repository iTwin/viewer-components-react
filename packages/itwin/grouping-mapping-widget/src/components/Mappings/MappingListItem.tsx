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
import { resetMappingExtractionStatus } from "./hooks/useFetchMappingExtractionStatus";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetchMappingExtractionStatus } from "./hooks/useFetchMappingExtractionStatus";
import "./MappingListItem.scss";
import { useGroupingMappingApiConfig } from "../context/GroupingApiConfigContext";
import { useIsMounted } from "../../common/hooks/useIsMounted";

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
}

export const MappingListItem = (props: MappingListItemProps) => {
  const [extractionState, setExtractionState] = useState<ExtractionStates | undefined>(ExtractionStates.None);
  const { mappingIdJobInfo, setMappingIdJobInfo } = useExtractionStateJobContext();
  const groupingMappingApiConfig = useGroupingMappingApiConfig();
  const [isJobStarted, setIsJobStarted] = useState<boolean>(false);
  const [isListItemMounted, setIsListItemMounted] = useState<boolean>(false);
  const isMounted = useIsMounted();
  const { statusQuery } = useFetchMappingExtractionStatus({isMounted: isListItemMounted, ...groupingMappingApiConfig, mapping: props.mapping, enabled: isJobStarted});
  const queryClient = useQueryClient();

  const onClickTile = () => {
    props.onSelectionChange(props.mapping);
  };

  useEffect(() => {
    if(isMounted()){
      setIsListItemMounted(true);
      setIsJobStarted(true);
    }
  }, [isMounted]);

  // Check whether the job is still running when users refresh the mapping list
  // or modify any mappings
  useEffect(() => {
    if(mappingIdJobInfo.get(props.mapping.id)){
      setIsJobStarted(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mappingIdJobInfo]);

  const resolveTerminalExtractionStatus = useCallback(async () => {
    if(statusQuery.data!.finalExtractionStateValue === ExtractionStates.Failed || statusQuery.data!.finalExtractionStateValue === ExtractionStates.Succeeded){
      setIsJobStarted(false);
      setMappingIdJobInfo((prevMap: Map<string, string>) => {
        const newMap = new Map(prevMap);
        newMap.delete(props.mapping.id);
        return newMap;
      });
      await resetMappingExtractionStatus(props.mapping.id, queryClient);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusQuery, props.mapping.id]);

  useEffect(() => {
    const listener = (startedMappingId: string) => {
      if (startedMappingId === props.mapping.id) {
        setExtractionState(ExtractionStates.Starting);
        setIsJobStarted(true);
      }
    };
    props.jobStartEvent.addListener(listener);

    return () => {
      props.jobStartEvent.removeListener(listener);
    };
  }, [props.jobStartEvent, props.mapping.id, props.jobId, props]);

  const onResolveStatusData = useMutation({
    mutationKey: ["onResolveStatusData", isJobStarted],
    mutationFn: async () => {
      setExtractionState(statusQuery.data!.finalExtractionStateValue);
      await resolveTerminalExtractionStatus();
    },
  });

  useEffect(() => {
    const isStatusReady = statusQuery.data && statusQuery.isFetched && !statusQuery.isStale;
    if(isJobStarted && isStatusReady){
      onResolveStatusData.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[isJobStarted, statusQuery]);

  return (
    <ListItem actionable
      className="gmw-list-item-container"
      active={props.selected}
      key={props.mapping.id}
      onClick={onClickTile}
      title={props.mapping.mappingName}>
      <ListItem.Content>
        <Anchor onClick={props.onClickMappingTitle ? () => props.onClickMappingTitle?.(props.mapping) : undefined}>{props.mapping.mappingName ? props.mapping.mappingName : "Untitled"}</Anchor>
        {props.mapping.description && <Text className="gmw-body-text" isMuted={true} title={props.mapping.description} variant="small">{props.mapping.description}</Text>}
      </ListItem.Content>
      <ExtractionStatus
        state={extractionState}
        clearExtractionState={() => {
          setExtractionState(ExtractionStates.None);
        }}
      ></ExtractionStatus >
      <MappingUIActionGroup
        mapping={props.mapping}
        onToggleExtraction={props.onToggleExtraction}
        onRefresh={props.onRefreshMappings}
        onClickMappingModify={props.onClickMappingModify}
        setShowDeleteModal={props.setShowDeleteModal}
      />
    </ListItem>
  );
};
