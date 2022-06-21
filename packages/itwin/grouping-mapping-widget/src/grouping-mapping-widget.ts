/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** UI Provider for iTwin Viewer Applications */
export * from "./widget/GroupingMappingWidget";

/** Interfaces for providing custom MappingClient */
export { createDefaultMappingClient } from "./widget/components/context/MappingClientContext";
export { ClientPrefix } from "./widget/components/context/GroupingApiConfigContext";
export * from "@itwin/insights-client";
export * from "./widget/IMappingClient";

/** Internal components for custom UIs */
export { Mappings } from "./widget/components/Mapping";
export { Groupings } from "./widget/components/Grouping";
export { PropertyMenu } from "./widget/components/PropertyMenu";
