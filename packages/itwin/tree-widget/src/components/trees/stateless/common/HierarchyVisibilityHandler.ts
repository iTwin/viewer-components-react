import type { BeEvent, IDisposable } from "@itwin/core-bentley";
import type { HierarchyNode } from "@itwin/presentation-hierarchies";
import type { VisibilityStatus } from "../../VisibilityTreeEventHandler";

export interface HierarchyVisibilityHandler extends IDisposable {
  readonly onVisibilityChange: BeEvent<() => void>;

  getVisibilityStatus(node: HierarchyNode): Promise<VisibilityStatus> | VisibilityStatus;
  changeVisibility(node: HierarchyNode, on: boolean): Promise<void>;
}
