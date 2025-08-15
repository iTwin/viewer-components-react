/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, vi, expect } from "vitest";
import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { FormatDefinition } from "@itwin/core-quantity";
import { StationBaseFactor } from "../../../components/quantityformat/internal/StationBaseFactor.js";

describe("StationBaseFactor", () => {
  const defaultStationFormatProps: FormatDefinition = {
    type: "station",
    precision: 2,
    stationOffsetSize: 2,
  };

  const stationFormatPropsWithBaseFactor: FormatDefinition = {
    type: "station",
    precision: 2,
    stationOffsetSize: 2,
    stationBaseFactor: 5,
  };

  it("should render with default value of 1 when no base factor is set", () => {
    const onChange = vi.fn();
    render(<StationBaseFactor formatProps={defaultStationFormatProps} onChange={onChange} />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("1");
    expect(screen.getByText("labels.stationBaseFactorLabel")).toBeTruthy();
  });

  it("should render with existing base factor value", () => {
    const onChange = vi.fn();
    render(<StationBaseFactor formatProps={stationFormatPropsWithBaseFactor} onChange={onChange} />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("5");
  });

  it("should call onChange when base factor is changed via input", () => {
    const onChange = vi.fn();
    render(<StationBaseFactor formatProps={defaultStationFormatProps} onChange={onChange} />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "10" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith({
      ...defaultStationFormatProps,
      stationBaseFactor: 10,
    });
  });

  it("should call onChange when Enter key is pressed", () => {
    const onChange = vi.fn();
    render(<StationBaseFactor formatProps={defaultStationFormatProps} onChange={onChange} />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "3" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith({
      ...defaultStationFormatProps,
      stationBaseFactor: 3,
    });
  });

  it("should prevent non-numeric input", () => {
    const onChange = vi.fn();
    render(<StationBaseFactor formatProps={defaultStationFormatProps} onChange={onChange} />);

    const input = screen.getByRole("textbox") as HTMLInputElement;

    // Test that decimal point is prevented
    fireEvent.keyDown(input, { key: "." });
    expect(input.value).toBe("1"); // Should remain unchanged

    // Test that letters are prevented
    fireEvent.keyDown(input, { key: "a" });
    expect(input.value).toBe("1"); // Should remain unchanged

    // Test that negative sign is prevented
    fireEvent.keyDown(input, { key: "-" });
    expect(input.value).toBe("1"); // Should remain unchanged
  });

  it("should allow only numeric input in onChange", () => {
    const onChange = vi.fn();
    render(<StationBaseFactor formatProps={defaultStationFormatProps} onChange={onChange} />);

    const input = screen.getByRole("textbox") as HTMLInputElement;

    // Test that only digits are accepted
    fireEvent.change(input, { target: { value: "abc123def" } });
    expect(input.value).toBe("1"); // Should remain unchanged since letters are filtered out

    fireEvent.change(input, { target: { value: "456" } });
    expect(input.value).toBe("456"); // Should accept pure numeric input
  });

  it("should not call onChange if value hasn't changed", () => {
    const onChange = vi.fn();
    render(<StationBaseFactor formatProps={stationFormatPropsWithBaseFactor} onChange={onChange} />);

    const input = screen.getByRole("textbox") as HTMLInputElement;

    // Set the same value and blur
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.blur(input);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("should update formatProps with new stationBaseFactor property", () => {
    const onChange = vi.fn();
    const formatPropsWithoutBaseFactor: FormatDefinition = {
      type: "station",
      precision: 2,
      stationOffsetSize: 3,
    };

    render(<StationBaseFactor formatProps={formatPropsWithoutBaseFactor} onChange={onChange} />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "7" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith({
      type: "station",
      precision: 2,
      stationOffsetSize: 3,
      stationBaseFactor: 7,
    });
  });
});
