/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
export type ValueType = number | string | boolean;

export type PossibleValueType = ValueType | undefined;

export type DataType = "Double" | "String" | "Boolean" | "Integer";

export type PossibleDataType = DataType | "Undefined";

export interface PropertyMap { [key: string]: PossibleDataType }
