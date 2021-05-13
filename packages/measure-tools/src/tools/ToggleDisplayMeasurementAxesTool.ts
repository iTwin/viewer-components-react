/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Viewport } from "@bentley/imodeljs-frontend";
import { MeasurementPreferences } from "../api/MeasurementPreferences";
import { PrimitiveToolBase} from "../api/MeasurementTool";
import { Feature, MeasureToolsFeatures, FeatureTracking } from "../api/FeatureTracking";

export class ToggleDisplayMeasurementAxesTool extends PrimitiveToolBase {
  public static toolId = "ToggleDisplayMeasurementAxes";

  public static get iconSpec(): string {
    if (MeasurementPreferences.current.displayMeasurementAxes)
      return "icon-measure-2d-hide";

    return "icon-measure-2d-show";
  }

  // Ignore built-in feature tracking on the tool, since we want to add a toggle state to the tracking so we'll call it ourselves
  protected get feature(): Feature | undefined { return undefined; }

  constructor() {
    super();
  }

  public requireWriteableTarget(): boolean {
    return false;
  }

  public isCompatibleViewport(_vp: Viewport | undefined, _isSelectedViewChange: boolean): boolean {
    return true;
  }

  public onPostInstall() {
    super.onPostInstall();

    const isEnabled = !MeasurementPreferences.current.displayMeasurementAxes;
    MeasurementPreferences.current.displayMeasurementAxes = isEnabled;
    FeatureTracking.notifyToggledFeature(MeasureToolsFeatures.Tools_ToggleDisplayMeasurementAxes, isEnabled);

    this.exitTool();
  }

  public onRestartTool(): void {
    const tool = new ToggleDisplayMeasurementAxesTool();
    if (!tool.run())
      this.exitTool();
  }
}
