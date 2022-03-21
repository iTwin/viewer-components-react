/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import ReactDom, { unmountComponentAtNode } from "react-dom";
import { act } from "react-dom/test-utils";
import { WidgetHeader } from "../components/utils";

let rootContainer: HTMLElement | null = null;

beforeEach(() => {
  rootContainer = document.createElement("div");
  document.body.appendChild(rootContainer);
});

afterEach(() => {
  if (rootContainer !== null) {
    unmountComponentAtNode(rootContainer);
    rootContainer.remove();
    rootContainer = null;
  }
});

describe("Testing widget header", () => {
  it("render default widget header with title", () => {
    act(() => {
      if (rootContainer !== null) {
        ReactDom.render(<WidgetHeader title="hello" />, rootContainer);
        expect(rootContainer.textContent).to.be.equal("hello");
        expect(rootContainer?.querySelector("SvgChevronLeft")).to.be.null;
      }
    });
  });
});
