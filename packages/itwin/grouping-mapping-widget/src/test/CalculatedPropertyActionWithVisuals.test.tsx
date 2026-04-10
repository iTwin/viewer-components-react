/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { vi } from "vitest";
import type { GroupMinimal } from "@itwin/insights-client";
import { render, screen, waitFor } from "./test-utils";
import { CalculatedPropertyActionWithVisuals } from "../components/Properties/CalculatedProperties/CalculatedPropertyActionWithVisuals";

const {
  addDecoratorMock,
  dropDecoratorMock,
  setContextMock,
  getInferredSpatialDataMock,
  clearContextMock,
  visualizeElementsMock,
  zoomToElementsMock,
  clearAllMock,
  useGroupKeySetQueryMock,
} = vi.hoisted(() => ({
  addDecoratorMock: vi.fn(),
  dropDecoratorMock: vi.fn(),
  setContextMock: vi.fn<(instanceId: string) => Promise<boolean>>(),
  getInferredSpatialDataMock: vi.fn(),
  clearContextMock: vi.fn(),
  visualizeElementsMock: vi.fn(),
  zoomToElementsMock: vi.fn(async () => {}),
  clearAllMock: vi.fn(),
  useGroupKeySetQueryMock: vi.fn(),
}));

vi.mock("@itwin/core-frontend", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@itwin/core-frontend");
  return {
    ...actual,
    IModelApp: {
      viewManager: {
        addDecorator: addDecoratorMock,
        dropDecorator: dropDecoratorMock,
      },
    },
  };
});

vi.mock("../components/context/GroupingApiConfigContext", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("../components/context/GroupingApiConfigContext");
  return {
    ...actual,
    useGroupingMappingApiConfig: () => ({ iModelConnection: {} }),
  };
});

vi.mock("../components/Groups/hooks/useKeySetHiliteQueries", () => ({
  useGroupKeySetQuery: (...args: unknown[]) => useGroupKeySetQueryMock(...args),
}));

vi.mock("../common/viewerUtils", () => ({
  visualizeElements: (...args: unknown[]) => visualizeElementsMock(...args),
  zoomToElements: (...args: unknown[]) => zoomToElementsMock(...args),
  clearAll: (...args: unknown[]) => clearAllMock(...args),
}));

vi.mock("../decorators/BboxDimensionsDecorator", () => {
  class MockBboxDimensionsDecorator {
    public async setContext(instanceId: string): Promise<boolean> {
      return setContextMock(instanceId);
    }
    public getInferredSpatialData() {
      return getInferredSpatialDataMock();
    }
    public drawContext(): boolean {
      return true;
    }
    public clearContext(): void {
      clearContextMock();
    }
  }
  return {
    BboxDimension: {
      BoundingBoxShortestEdgeLength: "Shortest Edge Length",
    },
    BboxDimensionsDecorator: MockBboxDimensionsDecorator,
  };
});

vi.mock("../components/Properties/CalculatedProperties/SharedCalculatedPropertyForms", () => ({
  SharedCalculatedPropertyForms: () => <div />,
}));

describe("CalculatedPropertyActionWithVisuals", () => {
  const group: GroupMinimal = {
    id: "group-1",
    groupName: "group-1",
    description: "group-1",
    query: "SELECT * FROM test",
    _links: {
      iModel: { href: "" },
      mapping: { href: "" },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useGroupKeySetQueryMock.mockReturnValue({
      data: {
        result: {
          ids: ["0xnoSpatial", "0xhasSpatial", "0xshouldNotBeUsed"],
        },
      },
    });
    getInferredSpatialDataMock.mockReturnValue(new Map());
  });

  it("tries next highlighted ID when first one cannot create context", async () => {
    setContextMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const { user, container } = render(
      <CalculatedPropertyActionWithVisuals
        group={group}
        calculatedPropertyType={undefined}
        isLoading={false}
        setCalculatedPropertyType={vi.fn()}
      />,
    );

    const toggle =
      screen.queryByRole("switch", { name: /properties\.visualizeDimensions/i }) ??
      screen.queryByRole("checkbox", { name: /properties\.visualizeDimensions/i }) ??
      container.querySelector("input[type='checkbox']");
    expect(toggle).toBeTruthy();

    await user.click(toggle as Element);

    await waitFor(() => {
      expect(setContextMock).toHaveBeenCalledTimes(2);
    });
    expect(setContextMock).toHaveBeenNthCalledWith(1, "0xnoSpatial");
    expect(setContextMock).toHaveBeenNthCalledWith(2, "0xhasSpatial");
    expect(setContextMock).not.toHaveBeenCalledWith("0xshouldNotBeUsed");
  });

  it("limits context attempts to 25 highlighted IDs", async () => {
    const ids = Array.from({ length: 30 }, (_unused, index) => `0x${index.toString(16)}`);
    useGroupKeySetQueryMock.mockReturnValue({
      data: {
        result: {
          ids,
        },
      },
    });
    setContextMock.mockResolvedValue(false);

    const { user, container } = render(
      <CalculatedPropertyActionWithVisuals
        group={group}
        calculatedPropertyType={undefined}
        isLoading={false}
        setCalculatedPropertyType={vi.fn()}
      />,
    );

    const toggle =
      screen.queryByRole("switch", { name: /properties\.visualizeDimensions/i }) ??
      screen.queryByRole("checkbox", { name: /properties\.visualizeDimensions/i }) ??
      container.querySelector("input[type='checkbox']");
    expect(toggle).toBeTruthy();
    await user.click(toggle as Element);

    await waitFor(() => {
      expect(setContextMock).toHaveBeenCalledTimes(25);
    });
    expect(setContextMock).toHaveBeenNthCalledWith(25, "0x18");
    expect(setContextMock).not.toHaveBeenCalledWith("0x19");
  });
});
