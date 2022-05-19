/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp, MarginPercent } from "@itwin/core-frontend";

import moment from "moment";

export class UtilitiesService {

  public static getUiTheme(): "light" | "dark" {
    if (
      (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ||
      document.documentElement.getAttribute("data-theme") === "dark"
    ) {
      return "dark";
    }
    return "light";
  }

  public static formatNumericalValue(value: number, decimalDigits = 3, decimalOptional = false): string {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: decimalDigits > 0 && !decimalOptional ? decimalDigits : undefined,
      maximumFractionDigits: decimalDigits > 0 ? decimalDigits : undefined,
    });
  }

  // Date can be any object acceptable by the Moment constructor
  public static formatDate(date: number | string | Date, fromNowFormat = false): string {
    const momentDate = moment(date);
    return fromNowFormat ? moment(date).fromNow() : momentDate.format("YYYY-M-D H:mm");
  }

  // Found out iTwin Settings service will strip ".0" character sequence from field values for some unknown reason
  // This often happens to ISO dates (milliseconds part). This method fixes that
  public static fixDateEncoding(date: string): string {
    return date.replace(".0", ".1");
  }

  // Returns hash of a string
  // Can be used to hash an entity id so you can go to its old GWT config page
  public static getHashForString(str: string): number {
    let hash = 0;
    if (!str.length) {
      return 31;
    }
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return (31 + hash) >>> 0;
  }

  public static invalidateDecorations(): void {
    const viewPort = IModelApp.viewManager.selectedView;
    if (viewPort) {
      viewPort.invalidateDecorations();
    }
  }

  public static centerViewOnElement(elementId: string): void {
    void IModelApp.viewManager.selectedView!.zoomToElements(
      elementId,
      {
        animateFrustumChange: true,
        marginPercent: new MarginPercent(25, 25, 25, 25),
      }
    );
  }

  public static getSupportLink(id: "projectAssociation"): string {
    switch (id) {
      case "projectAssociation":
        return "https://support.infrastructureiot.com/hc/en-us/articles/208406836-Overview";
      default:
        return "https://support.infrastructureiot.com/hc/en-us";
    }
  }

}
