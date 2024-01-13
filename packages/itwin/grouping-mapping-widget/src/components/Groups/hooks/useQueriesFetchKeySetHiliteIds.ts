import type { IModelConnection } from "@itwin/core-frontend";
import type { Group } from "@itwin/insights-client";
import type { KeySet } from "@itwin/presentation-common";
import type { UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { useMemoizedCollectionPick } from "../../../common/hooks/useMemoizedCollectionPick";
import { getHiliteIdsAndKeysetFromGroup } from "../groupsHelpers";

export interface QueryResults {
  group: Group;
  result: {
    keySet: KeySet;
    ids: string[];
  };
}[];

type TQueries = UseQueryOptions<QueryResults>[];

export const createGroupQuery = (group: Group, iModelConnection: IModelConnection, enableGroupQueries: boolean) => ({
  queryKey: ["group", "hiliteids", group.query],
  queryFn: async () => getHiliteIdsAndKeysetFromGroup(iModelConnection, group),
  enabled: enableGroupQueries,
  staleTime: Infinity,
});

export const useSingleGroupQueryFetchKeySetHiliteIds = (group: Group, iModelConnection: IModelConnection, enableGroupQueries: boolean) => {
  const query = useMemo(() => createGroupQuery(group, iModelConnection, enableGroupQueries), [enableGroupQueries, group, iModelConnection]);

  return useQuery<QueryResults>(query);
};

export const useQueriesFetchKeySetHiliteIds = (groups: Group[], enableGroupQueries: boolean, iModelConnection: IModelConnection) => {
  const queries = useMemo(() => groups.map((group) => createGroupQuery(group, iModelConnection, enableGroupQueries)),
    [groups, iModelConnection, enableGroupQueries]);

  const useQueriesHook = useQueries<TQueries>({ queries });

  const groupQueries = useMemoizedCollectionPick(useQueriesHook, ["data", "isLoading", "isFetched", "refetch"]);

  return { groupQueries };
};
