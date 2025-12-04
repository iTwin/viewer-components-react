/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createContext, useContext, useState } from "react";
import { StatusBarSection, useActiveIModelConnection, useActiveViewport } from "@itwin/appui-react";
import { TransientIdSequence } from "@itwin/core-bentley";
import { EmphasizeElements } from "@itwin/core-frontend";
import { SvgIsolate, SvgSelection, SvgVisibilityShow, SvgZoomInCircular } from "@itwin/itwinui-icons-react";
import { IconButton, ToggleSwitch } from "@itwin/itwinui-react";
import { QuantityFormatButton } from "./quantity-formatting/QuantityFormatButton";

import type { PropsWithChildren } from "react";
import type { UiItemsProvider } from "@itwin/appui-react";

export interface ViewerOptionsContext {
  density: "default" | "enlarged";
  disableNodesSelection: boolean;
}

export interface ViewerActionsContext {
  setDensity: React.Dispatch<React.SetStateAction<"default" | "enlarged">>;
  setDisableNodesSelection: React.Dispatch<React.SetStateAction<boolean>>;
}

const viewerOptionsContext = createContext<ViewerOptionsContext>({} as ViewerOptionsContext);
const viewerActionsContext = createContext<ViewerActionsContext>({} as ViewerActionsContext);

export function ViewerOptionsProvider(props: PropsWithChildren<unknown>) {
  const [density, setDensity] = useState<"default" | "enlarged">("default");
  const [disableNodesSelection, setDisableNodesSelection] = useState<boolean>(false);
  return (
    <viewerActionsContext.Provider value={{ setDensity, setDisableNodesSelection }}>
      <viewerOptionsContext.Provider value={{ density, disableNodesSelection }}>{props.children}</viewerOptionsContext.Provider>
    </viewerActionsContext.Provider>
  );
}

export function useViewerOptionsContext() {
  return useContext(viewerOptionsContext);
}

export function useViewerActionsContext() {
  return useContext(viewerActionsContext);
}

export const statusBarActionsProvider: UiItemsProvider = {
  id: "ViewerOptionsUiItemsProvider",
  getStatusBarItems: () => [
    {
      id: `toggleExpandedLayoutButton`,
      content: <ToggleExpandedLayoutButton />,
      itemPriority: 1,
      section: StatusBarSection.Left,
    },
    {
      id: `toggleTreeNodesSelectionButton`,
      content: <ToggleTreeNodesSelectionButton />,
      itemPriority: 2,
      section: StatusBarSection.Left,
    },
    {
      id: `addTransientElementToSelectionButton`,
      content: <AddTransientElementToSelectionButton />,
      itemPriority: 4,
      section: StatusBarSection.Left,
    },
    {
      id: `quantityFormatButton`,
      content: <QuantityFormatButton />,
      itemPriority: 5,
      section: StatusBarSection.Left,
    },
    {
      id: `isolateButton`,
      content: <IsolateButton />,
      itemPriority: 6,
      section: StatusBarSection.Left,
    },
  ],
};

function ToggleExpandedLayoutButton() {
  const { setDensity } = useViewerActionsContext();
  return (
    <IconButton label="Toggle expanded layout" styleType="borderless" onClick={() => setDensity((prev) => (prev === "default" ? "enlarged" : "default"))}>
      <SvgVisibilityShow />
    </IconButton>
  );
}

function ToggleTreeNodesSelectionButton() {
  const { setDisableNodesSelection } = useViewerActionsContext();
  return (
    <IconButton label="Toggle tree nodes' selection" styleType="borderless" onClick={() => setDisableNodesSelection((prev) => !prev)}>
      <SvgSelection />
    </IconButton>
  );
}

function AddTransientElementToSelectionButton() {
  const [sequence] = useState(new TransientIdSequence());
  const imodel = useActiveIModelConnection();
  const onClick = () => {
    imodel?.selectionSet.add(sequence.getNext());
  };
  return (
    <IconButton label="Add transient element to selection" styleType="borderless" onClick={onClick}>
      <SvgZoomInCircular />
    </IconButton>
  );
}

function IsolateButton() {
  const viewport = useActiveViewport();
  const onClick = (isChecked: boolean) => {
    if (viewport) {
      if (isChecked) {
        EmphasizeElements.getOrCreate(viewport).isolateSelectedElements(viewport, true, false);
      } else {
        EmphasizeElements.getOrCreate(viewport).clearIsolatedElements(viewport);
      }
    }
  };
  return (
    <ToggleSwitch
      defaultChecked={false}
      label="Isolate"
      labelPosition="right"
      onChange={(event) => {
        onClick(event.currentTarget.checked);
      }}
      icon={<SvgIsolate />}
    />
  );
}
