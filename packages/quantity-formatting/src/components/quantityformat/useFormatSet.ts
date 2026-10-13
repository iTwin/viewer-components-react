/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";

import type { FormatsProvider } from "@itwin/core-quantity";
import type { FormatSet } from "@itwin/ecschema-metadata";

function copyFormatSet(formatSet: FormatSet | undefined): FormatSet | undefined {
  return formatSet && { ...formatSet, formats: { ...formatSet.formats } };
}

/**
 * Returns a copy of `formatSet` that is replaced whenever `formatsProvider` raises `onFormatsChanged`, for passing to
 * [[FormatSelector]] as `activeFormatSet`.
 *
 * The hook only copies `formatSet` when the event fires; it cannot read formats from the provider. Pass the same
 * object the provider was created with, because `FormatSetFormatsProvider` updates that object in place. If you pass
 * any other object, such as a copy, the hook re-renders on each change but keeps returning the old formats.
 * @beta
 */
export function useFormatSet(formatSet: FormatSet | undefined, formatsProvider: FormatsProvider | undefined): FormatSet | undefined {
  const cache = React.useRef<{ source: FormatSet | undefined; copy: FormatSet | undefined } | undefined>(undefined);

  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      if (!formatsProvider) return () => undefined;
      return formatsProvider.onFormatsChanged.addListener(() => {
        cache.current = undefined;
        onStoreChange();
      });
    },
    [formatsProvider]
  );

  const getSnapshot = () => {
    if (!cache.current || cache.current.source !== formatSet) cache.current = { source: formatSet, copy: copyFormatSet(formatSet) };
    return cache.current.copy;
  };

  return React.useSyncExternalStore(subscribe, getSnapshot);
}
