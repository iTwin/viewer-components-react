/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { Mapping } from "@itwin/insights-client";
import React, { useEffect } from "react";
import type { BeEvent } from "@itwin/core-bentley";
import { MappingUIActionGroup } from "./MappingViewActionGroup";
import { useRef, useState } from "react";
import { useGroupingMappingApiConfig } from "../context/GroupingApiConfigContext";
import { Anchor, ListItem, Text } from "@itwin/itwinui-react";
import { ExtractionStates } from "./Extraction/ExtractionStatus";
import { ExtractionStatus } from "./Extraction/ExtractionStatus";
import { useFetchExtractionStates } from "./hooks/useFetchExtractionStates";
import "./MappingList.scss";

export interface MappingHorizontalTileProps {
  selected: boolean;
  onSelectionChange: (mapping: Mapping) => void;
  mapping: Mapping;
  jobStartEvent: BeEvent<(mappingId: string) => void>;
  onClickMappingTitle?: (mapping: Mapping) => void;
  onClickMappingModify?: (mapping: Mapping) => void;
  onRefreshMappings: () => Promise<void>;
  onToggleExtraction: (mapping: Mapping) => Promise<void>;
  setShowDeleteModal: (mapping?: Mapping) => void;
}

export const MappingHorizontalTile = (props: MappingHorizontalTileProps) => {
  const [extractionState, setExtractionState] = useState<ExtractionStates | undefined>(ExtractionStates.None);
  const groupingMappingApiConfig = useGroupingMappingApiConfig();
  const { extractionStateData, isJobStarted, isJobDone, setIsJobDone, setIsJobStarted } = useFetchExtractionStates(groupingMappingApiConfig);

  const onClickTile = () => {
    props.onSelectionChange(props.mapping);
  };

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
  }, [props.jobStartEvent, props.mapping.id]);

  useEffect(() => {
    if (isJobStarted === true || isJobDone === true) {
      setExtractionState(extractionStateData);
    }
  }, [extractionStateData]);

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
          setIsJobDone(false);
          setExtractionState(ExtractionStates.None)
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
}
