/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { waitFor } from "@testing-library/react";
import { renderHook } from "@testing-library/react-hooks";
import * as showNullValuesClient from "../../api/ShowNullValuesPreferenceClient";
import { useNullValueSetting } from "../../property-grid-react";

describe("useNullValuesSetting", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("defaults to `true`", async () => {
    const { result } = renderHook(useNullValueSetting, { initialProps: { } });
    expect(result.current.showNullValues).to.be.true;
  });

  it("updates value", async () => {
    const { result } = renderHook(useNullValueSetting, { initialProps: { } });
    expect(result.current.showNullValues).to.be.true;

    await result.current.setShowNullValues(false);

    expect(result.current.showNullValues).to.be.false;
  });

  it("loads persisted value", async () => {
    sinon.stub(showNullValuesClient, "getShowNullValuesPreference").resolves(false);

    const { result } = renderHook(useNullValueSetting, { initialProps: { persistNullValueToggle: true } });
    await waitFor(() => expect(result.current.showNullValues).to.be.false);
  });

  it("persists value", async () => {
    sinon.stub(showNullValuesClient, "getShowNullValuesPreference").resolves(false);
    const saveValueStub = sinon.stub(showNullValuesClient, "saveShowNullValuesPreference");

    const { result } = renderHook(useNullValueSetting, { initialProps: { persistNullValueToggle: true } });
    await waitFor(() => expect(result.current.showNullValues).to.be.false);

    await result.current.setShowNullValues(true);

    await waitFor(() => {
      expect(result.current.showNullValues).to.be.true;
      expect(saveValueStub).to.be.calledOnceWith(true);
    });
  });
});
