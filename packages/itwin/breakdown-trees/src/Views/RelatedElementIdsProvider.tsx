/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ContentDataProvider } from "@itwin/presentation-components";
import type { DescriptorOverrides, Keys } from "@itwin/presentation-common";
import { ContentFlags, KeySet } from "@itwin/presentation-common";
import type { IModelConnection } from "@itwin/core-frontend";
import type { Id64String } from "@itwin/core-bentley";

class RulesetDrivenIdsProvider extends ContentDataProvider {
  constructor(imodel: IModelConnection, rulesetId: string, displayType: string, inputKeys: Keys) {
    super({ imodel, ruleset: rulesetId, displayType });
    this.keys = new KeySet(inputKeys);
  }
  protected shouldConfigureContentDescriptor() { return false; }
  protected async getDescriptorOverrides(): Promise<DescriptorOverrides> {
    return Promise.resolve({
      displayType: this.displayType,
      contentFlags: ContentFlags.KeysOnly,
    });
  }
  public async getElementIds() {
    const content = await this.getContent();
    const result = new KeySet();
    if (content) {
      content.contentSet.forEach((item) => {
        result.add(item.primaryKeys);
      });
    }
    return result;
  }
}

// istanbul ignore next
export class RelatedElementIdsProvider extends RulesetDrivenIdsProvider {
  constructor(imodel: IModelConnection, rulesetId: string, instanceId: Id64String) {
    super(imodel, rulesetId, "RelatedElementsRequest", [{ className: "BisCore:Element", id: instanceId }]);
  }
}
