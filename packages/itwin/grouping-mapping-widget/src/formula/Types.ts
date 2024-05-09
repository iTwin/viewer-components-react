/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/**
 * @public
 */
export type ValueType = number | string | boolean;

/**
 * @public
 */
export type PossibleValueType = ValueType | undefined;

/**
 * @public
 */
export type DataType = "Double" | "String" | "Boolean" | "Integer";
/**
 * @public
 */
export type PossibleDataType = DataType | "Undefined";

/**
 * @public
 */
export interface PropertyMap { [key: string]: PossibleDataType }
