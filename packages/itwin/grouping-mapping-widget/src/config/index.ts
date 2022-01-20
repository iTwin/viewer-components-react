/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Config } from "@bentley/bentleyjs-core";

interface WidgetBuddiConfig {
  region: string;
}

export interface WidgetConfig {
  buddi?: WidgetBuddiConfig;
}

export const getConfig = (): WidgetConfig => {
  return {
    buddi: {
      region: Config.App.get("IMJS_BUDDI_REGION", "") ?? "",
    },
  };
};
