/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ActionButtonItemDef, ItemProps, ActionItemButton, CursorPopupManager, CursorInformation } from "@bentley/ui-framework";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { RelativePosition } from "@bentley/ui-abstract";
import { Direction } from "@bentley/ui-ninezone";
import * as React from "react";
import { Point2d, XAndY } from "@bentley/geometry-core";
import { Measurement, MeasurementPickContext } from "../api/Measurement";
import { MeasurementManager } from "../api/MeasurementManager";
import { PopupToolbar } from "./PopupToolbar";
import { MeasurementUIEvents } from "../api/MeasurementUIEvents";
import { MeasurementSelectionSet } from "../api/MeasurementSelectionSet";
import { DistanceMeasurement } from "../measurements/DistanceMeasurement";
import { FeatureTracking, MeasureToolsFeatures } from "../api/FeatureTracking";
import { ShimFunctions } from "../api/ShimFunctions";

/** Props for MeasurementActionItemDef, when the toolbar button is clicked, it passes the measurement that your execute function will handle. */
export interface MeasurementActionItemProps extends ItemProps {
  /** Non-localized id to identify the item */
  id: string;

  /** Do something with the measurement
   * @param arg The measurement the toolbar was displayed for.
   */
  execute: (arg: Measurement[]) => void;
}

/** Toolbar button action item. Encapsulates all the properties to display a button in the toolbar and execute some logic when pressed. */
export class MeasurementActionItemDef extends ActionButtonItemDef {
  private _id: string;

  /** Constructs a new measurement action item definition. */
  public constructor(props: MeasurementActionItemProps) {
    super(props);

    this._id = props.id;
    this._commandHandler = { execute: props.execute };
  }

  /** Gets the non-localized id to identify the item */
  public get id(): string {
    return this._id;
  }

  /** Gets the measurement that the toolbar was opened for. */
  public get measurements(): Measurement[] | undefined {
    return this._commandHandler!.parameters as Measurement[];
  }

  /** Sets the measurement. */
  public set measurements(measurements: Measurement[] | undefined) {
    this._commandHandler!.parameters = measurements;
  }

  /** Executes user callback and closes toolbar. */
  public execute(): void {
    super.execute();

    MeasurementActionToolbar.closeToolbar(false);
  }
}

/** Common measurement action items. */
export class MeasurementActionDefinitions {
  /** Creates a new delete action item. This drops the measurement from the decorator. */
  public static get deleteAction() {
    return new MeasurementActionItemDef({
      id: "delete",
      iconSpec: "icon-measure-clear",
      label: () => IModelApp.i18n.translate("MeasureTools:Measurements.clearMeasurement"),
      tooltip: () => IModelApp.i18n.translate("MeasureTools:Measurements.clearMeasurement"),
      execute: (arg: Measurement[]) => {
        MeasurementManager.instance.dropMeasurement(arg);
        FeatureTracking.notifyFeature(MeasureToolsFeatures.MeasurementActions_Delete);
      },
    });
  }

  /** Creates a new open properties action item. This opens the property grid to display measurement properties. */
  public static get openPropertiesAction() {
    return new MeasurementActionItemDef({
      id: "open-properties",
      iconSpec: "icon-properties",
      label: () => IModelApp.i18n.translate("MeasureTools:Generic.properties"),
      tooltip: () => IModelApp.i18n.translate("MeasureTools:Generic.properties"),
      execute: (args: Measurement[]) => {
        MeasurementSelectionSet.global.add(args);
      },
    });
  }

  /** Creates a new unlock action item. This sets the isLocked property to false and causes the meaurement to be redrawn. */
  public static get unlockAction() {
    return new MeasurementActionItemDef({
      id: "unlock",
      iconSpec: "icon-lock-unlocked",
      label: () => IModelApp.i18n.translate("MeasureTools:Generic.unlock"),
      tooltip: () => IModelApp.i18n.translate("MeasureTools:Generic.unlock"),
      execute: (args: Measurement[]) => {

        args.forEach((m) => {
          if (m.isLocked) {
            m.isLocked = false;
            m.viewTarget.invalidateViewportDecorations();
          }
        });

        MeasurementUIEvents.notifyMeasurementsChanged(); // By default locking influences visibility of the UI buttons
        FeatureTracking.notifyToggledFeature(MeasureToolsFeatures.MeasurementActions_Lock, false);
      },
    });
  }

