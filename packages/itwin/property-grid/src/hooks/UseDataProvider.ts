/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useState } from "react";
import { PresentationPropertyDataProvider } from "@itwin/presentation-components";
import { trackTime } from "../common/TimeTracker";
import { useTelemetryContext } from "./UseTelemetryContext";

import type { PropertyDataChangeEvent } from "@itwin/components-react";
import type { PropertyDescription, PropertyRecord } from "@itwin/appui-abstract";
import type { KeySet, PageOptions, SelectionInfo } from "@itwin/presentation-common";
import type { IModelConnection } from "@itwin/core-frontend";
import type { IPresentationPropertyDataProvider } from "@itwin/presentation-components";

/**
 * Props for data provider used by `PropertyGrid`
 * @public
 */
export interface DataProviderProps {
  /** Callback that creates custom data provider that should be used instead of default one. */
  createDataProvider?: (imodel: IModelConnection) => IPresentationPropertyDataProvider;
}

/**
 * Custom hook that creates data provider.
 * @internal
 */
export function useDataProvider({ imodel, createDataProvider }: DataProviderProps & { imodel: IModelConnection }) {
  const [state, setState] = useState<IPresentationPropertyDataProvider>();

  const { onPerformanceMeasured } = useTelemetryContext();

  useEffect(() => {
    const provider = new PerformanceTrackingProvider(
      createDataProvider ? createDataProvider(imodel) : new PresentationPropertyDataProvider({ imodel }),
      (elapsedTime) => {
        onPerformanceMeasured("properties-load", elapsedTime);
      },
    );
    setState(provider);
    return () => {
      provider[Symbol.dispose]();
    };
  }, [imodel, createDataProvider, onPerformanceMeasured]);

  return state;
}

class PerformanceTrackingProvider implements IPresentationPropertyDataProvider {
  public onDataChanged: PropertyDataChangeEvent;

  constructor(
    private _wrappedProvider: IPresentationPropertyDataProvider,
    private _onDataLoaded: (elapsedTime: number) => void,
  ) {
    this.onDataChanged = this._wrappedProvider.onDataChanged;
  }

  // istanbul ignore next
  public get displayType() {
    return this._wrappedProvider.displayType;
  }

  public get imodel() {
    return this._wrappedProvider.imodel;
  }

  public get rulesetId() {
    return this._wrappedProvider.rulesetId;
  }

  public get keys() {
    return this._wrappedProvider.keys;
  }
  public set keys(keys: KeySet) {
    this._wrappedProvider.keys = keys;
  }

  // istanbul ignore next
  public get selectionInfo() {
    return this._wrappedProvider.selectionInfo;
  }
  // istanbul ignore next
  public set keyselectionInfos(selectionInfo: SelectionInfo | undefined) {
    this._wrappedProvider.selectionInfo = selectionInfo;
  }

  public [Symbol.dispose](): void {
    safeDispose(this._wrappedProvider);
  }
  // istanbul ignore next
  public dispose() {}

  // istanbul ignore next
  public async getContentDescriptor() {
    return this._wrappedProvider.getContentDescriptor();
  }

  // istanbul ignore next
  public async getContentSetSize() {
    return this._wrappedProvider.getContentSetSize();
  }

  // istanbul ignore next
  public async getContent(pageOptions?: PageOptions | undefined) {
    return this._wrappedProvider.getContent(pageOptions);
  }

  // istanbul ignore next
  public async getFieldByPropertyRecord(propertyRecord: PropertyRecord) {
    // eslint-disable-next-line deprecation/deprecation
    return this._wrappedProvider.getFieldByPropertyRecord(propertyRecord);
  }

  // istanbul ignore next
  public async getFieldByPropertyDescription(descr: PropertyDescription) {
    return this._wrappedProvider.getFieldByPropertyDescription(descr);
  }

  private _lastKeysGuid: string = "";

  public async getData() {
    const hasKeys = this.keys.size > 0;
    const currGuid = this.keys.guid;

    const { finish, dispose } = trackTime(this._lastKeysGuid !== currGuid && hasKeys, this._onDataLoaded);
    this._lastKeysGuid = currGuid;

    const result = await this._wrappedProvider.getData();

    if (currGuid !== this.keys.guid) {
      dispose();
    }

    finish();
    return result;
  }
}

/**
 * A helper that disposes the given object, if it's disposable.
 *
 * The first option is to dispose using the deprecated `dispose` method if it exists on the object.
 * If not, we use the new `Symbol.dispose` method. If that doesn't exist either, the object is
 * considered as non-disposable and nothing is done with it.
 */
function safeDispose(disposable: {} | { [Symbol.dispose]: () => void } | { dispose: () => void }) {
  // istanbul ignore else
  if ("dispose" in disposable) {
    disposable.dispose();
  } else if (Symbol.dispose in disposable) {
    disposable[Symbol.dispose]();
  }
}
