/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { createContext, useContext } from "react";
import type { GroupExtension } from "../../utils";

export interface IGroupExtension {
  extensions?: GroupExtension[];
  extendsDefault?: boolean;
}

export const createDefaultGroupExtension = (): IGroupExtension => {
  return {
    extension: [],
    extendsDefault: true,
  } as IGroupExtension;
};

export const createGroupExtension = (
  extensionProp: IGroupExtension | undefined,
): IGroupExtension => {
  if (undefined === extensionProp) {
    return createDefaultGroupExtension();
  }
  return extensionProp;
};

export const GroupExtensionContext = createContext<IGroupExtension>(
  createDefaultGroupExtension(),
);

export const useGroupExtension = () => {
  const context = useContext(GroupExtensionContext);
  if (!context) {
    throw new Error(
      "useGroupExtension should be used within a GroupExtensionContext provider",
    );
  }
  return context;
};
