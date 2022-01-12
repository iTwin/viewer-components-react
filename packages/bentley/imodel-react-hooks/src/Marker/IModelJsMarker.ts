/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/


import { Point2d } from "@bentley/geometry-core";
import { ColorDef } from "@bentley/imodeljs-common";
import { Marker } from "@bentley/imodeljs-frontend";

import { UseMarkerOptions } from "./useMarker";

/** mapping from protected interface implemented by derived Marker types to public hook interface*/
const hookChangedInterfaceMapping = {
  _isHilited: "isHilited",
  _hiliteColor: "hiliteColor",
} as const;

type NonNullOptionsRef = React.RefObject<UseMarkerOptions> & {
  current: UseMarkerOptions;
};

export class IModelJsMarker extends Marker {
  constructor(options: NonNullOptionsRef) {
    const size = options.current.size
      ? Array.isArray(options.current.size)
        ? { x: options.current.size[0], y: options.current.size[1] }
        : options.current.size
      : Point2d.create(0, 0);

    super(options.current.worldLocation, size);

    // translates hook's different api to underlying object
    return new Proxy<IModelJsMarker>(this, {
      set: (target, prop: keyof Marker, value: any, _receiver): boolean => {
        if (prop in hookChangedInterfaceMapping) {
          const actualProp = hookChangedInterfaceMapping[
            prop as keyof typeof hookChangedInterfaceMapping
          ] as keyof UseMarkerOptions;
          return Reflect.set(options.current, actualProp, value, _receiver);
        } else if (prop in options.current) {
          return Reflect.set(options.current, prop, value, _receiver);
        } else {
          return Reflect.set(target, prop, value, _receiver);
        }
      },
      get: (target, prop: keyof Marker, _reciever) => {
        // NOTE: need to better separate whether an image or imageUrl is set in the hook options
        if (prop in hookChangedInterfaceMapping) {
          const actualProp =
            hookChangedInterfaceMapping[
              prop as keyof typeof hookChangedInterfaceMapping
            ];
          return options.current[actualProp];
        } else if (prop in options.current) {
          return options.current[prop];
        } else {
          return target[prop];
        }
      },
    });
  }

  setIsHilited(newVal = false) {
    this._isHilited = newVal;
  }

  setHiliteColor(newColor: ColorDef) {
    this._hiliteColor = newColor;
  }
}
