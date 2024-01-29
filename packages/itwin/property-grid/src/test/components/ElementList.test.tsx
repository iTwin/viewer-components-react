/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { PresentationLabelsProvider } from "@itwin/presentation-components";
import userEvents from "@testing-library/user-event";
import { ElementList } from "../../components/ElementList";
import { PropertyGridManager } from "../../PropertyGridManager";
import { render, waitFor } from "../TestUtils";

import type { IModelConnection } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";

describe("<ElementList />", () => {
  const imodel = {} as IModelConnection;
  const buildLabel = (key: InstanceKey) => `${key.className}-${key.id}`;

  let getLabelsStub: sinon.SinonStub<Parameters<PresentationLabelsProvider["getLabels"]>, ReturnType<PresentationLabelsProvider["getLabels"]>>;

  before(() => {
    sinon.stub(PropertyGridManager, "translate").callsFake((key) => key);
    getLabelsStub = sinon.stub(PresentationLabelsProvider.prototype, "getLabels").callsFake(async (keys) => keys.map(buildLabel));
  });

  after(() => {
    sinon.restore();
  });

  afterEach(() => {
    getLabelsStub.resetHistory();
  });

  it("loads and renders instance labels", async () => {
    const instanceKeys = Array(5)
      .fill(0)
      .map((_, i) => ({ id: `0x${i + 1}`, className: "TestClass" }));
    const expectedLabels = instanceKeys.map(buildLabel);

    const { getByText } = render(<ElementList imodel={imodel} instanceKeys={instanceKeys} onBack={() => {}} onSelect={() => {}} />);

    for (const expected of expectedLabels) {
      await waitFor(() => getByText(expected));
    }

    expect(getLabelsStub).to.be.calledWith(instanceKeys);
  });

  it("loads and orders elements by labels", async () => {
    const instanceKeys = [
      { id: "0x0", className: "B_Second" },
      { id: "0x0", className: "A_First" },
      { id: "0x0", className: "C_Last" },
    ];

    const expectedLabels = instanceKeys.map(buildLabel).sort();

    const { findAllByRole } = render(<ElementList imodel={imodel} instanceKeys={instanceKeys} onBack={() => {}} onSelect={() => {}} />);

    const listItems = await findAllByRole("listitem");
    listItems.forEach((item, index) => {
      expect(item.textContent).to.be.equal(expectedLabels[index]);
    });
  });

  it("loads instance labels in chunks", async () => {
    const instanceKeys = Array(1500)
      .fill(0)
      .map((_, i) => ({ id: `0x${i + 1}`, className: "TestClass" }));
    const expectedLabels = instanceKeys.map(buildLabel);

    const { getByText } = render(<ElementList imodel={imodel} instanceKeys={instanceKeys} onBack={() => {}} onSelect={() => {}} />);

    // wait for first element to be rendered
    await waitFor(() => getByText(expectedLabels[0]));
    expect(getLabelsStub).to.be.calledWith(instanceKeys.slice(0, 1000));
    expect(getLabelsStub).to.be.calledWith(instanceKeys.slice(1000));
  });

  it("invokes `onSelect` when item is clicked", async () => {
    const instanceKeys = Array(5)
      .fill(0)
      .map((_, i) => ({ id: `0x${i + 1}`, className: "TestClass" }));
    const expectedLabels = instanceKeys.map(buildLabel);
    const onSelectSpy = sinon.spy();

    const { getByText } = render(<ElementList imodel={imodel} instanceKeys={instanceKeys} onBack={() => {}} onSelect={onSelectSpy} />);

    // wait for element to be rendered
    const item = await waitFor(() => getByText(expectedLabels[2]));
    await userEvents.click(item);

    expect(onSelectSpy).to.be.calledOnceWithExactly(instanceKeys[2]);
  });

  it("invokes `onBack` when 'Back' button is clicked", async () => {
    const instanceKeys = Array(5)
      .fill(0)
      .map((_, i) => ({ id: `0x${i + 1}`, className: "TestClass" }));
    const expectedLabels = instanceKeys.map(buildLabel);
    const onBackSpy = sinon.spy();

    const { getByText, getByRole } = render(<ElementList imodel={imodel} instanceKeys={instanceKeys} onBack={onBackSpy} onSelect={() => {}} />);

    // wait for element to be rendered
    await waitFor(() => getByText(expectedLabels[2]));
    const button = getByRole("button", { name: "header.back" });
    await userEvents.click(button);

    expect(onBackSpy).to.be.calledOnce;
  });
});
