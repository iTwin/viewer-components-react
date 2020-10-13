// Copyright (c) Bentley Systems, Incorporated. All rights reserved.

import { IModelApp, Tool } from "@bentley/imodeljs-frontend";

import { useClass } from "../utils";
import { useOnMount, useOnUnmount } from "../utils/basic-hooks";

/**
 * a hook for using an imodeljs Tool subclass in a functional component, this allows you to reference
 * react state easily, and automatically registers and unregisters the tool on component mount/unmount
 */
export const useToolClass = <
  Class extends (new (...args: any) => Tool) & typeof Tool
>(
  toolClass: Class
) => {
  const tool = useClass(toolClass);

  useOnMount(() => IModelApp.tools.register(tool));
  useOnUnmount(() => IModelApp.tools.unRegister(toolClass.toolId));

  return tool;
};
