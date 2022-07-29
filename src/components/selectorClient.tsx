/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Guid } from "@itwin/core-bentley";
import { Selector, Group, Pair } from "./Selector"

// For now only one selector for each report.

export default class SelectorClient {
  getSelectorsT(): Selector[] {

    var selectors: Selector[] = [];

    for (var i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("sel.")) {
        const value = localStorage.getItem(key);

        if (value) {
          const sel = JSON.parse(value);
          selectors.push(sel);
        }
      }
    }

    return selectors;

    //selectors[0] =
    //const text = localStorage.getItem("selector");

    //return JSON.parse(text ?? "");
  }


  getSelectorT(selectorId: string): Selector | undefined {

    const value = localStorage.getItem("sel." + selectorId);

    /*
    if (value == null) {
      const selector: Selector = {
        id: Guid.createValue(),
        reportId: reportId,
        groups: [],
      }

      this.createSelector(selector, reportId);
      */

    //return selector;
    //}

    if (value) {
      const sel = JSON.parse(value);
      return sel;
    }
    else {
      return undefined;
    }


    //const sel = selectors.filter(x => x.reportId == props.reportId);
  }


  //getGroup(id: string): GroupLabel {
  //  const text = localStorage.getItem("sel" + id);
  //  console.log("get (" + id + "): " + text);

  //  return JSON.parse(text ?? "");
  //}

  createUpdateSelector(selector: Selector): string {

    if (!selector.id)
      selector.id = Guid.createValue()

    const key = selector.id;
    //const key = "sel." + reportId //Guid.createValue();
    //const key = "selector";

    //console.log("set (" + key + "): " + text);
    const text = JSON.stringify(selector);
    localStorage.removeItem("sel." + key);
    localStorage.setItem("sel." + key, text);

    return key ?? "";
  }


  createSelectorDep(selector: Selector): string {
    const key = Guid.createValue();
    selector.id = key;
    const text = JSON.stringify(selector);

    //const key = "sel." + reportId //Guid.createValue();
    //const key = "selector";

    //console.log("set (" + key + "): " + text);
    localStorage.removeItem("sel." + key);
    localStorage.setItem("sel." + key, text);

    return key;
  }

  deleteGroupDep(selectorId: string, groupId: string) {
    const selector = this.getSelectorT(selectorId);

    if (selector) {
      const groups = selector.groups;
      selector.groups = groups.filter(x => x.groupName !== groupId);
      //this.updateSelectorDep(selector);
    }
  }

  deletePairDep(selector: Selector, group: Group, pairs: Pair[], pair: Pair) {
    //const selector = this.getSelector(selectorId);

    group.pairs = pairs.filter(x => x.material !== pair.material || x.quantity !== pair.quantity);
    //this.deleteGroup(selector.id ?? "", group.groupName);
    selector.groups = selector.groups.filter(x => x.groupName !== group.groupName);
    //selector = this.getSelector(selector.)
    selector.groups.push(group);
    //this.updateSelector(selector);
  }

  deleteSelectorDep(selectorId: string) {
    localStorage.removeItem("sel." + selectorId);
  }
}