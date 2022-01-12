/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ContentDataProvider } from "@bentley/presentation-components";
import { ContentFlags, DescriptorOverrides, Keys, KeySet } from "@bentley/presentation-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Id64String } from "@bentley/bentleyjs-core";

class RulesetDrivenIdsProvider extends ContentDataProvider {
  constructor(imodel: IModelConnection, rulesetId: string, displayType: string, inputKeys: Keys) {
    super({ imodel, ruleset: rulesetId, displayType });
    this.keys = new KeySet(inputKeys);
  }
  protected shouldConfigureContentDescriptor() { return false; }
  protected getDescriptorOverrides(): DescriptorOverrides {
    return {
      displayType: this.displayType,
      contentFlags: ContentFlags.KeysOnly,
      hiddenFieldNames: [],
    };
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
