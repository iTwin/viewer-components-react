/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { SvgChevronLeft } from "@itwin/itwinui-icons-react";
import { ProgressRadial, Text, toaster } from "@itwin/itwinui-react";
import "./utils.scss";
import React from "react";
import type { IModelConnection } from "@itwin/core-frontend";
import { QueryRowFormat } from "@itwin/core-common";

export interface WidgetHeaderProps {
  title: string;
  disabled?: boolean;
  returnFn?: () => void;
}

export const WidgetHeader = ({
  title,
  disabled = false,
  returnFn,
}: WidgetHeaderProps) => {
  return (
    <div className='gmw-widget-header-container'>
      {returnFn && (
        <div
          className={disabled ? "gmw-chevron-disabled" : "gmw-chevron"}
          onClick={disabled ? undefined : returnFn}
        >
          <SvgChevronLeft />
        </div>
      )}
      <Text className='gmw-title' variant='title'>
        {title}
      </Text>
    </div>
  );
};

export const handleInputChange = <T,>(
  e: React.ChangeEvent<HTMLInputElement>,
  values: T,
  setValues: React.Dispatch<React.SetStateAction<T>>,
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

export const handleError = (errorStatus: number) => {
  let errorMessage = "Error! ";
  switch (errorStatus) {
    case 401:
      errorMessage += `You are unauthorized to do this operation.`;
      break;
    case 403:
      errorMessage += `You don't have permission to access the requested resource.`;
      break;
    case 404:
      errorMessage += `The requested resource was not found.`;
      break;
    case 409:
      errorMessage += `This property name is already being used.`;
      break;
    case 422:
      errorMessage += `Unable to process the request.`;
      break;
    case 429:
      errorMessage += `Too many requests.`;
      break;
    case 500:
      errorMessage += `Internal server error.`;
      break;
    case 502:
      errorMessage += `Bad gateway.`;
      break;
    case 503:
      errorMessage += `Service unavailable.`;
      break;
    default:
      errorMessage += `Something went wrong!`;
  }
  toaster.negative(errorMessage);

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
