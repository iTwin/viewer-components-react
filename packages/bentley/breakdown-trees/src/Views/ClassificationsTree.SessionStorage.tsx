/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { ClassificationsTree } from "./ClassificationsTree";
import type { IModelConnection } from "@itwin/core-frontend";

export interface SessionStorageClassificationsTreeProps {
  iModel: IModelConnection;
}

const SHOW_GUID_STORAGE_KEY = "discard-guid-from-label";

export const SessionStorageClassificationsTree: React.FC<SessionStorageClassificationsTreeProps> = (props: SessionStorageClassificationsTreeProps) => {
  const [displayGuids, setDisplayGuids] = React.useState<boolean>(sessionStorage.getItem(SHOW_GUID_STORAGE_KEY) !== "false");
  const setIsDisplayGuids = React.useCallback((value: boolean) => {
    sessionStorage.setItem(SHOW_GUID_STORAGE_KEY, String(value));
    setDisplayGuids(value);
  }, []);
  return <ClassificationsTree iModel={props.iModel} displayGuids={displayGuids} setIsDisplayGuids={setIsDisplayGuids} />;
};