  /** Creates a new lock action item. This sets the isLocked property to true and causes the measurement to be redrawn. */
  public static get lockAction() {
    return new MeasurementActionItemDef({
      id: "lock",
      iconSpec: "icon-lock",
      label: () => IModelApp.i18n.translate("MeasureTools:Generic.lock"),
      tooltip: () => IModelApp.i18n.translate("MeasureTools:Generic.lock"),
      execute: (args: Measurement[]) => {

        args.forEach((m) => {
          if (!m.isLocked) {
            m.isLocked = true;
            m.viewTarget.invalidateViewportDecorations();
          }
        });

        MeasurementUIEvents.notifyMeasurementsChanged(); // By default locking influences visibility of the UI buttons
        FeatureTracking.notifyToggledFeature(MeasureToolsFeatures.MeasurementActions_Lock, true);
      },
    });
  }

  public static get displayMeasurementLabels() {
    return new MeasurementActionItemDef({
      id: "display-labels",
      iconSpec: "icon-layers",
      label: () => IModelApp.i18n.translate("MeasureTools:Generic.displayLabels"),
      tooltip: () => IModelApp.i18n.translate("MeasureTools:Generic.displayLabels"),
      execute: (args: Measurement[]) => {

        args.forEach((m) => {
          if (!m.displayLabels) {
            m.displayLabels = true;
            m.viewTarget.invalidateViewportDecorations();
          }
        });

        FeatureTracking.notifyToggledFeature(MeasureToolsFeatures.MeasurementActions_ToggleDisplayLabels, true);
      },
    });
  }

  public static get hideMeasurementLabels() {
    return new MeasurementActionItemDef({
      id: "hide-labels",
      iconSpec: "icon-layers-hide",
      label: () => IModelApp.i18n.translate("MeasureTools:Generic.hideLabels"),
      tooltip: () => IModelApp.i18n.translate("MeasureTools:Generic.hideLabels"),
      execute: (args: Measurement[]) => {

        args.forEach((m) => {
          if (m.displayLabels) {
            m.displayLabels = false;
            m.viewTarget.invalidateViewportDecorations();
          }
        });

        FeatureTracking.notifyToggledFeature(MeasureToolsFeatures.MeasurementActions_ToggleDisplayLabels, false);
      },
    });
  }

  public static get displayMeasurementAxes() {
    return new MeasurementActionItemDef({
      id: "display-rise-run",
      iconSpec: "icon-measure-2d-show",
      label: () => IModelApp.i18n.translate("MeasureTools:Generic.displayMeasurementAxes"),
      tooltip: () => IModelApp.i18n.translate("MeasureTools:Generic.displayMeasurementAxes"),
      execute: (args: Measurement[]) => {

        args.forEach((m) => {
          if (m instanceof DistanceMeasurement && !m.showAxes) {
            m.showAxes = true;
            m.viewTarget.invalidateViewportDecorations();
          }
        });

        FeatureTracking.notifyToggledFeature(MeasureToolsFeatures.MeasurementActions_ToggleDisplayAxes, true);
      },
    });
  }

  public static get hideMeasurementAxes() {
    return new MeasurementActionItemDef({
      id: "hide-rise-run",
      iconSpec: "icon-measure-2d-hide",
      label: () => IModelApp.i18n.translate("MeasureTools:Generic.hideMeasurementAxes"),
      tooltip: () => IModelApp.i18n.translate("MeasureTools:Generic.hideMeasurementAxes"),
      execute: (args: Measurement[]) => {

        args.forEach((m) => {
          if (m instanceof DistanceMeasurement && m.showAxes) {
            m.showAxes = false;
            m.viewTarget.invalidateViewportDecorations();
          }
        });

        FeatureTracking.notifyToggledFeature(MeasureToolsFeatures.MeasurementActions_ToggleDisplayAxes, false);
      },
    });
  }
}

/** Callback that can add or modify the current list of measurement actions for the popup toolbar.
 * @param measurements the measurement(s) the toolbar is opening for.
 * @param actionItemList the current list of actions which you can add or modify.
 */
export type MeasurementActionProvider = (measurements: Measurement[], actionItemList: MeasurementActionItemDef[]) => void;

