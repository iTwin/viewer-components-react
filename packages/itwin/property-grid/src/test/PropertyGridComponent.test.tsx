/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { UiFramework, WidgetState } from "@itwin/appui-react";
import { BeEvent } from "@itwin/core-bentley";
import { KeySet } from "@itwin/presentation-common";
import { render, waitFor } from "@testing-library/react";
import * as multiElementPropertyGrid from "../components/MultiElementPropertyGrid";
import { PropertyGridComponent, PropertyGridComponentId } from "../PropertyGridComponent";
import { stubSelectionManager } from "./TestUtils";

import type { WidgetDef } from "@itwin/appui-react";
import type { IModelConnection } from "@itwin/core-frontend";
import type { ISelectionProvider, SelectionChangeEventArgs } from "@itwin/presentation-frontend";

describe("PropertyGridComponent", () => {
  const imodel = {
    isBlankConnection: () => true,
    selectionSet: {
      onChanged: new BeEvent(),
    },
  } as IModelConnection;

  before(async () => {
    await UiFramework.initialize(undefined);
    sinon.stub(multiElementPropertyGrid, "MultiElementPropertyGrid").returns(<>MultiElementPropertyGrid</>);
  });

  after(() => {
    UiFramework.terminate();
    sinon.restore();
  });

  it("returns `null` if there is no active imodel", async () => {
    UiFramework.setIModelConnection(undefined);
    const { container } = render(<PropertyGridComponent />);
    expect(container.children).to.be.empty;
  });

  it("renders `MultiElementPropertyGrid` for active imodel", async () => {
    UiFramework.setIModelConnection(imodel);
    const { getByText } = render(<PropertyGridComponent />);
    await waitFor(() => getByText("MultiElementPropertyGrid"));
  });

  describe("widget state", () => {
    const widgetDef = {
      id: PropertyGridComponentId,
      setWidgetState: sinon.stub<Parameters<WidgetDef["setWidgetState"]>, ReturnType<WidgetDef["setWidgetState"]>>(),
    };
    const frontstageDef = {
      findWidgetDef: (id: string) => id === widgetDef.id ? widgetDef : undefined,
    };

    let selectionManager: ReturnType<typeof stubSelectionManager>;

    before(() => {
      selectionManager = stubSelectionManager();
      sinon.stub(UiFramework.frontstages, "activeFrontstageDef").get(() => frontstageDef);
      UiFramework.setIModelConnection(imodel);
    });

    beforeEach(() => {
      selectionManager.getSelection.reset();
      widgetDef.setWidgetState.reset();
    });

    it("hides widget if `UnifiedSelection` changes to empty", async () => {
      render(<PropertyGridComponent />);

      selectionManager.getSelection.returns(new KeySet());
      selectionManager.selectionChange.raiseEvent({} as SelectionChangeEventArgs, {} as ISelectionProvider);

      await waitFor(() => {
        expect(widgetDef.setWidgetState).to.be.called;
        expect(widgetDef.setWidgetState).to.be.calledWith(WidgetState.Hidden);
      });
    });

    it("opens widget if `UnifiedSelection` changes to non-empty", async () => {
      render(<PropertyGridComponent />);

      selectionManager.getSelection.returns(new KeySet([{ id: "0x1", className: "TestClass" }]));
      selectionManager.selectionChange.raiseEvent({} as SelectionChangeEventArgs, {} as ISelectionProvider);

      await waitFor(() => {
        expect(widgetDef.setWidgetState).to.be.called;
        expect(widgetDef.setWidgetState).to.be.calledWith(WidgetState.Open);
      });
    });
  });
});
