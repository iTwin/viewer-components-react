/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { I18N } from "@bentley/imodeljs-i18n";

/**
 * RealityData class provides utility methods that must be called by host application that want RealityData support.
 */
export class RealityData {
  private static _i18n?: I18N;
  private static _complaint = "RealityData not initialized";

  /** @internal */
  public static get packageName(): string {
    return "reality-data";
  }

  /** The internationalization service created by the IModelApp. */
  public static get i18n(): I18N {
    if (!RealityData._i18n) throw new Error(RealityData._complaint);
    return RealityData._i18n;
  }

  /** The internationalization service namespace. */
  public static get i18nNamespace(): string {
    return "RealityData";
  }

  /** Calls i18n.translateWithNamespace with the "RealityData" namespace. Do NOT include the namespace in the key.
   * @internal
   */
  public static translate(
    key: string | string[],
    options?: any,
  ): string {
    return RealityData.i18n.translateWithNamespace(
      RealityData.i18nNamespace,
      key,
      options,
    );
  }

  /**
   * Called by IModelApp to initialize the RealityData
   * @param i18n The internationalization service created by the IModelApp.
   *
   * @internal
   */
  public static async initialize(i18n: I18N): Promise<void> {
    RealityData._i18n = i18n;
    const packageNamespace = RealityData._i18n.registerNamespace(
      RealityData.i18nNamespace,
    );
    await packageNamespace.readFinished;
  }

  /** Unregister the RealityData internationalization service namespace */
  public static terminate() {
    if (RealityData._i18n) {
      RealityData._i18n.unregisterNamespace(RealityData.i18nNamespace);
      RealityData._i18n = undefined;
    }
  }
}

export default RealityData;
