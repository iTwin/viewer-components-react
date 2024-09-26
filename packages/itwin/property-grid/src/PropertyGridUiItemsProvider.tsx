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
import { Presentation } from "@itwin/presentation-frontend";
import { usePropertyGridTransientState } from "./hooks/UsePropertyGridTransientState";
import { PropertyGridComponent } from "./PropertyGridComponent";
import { PropertyGridManager } from "./PropertyGridManager";

import type { KeySet } from "@itwin/presentation-common";
import type { FallbackProps } from "react-error-boundary";
import type { UiItemsProvider, Widget } from "@itwin/appui-react";
import type { PropertyGridComponentProps } from "./PropertyGridComponent";

/**
* Creates a property grid definition that should be returned from `UiItemsProvider.getWidgets()`.
* @public
*/
export function createPropertyGrid(propertyGridProps: PropertyGridWidgetProps): Widget {
  return {
    id: "vcr:PropertyGridComponent",
    label: PropertyGridManager.translate("widget-label"),
    icon: <SvgInfoCircular />,
    defaultState: WidgetState.Hidden,
    layouts: {
      standard: {
        section: StagePanelSection.End,
        location: StagePanelLocation.Right,
      },
    },
    content: <PropertyGridWidget {...propertyGridProps} />,
  };
}

/**
 * Id of the property grid widget created by `createPropertyGrid`.
 * @public
 */
export const PropertyGridWidgetId = "vcr:PropertyGridComponent";

/**
 * Props for creating `PropertyGridUiItemsProvider`.
 * @public
 * @deprecated in 1.13.0. Use `createPropertyGrid` instead.
 */
export interface PropertyGridUiItemsProviderProps {
  /** The stage panel to place the widget in. Defaults to `StagePanelLocation.Right`. */
  defaultPanelLocation?: StagePanelLocation;
  /** The stage panel section to place the widget in. Defaults to `StagePanelSection.End`. */
  defaultPanelSection?: StagePanelSection;
  /** Widget priority in the stage panel. */
  defaultPanelWidgetPriority?: number;
  /** Props for configuring `PropertyGridComponent` shown in the widget. */
  propertyGridProps?: PropertyGridWidgetProps;
}

/**
 * A `UiItemsProvider` implementation that provides a `PropertyGridComponent` into a stage panel.
 * @public
 * @deprecated in 1.13.0. Use `createPropertyGrid` instead.
 */
export class PropertyGridUiItemsProvider implements UiItemsProvider {
  public readonly id = "PropertyGridUiItemsProvider";

  // eslint-disable-next-line deprecation/deprecation
  constructor(private _props: PropertyGridUiItemsProviderProps = {}) {}

  public provideWidgets(_stageId: string, stageUsage: string, location: StagePanelLocation, section?: StagePanelSection): ReadonlyArray<Widget> {
    const { defaultPanelLocation, defaultPanelSection, defaultPanelWidgetPriority, propertyGridProps } = this._props;

    const preferredLocation = defaultPanelLocation ?? StagePanelLocation.Right;
    const preferredPanelSection = defaultPanelSection ?? StagePanelSection.End;
    if (stageUsage !== StageUsage.General.valueOf() || location !== preferredLocation || section !== preferredPanelSection) {
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

/**
 * Props for creating `PropertyGridWidget`.
 * @public
 */
export interface PropertyGridWidgetProps extends PropertyGridComponentProps {
  /** Predicate indicating if the widget should be shown for the current selection set. */
  shouldShow?: (selection: Readonly<KeySet>) => boolean
}

/** Component that renders `PropertyGridComponent` an hides/shows widget based on `UnifiedSelection`. */
function PropertyGridWidget({ shouldShow, ...props }: PropertyGridWidgetProps) {
  const ref = usePropertyGridTransientState<HTMLDivElement>();
  const widgetDef = useSpecificWidgetDef(PropertyGridWidgetId);

  useEffect(() => {
    if (!widgetDef) {
      return;
    }

    return Presentation.selection.selectionChange.addListener((args) => {
      const selection = Presentation.selection.getSelection(args.imodel);

      const predicate = shouldShow
        ? shouldShow
        : // Default behavior:  hide grid widget if there are no nodes or valid instances selected.
          (keys: Readonly<KeySet>) => keys.nodeKeysCount !== 0 || keys.some((key) => Key.isInstanceKey(key) && !Id64.isTransient(key.id));

      if (!predicate(selection)) {
        widgetDef.setWidgetState(WidgetState.Hidden);
        return;
      }

      if (widgetDef.state === WidgetState.Hidden) {
        widgetDef.setWidgetState(WidgetState.Open);
      }
    });
  }, [shouldShow, widgetDef]);

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
