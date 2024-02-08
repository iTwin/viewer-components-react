import { useMemo } from "react";
import { StagePanelLocation, StagePanelSection, UiItemsProvider, WidgetState } from "@itwin/appui-react";
import { IModelApp } from "@itwin/core-frontend";
import { Point2d, Point3d } from "@itwin/core-geometry";
import { IModelJsViewProvider, useMarker } from "@itwin/imodel-react-hooks";

export const DummyMarkerProvider: UiItemsProvider = {
  id: "dummy-marker-provider",
  provideWidgets: (_stageId: string, _stageUsage: string, location: StagePanelLocation, section?: StagePanelSection) => {
    if (location === StagePanelLocation.Right && section === StagePanelSection.Start) {
      return [
        {
          id: "dummy-markers",
          label: "DummyMarkers",
          defaultState: WidgetState.Open,
          content: (
            <IModelJsViewProvider>
              <DummyMarkerWidget markerCount={50} />
            </IModelJsViewProvider>
          ),
        },
      ];
    }
    return [];
  },
};

function DummyMarkerWidget({ markerCount }: { markerCount: number }) {
  const extents = IModelApp.viewManager.selectedView?.iModel.projectExtents;

  const placements = useMemo<Point3d[]>(() => {
    if (!extents) return [];

    const points = [];
    for (let i = 0; i < markerCount; i++) {
      const x = extents.xLow + Math.random() * extents.xLength();
      const y = extents.yLow + Math.random() * extents.yLength();
      const z = extents.zLow + Math.random() * extents.zLength();
      points.push(Point3d.create(x, y, z));
    }
    return points;
  }, [extents, markerCount]);

  return (
    <>
      {"This widget provides dummy markers as a test"}
      {placements.map((p) => (
        <MarkerAtPosition placement={p} />
      ))}
    </>
  );
}

function MarkerAtPosition({ placement }: { placement: Point3d }) {
  const size = 20;
  useMarker({
    size: Point2d.create(size, size),
    worldLocation: placement,
    jsxElement: <IsoValveSvg size={size} />,
  });

  return null;
}

const IsoValveSvg = (props: { color?: string; size?: number }) => {
  const color = props.color ?? "#ff0000";
  const size = `${props.size ?? 32}`;
  return (
    <svg viewBox="0 0 8.4666659 8.4666659" height={size} width={size}>
      <g>
        <path
          style={{
            opacity: 1,
            fill: "none",
            fillOpacity: 1,
            stroke: color,
            strokeWidth: 0.51266,
            strokeMiterlimit: 4,
            strokeDasharray: "none",
            strokeOpacity: 1,
          }}
          d="M 8.2103353,4.233328 A 3.9770081,3.9770002 0 0 1 4.2333322,8.2103357 3.9770081,3.9770002 0 0 1 0.25633001,4.233328 3.9770081,3.9770002 0 0 1 4.2333322,0.25633001 3.9770081,3.9770002 0 0 1 8.2103353,4.233328 Z"
        />
        <path d="m 0.99247877,6.9474019 a 4.2333331,4.2286472 0 0 1 2.5e-7,-5.4362441 L 4.2354002,4.22928 Z" style={{ fill: color, strokeWidth: 0.176357 }} />
        <path style={{ fill: color, strokeWidth: 0.176357 }} d="m 7.4783215,1.5111579 a 4.2333331,4.2286472 0 0 1 0,5.4362441 L 4.2354002,4.22928 Z" />
      </g>
    </svg>
  );
};
