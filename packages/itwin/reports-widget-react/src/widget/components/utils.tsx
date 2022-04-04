/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { SvgChevronLeft } from "@itwin/itwinui-icons-react";
import { ProgressRadial, Text, toaster } from "@itwin/itwinui-react";
import "./utils.scss";
import React from "react";
import { IModelApp } from "@itwin/core-frontend";

export interface WidgetHeaderProps {
  title: string;
  disabled?: boolean;
  returnFn?: () => Promise<void>;
}

export const WidgetHeader = ({
  title,
  disabled = false,
  returnFn,
}: WidgetHeaderProps) => {
  return (
    <div className='widget-header-container'>
      {returnFn && (
        <div
          className={disabled ? "chevron-disabled" : "chevron"}
          onClick={disabled ? undefined : returnFn}
        >
          <SvgChevronLeft />
        </div>
      )}
      <Text className='title' variant='title'>
        {title}
      </Text>
    </div>
  );
};

export const handleError = (errorStatus: number) => {
  let errorMessage = IModelApp.localization.getLocalizedString("ReportsWidget:ErrorMessages.Error");
  switch (errorStatus) {
    case 401:
      errorMessage += IModelApp.localization.getLocalizedString("ReportsWidget:ErrorMessages.401");
      break;
    case 403:
      errorMessage += IModelApp.localization.getLocalizedString("ReportsWidget:ErrorMessages.403");
      break;
    case 404:
      errorMessage += IModelApp.localization.getLocalizedString("ReportsWidget:ErrorMessages.404");
      break;
    case 409:
      errorMessage += IModelApp.localization.getLocalizedString("ReportsWidget:ErrorMessages.409");
      break;
    case 422:
      errorMessage += IModelApp.localization.getLocalizedString("ReportsWidget:ErrorMessages.422");
      break;
    case 429:
      errorMessage += IModelApp.localization.getLocalizedString("ReportsWidget:ErrorMessages.429");
      break;
    case 500:
      errorMessage += IModelApp.localization.getLocalizedString("ReportsWidget:ErrorMessages.500");
      break;
    case 502:
      errorMessage += IModelApp.localization.getLocalizedString("ReportsWidget:ErrorMessages.502");
      break;
    case 503:
      errorMessage += IModelApp.localization.getLocalizedString("ReportsWidget:ErrorMessages.503");
      break;
    default:
      errorMessage += IModelApp.localization.getLocalizedString("ReportsWidget:ErrorMessages.SomethingWentWrong");
  }
  toaster.negative(errorMessage);

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

export const LoadingSpinner = () => {
  return (
    <div className="rp-loading-spinner">
      <ProgressRadial size="small" indeterminate />
    </div>
  );
};

export const prefixUrl = (baseUrl?: string, prefix?: string) => {
  if (prefix && baseUrl) {
    return baseUrl.replace("api.bentley.com", `${prefix}api.bentley.com`);
  }
  return baseUrl;
};

export type CreateTypeFromInterface<Interface> = {
  [Property in keyof Interface]: Interface[Property];
};
