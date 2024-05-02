/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { firstValueFrom, toArray } from "rxjs";
import sinon from "sinon";
import { createQueryHandler } from "../../../../components/trees/models-tree/internal/QueryHandler";

import type { Observable } from "rxjs";
import type { ECSqlReader, QueryBinder } from "@itwin/core-common";
import type { IModelConnection } from "@itwin/core-frontend";

describe("QueryHandler", () => {
  function createIModelMock(queryMock: (query: string, binder: QueryBinder) => any[] | undefined) {
    return {
      createQueryReader: sinon.fake(async function* (query: string, binder: QueryBinder): AsyncIterableIterator<any> {
        const result = queryMock(query, binder);
        if (!result) {
          return undefined;
        }
        for (const item of result) {
          yield item;
        }
      } as () => unknown as () => ECSqlReader),
    } as unknown as IModelConnection;
  }

  it("can invalidate cache", async () => {
    const modelId = "0x1";
    const items = ["0x10", "0x20"];
    const stub = sinon.fake.returns(items.map((id) => ({ id })));
    const handler = createQueryHandler(createIModelMock(stub), "");
    let result = await collect(handler.queryModelCategories(modelId));
    expect(result).to.deep.eq(items);
    expect(stub).to.be.calledOnce;

    handler.invalidateCache();
    result = await collect(handler.queryModelCategories(modelId));
    expect(result).to.deep.eq(items);
    expect(stub).to.be.calledTwice;
  });

  it("queries all subjects and their models once", async () => {
    const parentSubject = "0x1";
    const childSubject = "0x2";
    const models = new Map([
      [parentSubject, ["0x10", "0x20"]],
      [childSubject, ["0x30", "0x40"]],
    ]);

    const subjectsQueryRegex = /FROM bis\.Subject/g;
    const modelsQueryRegex = /FROM bis\.InformationPartitionElement/g;

    const stub = sinon
      .stub<[string], any[] | undefined>()
      .withArgs(sinon.match(subjectsQueryRegex))
      .returns([{ id: parentSubject }, { id: childSubject, parentId: parentSubject }])
      .withArgs(sinon.match(modelsQueryRegex))
      .returns([...models.entries()].map(([subjectId, modelIds]) => modelIds.map((id) => ({ id, parentId: subjectId }))).flat());

    const handler = createQueryHandler(createIModelMock(stub), "");
    let result = await collect(handler.querySubjectModels("0x1"));
    expect(result).to.deep.eq(models.get("0x1"));
    expect(stub).to.be.calledTwice;
    expect(stub).to.be.calledWithMatch(subjectsQueryRegex);
    expect(stub).to.be.calledWithMatch(modelsQueryRegex);

    result = await collect(handler.querySubjectModels("0x1"));
    expect(result).to.deep.eq(models.get("0x1"));
    expect(stub).to.be.calledTwice;

    result = await collect(handler.querySubjectModels("0x2"));
    expect(result).to.deep.eq(models.get("0x2"));
    expect(stub).to.be.calledTwice;
  });

  it("caches model categories", async () => {
    const modelId = "0x1";
    const items = ["0x10", "0x20"];
    const stub = sinon.fake.returns(items.map((id) => ({ id })));
    const handler = createQueryHandler(createIModelMock(stub), "");
    let result = await collect(handler.queryModelCategories(modelId));
    expect(result).to.deep.eq(items);
    expect(stub).to.be.calledOnce;

    result = await collect(handler.queryModelCategories(modelId));
    expect(result).to.deep.eq(items);
    expect(stub).to.be.calledOnce;
  });

  it("caches model elements", async () => {
    const modelId = "0x1";
    const stub = sinon.fake((query: string) => {
      if (query.includes("FROM bis.SpatialCategory")) {
        return [{ id: "0x10" }];
      }
      if (query.includes("JOIN ChildCategoryElements")) {
        return [{ id: "0x100" }, { id: "0x200" }];
      }
      return undefined;
    });
    const handler = createQueryHandler(createIModelMock(stub), "");
    let result = await collect(handler.queryModelElements(modelId));

    const elements = ["0x100", "0x200"];
    expect(result).to.deep.eq(elements);
    expect(stub).to.be.calledTwice;

    result = await collect(handler.queryModelElements(modelId));
    expect(result).to.deep.eq(elements);
    expect(stub).to.be.calledTwice;
  });

  it("uses model elements cache for getting elements count", async () => {
    const modelId = "0x1";
    const stub = sinon.fake((query: string) => {
      if (query.includes("FROM bis.SpatialCategory")) {
        return [{ id: "0x10" }];
      }
      if (query.includes("JOIN ChildCategoryElements")) {
        return [{ id: "0x100" }, { id: "0x200" }];
      }
      return undefined;
    });
    const handler = createQueryHandler(createIModelMock(stub), "");
    const result = await collect(handler.queryModelElements(modelId));

    const elements = ["0x100", "0x200"];
    expect(result).to.deep.eq(elements);
    expect(stub).to.be.calledTwice;

    const count = await firstValueFrom(handler.queryModelElementsCount(modelId));
    expect(count).to.deep.eq(elements.length);
    expect(stub).to.be.calledTwice;
  });

  it("caches category recursive elements", async () => {
    const modelId = "0x1";
    const categoryId = "0x2";
    const categoryElementsHierarchy = new Map([
      ["0x10", ["0x100", "0x200"]],
      ["0x100", ["0x300", "0x400"]],
    ]);
    const elementIdSet = new Set<string>();
    const rows = new Array<any>();
    categoryElementsHierarchy.forEach((children, parentId) => {
      for (const child of children) {
        elementIdSet.add(child);
        rows.push({ id: child, parentId });
      }

      if (!elementIdSet.has(parentId)) {
        rows.push({ id: parentId });
        elementIdSet.add(parentId);
      }
    });
    const stub = sinon.fake.returns(rows);

    const handler = createQueryHandler(createIModelMock(stub), "");
    let result = await collect(handler.queryCategoryElements(categoryId, modelId));
    const expectedElements = [...elementIdSet].sort();
    expect(result.sort()).to.deep.eq(expectedElements);
    expect(stub).to.be.calledOnce;

    result = await collect(handler.queryCategoryElements(categoryId, modelId));
    expect(result.sort()).to.deep.eq(expectedElements);
    expect(stub).to.be.calledOnce;
  });

  it("reuses category recursive elements query result for element children query", async () => {
    const modelId = "0x1";
    const categoryId = "0x2";
    const categoryElementsHierarchy = new Map([
      ["0x10", ["0x100", "0x200"]],
      ["0x100", ["0x300", "0x400"]],
    ]);
    const elementIdSet = new Set<string>();
    const rows = new Array<any>();
    categoryElementsHierarchy.forEach((children, parentId) => {
      for (const child of children) {
        elementIdSet.add(child);
        rows.push({ id: child, parentId });
      }

      if (!elementIdSet.has(parentId)) {
        rows.push({ id: parentId });
        elementIdSet.add(parentId);
      }
    });
    const stub = sinon.fake.returns(rows);

    const handler = createQueryHandler(createIModelMock(stub), "");
    let result = await collect(handler.queryCategoryElements(categoryId, modelId));
    const allElements = [...elementIdSet].sort();
    expect(result.sort()).to.deep.eq(allElements);
    expect(stub).to.be.calledOnce;

    let elementId = "0x100";
    result = await collect(handler.queryElementChildren(elementId));
    expect(stub).to.be.calledOnce;
    expect(result.sort()).to.deep.eq(categoryElementsHierarchy.get("0x100")!);

    elementId = "0x10";
    result = await collect(handler.queryElementChildren(elementId));
    expect(stub).to.be.calledOnce;
    expect(result.sort()).to.deep.eq(allElements.filter((x) => x !== elementId));

    elementId = "0x400";
    result = await collect(handler.queryElementChildren(elementId));
    expect(stub).to.be.calledOnce;
    expect(result).to.be.empty;
  });

  it("doesn't query element children if previous query returned no results", async () => {
    const elementId = "0x10";
    const stub = sinon.fake.returns([]);

    const handler = createQueryHandler(createIModelMock(stub), "");
    let result = await collect(handler.queryElementChildren(elementId));
    expect(stub).to.be.calledOnce;
    expect(result).to.be.empty;

    result = await collect(handler.queryElementChildren(elementId));
    expect(stub).to.be.calledOnce;
    expect(result).to.be.empty;
  });
});

async function collect<T>(obs: Observable<T>): Promise<T[]> {
  return firstValueFrom(obs.pipe(toArray()));
}
