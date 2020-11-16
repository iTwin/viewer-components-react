/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { mount, ReactWrapper } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { GeoAddressSearch } from "../geo-tools";
import TestUtils from "./TestUtils";


describe("GeoAddressSearch", () => {
  before(async () => {
    await TestUtils.initializeGeoTools();
  });

  it("renders", () => {
    const spyMethod = sinon.spy();
    const wrapper = mount(<GeoAddressSearch />);

    expect(wrapper.find("input[type='text']").length).to.eq(1);
    wrapper.unmount();
  });
});
