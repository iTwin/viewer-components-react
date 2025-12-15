/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { HierarchySearchPath } from "@itwin/presentation-hierarchies";
import { joinHierarchySearchPaths } from "../../../tree-widget-react/components/trees/common/Utils.js";

import type { HierarchyNodeIdentifiersPath } from "@itwin/presentation-hierarchies";
import type { NormalizedHierarchySearchPath } from "../../../tree-widget-react/components/trees/common/Utils.js";

describe("Utils", () => {
  describe("joinHierarchySearchPaths", () => {
    const subject = { id: "0x1", className: "s", imodelKey: "key" };
    const model = { id: "0x2", className: "m", imodelKey: "key" };
    const category1 = { id: "0x3", className: "c", imodelKey: "key" };
    const category2 = { id: "0x4", className: "c", imodelKey: "key" };
    const element1 = { id: "0x5", className: "c", imodelKey: "key" };
    const element2 = { id: "0x6", className: "c", imodelKey: "key" };
    const element3 = { id: "0x7", className: "c", imodelKey: "key" };
    const element4 = { id: "0x8", className: "c", imodelKey: "key" };

    it("returns empty when search and subTree paths don't overlap", () => {
      const subTreePaths: HierarchyNodeIdentifiersPath[] = [[subject, model]];
      const searchPaths: NormalizedHierarchySearchPath[] = [
        { path: [subject, { ...model, imodelKey: "random" }] },
        { path: [subject, { ...model, className: "random" }] },
        { path: [subject, { ...model, id: "random" }] },
        { path: [subject, category1] },
        { path: [category1, model] },
        { path: [model] },
        { path: [category1] },
        { path: [] },
      ];
      const joinedPaths = joinHierarchySearchPaths(subTreePaths, searchPaths);
      expect(joinedPaths).to.deep.eq([]);
    });

    it("returns subTree paths when search paths are shorter than subTree paths", () => {
      const searchPaths: NormalizedHierarchySearchPath = { path: [subject] };
      const searchPaths2: NormalizedHierarchySearchPath = { path: [element1, element2, element3], options: { reveal: true } };
      const searchPaths3: NormalizedHierarchySearchPath = { path: [element3, element4], options: { reveal: { depthInHierarchy: 1 } } };
      const searchPaths4: NormalizedHierarchySearchPath = { path: [element4, category1], options: { reveal: { depthInPath: 1 } } };
      const searchPathsArray: NormalizedHierarchySearchPath[] = [searchPaths, searchPaths2, searchPaths3, searchPaths4];

      const subTreePath1 = [...searchPaths.path, model];
      const subTreePath2 = [...searchPaths2.path, element4];
      const subTreePath3 = [...searchPaths3.path, category1, category2];
      const subTreePath4 = [...searchPaths4.path, category2];
      const subTreePaths: HierarchyNodeIdentifiersPath[] = [subTreePath1, subTreePath2, subTreePath3, subTreePath4];

      const joinedPaths = joinHierarchySearchPaths(subTreePaths, searchPathsArray);
      const expectedPaths = [
        {
          path: subTreePath1,
          options: undefined,
        },
        {
          path: subTreePath2,
          options: { reveal: { depthInPath: 2 } },
        },
        {
          path: subTreePath3,
          options: searchPaths3.options,
        },
        {
          path: subTreePath4,
          options: searchPaths4.options,
        },
      ];
      expect(joinedPaths).to.deep.eq(expectedPaths);
    });

    it("returns subTree paths and search paths when search paths are longer than subTree paths", () => {
      const subTreePaths: HierarchyNodeIdentifiersPath[] = [
        [subject, model],
        [model, category1, element1, element2],
        [model, category1, element1, element3],
      ];
      const searchPaths: NormalizedHierarchySearchPath[] = [
        { path: [subject, model, category1] },
        { path: [model, category1, element1, element2, element3], options: { reveal: true } },
        { path: [model, category1, element1, element3, element1], options: { reveal: { depthInPath: 1 } } },
      ];
      const sortFn = (lhs: HierarchySearchPath, rhs: HierarchySearchPath) => {
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
      const joinedPaths = joinHierarchySearchPaths(subTreePaths, searchPaths).sort(sortFn);
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
        { path: HierarchySearchPath.normalize(searchPaths[0]).path },
        searchPaths[1],
        searchPaths[2],
      ].sort(sortFn);
      expect(joinedPaths).to.deep.eq(expectedPaths);
    });
  });
});
