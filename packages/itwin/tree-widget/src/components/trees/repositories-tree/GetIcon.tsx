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
import { HierarchyNodeKey } from "@itwin/presentation-hierarchies";

import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";

export enum RootNodeClassnameEnum {
  "iModels" = 0,
  "RealityData" = 1,
  "Storage" = 2,
  "Forms" = 3,
  "Issues" = 4,
  "SensorData" = 5,
  "CesiumCuratedContent" = 6,
  "GeographicInformationSystem" = 7,
  "Construction" = 8,
  "Subsurface" = 9,
}

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
  if (node.nodeData.parentKeys.length === 0 && HierarchyNodeKey.isGeneric(node.nodeData.key)) {
    return getRootNodeIcon(node.nodeData.key.id);
  }

  if (HierarchyNodeKey.isGeneric(node.nodeData.parentKeys[0]) && node.nodeData.extendedData?.type) {
    switch (RootNodeClassnameEnum[node.nodeData.parentKeys[0].id as keyof typeof RootNodeClassnameEnum]) {
      case RootNodeClassnameEnum.Storage:
        return StorageNodeIcons[node.nodeData.extendedData.type];
      case RootNodeClassnameEnum.Issues:
        return IssuesNodeIcons[node.nodeData.extendedData.type];
      case RootNodeClassnameEnum.Forms:
        return FormsNodeIcons[node.nodeData.extendedData.type];
      case RootNodeClassnameEnum.RealityData:
        return RealityDataNodeIcons[node.nodeData.extendedData.type];
    }
  }

  return <SvgItem />;
}

function getRootNodeIcon(id: string) {
  switch (RootNodeClassnameEnum[id as keyof typeof RootNodeClassnameEnum]) {
    case RootNodeClassnameEnum.iModels:
      return <SvgImodelHollow />;
    case RootNodeClassnameEnum.RealityData:
      return <Svg3D />;
    case RootNodeClassnameEnum.Storage:
      return <SvgFolder />;
    case RootNodeClassnameEnum.Forms:
      return <SvgDetails />;
    case RootNodeClassnameEnum.Issues:
      return <SvgIssueReport />;
    case RootNodeClassnameEnum.CesiumCuratedContent:
      return <SvgGlobe />; // There is no Cesium icon in itwinUI-icons
    case RootNodeClassnameEnum.SensorData:
    case RootNodeClassnameEnum.GeographicInformationSystem:
    case RootNodeClassnameEnum.Construction:
    case RootNodeClassnameEnum.Subsurface:
    default:
      return <SvgItem />;
  }
}
