import { expect } from "chai";
import { firstValueFrom, from } from "rxjs";
import sinon from "sinon";
import { createCachingQueryHandler } from "../../../../components/trees/models-tree/internal/CachingQueryHandler";

import type { Observable } from "rxjs";
import type { IQueryHandler } from "../../../../components/trees/models-tree/internal/QueryHandler";

type SourceQueryProviderMock = { [key in keyof IQueryHandler]?: () => Observable<any> };

describe("CachingQueryProvider", () => {
  it("caches all subjects result", async () => {
    const subject = { id: "0x1" };
    const fakeFunction = sinon.fake.resolves(subject);
    const source: SourceQueryProviderMock = {
      queryAllSubjects: () => from(fakeFunction()),
    };
    const cachedProvider = createCachingQueryHandler(source as unknown as IQueryHandler);
    let result = await firstValueFrom(cachedProvider.queryAllSubjects());
    expect(result).to.deep.eq(subject);
    expect(fakeFunction).to.be.calledOnce;

    result = await firstValueFrom(cachedProvider.queryAllSubjects());
    expect(result).to.deep.eq(subject);
    expect(fakeFunction).to.be.calledOnce;
  });

  it("caches all models result", async () => {
    const model = { id: "0x1" };
    const fakeFunction = sinon.fake.resolves(model);
    const source: SourceQueryProviderMock = {
      queryAllModels: () => from(fakeFunction()),
    };
    const cachedProvider = createCachingQueryHandler(source as unknown as IQueryHandler);
    let result = await firstValueFrom(cachedProvider.queryAllModels());
    expect(result).to.deep.eq(model);
    expect(fakeFunction).to.be.calledOnce;

    result = await firstValueFrom(cachedProvider.queryAllModels());
    expect(result).to.deep.eq(model);
    expect(fakeFunction).to.be.calledOnce;
  });

  it("caches model categories result", async () => {
    const items = ["0x1", "0x2"];
    const fakeFunction = sinon.fake.resolves(items);
    const source: SourceQueryProviderMock = {
      queryModelCategories: () => from(fakeFunction()),
    };
    const cachedProvider = createCachingQueryHandler(source as unknown as IQueryHandler);
    let result = await firstValueFrom(cachedProvider.queryModelCategories("0x1"));
    expect(result).to.deep.eq(items);
    expect(fakeFunction).to.be.calledOnce;

    result = await firstValueFrom(cachedProvider.queryModelCategories("0x1"));
    expect(result).to.deep.eq(items);
    expect(fakeFunction).to.be.calledOnce;
  });

  it("caches category elements result", async () => {
    const items = ["0x1", "0x2"];
    const fakeFunction = sinon.fake.resolves(items);
    const source: SourceQueryProviderMock = {
      queryCategoryElements: () => from(fakeFunction()),
    };
    const cachedProvider = createCachingQueryHandler(source as unknown as IQueryHandler);
    let result = await firstValueFrom(cachedProvider.queryCategoryElements("0x1", "0x2"));
    expect(result).to.deep.eq(items);
    expect(fakeFunction).to.be.calledOnce;

    result = await firstValueFrom(cachedProvider.queryCategoryElements("0x1", "0x2"));
    expect(result).to.deep.eq(items);
    expect(fakeFunction).to.be.calledOnce;
  });
});
