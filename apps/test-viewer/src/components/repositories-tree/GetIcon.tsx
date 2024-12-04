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

  switch (node.nodeData.extendedData?.repositoryType) {
    case "Storage":
      return StorageNodeIcons[node.nodeData.extendedData.type];
    case "Issues":
      return IssuesNodeIcons[node.nodeData.extendedData.type];
    case "Forms":
      return FormsNodeIcons[node.nodeData.extendedData.type];
    case "RealityData":
      return RealityDataNodeIcons[node.nodeData.extendedData.type];
    default:
      return <SvgItem />;
  }
}

function getRootNodeIcon(repositoryType: ITwinRepositoryType) {
  switch (repositoryType) {
    case "iModels":
      return <SvgImodelHollow />;
    case "RealityData":
      return <Svg3D />;
    case "Storage":
      return <SvgFolder />;
    case "Forms":
      return <SvgDetails />;
    case "Issues":
      return <SvgIssueReport />;
    case "CesiumCuratedContent":
      return <SvgGlobe />;
    case "SensorData":
    case "GeographicInformationSystem":
    case "Construction":
    case "Subsurface":
    default:
      return <SvgItem />;
  }
}
