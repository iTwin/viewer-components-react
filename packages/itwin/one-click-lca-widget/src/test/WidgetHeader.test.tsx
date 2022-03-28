/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "@testing-library/jest-dom";
import { render } from "@testing-library/react";
import { WidgetHeader } from "../components/utils";

describe("Widget Header Component", function () {
  it("should have hello as title", function () {
    let { getByText } = render(<WidgetHeader title="hello" />);
    expect(getByText("hello")).toBeDefined();
  });
});
