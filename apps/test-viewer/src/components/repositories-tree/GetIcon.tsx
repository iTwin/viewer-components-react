/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  Svg3D,
  SvgClash,
  SvgClipboard,
  SvgDetails,
  SvgDocument,
  SvgDocumentation,
  SvgFind,
  SvgFlag,
  SvgFolder,
  SvgGlobe,
  SvgImodelHollow,
  SvgInfo,
  SvgIssueReport,
  SvgItem,
  SvgList,
  SvgRealityMesh,
} from "@itwin/itwinui-icons-react";
import { ITwinRepositoryType } from "./RepositoriesType";

import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";

const StorageNodeIcons: { [key: string]: JSX.Element } = {
  folder: <SvgFolder />,
  file: <SvgDocument />,
};

const IssuesNodeIcons: { [key: string]: JSX.Element } = {
  Issue: <SvgFlag />,
  Clash: <SvgClash />,
  Observation: <SvgFind />,
  RFI: <SvgInfo />,
  "Daily Log": <SvgClipboard />,
  Punchlist: <SvgList />,
};

const RealityDataNodeIcons: { [key: string]: JSX.Element } = {
  RealityMesh3DTiles: <SvgRealityMesh />,
  OMR: <SvgItem />,
};

const FormsNodeIcons: { [key: string]: JSX.Element } = {
  "Asset Inspection": <SvgClipboard />,
  Other: <SvgDocumentation />,
};

/**
 * @internal
 */
export function getRepositoryNodeIcon(node: PresentationHierarchyNode) {
  if (node.nodeData.parentKeys.length === 0) {
    return getRootNodeIcon(node.nodeData.extendedData?.repositoryType);
  }

  if (node.nodeData.extendedData?.type) {
    switch (ITwinRepositoryType[node.nodeData.extendedData?.repositoryType as keyof typeof ITwinRepositoryType]) {
      case ITwinRepositoryType.Storage:
        return StorageNodeIcons[node.nodeData.extendedData.type];
      case ITwinRepositoryType.Issues:
        return IssuesNodeIcons[node.nodeData.extendedData.type];
      case ITwinRepositoryType.Forms:
        return FormsNodeIcons[node.nodeData.extendedData.type];
      case ITwinRepositoryType.RealityData:
        return RealityDataNodeIcons[node.nodeData.extendedData.type];
    }
  }

  return <SvgItem />;
}

function getRootNodeIcon(id: string) {
  switch (ITwinRepositoryType[id as keyof typeof ITwinRepositoryType]) {
    case ITwinRepositoryType.iModels:
      return <SvgImodelHollow />;
    case ITwinRepositoryType.RealityData:
      return <Svg3D />;
    case ITwinRepositoryType.Storage:
      return <SvgFolder />;
    case ITwinRepositoryType.Forms:
      return <SvgDetails />;
    case ITwinRepositoryType.Issues:
      return <SvgIssueReport />;
    case ITwinRepositoryType.CesiumCuratedContent:
      return <SvgGlobe />; // There is no Cesium icon in itwinUI-icons
    case ITwinRepositoryType.SensorData:
    case ITwinRepositoryType.GeographicInformationSystem:
    case ITwinRepositoryType.Construction:
    case ITwinRepositoryType.Subsurface:
    default:
      return <SvgItem />;
  }
}
