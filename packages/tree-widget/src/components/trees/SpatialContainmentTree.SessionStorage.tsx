/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { SpatialContainmentTree } from "./SpatialContainmentTree";
import { IModelConnection } from "@bentley/imodeljs-frontend";

export interface SessionStorageSpatialContainmentTreeProps {
  iModel: IModelConnection;
}

const SHOW_GUID_STORAGE_KEY = "discard-guid-from-label";
const DISPLAY_BY_TYPE_STORAGE_KEY = "display-by-type";

export const SessionStorageSpatialContainmentTree: React.FC<SessionStorageSpatialContainmentTreeProps> = (props: SessionStorageSpatialContainmentTreeProps) => {
  const [displayGuids, setDisplayGuids] = React.useState<boolean>(sessionStorage.getItem(SHOW_GUID_STORAGE_KEY) !== "false");
  const [displayByType, setDisplayByType] = React.useState<boolean>(sessionStorage.getItem(DISPLAY_BY_TYPE_STORAGE_KEY) === "true");

  const setIsDisplayByType = React.useCallback((value: boolean) => {
    sessionStorage.setItem(DISPLAY_BY_TYPE_STORAGE_KEY, String(value));
    setDisplayByType(value);
  }, []);

  const setIsDisplayGuids = React.useCallback((value: boolean) => {
    sessionStorage.setItem(SHOW_GUID_STORAGE_KEY, String(value))
    setDisplayGuids(value);
  }, []);

  return <SpatialContainmentTree iModel={props.iModel} displayByType={displayByType} setDisplayByType={setIsDisplayByType} displayGuids={displayGuids} setIsDisplayGuids={setIsDisplayGuids} enableVisibility={false} />;
}
