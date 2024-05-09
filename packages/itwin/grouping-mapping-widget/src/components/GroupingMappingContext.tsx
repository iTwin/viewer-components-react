/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useEffect, useMemo, useState } from "react";
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
import type { Group, IExtractionClient, IGroupsClient, IMappingsClient, IPropertiesClient } from "@itwin/insights-client";
import { createGroupingMappingCustomUI, GroupingMappingCustomUIContext } from "./context/GroupingMappingCustomUIContext";
import type { GroupingMappingCustomUI } from "./customUI/GroupingMappingCustomUI";
import type { OverlappedElementsMetadata } from "./context/GroupHilitedElementsContext";
import { GroupHilitedElementsContext } from "./context/GroupHilitedElementsContext";
import { PropertiesGroupColorContext } from "./context/PropertiesGroupColorContext";
import { useActiveIModelConnection } from "@itwin/appui-react";
import { createExtractionClient, ExtractionClientContext } from "./context/ExtractionClientContext";
import type { Query } from "@tanstack/react-query";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toaster } from "@itwin/itwinui-react";
import { getErrorMessage } from "../common/utils";
import { TErrCodes } from "./Constants";
import { ExtractionStatusJobContext } from "./context/ExtractionStateJobContext";
import { createGroupsClient, GroupsClientContext } from "./context/GroupsClientContext";
import { createPropertiesClient, PropertiesClientContext } from "./context/PropertiesClientContext";

/**
 * Props for the {@link GroupingMappingContext} component.
 * @public
 */
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
   * Also used for Mapping API if a custom IMappingsClient is not provided.
   */
  prefix?: ClientPrefix;
  /**
   * A custom implementation of MappingClient.
   */
  mappingsClient?: IMappingsClient;
  /**
   * A custom implementation of GroupsClient.
   */
  groupsClient?: IGroupsClient;
  /**
   * A custom implementation of PropertiesClient.
   */
  propertiesClient?: IPropertiesClient;
  /**
   * A custom implementation of ExtractionClient.
   */
  extractionClient?: IExtractionClient;
  /**
   * Custom UI to add and update groups or provide additional group context capabilities.
   */
  customUIs?: GroupingMappingCustomUI[];
  /**
   * A custom iModelConnection to use instead of the active iModelConnection from UiFramework.
   */
  iModelConnection?: IModelConnection;
  /**
   * A custom QueryClient. If not provided, a default QueryClient will be used.
   */
  queryClient?: QueryClient;
  children?: React.ReactNode;
}

const authorizationClientGetAccessToken = async () =>
  (await IModelApp.authorizationClient?.getAccessToken()) ?? "";

const defaultQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 20 * 60 * 1000, // 20 minutes
    },
  },
  queryCache: new QueryCache({
    onError: (error: any, query: Query) => {
      switch (query.meta?.errorCode) {
        case TErrCodes.QUERY_HILITE_FETCH_FAILED:
          toaster.negative(query.meta?.message as string);
          break;
        default: {
          if (error.status)
            toaster.negative(getErrorMessage(error.status));
          else
            toaster.negative("An error occurred while fetching data.");
        }
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error: any) => {
      if (error.status)
        toaster.negative(getErrorMessage(error.status));
      else
        toaster.negative("A network error occured while processing this action.");
    },
  }),
});

/**
 * Grouping and Mapping Context providers required for all components.
 * @public
 */
