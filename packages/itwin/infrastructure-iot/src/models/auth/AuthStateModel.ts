/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export class AuthState {

  constructor(
    private readonly apiKey: string,
    private readonly projectId: string,
    private readonly projectName: string,
    private settingsWriteAccess = true,
    private readonly accessToken?: string
  ) { }

  // Use this to authenticate sensemetrics API requests
  public getApiKey(): string {
    return this.apiKey;
  }

  // Use this to sign in to the sensemetrics app without prompting
  // a user for their login information (kind of like SSO)
  public getAccessToken(): string | undefined {
    return this.accessToken;
  }

  public getProjectId(): string {
    return this.projectId;
  }

  public getProjectName(): string {
    return this.projectName;
  }

  public setSettingsWriteAccess(hasAccess: boolean): void {
    this.settingsWriteAccess = hasAccess;
  }

  public hasSettingsWriteAccess(): boolean {
    return this.settingsWriteAccess;
  }
}
