/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
export interface Template {
  templateName: string;
  templateDescription: string;
  id?: string;
  reportId: string;
  labels: Label[];
}

export interface Label {
  reportTable: string;
  customName: string;
  itemName: string;
  itemQuantity: string;
  materials: Material[];
}

export interface Material {
  name: string | undefined;
}