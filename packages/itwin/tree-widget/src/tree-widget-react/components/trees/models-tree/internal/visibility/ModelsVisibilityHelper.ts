/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { from, mergeMap, of } from "rxjs";
import { createVisibilityStatus } from "../../../common/internal/Tooltip.js";
import { BaseVisibilityStatusHelper } from "../../../common/internal/visibility/BaseVisibilityStatusHelper.js";
import { mergeVisibilityStatuses } from "../../../common/internal/VisibilityUtils.js";

import type { VisibilityStatus } from "../../../common/UseHierarchyVisibility.js";
import type { Observable } from "rxjs";
import type { ModelsTreeIdsCache } from "../ModelsTreeIdsCache.js";
import type { Id64Arg } from "@itwin/core-bentley";
import type { BaseVisibilityStatusHelperProps } from "../../../common/internal/visibility/BaseVisibilityStatusHelper.js";

/**
 * Props for `createCategoriesTreeVisibilityHandler`.
 * @internal
 */
export type ModelsVisibilityStatusHelperProps = BaseVisibilityStatusHelperProps & {
  idsCache: ModelsTreeIdsCache;
};

export class ModelsVisibilityStatusHelper extends BaseVisibilityStatusHelper {
  #props: ModelsVisibilityStatusHelperProps;
  constructor(_props: ModelsVisibilityStatusHelperProps) {
    super(_props);
    this.#props = _props;
  }

  public getSubjectsVisibilityStatus({ subjectIds }: { subjectIds: Id64Arg }): Observable<VisibilityStatus> {
    if (!this.#props.viewport.view.isSpatialView()) {
      return of(createVisibilityStatus("disabled"));
    }

    return from(this.#props.idsCache.getSubjectModelIds(subjectIds)).pipe(
      mergeMap((modelIds) => this.getModelsVisibilityStatus({ modelIds, type: "GeometricModel3d" })),
      mergeVisibilityStatuses,
    );
  }

  public changeSubjectsVisibilityStatus({ subjectIds, on }: { subjectIds: Id64Arg; on: boolean }): Observable<void> {
    return from(this.#props.idsCache.getSubjectModelIds(subjectIds)).pipe(mergeMap((modelIds) => this.changeModelsVisibilityStatus({ modelIds, on })));
  }
}
