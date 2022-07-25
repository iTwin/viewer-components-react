/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
//import type { AccessToken } from "@itwin/core-bentley";
//import type { JobCreate } from "./generated/api";

export default class DumbClient {
  //constructor() { }

  getEc3AccessToken(email: string, password: string): any { }
  createEc3Job(reportId: string, token: any): any { }
  getEc3JobStatus(token: string, jobId: string): any { }
  //getEc3AccessToken(username: string, password: string): Promise<any>;
  //createEc3Job(accessToken: AccessToken, job: JobCreate): Promise<import("./generated/api").JobCreationResponse>;
  //getEc3JobStatus(accessToken: AccessToken, jobId: string): Promise<import("./generated/api").JobStatusResponse>;
}