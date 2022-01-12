/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BeUiEvent } from "@itwin/core-bentley";

/** Measurement preferences for serializing. */
export interface MeasurementPreferencesProps {
  /** Display any axes (e.g. rise/run) on measurements if they're supported. Default is false */
  displayMeasurementAxes?: boolean;

  /** Displays Altitude (Z) for a location in the measurement widget. Default is true. */
  displayLocationAltitude?: boolean;

  /** Displays any text labels on measurements. Default is true. */
  displayMeasurementLabels?: boolean;
}

/** Enumerates measurement properties for change events. */
export enum MeasurementPreferencesProperty {
  displayMeasurementAxes = 1,
  displayLocationAltitude = 2,
  displayMeasurementLabels = 3,
}

/** Measurement preferences singleton that manages the application/user's preferences for measurements. Each property when modified will emit a change event. */
export class MeasurementPreferences {
  private static _instance?: MeasurementPreferences;

  private _displayMeasurementAxes: boolean = false;
  private _displayLocationAltitude: boolean = true;
  private _displayMeasurementLabels: boolean = true;

  /** Event for when a preference property changes value. */
  public readonly onPreferenceChanged = new BeUiEvent<MeasurementPreferencesProperty>();

  /** Gets the measurement preferences singleton. */
  public static get current(): MeasurementPreferences {
    if (!MeasurementPreferences._instance)
      MeasurementPreferences._instance = new MeasurementPreferences();

    return MeasurementPreferences._instance;
  }

  /** Gets or sets if measurement axes should be displayed on newly created measurements. */
  public get displayMeasurementAxes(): boolean {
    return this._displayMeasurementAxes;
  }

  public set displayMeasurementAxes(v: boolean) {
    if (this._displayMeasurementAxes !== v) {
      this._displayMeasurementAxes = v;
      this.onPreferenceChanged.emit(MeasurementPreferencesProperty.displayMeasurementAxes);
    }
  }

  /** Gets or sets if location measurements display Altitude (Z) in the measurement widget. */
  public get displayLocationAltitude(): boolean {
    return this._displayLocationAltitude;
  }

  public set displayLocationAltitude(v: boolean) {
    if (this._displayLocationAltitude !== v) {
      this._displayLocationAltitude = v;
      this.onPreferenceChanged.emit(MeasurementPreferencesProperty.displayLocationAltitude);
    }
  }

  /** Gets or sets if measurement labels should be displayed on newly created measurements. */
  public get displayMeasurementLabels(): boolean {
    return this._displayMeasurementLabels;
  }

  public set displayMeasurementLabels(v: boolean) {
    if (this._displayMeasurementLabels !== v) {
      this._displayMeasurementLabels = v;
      this.onPreferenceChanged.emit(MeasurementPreferencesProperty.displayMeasurementLabels);
    }
  }

  private constructor() {
    this.loadDefaults();
  }

  public loadDefaults() {
    this._displayMeasurementAxes = false;
    this._displayLocationAltitude = true;
    this._displayMeasurementLabels = true;
  }

  public load(props: MeasurementPreferencesProps, setDefaultsIfMissing: boolean = true) {
    if (props.displayMeasurementAxes !== undefined)
      this._displayMeasurementAxes = props.displayMeasurementAxes;
    else if (setDefaultsIfMissing)
      this._displayMeasurementAxes = false;

    if (props.displayLocationAltitude !== undefined)
      this._displayLocationAltitude = props.displayLocationAltitude;
    else if (setDefaultsIfMissing)
      this._displayLocationAltitude = true;

    if (props.displayMeasurementLabels !== undefined)
      this._displayMeasurementLabels = props.displayMeasurementLabels;
    else if (setDefaultsIfMissing)
      this._displayMeasurementLabels = true;
  }

  public save(): MeasurementPreferencesProps {
    return { displayMeasurementAxes: this._displayMeasurementAxes, displayLocationAltitude: this._displayLocationAltitude, displayMeasurementLabels: this._displayMeasurementLabels };
  }
}
