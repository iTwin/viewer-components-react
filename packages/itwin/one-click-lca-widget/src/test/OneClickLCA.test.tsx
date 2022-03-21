/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import ReactDom, { unmountComponentAtNode } from "react-dom";
import { act } from "react-dom/test-utils";
import OneClickLCA from "../components/OneClickLCA";

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

describe("App Component Testing", () => {
  it("Renders", () => {
    act(() => {
      ReactDom.render(<OneClickLCA />, rootContainer);
    });
  });
});
