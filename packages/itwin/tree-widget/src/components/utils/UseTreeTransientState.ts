/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useTransientState } from "@itwin/appui-react";
import { useControlledTreeLayoutStorage } from "@itwin/components-react";

// istanbul ignore file

/**
 * Allows to persist tree scroll position when tree is used in `@itwin/appui-react` Widgets.
 * Returned `ref` should be passed to container element containing tree component.
 *
 * Example:
 * ```typescript
 * function ModelsTreeWidget() {
 *   const ref = useTreeTransientState<HTMLDivElement>();
 *   return <div ref={ref}>
 *     <ModelsTree />
 *   </div>
 * }
 * ```
 *
 * @internal
 */
export function useTreeTransientState<T extends Element>() {
  const { ref, persist, restore } = useControlledTreeLayoutStorage<T>();
  useTransientState(persist, restore);
  return ref;
}
