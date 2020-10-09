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
  /** List of elements that are isolated */
  alwaysDrawn?: string[];
  /** Viewed categories */
  categories?: string[];
  /** Category Selector Props */
  categorySelectorProps?: string;
  /** changeset of the iModel that contains the saved view */
  changeSetId?: string;
  /** Display Style Props */
  displayStyleProps?: string;
  /** Emphasized Elements if any as JSON*/
  emphasizedElementsProps?: string;
  /** id for persisted saved view */
  id?: string;
  /** iModel that contains the saved view */
  iModelId?: string;
  /** Is view 2D */
  is2d?: boolean;
  /** markup svg */
  markup?: string;
  /** Viewed models */
  models?: string[];
  /** List of elements that are hidden */
  neverDrawn?: string[];
  /** List of elements to show colorized (green) while default becomes gray */
  nonGrayedElements?: string[];
  /** List of color and transparency overrides */
  overrides?: OverrideData[];
  /** model/category overrides */
  perModelCategoryVisibility?: PerModelCategoryVisibilityProps[];
  /** Project that contains the iModel that contains the saved view */
  projectId?: string;
  /** Sheet Attachments */
  sheetAttachments?: string[];
  /** Sheet props */
  sheetProps?: string;
  /** View source Id in iModel */
  sourceId?: string;
  /** Data related to the view (camera angle, extents, flags, etc.) */
  state?: SavedViewState;
  /** If the view was created by an user */
  userView?: boolean;
  /** Version */
  version?: string;
  /** 2D view definition props */
  viewDefinitionProps?: string;
}
