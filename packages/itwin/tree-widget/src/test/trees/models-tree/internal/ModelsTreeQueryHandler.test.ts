/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { firstValueFrom, toArray } from "rxjs";
import sinon from "sinon";
import { createModelsTreeQueryHandler } from "../../../../components/trees/models-tree/internal/ModelsTreeQueryHandler";

import type { Observable } from "rxjs";
import type { ECSqlReader } from "@itwin/core-common";
import type { IModelConnection } from "@itwin/core-frontend";

describe("QueryHandler", () => {
  function createIModelMock(queryMock: (query: string) => any[]) {
    return {
      createQueryReader: sinon.fake(async function* (query: string): AsyncIterableIterator<any> {
        const result = queryMock(query);
        for (const item of result) {
          yield item;
        }
      } as () => unknown as () => ECSqlReader),
    } as unknown as IModelConnection;
  }

  it("queries all subjects, subject models and model categories once, and runs query again when `invalidateCache` is called", async () => {
    const parentSubject = "0x1";
    const childSubject = "0x2";
    const models = new Map([
      [parentSubject, ["0x10", "0x20"]],
      [childSubject, ["0x30", "0x40"]],
    ]);
    const modelCategories = new Map([
      ["0x10", ["0x100", "0x200"]],
      ["0x20", ["0x300", "0x400"]],
      ["0x30", ["0x500", "0x600"]],
      ["0x40", ["0x700", "0x800"]],
    ]);

    const subjectsQueryRegex = /FROM bis\.Subject/;
    const modelsQueryRegex = /FROM bis\.InformationPartitionElement/;
    const modelCategoriesQueryRegex = /FROM bis\.GeometricElement3d/;

    const stub = sinon.fake((query: string) => {
      if (subjectsQueryRegex.test(query)) {
        return [{ id: parentSubject }, { id: childSubject, parentId: parentSubject }];
      }
      if (modelsQueryRegex.test(query)) {
        return [...models.entries()].flatMap(([subjectId, modelIds]) => modelIds.map((id) => ({ id, parentId: subjectId })));
      }
      if (modelCategoriesQueryRegex.test(query)) {
        return [...modelCategories.entries()].flatMap(([modelId, categories]) => categories.map((categoryId) => ({ modelId, categoryId })));
      }
      throw new Error(`Unexpected query: ${query}`);
    });

    const handler = createModelsTreeQueryHandler(createIModelMock(stub));

    async function runTest() {
      let result = await collect(handler.querySubjectModels("0x1"));
      expect(stub).to.be.calledThrice;
      expect(stub).to.be.calledWithMatch(subjectsQueryRegex);
      expect(stub).to.be.calledWithMatch(modelsQueryRegex);
      expect(stub).to.be.calledWithMatch(modelCategoriesQueryRegex);
      const allModels = [...modelCategories.keys()];
      expect(result).to.deep.eq(allModels);

      result = await collect(handler.querySubjectModels("0x1"));
      expect(stub).to.be.calledThrice;
      expect(result).to.deep.eq(allModels);

      result = await collect(handler.querySubjectModels("0x2"));
      expect(stub).to.be.calledThrice;
      expect(result).to.deep.eq(models.get("0x2"));

      result = await collect(handler.queryModelCategories("0x10"));
      expect(stub).to.be.calledThrice;
      expect(result).to.deep.eq(modelCategories.get("0x10"));

      result = await collect(handler.queryModelCategories("0x40"));
      expect(stub).to.be.calledThrice;
      expect(result).to.deep.eq(modelCategories.get("0x40"));
    }

    await runTest();
    stub.resetHistory();
    handler.invalidateCache();
    await runTest();
  });

  it("doesn't query element children if previous query returned no results", async () => {
    const elementId = "0x10";
    const stub = sinon.fake.returns([]);

    const handler = createModelsTreeQueryHandler(createIModelMock(stub));
    let result = await collect(handler.queryElementChildren(elementId));
    expect(stub).to.be.calledOnce;
    expect(result).to.be.empty;

    result = await collect(handler.queryElementChildren(elementId));
    expect(stub).to.be.calledOnce;
    expect(result).to.be.empty;
  });

  it("builds element children cache from responses in random order", async () => {
    const stub = sinon.fake(() => {
      return [
        { id: "0x20", parentId: "0x10" },
        { id: "0x30", parentId: "0x20" },
        { id: "0x40", parentId: "0x30" },
        { id: "0x50", parentId: "0x10" },
        { id: "0x10" },
      ];
    });

    const handler = createModelsTreeQueryHandler(createIModelMock(stub));
    let result = await collect(handler.queryElementChildren("0x1"));
    const allChildren = ["0x10", "0x20", "0x30", "0x40", "0x50"];
    expect(result.sort()).to.deep.eq(allChildren);

    result = await collect(handler.queryElementChildren("0x10"));
    expect(result.sort()).to.deep.eq(allChildren.filter((x) => x !== "0x10"));
  });
});

async function collect<T>(obs: Observable<T>): Promise<T[]> {
  return firstValueFrom(obs.pipe(toArray()));
}
