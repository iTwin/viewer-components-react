/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
export interface Selector {
  templateName: string;
  templateDescription: string;
  id?: string;
  reportId: string;
  groups: Group[];
}

export interface Group {
  groupName: string;
  itemName: string;
  pairs: Pair[];
}

export interface Pair {
  material: string;
  quantity: string;
}