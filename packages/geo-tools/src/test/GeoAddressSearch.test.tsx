/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See COPYRIGHT.md in the repository root for full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { mount, ReactWrapper } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { BingAddressProvider } from "../AddressProvider";
import { GeoAddressSearch, IModelGeoView } from "../geo-tools";
import TestUtils from "./TestUtils";
import { stubObject } from "ts-sinon";
import { Point2d, Range2d } from "@bentley/geometry-core";
import { SpecialKey } from "@bentley/ui-abstract";

describe("GeoAddressSearch", () => {

  const options = [
    { addressLine: "addrLine1", formattedAddress: "formattedAddr1" },
    { addressLine: "addrLine2", formattedAddress: "formattedAddr2" },
  ];

  const providerStub = stubObject<BingAddressProvider>(new BingAddressProvider());

  let getFrustumLonLatBBoxStub: sinon.SinonStub<[], Range2d | undefined>;
  let locateAddressStub: sinon.SinonStub<[string], boolean>;

  const getInputElement = (wrapper: ReactWrapper): HTMLInputElement => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return wrapper.getDOMNode() as HTMLInputElement;
  };

  before(async () => {
    await TestUtils.initializeGeoTools();
  });

  beforeEach(() => {
    locateAddressStub = sinon.stub(IModelGeoView, "locateAddress").callsFake((_address: string): boolean => {
      return true;
    });
    providerStub.getAddresses.returns(Promise.resolve([options[0]]));
    getFrustumLonLatBBoxStub = sinon.stub(IModelGeoView, "getFrustumLonLatBBox").callsFake(() => {
      return Range2d.createArray([Point2d.create(0, 0), Point2d.create(1, 1)]);
    });
  });

  afterEach(() => {
    locateAddressStub.restore();
    getFrustumLonLatBBoxStub.restore();
    providerStub.getAddresses.reset();

  });

  it("renders", () => {
    const wrapper = mount(<GeoAddressSearch />);

    expect(wrapper.find("input[type='text']").length).to.eq(1);
    wrapper.unmount();
  });

  it("should invoke getAddress on AddressProvider when value change", async () => {

    const wrapper = mount(<GeoAddressSearch provider={providerStub} />);

    const geoAddrSearch = wrapper.find(GeoAddressSearch);
    expect(geoAddrSearch.length).to.eq(1);

    const input = geoAddrSearch.find("input[type='text']");
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

    input.simulate("change", { target: { value: "sample Addr" } });
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    getFrustumLonLatBBoxStub.calledOnce.should.true;
    providerStub.getAddresses.calledOnce.should.true;

    wrapper.unmount();
  });

  it("should invoke locateAddress when option clicked", async () => {
    const outerNode = document.createElement("div");
    document.body.appendChild(outerNode);

    const wrapper = mount(<GeoAddressSearch provider={providerStub} />, { attachTo: outerNode });

    const geoAddrSearch = wrapper.find(GeoAddressSearch);
    expect(geoAddrSearch.length).to.eq(1);

    const input = geoAddrSearch.find("input[type='text']");
    expect(input.length).to.eq(1);

    const inputNode = getInputElement(input);
    inputNode.focus();

    input.simulate("change", { target: { value: "addrLine1" } });
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    const li = wrapper.find("li");
    expect(li.length).to.eq(1);

    li.simulate("click");
    locateAddressStub.calledOnce.should.true;

    wrapper.unmount();
    document.body.removeChild(outerNode);
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
