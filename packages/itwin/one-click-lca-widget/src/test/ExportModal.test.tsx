/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ExportModal from "../components/ExportModal";

describe("Testing Export Modal", function () {
  it("signin", function () {
    render(<ExportModal isOpen={true} close={() => {}} reportId={undefined} />);
    expect(screen.getByLabelText("Email")).toBeDefined();
    expect(screen.getByLabelText("Password")).toBeDefined();
  });
});
