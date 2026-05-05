/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { IModelDb } from "@itwin/core-backend";
import type { IModelConnection } from "@itwin/core-frontend";
import { expect } from "vitest";
import type { ImportSchemaResult } from "test-utilities";
import { buildIModel as buildNamedIModel, importSchema } from "test-utilities";

export async function buildIModel(
  setup?: (imodel: IModelDb, testSchema: TestSchemaDefinition) => Promise<void>,
): Promise<{ imodelConnection: IModelConnection; testSchema: TestSchemaDefinition }>;
export async function buildIModel<TResult extends object>(
  setup: (imodel: IModelDb, testSchema: TestSchemaDefinition) => Promise<TResult>,
): Promise<{ imodelConnection: IModelConnection; testSchema: TestSchemaDefinition } & TResult>;
export async function buildIModel<TResult extends object | undefined>(setup?: (imodel: IModelDb, testSchema: TestSchemaDefinition) => Promise<TResult>) {
  return buildNamedIModel(getTestName(), async (imodel) => {
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
}

interface TestSchemaDefinition extends ImportSchemaResult {
  items: { SubModelablePhysicalObject: { name: string; fullName: string; label: string } };
}

function getTestName(): string {
  return expect.getState().currentTestName?.replace(/[^\w]/gi, "-").replace(/-+/g, "-").toLowerCase() ?? "unknown";
}
