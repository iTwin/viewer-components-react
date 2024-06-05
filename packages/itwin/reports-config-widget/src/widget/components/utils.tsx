/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { SvgChevronLeft } from "@itwin/itwinui-icons-react";
import { Icon, ProgressRadial, Text, toaster } from "@itwin/itwinui-react";
import "./utils.scss";
import React from "react";
import { ReportsConfigWidget } from "../../ReportsConfigWidget";

export interface WidgetHeaderProps {
  title: string;
  disabled?: boolean;
  returnFn?: () => void;
}

export const WidgetHeader = ({ title, disabled = false, returnFn }: WidgetHeaderProps) => {
  return (
    <div className="rcw-widget-header-container">
      {returnFn && (
        <Icon
          className={`${disabled ? "rcw-chevron-disabled" : "rcw-chevron"}`}
          onClick={disabled ? undefined : returnFn}
          size="large"
          title={ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Back")}
        >
          <SvgChevronLeft />
        </Icon>
      )}
      <Text className="rcw-title" variant="title">
        {title}
      </Text>
    </div>
  );
};

export const handleError = (errorStatus: number) => {
  let errorMessage = `${ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:ErrorMessages.Error")} `;
  switch (errorStatus) {
    case 401:
      errorMessage += ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:ErrorMessages.401");
      break;
    case 403:
      errorMessage += ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:ErrorMessages.403");
      break;
    case 404:
      errorMessage += ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:ErrorMessages.404");
      break;
    case 409:
      errorMessage += ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:ErrorMessages.409");
      break;
    case 422:
      errorMessage += ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:ErrorMessages.422");
      break;
    case 429:
      errorMessage += ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:ErrorMessages.429");
      break;
    case 500:
      errorMessage += ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:ErrorMessages.500");
      break;
    case 502:
      errorMessage += ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:ErrorMessages.502");
      break;
    case 503:
      errorMessage += ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:ErrorMessages.503");
      break;
    default:
      errorMessage += ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:ErrorMessages.SomethingWentWrong");
  }
  toaster.negative(errorMessage);
};

export const LoadingOverlay = () => (
  <div className="rcw-center-overlay">
    <Text>{ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Loading")}</Text>
    <ProgressRadial indeterminate />
    <Text>{ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:PleaseWait")}</Text>
  </div>
);
interface EmptyMessageProps {
  children?: React.ReactNode;
}
export const EmptyMessage = ({ children }: EmptyMessageProps) => {
  return <div className="rcw-center-overlay">{children}</div>;
};

export const handleInputChange = <T,>(e: React.ChangeEvent<HTMLInputElement>, values: T, setValues: React.Dispatch<React.SetStateAction<T>>) => {
  const { name, value } = e.target;

  setValues({
    ...values,
    [name]: value,
  });
};

export const LoadingSpinner = () => {
  return (
    <div className="rcw-loading-spinner" data-testid="rcw-action-loading-spinner">
      <ProgressRadial size="small" indeterminate />
    </div>
  );
};

export const SkeletonBlock = () => <div className="rcw-skeleton-block iui-skeleton" />;

export const generateUrl = (baseUrl: string, newBaseUrl: string) => {
  return baseUrl.replace("https://api.bentley.com", newBaseUrl);
};

export type CreateTypeFromInterface<Interface> = {
  [Property in keyof Interface]: Interface[Property];
};
