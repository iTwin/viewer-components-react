/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ProgressRadial, Text, toaster } from "@itwin/itwinui-react";
import "./utils.scss";
import React from "react";
import type { IModelConnection } from "@itwin/core-frontend";
import { QueryRowFormat } from "@itwin/core-common";

export const handleInputChange = <T,>(
  e: React.ChangeEvent<HTMLInputElement>,
  values: T,
  setValues: (newValues: T) => void,
) => {
  const { name, value } = e.target;

  setValues({
    ...values,
    [name]: value,
  });
};

export const fetchIdsFromQuery = async (
  query: string,
  iModelConnection: IModelConnection,
) => {
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

export const LoadingOverlay = () => (
  <div className='gmw-center-overlay'>
    <Text>Loading</Text>
    <ProgressRadial indeterminate />
    <Text>Please wait...</Text>
  </div>
);

interface EmptyMessageProps {
  message: string;
}

export const EmptyMessage = ({ message }: EmptyMessageProps) => (
  <div className='gmw-center-overlay'>
    <Text>{message}</Text>
  </div>
);

export const LoadingSpinner = () => {
  return (
    <div className="gmw-loading-spinner">
      <ProgressRadial size="small" indeterminate />
    </div>
  );
};

export const enableExperimentalFeatures = async (iModelConnection: IModelConnection) => {
  const reader = iModelConnection.createQueryReader("PRAGMA experimental_features_enabled=true");
  await reader.step();
};
