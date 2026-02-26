/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** Localization */
export { GroupingMappingWidget } from "./GroupingMappingWidget";
export type { GroupingMappingWidgetConfig } from "./GroupingMappingWidget";

/** UI Provider for iTwin Viewer Applications */
export * from "./WidgetShell/GroupingMappingWidget";

/** Interfaces for providing custom MappingClient and API configuration */
export { createDefaultMappingClient, createMappingClient, MappingClientContext, useMappingClient } from "./components/context/MappingClientContext";
export { createDefaultGroupsClient, createGroupsClient, GroupsClientContext, useGroupsClient } from "./components/context/GroupsClientContext";
export {
  createDefaultPropertiesClient,
  createPropertiesClient,
  PropertiesClientContext,
  usePropertiesClient,
} from "./components/context/PropertiesClientContext";
export {
  ClientPrefix,
  GetAccessTokenFn,
  GroupingMappingApiConfig,
  GroupingMappingApiConfigContext,
  useGroupingMappingApiConfig,
} from "./components/context/GroupingApiConfigContext";
export * from "@itwin/insights-client";

/** Internal components for custom UIs */
export { Mappings, MappingsProps } from "./components/Mappings/Mappings";
export { useMappingsOperations, MappingsOperationsProps } from "./components/Mappings/hooks/useMappingsOperations";
export { MappingAction, MappingActionProps } from "./components/Mappings/Editing/MappingAction";
export { MappingsView, MappingsViewProps } from "./components/Mappings/MappingsView";
export { useGroupsOperations, GroupsOperationsProps } from "./components/Groups/hooks/useGroupsOperations";
export { GroupsView, GroupsViewProps } from "./components/Groups/GroupsView";
export { GroupingMappingContext, GroupingMappingContextProps } from "./components/GroupingMappingContext";
export { useGroupHilitedElementsContext, GroupHilitedElements, GroupHilitedElementsContext } from "./components/context/GroupHilitedElementsContext";
export { Groups, GroupsProps } from "./components/Groups/Groups";
export { GroupsVisualization, GroupsVisualizationProps } from "./components/Groups/GroupsVisualization";
export { GroupAction, GroupActionProps } from "./components/Groups/Editing/GroupAction";
export { PropertyMenu, PropertyMenuProps } from "./components/Properties/PropertyMenu";
export { PropertyMenuWithVisualization, PropertyMenuWithVisualizationProps } from "./components/Properties/PropertyMenuWithVisualization";
export { GroupPropertyAction, GroupPropertyActionProps } from "./components/Properties/GroupProperties/GroupPropertyAction";
export { CalculatedPropertyAction, CalculatedPropertyActionProps } from "./components/Properties/CalculatedProperties/CalculatedPropertyAction";
export { SearchGroupingCustomUI } from "./components/customUI/SearchGroupingCustomUI";
export { ManualGroupingCustomUI } from "./components/customUI/ManualGroupingCustomUI";
export { GroupQueryBuilderCustomUI } from "./components/customUI/GroupQueryBuilderCustomUI";
export {
  GroupingMappingCustomUI,
  GroupingMappingCustomUIType,
  ContextCustomUI,
  GroupingCustomUI,
  GroupingCustomUIProps,
  ContextCustomUIProps,
} from "./components/customUI/GroupingMappingCustomUI";

/** Formula DataType resolver */
export { resolveFormulaDataType } from "./formula/FormulaDataTypeResolver";
export { DataType, PropertyMap } from "./formula/Types";
export { IResult } from "./formula/IResult";
