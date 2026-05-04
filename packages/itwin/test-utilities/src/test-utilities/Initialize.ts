/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { IModelHost } from "@itwin/core-backend";
import { Guid, Logger, LogLevel } from "@itwin/core-bentley";
import { IModelReadRpcInterface, RpcConfiguration, RpcDefaultConfiguration } from "@itwin/core-common";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { HierarchyCacheMode, Presentation as PresentationBackend, PresentationBackendNativeLoggerCategory } from "@itwin/presentation-backend";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { Presentation as PresentationFrontend } from "@itwin/presentation-frontend";

import type { IModelHostOptions } from "@itwin/core-backend";
import type { RpcInterfaceDefinition } from "@itwin/core-common";
import type { IModelAppOptions } from "@itwin/core-frontend";
import type { PresentationManagerProps as PresentationBackendProps } from "@itwin/presentation-backend";
import type { PresentationProps as PresentationFrontendProps } from "@itwin/presentation-frontend";

// eslint-disable-next-line @typescript-eslint/no-deprecated
export { HierarchyCacheMode } from "@itwin/presentation-backend";

function initializeRpcInterfaces(interfaces: RpcInterfaceDefinition[]) {
  const config = class extends RpcDefaultConfiguration {
    public override interfaces: any = () => interfaces;
  };

  for (const definition of interfaces) {
    RpcConfiguration.assign(definition, /* istanbul ignore next */ () => config);
  }

  const instance = RpcConfiguration.obtain(config);

  try {
    RpcConfiguration.initializeInterfaces(instance);
    /* c8 ignore start */
  } catch {
    // this may fail with "Error: RPC interface "xxx" is already initialized." because
    // multiple different tests want to set up rpc interfaces
  }
  /* c8 ignore end */
}

const defaultTestOutputDir = join(tmpdir(), "itwinjs", "viewer-components-react", "test-output");
let testOutputDir: string | undefined;
export function getTestOutputDir() {
  return testOutputDir ?? defaultTestOutputDir;
}
export function setTestOutputDir(dir: string | undefined) {
  testOutputDir = dir;
}

let isInitialized = false;

interface InitializeCoreProps {
  /**
   * RPC interfaces to enable. Defaults to `[IModelReadRpcInterface, PresentationRpcInterface]`.
   *
   * Note: Implementations for these interfaces are **not** automatically registered on the backend - that has to be done manually.
   */
  rpcs?: RpcInterfaceDefinition[];
  /** Properties for backend initialization */
  backendProps?: PresentationBackendProps & { id?: string; requestTimeout?: number };
  /** Properties for `IModelHost` */
  backendHostProps?: IModelHostOptions;
  /** Properties for frontend initialization */
  frontendProps?: PresentationFrontendProps;
  /** `IModelApp` options */
  frontendAppOptions?: IModelAppOptions;
  testOutputDir?: string;
}
export async function initializeCore(props?: InitializeCoreProps) {
  if (isInitialized) {
    return;
  }

  if (!props) {
    props = {};
  }

  Logger.initializeToConsole();
  Logger.setLevelDefault(LogLevel.Warning);
  Logger.setLevel("i18n", LogLevel.Error);
  Logger.setLevel("SQLite", LogLevel.Error);
  Logger.setLevel(PresentationBackendNativeLoggerCategory.ECObjects, LogLevel.Warning);

  setTestOutputDir(props.testOutputDir);
  fs.mkdirSync(getTestOutputDir(), { recursive: true });

  // set up rpc interfaces
  initializeRpcInterfaces(props.rpcs ?? [IModelReadRpcInterface, PresentationRpcInterface]);

  // init backend
  // make sure backend gets assigned an id which puts its resources into a unique directory
  props.backendProps = props.backendProps ?? {};
  if (!props.backendProps.id) {
    props.backendProps.id = `test-${Guid.createValue()}`;
  }
  await IModelHost.startup({
    cacheDir: join(getTestOutputDir(), ".cache", `${process.pid}`),
    ...props.backendHostProps,
  });
  PresentationBackend.initialize(props.backendProps);

  // init frontend
  await NoRenderApp.startup(props.frontendAppOptions);
  const defaultFrontendProps: PresentationFrontendProps = {
    presentation: { activeLocale: IModelApp.localization.getLanguageList()[0] },
  };
  await PresentationFrontend.initialize({ ...defaultFrontendProps, ...props.frontendProps });

  isInitialized = true;
}

export async function terminateCore() {
  if (!isInitialized) {
    return;
  }

  // store directory that needs to be cleaned-up
  let hierarchiesCacheDirectory: string | undefined;

  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const hierarchiesCacheConfig = PresentationBackend.initProps?.caching?.hierarchies;

  // eslint-disable-next-line @typescript-eslint/no-deprecated
  if (hierarchiesCacheConfig?.mode === HierarchyCacheMode.Disk) {
    hierarchiesCacheDirectory = hierarchiesCacheConfig?.directory;
    // eslint-disable-next-line @typescript-eslint/no-deprecated
  } else if (hierarchiesCacheConfig?.mode === HierarchyCacheMode.Hybrid) {
    hierarchiesCacheDirectory = hierarchiesCacheConfig?.disk?.directory;
  }

  // terminate backend
  PresentationBackend.terminate();
  await IModelHost.shutdown();
  if (hierarchiesCacheDirectory) {
    const { sync: rimrafSync } = await import("rimraf");
    rimrafSync(hierarchiesCacheDirectory);
  }

  // terminate frontend
  PresentationFrontend.terminate();
  await IModelApp.shutdown();

  isInitialized = false;
}
