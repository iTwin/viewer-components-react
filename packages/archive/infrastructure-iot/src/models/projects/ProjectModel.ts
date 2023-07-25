/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DataObject } from "../DataObjectModel";

export class Project extends DataObject {

  private readonly defaultProject?: boolean;

  private readonly sensorCount?: number;
  private readonly userCount?: number;

  constructor(id: string) {
    super(id);
  }

  public isDefault(): boolean {
    return this.defaultProject || false;
  }

  public getSensorCount(): number {
    return this.sensorCount || 0;
  }

  public getUserCount(): number {
    return this.userCount || 0;
  }

}
