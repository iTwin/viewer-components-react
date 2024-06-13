/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect } from "react";
import { handleEC3AuthCallback } from "@itwin/ec3-widget-react";
import { ProgressRadial } from "@itwin/itwinui-react";

export const EC3AuthRedirect = () => {
  useEffect(() => {
    handleEC3AuthCallback({
      clientId: import.meta.env.IMJS_EC3_PORTAL_AUTH_CLIENT_ID ?? "",
      redirectUri: import.meta.env.IMJS_EC3_PORTAL_AUTH_CLIENT_REDIRECT_URI ?? "",
    });
  }, []);

  return <ProgressRadial indeterminate={true}></ProgressRadial>;
};
