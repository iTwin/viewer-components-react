/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { buildIModel as buildNamedIModel, importSchema } from "test-utilities";

import type { ImportSchemaResult } from "test-utilities";
import type { IModelDb } from "@itwin/core-backend";
import type { IModelConnection } from "@itwin/core-frontend";

export async function buildIModel(
  mochaContext: Mocha.Context,
  setup?: (imodel: IModelDb, testSchema: TestSchemaDefinition) => Promise<void>,
): Promise<{ imodelConnection: IModelConnection } & AsyncDisposable>;
export async function buildIModel<TResult extends object>(
  mochaContext: Mocha.Context,
  setup: (imodel: IModelDb, testSchema: TestSchemaDefinition) => Promise<TResult>,
): Promise<{ imodelConnection: IModelConnection } & TResult & AsyncDisposable>;
export async function buildIModel<TResult extends object | undefined>(
  mochaContext: Mocha.Context,
  setup?: (imodel: IModelDb, testSchema: TestSchemaDefinition) => Promise<TResult>,
) {
  const testName = mochaContext.currentTest?.fullTitle() ?? mochaContext.test?.fullTitle() ?? "unknown";
  const res = await buildNamedIModel(testName, async (imodel) => {
    const testSchema = (await importSchema({
      imodel,
      schemaContentXml: `
        <ECSchemaReference name="BisCore" version="01.00.16" alias="bis" />
        <ECEntityClass typeName="SubModelablePhysicalObject" displayLabel="Test Physical Object" modifier="Sealed" description="Similar to generic:PhysicalObject but also sub-modelable.">
          <BaseClass>bis:PhysicalElement</BaseClass>
          <BaseClass>bis:ISubModeledElement</BaseClass>
        </ECEntityClass>
      `,
      schemaName: "TestSchema",
      schemaAlias: "test",
    })) as TestSchemaDefinition;
    const setupResult = setup ? await setup(imodel, testSchema) : undefined;
    return { ...setupResult, testSchema };
  });
  return {
    ...res,
    [Symbol.asyncDispose]: async () => {
      await res.imodelConnection.close();
    },
  };
}

interface TestSchemaDefinition extends ImportSchemaResult {
  items: { SubModelablePhysicalObject: { name: string; fullName: string; label: string } };
}