/** Determines whether or not a toolbar will be opened for the given measurement.
 * @param measurements the measurement(s) the toolbar has been requested for.
 * @returns true if the toolbar should open for the measurement, false if it should not.
 */
export type MeasurementToolbarFilterHandler = (measurements: Measurement[]) => boolean;

/** Action provider entry. */
export interface ActionProviderEntry {
  /** Sort priority, higher values mean the provider is called first. */
  priority: number;

  /** Action provider. */
  provider: MeasurementActionProvider;
}

/** Manager for an action toolbar for measurements. The measurement decorator will respond to pick button events and open the toolbar. */
export class MeasurementActionToolbar {
  private static _actionProviders: ActionProviderEntry[] = [];
  private static _filterHandler?: MeasurementToolbarFilterHandler;
  private static _counter: number = 0;
  private static _lastPopupId?: string;
  private static _fadeoutPopId?: string;

  /** Gets if the toolbar is currently opened. */
  public static get isOpened(): boolean {
    return this._lastPopupId !== undefined;
  }

  /** Gets the filter handler if one was set. If a measurement is rejected by the filter, the toolbar will NOT open for it. */
  public static get filterHandler(): MeasurementToolbarFilterHandler | undefined {
    return this._filterHandler;
  }

  /** Sets the filter handler. If a measurement is rejected by the filter, the toolbar will NOT open for it. */
  public static set filterHandler(handler: MeasurementToolbarFilterHandler | undefined) {
    this._filterHandler = handler;
  }

  /** Gets a readonly list of currently registered action providers. */
  public static get actionProviders(): ReadonlyArray<ActionProviderEntry> {
    return this._actionProviders;
  }

  /** Opens the measurement toolbar for a list of measurements.
   * @param measurements array of Measurement the actions are for. First one is always the one that initiated the event.
   * @param screenPoint Where on the screen the toolbar is to be positioned (e.g. cursor point)
   * @param offset Optional offset from the position. Default is (0,0)
   * @param relativePosition Optional direction the toolbar will open from. Default is Top (so will be above and centered from point + offset).
   * @returns true if the toolba was opened, false if otherwise (e.g. no action items to view).
   */
  public static openToolbar(measurements: Measurement[], screenPoint: XAndY, offset?: XAndY, relativePosition?: RelativePosition): boolean {
    // Ensure a previous toolbar was closed out
    this.closeToolbar(false);

    if (this._filterHandler && !this._filterHandler(measurements))
      return false;

    // Query all action items...if have none, do not show the toolbar
    const itemList = this.buildActionList(measurements);
    if (itemList.length === 0)
      return false;

    // Build toolbar ID, making it unique so we can fade out a previous toolbar and not have that interfere with a new toolbar
    this._lastPopupId = "measurement-action-toolbar-" + this._counter.toString();
    this._counter++;

    // Show toolbar
    const realOffset = (offset !== undefined) ? offset : Point2d.createZero();
    const realRelPosition = (relativePosition !== undefined) ? relativePosition : RelativePosition.Top;
    CursorPopupManager.open(this._lastPopupId, this.buildToolbar(measurements, itemList), screenPoint, realOffset, realRelPosition);

    FeatureTracking.notifyFeature(MeasureToolsFeatures.MeasurementActionsToolbar_Open);

    return true;
  }

  /** Closes the measurement toolbar.
   * @param fadeOut Optionally animate the toolbar fading out. Default is false.
   */
  public static closeToolbar(fadeOut: boolean = false): void {
    // Forcibly close a fading toolbar if we get another close call otherwise they may interfere with each other
    if (this._fadeoutPopId !== undefined) {
      CursorPopupManager.close(this._fadeoutPopId, false, false);
      this._fadeoutPopId = undefined;
    }

    if (this._lastPopupId === undefined)
      return;

    if (fadeOut)
      this._fadeoutPopId = this._lastPopupId;

    CursorPopupManager.close(this._lastPopupId, false, fadeOut);
    this._lastPopupId = undefined;
  }

