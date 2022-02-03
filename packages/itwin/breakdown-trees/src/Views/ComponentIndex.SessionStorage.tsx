/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { ComponentIndex } from "./ComponentIndex";
import type { IModelConnection } from "@itwin/core-frontend";

export interface SessionStorageComponentIndexProps {
  iModel: IModelConnection;
}

const SHOW_GUID_STORAGE_KEY = "discard-guid-from-label";

export const SessionStorageComponentIndex: React.FC<SessionStorageComponentIndexProps> = (props: SessionStorageComponentIndexProps) => {
  const [displayGuids, setDisplayGuids] = React.useState<boolean>(sessionStorage.getItem(SHOW_GUID_STORAGE_KEY) !== "false");
  const setIsDisplayGuids = React.useCallback((value: boolean) => {
    sessionStorage.setItem(SHOW_GUID_STORAGE_KEY, String(value));
    setDisplayGuids(value);
  }, []);
  return <ComponentIndex iModel={props.iModel} displayGuids={displayGuids} setIsDisplayGuids={setIsDisplayGuids} />;
};
