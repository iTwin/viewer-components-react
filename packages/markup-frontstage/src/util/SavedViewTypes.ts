/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/**
 * Color overrides for element ids
 */
export interface OverrideData {
  /** Transparency value (not alpha) (transparent 0-255 not transparent) */
  alpha?: number;
  /** Color bytes in RGBA format */
  color?: number;
  /** Ids of overridden elements */
  ids: string[];
}

/** store model/category overrides */
export interface PerModelCategoryVisibilityProps {
  modelId: string;
  categoryId: string;
  visible: boolean;
}

/**
 * View data for generating the view state from a saved view
 */
export interface SavedViewState {
  cameraAngle: number;
  cameraFocalLength: number;
  cameraPosition: any;
  extents: any;
  flags: any;
  isCameraOn: boolean;
  origin: any;
  rotation: any;
}

/**
 * Format for the Blob data in the BIM Review Share
 */
export interface SavedViewData {
  /** id for persisted saved view */
  id?: string;
  /** List of elements that are hidden */
  neverDrawn?: string[];
  /** List of elements that are isolated */
  alwaysDrawn?: string[];
  /** List of elements to show colorized (green) while default becomes gray */
  nonGrayedElements?: string[];
  /** List of color and transparency overrides */
  overrides?: OverrideData[];
  /** Viewed categories */
  categories: string[];
  /** Viewed models */
  models: string[];
  /** Version */
  version: string;
  /** View source Id in iModel */
  sourceId: string;
  /** If the view was created by an user */
  userView: boolean;
  /** Data related to the view (camera angle, extents, flags, etc.) */
  state: SavedViewState;
  /** Display Style Props */
  displayStyleProps?: string;
  /** Project that contains the iModel that contains the saved view */
  projectId?: string;
  /** iModel that contains the saved view */
  iModelId?: string;
  /** changeset of the iModel that contains the saved view */
  changeSetId?: string;
  /** model/category overrides */
  perModelCategoryVisibility?: PerModelCategoryVisibilityProps[];
  /** markup svg */
  markup?: string;
  /**Emphasized Elements if any as JSON*/
  emphasizedElementsProps?: string;
}
