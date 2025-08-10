/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect } from "react";
import { ProgressRadial } from "@itwin/itwinui-react";

/** @beta */
export function ArcGisOauthRedirect() {
  const completeLogin = () => {
    if (window.opener) {
      const opener = window.opener;
      if (opener?.arcGisOAuth2Callback) {
        opener.arcGisOAuth2Callback(window.location);
      } else {
        console.log("ERROR: arcGisOAuth2Callback is not defined");
      }
    }
  };

  useEffect(() => {
    completeLogin();
  }, []);

  return <ProgressRadial indeterminate={true}></ProgressRadial>;
}
