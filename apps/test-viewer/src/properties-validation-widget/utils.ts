/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { QueryRowFormat } from "@itwin/core-common";
import type { IModelConnection } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import { toaster } from "@itwin/itwinui-react";

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
      return "You are unauthorized to do this operation.";
    case 403:
      return "You don't have permission to access the requested resource.";
    case 404:
      return "The requested resource was not found.";
    case 409:
      return "This property name is already being used.";
    case 422:
      return "Unable to process the request.";
    case 429:
      return "Too many requests.";
    case 500:
      return "Internal server error.";
    case 502:
      return "Bad gateway.";
    case 503:
      return "Service unavailable.";
    default:
      return "Something went wrong!";
  }
};

export const handleError = (errorStatus: number) => {
  const baseErrorMessage = "Error!";
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