export const GroupingMappingContext = (props: GroupingMappingContextProps) => {
  const activeIModelConnection = useActiveIModelConnection();
  const mappingsClientProp: IMappingsClient | ClientPrefix = props.mappingsClient ?? props.prefix;
  const groupsClientProp: IGroupsClient | ClientPrefix = props.groupsClient ?? props.prefix;
  const propertiesClientProp: IPropertiesClient | ClientPrefix = props.propertiesClient ?? props.prefix;
  const extractionClientProp: IExtractionClient | ClientPrefix = props.extractionClient ?? props.prefix;
  const [mappingClient, setMappingClient] = useState<IMappingsClient>(createMappingClient(mappingsClientProp));
  const [groupsClient, setGroupsClient] = useState<IGroupsClient>(createGroupsClient(groupsClientProp));
  const [propertiesClient, setPropertiesClient] = useState<IPropertiesClient>(createPropertiesClient(propertiesClientProp));
  const [extractionClient, setExtractionClient] = useState<IExtractionClient>(createExtractionClient(extractionClientProp));
  const [customUIs, setCustomUIs] = useState<GroupingMappingCustomUI[]>(
    createGroupingMappingCustomUI(props.customUIs),
  );
  const [apiConfig, setApiConfig] = useState<GroupingMappingApiConfig>({
    getAccessToken: props.getAccessToken ?? authorizationClientGetAccessToken,
    iModelId: props.iModelId,
    prefix: props.prefix,
  });
  const [hiddenGroupsIds, setHiddenGroupsIds] = useState<Set<string>>(new Set());
  const [showGroupColor, setShowGroupColor] = useState<boolean>(false);
  const [propertiesShowGroup, setPropertiesShowGroup] = useState<boolean>(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [numberOfVisualizedGroups, setNumberOfVisualizedGroups] = useState(0);
  const [isOverlappedColored, setIsOverlappedColored] = useState<boolean>(false);
  const [currentHilitedGroups, setCurrentHilitedGroups] = useState<number>(1);
  const [isVisualizationsEnabled, setIsVisualizationsEnabled] = useState<boolean>(false);
  const [overlappedElementsMetadata, setOverlappedElementsMetadata] = useState<OverlappedElementsMetadata>({
    overlappedElementsInfo: new Map(),
    groupElementsInfo: new Map(),
    overlappedElementGroupPairs: [],
  });
  const queryClient = props.queryClient ?? defaultQueryClient;
  const [mappingIdJobInfo, setMappingIdJobInfo] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    setApiConfig(() => ({
      prefix: props.prefix,
      iModelId: props.iModelId,
      getAccessToken: props.getAccessToken ?? authorizationClientGetAccessToken,
      iModelConnection: props.iModelConnection ?? activeIModelConnection,
    }));
  }, [activeIModelConnection, props.getAccessToken, props.iModelConnection, props.iModelId, props.prefix]);

  useEffect(() => {
    setMappingClient(createMappingClient(mappingsClientProp));
  }, [mappingsClientProp]);

  useEffect(()=>{
    setGroupsClient(createGroupsClient(groupsClientProp));
  }, [groupsClientProp]);

  useEffect(()=>{
    setPropertiesClient(createPropertiesClient(propertiesClientProp));
  }, [propertiesClientProp]);

  useEffect(() => {
    setExtractionClient(createExtractionClient(extractionClientProp));
  }, [extractionClientProp]);

  useEffect(() => {
    setCustomUIs(createGroupingMappingCustomUI(props.customUIs));
  }, [props.customUIs]);

  const hilitedElementsContextValue = useMemo(
    () => ({
      showGroupColor,
      setShowGroupColor,
      hiddenGroupsIds,
      setHiddenGroupsIds,
      groups,
      setGroups,
      numberOfVisualizedGroups,
      setNumberOfVisualizedGroups,
      isOverlappedColored,
      setIsOverlappedColored,
      currentHilitedGroups,
      setCurrentHilitedGroups,
      isVisualizationsEnabled,
      setIsVisualizationsEnabled,
      overlappedElementsMetadata,
      setOverlappedElementsMetadata,
    }),
    [showGroupColor, hiddenGroupsIds, groups, numberOfVisualizedGroups, isOverlappedColored, currentHilitedGroups, isVisualizationsEnabled, overlappedElementsMetadata]
  );

  const propertiesContextValue = useMemo(
    () => ({
      showGroupColor: propertiesShowGroup,
      setShowGroupColor: setPropertiesShowGroup,
    }),
    [propertiesShowGroup]
  );

  const customUIContextValue = useMemo(() => ({
    customUIs,
    setCustomUIs,
  }), [customUIs]);

  const extractionStateJobContextValue = useMemo(() => ({
    mappingIdJobInfo,
    setMappingIdJobInfo,
  }), [mappingIdJobInfo]);

  return (
    <QueryClientProvider client={queryClient}>
      <GroupingMappingApiConfigContext.Provider value={apiConfig}>
        <MappingClientContext.Provider value={mappingClient}>
          <GroupsClientContext.Provider value={groupsClient}>
            <PropertiesClientContext.Provider value={propertiesClient}>
              <ExtractionClientContext.Provider value={extractionClient}>
                <ExtractionStatusJobContext.Provider value={extractionStateJobContextValue}>
                  <GroupingMappingCustomUIContext.Provider value={customUIContextValue}>
                    <GroupHilitedElementsContext.Provider value={hilitedElementsContextValue}>
                      <PropertiesGroupColorContext.Provider value={propertiesContextValue}>
                        {props.children}
                      </PropertiesGroupColorContext.Provider>
                    </GroupHilitedElementsContext.Provider>
                  </GroupingMappingCustomUIContext.Provider>
                </ExtractionStatusJobContext.Provider>
              </ExtractionClientContext.Provider>
            </PropertiesClientContext.Provider>
          </GroupsClientContext.Provider>
        </MappingClientContext.Provider>
      </GroupingMappingApiConfigContext.Provider>
    </QueryClientProvider>
  );
};
