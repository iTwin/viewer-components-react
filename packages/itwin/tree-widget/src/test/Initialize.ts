/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { IModelHost } from "@itwin/core-backend";
import { IModelReadRpcInterface, RpcConfiguration, RpcDefaultConfiguration } from "@itwin/core-common";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";

import type { RpcInterfaceDefinition } from "@itwin/core-common";

export async function initializeITwinJs() {
  await IModelHost.startup();
  // eslint-disable-next-line @itwin/no-internal
  ECSchemaRpcImpl.register();

  initializeRpcInterfaces([IModelReadRpcInterface, ECSchemaRpcInterface]);
  await NoRenderApp.startup();
}

export async function terminateITwinJs() {
  await IModelApp.shutdown();
  await IModelHost.shutdown();
}

function initializeRpcInterfaces(interfaces: RpcInterfaceDefinition[]) {
  const config = class extends RpcDefaultConfiguration {
    public override interfaces: any = () => interfaces;
  };

  for (const definition of interfaces) {
    // eslint-disable-next-line @itwin/no-internal
    RpcConfiguration.assign(definition, /* istanbul ignore next */ () => config);
  }

  const instance = RpcConfiguration.obtain(config);

  try {
    RpcConfiguration.initializeInterfaces(instance);
  } catch {
    // this may fail with "Error: RPC interface "xxx" is already initialized." because
    // multiple different tests want to set up rpc interfaces
  }
}
