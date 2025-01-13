/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { createContext, useContext, useState } from "react";
import { StatusBarSection } from "@itwin/appui-react";
import { SvgSelection, SvgVisibilityShow } from "@itwin/itwinui-icons-react";
import { IconButton, Select } from "@itwin/itwinui-react";
import { Presentation } from "@itwin/presentation-frontend";

import type { SelectionScopesManager } from "@itwin/presentation-frontend";
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
      id: `selectionScopeSelectorButton`,
      content: <SelectionScopeSelectorButton />,
      itemPriority: 3,
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

function SelectionScopeSelectorButton() {
  const [activeScope, setActiveScope] = useState(getScopeId(Presentation.selection.scopes.activeScope));
  return (
    <Select
      options={Object.entries(scopes).map(([key, { label }]) => ({
        value: key,
        label,
      }))}
      value={activeScope}
      onChange={(value) => {
        const scopeId = value as keyof typeof scopes;
        setActiveScope(scopeId);
        // TODO: Viewer should allow specifying the active selection scope without using `Presentation.selection`
        Presentation.selection.scopes.activeScope = scopes[scopeId].props;
      }}
    />
  );
}
function getScopeId(scopeArg: SelectionScopesManager["activeScope"]): keyof typeof scopes {
  if (!scopeArg) {
    return "element";
  }
  if (typeof scopeArg === "string") {
    return scopeArg as keyof typeof scopes;
  }
  if (scopeArg.id === "element" && "ancestorLevel" in scopeArg) {
    if (scopeArg.ancestorLevel === 1) {
      return "assembly";
    }
    if (scopeArg.ancestorLevel === 2) {
      return "top-assembly";
    }
  }
  return scopeArg.id as keyof typeof scopes;
}
const scopes = {
  element: {
    props: { id: "element" },
    label: "Element",
  },
  assembly: {
    props: { id: "element", ancestorLevel: 1 },
    label: "Assembly",
  },
  "top-assembly": {
    props: { id: "element", ancestorLevel: 2 },
    label: "Top assembly",
  },
  model: {
    props: { id: "model" },
    label: "Model",
  },
  category: {
    props: { id: "category" },
    label: "Category",
  },
};
