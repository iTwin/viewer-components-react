import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { FormatSelector } from "../../components/quantityformat/FormatSelector.js";

import type { FormatDefinition } from "@itwin/core-quantity";
import type { FormatSet } from "@itwin/ecschema-metadata";
// Mock the useTranslation hook
vi.mock("../../useTranslation.js", () => ({
  useTranslation: () => ({
    translate: (key: string) => {
      const translations: Record<string, string> = {
        "QuantityFormat:labels.formatSetSectionLabel": "Format Selection",
      };
      return translations[key] || key;
    },
  }),
}));

describe("FormatSelector", () => {
  const mockOnListItemChange = vi.fn();

  // Mock format definitions
  const mockFormatDefinition1: FormatDefinition = {
    precision: 2,
    type: "Decimal",
    label: "Length Format",
    description: "Format for length measurements",
    composite: {
      units: [{ name: "Units.M", label: "m" }],
    },
  };

  const mockFormatDefinition2: FormatDefinition = {
    precision: 4,
    type: "Decimal",
    label: "Area Format",
    description: "Format for area measurements",
    composite: {
      units: [{ name: "Units.SQ_M", label: "m²" }],
    },
  };

  const mockFormatDefinition3: FormatDefinition = {
    precision: 1,
    type: "Fractional",
    label: "Imperial Length",
    description: "Imperial units for length",
    composite: {
      units: [{ name: "Units.FT", label: "ft" }],
    },
  };

  // Mock format set
  const mockFormatSet: FormatSet = {
    name: "TestFormatSet",
    label: "Test Format Set",
    description: "Test format set for unit tests",
    formats: {
      "length-format": mockFormatDefinition1,
      "area-format": mockFormatDefinition2,
      "imperial-length": mockFormatDefinition3,
    },
  } as FormatSet;

  const defaultProps = {
    activeFormatSet: mockFormatSet,
    activeFormatDefinitionKey: undefined,
    onListItemChange: mockOnListItemChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render without crashing when activeFormatSet is provided", () => {
      render(<FormatSelector {...defaultProps} />);

      expect(screen.getByPlaceholderText("Search formats...")).toBeDefined();
      expect(screen.getByRole("list")).toBeDefined();
    });

    it("should not render content when activeFormatSet is undefined", () => {
      render(<FormatSelector {...defaultProps} activeFormatSet={undefined} />);

      expect(screen.queryByPlaceholderText("Search formats...")).toBeNull();
      expect(screen.queryByRole("list")).toBeNull();
    });

    it("should render all format items from the format set", () => {
      render(<FormatSelector {...defaultProps} />);

      expect(screen.getByText("Length Format")).toBeDefined();
      expect(screen.getByText("Area Format")).toBeDefined();
      expect(screen.getByText("Imperial Length")).toBeDefined();
    });

    it("should display format descriptions when available", () => {
      render(<FormatSelector {...defaultProps} />);

      expect(screen.getByText("Format for length measurements")).toBeDefined();
      expect(screen.getByText("Format for area measurements")).toBeDefined();
      expect(screen.getByText("Imperial units for length")).toBeDefined();
    });

    it("should highlight the active format when activeFormatDefinitionKey is provided", () => {
      render(<FormatSelector {...defaultProps} activeFormatDefinitionKey="length-format" />);

      const activeItem = screen.getByText("Length Format").closest(".quantityFormat--formatSelector-listItem");
      expect(activeItem?.classList.contains("active")).toBe(true);
    });
  });

  describe("Search Functionality", () => {
    it("should filter formats based on search term (label match)", async () => {
      const user = userEvent.setup();
      render(<FormatSelector {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText("Search formats...");
      await user.type(searchInput, "Length");

      await waitFor(() => {
        expect(screen.getByText("Length Format")).toBeDefined();
        expect(screen.getByText("Imperial Length")).toBeDefined();
        expect(screen.queryByText("Area Format")).toBeNull();
      });
    });

    it("should filter formats based on search term (description match)", async () => {
      const user = userEvent.setup();
      render(<FormatSelector {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText("Search formats...");
      await user.type(searchInput, "area");

      await waitFor(() => {
        expect(screen.getByText("Area Format")).toBeDefined();
        expect(screen.queryByText("Length Format")).toBeNull();
        expect(screen.queryByText("Imperial Length")).toBeNull();
      });
    });

    it("should filter formats based on search term (key match)", async () => {
      const user = userEvent.setup();
      render(<FormatSelector {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText("Search formats...");
      await user.type(searchInput, "imperial");

      await waitFor(() => {
        expect(screen.getByText("Imperial Length")).toBeDefined();
        expect(screen.queryByText("Length Format")).toBeNull();
        expect(screen.queryByText("Area Format")).toBeNull();
      });
    });

    it("should show 'no formats found' message when search yields no results", async () => {
      const user = userEvent.setup();
      render(<FormatSelector {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText("Search formats...");
      await user.type(searchInput, "nonexistent");

      await waitFor(() => {
        expect(screen.getByText('No formats found matching "nonexistent"')).toBeDefined();
        expect(screen.queryByText("Length Format")).toBeNull();
        expect(screen.queryByText("Area Format")).toBeNull();
        expect(screen.queryByText("Imperial Length")).toBeNull();
      });
    });

    it("should clear search and show all formats when search term is cleared", async () => {
      const user = userEvent.setup();
      render(<FormatSelector {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText("Search formats...");

      // First type a search term
      await user.type(searchInput, "Length");
      await waitFor(() => {
        expect(screen.queryByText("Area Format")).toBeNull();
      });

      // Then clear the search
      await user.clear(searchInput);
      await waitFor(() => {
        expect(screen.getByText("Length Format")).toBeDefined();
        expect(screen.getByText("Area Format")).toBeDefined();
        expect(screen.getByText("Imperial Length")).toBeDefined();
      });
    });

    it("should perform case-insensitive search", async () => {
      const user = userEvent.setup();
      render(<FormatSelector {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText("Search formats...");
      await user.type(searchInput, "AREA");

      await waitFor(() => {
        expect(screen.getByText("Area Format")).toBeDefined();
        expect(screen.queryByText("Length Format")).toBeNull();
      });
    });
  });

  describe("User Interactions", () => {
    it("should call onListItemChange when a format is clicked", async () => {
      const user = userEvent.setup();
      render(<FormatSelector {...defaultProps} />);

      const lengthFormatItem = screen.getByText("Length Format");
      await user.click(lengthFormatItem);

      expect(mockOnListItemChange).toHaveBeenCalledTimes(1);
      expect(mockOnListItemChange).toHaveBeenCalledWith(mockFormatDefinition1, "length-format");
    });

    it("should call onListItemChange with correct parameters for different formats", async () => {
      const user = userEvent.setup();
      render(<FormatSelector {...defaultProps} />);

      const areaFormatItem = screen.getByText("Area Format");
      await user.click(areaFormatItem);

      expect(mockOnListItemChange).toHaveBeenCalledWith(mockFormatDefinition2, "area-format");
    });

    it("should not call onListItemChange when clicking disabled 'no results' item", async () => {
      const user = userEvent.setup();
      render(<FormatSelector {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText("Search formats...");
      await user.type(searchInput, "nonexistent");

      await waitFor(() => {
        const noResultsItem = screen.getByText('No formats found matching "nonexistent"');
        expect(noResultsItem).toBeDefined();
      });

      const noResultsItem = screen.getByText('No formats found matching "nonexistent"');
      await user.click(noResultsItem);

      expect(mockOnListItemChange).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty format set gracefully", () => {
      const emptyFormatSet: FormatSet = {
        name: "EmptySet",
        label: "Empty Set",
        description: "Empty format set",
        formats: {},
      } as FormatSet;

      render(<FormatSelector {...defaultProps} activeFormatSet={emptyFormatSet} />);

      expect(screen.getByPlaceholderText("Search formats...")).toBeDefined();
      expect(screen.getByRole("list")).toBeDefined();
      expect(screen.queryByRole("listitem")).toBeNull();
    });

    it("should handle format without label by using key as fallback", () => {
      const formatSetWithoutLabels: FormatSet = {
        name: "NoLabelsSet",
        label: "No Labels Set",
        description: "Format set without labels",
        formats: {
          "format-key-1": {
            precision: 2,
            type: "Decimal",
            // No label property
          } as FormatDefinition,
        },
      } as FormatSet;

      render(<FormatSelector {...defaultProps} activeFormatSet={formatSetWithoutLabels} />);

      expect(screen.getByText("format-key-1")).toBeDefined();
    });

    it("should handle format without description gracefully", () => {
      const formatSetWithoutDescriptions: FormatSet = {
        name: "NoDescSet",
        label: "No Descriptions Set",
        description: "Format set without descriptions",
        formats: {
          "format-key-1": {
            precision: 2,
            type: "Decimal",
            label: "Test Format",
            // No description property
          } as FormatDefinition,
        },
      } as FormatSet;

      render(<FormatSelector {...defaultProps} activeFormatSet={formatSetWithoutDescriptions} />);

      expect(screen.getByText("Test Format")).toBeDefined();
      // Should not crash and should not show description text
    });

    it("should handle whitespace-only search terms correctly", async () => {
      const user = userEvent.setup();
      render(<FormatSelector {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText("Search formats...");
      await user.type(searchInput, "   ");

      // Should show all formats when search is only whitespace
      await waitFor(() => {
        expect(screen.getByText("Length Format")).toBeDefined();
        expect(screen.getByText("Area Format")).toBeDefined();
        expect(screen.getByText("Imperial Length")).toBeDefined();
      });
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels and roles", () => {
      render(<FormatSelector {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText("Search formats...");
      const list = screen.getByRole("list");

      expect(searchInput.getAttribute("id")).toBeTruthy();
      expect(list.getAttribute("id")).toBeTruthy();
      expect(list.classList.contains("quantityFormat--formatSelector-list")).toBe(true);
    });

    it("should maintain proper list structure", () => {
      render(<FormatSelector {...defaultProps} />);

      const listItems = screen.getAllByRole("listitem");
      expect(listItems).toHaveLength(3); // Three format items

      listItems.forEach(item => {
        expect(item.classList.contains("quantityFormat--formatSelector-listItem")).toBe(true);
      });
    });
  });
});
