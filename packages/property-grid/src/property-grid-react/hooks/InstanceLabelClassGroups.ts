/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";

export async function groupClassesByCommonBase(classHierarchyInspector: ECClassHierarchyInspector, classNames: string[]) {
  const classesWithBases = await Promise.all(
    classNames.map(async (className) => {
      for (const baseClass of ["BisCore.Element", "BisCore.Model"]) {
        if (await classHierarchyInspector.classDerivesFrom(className, baseClass)) {
          return { className, baseClass };
        }
      }
      return { className, baseClass: className };
    }),
  );
  const groups = new Map<string, string[]>();
  for (const { className, baseClass } of classesWithBases) {
    const group = groups.get(baseClass) ?? [];
    group.push(className);
    groups.set(baseClass, group);
  }
  return [...groups].map(([baseClass, names]) => ({ baseClass, classNames: names }));
}
