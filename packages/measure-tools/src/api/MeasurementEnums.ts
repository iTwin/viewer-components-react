/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** List of well-known measurement style sets. */
export enum WellKnownMeasurementStyle {
  Default = "default",
  DefaultLocked = "default-locked",
  Faded = "faded",
}

/** Enumeration for different scenarios where a measurement handles a button event. */
export enum MeasurementButtonHandledEvent {
    /** Measurement did not respond to button event. */
    No = 0,

    /** Measurement did respond to button event. */
    Yes = 1,

    /** Measurement did respond to button event, and consume the event so the system does not further processs it. */
    YesConsumeEvent = 2,
}

/**
 * Event Id used to sync UI components. Used to refresh visibility or enable state of control.
 */
export enum MeasurementSyncUiEventId {
  /** The set of selected measurements has changed. */
  MeasurementSelectionSetChanged = "measurementselectionsetchanged",

  /** The measurement that the user is currently creating in a tool (the dynamic measurement) has changed. */
  DynamicMeasurementChanged = "dynamicmeasurementchanged",
}

/** Defines a list of well known viewport types. */
export enum WellKnownViewType {
  /** Special case: ANY viewport is acceptable to draw in. This is a default value. */
  Any = "any",

  /** Special case: ANY Spatial viewport is acceptable to draw in. Subclasses do not matter. */
  AnySpatial = "anySpatial",

  /** Special case: ANY Drawing viewport is acceptable to draw in. Subclasses do not matter. */
  AnyDrawing = "anyDrawing",

  /** ONLY a viewport that has a SpatialViewState or OrthographicViewState (e.g. built-in imodeljs views). If the viewstate is a subclass then it is not valid. */
  Spatial = "spatial",

  /** ONLY a viewport that has a DrawingViewState (e.g. built-in imodeljs views). If the viewstate is a  subclass then it is not valid. */
  Drawing = "drawing",

  /** ONLY a viewport that is a cross-section (xSection) view (Civil-specific). */
  XSection = "xsection",

  /** ONLY a viewport that is a profile view (Civil-specific). */
  Profile = "profile",

  /** ONLY a viewport that is a SheetViewState (e.g. built-in imodeljs views). If the viewstate is a subclass then it is not valid. */
  Sheet = "sheet",
}
