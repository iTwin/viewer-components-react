/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import {
  ActionButton,
  CommonToolbarItem,
  ToolbarItemUtilities,
  ToolbarOrientation,
  ToolbarUsage,
} from "@bentley/ui-abstract";
import {
  MarkupTools,
  ToolbarComposer,
  ToolbarHelper,
  ToolItemDef,
  ToolWidgetComposer,
} from "@bentley/ui-framework";
import React from "react";

import styles from "./MarkupToolWidget.module.scss";
import { MarkupFrontstage } from "../../MarkupFrontstage";
import { MarkupFrontstageConstants } from "../../util/MarkupTypes";
/**
 * Markup tool widget props
 */
interface MarkupToolWidgetProps {
  closeMarkupFrontstageAsync: () => void;
  isEditable: boolean;
}

export class MarkupToolWidget extends React.Component<MarkupToolWidgetProps> {
  private _verticalItems: CommonToolbarItem[] = [
    ToolbarHelper.createToolbarItemFromItemDef(10, MarkupTools.selectToolDef),
    ToolbarItemUtilities.createGroupButton(
      MarkupFrontstageConstants.DRAWING_TOOLS,
      20,
      "icon-2d",
      MarkupFrontstage.translate("tools.label"),
      [
        ToolbarHelper.createToolbarItemFromItemDef(
          10,
          MarkupTools.lineToolDef,
          { id: "line-tool" }
        ) as ActionButton,
        ToolbarHelper.createToolbarItemFromItemDef(
          20,
          MarkupTools.rectangleToolDef,
          { id: "rectangle-tool" }
        ) as ActionButton,
        ToolbarHelper.createToolbarItemFromItemDef(
          30,
          MarkupTools.polygonToolDef
        ) as ActionButton,
        ToolbarHelper.createToolbarItemFromItemDef(
          40,
          MarkupTools.cloudToolDef
        ) as ActionButton,
        ToolbarHelper.createToolbarItemFromItemDef(
          50,
          MarkupTools.ellipseToolDef
        ) as ActionButton,
        ToolbarHelper.createToolbarItemFromItemDef(
          60,
          MarkupTools.arrowToolDef
        ) as ActionButton,
        ToolbarHelper.createToolbarItemFromItemDef(
          70,
          MarkupTools.sketchToolDef
        ) as ActionButton,
      ]
    ),
    ToolbarHelper.createToolbarItemFromItemDef(
      30,
      MarkupTools.placeTextToolDef
    ),
    ToolbarHelper.createToolbarItemFromItemDef(40, MarkupTools.distanceToolDef),
  ];

  /** Close Markup Frontstage tool def */
  private _closeMarkupToolDef = new ToolItemDef({
    toolId: "Markup.Close",
    iconSpec: "icon-close",
    label: () => MarkupFrontstage.translate("tools.close"),
    tooltip: () => MarkupFrontstage.translate("tools.close"),
    execute: async () => {
      this.props.closeMarkupFrontstageAsync();
    },
  });

  public render() {
    // adding following style because row-gap is added
    // in MainFrontstage.overrides.scss for identifier nz-vertical-toolbar
    const { isEditable } = this.props;
    return (
      <div data-testid="markup-tool-widget-container">
        <ToolWidgetComposer
          verticalToolbar={
            <ToolbarComposer
              items={
                isEditable
                  ? this._verticalItems
                  : [
                      ToolbarHelper.createToolbarItemFromItemDef(
                        10,
                        this._closeMarkupToolDef
                      ),
                    ]
              }
              usage={ToolbarUsage.ContentManipulation}
              orientation={ToolbarOrientation.Vertical}
            />
          }
          className={styles.verticalToolbar}
          data-testid={"markup-tool-widget"}
        />
      </div>
    );
  }
}
