/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
export interface Configuration {
  displayName: string;
  description: string;
  id?: string;
  reportId: string;
  labels: Label[];
}

export interface Label {
  reportTable: string;
  name: string;
  elementNameColumn: string;
  elementQuantityColumn: string;
  materials: Material[];
}

export interface Material {
  nameColumn: string | undefined;
}
