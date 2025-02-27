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
import { KeySet } from "@itwin/presentation-common";
import { Selectable, Selectables } from "@itwin/unified-selection";
import { usePropertyGridTransientState } from "./hooks/UsePropertyGridTransientState.js";
import { createKeysFromSelectable, useSelectionHandler } from "./hooks/UseUnifiedSelectionHandler.js";
import { PropertyGridComponent } from "./PropertyGridComponent.js";
import { PropertyGridManager } from "./PropertyGridManager.js";

import type { SelectionStorage } from "./hooks/UseUnifiedSelectionHandler.js";
import type { FallbackProps } from "react-error-boundary";
import type { UiItemsProvider, Widget } from "@itwin/appui-react";
import type { PropertyGridComponentProps } from "./PropertyGridComponent.js";

/**
 * Creates a property grid definition that should be returned from `UiItemsProvider.getWidgets()`.
 * @public
 */
export function createPropertyGrid(propertyGridProps: PropertyGridWidgetProps): Widget {
  return {
    id: propertyGridProps.widgetId ?? PropertyGridWidgetId,
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
 * Default id for the property grid widget created by `createPropertyGrid`, if a custom on
 * is not supplied through `widgetId` prop.
 *
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
 * Props for `createPropertyGrid`.
 * @public
 */
export type PropertyGridWidgetProps = PropertyGridComponentProps & {
  /**
   * A custom id to use for the created widget. Should be supplied when creating multiple property grid widgets to
   * make sure they don't conflict with each other in AppUI system.
   *
   * Defaults to `PropertyGridWidgetId`.
   */
  widgetId?: string;
} & (
    | {
        /**
         * Predicate indicating if the widget should be shown for the current selection set.
         * @deprecated in 1.16. Use the overload taking `Selectables` instead.
         */
        shouldShow?: (selection: Readonly<KeySet>) => boolean;
        selectionStorage?: never;
      }
    | {
        /** Predicate indicating if the widget should be shown for the current selection set. */
        shouldShow?: (selection: Selectables) => Promise<boolean>;

        /**
         * Unified selection storage to use for listening and getting active selection.
         *
         * When not specified, the deprecated `SelectionManager` from `@itwin/presentation-frontend` package
         * is used.
         */
        selectionStorage: SelectionStorage;
      }
  );

/** Component that renders `PropertyGridComponent` an hides/shows widget based on `UnifiedSelection`. */
// eslint-disable-next-line deprecation/deprecation
function PropertyGridWidget({ shouldShow, widgetId, ...props }: PropertyGridWidgetProps) {
  const ref = usePropertyGridTransientState<HTMLDivElement>();
  const widgetDef = useSpecificWidgetDef(widgetId ?? PropertyGridWidgetId);
  const selectionStorage = props.selectionStorage;
  const { selectionChange } = useSelectionHandler({ selectionStorage });

  useEffect(() => {
    /* c8 ignore next 3 */
    if (!widgetDef) {
      return;
    }

    let isDisposed = false;
    const predicate = shouldShow
      ? selectionStorage
        ? // if selection storage is provided, `shouldShow` takes `Selectables` as an argument
          (shouldShow as (selection: Selectables) => Promise<boolean>)
        : // else, it takes a `KeySet`, so we have to do the conversion
          async (selectables: Selectables) => (shouldShow as (selection: Readonly<KeySet>) => boolean)(await createKeySetFromSelectables(selectables))
      : // finally, if `shouldShow` is not provided, we default to showing the widget if there are any non-transient instances selected
        defaultWidgetShowPredicate;

    const unregisterListener = selectionChange.addListener(async (args) => {
      const predicateResult = await predicate(args.getSelection());

      /* c8 ignore next 3 */
      if (isDisposed) {
        return;
      }

      if (!predicateResult) {
        widgetDef.setWidgetState(WidgetState.Hidden);
      } else if (widgetDef.state === WidgetState.Hidden) {
        widgetDef.setWidgetState(WidgetState.Open);
      }
    });

    return () => {
      unregisterListener();
      isDisposed = true;
    };
  }, [shouldShow, widgetDef, selectionChange, selectionStorage]);

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

function defaultWidgetShowPredicate(selectables: Selectables) {
  if (selectables.custom.size > 0) {
    return true;
  }
  return Selectables.some(selectables, (s) => Selectable.isInstanceKey(s) && !Id64.isTransient(s.id));
}

async function createKeySetFromSelectables(selectables: Selectables) {
  const keys = new KeySet();
  for (const [className, ids] of selectables.instanceKeys) {
    for (const id of ids) {
      keys.add({ id, className });
    }
  }
  for (const [_, selectable] of selectables.custom) {
    keys.add(await createKeysFromSelectable(selectable));
  }
  return keys;
}
