/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { firstValueFrom, toArray } from "rxjs";
import sinon from "sinon";
import { createModelsTreeQueryHandler } from "../../../../components/trees/stateless/models-tree/internal/ModelsTreeQueryHandler";

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
    await runTest();
  });

  it("reruns query when `invalidateCache` is called", async () => {
    const parentSubject = "0x1";
    const childSubject = "0x2";
    const models = new Map([
      [parentSubject, ["0x10", "0x20"]],
      [childSubject, ["0x30", "0x40"]],
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
        return [];
      }
      throw new Error(`Unexpected query: ${query}`);
    });

    const handler = createModelsTreeQueryHandler(createIModelMock(stub));

    let result = await collect(handler.querySubjectModels("0x1"));
    const allModels = [...models.values()].flat();
    expect(stub).to.be.calledThrice;
    expect(result).to.deep.eq(allModels);
    result = await collect(handler.querySubjectModels("0x1"));
    expect(stub).to.be.calledThrice;
    expect(result).to.deep.eq(allModels);

    handler.invalidateCache();

    result = await collect(handler.querySubjectModels("0x1"));
    expect(stub).to.have.callCount(6);
    expect(result).to.deep.eq(allModels);
  });

  it("caches model and category element count", async () => {
    const elementIds = ["0x10", "0x20", "0x30"];
    const stub = sinon.fake((query: string) => {
      if (/Elements\(id\)/.test(query)) {
        return [[elementIds.length]];
      }
      throw new Error(`Unexpected query: ${query}`);
    });
    const handler = createModelsTreeQueryHandler(createIModelMock(stub));
    await expect(firstValueFrom(handler.queryElementsCount({ modelId: "0x1" }))).to.eventually.deep.eq(elementIds.length);
    expect(stub).to.be.calledOnce;
    await expect(firstValueFrom(handler.queryElementsCount({ modelId: "0x1" }))).to.eventually.deep.eq(elementIds.length);
    expect(stub).to.be.calledOnce;

    await expect(firstValueFrom(handler.queryElementsCount({ modelId: "0x1", categoryId: "0x2" }))).to.eventually.deep.eq(elementIds.length);
    expect(stub).to.be.calledTwice;
    await expect(firstValueFrom(handler.queryElementsCount({ modelId: "0x1", categoryId: "0x2" }))).to.eventually.deep.eq(elementIds.length);
    expect(stub).to.be.calledTwice;
  });

  it("doesn't cache element children count", async () => {
    const elementIds = ["0x10", "0x20", "0x30"];
    const stub = sinon.fake((query: string) => {
      if (/Elements\(id\)/.test(query)) {
        return [[elementIds.length]];
      }
      throw new Error(`Unexpected query: ${query}`);
    });
    const handler = createModelsTreeQueryHandler(createIModelMock(stub));
    await expect(firstValueFrom(handler.queryElementsCount({ rootElementId: "0x1" }))).to.eventually.deep.eq(elementIds.length);
    expect(stub).to.be.calledOnce;

    await expect(firstValueFrom(handler.queryElementsCount({ rootElementId: "0x1" }))).to.eventually.deep.eq(elementIds.length);
    expect(stub).to.be.calledTwice;
  });

  it("uses InVirtualSet when 1000 or more ids passed", async () => {
    const elementIds = [...Array(1001).keys()].map((i) => `0x${i}`);
    const stub = sinon.fake.returns([]);
    const handler = createModelsTreeQueryHandler(createIModelMock(stub));
    await firstValueFrom(handler.queryElementInfo(new Set(elementIds)).pipe(toArray()));

    expect(stub).to.be.calledOnceWith(sinon.match(/InVirtualSet/));
  });
});

async function collect<T>(obs: Observable<T>): Promise<T[]> {
  return firstValueFrom(obs.pipe(toArray()));
}
