/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { IModelDb, SnapshotDb } from "@itwin/core-backend";
import { IModelConnection } from "@itwin/core-frontend";

export interface RunOptions<TContext> {
  /** Name of the test. */
  testName: string;

  /** Callback to run before the test that should produce the context required for the test. */
  setup(): TContext | Promise<TContext>;

  /** Test function to run and measure. */
  test(x: TContext): void | Promise<void>;

  /** Callback that cleans up the context produced by the "before" callback. */
  cleanup?: (x: TContext) => void | Promise<void>;

  /** Whether or not to run exclusively this test. */
  only?: boolean;

  /** Whether or not to skip this test. */
  skip?: boolean;
}

/** Runs a test and passes information about it to the TestReporter. */
export function run<T>(props: RunOptions<T>): void {
  if (props.skip) {
    return;
  }

  const testFunc = async function (this: Mocha.Context) {
    let value: T;
    try {
      value = await props.setup();
    } finally {
      this.test!.ctx!.reporter.onTestStart();
    }

    try {
      await props.test(value);
    } finally {
      await this.test!.ctx!.reporter.onTestEnd();
      await props.cleanup?.(value);
    }
  };

  if (props.only) {
    it.only(props.testName, testFunc);
  } else {
    it(props.testName, testFunc);
  }
}

/**
 * Implementation of `IModelConnection` that allows opening local files in tests.
 * @beta
 */
export class TestIModelConnection extends IModelConnection {
  // This was added based on this: https://github.com/iTwin/itwinjs-core/pull/7171/files#diff-9d26b04e7ae074b911fb87be3425360d7bd55a7c9f947f5aed1ba36d359f01eb
  constructor(private readonly _db: IModelDb) {
    // eslint-disable-next-line @itwin/no-internal
    super(_db.getConnectionProps());
    IModelConnection.onOpen.raiseEvent(this);
  }

  public override get isClosed(): boolean {
    // eslint-disable-next-line @itwin/no-internal
    return !this._db.isOpen;
  }

  public override async close(): Promise<void> {
    this._db.close();
  }

  public static openFile(filePath: string): { iModelConnection: IModelConnection; iModel: SnapshotDb } {
    const db = SnapshotDb.openFile(filePath);
    return {
      iModelConnection: new TestIModelConnection(db),
      iModel: db,
    };
  }
}
