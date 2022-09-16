/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** UI Provider for iTwin Viewer Applications */
export * from "./widget/GroupingMappingWidget";

/** Interfaces for providing custom MappingClient and API configuration */
export { createDefaultMappingClient } from "./widget/components/context/MappingClientContext";
export { ClientPrefix, GetAccessTokenFn } from "./widget/components/context/GroupingApiConfigContext";
export * from "@itwin/insights-client";

/** Internal components for custom UIs */
export { Mappings } from "./widget/components/Mapping";
export { Groupings } from "./widget/components/Grouping";
export { PropertyMenu } from "./widget/components/PropertyMenu";

/** Formula DataType resolver */
export { resolveFormulaDataType } from "./formula/FormulaDataTypeResolver";
export { DataType, PropertyMap } from "./formula/Types";
export { IResult } from "./formula/IResult";
export { GroupingMappingCustomUI, GroupingMappingCustomUIType, ContextUI, GroupingUI, GroupingUIProps } from "./widget/components/customUI/GroupingMappingCustomUI";