  /** Adds an action item provider. Action providers have a priority, and the list is sorted from highest priority to lowest.
   * @param provider The action provider to add.
   * @param providerPriority Optionally provide a sort priority (higher values are called first)
   */
  public static addActionProvider(provider: MeasurementActionProvider, providerPriority?: number): void {
    // Filter out duplicates
    this.dropActionProvider(provider);

    const realPriority = (providerPriority !== undefined) ? providerPriority : 0;
    this._actionProviders.push({ priority: realPriority, provider });

    this._actionProviders.sort((a, b) => b.priority - a.priority);
  }

  /** Remove a specific action item provider. If all are removed, the toolbar will not open.
   * @param provider The action provider to drop.
   */
  public static dropActionProvider(provider: MeasurementActionProvider): void {
    for (let i = 0; i < this._actionProviders.length; i++) {
      if (this._actionProviders[i].provider === provider)
        this._actionProviders.splice(i, 1);
    }
  }

  /** Remove all action item providers. */
  public static clearActionProviders() {
    this._actionProviders = [];
  }

  /** Sets a default provider (which can be later cleared). This sets lock/unlock, delete, and open properties action buttons. */
  public static setDefaultActionProvider() {
    MeasurementActionToolbar.addActionProvider((measurements: Measurement[], actionItemList: MeasurementActionItemDef[]) => {

      let allMeasurementsShowingLabels = true;
      let allMeasurementsLocked = true;
      let hasDistanceMeasurements = false;
      let allDistanceMeasurementsShowingAxes = true;

      for (const measurement of measurements) {
        if (!measurement.isLocked)
          allMeasurementsLocked = false;

        if (!measurement.displayLabels)
          allMeasurementsShowingLabels = false;

        if (measurement instanceof DistanceMeasurement) {
          hasDistanceMeasurements = true;
          if (!measurement.showAxes)
            allDistanceMeasurementsShowingAxes = false;
        }
      }

      actionItemList.push((allMeasurementsLocked) ? MeasurementActionDefinitions.unlockAction : MeasurementActionDefinitions.lockAction);
      actionItemList.push((allMeasurementsShowingLabels) ? MeasurementActionDefinitions.hideMeasurementLabels : MeasurementActionDefinitions.displayMeasurementLabels);

      if (hasDistanceMeasurements)
        actionItemList.push((allDistanceMeasurementsShowingAxes) ? MeasurementActionDefinitions.hideMeasurementAxes : MeasurementActionDefinitions.displayMeasurementAxes);

      actionItemList.push(MeasurementActionDefinitions.deleteAction);
      actionItemList.push(MeasurementActionDefinitions.openPropertiesAction);
    });
  }

  private static buildActionList(measurements: Measurement[]): MeasurementActionItemDef[] {
    const itemList = new Array<MeasurementActionItemDef>();

    for (const entry of this._actionProviders)
      entry.provider(measurements, itemList);

    return itemList;
  }

  private static buildToolbar(measurements: Measurement[], actionItemList: MeasurementActionItemDef[]): React.ReactNode {
    return <PopupToolbar
      expandsTo={Direction.Bottom}
      onClose={() => MeasurementActionToolbar.closeToolbar(true)}
      items={
        <>
          {
            actionItemList.map((itemDef: MeasurementActionItemDef) => {
              itemDef.measurements = measurements;
              return <ActionItemButton key={itemDef.id} actionItem={itemDef} />;
            })
          }
        </>}
    />;
  }
}

// Make sure the toolbar closes if there are any programmatic changes to measurements
MeasurementUIEvents.onMeasurementsChanged.addListener(() => MeasurementActionToolbar.closeToolbar(false));

// Setup action toolbar open function so measurements respond properly in their button event (if referenced directly webpack gives a circular dependency issue)
ShimFunctions.defaultButtonEventAction = (measurement: Measurement, pickContext: MeasurementPickContext) => {
  const measurements = MeasurementSelectionSet.global.measurements;

  // If the measurement that initiated this event is in that list, remove it.
  const index = measurements.indexOf(measurement);
  if (-1 !== index)
    measurements.splice(index, 1);

  // The measurement that initiated this event always comes first
  measurements.unshift(measurement);

  // Open toolbar for measurement
  MeasurementActionToolbar.openToolbar(measurements, CursorInformation.cursorPosition, Point2d.create(0, 10));

  // Notify global event that this measurement is responding to the button
  MeasurementManager.instance.notifyMeasurementButtonEvent(measurement, pickContext);
};
