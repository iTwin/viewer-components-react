/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Range1dProps, WritableXAndY } from "@itwin/core-geometry";
import { Point2d } from "@itwin/core-geometry";
import type { ColorDef } from "@itwin/core-common";
import type { MarkerImage } from "@itwin/core-frontend";
import { Marker } from "@itwin/core-frontend";
import type React from "react";
import { useContext, useEffect, useMemo, useRef } from "react";
import ReactDOM from "react-dom";

import { MarkerDecorationContext } from "../IModelJsViewProvider";
import type { Rebind } from "../utils/types";
import { useOnMountInRenderOrder } from "../utils/basic-hooks";

export class IModelJsMarker extends Marker {
  setIsHilited(newVal = false) {
    this._isHilited = newVal;
  }
  setHiliteColor(newColor: ColorDef) {
    this._hiliteColor = newColor;
  }
}

type MakeRequired<T, K extends keyof T> = Partial<Omit<T, K>> & Pick<T, K>;

/** All fields of the Marker class from iModel.js are optional except for worldLocation
 * which is required to render the Marker.
 * Protected fields are exposed as optional public fields here
 */
export type UseMarkerOptions<T extends {} = {}> = Omit<
MakeRequired<Rebind<Marker, Marker & T>, "worldLocation">,
| "_scaleFactor"
| "_scaleFactorRange"
| "_isHilited"
| "_hiliteColor"
| "image"
| "size"
| "imageSize"
| "imageOffset"
> & {
  /** Establish a range of scale factors to increases and decrease the size of this Marker based on its distance from the camera.
   * @param range The minimum and maximum scale factors to be applied to the size of this Marker based on its distance from the camera. `range.Low` is the scale factor
   * for Markers at the back of the view frustum and `range.high` is the scale factor at the front of the view frustum.
   * @note Marker size scaling is only applied in views with the camera enabled. It has no effect on orthographic views.
   */
  scaleFactor?: Range1dProps;
  /** Whether this marker is currently highlighted or not. */
  isHilited?: boolean;
  /** The color for the shadowBlur when this Marker is hilited */
  hiliteColor?: ColorDef;
  /** the [promised] image  */
  image?: MarkerImage | Promise<MarkerImage> | string;
  /** The size of this Marker, in pixels. Can pass [x,y] or {x, y} if desired */
  size?: [number, number] | WritableXAndY | Point2d;
  /** The size of [[image]], in pixels. If undefined, use [[size]]. Can pass [x,y] or {x, y} if desired */
  imageSize?: [number, number] | WritableXAndY | Point2d;
  /** The offset for [[label]], in pixels, from the *center* of this Marker. If undefined, (0,0). Can pass [x,y] or {x,y} if desired. */
  imageOffset?: [number, number] | WritableXAndY | Point2d;
  /** like htmlElement, but jsxElement renders a jsx node literal into a root element
   * so you can use react instead of constructing your own html element.
   */
  jsxElement?: React.ReactElement;
};

export const useMarker = <T extends {} = {}>(options: UseMarkerOptions<T>) => {
  const size = options.size
    ? Point2d.fromJSON(options.size)
    : Point2d.create(0, 0);
  const imageSize = Point2d.fromJSON(options.imageSize ?? size);
  const imageOffset = options.imageOffset
    ? Point2d.fromJSON(options.imageOffset)
    : Point2d.create(0, 0);

  const firstCallOptionKeys = useMemo(() => Object.keys(options), []);
  const optionKeys = useMemo(() => Object.keys(options), [options]);
  const raiseIllegalOptionChange = () => {
    throw Error(
      "Options passed to useMarker must stable.\n" +
        "Pass undefined if necessary, but make sure you're always " +
        "passing the same options each call in the same order."
    );
  };
  if (firstCallOptionKeys.length !== optionKeys.length) {
    raiseIllegalOptionChange();
  }
  for (let i = 0; i < firstCallOptionKeys.length; i++) {
    if (firstCallOptionKeys[i] !== optionKeys[i]) {
      raiseIllegalOptionChange();
    }
  }

  /** to prevent wasteful rerendering caused by consumers using
   * object and array literals, memoization is done specially, or unnecessary
   * view invalidations would be made.
   */
  const {
    // these removed properties are the whitelist of custom-memoized items
    worldLocation,
    size: _size,
    imageSize: _imageSize,
    imageOffset: _imageOffset,
    jsxElement,
    ...normallyMemoizedOptionValues
  } = options;

  const optionsToInvalidateOnChanges = [
    ...Object.values(normallyMemoizedOptionValues),
    worldLocation.x,
    worldLocation.y,
    worldLocation.z,
    size.x,
    size.y,
    imageSize.x,
    imageSize.y,
    imageOffset.x,
    imageOffset.y,
  ];

  const marker = useMemo(
    () => new IModelJsMarker(options.worldLocation, size),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    const {
      scaleFactor,
      isHilited,
      hiliteColor,
      image,
      jsxElement,
      worldLocation,
      size,
      ...directlyMappedOptions
    } = options;

    Object.assign(marker, directlyMappedOptions);
  });

  useEffect(() => {
    if (!marker.size.isExactEqual(size)) {
      marker.size = size;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.x, size.y]);

  useEffect(() => {
    if (!marker.worldLocation.isExactEqual(worldLocation)) {
      marker.worldLocation = worldLocation;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldLocation.x, worldLocation.y, worldLocation.z]);

  const {
    register: addMarker,
    unregister: removeMarker,
    enqueueViewInvalidation,
    refreshPosition,
  } = useContext(MarkerDecorationContext);

  refreshPosition(marker);

  useOnMountInRenderOrder(() => {
    addMarker(marker);
    return () => removeMarker(marker);
  });

  useEffect(() => {
    if (typeof options.image === "string") {
      marker.setImageUrl(options.image);
    } else {
      const setNewImage = async (image: MarkerImage | Promise<MarkerImage>) => {
        const imageResult = await image;
        if (imageResult) {
          marker.setImage(imageResult);
          enqueueViewInvalidation();
        }
      };
      if (options.image) {
        setNewImage(options.image).catch((err) =>
          console.error("setting a marker image failed", err)
        );
      }
    }
  }, [marker, enqueueViewInvalidation, options.image]);

  useEffect(() => {
    marker.setIsHilited(options.isHilited);
  }, [marker, options.isHilited]);

  useEffect(() => {
    if (options.hiliteColor) {
      marker.setHiliteColor(options.hiliteColor);
    }
  }, [marker, options.hiliteColor]);

  useEffect(() => {
    if (options.scaleFactor) {
      marker.setScaleFactor(options.scaleFactor);
    }
  }, [marker, options.scaleFactor]);

  const htmlElementRef = useRef(document.createElement("div"));

  useEffect(() => {
    if (options.jsxElement) {
      ReactDOM.render(options.jsxElement, htmlElementRef.current);
      marker.htmlElement = htmlElementRef.current;
    } else {
      delete marker.htmlElement;
    }
  }, [marker.htmlElement, options.jsxElement]);

  // invalidate view synchronously on option changes
  useEffect(() => {
    setTimeout(enqueueViewInvalidation);
  }, [enqueueViewInvalidation, ...optionsToInvalidateOnChanges]);
};

export default useMarker;
