/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { firstValueFrom } from "rxjs/internal/firstValueFrom";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { ModelCategoryElementsCountCache } from "../../../../tree-widget-react/components/trees/common/internal/caches/ModelCategoryElementsCountCache.js";
import { CLASS_NAME_GeometricElement3d } from "../../../../tree-widget-react/components/trees/common/internal/ClassNameDefinitions.js";
import { createFakeSinonViewport } from "../../Common.js";

describe("ModelCategoryElementsCountCache", () => {
  function createCache(viewport: ReturnType<typeof createFakeSinonViewport>) {
    return new ModelCategoryElementsCountCache({
      queryExecutor: createECSqlQueryExecutor(viewport.iModel),
      componentId: "test",
      elementClassName: CLASS_NAME_GeometricElement3d,
    });
  }
  const defaultQueryHandler = (query: string) => {
    const [modelId, rest] = query.split("Model.Id = ")[1].split(" AND Category.Id IN (");
    const categoryIds = rest.split(")")[0].split(", ");
    return categoryIds.map((categoryId) => ({ modelId, categoryId, elementsCount: 2 }));
  };

  it("returns 0 when query returns empty", async () => {
    using vp = createFakeSinonViewport();
    const cache = createCache(vp);

    const result = await firstValueFrom(cache.getCategoryElementsCount({ modelId: "0x1", categoryId: "0x2" }));
    expect(result).to.eq(0);
    expect(vp.iModel.createQueryReader).to.be.calledOnce;
  });

  it("returns query value", async () => {
    using vp = createFakeSinonViewport({ queryHandler: defaultQueryHandler });
    const cache = createCache(vp);

    const result = await firstValueFrom(cache.getCategoryElementsCount({ modelId: "0x1", categoryId: "0x2" }));
    expect(result).to.eq(2);
    expect(vp.iModel.createQueryReader).to.be.calledOnce;
  });

  it("returns query and empty value", async () => {
    using vp = createFakeSinonViewport({ queryHandler: () => [{ modelId: "0x1", categoryId: "0x2", elementsCount: 3 }] });
    const cache = createCache(vp);

    const promise1 = firstValueFrom(cache.getCategoryElementsCount({ modelId: "0x1", categoryId: "0x2" }));
    const promise2 = firstValueFrom(cache.getCategoryElementsCount({ modelId: "0x1", categoryId: "0x3" }));
    const [result1, result2] = await Promise.all([promise1, promise2]);
    expect(result1).to.eq(3);
    expect(result2).to.eq(0);
    expect(vp.iModel.createQueryReader).to.be.calledOnce;
  });

  it("batches multiple requests", async () => {
    using vp = createFakeSinonViewport({ queryHandler: defaultQueryHandler });
    const cache = createCache(vp);

    const promise1 = firstValueFrom(cache.getCategoryElementsCount({ modelId: "0x1", categoryId: "0x2" }));
    const promise2 = firstValueFrom(cache.getCategoryElementsCount({ modelId: "0x1", categoryId: "0x3" }));
    const [result1, result2] = await Promise.all([promise1, promise2]);
    expect(result1).to.eq(2);
    expect(result2).to.eq(2);
    expect(vp.iModel.createQueryReader).to.be.calledOnce;
  });

  it("batches requests which are less than 20 ms apart", async () => {
    using vp = createFakeSinonViewport({ queryHandler: defaultQueryHandler });
    const cache = createCache(vp);

    const promise1 = firstValueFrom(cache.getCategoryElementsCount({ modelId: "0x1", categoryId: "0x2" }));
    await new Promise((resolve) => setTimeout(resolve, 19));
    const promise2 = firstValueFrom(cache.getCategoryElementsCount({ modelId: "0x1", categoryId: "0x3" }));
    const [result1, result2] = await Promise.all([promise1, promise2]);
    expect(result1).to.eq(2);
    expect(result2).to.eq(2);
    expect(vp.iModel.createQueryReader).to.be.calledOnce;
  });

  it("does not batch requests which are more than 20 ms apart", async () => {
    using vp = createFakeSinonViewport({ queryHandler: defaultQueryHandler });
    const cache = createCache(vp);

    const promise1 = firstValueFrom(cache.getCategoryElementsCount({ modelId: "0x1", categoryId: "0x2" }));
    await new Promise((resolve) => setTimeout(resolve, 21));
    const promise2 = firstValueFrom(cache.getCategoryElementsCount({ modelId: "0x1", categoryId: "0x3" }));
    const [result1, result2] = await Promise.all([promise1, promise2]);
    expect(result1).to.eq(2);
    expect(result2).to.eq(2);
    expect(vp.iModel.createQueryReader).to.be.calledTwice;
  });

  it("caches empty values", async () => {
    using vp = createFakeSinonViewport();
    const cache = createCache(vp);

    const result1 = await firstValueFrom(cache.getCategoryElementsCount({ modelId: "0x1", categoryId: "0x2" }));
    const result2 = await firstValueFrom(cache.getCategoryElementsCount({ modelId: "0x1", categoryId: "0x2" }));
    expect(result1).to.eq(0);
    expect(result2).to.eq(0);
    expect(vp.iModel.createQueryReader).to.be.calledOnce;
  });

  it("caches values returned by query", async () => {
    using vp = createFakeSinonViewport({ queryHandler: defaultQueryHandler });
    const cache = createCache(vp);

    const result1 = await firstValueFrom(cache.getCategoryElementsCount({ modelId: "0x1", categoryId: "0x2" }));
    const result2 = await firstValueFrom(cache.getCategoryElementsCount({ modelId: "0x1", categoryId: "0x2" }));
    expect(result1).to.eq(2);
    expect(result2).to.eq(2);
    expect(vp.iModel.createQueryReader).to.be.calledOnce;
  });

  it("executes separate queries if 100 models are requested", async () => {
    using vp = createFakeSinonViewport({ queryHandler: defaultQueryHandler });
    const cache = createCache(vp);
    const promises = new Array<Promise<number>>();
    for (let i = 1; i <= 100; ++i) {
      promises.push(firstValueFrom(cache.getCategoryElementsCount({ modelId: `0x${i}`, categoryId: "0x1000" })));
    }
    await Promise.all(promises);
    expect(vp.iModel.createQueryReader).to.be.calledOnce;
  });

  it("executes multiple queries if > 100 models are requested", async () => {
    using vp = createFakeSinonViewport({ queryHandler: defaultQueryHandler });
    const cache = createCache(vp);
    const promises = new Array<Promise<number>>();
    for (let i = 1; i <= 101; ++i) {
      promises.push(firstValueFrom(cache.getCategoryElementsCount({ modelId: `0x${i}`, categoryId: "0x1000" })));
    }
    await Promise.all(promises);
    expect(vp.iModel.createQueryReader).to.be.calledTwice;
  });
});
