/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import type { SpatialContainmentEventHandlers } from "./SpatialContainmentTree";
import { SpatialContainmentTree } from "./SpatialContainmentTree";
import type { IModelConnection } from "@itwin/core-frontend";

export interface SessionStorageSpatialContainmentTreeProps {
  iModel: IModelConnection;
  eventHandlers: SpatialContainmentEventHandlers;
}

const SHOW_GUID_STORAGE_KEY = "discard-guid-from-label";
const GROUP_BY_TYPE_STORAGE_KEY = "group-by-type";
const GROUP_BY_DISCIPLINE_STORAGE_KEY = "group-by-discipline";

export const SessionStorageSpatialContainmentTree: React.FC<SessionStorageSpatialContainmentTreeProps> = (props: SessionStorageSpatialContainmentTreeProps) => {
  const [displayGuids, setDisplayGuids] = React.useState<boolean>(sessionStorage.getItem(SHOW_GUID_STORAGE_KEY) !== "false");
  const [groupByType, setGroupByType] = React.useState<boolean>(sessionStorage.getItem(GROUP_BY_TYPE_STORAGE_KEY) === "true");
  const [groupByDiscipline, setGroupByDiscipline] = React.useState<boolean>(sessionStorage.getItem(GROUP_BY_DISCIPLINE_STORAGE_KEY) === "true");

  const setIsGroupByType = React.useCallback((value: boolean) => {
    sessionStorage.setItem(GROUP_BY_TYPE_STORAGE_KEY, String(value));
    setGroupByType(value);
  }, []);

  const setIsGroupByDiscipline = React.useCallback((value: boolean) => {
    sessionStorage.setItem(GROUP_BY_DISCIPLINE_STORAGE_KEY, String(value));
    setGroupByDiscipline(value);
  }, []);

  const setIsDisplayGuids = React.useCallback((value: boolean) => {
    sessionStorage.setItem(SHOW_GUID_STORAGE_KEY, String(value));
    setDisplayGuids(value);
  }, []);

  return <SpatialContainmentTree iModel={props.iModel} groupByType={groupByType} setGroupByType={setIsGroupByType} groupByDiscipline={groupByDiscipline} setGroupByDiscipline={setIsGroupByDiscipline} displayGuids={displayGuids} setIsDisplayGuids={setIsDisplayGuids} enableVisibility={false} />;
};
