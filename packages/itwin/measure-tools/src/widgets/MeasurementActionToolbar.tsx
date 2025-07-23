/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import type { XAndY } from "@itwin/core-geometry";
import { Point2d } from "@itwin/core-geometry";
import type { ItemProps, ToolbarActionItem } from "@itwin/appui-react";
import {
  ActionButtonItemDef,
  CursorInformation,
  PopupManager,
  PositionPopup,
  Toolbar,
  ToolbarItemUtilities
} from "@itwin/appui-react";
import { IModelApp } from "@itwin/core-frontend";
import { Direction } from "@itwin/components-react";

import { FeatureTracking, MeasureToolsFeatures } from "../api/FeatureTracking.js";
import type { Measurement, MeasurementPickContext } from "../api/Measurement.js";
import { MeasurementManager } from "../api/MeasurementManager.js";
import { MeasurementSelectionSet } from "../api/MeasurementSelectionSet.js";
import { MeasurementUIEvents } from "../api/MeasurementUIEvents.js";
import { ShimFunctions } from "../api/ShimFunctions.js";
import { DistanceMeasurement } from "../measurements/DistanceMeasurement.js";
import { PopupToolbar } from "./PopupToolbar.js";
import { MeasureTools } from "../MeasureTools.js";

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
  public override execute(): void {
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
      label: () => MeasureTools.localization.getLocalizedString("MeasureTools:Measurements.clearMeasurement"),
      tooltip: () => MeasureTools.localization.getLocalizedString("MeasureTools:Measurements.clearMeasurement"),
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
      label: () => MeasureTools.localization.getLocalizedString("MeasureTools:Generic.properties"),
      tooltip: () => MeasureTools.localization.getLocalizedString("MeasureTools:Generic.properties"),
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
      label: () => MeasureTools.localization.getLocalizedString("MeasureTools:Generic.unlock"),
      tooltip: () => MeasureTools.localization.getLocalizedString("MeasureTools:Generic.unlock"),
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
      label: () => MeasureTools.localization.getLocalizedString("MeasureTools:Generic.lock"),
      tooltip: () => MeasureTools.localization.getLocalizedString("MeasureTools:Generic.lock"),
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

  public static get hideMeasurements() {
    return new MeasurementActionItemDef({
      id: "hide-measurements",
      iconSpec: "icon-visibility-hide",
      label: () => MeasureTools.localization.getLocalizedString("MeasureTools:Generic.hideMeasurements"),
      tooltip: () => MeasureTools.localization.getLocalizedString("MeasureTools:Generic.hideMeaurements"),
      execute: (args: Measurement[]) => {
        args.forEach((m) => {
          if (m.isVisible) {
            m.isVisible = false;
            m.viewTarget.invalidateViewportDecorations();
          }
        });

        FeatureTracking.notifyToggledFeature(MeasureToolsFeatures.MeasurementActions_ToggleDisplayMeasurements, false);
      },
    });
  }

  public static get displayMeasurements() {
    return new MeasurementActionItemDef({
      id: "display-measurements",
      iconSpec: "icon-visibility",
      label: () => MeasureTools.localization.getLocalizedString("MeasureTools:Generic.displayMeasurements"),
      tooltip: () => MeasureTools.localization.getLocalizedString("MeasureTools:Generic.displayMeasurements"),
      execute: (args: Measurement[]) => {
        args.forEach((m) => {
          if (!m.isVisible) {
            m.isVisible = true;
            m.viewTarget.invalidateViewportDecorations();
          }
        });

        FeatureTracking.notifyToggledFeature(MeasureToolsFeatures.MeasurementActions_ToggleDisplayMeasurements, true);
      },
    });
  }

  public static get displayMeasurementLabels() {
    return new MeasurementActionItemDef({
      id: "display-labels",
      iconSpec: "icon-layers",
      label: () => MeasureTools.localization.getLocalizedString("MeasureTools:Generic.displayLabels"),
      tooltip: () => MeasureTools.localization.getLocalizedString("MeasureTools:Generic.displayLabels"),
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
      label: () => MeasureTools.localization.getLocalizedString("MeasureTools:Generic.hideLabels"),
      tooltip: () => MeasureTools.localization.getLocalizedString("MeasureTools:Generic.hideLabels"),
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
      label: () => MeasureTools.localization.getLocalizedString("MeasureTools:Generic.displayMeasurementAxes"),
      tooltip: () => MeasureTools.localization.getLocalizedString("MeasureTools:Generic.displayMeasurementAxes"),
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
      label: () => MeasureTools.localization.getLocalizedString("MeasureTools:Generic.hideMeasurementAxes"),
      tooltip: () => MeasureTools.localization.getLocalizedString("MeasureTools:Generic.hideMeasurementAxes"),
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
   * @returns true if the toolbar was opened, false if otherwise (e.g. no action items to view).
   */
  public static openToolbar(measurements: Measurement[], screenPoint: XAndY, offset?: XAndY): boolean {
    // Ensure a previous toolbar was closed out
    this.closeToolbar(false);

    const measurementsForActions = measurements.filter((m) => m.allowActions);
    if (measurementsForActions.length === 0) return false;

    if (this._filterHandler && !this._filterHandler(measurementsForActions)) return false;

    // Query all action items...if have none, do not show the toolbar
    const itemList = this.buildActionList(measurementsForActions);
    if (itemList.length === 0) return false;

    // Build toolbar ID, making it unique so we can fade out a previous toolbar and not have that interfere with a new toolbar
    this._lastPopupId = `measurement-action-toolbar-${this._counter.toString()}`;
    this._counter++;

    // Show toolbar
    const realOffset = offset !== undefined ? offset : Point2d.createZero();
    const parentDocument = IModelApp.viewManager.selectedView?.vpDiv.ownerDocument;
    if (!parentDocument) {
      return false;
    }

    const toolItems: ToolbarActionItem[] = itemList.map((itemDef: MeasurementActionItemDef, index) => {
      itemDef.measurements = measurements;
      return ToolbarItemUtilities.createActionItem(itemDef.id, index * 10, itemDef.iconSpec, itemDef.label, itemDef.execute);
    });
    // Center the toolbar horizontally and position it to specified offset above the cursor point
    const toolbarWidth = toolItems.length * 36; // Approximate width based on typical button size
    const point = {
      x: screenPoint.x - realOffset.x - toolbarWidth / 2,
      y: screenPoint.y - realOffset.y,
    };
    const component = (
      <PositionPopup point={point}>
        <Toolbar expandsTo={Direction.Top} items={toolItems} />
      </PositionPopup>
    );
    PopupManager.addOrUpdatePopup({
      id: this._lastPopupId,
      pt: point,
      component,
      parentDocument,
    });

    FeatureTracking.notifyFeature(MeasureToolsFeatures.MeasurementActionsToolbar_Open);

    return true;
  }

  /** Closes the measurement toolbar.
   * @param fadeOut Optionally animate the toolbar fading out. Default is false.
   */
  public static closeToolbar(fadeOut: boolean = false): void {
    // Forcibly close a fading toolbar if we get another close call otherwise they may interfere with each other
    if (this._fadeoutPopId !== undefined) {
      PopupManager.removePopup(this._fadeoutPopId);
      this._fadeoutPopId = undefined;
    }

    if (this._lastPopupId === undefined) return;

    if (fadeOut) this._fadeoutPopId = this._lastPopupId;

    PopupManager.removePopup(this._lastPopupId);
    this._lastPopupId = undefined;
  }

  /** Adds an action item provider. Action providers have a priority, and the list is sorted from highest priority to lowest.
   * @param provider The action provider to add.
   * @param providerPriority Optionally provide a sort priority (higher values are called first)
   */
  public static addActionProvider(provider: MeasurementActionProvider, providerPriority?: number): void {
    // Filter out duplicates
    this.dropActionProvider(provider);

    const realPriority = providerPriority !== undefined ? providerPriority : 0;
    this._actionProviders.push({ priority: realPriority, provider });

    this._actionProviders.sort((a, b) => b.priority - a.priority);
  }

  /** Remove a specific action item provider. If all are removed, the toolbar will not open.
   * @param provider The action provider to drop.
   */
  public static dropActionProvider(provider: MeasurementActionProvider): void {
    for (let i = 0; i < this._actionProviders.length; i++) {
      if (this._actionProviders[i].provider === provider) this._actionProviders.splice(i, 1);
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
        if (!measurement.isLocked) allMeasurementsLocked = false;

        if (!measurement.displayLabels) allMeasurementsShowingLabels = false;

        if (measurement instanceof DistanceMeasurement) {
          hasDistanceMeasurements = true;
          if (!measurement.showAxes) allDistanceMeasurementsShowingAxes = false;
        }
      }

      actionItemList.push(allMeasurementsLocked ? MeasurementActionDefinitions.unlockAction : MeasurementActionDefinitions.lockAction);
      actionItemList.push(
        allMeasurementsShowingLabels ? MeasurementActionDefinitions.hideMeasurementLabels : MeasurementActionDefinitions.displayMeasurementLabels,
      );

      if (hasDistanceMeasurements)
        actionItemList.push(
          allDistanceMeasurementsShowingAxes ? MeasurementActionDefinitions.hideMeasurementAxes : MeasurementActionDefinitions.displayMeasurementAxes,
        );

      actionItemList.push(MeasurementActionDefinitions.deleteAction);
      actionItemList.push(MeasurementActionDefinitions.openPropertiesAction);
    });
  }

  private static buildActionList(measurements: Measurement[]): MeasurementActionItemDef[] {
    const itemList = new Array<MeasurementActionItemDef>();

    for (const entry of this._actionProviders) entry.provider(measurements, itemList);

    return itemList;
  }

  private static buildToolbar(measurements: Measurement[], actionItemList: MeasurementActionItemDef[]): React.ReactNode {
    const toolItems: ToolbarActionItem[] = actionItemList.map((itemDef: MeasurementActionItemDef, index) => {
      itemDef.measurements = measurements;
      return ToolbarItemUtilities.createActionItem(itemDef.id, index * 10, itemDef.iconSpec, itemDef.label, itemDef.execute);
    });
    return <PopupToolbar items={toolItems} onClose={() => MeasurementActionToolbar.closeToolbar(true)} />;
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
  MeasurementActionToolbar.openToolbar(measurements, CursorInformation.cursorPosition, Point2d.create(0, 60));

  // Notify global event that this measurement is responding to the button
  MeasurementManager.instance.notifyMeasurementButtonEvent(measurement, pickContext);
};
