// /*---------------------------------------------------------------------------------------------
//  * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
//  * See LICENSE.md in the project root for license terms and full copyright notice.
//  *--------------------------------------------------------------------------------------------*/

// import { useActiveIModelConnection } from "@itwin/appui-react";
// import { Flex, ProgressRadial, Text } from "@itwin/itwinui-react";
// import { TreeRenderer, useTree } from "@itwin/presentation-hierarchies-react";
// import { TreeWidget } from "@itwin/tree-widget-react";
// import { getRepositoryNodeIcon } from "./GetIcon";
// import { useRepositoriesHierarchyProvider } from "./UseRepositoriesHierarchyProvider";
// import { Delayed, ProgressOverlay } from "./Utils";

// interface RepositoriesTreeProps {
//   itwinId: string;
//   baseUrl?: string;
//   noDataMessage?: string;
// }

// /**
//  * @alpha
//  */
// export function RepositoriesTreeComponent({ baseUrl, noDataMessage }: Omit<RepositoriesTreeProps, "itwinId">) {
//   const iModelConnection = useActiveIModelConnection();
//   const iTwinId = iModelConnection?.iTwinId;

//   if (!iTwinId) {
//     return <> No itwin id found</>;
//   }
//   return <RepositoriesTree itwinId={iTwinId} baseUrl={baseUrl} noDataMessage={noDataMessage} />;
// }

// function RepositoriesTree({ itwinId, noDataMessage, baseUrl }: RepositoriesTreeProps) {
//   const getHierarchyProvider = useRepositoriesHierarchyProvider({ itwinId, baseUrl });
//   const { rootNodes, isLoading, ...treeProps } = useTree({
//     getHierarchyProvider,
//   });

//   const treeRenderer = () => {
//     if (rootNodes === undefined) {
//       return (
//         <Flex alignItems="center" justifyContent="center" flexDirection="column" style={{ width: "100%", height: "100%" }}>
//           <Delayed show={true}>
//             <ProgressRadial size="large" />
//           </Delayed>
//         </Flex>
//       );
//     }

//     if (rootNodes.length === 0 && !isLoading) {
//       return (
//         <Flex alignItems="center" justifyContent="center" flexDirection="column" style={{ width: "100%", height: "100%" }}>
//           {noDataMessage ? noDataMessage : <Text>{TreeWidget.translate("baseTree.dataIsNotAvailable")}</Text>}
//         </Flex>
//       );
//     }

//     return (
//       <Flex.Item alignSelf="flex-start" style={{ width: "100%", overflow: "auto" }}>
//         <TreeRenderer rootNodes={rootNodes} {...treeProps} selectionMode={"extended"} getIcon={getRepositoryNodeIcon} />
//       </Flex.Item>
//     );
//   };

//   return (
//     <div style={{ position: "relative", height: "100%", overflow: "hidden" }}>
//       <div id="tw-tree-renderer-container" style={{ overflow: "auto", height: "100%" }}>
//         {treeRenderer()}
//       </div>
//       <Delayed show={isLoading}>
//         <ProgressOverlay />
//       </Delayed>
//     </div>
//   );
// }
