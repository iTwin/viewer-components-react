import { expect } from "chai";
import { firstValueFrom, from } from "rxjs";
import sinon from "sinon";
import { createCachingQueryProvider } from "../../../../components/trees/models-tree/internal/CachingQueryProvider";

import type { Observable } from "rxjs";
import type { IQueryProvider } from "../../../../components/trees/models-tree/internal/QueryProvider";

type SourceQueryProviderMock = { [key in keyof IQueryProvider]?: () => Observable<any> };

describe("CachingQueryProvider", () => {
  it("caches all subjects result", async () => {
    const subject = { id: "0x1" };
    const fakeFunction = sinon.fake.resolves(subject);
    const source: SourceQueryProviderMock = {
      queryAllSubjects: () => from(fakeFunction()),
    };
    const cachedProvider = createCachingQueryProvider(source as unknown as IQueryProvider);
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
    const cachedProvider = createCachingQueryProvider(source as unknown as IQueryProvider);
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
    const cachedProvider = createCachingQueryProvider(source as unknown as IQueryProvider);
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
    const cachedProvider = createCachingQueryProvider(source as unknown as IQueryProvider);
    let result = await firstValueFrom(cachedProvider.queryCategoryElements("0x1", "0x2"));
    expect(result).to.deep.eq(items);
    expect(fakeFunction).to.be.calledOnce;

    result = await firstValueFrom(cachedProvider.queryCategoryElements("0x1", "0x2"));
    expect(result).to.deep.eq(items);
    expect(fakeFunction).to.be.calledOnce;
  });

  it("caches element children result", async () => {
    const items = ["0x1", "0x2"];
    const fakeFunction = sinon.fake.resolves(items);
    const source: SourceQueryProviderMock = {
      queryElementChildren: () => from(fakeFunction()),
    };
    const cachedProvider = createCachingQueryProvider(source as unknown as IQueryProvider);
    let result = await firstValueFrom(cachedProvider.queryElementChildren("0x1"));
    expect(result).to.deep.eq(items);
    expect(fakeFunction).to.be.calledOnce;

    result = await firstValueFrom(cachedProvider.queryElementChildren("0x1"));
    expect(result).to.deep.eq(items);
    expect(fakeFunction).to.be.calledOnce;
  });
});