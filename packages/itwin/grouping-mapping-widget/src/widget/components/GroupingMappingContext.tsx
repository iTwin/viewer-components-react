/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./GroupingMapping.scss";
import type { IModelConnection } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import type {
  ClientPrefix,
  GetAccessTokenFn,
  GroupingMappingApiConfig,
} from "./context/GroupingApiConfigContext";
import { GroupingMappingApiConfigContext } from "./context/GroupingApiConfigContext";
import {
  createMappingClient,
  MappingClientContext,
} from "./context/MappingClientContext";
import type { CalculatedProperty, CustomCalculation, Group, GroupProperty, IMappingsClient } from "@itwin/insights-client";
import { createGroupingMappingCustomUI, GroupingMappingCustomUIContext } from "./context/GroupingMappingCustomUIContext";
import type { GroupingMappingCustomUI } from "./customUI/GroupingMappingCustomUI";
import type { OverlappedInfo , QueryCacheItem } from "./context/GroupHilitedElementsContext";
import { GroupHilitedElementsContext } from "./context/GroupHilitedElementsContext";
import { PropertiesContext } from "./context/PropertiesContext";
import { useActiveIModelConnection } from "@itwin/appui-react";

export interface GroupingMappingContextProps {
  /**
   * Custom callback to retrieve access token.
   */
  getAccessToken?: GetAccessTokenFn;
  /**
   * The iTwin iModel Id.
   */
  iModelId: string;
  /**
   * Used for iTwin and iModel APIs.
   * Also used for Mapping API if a custom {@link client} is not provided.
   */
  prefix?: ClientPrefix;
  /**
   * A custom implementation of MappingClient.
   */
  client?: IMappingsClient;
  /**
   * Custom UI to add and update groups or provide additional group context capabilities.
   */
  customUIs?: GroupingMappingCustomUI[];
  /**
   * A custom iModelConnection to use instead of the active iModelConnection from UiFramework.
   */
  iModelConnection?: IModelConnection;
  children?: React.ReactNode;
}

const authorizationClientGetAccessToken = async () =>
  (await IModelApp.authorizationClient?.getAccessToken()) ?? "";

export const GroupingMappingContext = (props: GroupingMappingContextProps) => {
  const activeIModelConntextion = useActiveIModelConnection();
  const clientProp: IMappingsClient | ClientPrefix = props.client ?? props.prefix;
  const [mappingClient, setMappingClient] = useState<IMappingsClient>(createMappingClient(clientProp));
  const [customUIs, setCustomUIs] = useState<GroupingMappingCustomUI[]>(
    createGroupingMappingCustomUI(props.customUIs),
  );
  const [apiConfig, setApiConfig] = useState<GroupingMappingApiConfig>({
    getAccessToken: props.getAccessToken ?? authorizationClientGetAccessToken,
    iModelId: props.iModelId,
    prefix: props.prefix,
  });
  const hilitedElementsQueryCache = useRef<Map<string, QueryCacheItem>>(new Map());
  const [hiddenGroupsIds, setHiddenGroupsIds] = useState<Set<string>>(new Set());
  const [showGroupColor, setShowGroupColor] = useState<boolean>(false);
  const [propertiesShowGroup, setPropertiesShowGroup] = useState<boolean>(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupProperties, setGroupProperties] = useState<GroupProperty[]>([]);
  const [calculatedProperties, setCalculatedProperties] = useState<CalculatedProperty[]>([]);
  const [customCalculationProperties, setCustomCalculationProperties] = useState<CustomCalculation[]>([]);
  const [numberOfVisualizedGroups, setNumberOfVisualizedGroups] = useState(0);
  const [overlappedElementsInfo, setOverlappedElementsInfo] = useState<Map<string, OverlappedInfo[]>>(new Map());
  const [groupElementsInfo, setGroupElementsInfo] = useState<Map<string, number>>(new Map());
  const [isOverlappedColored, setIsOverlappedColored] = useState<boolean>(false);
  const [totalNumberOfVisualization, setTotalNumberOfVisualization] = useState<number>(1);

  useEffect(() => {
    setApiConfig(() => ({
      prefix: props.prefix,
      iModelId: props.iModelId,
      getAccessToken: props.getAccessToken ?? authorizationClientGetAccessToken,
      iModelConnection: props.iModelConnection ?? activeIModelConntextion,
    }));
  }, [activeIModelConntextion, props.getAccessToken, props.iModelConnection, props.iModelId, props.prefix]);

  useEffect(() => {
    setMappingClient(createMappingClient(clientProp));
  }, [clientProp]);

  useEffect(() => {
    setCustomUIs(createGroupingMappingCustomUI(props.customUIs));
  }, [props.customUIs]);

  const hilitedElementsContextValue = useMemo(
    () => ({
      showGroupColor,
      setShowGroupColor,
      hiddenGroupsIds,
      setHiddenGroupsIds,
      hilitedElementsQueryCache,
      groups,
      setGroups,
      numberOfVisualizedGroups,
      setNumberOfVisualizedGroups,
      overlappedElementsInfo,
      setOverlappedElementsInfo,
      groupElementsInfo,
      setGroupElementsInfo,
      isOverlappedColored,
      setIsOverlappedColored,
      totalNumberOfVisualization,
      setTotalNumberOfVisualization,
    }),
    [groups, hiddenGroupsIds, showGroupColor, numberOfVisualizedGroups, overlappedElementsInfo, groupElementsInfo, isOverlappedColored, totalNumberOfVisualization]
  );

  const propertiesContextValue = useMemo(
    () => ({
      showGroupColor: propertiesShowGroup,
      setShowGroupColor: setPropertiesShowGroup,
      groupProperties,
      setGroupProperties,
      calculatedProperties,
      setCalculatedProperties,
      customCalculationProperties,
      setCustomCalculationProperties,
    }),
    [calculatedProperties, customCalculationProperties, groupProperties, propertiesShowGroup]
  );

  const customUIContextValue = useMemo(() => ({
    customUIs,
    setCustomUIs,
  }), [customUIs]);

  return (
    <GroupingMappingApiConfigContext.Provider value={apiConfig}>
      <MappingClientContext.Provider value={mappingClient}>
        <GroupingMappingCustomUIContext.Provider value={customUIContextValue}>
          <GroupHilitedElementsContext.Provider value={hilitedElementsContextValue}>
            <PropertiesContext.Provider value={propertiesContextValue}>
              {props.children}
            </PropertiesContext.Provider>
          </GroupHilitedElementsContext.Provider>
        </GroupingMappingCustomUIContext.Provider>
      </MappingClientContext.Provider>
    </GroupingMappingApiConfigContext.Provider>
  );
};
