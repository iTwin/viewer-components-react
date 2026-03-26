/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { joinHierarchySearchTrees } from "../../../tree-widget-react/components/trees/common/Utils.js";

import type { IModelInstanceKey } from "@itwin/presentation-hierarchies";

describe("Utils", () => {
  describe("joinHierarchySearchTrees", () => {
    const subject: IModelInstanceKey = { id: "0x1", className: "s:s", imodelKey: "key" };
    const model: IModelInstanceKey = { id: "0x2", className: "s:m", imodelKey: "key" };
    const category1: IModelInstanceKey = { id: "0x3", className: "s:c", imodelKey: "key" };
    const category2: IModelInstanceKey = { id: "0x4", className: "s:c", imodelKey: "key" };

    it("returns empty array when both inputs are empty", () => {
      expect(joinHierarchySearchTrees([], [])).to.deep.equal([]);
    });

    it("returns empty when only sub-trees are provided without search trees", () => {
      const result = joinHierarchySearchTrees([{ identifier: subject, children: [{ identifier: model }] }], []);
      expect(result).to.deep.equal([]);
    });

    it("returns empty when only search trees are provided without sub-trees", () => {
      const result = joinHierarchySearchTrees([], [{ identifier: subject, children: [{ identifier: model }] }]);
      expect(result).to.deep.equal([]);
    });

    it("returns empty when none of the search targets are under sub-tree targets", () => {
      const result = joinHierarchySearchTrees(
        [{ identifier: subject, children: [{ identifier: model, children: [{ identifier: category1 }] }] }],
        [{ identifier: subject, children: [{ identifier: model, children: [{ identifier: category2 }] }] }],
      );
      expect(result).to.deep.equal([]);
    });

    it("extends sub-tree leaf with search tree children, removing isTarget from leaf", () => {
      // sub-tree: [subject] (leaf target)
      // search-tree: [subject -> model]
      // subject's isTarget (set by builder when children are added) is deleted
      // because the search tree is more specific
      const result = joinHierarchySearchTrees([{ identifier: subject }], [{ identifier: subject, children: [{ identifier: model }] }]);
      expect(result).to.deep.equal([{ identifier: subject, children: [{ identifier: model }] }]);
    });

    it("removes isTarget from intermediate sub-tree node matched by search tree", () => {
      // sub-tree: [subject -> model]
      // search-tree: [subject] (matches intermediate sub-tree node that is not a sub-tree target)
      // subject's isTarget (set by builder because search tree marks it as target) is deleted
      const result = joinHierarchySearchTrees([{ identifier: subject, children: [{ identifier: model }] }], [{ identifier: subject }]);
      expect(result).to.deep.equal([{ identifier: subject, children: [{ identifier: model }] }]);
    });

    it("preserves isTarget on explicit sub-tree target matched by search tree", () => {
      // sub-tree: [subject(isTarget) -> model]
      // subject is an explicit sub-tree target, so isTarget is preserved
      const result = joinHierarchySearchTrees([{ identifier: subject, isTarget: true, children: [{ identifier: model }] }], [{ identifier: subject }]);
      expect(result).to.deep.equal([{ identifier: subject, isTarget: true, children: [{ identifier: model }] }]);
    });

    it("adds search tree entries under ancestor sub-tree targets", () => {
      // sub-tree: [subject] (leaf target)
      // search-tree: [subject -> model -> category1]
      // model is added under subject (sub-tree target), category1 is added under model
      // because subject (ancestor) is a sub-tree target
      const result = joinHierarchySearchTrees(
        [{ identifier: subject }],
        [{ identifier: subject, children: [{ identifier: model, children: [{ identifier: category1 }] }] }],
      );
      expect(result).to.deep.equal([{ identifier: subject, children: [{ identifier: model, children: [{ identifier: category1 }] }] }]);
    });

    it("allows multiple search trees to add siblings under a sub-tree target", () => {
      const result = joinHierarchySearchTrees(
        [{ identifier: subject, children: [{ identifier: model }] }],
        [{ identifier: subject, children: [{ identifier: model, children: [{ identifier: category1 }, { identifier: category2 }] }] }],
      );
      expect(result).to.deep.equal([
        { identifier: subject, children: [{ identifier: model, children: [{ identifier: category1 }, { identifier: category2 }] }] },
      ]);
    });

    it("preserves isTarget when search tree has explicit isTarget on node with children", () => {
      // model has isTarget: true in the search tree, which sets isSearchTarget
      // preventing deletion by onNewEntry for category1
      const result = joinHierarchySearchTrees(
        [{ identifier: subject, children: [{ identifier: model }] }],
        [{ identifier: subject, children: [{ identifier: model, isTarget: true, children: [{ identifier: category1 }] }] }],
      );
      expect(result).to.deep.equal([{ identifier: subject, children: [{ identifier: model, isTarget: true, children: [{ identifier: category1 }] }] }]);
    });
  });
});
