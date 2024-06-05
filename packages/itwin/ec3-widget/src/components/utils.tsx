/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { SvgChevronLeft } from "@itwin/itwinui-icons-react";
import { ProgressRadial, toaster } from "@itwin/itwinui-react";
import { Text } from "@itwin/itwinui-react";
import "./utils.scss";
import React from "react";

export interface WidgetHeaderProps {
  title: string;
  disabled?: boolean;
  returnFn?: () => Promise<void>;
}

export const WidgetHeader = ({ title, disabled = false, returnFn }: WidgetHeaderProps) => {
  return (
    <div className="ec3w-widget-header-container">
      {returnFn && (
        <div
          className={disabled ? "ec3w-chevron-disabled" : "ec3w-chevron"}
          onClick={disabled ? undefined : returnFn}
          onKeyUp={disabled ? undefined : returnFn}
        >
          <SvgChevronLeft />
        </div>
      )}
      <Text className="ec3w-title" variant="title">
        {title}
      </Text>
    </div>
  );
};

export const LoadingOverlay = () => (
  <div className="ec3w-center-overlay">
    <Text>Loading</Text>
    <ProgressRadial indeterminate />
    <Text>Please wait...</Text>
  </div>
);

interface EmptyMessageProps {
  message: string;
}

export const EmptyMessage = ({ message }: EmptyMessageProps) => (
  <div className="ec3w-center-overlay">
    <Text>{message}</Text>
  </div>
);

export const handleInputChange = <T,>(e: React.ChangeEvent<HTMLInputElement>, values: T, setValues: React.Dispatch<React.SetStateAction<T>>) => {
  const { name, value } = e.target;

  setValues({
    ...values,
    [name]: value,
  });
};

export const handleSelectChange = <T,>(value: string, name: string, values: T, setValues: React.Dispatch<React.SetStateAction<T>>) => {
  setValues({
    ...values,
    [name]: value,
  });
};

export const LoadingSpinner = () => {
  return (
    <div className="ec3w-loading-spinner">
      <ProgressRadial size="small" indeterminate />
    </div>
  );
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
