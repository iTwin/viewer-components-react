/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { UseMarkerOptions } from "./useMarker";
import { useMarker } from "./useMarker";

// NOTE: if useMarker starts returning the marker instance (e.g. for eventual clustering impl)
// the equivalent for the Marker component should be a ref which we can do with useImperativeHandle

/** component version of useMarker. Takes the options of useMarker as props.
 * Very useful when you want a component to control
 * a dynamic amount of markers, since you can't have a dynamic amount of hooks but can
 * have a dynamic amount of components.
 */
export const Marker = <T extends {} = {}>(props: UseMarkerOptions<T>) => {
  useMarker<T>(props);
  return null;
};

export default Marker;
