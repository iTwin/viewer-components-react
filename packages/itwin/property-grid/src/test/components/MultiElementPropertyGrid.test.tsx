/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { PropertyRecord, PropertyValueFormat } from "@itwin/appui-abstract";
import { KeySet } from "@itwin/presentation-common";
import { PresentationLabelsProvider, PresentationPropertyDataProvider } from "@itwin/presentation-components";
import userEvents from "@testing-library/user-event";
import { AncestorsNavigationControls, MultiElementPropertyGrid, PropertyGridManager } from "../../property-grid-react";
import {
  act,
  createPropertyRecord,
  getByRole as getByRoleRTL,
  render,
  stubFavoriteProperties,
  stubPresentation,
  stubSelectionManager,
  waitFor,
} from "../TestUtils";

import type { ISelectionProvider, SelectionChangeEventArgs } from "@itwin/presentation-frontend";
import type { IModelConnection } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";
describe("<MultiElementPropertGrid />", () => {
  const imodel = {} as IModelConnection;

  let getDataStub: sinon.SinonStub<Parameters<PresentationPropertyDataProvider["getData"]>, ReturnType<PresentationPropertyDataProvider["getData"]>>;
  let getLabelsStub: sinon.SinonStub<Parameters<PresentationLabelsProvider["getLabels"]>, ReturnType<PresentationLabelsProvider["getLabels"]>>;
  let keysStub: sinon.SinonStub<any[], any>;
  let selectionManager: ReturnType<typeof stubSelectionManager>;

  before(() => {
    getDataStub = sinon.stub(PresentationPropertyDataProvider.prototype, "getData");
    getLabelsStub = sinon.stub(PresentationLabelsProvider.prototype, "getLabels");
    keysStub = sinon.stub(PresentationPropertyDataProvider.prototype, "keys");
    sinon.stub(PropertyGridManager, "translate").callsFake((key) => key);

    selectionManager = stubSelectionManager();
    stubFavoriteProperties();
    stubPresentation();
  });

  after(() => {
    sinon.restore();
  });

  afterEach(() => {
    keysStub.reset();
    getDataStub.reset();
    getLabelsStub.reset();
  });

  it("renders properties for a single instance", async () => {
    setupMultiInstanceData([
      {
        key: { id: "0x1", className: "TestClass" },
        value: "Test-Value",
      },
    ]);

    const { getByText, queryByRole } = render(<MultiElementPropertyGrid imodel={imodel} />);

    await waitFor(() => getByText("Test-Value"));
    // verify button for opening element list is not rendered
    expect(queryByRole("button", { name: "element-list.title" })).to.be.null;
  });

  it("renders properties for multiple instances", async () => {
    setupMultiInstanceData([
      {
        key: { id: "0x1", className: "TestClass" },
        value: "Test-Value-1",
      },
      {
        key: { id: "0x2", className: "TestClass" },
        value: "Test-Value-2",
      },
    ]);

    const { getByText, queryByRole } = render(<MultiElementPropertyGrid imodel={imodel} />);

    await waitFor(() => getByText("MultiInstances"));
    // verify button for opening element list is rendered
    expect(queryByRole("button", { name: "element-list.title" })).to.not.be.null;
  });

  it("renders element list", async () => {
    const instancekeys = [
      { id: "0x1", className: "TestClass" },
      { id: "0x2", className: "TestClass" },
    ];
    const expectedLabels = instancekeys.map(buildLabel);

    setupMultiInstanceData(instancekeys.map((key, i) => ({ key, value: `Test-Value-${i}` })));
    getLabelsStub.callsFake(async (keys) => keys.map(buildLabel));

    const { getByText, getByRole } = render(<MultiElementPropertyGrid imodel={imodel} />);

    await waitFor(() => getByText("MultiInstances"));
    const button = getByRole("button", { name: "element-list.title" });

    await userEvents.click(button);
    // verify element list is rendered
    for (const expected of expectedLabels) {
      await waitFor(() => getByText(expected));
    }
  });

  it("renders specific element props", async () => {
    const instancekeys = [
      { id: "0x1", className: "TestClass" },
      { id: "0x2", className: "TestClass" },
    ];
    const expectedLabels = instancekeys.map(buildLabel);

    setupMultiInstanceData(instancekeys.map((key, i) => ({ key, value: `Test-Value-${i}` })));
    getLabelsStub.callsFake(async (keys) => keys.map(buildLabel));

    const { getByText, getByRole } = render(<MultiElementPropertyGrid imodel={imodel} />);

    await waitFor(() => getByText("MultiInstances"));
    const button = getByRole("button", { name: "element-list.title" });

    await userEvents.click(button);
    const element = await waitFor(() => getByText(expectedLabels[1]));

    // setup data provider for single element property grid
    const keysSetterStub = sinon.stub();
    keysStub.set(keysSetterStub);
    setupSingleElementData(expectedLabels[1], "Test-Value-2");

    await userEvents.click(element);
    await waitFor(() => getByText("Test-Value-2"));

    expect(keysSetterStub).to.be.calledOnceWith(sinon.match((keys: KeySet) => keys.has(instancekeys[1])));
  });

  it("navigates from single element to multi element grid using 'Back' button", async () => {
    const instancekeys = [
      { id: "0x1", className: "TestClass" },
      { id: "0x2", className: "TestClass" },
    ];
    const expectedLabels = instancekeys.map(buildLabel);

    setupMultiInstanceData(instancekeys.map((key, i) => ({ key, value: `Test-Value-${i}` })));
    getLabelsStub.callsFake(async (keys) => keys.map(buildLabel));

    const { getByText, getByRole, container } = render(<MultiElementPropertyGrid imodel={imodel} />);

    await waitFor(() => getByText("MultiInstances"));
    const listButton = getByRole("button", { name: "element-list.title" });

    // navigate to element list
    await userEvents.click(listButton);
    const element = await waitFor(() => getByText(expectedLabels[1]));

    // setup data provider for single element property grid
    const keysSetterStub = sinon.stub();
    keysStub.set(keysSetterStub);
    setupSingleElementData(expectedLabels[1], "Test-Value-2");

    // navigate to specific element properties
    await userEvents.click(element);
    await waitFor(() => getByText("Test-Value-2"));

    // navigate back to element list
    const singleElementGrid = container.querySelector<HTMLButtonElement>(".property-grid-react-single-element-property-grid"); // eslint-disable-line deprecation/deprecation
    expect(singleElementGrid).to.not.be.null;
    const singleElementBackButton = getByRoleRTL(singleElementGrid!, "button", { name: "header.back" });
    await userEvents.click(singleElementBackButton);
    await waitFor(() => getByText(expectedLabels[0]));

    // navigate back to multi instances properties grid
    const elementList = container.querySelector<HTMLDivElement>(".property-grid-react-element-list"); // eslint-disable-line deprecation/deprecation
    expect(element).to.not.be.null;
    const elementListBackButton = getByRoleRTL(elementList!, "button", { name: "header.back" });
    await userEvents.click(elementListBackButton);
    await waitFor(() => getByText("MultiInstances"));
  });

  it("goes back to multi element property grid after selection changes", async () => {
    const instancekeys = [
      { id: "0x1", className: "TestClass" },
      { id: "0x2", className: "TestClass" },
    ];
    const expectedLabels = instancekeys.map(buildLabel);

    setupMultiInstanceData(instancekeys.map((key, i) => ({ key, value: `Test-Value-${i}` })));
    getLabelsStub.callsFake(async (keys) => keys.map(buildLabel));

    const { getByText, getByRole, user, unmount } = render(<MultiElementPropertyGrid imodel={imodel} />);

    await waitFor(() => getByText("MultiInstances"));
    const listButton = getByRole("button", { name: "element-list.title" });

    // navigate to element list
    await user.click(listButton);
    await waitFor(() => getByText(expectedLabels[1]));

    act(() => selectionManager.selectionChange.raiseEvent({ source: "TestSource" } as SelectionChangeEventArgs, {} as ISelectionProvider));
    await waitFor(() => getByText("MultiInstances"));

    // Selection change causes multiple pieces of the component to asynchronously update and we only care about one piece of
    // that - showing the default view. Unmount the component to avoid testing library warning about state changes in non `act` environment.
    unmount();
  });

  it("renders buttons for ancestor navigation", async () => {
    const instancekey = { id: "0x1", className: "TestClass" };
    setupMultiInstanceData([{ key: instancekey, value: "Test-Value-1" }]);
    selectionManager.scopes.computeSelection.reset();
    selectionManager.scopes.computeSelection.resolves(new KeySet([{ id: "0x2", className: "ParentClass" }]));

    const { getByText, queryByRole } = render(
      <MultiElementPropertyGrid imodel={imodel} ancestorsNavigationControls={(props) => <AncestorsNavigationControls {...props} />} />,
    );

    await waitFor(() => getByText("Test-Value-1"));
    expect(queryByRole("button", { name: "header.navigateUp" })).to.not.be.null;
    expect(queryByRole("button", { name: "header.navigateDown" })).to.not.be.null;
  });

  interface InstanceData {
    key: InstanceKey;
    value: string;
  }

  const buildLabel = (key: InstanceKey) => `${key.className}-${key.id}`;

  const setupMultiInstanceData = (instances: InstanceData[]) => {
    selectionManager.getSelection.returns(new KeySet(instances.map((i) => i.key)));

    const value = instances.length > 1 ? "MultiInstances" : instances[0].value;

    getDataStub.callsFake(async () => {
      return {
        categories: [{ expand: true, label: "Test Category", name: "test-category" }],
        label: PropertyRecord.fromString("Test Instance"),
        records: {
          ["test-category"]: [
            createPropertyRecord({ valueFormat: PropertyValueFormat.Primitive, value, displayValue: value }, { name: "test-prop", displayLabel: "Test Prop" }),
          ],
        },
      };
    });
  };

  const setupSingleElementData = (label: string, value: string) => {
    getDataStub.reset();
    getDataStub.callsFake(async () => ({
      categories: [{ expand: true, label: "Test Category", name: "test-category" }],
      label: PropertyRecord.fromString(label),
      records: {
        ["test-category"]: [
          createPropertyRecord({ valueFormat: PropertyValueFormat.Primitive, value, displayValue: value }, { name: "test-prop", displayLabel: "Test Prop" }),
        ],
      },
    }));
  };
});
