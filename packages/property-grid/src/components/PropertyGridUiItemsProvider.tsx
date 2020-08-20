import { connect } from "react-redux";

import { I18N } from "@bentley/imodeljs-i18n";
import {
  AbstractWidgetProps,
  StagePanelLocation,
  StagePanelSection,
  UiItemsProvider,
} from "@bentley/ui-abstract";
import { FrameworkState } from "@bentley/ui-framework";
import { PropertyGrid, PropertyGridProps } from "./PropertyGrid";
import * as React from "react";

// Map framework state to property grid props
const mapStateToProps = (state: FrameworkState): PropertyGridProps => {
  return {
    iModelConnection: state.sessionState.iModelConnection,
    projectId: state.sessionState.iModelConnection.iModelToken.contextId,
  };
};

// tslint:disable-next-line: variable-name
const ConnectedPropertyGrid = connect(mapStateToProps)(PropertyGrid);

/** Provides the property grid widget to zone 9 */
export class PropertyGridUiItemsProvider implements UiItemsProvider {
  public readonly id = "PropertyGridUiitemsProvider";
  public static i18n: I18N;

  public provideWidgets(
    _stageId: string,
    _stageUsage: string,
    location: StagePanelLocation,
    _section: StagePanelSection | undefined,
  ): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];
    if (location === StagePanelLocation.Right) {
      widgets.push({
        id: "propertyGrid",
        getWidgetContent: () => <ConnectedPropertyGrid />,
      });
    }

    return widgets;
  }
}
