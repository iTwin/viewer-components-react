/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { config as rxjsConfig } from "rxjs";
import sinon from "sinon";
import { DbResult } from "@itwin/core-bentley";
import { DbQueryError } from "@itwin/core-common";
import { useCategoriesTreeButtonProps } from "../../../tree-widget-react/components/trees/categories-tree/CategoriesTreeButtons.js";
import { flushAsyncOperations, renderHook } from "../../TestUtils.js";

import type { Viewport } from "@itwin/core-frontend";

describe("useCategoriesTreeButtonProps", () => {
  afterEach(() => {
    sinon.restore();
  });

  async function renderWithFailingCategoriesQuery(error: Error) {
    const onUnhandledError = sinon.spy();
    sinon.stub(rxjsConfig, "onUnhandledError").value(onUnhandledError);
    const viewport = {
      view: { is3d: () => true },
      iModel: { createQueryReader: () => ({ toArray: sinon.stub().rejects(error) }) },
    } as unknown as Viewport;

    renderHook(useCategoriesTreeButtonProps, { initialProps: { viewport } });
    // rxjs reports unhandled errors from a timer scheduled only after the rejection propagates.
    await flushAsyncOperations();
    await flushAsyncOperations();
    return onUnhandledError;
  }

  it("ignores interrupted categories query", async () => {
    const onUnhandledError = await renderWithFailingCategoriesQuery(new DbQueryError({}, {}, DbResult.BE_SQLITE_INTERRUPT));
    expect(onUnhandledError).to.not.be.called;
  });

  it("reports categories query errors other than interrupts", async () => {
    const error = new Error("query failed");
    const onUnhandledError = await renderWithFailingCategoriesQuery(error);
    expect(onUnhandledError).to.be.calledOnceWith(error);
  });
});
