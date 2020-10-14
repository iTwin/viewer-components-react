/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Point3d } from "@bentley/geometry-core";
import { Viewport } from "@bentley/imodeljs-frontend";
import { render } from "@testing-library/react";
import React, { useContext } from "react";

import {
  IModelJsViewProvider,
  MarkerDecoration,
  MarkerDecorationContext,
} from "../IModelJsViewProvider";
import { IModelJsMarker, useMarker } from "./useMarker";

jest.mock("@bentley/bentleyjs-core");

jest.mock("@bentley/imodeljs-frontend", () => {
  const actual = jest.requireActual("@bentley/imodeljs-frontend");
  return {
    ...actual,
    IModelApp: {
      viewManager: {
        __vp: {},
        addDecorator: jest.fn(),
        forEachViewport(func: (vp: Viewport) => void) {
          func((this.__vp as any) as Viewport);
        },
        invalidateViewportScenes: jest.fn(),
        onViewOpen: {
          addListener: jest.fn(),
        },
        invalidateDecorationsAllViews: jest.fn(),
      },
    },
  };
});

const dontCareMarkerOpts = {
  worldLocation: Point3d.create(0, 0, 0),
  size: [30, 30] as [number, number],
};

describe("Hook useMarker", () => {
  it("markers are applied in tree order", async () => {
    let markers: IModelJsMarker[];
    const ListenContext = () => {
      const { decoration } = useContext(MarkerDecorationContext);
      markers = ((decoration as MarkerDecoration) as any)._markersRef;
      return null;
    };
    const A = () => {
      useMarker({
        ...dontCareMarkerOpts,
        size: { x: 1, y: 0 },
      });
      return (
        <>
          <B /> <C />
        </>
      );
    };
    const B = () => {
      useMarker({
        ...dontCareMarkerOpts,
        size: { x: 2, y: 0 },
      });
      return null;
    };
    const C = () => {
      useMarker({
        ...dontCareMarkerOpts,
        size: { x: 3, y: 0 },
      });
      return null;
    };
    render(
      <IModelJsViewProvider>
        <ListenContext />
        <A />
      </IModelJsViewProvider>
    );

    expect(markers![0].size.x).toEqual(1);
    expect(markers![1].size.x).toEqual(2);
    expect(markers![2].size.x).toEqual(3);
  });
});
