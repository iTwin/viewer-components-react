/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { randomUUID } from "node:crypto";
import { buildIModel as buildNamedIModel, importSchema } from "test-utilities";
import { expect } from "vitest";

import type { ImportSchemaResult } from "test-utilities";
import type { IModelDb } from "@itwin/core-backend";
import type { IModelConnection } from "@itwin/core-frontend";
import type { EC } from "@itwin/presentation-shared";

function getUniqueIModelName(): string {
  const testName = expect.getState().currentTestName?.replace(/[^\w]/gi, "-").replace(/-+/g, "-").toLowerCase() ?? "unknown";
  // `currentTestName` is the same for every `buildIModel` call made within a single test (or `undefined`/"unknown" when called
  // outside of a test, e.g. in `beforeAll`), and can also collide across different test files running in parallel. Appending a
  // random suffix avoids different imodels colliding on the same backing file, which would corrupt already open connections.
  return `${testName}-${randomUUID()}`;
}

export namespace TestSchema {
  export const Name = "TestSchema";
  export const ModeledElement2dClassName = "SubModelableDrawingGraphic";
  export const SubModel2dClassName = "DrawingGraphicModel";
  export const ModeledElement3dClassName = "SubModelablePhysicalObject";
}

export async function buildIModel(
  setup?: (imodel: IModelDb, testSchema: TestSchemaDefinition) => Promise<void>,
): Promise<{ imodelConnection: IModelConnection } & AsyncDisposable>;
export async function buildIModel<TResult extends object>(
  setup: (imodel: IModelDb, testSchema: TestSchemaDefinition) => Promise<TResult>,
): Promise<{ imodelConnection: IModelConnection } & TResult & AsyncDisposable>;
export async function buildIModel<TResult extends object | undefined>(setup?: (imodel: IModelDb, testSchema: TestSchemaDefinition) => Promise<TResult>) {
  const testName = getUniqueIModelName();
  const res = await buildNamedIModel(testName, async (imodel) => {
    const testSchema = (await importSchema({
      imodel,
      schemaContentXml: `
        <ECSchemaReference name="BisCore" version="01.00.16" alias="bis" />
        <ECEntityClass typeName="${TestSchema.ModeledElement3dClassName}" displayLabel="Test Physical Object" modifier="Sealed" description="Similar to generic:PhysicalObject but also sub-modelable.">
          <BaseClass>bis:PhysicalElement</BaseClass>
          <BaseClass>bis:ISubModeledElement</BaseClass>
        </ECEntityClass>
        <ECEntityClass typeName="${TestSchema.ModeledElement2dClassName}" displayLabel="Test Drawing Graphic" modifier="Sealed" description="A sub-modelable 2d graphic that is a sibling of bis:DrawingGraphic (not derived from it).">
          <BaseClass>bis:GraphicalElement2d</BaseClass>
          <BaseClass>bis:ISubModeledElement</BaseClass>
        </ECEntityClass>
        <ECEntityClass typeName="${TestSchema.SubModel2dClassName}" displayLabel="Drawing Graphic Model" modifier="Sealed" description="A 2d geometric model that can sub-model a DrawingGraphic element.">
          <BaseClass>bis:GraphicalModel2d</BaseClass>
        </ECEntityClass>
        <ECRelationshipClass typeName="DrawingGraphicModelBreaksDownSubModelableDrawingGraphic" strength="embedding" strengthDirection="backward" modifier="None">
          <BaseClass>bis:ModelModelsElement</BaseClass>
          <Source multiplicity="(0..1)" roleLabel="models" polymorphic="true">
              <Class class="DrawingGraphicModel"/>
          </Source>
          <Target multiplicity="(0..1)" roleLabel="is modeled by" polymorphic="true">
              <Class class="SubModelableDrawingGraphic"/>
          </Target>
        </ECRelationshipClass>
      `,
      schemaName: TestSchema.Name,
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
  items: {
    [TestSchema.ModeledElement3dClassName]: { name: string; fullName: EC.FullClassNameDotNotation; label: string };
    [TestSchema.ModeledElement2dClassName]: { name: string; fullName: EC.FullClassNameDotNotation; label: string };
    [TestSchema.SubModel2dClassName]: { name: string; fullName: EC.FullClassNameDotNotation; label: string };
  };
}
