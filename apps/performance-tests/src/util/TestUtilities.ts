/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { it } from "vitest";
import { SnapshotDb } from "@itwin/core-backend";
import { IModelConnection } from "@itwin/core-frontend";
import { MainThreadBlocksDetector } from "./MainThreadBlocksDetector.js";

import type { TaskMeta } from "vitest";
import type { IModelDb } from "@itwin/core-backend";
import type { Summary } from "./MainThreadBlocksDetector.js";

interface TestStepEntry {
  name: string;
  blockingSummary: Summary;
  duration: number;
}

declare module "vitest" {
  interface TaskMeta {
    testSteps?: Array<TestStepEntry>;
  }
}

export interface RunOptions<TContext> {
  /** Name of the test. */
  testName: string;

  /** Callback to run before the test that should produce the context required for the test. */
  setup(): TContext | Promise<TContext>;

  /** Test steps which are run in order and measured. */
  testSteps: Array<{
    name?: string;
    callBack: (x: TContext) => void | Promise<void>;
    ignoreMeasurement?: boolean; // if true, the time spent in this step will not be measured and included in the results
  }>;

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

  const testFunc = async ({ task }: { task: { meta: TaskMeta } }) => {
    const blockHandler = new MainThreadBlocksDetector();
    const value = await props.setup();
    try {
      for (const { name, callBack, ignoreMeasurement } of props.testSteps) {
        console.log(`Step "${name ?? "unknown"}" in progress...`);
        const start = Date.now();
        try {
          if (!ignoreMeasurement) {
            blockHandler.start();
          }
          await callBack(value);
          console.log(`✅ Step "${name ?? "unknown"}" done`);
        } finally {
          if (!ignoreMeasurement) {
            await blockHandler.stop();
            task.meta.testSteps ??= [];
            task.meta.testSteps.push({
              name: name ?? "unknown",
              blockingSummary: blockHandler.getSummary(),
              duration: Date.now() - start,
            });
          }
        }
      }
    } finally {
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
  readonly #db: IModelDb;
  // This was added based on this: https://github.com/iTwin/itwinjs-core/pull/7171/files#diff-9d26b04e7ae074b911fb87be3425360d7bd55a7c9f947f5aed1ba36d359f01eb
  constructor(db: IModelDb) {
    super(db.getConnectionProps());
    this.#db = db;
    IModelConnection.onOpen.raiseEvent(this);
  }

  public override get isClosed(): boolean {
    return !this.#db.isOpen;
  }

  public override async close(): Promise<void> {
    this.#db.close();
  }

  public static openFile(filePath: string): { iModelConnection: IModelConnection; iModel: SnapshotDb } {
    const db = SnapshotDb.openFile(filePath);
    return {
      iModelConnection: new TestIModelConnection(db),
      iModel: db,
    };
  }
}
