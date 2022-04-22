/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from '@testing-library/user-event'
import { WidgetHeader } from "../widget/components/utils";

describe("Widget Header Component", function () {
  it("title renders", function () {
    render(<WidgetHeader title="tEsTtItlE" />);

    const title = screen.getByText(/testtitle/i)

    expect(title).toHaveTextContent(`tEsTtItlE`);
  });

  it("header allows return callback", function () {
    const mockReturnFn = jest.fn();
    render(
      <WidgetHeader title="hello" returnFn={mockReturnFn} />
    );

    const returnBtn = screen.getByRole('button');
    userEvent.click(returnBtn);
    expect(mockReturnFn).toHaveBeenCalled;
  });
});
