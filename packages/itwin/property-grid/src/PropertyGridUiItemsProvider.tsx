/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./PropertyGridUiItemsProvider.scss";
import { useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { StagePanelLocation, StagePanelSection, StageUsage, useSpecificWidgetDef, WidgetState } from "@itwin/appui-react";
import { Id64 } from "@itwin/core-bentley";
import { SvgInfoCircular } from "@itwin/itwinui-icons-react";
import { SvgError } from "@itwin/itwinui-illustrations-react";
import { Button, NonIdealState } from "@itwin/itwinui-react";
import { Key } from "@itwin/presentation-common";
import { Presentation, SelectionChangeType } from "@itwin/presentation-frontend";
import { usePropertyGridTransientState } from "./hooks/UsePropertyGridTransientState";
import { PropertyGridComponent } from "./PropertyGridComponent";
import { PropertyGridManager } from "./PropertyGridManager";

import type { FallbackProps } from "react-error-boundary";
import type { UiItemsProvider, Widget } from "@itwin/appui-react";
import type { PropertyGridComponentProps } from "./PropertyGridComponent";

/**
 * Id of the property grid widget created by `PropertyGridUiItemsProvider`.
 * @public
 */
export const PropertyGridWidgetId = "vcr:PropertyGridComponent";

/**
 * Props for creating `PropertyGridUiItemsProvider`.
 * @public
 */
export interface PropertyGridUiItemsProviderProps {
  /** The stage panel to place the widget in. Defaults to `StagePanelLocation.Right`. */
  defaultPanelLocation?: StagePanelLocation;
  /** The stage panel section to place the widget in. Defaults to `StagePanelSection.End`. */
  defaultPanelSection?: StagePanelSection;
  /** Widget priority in the stage panel. */
  defaultPanelWidgetPriority?: number;
  /** Props for configuring `PropertyGridComponent` shown in the widget. */
  propertyGridProps?: PropertyGridComponentProps;
}

/**
 * A `UiItemsProvider` implementation that provides a `PropertyGridComponent` into a stage panel.
 * @public
 */
export class PropertyGridUiItemsProvider implements UiItemsProvider {
  public readonly id = "PropertyGridUiItemsProvider";

  constructor(private _props: PropertyGridUiItemsProviderProps = {}) {}

  public provideWidgets(_stageId: string, stageUsage: string, location: StagePanelLocation, section?: StagePanelSection): ReadonlyArray<Widget> {
    const { defaultPanelLocation, defaultPanelSection, defaultPanelWidgetPriority, propertyGridProps } = this._props;

    const preferredLocation = defaultPanelLocation ?? StagePanelLocation.Right;
    const preferredPanelSection = defaultPanelSection ?? StagePanelSection.End;
    if (stageUsage !== StageUsage.General || location !== preferredLocation || section !== preferredPanelSection) {
      return [];
    }

    return [
      {
        id: PropertyGridWidgetId,
        label: PropertyGridManager.translate("widget-label"),
        content: <PropertyGridWidget {...propertyGridProps} />,
        defaultState: WidgetState.Hidden,
        icon: <SvgInfoCircular />,
        priority: defaultPanelWidgetPriority,
      },
    ];
  }
}

/** Component that renders `PropertyGridComponent` an hides/shows widget based on `UnifiedSelection`. */
function PropertyGridWidget(props: PropertyGridComponentProps) {
  const ref = usePropertyGridTransientState<HTMLDivElement>();
  const widgetDef = useSpecificWidgetDef(PropertyGridWidgetId);

  useEffect(() => {
    if (!widgetDef) {
      return;
    }

    return Presentation.selection.selectionChange.addListener((args) => {
      const selection = Presentation.selection.getSelection(args.imodel);
      // hide grid widget if there are no nodes or valid instances selected.
      const hasSelectedElements = selection.nodeKeysCount !== 0 || selection.some((key) => Key.isInstanceKey(key) && !Id64.isTransient(key.id));

      if (!hasSelectedElements) {
        widgetDef.setWidgetState(WidgetState.Hidden);
        return;
      }

      if (widgetDef.state === WidgetState.Hidden || args.changeType === SelectionChangeType.Replace) {
        widgetDef.setWidgetState(WidgetState.Open);
      }
    });
  }, [widgetDef]);

  return (
    <div ref={ref} className="property-grid-widget">
      <ErrorBoundary FallbackComponent={ErrorState}>
        <PropertyGridComponent {...props} />
      </ErrorBoundary>
    </div>
  );
}

function ErrorState({ resetErrorBoundary }: FallbackProps) {
  return (
    <NonIdealState
      svg={<SvgError />}
      heading={PropertyGridManager.translate("error")}
      description={PropertyGridManager.translate("generic-error-description")}
      actions={
        <Button styleType={"high-visibility"} onClick={resetErrorBoundary}>
          {PropertyGridManager.translate("retry")}
        </Button>
      }
    />
  );
}
