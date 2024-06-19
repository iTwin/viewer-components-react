/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useMemo } from "react";
import { EC3WidgetUI } from "../EC3WidgetUI";

export interface useEC3WidgetLocalizationResult {
  stepOneTitle: string;
  stepTwoTitle: string;
  stepThreeTitle: string;
  templateName: string;
  templateDescription: string;
  reportSelection: string;
  reportSelectionPlaceholderLoading: string;
  reportSelectionPlaceholderSelect: string;
  assemblyName: string;
  reportTable: string;
  element: string;
  elementPlaceholderSelect: string;
  elementPlaceholderLoading: string;
  selectReportTableFirstPlaceholder: string;
  reportTablesPlaceholderLoading: string;
  reportTablesPlaceholderSelect: string;
  elementQuantity: string;
  elementQuantityPlaceholderSelect: string;
  materials: string;
  materialsSelectPlaceholder: string;
  backButton: string;
  nextButton: string;
  cancelButton: string;
  savingFailedToasterMsg: string;
  unAuthorisedUserMsg: string;
  addNewAssembly: string;
  selectionSummary: string;
  saveButton: string;
  noTemplateMsg: string;
  requiredFieldNotice: string;
  createTemplate: string;
}

/** @internal */
export const compareLocalizedString = (defaultStrings: any, overriddenStrings: any) => {
  let finalStrings: any = {};
  if (overriddenStrings) {
    for (const key in overriddenStrings) {
      if (overriddenStrings.hasOwnProperty(key)) {
        defaultStrings[key] = overriddenStrings[key];
        finalStrings = defaultStrings;
      }
    }
  } else {
    finalStrings = defaultStrings;
  }
  return finalStrings;
};

/** @internal */
export function useEC3WidgetLocalization(overRiddenStrings?: useEC3WidgetLocalizationResult): useEC3WidgetLocalizationResult {
  const localizedStrings = useMemo(() => getLocalizedStrings(overRiddenStrings), [overRiddenStrings]);
  return localizedStrings;
}

function getLocalizedStrings(overRiddenStrings?: useEC3WidgetLocalizationResult): useEC3WidgetLocalizationResult {
  const defaultStrings: useEC3WidgetLocalizationResult = {
    stepOneTitle: EC3WidgetUI.translate("TemplateCreationStepper.stepOneTitle"),
    stepTwoTitle: EC3WidgetUI.translate("TemplateCreationStepper.stepTwoTitle"),
    stepThreeTitle: EC3WidgetUI.translate("TemplateCreationStepper.stepThreeTitle"),
    templateName: EC3WidgetUI.translate("TemplateCreationStepper.templateName"),
    templateDescription: EC3WidgetUI.translate("TemplateCreationStepper.templateDescription"),
    reportSelection: EC3WidgetUI.translate("TemplateCreationStepper.reportSelection"),
    reportSelectionPlaceholderLoading: EC3WidgetUI.translate("TemplateCreationStepper.reportSelectionPlaceholderLoading"),
    reportSelectionPlaceholderSelect: EC3WidgetUI.translate("TemplateCreationStepper.reportSelectionPlaceholderSelect"),
    assemblyName: EC3WidgetUI.translate("TemplateCreationStepper.assemblyName"),
    reportTable: EC3WidgetUI.translate("TemplateCreationStepper.reportTable"),
    element: EC3WidgetUI.translate("TemplateCreationStepper.element"),
    elementPlaceholderSelect: EC3WidgetUI.translate("TemplateCreationStepper.elementPlaceholderSelect"),
    elementPlaceholderLoading: EC3WidgetUI.translate("TemplateCreationStepper.elementPlaceholderLoading "),
    selectReportTableFirstPlaceholder: EC3WidgetUI.translate("TemplateCreationStepper.selectReportTableFirstPlaceholder"),
    reportTablesPlaceholderLoading: EC3WidgetUI.translate("TemplateCreationStepper.reportTablesPlaceholderLoading"),
    reportTablesPlaceholderSelect: EC3WidgetUI.translate("TemplateCreationStepper.reportTablesPlaceholderSelect"),
    elementQuantity: EC3WidgetUI.translate("TemplateCreationStepper.elementQuantity"),
    elementQuantityPlaceholderSelect: EC3WidgetUI.translate("TemplateCreationStepper.elementQuantityPlaceholderSelect"),
    materials: EC3WidgetUI.translate("TemplateCreationStepper.materials"),
    materialsSelectPlaceholder: EC3WidgetUI.translate("TemplateCreationStepper.materialsSelectPlaceholder"),
    backButton: EC3WidgetUI.translate("TemplateCreationStepper.backButton"),
    nextButton: EC3WidgetUI.translate("TemplateCreationStepper.nextButton"),
    cancelButton: EC3WidgetUI.translate("TemplateCreationStepper.cancelButton"),
    savingFailedToasterMsg: EC3WidgetUI.translate("TemplateCreationStepper.savingFailedToasterMsg"),
    unAuthorisedUserMsg: EC3WidgetUI.translate("TemplateCreationStepper.unAuthorisedUserMsg"),
    addNewAssembly: EC3WidgetUI.translate("TemplateCreationStepper.addNewAssembly"),
    selectionSummary: EC3WidgetUI.translate("TemplateCreationStepper.selectionSummary"),
    saveButton: EC3WidgetUI.translate("TemplateCreationStepper.saveButton"),
    requiredFieldNotice: EC3WidgetUI.translate("TemplateCreationStepper.requiredFieldNotice"),
    noTemplateMsg: EC3WidgetUI.translate("TemplateListView.noTemplateMsg"),
    createTemplate: EC3WidgetUI.translate("TemplateCreationStepper.createTemplate"),
  };
  if (overRiddenStrings) {
    const overRidden: useEC3WidgetLocalizationResult = compareLocalizedString(defaultStrings, overRiddenStrings);
    return overRidden;
  }
  return defaultStrings;
}
