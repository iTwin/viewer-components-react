/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, expect, it, vi } from "vitest";
import { PropertyValueFormat } from "@itwin/appui-abstract";
import { Field, PropertyValueFormat as PresentationPropertyValueFormat } from "@itwin/presentation-common";
import { FavoritePropertiesScope } from "@itwin/presentation-frontend";
import {
  AddFavoritePropertyContextMenuItem,
  CopyPropertyTextContextMenuItem,
  PropertyGridContextMenuItem,
  RemoveFavoritePropertyContextMenuItem,
  useContextMenu,
} from "../../property-grid-react/hooks/UseContextMenu.js";
import { TelemetryContextProvider } from "../../property-grid-react/hooks/UseTelemetryContext.js";
import { PropertyGridManager } from "../../property-grid-react/PropertyGridManager.js";
import { createFunctionStub, createPropertyRecord, render, stubFavoriteProperties, waitFor } from "../TestUtils.js";

import type { MouseEvent } from "react";
import type { IModelConnection } from "@itwin/core-frontend";
import type { IPresentationPropertyDataProvider, PresentationPropertyDataProvider } from "@itwin/presentation-components";
import type { ContextMenuItemProps, UseContentMenuProps } from "../../property-grid-react/hooks/UseContextMenu.js";

describe("useContextMenu", () => {
  const imodel = {} as IModelConnection;
  const record = createPropertyRecord({ valueFormat: PropertyValueFormat.Primitive }, { name: "test-prop", displayLabel: "Test Prop" });
  const dataProvider = {
    getFieldByPropertyDescription: createFunctionStub<PresentationPropertyDataProvider["getFieldByPropertyDescription"]>(),
  };

  function TestComponent(props: UseContentMenuProps) {
    const { renderContextMenu, onPropertyContextMenu } = useContextMenu(props);
    return (
      <>
        <div>Outside</div>
        <button
          onClick={async () =>
            onPropertyContextMenu({ event: { clientX: 10, clientY: 10, persist: () => {} } as unknown as MouseEvent, propertyRecord: record })
          }
        >
          Open Menu
        </button>
        {renderContextMenu()}
      </>
    );
  }

  it("opens context menu", async () => {
    const { getByText, user } = render(
      <TestComponent
        imodel={imodel}
        dataProvider={dataProvider as unknown as IPresentationPropertyDataProvider}
        contextMenuItems={[() => <div>Test Item</div>]}
      />,
    );

    const openButton = await waitFor(() => getByText("Open Menu"));
    await user.click(openButton);

    await waitFor(() => getByText("Test Item"));
  });

  it("doesn't open context menu if there are no items", async () => {
    const { getByText, queryByRole, user } = render(
      <TestComponent imodel={imodel} dataProvider={dataProvider as unknown as IPresentationPropertyDataProvider} />,
    );

    const openButton = await waitFor(() => getByText("Open Menu"));
    await user.click(openButton);

    expect(queryByRole("menu")).toBeNull();
  });

  it("closes context menu when item is clicked", async () => {
    const selectStub = vi.fn();
    const { getByText, queryByText, user } = render(
      <TestComponent
        imodel={imodel}
        dataProvider={dataProvider as unknown as IPresentationPropertyDataProvider}
        contextMenuItems={[
          () => (
            <PropertyGridContextMenuItem id="test-item" onSelect={selectStub}>
              Test Item
            </PropertyGridContextMenuItem>
          ),
        ]}
      />,
    );

    // open menu
    const openButton = await waitFor(() => getByText("Open Menu"));
    await user.click(openButton);

    // find item
    const item = await waitFor(() => getByText("Test Item"));

    // click item
    await user.click(item);

    // wait for item to disappear
    await waitFor(() => expect(queryByText("Test Item")).toBeNull());
    expect(selectStub).toHaveBeenCalledOnce();
  });

  it("closes context menu when `Esc` is clicked", async () => {
    const { getByText, queryByText, user } = render(
      <TestComponent
        imodel={imodel}
        dataProvider={dataProvider as unknown as IPresentationPropertyDataProvider}
        contextMenuItems={[() => <div>Test Item</div>]}
      />,
    );

    // open menu
    const openButton = await waitFor(() => getByText("Open Menu"));
    await user.click(openButton);

    // find item
    await waitFor(() => getByText("Test Item"));

    // simulate "escape" press
    await user.keyboard("{Escape}");

    // wait for item to disappear
    await waitFor(() => expect(queryByText("Test Item")).toBeNull());
  });

  it("closes context menu when outside element is clicked", async () => {
    const { getByText, queryByText, user } = render(
      <TestComponent
        imodel={imodel}
        dataProvider={dataProvider as unknown as IPresentationPropertyDataProvider}
        contextMenuItems={[() => <div>Test Item</div>]}
      />,
    );

    // open menu
    const openButton = await waitFor(() => getByText("Open Menu"));
    await user.click(openButton);

    // find item
    await waitFor(() => getByText("Test Item"));

    // click outside element
    const outsideElement = getByText("Outside");
    await user.click(outsideElement);

    // wait for item to disappear
    await waitFor(() => expect(queryByText("Test Item")).toBeNull());
  });

  describe("feature usage reporting", () => {
    it("reports when context menu opens", async () => {
      const onFeatureUsedSpy = vi.fn();
      const { getByText, user } = render(
        <TelemetryContextProvider onFeatureUsed={onFeatureUsedSpy}>
          <TestComponent
            imodel={imodel}
            dataProvider={dataProvider as unknown as IPresentationPropertyDataProvider}
            contextMenuItems={[() => <div>Test Item</div>]}
          />
        </TelemetryContextProvider>,
      );

      const openButton = await waitFor(() => getByText("Open Menu"));
      await user.click(openButton);

      await waitFor(() => getByText("Test Item"));
      expect(onFeatureUsedSpy).toHaveBeenCalledExactlyOnceWith("context-menu");
    });
  });
});

