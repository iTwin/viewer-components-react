/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { OCLCALoginResponse} from "@itwin/insights-client";
import { OperationsBase } from "@itwin/insights-client";

/**
 * @internal
 */
export class OCLCAApiHelper extends OperationsBase  {
  public async getOCLCAAccessToken(username: string, apiPassword: string) {
    if (username === undefined || apiPassword === undefined) {
      return undefined;
    }
    const requestOptions: RequestInit = {
      method: "POST",
    };
    requestOptions.body = JSON.stringify({
      username,
      password: apiPassword,
    });
    const url = `https://oneclicklcaapp.com/app/api/login`;
    return this.fetchJSON<OCLCALoginResponse>(url, requestOptions);
  }
}
