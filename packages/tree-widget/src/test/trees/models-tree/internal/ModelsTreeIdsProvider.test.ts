/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { firstValueFrom } from "rxjs";
import { initializeCore, insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory, insertSubject, terminateCore } from "test-utilities";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withEditTxn } from "@itwin/core-backend";
import { IModel } from "@itwin/core-common";
import { buildIModel } from "../../../IModelUtils.js";
import { createAccessAndIdsProvider } from "../Utils.js";

describe("ModelsTreeIdsProvider", () => {
  beforeAll(async () => {
    await initializeCore();
  });

  afterAll(async () => {
    await terminateCore();
  });

  describe("getSubjectModelIds", () => {
    it("returns models of the given subjects and all their descendant subjects, including hidden ones", async () => {
      await using buildIModelResult = await buildIModel(async (imodel) =>
        withEditTxn(imodel, (txn) => {
          const category = insertSpatialCategory({ txn, codeValue: "category" });
          const parentSubject = insertSubject({ txn, codeValue: "parent subject", parentId: IModel.rootSubjectId });
          const hiddenSubject = insertSubject({
            txn,
            codeValue: "hidden subject",
            parentId: parentSubject.id,
            jsonProperties: { Subject: { Model: { Type: "Hierarchy" } } },
          });
          const childSubject = insertSubject({ txn, codeValue: "child subject", parentId: hiddenSubject.id });
          const grandChildSubject = insertSubject({ txn, codeValue: "grand child subject", parentId: childSubject.id });
          const otherSubject = insertSubject({ txn, codeValue: "other subject", parentId: IModel.rootSubjectId });
          const [parentSubjectModel, hiddenSubjectModel, childSubjectModel, grandChildSubjectModel] = [
            parentSubject,
            hiddenSubject,
            childSubject,
            grandChildSubject,
            otherSubject,
          ].map((subject, index) => {
            const model = insertPhysicalModelWithPartition({ txn, codeValue: `model ${index}`, partitionParentId: subject.id });
            insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id });
            return model;
          });
          return { parentSubject, childSubject, parentSubjectModel, hiddenSubjectModel, childSubjectModel, grandChildSubjectModel };
        }),
      );
      const { imodelConnection, ...keys } = buildIModelResult;
      const { idsProvider } = createAccessAndIdsProvider({ imodelConnection });

      expect(new Set(await firstValueFrom(idsProvider.getSubjectModelIds(keys.parentSubject.id)))).toEqual(
        new Set([keys.parentSubjectModel.id, keys.hiddenSubjectModel.id, keys.childSubjectModel.id, keys.grandChildSubjectModel.id]),
      );
      expect(new Set(await firstValueFrom(idsProvider.getSubjectModelIds(keys.childSubject.id)))).toEqual(
        new Set([keys.childSubjectModel.id, keys.grandChildSubjectModel.id]),
      );
    });

    it("returns empty list for unknown subject", async () => {
      await using buildIModelResult = await buildIModel(async () => ({}));
      const { idsProvider } = createAccessAndIdsProvider({ imodelConnection: buildIModelResult.imodelConnection });
      expect(await firstValueFrom(idsProvider.getSubjectModelIds("0x123"))).toEqual([]);
    });
  });
});
