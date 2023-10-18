/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ProgressRadial, Text } from "@itwin/itwinui-react";
import "./utils.scss";
import React from "react";
import type { IModelConnection } from "@itwin/core-frontend";

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
