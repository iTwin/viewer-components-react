/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useActiveIModelConnection } from "@itwin/appui-react";
import { FilteredType, VirtualizedPropertyGridWithDataProvider } from "@itwin/components-react";
import { Orientation, ResizableContainerObserver } from "@itwin/core-react";
import { toggleProjectExtents } from "@itwin/frontend-devtools";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { SimpleReadonlyPropertyDataProvider } from "./SimpleReadonlyPropertyDataProvider";
import { convertDDToDMS } from "./utils";

export const IModelGCS = () => {
  const [{ width, height }, setSize] = useState({ width: 0, height: 0 });
  const handleResize = useCallback((w: number, h: number) => {
    setSize({ width: w, height: h });
  }, []);

  const dataProvider = useMemo(() => new SimpleReadonlyPropertyDataProvider(), []);
  const iModelConnection = useActiveIModelConnection();

  useEffect(() => {
    return () => {
      if (iModelConnection) {
        toggleProjectExtents(iModelConnection, false);
      }
    };
  }, [iModelConnection]);

  useEffect(() => {
    if (iModelConnection) {
      const gcrs = iModelConnection.geographicCoordinateSystem;
      // console.log(gcrs);

      const formatLatLong = (dd: number | undefined, isLatitude: boolean) => {
        if (dd === undefined) {
          return "N/A";
        }
        return convertDDToDMS(dd, isLatitude);
      };

      // const toDoFiller = "Missing Data";
      const helmert = gcrs?.additionalTransform?.helmert2DWithZOffset;
      const coordinateSystem = {
        "Name": `${gcrs?.horizontalCRS?.id}${helmert ? " Helmert Transformation" : ""}`,
        "Description": gcrs?.horizontalCRS?.description,
        "Projection": gcrs?.horizontalCRS?.projection?.method,
        "EPSG Code": gcrs?.horizontalCRS?.epsg?.toString(),
        "Source": gcrs?.horizontalCRS?.source,
        "Units": gcrs?.horizontalCRS?.unit,
        "Central Meridian": gcrs?.horizontalCRS?.projection?.centralMeridian?.toString(),
        "Origin Latitude": formatLatLong(gcrs?.horizontalCRS?.projection?.latitudeOfOrigin, true),
        "Scale Reduction": gcrs?.horizontalCRS?.projection?.scaleFactor?.toString(),
        "False Easting": gcrs?.horizontalCRS?.projection?.falseEasting?.toString(),
        "False Northing": gcrs?.horizontalCRS?.projection?.falseNorthing?.toString(),
        // "Quadrant": toDoFiller,
        "Minimum Longitude": formatLatLong(gcrs?.horizontalCRS?.extent?.southWest.longitude, false),
        "Maximum Longitude": formatLatLong(gcrs?.horizontalCRS?.extent?.northEast.longitude, false),
        "Minimum Latitude": formatLatLong(gcrs?.horizontalCRS?.extent?.southWest.latitude, true),
        "Maximum Latitude": formatLatLong(gcrs?.horizontalCRS?.extent?.northEast.latitude, true),
      };

      // const directionKey = gcrs?.horizontalCRS?.datumId ? `Direction to ${gcrs?.horizontalCRS?.datumId}` : "Direction";
      const datum = {
        "Name": gcrs?.horizontalCRS?.datumId,
        "Description": gcrs?.horizontalCRS?.datum?.description,
        "Source": gcrs?.horizontalCRS?.datum?.source,
        "Conversion Method": gcrs?.horizontalCRS?.datum?.ellipsoidId,
        // "Format": toDoFiller,
        // [directionKey]: toDoFiller,
        // "Grid File Name": toDoFiller,
      };

      const ellipsoid = {
        "Name": gcrs?.horizontalCRS?.datum?.ellipsoidId,
        "Description": gcrs?.horizontalCRS?.datum?.ellipsoid?.description?.toString(),
        "Equatorial Radius": gcrs?.horizontalCRS?.datum?.ellipsoid?.equatorialRadius?.toString(),
        "Polar Radius": gcrs?.horizontalCRS?.datum?.ellipsoid?.polarRadius?.toString(),
        // "Eccentricity": toDoFiller,
        "Source": gcrs?.horizontalCRS?.datum?.ellipsoid?.source,
      };

      const coordinateSystemMods: Record<string, string | undefined> = {
        "Vertical Datum": gcrs?.verticalCRS?.id,
        "Local Transformation Type": gcrs?.horizontalCRS?.datum?.transforms?.at(0)?.method ?? "No Transform",
      };

      if (helmert) {
        coordinateSystemMods["Local Transformation Type"] = "Helmert Transform";
        const radians = helmert.rotDeg * (Math.PI / 180);
        coordinateSystemMods["Helmert A"] = Math.cos(radians).toString();
        coordinateSystemMods["Helmert B"] = Math.sin(radians).toString();
        coordinateSystemMods["Offset X"] = helmert.translationX.toString();
        coordinateSystemMods["Offset Y"] = helmert.translationY.toString();
        coordinateSystemMods["Offset Z"] = helmert.translationZ.toString();
      }
      dataProvider.addPropertyRecords(coordinateSystem, "Coordinate System");
      dataProvider.addPropertyRecords(datum, "Datum");
      dataProvider.addPropertyRecords(ellipsoid, "Ellipsoid");
      dataProvider.addPropertyRecords(coordinateSystemMods, "Coordinate System Modifiers");
    }
  }, [iModelConnection, dataProvider]);

  return (
    <div className="itwin-gcrs-property-grid">
      {iModelConnection && (
        <ResizableContainerObserver onResize={handleResize}>
          <VirtualizedPropertyGridWithDataProvider
            dataProvider={dataProvider}
            orientation={Orientation.Horizontal}
            height={height}
            width={width}
            highlight={{
              highlightedText: "N/A",
              filteredTypes: [FilteredType.Label, FilteredType.Value],
            }}
          />
        </ResizableContainerObserver>
      )}
    </div>
  );
};
