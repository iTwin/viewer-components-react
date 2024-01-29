/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useTransientState } from "@itwin/appui-react";
import { useVirtualizedPropertyGridLayoutStorage } from "@itwin/components-react";

// istanbul ignore file

/**
 * Allows to persist property grid scroll position when it is used in `@itwin/appui-react` Widgets.
 * Returned `ref` should be passed to container element containing property grid component.
 *
 * Example:
 * ```typescript
 * function PropertyGridWidget() {
 *   const ref = usePropertyGridTransientState<HTMLDivElement>();
 *   return <div ref={ref}>
 *     <PropertyGrid />
 *   </div>
 * }
 * ```
 *
 * @public
 */
export function usePropertyGridTransientState<T extends Element>() {
  const { ref, persist, restore } = useVirtualizedPropertyGridLayoutStorage<T>();
  useTransientState(persist, restore);
  return ref;
}
