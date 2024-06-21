/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
export interface EC3LocalizationResult {
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
  unauthorisedUserMsg: string;
  addNewAssembly: string;
  selectionSummary: string;
  saveButton: string;
  noTemplateMsg: string;
  requiredFieldNotice: string;
  createTemplate: string;
}
