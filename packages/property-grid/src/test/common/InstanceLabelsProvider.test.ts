/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  buildIModel as buildNamedIModel,
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
import { InstanceLabelsProvider } from "../../property-grid-react/common/InstanceLabelsProvider.js";

import type { EditTxn, IModelDb } from "@itwin/core-backend";
import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";

vi.mock("@itwin/presentation-core-interop", async (importOriginal) => {
  const actual = await importOriginal<typeof interop>();
  return {
    ...actual,
    createECSqlQueryExecutor: vi.fn(actual.createECSqlQueryExecutor),
  };
});
vi.mock("@itwin/presentation-shared", async (importOriginal) => {
  const actual = await importOriginal<typeof shared>();
  return {
    ...actual,
    createBisInstanceLabelSelectClauseFactory: vi.fn(actual.createBisInstanceLabelSelectClauseFactory),
  };
});

describe("InstanceLabelsProvider", () => {
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

  afterAll(async () => {
    await terminateCore();
  });

  /** Creates an iModel with the instances inserted by `setup` and returns whatever `setup` returns (typically the inserted instance keys). */
  async function buildIModel<TKeys extends object>(setup: (txn: EditTxn, db: IModelDb) => TKeys): Promise<TKeys> {
    const name = expect.getState().currentTestName!.replace(/\W+/g, "-");
    const { imodelConnection, ...keys } = await buildNamedIModel(name, async (db) => withEditTxn(db, (txn) => setup(txn, db)));
    imodel = imodelConnection;
    return keys as TKeys;
  }

  /** Verifies that both the query-based provider and Presentation produce the `expected` labels for `keys`. */
  async function expectLabels(keys: InstanceKey[], expected: string[]) {
    const page = await new InstanceLabelsProvider({ imodel }).getLabelsPage(keys, { offset: 0, limit: keys.length });
    const queryLabels = keys.map(
      (key) =>
        page.items.find(
          ({ instanceKey }) =>
            instanceKey.id === key.id && shared.normalizeFullClassName(instanceKey.className) === shared.normalizeFullClassName(key.className),
        )?.label ?? "",
    );
    expect(queryLabels).toEqual(expected);
    expect(page.hasMore).toBe(false);

    const presentationKeys = keys.map((key) => ({ ...key, className: key.className.replace(".", ":") }));
    const presentationLabels = await new PresentationLabelsProvider({ imodel }).getLabels(presentationKeys);
    expect(presentationLabels).toEqual(expected);
  }

  it("labels geometric elements by code value, then user label, then class label", async () => {
    const keys = await buildIModel((txn, db) => {
      const model = insertPhysicalModelWithPartition({ txn, codeValue: "model" });
      const category = insertSpatialCategory({ txn, codeValue: "category" });
      const code = new Code({ spec: db.codeSpecs.getByName(BisCodeSpec.nullCodeSpec).id, scope: model.id, value: "code" });
      return {
        withCode: insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id, code, userLabel: "user label" }),
        withUserLabel: insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id, userLabel: "user label" }),
        withNothing: insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id }),
      };
    });

    await expectLabels(
      [keys.withCode, keys.withUserLabel, keys.withNothing],
      ["code", `user label ${idSuffix(keys.withUserLabel.id)}`, `Physical Object ${idSuffix(keys.withNothing.id)}`],
    );
  });

  it("labels other elements by user label, then code value", async () => {
    const keys = await buildIModel((txn) => ({
      withUserLabel: insertSubject({ txn, codeValue: "ignored code", userLabel: "user label" }),
      withCode: insertSubject({ txn, codeValue: "code" }),
      // code values wrapped in brackets must not be mistaken for JSON
      withBrackets: insertSubject({ txn, codeValue: "[code]" }),
    }));

    await expectLabels([keys.withUserLabel, keys.withCode, keys.withBrackets], ["user label", "code", "[code]"]);
  });

  it("labels models by their modeled element", async () => {
    const keys = await buildIModel((txn) => {
      const partition = insertPhysicalPartition({ txn, codeValue: "code", parentId: IModel.rootSubjectId, userLabel: "user label" });
      const model = insertPhysicalSubModel({ txn, modeledElementId: partition.id });
      return { partition, model };
    });
    // a model shares its id with the modeled element, so the class must be used to tell them apart
    expect(keys.model.id).toBe(keys.partition.id);

    await expectLabels([keys.model, keys.partition], ["user label", "user label"]);
  });

  it("loads a page of different classes with a single query and either class name separator", async () => {
    const keys = await buildIModel((txn) => {
      const model = insertPhysicalModelWithPartition({ txn, codeValue: "model" });
      const category = insertSpatialCategory({ txn, codeValue: "category" });
      return {
        model,
        category,
        element: insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id, userLabel: "element" }),
        subject: insertSubject({ txn, codeValue: "subject", fullClassNameSeparator: ":" }),
      };
    });
    const createQueryReader = vi.spyOn(imodel, "createQueryReader");

    const element = `element ${idSuffix(keys.element.id)}`;
    await expectLabels([keys.element, keys.subject, keys.model, keys.element, keys.category], [element, "subject", "model", element, "category"]);
    expect(createQueryReader).toHaveBeenCalledOnce();
  });

  it("omits instances that don't exist", async () => {
    const keys = await buildIModel((txn) => ({ subject: insertSubject({ txn, codeValue: "subject" }) }));
    const missing = { className: "BisCore.Subject", id: "0xffff" };

    const page = await new InstanceLabelsProvider({ imodel }).getLabelsPage([missing, keys.subject, missing], { offset: 0, limit: 100 });
    expect(page).toEqual({ items: [{ instanceKey: keys.subject, label: "subject" }], hasMore: false });
  });

  it("pages a selection containing more than 1000 keys", async () => {
    const keys = await buildIModel((txn) => {
      const model = insertPhysicalModelWithPartition({ txn, codeValue: "model" });
      const category = insertSpatialCategory({ txn, codeValue: "category" });
      return {
        elements: Array.from({ length: 1500 }, (_, i) => insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id, userLabel: `${i}` })),
      };
    });

    const labelsById = new Map(keys.elements.map((key, index) => [key.id, `${index} ${idSuffix(key.id)}`]));
    const page = await new InstanceLabelsProvider({ imodel }).getLabelsPage(keys.elements, { offset: 0, limit: 100 });
    expect(page.items).toHaveLength(100);
    expect(page.hasMore).toBe(true);
    for (const item of page.items) {
      expect(item.label).toBe(labelsById.get(item.instanceKey.id));
    }
  });

  it("does not query when there are no keys", async () => {
    await buildIModel(() => ({}));
    const createQueryReader = vi.spyOn(imodel, "createQueryReader");

    const page = await new InstanceLabelsProvider({ imodel }).getLabelsPage([], { offset: 0, limit: 100 });
    expect(page).toEqual({ items: [], hasMore: false });
    expect(createQueryReader).not.toHaveBeenCalled();
  });

  it("returns globally sorted pages with stable ties and omits missing and duplicate keys", async () => {
    const keys = await buildIModel((txn) => ({
      last: insertSubject({ txn, codeValue: "Zulu" }),
      first: insertSubject({ txn, codeValue: "alpha" }),
      tied: insertSubject({ txn, codeValue: "different-code", userLabel: "alpha" }),
      middle: insertSpatialCategory({ txn, codeValue: "Beta" }),
    }));
    const provider = new InstanceLabelsProvider({ imodel });
    const selection = [keys.last, keys.middle, keys.tied, keys.first, keys.first, { className: "BisCore.Subject", id: "0xffff" }];
    const first = await provider.getLabelsPage(selection, { offset: 0, limit: 2 });
    const second = await provider.getLabelsPage(selection, { offset: 2, limit: 2 });
    expect(first).toEqual({
      items: [
        { instanceKey: keys.first, label: "alpha" },
        { instanceKey: keys.tied, label: "alpha" },
      ],
      hasMore: true,
    });
    expect(second).toEqual({
      items: [
        { instanceKey: keys.middle, label: "Beta" },
        { instanceKey: keys.last, label: "Zulu" },
      ],
      hasMore: false,
    });
    expect(await provider.getLabelsPage(selection, { offset: 4, limit: 2 })).toEqual({ items: [], hasMore: false });
    expect(await provider.getLabelsPage([], { offset: 0, limit: 100 })).toEqual({ items: [], hasMore: false });
  });

  it("sorts and pages more than 500 classes in a real query", async () => {
    const classCount = 501;
    const { imodelConnection, keys } = await buildNamedIModel("labels-paging-many-classes", async (db) => {
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
    imodel = imodelConnection;
    const provider = new InstanceLabelsProvider({ imodel });
    const first = await provider.getLabelsPage(keys, { offset: 0, limit: 100 });
    expect(first.items.map(({ instanceKey }) => instanceKey)).toEqual(keys.toReversed().slice(0, 100));
    expect(first.hasMore).toBe(true);
    const last = await provider.getLabelsPage(keys, { offset: 500, limit: 100 });
    expect(last).toEqual({ items: [{ instanceKey: keys[0], label: `0501 ${idSuffix(keys[0].id)}` }], hasMore: false });
  });

  it.each([500, 501])("pages %i classes using CTE batches of at most 500 selects", async (classCount) => {
    await buildIModel(() => ({}));
    vi.mocked(shared.createBisInstanceLabelSelectClauseFactory).mockReturnValue({ createSelectClause: async () => "NULL" });
    const keys = Array.from({ length: classCount }, (_, index) => ({ className: `Test.Class${index}`, id: `0x${(index + 1).toString(16)}` }));
    let rowsRead = 0;
    const createQueryReader = vi.fn<shared.ECSqlQueryExecutor["createQueryReader"]>().mockImplementation(() => {
      return (async function* () {
        for (const key of keys) {
          ++rowsRead;
          yield { className: key.className, id: key.id, label: key.className };
        }
      })();
    });
    vi.mocked(interop.createECSqlQueryExecutor).mockReturnValue({ createQueryReader });

    const page = await new InstanceLabelsProvider({ imodel }).getLabelsPage(keys, { offset: 0, limit: 100 });

    const expected = classCount === 500 ? { queryCount: 1, classesPerCte: [500] } : { queryCount: 1, classesPerCte: [500, 1] };
    expect(page).toEqual({ items: keys.slice(0, 100).map((instanceKey) => ({ instanceKey, label: instanceKey.className })), hasMore: true });
    expect(createQueryReader).toHaveBeenCalledTimes(expected.queryCount);
    createQueryReader.mock.calls.forEach(([query]) => {
      const classNames = (query.ctes ?? []).flatMap((cte) => [...cte.matchAll(/'([^']+)' AS className/g)].map((match) => match[1]));
      expect(classNames).toEqual(keys.map((key) => key.className));
      expect(query.ctes?.map((cte) => cte.split(" UNION ALL ").length)).toEqual(expected.classesPerCte);
      expect(query.bindings).toEqual([...keys.map((key) => ({ type: "idset", value: [key.id] })), { type: "long", value: 101 }, { type: "long", value: 0 }]);
    });
    expect(rowsRead).toBe(101);
  });
});

/** BIS appends `[briefcaseId-localId]` in base36 to labels that aren't based on code value. Snapshot iModels always have briefcase id 0. */
function idSuffix(id: Id64String) {
  return `[0-${Number(id).toString(36).toUpperCase()}]`;
}
