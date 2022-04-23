/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useActiveIModelConnection } from "@itwin/appui-react";

export interface ActiveIModel {
  iTwinId: string;
  iModelId: string;
}
// Wrapped in a hook for easy mocking
export const useActiveIModel = () => {
  const IModelConnection = useActiveIModelConnection();

  const activeIModel: ActiveIModel = { iTwinId: IModelConnection?.iTwinId ?? "", iModelId: IModelConnection?.iModelId ?? "" }

  return activeIModel
}