/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./PropertyGridUiItemsProvider.scss";

import { useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { StagePanelLocation, StagePanelSection, useActiveIModelConnection, useSpecificWidgetDef, WidgetState } from "@itwin/appui-react";
import { Id64 } from "@itwin/core-bentley";
import { SvgInfoCircular } from "@itwin/itwinui-icons-react";
import { SvgError } from "@itwin/itwinui-illustrations-react";
import { Button, NonIdealState } from "@itwin/itwinui-react";
import { createIModelKey } from "@itwin/presentation-core-interop";
import { Selectable, Selectables } from "@itwin/unified-selection";
import { usePropertyGridTransientState } from "./hooks/UsePropertyGridTransientState.js";
import { PropertyGridComponent } from "./PropertyGridComponent.js";
import { PropertyGridManager } from "./PropertyGridManager.js";

import type { ReactNode } from "react";
import type { FallbackProps } from "react-error-boundary";
import type { Widget, WidgetDef } from "@itwin/appui-react";
import type { SelectionStorage } from "@itwin/unified-selection";
import type { PropertyGridComponentProps } from "./PropertyGridComponent.js";

/**
 * Creates a property grid definition that should be returned from `UiItemsProvider.getWidgets()`.
 * @public
 */
export function createPropertyGrid(propertyGridProps: PropertyGridWidgetProps): Widget {
  const { widgetId: widgetIdProp, selectionStorage, shouldShow, ...propertyGridComponentProps } = propertyGridProps;
  const widgetId = widgetIdProp ?? PropertyGridWidgetId;
  const widgetProps = {
    widgetId,
    selectionStorage,
    shouldShow,
    propertyGridComponent: <PropertyGridComponent {...propertyGridComponentProps} selectionStorage={selectionStorage} />,
  } as PropertyWidgetInternalProps;
  return {
    id: widgetId,
    label: PropertyGridManager.translate("widget-label"),
    icon: <SvgInfoCircular />,
    defaultState: WidgetState.Hidden,
    layouts: {
      standard: {
        section: StagePanelSection.End,
        location: StagePanelLocation.Right,
      },
    },
    content: <PropertyGridWidget {...widgetProps} />,
  };
}

/**
 * Default id for the property grid widget created by `createPropertyGrid`, if a custom on
 * is not supplied through `widgetId` prop.
 *
 * @public
 */
export const PropertyGridWidgetId = "vcr:PropertyGridComponent";

/** @public */
interface PropertyGridWidgetOwnProps {
  /**
   * A custom id to use for the created widget. Should be supplied when creating multiple property grid widgets to
   * make sure they don't conflict with each other in AppUI system.
   *
   * Defaults to `PropertyGridWidgetId`.
   */
  widgetId?: string;
  /** Predicate indicating if the widget should be shown for the current selection set. */
  shouldShow?: (selection: Selectables) => Promise<boolean>;

  /**
   * Unified selection storage to use for listening and getting active selection.
   */
  selectionStorage: SelectionStorage;
}

/**
 * Props for `createPropertyGrid`.
 * @public
 */
export type PropertyGridWidgetProps = PropertyGridComponentProps & PropertyGridWidgetOwnProps;

/** @internal */
type PropertyWidgetInternalProps = PropertyGridWidgetOwnProps & {
  propertyGridComponent: ReactNode;
  widgetId: string;
  widgetDef?: WidgetDef;
};

/**
 * Component that renders given `propertyGridComponent` an hides/shows widget based on unified selection.
 * @internal
 */
export function PropertyGridWidget({
  widgetId,
  widgetDef: widgetDefOverride,

  shouldShow,
  selectionStorage,
  propertyGridComponent,
}: PropertyWidgetInternalProps) {
  const ref = usePropertyGridTransientState<HTMLDivElement>();
  const appuiWidgetDef = useSpecificWidgetDef(widgetId);
  const widgetDef = widgetDefOverride ?? appuiWidgetDef;
  const imodel = useActiveIModelConnection();

  useEffect(() => {
    /* c8 ignore next 3 */
    if (!widgetDef || !imodel) {
      return;
    }

    let isDisposed = false;
    const predicate = shouldShow ?? defaultWidgetShowPredicate;

    const toggleWidget = async (selectables: Selectables) => {
      const predicateResult = await predicate(selectables);

      /* c8 ignore next 3 */
      if (isDisposed) {
        return;
      }

      if (!predicateResult) {
        widgetDef.setWidgetState(WidgetState.Hidden);
      } else if (widgetDef.state === WidgetState.Hidden) {
        widgetDef.setWidgetState(WidgetState.Open);
      }
    };

    const unregisterListener = selectionStorage.selectionChangeEvent.addListener(async (args) => {
      if (args.imodelKey !== createIModelKey(imodel)) {
        return;
      }
      await toggleWidget(selectionStorage.getSelection({ imodelKey: createIModelKey(imodel), level: 0 }));
    });

    void toggleWidget(selectionStorage.getSelection({ imodelKey: createIModelKey(imodel), level: 0 }));

    return () => {
      unregisterListener();
      isDisposed = true;
    };
  }, [shouldShow, widgetDef, selectionStorage, imodel]);

  return (
    <div ref={ref} className="property-grid-widget">
      <ErrorBoundary FallbackComponent={ErrorState}>{propertyGridComponent}</ErrorBoundary>
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

function defaultWidgetShowPredicate(selectables: Selectables) {
  if (selectables.custom.size > 0) {
    return true;
  }
  return Selectables.some(selectables, (s) => Selectable.isInstanceKey(s) && !Id64.isTransient(s.id));
}
