/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Config } from "@bentley/bentleyjs-core";
interface WidgetAuthConfig {
  authority: string;
  clientId: string;
}

interface WidgetBuddiConfig {
  region: string;
}

export interface WidgetConfig {
  auth?: WidgetAuthConfig;
  buddi?: WidgetBuddiConfig;
}

export const getConfig = (): WidgetConfig => {
  return {
    buddi: {
      region: Config.App.get("IMJS_BUDDI_REGION") ?? "",
    },
    auth: {
      authority: Config.App.get("IMJS_AUTH_CLIENT_AUTHORITY") ?? "",
      clientId: Config.App.get("IMJS_AUTH_CLIENT_CLIENT_ID") ?? "",
    },
  };
};
