/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { vi } from "vitest";
import * as interop from "@itwin/presentation-core-interop";
import * as shared from "@itwin/presentation-shared";

import type { InstanceKey } from "@itwin/presentation-common";

export interface LabeledInstanceKey {
  instanceKey: InstanceKey;
  label: string;
}

export function stubInstanceLabelQueries(loadRows: (page: { offset: number; limit: number }) => Promise<LabeledInstanceKey[]>) {
  vi.mocked(shared.createBisInstanceLabelSelectClauseFactory).mockReturnValue({ createSelectClause: async () => "NULL" });
  const createQueryReader = vi.fn<shared.ECSqlQueryExecutor["createQueryReader"]>().mockImplementation(async function* (query) {
    const limit = query.bindings?.at(-2);
    const offset = query.bindings?.at(-1);
    if (limit?.type !== "long" || typeof limit.value !== "number" || offset?.type !== "long" || typeof offset.value !== "number") {
      throw new Error("Expected page limit and offset bindings");
    }
    for (const { instanceKey, label } of await loadRows({ limit: limit.value, offset: offset.value })) {
      yield { className: shared.normalizeFullClassName(instanceKey.className), id: instanceKey.id, label };
    }
  });
  vi.mocked(interop.createECSqlQueryExecutor).mockReturnValue({ createQueryReader });
  return createQueryReader;
}
