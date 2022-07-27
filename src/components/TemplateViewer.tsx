/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { ReactNode } from "react";
import React, { useMemo } from "react";
import { Text, ComboBox, SelectOption, Label, Tree, Table } from "@itwin/itwinui-react";
import { usePresentationTreeNodeLoader } from "@itwin/presentation-components";
import { ControlledTree, SelectionMode, useTreeEventsHandler, useTreeModel } from "@itwin/components-react";
import { WidgetHeader } from "./utils";
import { Selector } from "./Selector";
import "./Templates.scss";
import { Group } from "./Selector"


interface TemplateViewerProps {
  goBack: () => void;
  template?: Selector;
}

function FormatTemplate(template: Selector): string {
  var text = "";
  for (const group of template.groups) {
    text += group.groupName + "\n";
    text += "\t" + group.itemName + "\n";
    for (const pair of group.pairs) {
      text += "\t\t" + pair.material + " - " + pair.quantity + "\n";
    }
  }
  return text;
}

export const TemplateViewer = ({
  template,
  goBack
}: TemplateViewerProps) => {
  var formatedText = "";

  if (template)
    formatedText = FormatTemplate(template);

  //Maybe use controlled tree element??

  return (

    <div
      className="rcw-dropdown-tile-container"
      data-testid="horizontal-tile"
    >
      <WidgetHeader
        title={"op"}
        disabled={false}
        returnFn={async () => {
          goBack();
        }}
      />
      <div className="e_c_3-scrollable-table">
        <Text>
          {formatedText}
        </Text>
      </div>
    </div>
  );
};