describe("Default context menu items", () => {
  const imodel = {} as IModelConnection;
  const dataProvider = {} as IPresentationPropertyDataProvider;
  const record = createRecord();
  const field: Field = createField();

  let favoritesManager: ReturnType<typeof stubFavoriteProperties>;
  const itemProps: ContextMenuItemProps = {
    imodel,
    dataProvider,
    record,
    field,
  };

  beforeEach(() => {
    vi.spyOn(PropertyGridManager, "translate").mockImplementation((key) => key);
    favoritesManager = stubFavoriteProperties();
    favoritesManager.add.mockReset();
    favoritesManager.remove.mockReset();
    favoritesManager.hasAsync.mockReset();
  });

  describe("AddFavoritePropertyContextMenuItem", () => {
    it("renders item with non-favorite property", async () => {
      favoritesManager.hasAsync.mockResolvedValue(false);
      const { queryByText } = render(<AddFavoritePropertyContextMenuItem {...itemProps} />);
      await waitFor(() => {
        expect(favoritesManager.hasAsync).toHaveBeenCalled();
        expect(queryByText("context-menu.add-favorite.label")).toBeDefined();
      });
    });

    it("renders nothing if property is favorite", async () => {
      favoritesManager.hasAsync.mockResolvedValue(true);
      const { container } = render(<AddFavoritePropertyContextMenuItem {...itemProps} />);
      await waitFor(() => {
        expect(favoritesManager.hasAsync).toHaveBeenCalled();
        expect(container.children).toHaveLength(0);
      });
    });

    it("calls `Presentation.favorites.add` with default scope", async () => {
      favoritesManager.hasAsync.mockResolvedValue(false);
      const { getByText, user } = render(<AddFavoritePropertyContextMenuItem {...itemProps} />);
      const item = await waitFor(() => getByText("context-menu.add-favorite.label"));
      await user.click(item);

      await waitFor(() => expect(favoritesManager.add).toHaveBeenCalledExactlyOnceWith(field, imodel, FavoritePropertiesScope.IModel));
    });

    it("calls `Presentation.favorites.add` with specified scope", async () => {
      favoritesManager.hasAsync.mockResolvedValue(false);
      const { getByText, user } = render(<AddFavoritePropertyContextMenuItem {...itemProps} scope={FavoritePropertiesScope.ITwin} />);
      const item = await waitFor(() => getByText("context-menu.add-favorite.label"));
      await user.click(item);

      await waitFor(() => expect(favoritesManager.add).toHaveBeenCalledExactlyOnceWith(field, imodel, FavoritePropertiesScope.ITwin));
    });

    it("calls custom `onSelect` handler", async () => {
      favoritesManager.hasAsync.mockResolvedValue(false);
      const spy = vi.fn();
      const { getByText, user } = render(<AddFavoritePropertyContextMenuItem {...itemProps} onSelect={spy} />);
      const item = await waitFor(() => getByText("context-menu.add-favorite.label"));
      await user.click(item);

      expect(spy).toHaveBeenCalledOnce();
    });
  });

  describe("RemoveFavoritePropertyContextMenuItem", () => {
    it("renders item with favorite property", async () => {
      favoritesManager.hasAsync.mockResolvedValue(true);
      const { queryByText } = render(<RemoveFavoritePropertyContextMenuItem {...itemProps} />);
      await waitFor(() => {
        expect(favoritesManager.hasAsync).toHaveBeenCalled();
        expect(queryByText("context-menu.remove-favorite.label")).toBeDefined();
      });
    });

    it("renders nothing if property is not favorite", async () => {
      favoritesManager.hasAsync.mockResolvedValue(false);
      const { container } = render(<RemoveFavoritePropertyContextMenuItem {...itemProps} />);
      await waitFor(() => {
        expect(favoritesManager.hasAsync).toHaveBeenCalled();
        expect(container.children).toHaveLength(0);
      });
    });

    it("calls `Presentation.favorites.remove` with default scope", async () => {
      favoritesManager.hasAsync.mockResolvedValue(true);
      const { getByText, user } = render(<RemoveFavoritePropertyContextMenuItem {...itemProps} />);
      const item = await waitFor(() => getByText("context-menu.remove-favorite.label"));
      await user.click(item);

      await waitFor(() => expect(favoritesManager.remove).toHaveBeenCalledExactlyOnceWith(field, imodel, FavoritePropertiesScope.IModel));
    });

    it("calls `Presentation.favorites.remove` with specified scope", async () => {
      favoritesManager.hasAsync.mockResolvedValue(true);
      const { getByText, user } = render(<RemoveFavoritePropertyContextMenuItem {...itemProps} scope={FavoritePropertiesScope.ITwin} />);
      const item = await waitFor(() => getByText("context-menu.remove-favorite.label"));
      await user.click(item);

      await waitFor(() => expect(favoritesManager.remove).toHaveBeenCalledOnce());
      expect(favoritesManager.remove).toHaveBeenCalledWith(field, imodel, FavoritePropertiesScope.ITwin);
    });

    it("calls custom `onSelect` handler", async () => {
      favoritesManager.hasAsync.mockResolvedValue(true);
      const spy = vi.fn();
      const { getByText, user } = render(<RemoveFavoritePropertyContextMenuItem {...itemProps} onSelect={spy} />);
      const item = await waitFor(() => getByText("context-menu.remove-favorite.label"));
      await user.click(item);

      expect(spy).toHaveBeenCalledOnce();
    });
  });

  describe("CopyPropertyTextContextMenuItem", () => {
    it("renders item", () => {
      const { queryByText } = render(<CopyPropertyTextContextMenuItem {...itemProps} />);
      expect(queryByText("context-menu.copy-text.label"));
    });

    it("copies text when clicked", async () => {
      const copyStub = vi.fn();
      const { getByText, user } = render(<CopyPropertyTextContextMenuItem {...itemProps} onCopy={copyStub} />);
      const item = getByText("context-menu.copy-text.label");

      await user.click(item);

      expect(copyStub).toHaveBeenCalledExactlyOnceWith(record.description);
    });

    it("calls custom `onSelect` handler", async () => {
      const selectStub = vi.fn();
      const { getByText, user } = render(<CopyPropertyTextContextMenuItem {...itemProps} onSelect={selectStub} />);
      const item = getByText("context-menu.copy-text.label");

      await user.click(item);

      expect(selectStub).toHaveBeenCalledOnce();
    });
  });
});

function createField() {
  return new Field({
    category: {
      name: "category",
      description: "",
      expand: false,
      label: "Category",
      priority: 0,
    },
    name: "test-field",
    label: "Test Field",
    type: {
      typeName: "string",
      valueFormat: PresentationPropertyValueFormat.Primitive,
    },
    isReadonly: false,
    priority: 0,
  });
}

function createRecord() {
  const record = createPropertyRecord({ valueFormat: PropertyValueFormat.Primitive }, { name: "test-prop", displayLabel: "Test Prop" });
  record.description = "Test Prop Value";
  return record;
}
