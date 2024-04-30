/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { stubObject } from "ts-sinon";
import { SpecialKey } from "@itwin/appui-abstract";
import { EmptyLocalization } from "@itwin/core-common";
import { MockRender } from "@itwin/core-frontend";
import { Point2d, Range2d } from "@itwin/core-geometry";
import { fireEvent, render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { BingAddressProvider } from "../AddressProvider";
import { GeoAddressSearch, IModelGeoView } from "../geo-tools";
import TestUtils from "./TestUtils";

describe("GeoAddressSearch", () => {

  const options = [
    { addressLine: "addrLine1", formattedAddress: "formattedAddr1" },
    { addressLine: "addrLine2", formattedAddress: "formattedAddr2" },
  ];

  const providerStub = stubObject<BingAddressProvider>(new BingAddressProvider());

  let getFrustumLonLatBBoxStub: sinon.SinonStub<[], Range2d | undefined>;
  let locateAddressStub: sinon.SinonStub<[string], Promise<boolean> >;

  before(async () => {
    await MockRender.App.startup({localization: new EmptyLocalization()});
    await TestUtils.initializeGeoTools();
    window.HTMLElement.prototype.scrollIntoView = sinon.stub();
  });

  beforeEach(() => {
    locateAddressStub = sinon.stub(IModelGeoView, "locateAddress").callsFake(async (_address: string) => {
      return Promise.resolve(true);
    });
    providerStub.getAddresses.returns(Promise.resolve([options[0]]));

    // providerStub.getAddresses.callsFake(async (_query: string, _viewLatLongBBox: Range2d)=>{
    //   console.log(`getAddresses called`);
    //   return Promise.resolve([options[0], options[1]]);
    // })
    getFrustumLonLatBBoxStub = sinon.stub(IModelGeoView, "getFrustumLonLatBBox").callsFake(() => {
      return Range2d.createArray([Point2d.create(0, 0), Point2d.create(1, 1)]);
    });
  });

  afterEach(() => {
    locateAddressStub.restore();
    getFrustumLonLatBBoxStub.restore();
    providerStub.getAddresses.reset();
  });
  after(async () => {
    TestUtils.terminateUiComponents();
    await MockRender.App.shutdown();
  });

  it("renders", () => {
    const wrapper = mount(<GeoAddressSearch />);

    const input = wrapper.find("input");
    expect(input.length).to.eq(1);
    wrapper.unmount();
  });

  it("should invoke getAddress on AddressProvider when value change", async () => {

    const wrapper = mount(<GeoAddressSearch provider={providerStub} />);

    const geoAddrSearch = wrapper.find(GeoAddressSearch);
    expect(geoAddrSearch.length).to.eq(1);

    const input = geoAddrSearch.find("input");
    expect(input.length).to.eq(1);

    expect(providerStub.getAddresses.called).to.be.false;

    // getAddresses should not be called using an empty value
    input.simulate("change", { target: { value: "" } });
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    expect(providerStub.getAddresses.called).to.be.false;

    // First test with a getFrustumLonLatBBox stub that returns undefined
    getFrustumLonLatBBoxStub.restore();
    getFrustumLonLatBBoxStub = sinon.stub(IModelGeoView, "getFrustumLonLatBBox").callsFake(() => {
      return undefined;
    });
    input.simulate("change", { target: { value: "sample Addr" } });
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    getFrustumLonLatBBoxStub.calledOnce.should.true;
    providerStub.getAddresses.calledOnce.should.false;

    // Now test with a stud that returns a proper Range.
    getFrustumLonLatBBoxStub.restore();
    getFrustumLonLatBBoxStub = sinon.stub(IModelGeoView, "getFrustumLonLatBBox").callsFake(() => {
      return Range2d.createArray([Point2d.create(0, 0), Point2d.create(1, 1)]);
    });

    input.simulate("change", { target: { value: "sample Address" } });
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    getFrustumLonLatBBoxStub.calledOnce.should.true;
    providerStub.getAddresses.calledOnce.should.true;

    wrapper.unmount();
  });

  it("should populated the suggested list", async () => {
    const { container } = render(<div><GeoAddressSearch provider={providerStub} /></div>);

    const input = container.querySelector("input");
    expect(input).not.to.be.null;

    const inputNode: HTMLElement = input!;

    fireEvent.focusIn(inputNode);
    fireEvent.change(inputNode, { target: { value: "abc" } });
    await TestUtils.flushAsyncOperations();

    const listId = input!.attributes.getNamedItem("aria-controls")?.value;
    expect(listId).not.to.be.null;

    const list = document.querySelector(`#${listId}`) as HTMLElement;
    expect(list).not.to.be.null;
    expect(list.children.length).to.eq(1);

    fireEvent.click(list.children[0]);
    await TestUtils.flushAsyncOperations();

    locateAddressStub.calledOnce.should.true;
  });

  it("should invoke getAddress when enter is pressed", async () => {
    const wrapper = mount(<GeoAddressSearch provider={providerStub} />);

    const geoAddrSearch = wrapper.find(GeoAddressSearch);
    expect(geoAddrSearch.length).to.eq(1);

    const input = geoAddrSearch.find("input");
    expect(input.length).to.eq(1);

    // Enter should do nothing if no input value
    input.simulate("keydown", { key: SpecialKey.Enter });
    locateAddressStub.calledOnce.should.false;

    input.simulate("change", { target: { value: "addrLine1" } });
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    // Enter should invoke locateAddress
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Enter}");

    await TestUtils.flushAsyncOperations();

    locateAddressStub.calledOnce.should.true;

    wrapper.unmount();
  });

  it("should clear value when Escape is pressed", async () => {
    const wrapper = mount(<GeoAddressSearch provider={providerStub} />);

    const geoAddrSearch = wrapper.find(GeoAddressSearch);
    expect(geoAddrSearch.length).to.eq(1);

    const input = geoAddrSearch.find("input");
    expect(input.length).to.eq(1);

    input.simulate("change", { target: { value: "addrLine1" } });
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    expect(input.getDOMNode().getAttribute("value")).to.eq("addrLine1");

    input.simulate("keydown", { key: SpecialKey.Escape });

    expect(input.getDOMNode().getAttribute("value")).to.eq("");
    wrapper.unmount();
  });
});
