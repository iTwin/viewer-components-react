/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  buildIModel as buildNamedIModel,
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
    const queryLabels = await new InstanceLabelsProvider({ imodel }).getLabels(keys);
    expect(queryLabels).toEqual(expected);

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

  it("loads labels of keys of different classes with a single query, in input order and with either class name separator", async () => {
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

  it("returns empty labels for instances that don't exist", async () => {
    const keys = await buildIModel((txn) => ({ subject: insertSubject({ txn, codeValue: "subject" }) }));
    const missing = { className: "BisCore.Subject", id: "0xffff" };

    const labels = await new InstanceLabelsProvider({ imodel }).getLabels([missing, keys.subject, missing]);
    expect(labels).toEqual(["", "subject", ""]);
  });

  it("handles more than 1000 keys in a single request", async () => {
    const keys = await buildIModel((txn) => {
      const model = insertPhysicalModelWithPartition({ txn, codeValue: "model" });
      const category = insertSpatialCategory({ txn, codeValue: "category" });
      return {
        elements: Array.from({ length: 1500 }, (_, i) => insertPhysicalElement({ txn, modelId: model.id, categoryId: category.id, userLabel: `${i}` })),
      };
    });

    const labels = await new InstanceLabelsProvider({ imodel }).getLabels(keys.elements);
    expect(labels).toEqual(keys.elements.map((key, i) => `${i} ${idSuffix(key.id)}`));
  });

  it("does not query when there are no keys", async () => {
    await buildIModel(() => ({}));
    const createQueryReader = vi.spyOn(imodel, "createQueryReader");

    const labels = await new InstanceLabelsProvider({ imodel }).getLabels([]);
    expect(labels).toEqual([]);
    expect(createQueryReader).not.toHaveBeenCalled();
  });

  it.each([500, 501])("batches %i classes into queries of at most 500 selects", async (classCount) => {
    await buildIModel(() => ({}));
    vi.mocked(shared.createBisInstanceLabelSelectClauseFactory).mockReturnValue({ createSelectClause: async () => "NULL" });
    const keys = Array.from({ length: classCount }, (_, index) => ({ className: `Test.Class${index}`, id: `0x${(index + 1).toString(16)}` }));
    const createQueryReader = vi.fn<shared.ECSqlQueryExecutor["createQueryReader"]>().mockImplementation((query) => {
      const classNames = [...query.ecsql.matchAll(/'([^']+)' AS className/g)].map((match) => match[1]);
      const batchKeys = keys.filter((key) => classNames.includes(key.className));
      return (async function* () {
        for (const key of batchKeys.toReversed()) {
          yield { className: key.className, id: key.id, label: key.className };
        }
      })();
    });
    vi.mocked(interop.createECSqlQueryExecutor).mockReturnValue({ createQueryReader });

    const labels = await new InstanceLabelsProvider({ imodel }).getLabels(keys);

    const expected = classCount === 500 ? { queryCount: 1, classesPerQuery: [500] } : { queryCount: 2, classesPerQuery: [500, 1] };
    expect(labels).toEqual(keys.map((key) => key.className));
    expect(createQueryReader).toHaveBeenCalledTimes(expected.queryCount);
    expect(createQueryReader.mock.calls.map(([query]) => query.ecsql.split(" UNION ALL ").length)).toEqual(expected.classesPerQuery);
    createQueryReader.mock.calls.forEach(([query], index) => {
      const batchKeys = keys.slice(index * 500, (index + 1) * 500);
      const classNames = [...query.ecsql.matchAll(/'([^']+)' AS className/g)].map((match) => match[1]);
      expect(classNames).toEqual(batchKeys.map((key) => key.className));
      expect(query.bindings).toEqual(batchKeys.map((key) => ({ type: "idset", value: [key.id] })));
    });
  });
});

/** BIS appends `[briefcaseId-localId]` in base36 to labels that aren't based on code value. Snapshot iModels always have briefcase id 0. */
function idSuffix(id: Id64String) {
  return `[0-${Number(id).toString(36).toUpperCase()}]`;
}
