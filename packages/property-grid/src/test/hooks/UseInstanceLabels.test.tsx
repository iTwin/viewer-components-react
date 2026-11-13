/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  buildIModel,
  importSchema,
  initializeCore,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertPhysicalPartition,
  insertPhysicalSubModel,
  insertSpatialCategory,
  insertSubject,
  terminateCore,
} from "test-utilities";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { withEditTxn } from "@itwin/core-backend";
import { BisCodeSpec, Code, IModel, IModelReadRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { PresentationLabelsProvider } from "@itwin/presentation-components";
import * as interop from "@itwin/presentation-core-interop";
import * as shared from "@itwin/presentation-shared";
import { useInstanceLabels } from "../../property-grid-react/hooks/UseInstanceLabels.js";
import { TelemetryContextProvider } from "../../property-grid-react/hooks/UseTelemetryContext.js";
import { act, createResolvablePromise, renderHook, waitFor } from "../TestUtils.js";

import type { PropsWithChildren } from "react";
import type { IModelConnection } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";

vi.mock("@itwin/presentation-core-interop", async (importOriginal) => {
  const actual = await importOriginal<typeof interop>();
  return { ...actual, createECSqlQueryExecutor: vi.fn(actual.createECSqlQueryExecutor) };
});
vi.mock("@itwin/presentation-shared", async (importOriginal) => {
  const actual = await importOriginal<typeof shared>();
  return { ...actual, createBisInstanceLabelSelectClauseFactory: vi.fn(actual.createBisInstanceLabelSelectClauseFactory) };
});

describe("useInstanceLabels", () => {
  let imodel: IModelConnection;

  beforeAll(async () => {
    await initializeCore({ rpcs: [IModelReadRpcInterface, PresentationRpcInterface, ECSchemaRpcInterface] });
    // eslint-disable-next-line @itwin/no-internal
    ECSchemaRpcImpl.register();
  });
  afterEach(async () => {
    vi.mocked(interop.createECSqlQueryExecutor).mockReset();
    vi.mocked(shared.createBisInstanceLabelSelectClauseFactory).mockReset();
    await imodel.close();
  });
  afterAll(async () => terminateCore());

  it("matches presentation labels for elements, models and bracketed codes", async () => {
    const built = await buildIModel("use-instance-labels-kinds", async (db) =>
      withEditTxn(db, (txn) => {
        const model = insertPhysicalModelWithPartition({ txn, codeValue: "model" });
        const category = insertSpatialCategory({ txn, codeValue: "category" });
        const code = new Code({ spec: db.codeSpecs.getByName(BisCodeSpec.nullCodeSpec).id, scope: model.id, value: "code" });
        const partition = insertPhysicalPartition({ txn, codeValue: "partition", parentId: IModel.rootSubjectId, userLabel: "partition-label" });
        return {
          keys: [
            insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id, code, userLabel: "ignored" }),
            insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id, userLabel: "user-label" }),
            insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id }),
            insertSubject({ txn, codeValue: "[code]" }),
            partition,
            insertPhysicalSubModel({ txn, modeledElementId: partition.id }),
          ],
        };
      }),
    );
    imodel = built.imodelConnection;
    const keys = built.keys;
    const { result } = renderHook(useInstanceLabels, { initialProps: { imodel, instanceKeys: keys }, disableStrictMode: true });
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.rows.filter(Boolean)).toHaveLength(keys.length));
    const expected = await new PresentationLabelsProvider({ imodel }).getLabels(keys.map((key) => ({ ...key, className: key.className.replace(".", ":") })));
    for (const [index, key] of keys.entries()) {
      expect(result.current.rows.find((row) => row?.instanceKey === key)?.label).toBe(expected[index]);
    }
  });

  it("omits missing keys, stops on a short page and does not query an empty selection", async () => {
    const built = await buildIModel("use-instance-labels-missing", async (db) =>
      withEditTxn(db, (txn) => ({ key: insertSubject({ txn, codeValue: "subject" }) })),
    );
    imodel = built.imodelConnection;
    const missing = { className: "BisCore.Subject", id: "0xffff" };
    const reader = vi.spyOn(imodel, "createQueryReader");
    const { result, rerender } = renderHook(useInstanceLabels, {
      initialProps: { imodel, instanceKeys: [missing, built.key, missing] },
      disableStrictMode: true,
    });
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.rows).toEqual([{ instanceKey: built.key, label: "subject" }]));
    act(() => result.current.loadMore());
    expect(reader).toHaveBeenCalledOnce();
    rerender({ imodel, instanceKeys: [] });
    act(() => result.current.loadMore());
    expect(reader).toHaveBeenCalledOnce();
  });

  it("queries more than 500 classes with global paging", async () => {
    const classCount = 501;
    const built = await buildIModel("use-instance-labels-many-classes", async (db) => {
      await importSchema({
        imodel: db,
        schemaName: "Paging",
        schemaAlias: "paging",
        schemaContentXml: `<ECSchemaReference name="BisCore" version="01.00.16" alias="bis" />${Array.from(
          { length: classCount },
          (_, index) => `<ECEntityClass typeName="Class${index}"><BaseClass>bis:PhysicalElement</BaseClass></ECEntityClass>`,
        ).join("")}`,
      });
      return withEditTxn(db, (txn) => {
        const model = insertPhysicalModelWithPartition({ txn, codeValue: "model" });
        const category = insertSpatialCategory({ txn, codeValue: "category" });
        return {
          keys: Array.from({ length: classCount }, (_, index) =>
            insertPhysicalElement({
              txn,
              modelId: model.id,
              categoryId: category.id,
              classFullName: `Paging.Class${index}`,
              userLabel: String(classCount - index).padStart(4, "0"),
            }),
          ),
        };
      });
    });
    imodel = built.imodelConnection;
    const { result } = renderHook(useInstanceLabels, { initialProps: { imodel, instanceKeys: built.keys }, disableStrictMode: true });
    for (let page = 1; page <= 6; ++page) {
      act(() => result.current.loadMore());
      await waitFor(() => expect(result.current.rows.filter(Boolean)).toHaveLength(Math.min(page * 100, classCount)));
    }
    expect(result.current.rows.map((row) => row?.instanceKey)).toEqual(built.keys.toReversed());
  });

  it("loads real labels in sorted pages and matches presentation labels", async () => {
    const built = await buildIModel("use-instance-labels-real", async (db) =>
      withEditTxn(db, (txn) => ({
        keys: Array.from({ length: 105 }, (_, index) => insertSubject({ txn, codeValue: `subject-${String(104 - index).padStart(3, "0")}` })),
      })),
    );
    imodel = built.imodelConnection;
    const keys = built.keys;
    const reader = vi.spyOn(imodel, "createQueryReader");
    const { result } = renderHook(useInstanceLabels, { initialProps: { imodel, instanceKeys: keys }, disableStrictMode: true });

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.rows.filter(Boolean)).toHaveLength(100));
    const expected = await new PresentationLabelsProvider({ imodel }).getLabels(keys.map((key) => ({ ...key, className: key.className.replace(".", ":") })));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.rows.filter(Boolean)).toHaveLength(105));
    expect(result.current.rows.map((row) => row?.label)).toEqual([...expected].sort((a, b) => a.localeCompare(b)));
    expect(result.current.rows.map((row) => row?.instanceKey)).toEqual(keys.toReversed());
    act(() => result.current.loadMore());
    expect(reader).toHaveBeenCalledTimes(2);
  });

  it.each([500, 501])("groups distinct keys and aligns bindings for %i classes", async (classCount) => {
    const built = await buildIModel(`use-instance-labels-batches-${classCount}`, async () => ({}));
    imodel = built.imodelConnection;
    const keys = Array.from({ length: classCount }, (_, index) => ({ className: `Test.Class${index}`, id: `0x${(index + 1).toString(16)}` }));
    const firstClass = createResolvablePromise<void>();
    const createSelectClause = vi.fn<shared.IInstanceLabelSelectClauseFactory["createSelectClause"]>().mockImplementation(async ({ className }) => {
      if (className === keys[0].className) {
        await firstClass.promise;
      }
      return "NULL";
    });
    vi.mocked(shared.createBisInstanceLabelSelectClauseFactory).mockReturnValue({ createSelectClause });
    const createQueryReader = vi.fn<shared.ECSqlQueryExecutor["createQueryReader"]>().mockImplementation((query) => {
      const offset = query.bindings?.at(-1)?.value;
      if (typeof offset !== "number") {
        throw new Error("Missing offset");
      }
      return (async function* () {
        for (const key of keys.slice(offset, offset + 100)) {
          yield { className: key.className, id: key.id, label: key.className };
        }
      })();
    });
    vi.mocked(interop.createECSqlQueryExecutor).mockReturnValue({ createQueryReader });
    const selection = [...keys, { ...keys[0], className: "Test:Class0" }];
    const { result } = renderHook(useInstanceLabels, { initialProps: { imodel, instanceKeys: selection }, disableStrictMode: true });
    act(() => result.current.loadMore());
    await waitFor(() => expect(createSelectClause).toHaveBeenCalledTimes(classCount * 2));
    expect(createQueryReader).not.toHaveBeenCalled();
    await act(async () => firstClass.resolve());
    await waitFor(() => expect(result.current.rows.filter(Boolean)).toHaveLength(100));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.rows.filter(Boolean)).toHaveLength(200));
    expect(createSelectClause).toHaveBeenCalledTimes(classCount * 2);
    expect(createQueryReader).toHaveBeenCalledTimes(2);
    const firstQuery = createQueryReader.mock.calls[0][0];
    expect(firstQuery.ctes?.map((cte) => cte.split(" UNION ALL ").length)).toEqual(classCount === 500 ? [500] : [500, 1]);
    expect(firstQuery.ctes?.flatMap((cte) => [...cte.matchAll(/'([^']+)' AS className/g)].map((match) => match[1]))).toEqual(keys.map((key) => key.className));
    expect(firstQuery.bindings).toEqual([...keys.map((key) => ({ type: "idset", value: [key.id] })), { type: "long", value: 100 }, { type: "long", value: 0 }]);
  });

  it("measures each completed page and ignores an outdated selection", async () => {
    const built = await buildIModel("use-instance-labels-telemetry", async () => ({}));
    imodel = built.imodelConnection;
    const keys = Array.from({ length: 101 }, (_, index) => ({ className: "Test.Class", id: `0x${(index + 1).toString(16)}` }));
    const gate = createResolvablePromise<void>();
    let first = true;
    vi.mocked(shared.createBisInstanceLabelSelectClauseFactory).mockReturnValue({ createSelectClause: async () => "NULL" });
    vi.mocked(interop.createECSqlQueryExecutor).mockReturnValue({
      createQueryReader: (query) => {
        const bindings = query.bindings;
        const ids = bindings?.[0];
        const offset = bindings?.at(-1);
        if (!ids || ids.type !== "idset" || !ids.value || !offset || offset.type !== "long" || typeof offset.value !== "number") {
          throw new Error("Invalid bindings");
        }
        const values = ids.value;
        const start = offset.value;
        const wait = first;
        first = false;
        return (async function* () {
          if (wait) {
            await gate.promise;
          }
          for (const id of values.slice(start, start + 100)) {
            yield { className: "Test.Class", id, label: id };
          }
        })();
      },
    });
    const measured = vi.fn();
    const wrapper = ({ children }: PropsWithChildren) => <TelemetryContextProvider onPerformanceMeasured={measured}>{children}</TelemetryContextProvider>;
    const { result, rerender } = renderHook(useInstanceLabels, { initialProps: { imodel, instanceKeys: keys }, wrapper, disableStrictMode: true });
    act(() => result.current.loadMore());
    await waitFor(() => expect(first).toBe(false));
    const nextKeys: InstanceKey[] = keys.slice();
    rerender({ imodel, instanceKeys: nextKeys });
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.rows.filter(Boolean)).toHaveLength(100));
    expect(measured).toHaveBeenCalledExactlyOnceWith("elements-list-load", expect.any(Number));
    await act(async () => gate.resolve());
    expect(measured).toHaveBeenCalledTimes(1);
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.rows.filter(Boolean)).toHaveLength(101));
    expect(measured).toHaveBeenCalledTimes(2);
    expect(measured).toHaveBeenLastCalledWith("elements-list-load", expect.any(Number));
  });

  it("ignores overlapping loads and stops after exactly one full page", async () => {
    const built = await buildIModel("use-instance-labels-overlap", async () => ({}));
    imodel = built.imodelConnection;
    const keys = Array.from({ length: 100 }, (_, index) => ({ className: "Test.Class", id: `0x${(index + 1).toString(16)}` }));
    const gate = createResolvablePromise<void>();
    vi.mocked(shared.createBisInstanceLabelSelectClauseFactory).mockReturnValue({ createSelectClause: async () => "NULL" });
    const createQueryReader = vi.fn<shared.ECSqlQueryExecutor["createQueryReader"]>().mockImplementation(() =>
      (async function* () {
        await gate.promise;
        for (const key of keys) {
          yield { className: key.className, id: key.id, label: key.id };
        }
      })(),
    );
    vi.mocked(interop.createECSqlQueryExecutor).mockReturnValue({ createQueryReader });
    const { result } = renderHook(useInstanceLabels, { initialProps: { imodel, instanceKeys: keys }, disableStrictMode: true });
    act(() => {
      result.current.loadMore();
      result.current.loadMore();
    });
    await waitFor(() => expect(createQueryReader).toHaveBeenCalledOnce());
    await act(async () => gate.resolve());
    await waitFor(() => expect(result.current.rows.filter(Boolean)).toHaveLength(100));
    act(() => result.current.loadMore());
    expect(createQueryReader).toHaveBeenCalledOnce();
  });
});
