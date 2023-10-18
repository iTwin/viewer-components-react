/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./utils.scss";
import type React from "react";
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

export interface EmptyMessageProps {
  message: string;
}

export const enableExperimentalFeatures = async (iModelConnection: IModelConnection) => {
  const reader = iModelConnection.createQueryReader("PRAGMA experimental_features_enabled=true");
  await reader.step();
};
