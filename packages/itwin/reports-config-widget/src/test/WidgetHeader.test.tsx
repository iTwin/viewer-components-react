/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "../test/test-utils";
import userEvent from '@testing-library/user-event'
import { WidgetHeader } from "../widget/components/utils";
import { faker } from '@faker-js/faker';

describe("Widget Header Component", function () {
  it("title renders", function () {
    const fakeTitle = faker.word.interjection();
    render(<WidgetHeader title={fakeTitle} />);

    const title = screen.getByText(fakeTitle)

    expect(title).toHaveTextContent(fakeTitle);
  });

  it("header allows return callback", function () {
    const mockReturnFn = jest.fn();
    render(
      <WidgetHeader title="" returnFn={mockReturnFn} />
    );

    const returnBtn = screen.getByRole('button');
    userEvent.click(returnBtn);
    expect(mockReturnFn).toHaveBeenCalled;
  });
});
