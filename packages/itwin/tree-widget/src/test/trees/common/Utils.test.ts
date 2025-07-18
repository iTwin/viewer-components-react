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
      const subject = {id: "0x1", className: "s", imodelKey: "key"};
      const model = {id: "0x2", className: "m", imodelKey: "key"};
      const category = {id: "0x3", className: "c", imodelKey: "key"};
      const category2 = {id: "0x3", className: "c", imodelKey: "key"};
      const element = {id: "0x4", className: "c", imodelKey: "key"};
      const element2 = {id: "0x5", className: "c", imodelKey: "key"};
      const element3 = {id: "0x6", className: "c", imodelKey: "key"};
      const element4 = {id: "0x7", className: "c", imodelKey: "key"};

      it("returns empty when filter and subset paths dont overlap", () => {
        const subsetPaths: HierarchyNodeIdentifiersPath[] = [
          [subject, model],
        ]
        const filterPaths: HierarchyFilteringPath[] = [
          [subject, {...model, imodelKey: "random"}],
          [subject, {...model, className: "random"}],
          [subject, {...model, id: "random"}],
          [subject, category],
          [category, model],
          [model],
          [category],
          []
        ]
        const joinedPaths = joinHierarchyFilteringPaths(subsetPaths, filterPaths);
        expect(joinedPaths).to.deep.eq([])
      });

      it("returns subset paths when filter paths are shorter than subset paths", () => {
        const subsetPaths: HierarchyNodeIdentifiersPath[] = [
          [subject, model],
          [model, category, element, element2],
          [model, category, element, element3],
          [model, category, element2, element3],
          [model, category2, element4],
        ]
        const filterPaths: HierarchyFilteringPath[] = [
          [subject],
          { path: [model, category, element], options: { autoExpand: true } },
          { path: [model, category], options: { autoExpand: { depth: 1 } } },
          { path: [model, category, element2], options: { autoExpand: { depth: 2 } } },
          { path: [model, category2], options: { autoExpand: true } },
        ]
        const joinedPaths = joinHierarchyFilteringPaths(subsetPaths, filterPaths);
        const expectedPaths = [
          {
            path: [subject, model],
            options: undefined
          },
          {
            path: [model, category, element, element2],
            options: { autoExpand: { depth: 2 } }
          },
          {
          path: [model, category, element, element3],
          options: { autoExpand: { depth: 2 } }
          },
          {
            path: [model, category, element2, element3],
            options: { autoExpand: { depth: 2 } }
          },
          {
            path: [model, category2, element4],
            options: { autoExpand: { depth: 1 } }
          }
        ]
        expect(joinedPaths).to.deep.eq(expectedPaths)
      });

      it("returns subset paths and filter paths when filter paths are longer than subset paths", () => {
        const subsetPaths: HierarchyNodeIdentifiersPath[] = [
          [subject, model],
          [model, category, element, element2],
          [model, category, element, element3],
        ]
        const filterPaths: HierarchyFilteringPath[] = [
          [subject, model, category],
          { path: [model, category, element, element2, element3], options: { autoExpand: true } },
          { path: [model, category, element, element3, element], options: { autoExpand: { depth: 2 } } },
        ]
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
        }
        const joinedPaths = joinHierarchyFilteringPaths(subsetPaths, filterPaths).sort(sortFn);
        const expectedPaths = [
          {
            path: subsetPaths[0],
            options: undefined
          },
          {
            path: subsetPaths[1],
            options: undefined
          },
          {
            path: subsetPaths[2],
            options: undefined
          },
          { path: HierarchyFilteringPath.normalize(filterPaths[0]).path },
          filterPaths[1],
          filterPaths[2]
        ].sort(sortFn);
        expect(joinedPaths).to.deep.eq(expectedPaths);
      });
    });
});
