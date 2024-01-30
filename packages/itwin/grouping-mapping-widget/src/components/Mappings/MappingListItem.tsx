/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { Mapping } from "@itwin/insights-client";
import React, { useEffect, useState } from "react";
import type { BeEvent } from "@itwin/core-bentley";
import { MappingUIActionGroup } from "./MappingViewActionGroup";
import { useGroupingMappingApiConfig } from "../context/GroupingApiConfigContext";
import { Anchor, ListItem, Text } from "@itwin/itwinui-react";
import { ExtractionStates } from "./Extraction/ExtractionStatus";
import { ExtractionStatus } from "./Extraction/ExtractionStatus";
import { useRunExtraction } from "./hooks/useRunExtraction";
import { useFetchMappingExtractionStatus } from "./hooks/useFetchMappingExtractionStatus";
import { useExtractionStateJobContext } from "../context/ExtractionStateJobContext";
import "./MappingListItem.scss";

export interface MappingListItemProps {
  selected: boolean;
  onSelectionChange: (mapping: Mapping) => void;
  mapping: Mapping;
  jobId?: string;
  jobStartEvent: BeEvent<(mappingId: string) => void>;
  onClickMappingTitle?: (mapping: Mapping) => void;
  onClickMappingModify?: (mapping: Mapping) => void;
  onRefreshMappings: () => Promise<void>;
  onToggleExtraction: (mapping: Mapping) => Promise<void>;
  setShowDeleteModal: (mapping?: Mapping) => void;
  isRunExtractionLoading: boolean;
}

export const MappingListItem = (props: MappingListItemProps) => {
  const [extractionState, setExtractionState] = useState<ExtractionStates | undefined>(ExtractionStates.None);
  const groupingMappingApiConfig = useGroupingMappingApiConfig();
  const { isJobStarted, setIsJobStarted } = useRunExtraction({...groupingMappingApiConfig, jobId: props.jobId});
  const { mappingIdJobInfo, setMappingIdJobInfo } = useExtractionStateJobContext();
  const { statusQuery } = useFetchMappingExtractionStatus({getAccessToken: groupingMappingApiConfig.getAccessToken, mapping: props.mapping, enabled: isJobStarted});

  const onClickTile = () => {
    props.onSelectionChange(props.mapping);
  };

  useEffect(() => {
    const listener = (startedMappingId: string) => {
      if (startedMappingId === props.mapping.id) {
        setIsJobStarted(true);
      }
    };
    props.jobStartEvent.addListener(listener);

    return () => {
      props.jobStartEvent.removeListener(listener);
    };
  }, [props.jobStartEvent, props.mapping.id, setIsJobStarted]);

  useEffect(() => {
    if(isJobStarted){
      if(!statusQuery.data){
        setExtractionState(ExtractionStates.None);
      } else {
        setExtractionState(statusQuery.data.finalExtractionStateValue);

        if(statusQuery.data.finalExtractionStateValue === ExtractionStates.Succeeded || statusQuery.data.finalExtractionStateValue === ExtractionStates.Failed){
          setIsJobStarted(false);
          mappingIdJobInfo.delete(props.mapping.id);
          setMappingIdJobInfo(mappingIdJobInfo);
        }
      }
    }
  },[isJobStarted, statusQuery, setIsJobStarted, mappingIdJobInfo, setMappingIdJobInfo, props.mapping.id]);

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
