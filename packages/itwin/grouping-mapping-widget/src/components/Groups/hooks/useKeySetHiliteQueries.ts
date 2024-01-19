/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { IModelConnection } from "@itwin/core-frontend";
import type { Group } from "@itwin/insights-client";
import type { KeySet } from "@itwin/presentation-common";
import type { UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { useMemoizedCollectionPick } from "../../../common/hooks/useMemoizedCollectionPick";
import { TErrCodes } from "../../Constants";
import { getHiliteIdsAndKeysetFromGroup } from "../groupsHelpers";

export interface QueryResults {
  group: Group;
  result: {
    keySet: KeySet;
    ids: string[];
  };
}[];

type TQueries = UseQueryOptions<QueryResults>[];

export const createQueryForHiliteIdsAndKeyset = (group: Group, iModelConnection: IModelConnection, enabled: boolean) => ({
  queryKey: ["group", "hiliteids", group.query],
  queryFn: async () => getHiliteIdsAndKeysetFromGroup(iModelConnection, group),
  enabled,
  staleTime: Infinity,
  meta: { errorCode:TErrCodes.QUERY_HILITE_FETCH_FAILED, message: `Failed to resolve ${group.groupName}.` },
});

export const useGroupKeySetQuery = (group: Group, iModelConnection: IModelConnection, enabled: boolean) => {
  const query = useMemo(() => createQueryForHiliteIdsAndKeyset(group, iModelConnection, enabled), [enabled, group, iModelConnection]);

  return useQuery<QueryResults>(query);
};

export const useKeySetHiliteQueries = (groups: Group[], enabled: boolean, iModelConnection: IModelConnection) => {
  const queries = useMemo(() => groups.map((group) => createQueryForHiliteIdsAndKeyset(group, iModelConnection, enabled)),
    [groups, iModelConnection, enabled]);

  const useQueriesHook = useQueries<TQueries>({ queries });

  const groupQueries = useMemoizedCollectionPick(useQueriesHook, ["data", "isLoading", "isFetched", "refetch"]);

  return { groupQueries };
};
