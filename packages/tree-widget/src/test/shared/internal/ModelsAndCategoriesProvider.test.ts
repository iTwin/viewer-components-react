/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { firstValueFrom } from "rxjs";
import {
  initializeCore,
  insertDrawingCategory,
  insertDrawingModelWithPartition,
  insertPhysicalPartition,
  insertPhysicalSubModel,
  insertSpatialCategory,
  terminateCore,
} from "test-utilities";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withEditTxn } from "@itwin/core-backend";
import { IModel } from "@itwin/core-common";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { createLimitingECSqlQueryExecutor } from "@itwin/presentation-hierarchies";
import { ModelsAndCategoriesProvider } from "../../../tree-widget-react/shared/internal/idsProviders/ModelsAndCategoriesProvider.js";
import { buildIModel, insertGeometricModelWithPartition } from "../../IModelUtils.js";

import type { IModelConnection } from "@itwin/core-frontend";

function createProvider(imodel: IModelConnection, perspective: "2d" | "3d") {
  return new ModelsAndCategoriesProvider({
    queryExecutor: createLimitingECSqlQueryExecutor(createECSqlQueryExecutor(imodel), 1000),
    componentId: "test",
    perspective,
  });
}

describe("ModelsAndCategoriesProvider", () => {
  beforeAll(async () => {
    await initializeCore();
  });

  afterAll(async () => {
    await terminateCore();
  });

  it("returns empty models and categories of the requested perspective", async () => {
    await using buildIModelResult = await buildIModel(async (imodel) =>
      withEditTxn(imodel, (txn) => {
        const model3d = insertGeometricModelWithPartition({ txn, codeValue: "model3d" });
        const planProjectionPartition = insertPhysicalPartition({ txn, codeValue: "plan projection", parentId: IModel.rootSubjectId });
        const planProjectionModel = insertPhysicalSubModel({ txn, modeledElementId: planProjectionPartition.id, isPlanProjection: true });
        insertGeometricModelWithPartition({ txn, codeValue: "private", isPrivate: true });
        insertGeometricModelWithPartition({ txn, codeValue: "template", isTemplate: true });
        const model2d = insertDrawingModelWithPartition({ txn, codeValue: "model2d" });
        const spatialCategory = insertSpatialCategory({ txn, codeValue: "spatial category" });
        const drawingCategory = insertDrawingCategory({ txn, codeValue: "drawing category" });
        return { model3d, planProjectionModel, model2d, spatialCategory, drawingCategory };
      }),
    );
    const { imodelConnection, ...keys } = buildIModelResult;

    const provider3d = createProvider(imodelConnection, "3d");
    const models3d = await firstValueFrom(provider3d.getAllModels());
    expect(models3d).toHaveLength(2);
    expect(models3d).toEqual(
      expect.arrayContaining([
        { id: keys.model3d.id, isPlanProjection: false },
        { id: keys.planProjectionModel.id, isPlanProjection: true },
      ]),
    );
    expect([...(await firstValueFrom(provider3d.getAllCategories()))]).toEqual([keys.spatialCategory.id]);

    const provider2d = createProvider(imodelConnection, "2d");
    expect(await firstValueFrom(provider2d.getAllModels())).toEqual([{ id: keys.model2d.id, isPlanProjection: false }]);
    expect([...(await firstValueFrom(provider2d.getAllCategories()))]).toEqual([keys.drawingCategory.id]);
  });
});
