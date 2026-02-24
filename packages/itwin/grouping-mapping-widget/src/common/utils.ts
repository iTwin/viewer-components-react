/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { QueryRowFormat } from "@itwin/core-common";
import type { IModelConnection } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import { toaster } from "@itwin/itwinui-react";
import { GroupingMappingWidget } from "../GroupingMappingWidget";

export type CreateTypeFromInterface<Interface> = {
  [Property in keyof Interface]: Interface[Property];
};

export function debounce<F extends (...args: any[]) => void>(f: F, delay: number) {
  let timer: number | undefined;
  return (...args: any[]) => {
    timer && window.clearTimeout(timer);
    timer = window.setTimeout(f, delay, ...args);
  };
}

export const fetchIdsFromQuery = async (query: string, iModelConnection: IModelConnection) => {
  if (query === "") {
    return [];
  }
  const ids: string[] = [];
  const rowIterator = iModelConnection.query(query, undefined, {
    rowFormat: QueryRowFormat.UseJsPropertyNames,
  });
  while (true) {
    const { done, value } = await rowIterator.next();
    if (done) {
      break;
    }
    if (Object.keys(value).includes("id")) {
      ids.push(value.id);
    } else if (Object.keys(value).includes("element.id")) {
      ids.push(value["element.id"]);
    } else if (Object.keys(value).includes("eCInstanceId")) {
      ids.push(value.eCInstanceId);
    }
  }
  return ids;
};

export const getErrorMessage = (errorStatus: number): string => {
  switch (errorStatus) {
    case 401:
      return GroupingMappingWidget.translate("errors.unauthorized");
    case 403:
      return GroupingMappingWidget.translate("errors.forbidden");
    case 404:
      return GroupingMappingWidget.translate("errors.notFound");
    case 409:
      return GroupingMappingWidget.translate("errors.conflict");
    case 422:
      return GroupingMappingWidget.translate("errors.unprocessable");
    case 429:
      return GroupingMappingWidget.translate("errors.tooManyRequests");
    case 500:
      return GroupingMappingWidget.translate("errors.internalServerError");
    case 502:
      return GroupingMappingWidget.translate("errors.badGateway");
    case 503:
      return GroupingMappingWidget.translate("errors.serviceUnavailable");
    default:
      return GroupingMappingWidget.translate("errors.generic");
  }
};

export const handleError = (errorStatus: number) => {
  const baseErrorMessage = GroupingMappingWidget.translate("errors.errorPrefix");
  const specificErrorMessage = getErrorMessage(errorStatus);
  const fullErrorMessage = `${baseErrorMessage} ${specificErrorMessage}`;

  toaster.negative(fullErrorMessage);
};

export const handleInputChange = <T>(e: React.ChangeEvent<HTMLInputElement>, values: T, setValues: (newValues: T) => void) => {
  const { name, value } = e.target;

  setValues({
    ...values,
    [name]: value,
  });
};

export const enableExperimentalFeatures = async (iModelConnection: IModelConnection) => {
  const reader = iModelConnection.createQueryReader("PRAGMA experimental_features_enabled=true");
  await reader.step();
};

export const getLocalizedStringPresentation = (input: string): string => {
  // https://www.itwinjs.org/presentation/advanced/localization/
  // Check if the string starts and ends with "@"
  if (input.startsWith("@") && input.endsWith("@")) {
    // Remove the leading and trailing "@" from the string
    const trimmedString = input.substring(1, input.length - 1);

    return IModelApp.localization.getLocalizedString(trimmedString);
  }

  return input;
};
