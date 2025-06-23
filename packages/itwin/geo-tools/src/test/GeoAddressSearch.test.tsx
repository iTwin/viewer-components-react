/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { mount } from "enzyme";
import React from "react";
import * as sinon from "sinon";
import { stubObject } from "ts-sinon";
import { SpecialKey } from "@itwin/appui-abstract";
import { EmptyLocalization } from "@itwin/core-common";
import { MapCartoRectangle, NoRenderApp } from "@itwin/core-frontend";
import { fireEvent, render } from "@testing-library/react";
import { BingAddressProvider, GeoAddressSearch, IModelGeoView } from "../geo-tools";
import TestUtils from "./TestUtils";

import type { Range2d } from "@itwin/core-geometry";
describe("GeoAddressSearch", () => {

  const options = [
    { addressLine: "addrLine1", formattedAddress: "formattedAddr1" },
    { addressLine: "addrLine2", formattedAddress: "formattedAddr2" },
  ];

  const providerStub = stubObject<BingAddressProvider>(new BingAddressProvider());

  let getFrustumLonLatBBoxStub: sinon.SinonStub<[], Range2d | undefined>;
  let locateAddressStub: sinon.SinonStub<[string], Promise<boolean> >;

  before(async () => {
    await NoRenderApp.startup({localization: new EmptyLocalization()});
    await TestUtils.initializeGeoTools();
  });

  beforeEach(() => {
    locateAddressStub = sinon.stub(IModelGeoView, "locateAddress").callsFake(async (_address: string) => {
      return Promise.resolve(true);
    });
    providerStub.getSuggestions.returns(Promise.resolve([options[0]]));

    // providerStub.getAddresses.callsFake(async (_query: string, _viewLatLongBBox: Range2d)=>{
    //   console.log(`getAddresses called`);
    //   return Promise.resolve([options[0], options[1]]);
    // })
    getFrustumLonLatBBoxStub = sinon.stub(IModelGeoView, "getFrustumLonLatBBox").callsFake(() => {
      return MapCartoRectangle.createZero();
    });
  });

  afterEach(() => {
    locateAddressStub.restore();
    getFrustumLonLatBBoxStub.restore();
    providerStub.getSuggestions.reset();

  });
  after(async () => {
    TestUtils.terminateUiComponents();
  });

  it("renders", () => {
    const wrapper = mount(<GeoAddressSearch provider={new BingAddressProvider()}/>);

    expect(wrapper.find("input[type='text']").length).to.eq(1);
    wrapper.unmount();
  });

  it("should invoke getAddress on AddressProvider when value change", async () => {

    const wrapper = mount(<GeoAddressSearch provider={providerStub} />);

    const geoAddrSearch = wrapper.find(GeoAddressSearch);
    expect(geoAddrSearch.length).to.eq(1);

    const input = geoAddrSearch.find("input[type='text']");
    expect(input.length).to.eq(1);

    expect(providerStub.getSuggestions.called).to.be.false;

    // getAddresses should not be called using an empty value
    input.simulate("change", { target: { value: "" } });
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    expect(providerStub.getSuggestions.called).to.be.false;

    // First test with a getFrustumLonLatBBox stub that returns undefined
    getFrustumLonLatBBoxStub.restore();
    getFrustumLonLatBBoxStub = sinon.stub(IModelGeoView, "getFrustumLonLatBBox").callsFake(() => {
      return undefined;
    });
    input.simulate("change", { target: { value: "sample Addr" } });
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    getFrustumLonLatBBoxStub.calledOnce.should.true;
    providerStub.getSuggestions.calledOnce.should.false;

    // Now test with a stud that returns a proper Range.
    getFrustumLonLatBBoxStub.restore();
    getFrustumLonLatBBoxStub = sinon.stub(IModelGeoView, "getFrustumLonLatBBox").callsFake(() => {
      return MapCartoRectangle.createZero();
    });

    input.simulate("change", { target: { value: "sample Addr" } });
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    getFrustumLonLatBBoxStub.calledOnce.should.true;
    providerStub.getSuggestions.calledOnce.should.true;

    wrapper.unmount();
  });

  it("should support getSuggestions prop", async () => {
    const { container } = render(<div><GeoAddressSearch provider={providerStub} /></div>);

    const input = container.querySelector("input");
    expect(input).not.to.be.null;

    const inputNode: HTMLElement = input!;
    fireEvent.focusIn(inputNode);
    fireEvent.change(inputNode, { target: { value: "abc" } });
    await TestUtils.flushAsyncOperations();

    const li = container.querySelectorAll("li");
    expect(li).not.to.be.null;
    expect(li?.length).to.eq(1);

    fireEvent.click(li[0]);
    locateAddressStub.calledOnce.should.true;
  });

  it("should invoke getAddress when enter is pressed", async () => {
    const wrapper = mount(<GeoAddressSearch provider={providerStub} />);

    const geoAddrSearch = wrapper.find(GeoAddressSearch);
    expect(geoAddrSearch.length).to.eq(1);

    const input = geoAddrSearch.find("input[type='text']");
    expect(input.length).to.eq(1);

    // Enter should do nothing if no input value
    input.simulate("keydown", { key: SpecialKey.Enter });
    locateAddressStub.calledOnce.should.false;

    input.simulate("change", { target: { value: "addrLine1" } });
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    // Enter should invoke locateAddress
    input.simulate("keydown", { key: SpecialKey.Enter });
    locateAddressStub.calledOnce.should.true;

    wrapper.unmount();
  });

  it("should clear value when Escape is pressed", async () => {
    const wrapper = mount(<GeoAddressSearch provider={providerStub} />);

    const geoAddrSearch = wrapper.find(GeoAddressSearch);
    expect(geoAddrSearch.length).to.eq(1);

    const input = geoAddrSearch.find("input[type='text']");
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
