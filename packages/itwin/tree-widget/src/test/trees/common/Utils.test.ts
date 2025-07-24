/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { HierarchyFilteringPath } from "@itwin/presentation-hierarchies";
import { joinHierarchyFilteringPaths } from "../../../tree-widget-react/components/trees/common/Utils.js";

import type { HierarchyNodeIdentifiersPath } from "@itwin/presentation-hierarchies";

describe("Utils", () => {
  describe("joinHierarchyFilteringPaths", () => {
    const subject = { id: "0x1", className: "s", imodelKey: "key" };
    const model = { id: "0x2", className: "m", imodelKey: "key" };
    const category1 = { id: "0x3", className: "c", imodelKey: "key" };
    const category2 = { id: "0x4", className: "c", imodelKey: "key" };
    const element1 = { id: "0x5", className: "c", imodelKey: "key" };
    const element2 = { id: "0x6", className: "c", imodelKey: "key" };
    const element3 = { id: "0x7", className: "c", imodelKey: "key" };
    const element4 = { id: "0x8", className: "c", imodelKey: "key" };

    it("returns empty when filter and subTree paths dont overlap", () => {
      const subTreePaths: HierarchyNodeIdentifiersPath[] = [[subject, model]];
      const filterPaths: HierarchyFilteringPath[] = [
        [subject, { ...model, imodelKey: "random" }],
        [subject, { ...model, className: "random" }],
        [subject, { ...model, id: "random" }],
        [subject, category1],
        [category1, model],
        [model],
        [category1],
        [],
      ];
      const joinedPaths = joinHierarchyFilteringPaths(subTreePaths, filterPaths);
      expect(joinedPaths).to.deep.eq([]);
    });

    it("returns subTree paths when filter paths are shorter than subTree paths", () => {
      const subTreePaths: HierarchyNodeIdentifiersPath[] = [
        [subject, model],
        [model, category1, element1, element2],
        [model, category1, element1, element3],
        [model, category1, element2, element3],
        [model, category2, element4],
      ];
      const filterPaths: HierarchyFilteringPath[] = [
        [subject],
        { path: [model, category1, element1], options: { autoExpand: true } },
        { path: [model, category1], options: { autoExpand: { depth: 1 } } },
        { path: [model, category1, element2], options: { autoExpand: { depth: 2 } } },
        { path: [model, category2], options: { autoExpand: true } },
      ];
      const joinedPaths = joinHierarchyFilteringPaths(subTreePaths, filterPaths);
      const expectedPaths = [
        {
          path: [subject, model],
          options: undefined,
        },
        {
          path: [model, category1, element1, element2],
          options: { autoExpand: { depth: 2 } },
        },
        {
          path: [model, category1, element1, element3],
          options: { autoExpand: { depth: 2 } },
        },
        {
          path: [model, category1, element2, element3],
          options: { autoExpand: { depth: 2 } },
        },
        {
          path: [model, category2, element4],
          options: { autoExpand: { depth: 1 } },
        },
      ];
      expect(joinedPaths).to.deep.eq(expectedPaths);
    });

    it("returns subTree paths and filter paths when filter paths are longer than subTree paths", () => {
      const subTreePaths: HierarchyNodeIdentifiersPath[] = [
        [subject, model],
        [model, category1, element1, element2],
        [model, category1, element1, element3],
      ];
      const filterPaths: HierarchyFilteringPath[] = [
        [subject, model, category1],
        { path: [model, category1, element1, element2, element3], options: { autoExpand: true } },
        { path: [model, category1, element1, element3, element1], options: { autoExpand: { depth: 2 } } },
      ];
      const sortFn = (lhs: HierarchyFilteringPath, rhs: HierarchyFilteringPath) => {
        const lhsStr = JSON.stringify(lhs);
        const rhsStr = JSON.stringify(rhs);
        if (rhsStr === lhsStr) {
          return 0;
        }
        if (lhsStr < rhsStr) {
          return -1;
        }
        return 1;
      };
      const joinedPaths = joinHierarchyFilteringPaths(subTreePaths, filterPaths).sort(sortFn);
      const expectedPaths = [
        {
          path: subTreePaths[0],
          options: undefined,
        },
        {
          path: subTreePaths[1],
          options: undefined,
        },
        {
          path: subTreePaths[2],
          options: undefined,
        },
        { path: HierarchyFilteringPath.normalize(filterPaths[0]).path },
        filterPaths[1],
        filterPaths[2],
      ].sort(sortFn);
      expect(joinedPaths).to.deep.eq(expectedPaths);
    });
  });
});
