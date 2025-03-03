/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { ReactNode } from "react";
import { useMemo } from "react";

import type { IPresentationPropertyDataProvider } from "@itwin/presentation-components";
import type { ActionButtonRendererProps } from "@itwin/components-react";

/** @public */
interface PropertyGridActionButtonRendererProps extends ActionButtonRendererProps {
  /** Data provider used by the property grid. */
  dataProvider: IPresentationPropertyDataProvider;
}

/**
 * Action button with extended properties
 * @public
 */
export type PropertyGridActionButtonRenderer = (props: PropertyGridActionButtonRendererProps) => ReactNode;

interface UseActionButtonsProps {
  actionButtonRenderers?: Array<PropertyGridActionButtonRenderer>;
  dataProvider: IPresentationPropertyDataProvider;
}

/**
 * Custom hook for getting action buttons with extended properties.
 * @internal
 */
export function useActionButtons({ dataProvider, actionButtonRenderers }: UseActionButtonsProps) {
  return useMemo(() => {
    return actionButtonRenderers?.map(
      (item) =>
        ({ property, isPropertyHovered }: ActionButtonRendererProps) =>
          item({
            dataProvider,
            property,
            isPropertyHovered,
          }),
    );
  }, [dataProvider, actionButtonRenderers]);
}
