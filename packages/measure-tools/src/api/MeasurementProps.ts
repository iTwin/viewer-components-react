/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** Properties for a Measurement that can be serialized. */
export interface MeasurementProps {
  /** Whether or not the measurement is in a locked state. Locked measurements cannot be cleared or edited. */
  isLocked?: boolean;

  /** ID for the group the measurement belongs to. Application specific meaing. */
  groupId?: string;

  /** ID for the subgroup the measurement belongs to. Application specific meaning. */
  subgroupId?: string;

  /** ID to identify the measurement within a group. Application specific meaning. */
  id?: string;

  /** Name of the drawing Style to apply when drawing this measurement. If undefined, the default style is used. */
  style?: string;

  /** Name of the drawing Style to apply uwhen drawing this measurement when it is locked. If undefined, the default lock style is used. */
  lockStyle?: string;

  /** View types the measurement targets. */
  viewTarget?: MeasurementViewTargetProps;

  /** Controls if any text labels are displayed or not. If undefined, this is considered true. */
  displayLabels?: boolean;
}

/** Defines a serializable representation of a MeasurementViewTarget. */
export interface MeasurementViewTargetProps {
  included: string[];
  excluded: string[];
}
