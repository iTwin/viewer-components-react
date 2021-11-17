import {
  SpatialContainmentTree,
  SpatialContainmentTreeProps,
} from "@itwin/appui-react";
import React from "react";
import { useResizeDetector } from "react-resize-detector";

export const SpatialTreeComponent = (
  props: Omit<SpatialContainmentTreeProps, "width" | "height">
) => {
  const { width, height, ref } = useResizeDetector();

  return (
    <div ref={ref} style={{ width: "100%", height: "100%" }}>
      {width && height && (
        <SpatialContainmentTree {...props} width={width} height={height} />
      )}
    </div>
  );
};
