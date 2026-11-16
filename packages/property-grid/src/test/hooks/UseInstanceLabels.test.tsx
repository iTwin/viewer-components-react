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
import { useInstanceLabels } from "../../property-grid-react/hooks/UseInstanceLabels.js";
import { TelemetryContextProvider } from "../../property-grid-react/hooks/UseTelemetryContext.js";
import { act, renderHook, waitFor } from "../TestUtils.js";

import type { PropsWithChildren } from "react";
import type { IModelConnection } from "@itwin/core-frontend";

describe("useInstanceLabels", () => {
  let imodel: IModelConnection | undefined;

  beforeAll(async () => {
    await initializeCore({ rpcs: [IModelReadRpcInterface, PresentationRpcInterface, ECSchemaRpcInterface] });
    // eslint-disable-next-line @itwin/no-internal
    ECSchemaRpcImpl.register();
  });
  afterEach(async () => {
    await imodel?.close();
    imodel = undefined;
  });
  afterAll(async () => terminateCore());

  it("loads labels for elements, models and bracketed codes", async () => {
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
    const idSuffix = (id: string) => {
      const value = BigInt(id);
      return `[${(value >> 40n).toString(36)}-${(value & ((1n << 40n) - 1n)).toString(36)}]`.toUpperCase();
    };
    const expected = ["code", `user-label ${idSuffix(keys[1].id)}`, `Physical Object ${idSuffix(keys[2].id)}`, "[code]", "partition-label", "partition-label"];
    for (const [index, key] of keys.entries()) {
      expect(result.current.rows.find((row) => row?.instanceKey === key)?.label).toBe(expected[index]);
    }
  });

  it("deduplicates keys, omits missing instances and stops on a short page", async () => {
    const built = await buildIModel("use-instance-labels-missing", async (db) =>
      withEditTxn(db, (txn) => ({ key: insertSubject({ txn, codeValue: "subject" }) })),
    );
    imodel = built.imodelConnection;
    const missing = { className: "BisCore.Subject", id: "0xffff" };
    const reader = vi.spyOn(imodel, "createQueryReader");
    const { result, rerender } = renderHook(useInstanceLabels, {
      initialProps: { imodel, instanceKeys: [missing, { ...built.key, className: "BisCore:Subject" }, built.key, missing] },
      disableStrictMode: true,
    });
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.rows).toEqual([{ instanceKey: built.key, label: "subject" }]));
    act(() => result.current.loadMore());
    expect(result.current.rows).toEqual([{ instanceKey: built.key, label: "subject" }]);
    expect(reader).toHaveBeenCalledOnce();
    rerender({ imodel, instanceKeys: [] });
    act(() => result.current.loadMore());
    expect(result.current.rows).toEqual([]);
    expect(reader).toHaveBeenCalledOnce();
  });

  it.each([500, 501])("loads globally sorted pages across %i classes", async (classCount) => {
    const built = await buildIModel(`use-instance-labels-many-classes-${classCount}`, async (db) => {
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
    const reader = vi.spyOn(imodel, "createQueryReader");
    const sortedKeys = built.keys.toReversed();
    const { result } = renderHook(useInstanceLabels, { initialProps: { imodel, instanceKeys: built.keys }, disableStrictMode: true });
    const pageCount = Math.ceil(classCount / 100);
    for (let page = 1; page <= pageCount; ++page) {
      act(() => result.current.loadMore());
      await waitFor(() => expect(result.current.rows.map((row) => row?.instanceKey)).toEqual(sortedKeys.slice(0, page * 100)));
      expect(reader).toHaveBeenCalledTimes(page);
    }
    act(() => result.current.loadMore());
    expect(reader).toHaveBeenCalledTimes(pageCount);
  });

  it("loads real labels in sorted pages", async () => {
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
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.rows.filter(Boolean)).toHaveLength(105));
    expect(result.current.rows.map((row) => row?.label)).toEqual(Array.from({ length: 105 }, (_, index) => `subject-${String(index).padStart(3, "0")}`));
    expect(result.current.rows.map((row) => row?.instanceKey)).toEqual(keys.toReversed());
    act(() => result.current.loadMore());
    expect(reader).toHaveBeenCalledTimes(2);
  });

  it("measures each completed page and ignores a selection superseded during preparation", async () => {
    const built = await buildIModel("use-instance-labels-telemetry", async (db) =>
      withEditTxn(db, (txn) => ({
        keys: Array.from({ length: 102 }, (_, index) => insertSubject({ txn, codeValue: `subject-${String(index).padStart(3, "0")}` })),
      })),
    );
    imodel = built.imodelConnection;
    const reader = vi.spyOn(imodel, "createQueryReader");
    const measured = vi.fn();
    const wrapper = ({ children }: PropsWithChildren) => <TelemetryContextProvider onPerformanceMeasured={measured}>{children}</TelemetryContextProvider>;
    const { result, rerender } = renderHook(useInstanceLabels, {
      initialProps: { imodel, instanceKeys: built.keys.slice(0, 1) },
      wrapper,
      disableStrictMode: true,
    });
    act(() => result.current.loadMore());
    const nextKeys = built.keys.slice(1);
    rerender({ imodel, instanceKeys: nextKeys });
    act(() => result.current.loadMore());
    const expectedRows = nextKeys.map((instanceKey, index) => ({ instanceKey, label: `subject-${String(index + 1).padStart(3, "0")}` }));
    await waitFor(() => expect(result.current.rows).toEqual(expectedRows.slice(0, 100)));
    expect(measured).toHaveBeenCalledExactlyOnceWith("elements-list-page-load", expect.any(Number));
    expect(reader).toHaveBeenCalledOnce();
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.rows).toEqual(expectedRows));
    expect(measured).toHaveBeenCalledTimes(2);
    expect(measured).toHaveBeenLastCalledWith("elements-list-page-load", expect.any(Number));
    expect(reader).toHaveBeenCalledTimes(2);
    act(() => result.current.loadMore());
    expect(measured).toHaveBeenCalledTimes(2);
    expect(reader).toHaveBeenCalledTimes(2);
  });

  it("ignores overlapping loads and stops after exactly one full page", async () => {
    const built = await buildIModel("use-instance-labels-overlap", async (db) =>
      withEditTxn(db, (txn) => ({
        keys: Array.from({ length: 100 }, (_, index) => insertSubject({ txn, codeValue: `subject-${String(index).padStart(3, "0")}` })),
      })),
    );
    imodel = built.imodelConnection;
    const keys = built.keys;
    const reader = vi.spyOn(imodel, "createQueryReader");
    const { result } = renderHook(useInstanceLabels, { initialProps: { imodel, instanceKeys: keys }, disableStrictMode: true });
    act(() => {
      result.current.loadMore();
      result.current.loadMore();
    });
    expect(result.current.rows).toEqual(new Array(100).fill(undefined));
    const expectedRows = keys.map((instanceKey, index) => ({ instanceKey, label: `subject-${String(index).padStart(3, "0")}` }));
    await waitFor(() => expect(result.current.rows).toEqual(expectedRows));
    expect(reader).toHaveBeenCalledOnce();
    act(() => result.current.loadMore());
    expect(result.current.rows).toEqual(expectedRows);
    expect(reader).toHaveBeenCalledOnce();
  });
});
