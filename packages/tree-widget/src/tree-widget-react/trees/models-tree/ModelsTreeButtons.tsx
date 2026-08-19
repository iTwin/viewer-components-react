/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { defaultIfEmpty, firstValueFrom, forkJoin, mergeAll, mergeMap, of, reduce, takeUntil } from "rxjs";
import { IconButton, ToggleButton } from "@mui/material";
import toggle2DSvg from "@stratakit/icons/2d.svg";
import toggle3DSvg from "@stratakit/icons/3d.svg";
import focusModeSvg from "@stratakit/icons/cursor-click.svg";
import visibilityHideSvg from "@stratakit/icons/visibility-hide.svg";
import visibilityInvertSvg from "@stratakit/icons/visibility-invert.svg";
import visibilityShowSvg from "@stratakit/icons/visibility-show.svg";
import { Icon } from "@stratakit/mui";
import { useFocusedInstancesContext } from "../../shared/contexts/FocusedInstancesContext.js";
import { useTranslation } from "../../shared/contexts/LocalizationContext.js";
import { useSharedTreeContext } from "../../shared/contexts/SharedTreeContext.js";
import { useTelemetryContext } from "../../shared/contexts/UseTelemetryContext.js";
import { getClassesByView } from "../../shared/internal/Utils.js";
import { invertAllModels, showAll } from "../../shared/internal/VisibilityUtils.js";

import type { ReactElement } from "react";
import type { Observable } from "rxjs";
import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { BaseIdsCache } from "../../shared/internal/caches/BaseIdsCache.js";
import type { CategoryInfosMap } from "../../shared/internal/VisibilityUtils.js";
import type { TreeWidgetViewport } from "../../shared/TreeWidgetViewport.js";
import type { TreeToolbarButtonProps } from "../../tree-header/SelectableTree.js";

/**
 * Information about a single Model.
 * @public
 */
interface ModelInfo {
  id: string;
  isPlanProjection?: boolean;
}

/**
 * Props that get passed to `ModelsTreeComponent` header button renderer.
 * @see ModelTreeComponentProps.headerButtons
 * @public
 */
export interface ModelsTreeHeaderButtonProps extends TreeToolbarButtonProps {
  /** A list of models available in the iModel. */
  models: ModelInfo[];
}

/**
 * Custom hook that creates props required to render `ModelsTreeComponent` header button.
 *
 * Example:
 * ```tsx
 * const { buttonProps, onModelsFiltered } = useModelsTreeButtonProps({ imodel, viewport });
 * <TreeWithHeader
 *   buttons={[
 *     <ModelsTreeComponent.ShowAllButton {...buttonProps} />,
 *     <ModelsTreeComponent.HideAllButton {...buttonProps} />,
 *   ]}
 * >
 *   <ModelsTree {...treeProps} onModelsFiltered={onModelsFiltered} />
 * </TreeWithHeader>
 * ```
 * **Note:** Requires `TreeWidgetContextProvider` to be present in components tree above.
 *
 * @public
 */
export function useModelsTreeButtonProps({ imodel, viewport }: { imodel: IModelConnection; viewport: TreeWidgetViewport }): {
  buttonProps: Pick<ModelsTreeHeaderButtonProps, "models" | "viewport">;
  onModelsFiltered: (models: Id64String[] | undefined) => void;
} {
  const [filteredModels, setFilteredModels] = useState<Id64String[] | undefined>();
  const models = useAvailableModels(imodel);
  const availableModels = useMemo(() => (!filteredModels ? models : models.filter((model) => filteredModels.includes(model.id))), [models, filteredModels]);
  return {
    buttonProps: {
      models: availableModels,
      viewport,
    },
    onModelsFiltered: setFilteredModels,
  };
}

function useAvailableModels(imodel: IModelConnection): ModelInfo[] {
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const { getBaseIdsCache } = useSharedTreeContext();
  const baseIdsCache = getBaseIdsCache({ imodel, elementClassName: getClassesByView("3d").elementClass, type: "3d" });
  useEffect(() => {
    const getModels = async () => {
      try {
        const [allModels, planProjectionModels] = await Promise.all([
          firstValueFrom(baseIdsCache.getAllModels()),
          firstValueFrom(baseIdsCache.getPlanProjectionModels()),
        ]);
        setAvailableModels(allModels.map((id) => ({ id, isPlanProjection: planProjectionModels.has(id) })));
      } catch {
        setAvailableModels([]);
      }
    };
    void getModels();
  }, [baseIdsCache]);

  return availableModels;
}

/** @public */
export type ModelsTreeHeaderButtonType = (props: ModelsTreeHeaderButtonProps) => ReactElement | null;

/**
 * Requires `TreeWidgetContextProvider` to be present in component tree above.
 * @public
 */
export function ShowAllButton(props: ModelsTreeHeaderButtonProps) {
  const { models, viewport } = props;
  const telemetryContext = useTelemetryContext();
  const onFeatureUsed = props.onFeatureUsed ?? ((featureId: string) => telemetryContext.onFeatureUsed({ featureId, reportInteraction: true }));
  const { getBaseIdsCache, cancelChangesInProgress } = useSharedTreeContext();
  const baseIdsCache = getBaseIdsCache({ imodel: viewport.iModel, elementClassName: getClassesByView("3d").elementClass, type: "3d" });
  const translate = useTranslation();

  const onClick = async () => {
    // cspell:disable-next-line
    onFeatureUsed?.("models-tree-showall");
    cancelChangesInProgress.next();
    // wrap in try catch for getCategoryInfos call
    try {
      const categoryInfos = await getCategoryInfos({ baseIdsCache, cancel: cancelChangesInProgress });
      if (!categoryInfos) {
        return;
      }
      showAll({
        viewport,
        modelIds: models.map((model) => model.id),
        categoryInfos,
      });
    } catch {}
  };

  const label = translate("modelsTree.buttons.showAll.tooltip");
  return (
    <IconButton size="small" label={label} disabled={models.length === 0} onClick={onClick}>
      <Icon href={visibilityShowSvg} />
    </IconButton>
  );
}

/** @public */
export function HideAllButton(props: ModelsTreeHeaderButtonProps) {
  const { models, viewport } = props;
  const telemetryContext = useTelemetryContext();
  const onFeatureUsed = props.onFeatureUsed ?? ((featureId: string) => telemetryContext.onFeatureUsed({ featureId, reportInteraction: true }));
  const { cancelChangesInProgress } = useSharedTreeContext();
  const translate = useTranslation();
  const onClick = () => {
    // cspell:disable-next-line
    onFeatureUsed?.("models-tree-hideall");
    cancelChangesInProgress.next();
    viewport.changeModelDisplay({ modelIds: models.map((model) => model.id), display: false });
  };

  const label = translate("modelsTree.buttons.hideAll.tooltip");
  return (
    <IconButton size="small" label={label} disabled={models.length === 0} onClick={onClick}>
      <Icon href={visibilityHideSvg} />
    </IconButton>
  );
}

/** @public */
export function InvertButton(props: ModelsTreeHeaderButtonProps) {
  const { models, viewport } = props;
  const telemetryContext = useTelemetryContext();
  const onFeatureUsed = props.onFeatureUsed ?? ((featureId: string) => telemetryContext.onFeatureUsed({ featureId, reportInteraction: true }));
  const { cancelChangesInProgress, getBaseIdsCache } = useSharedTreeContext();
  const baseIdsCache = getBaseIdsCache({ imodel: viewport.iModel, elementClassName: getClassesByView("3d").elementClass, type: "3d" });
  const translate = useTranslation();
  const onClick = async () => {
    // cspell:disable-next-line
    onFeatureUsed?.("models-tree-invert");
    cancelChangesInProgress.next();
    // wrap in try catch for getCategoryInfos call
    try {
      const categoryInfos = await getCategoryInfos({ baseIdsCache, cancel: cancelChangesInProgress });
      if (!categoryInfos) {
        return;
      }
      invertAllModels({
        viewport,
        modelIds: models.map((model) => model.id),
        categoryInfos,
      });
    } catch {}
  };

  const label = translate("modelsTree.buttons.invert.tooltip");
  return (
    <IconButton size="small" label={label} disabled={models.length === 0} onClick={onClick}>
      <Icon href={visibilityInvertSvg} />
    </IconButton>
  );
}

function useAreAllModelsVisible({ modelIds, viewport }: { modelIds: Id64String[]; viewport: TreeWidgetViewport }): boolean {
  const subscribe = useCallback((onStoreChange: () => void) => viewport.onDisplayedModelsChanged.addListener(onStoreChange), [viewport]);
  const getSnapshot = useCallback(() => (modelIds.length !== 0 ? modelIds.every((id) => viewport.viewsModel(id)) : false), [modelIds, viewport]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** @public */
export function View2DButton(props: ModelsTreeHeaderButtonProps) {
  const { models, viewport } = props;
  const telemetryContext = useTelemetryContext();
  const onFeatureUsed = props.onFeatureUsed ?? ((featureId: string) => telemetryContext.onFeatureUsed({ featureId, reportInteraction: true }));
  const { cancelChangesInProgress } = useSharedTreeContext();
  const models2d = useMemo(() => models.filter((model) => model.isPlanProjection).map((model) => model.id), [models]);
  const is2dToggleActive = useAreAllModelsVisible({ modelIds: models2d, viewport });
  const translate = useTranslation();

  const onClick = () => {
    onFeatureUsed?.("models-tree-view2d");
    cancelChangesInProgress.next();
    viewport.changeModelDisplay({ modelIds: models2d, display: is2dToggleActive ? false : true });
  };

  const label = translate("modelsTree.buttons.toggle2d.tooltip");
  return (
    <ToggleButton value="toggle2d" size="small" label={label} onChange={onClick} disabled={models2d.length === 0} selected={is2dToggleActive}>
      <Icon href={toggle2DSvg} />
    </ToggleButton>
  );
}

/** @public */
export function View3DButton(props: ModelsTreeHeaderButtonProps) {
  const { models, viewport } = props;
  const telemetryContext = useTelemetryContext();
  const onFeatureUsed = props.onFeatureUsed ?? ((featureId: string) => telemetryContext.onFeatureUsed({ featureId, reportInteraction: true }));
  const { cancelChangesInProgress } = useSharedTreeContext();
  const models3d = useMemo(() => {
    return models.filter((model) => !model.isPlanProjection).map((model) => model.id);
  }, [models]);
  const is3dToggleActive = useAreAllModelsVisible({ modelIds: models3d, viewport });
  const translate = useTranslation();

  const onClick = () => {
    onFeatureUsed?.("models-tree-view3d");
    cancelChangesInProgress.next();
    viewport.changeModelDisplay({ modelIds: models3d, display: is3dToggleActive ? false : true });
  };

  const label = translate("modelsTree.buttons.toggle3d.tooltip");
  return (
    <ToggleButton value="toggle3d" size="small" label={label} onChange={onClick} disabled={models3d.length === 0} selected={is3dToggleActive}>
      <Icon href={toggle3DSvg} />
    </ToggleButton>
  );
}

/** @public */
export function ToggleInstancesFocusButton({ disabled, ...props }: { onFeatureUsed?: (feature: string) => void; disabled?: boolean }) {
  const telemetryContext = useTelemetryContext();
  const onFeatureUsed = props.onFeatureUsed ?? ((featureId: string) => telemetryContext.onFeatureUsed({ featureId, reportInteraction: true }));
  const { enabled, toggle } = useFocusedInstancesContext();
  const translate = useTranslation();
  const label = disabled
    ? translate("modelsTree.buttons.toggleFocusMode.disabled.tooltip")
    : enabled
      ? translate("modelsTree.buttons.toggleFocusMode.disable.tooltip")
      : translate("modelsTree.buttons.toggleFocusMode.enable.tooltip");
  return (
    <ToggleButton
      value="instancesFocus"
      size="small"
      label={label}
      onChange={() => {
        // cspell:disable-next-line
        onFeatureUsed?.("models-tree-instancesfocus");
        toggle();
      }}
      disabled={disabled}
      selected={enabled}
    >
      <Icon href={focusModeSvg} />
    </ToggleButton>
  );
}

async function getCategoryInfos({ baseIdsCache, cancel }: { baseIdsCache: BaseIdsCache; cancel: Observable<void> }): Promise<CategoryInfosMap | undefined> {
  return firstValueFrom(
    baseIdsCache.getAllCategoriesOfElements().pipe(
      mergeAll(),
      mergeMap((categoryId) => forkJoin({ categoryId: of(categoryId), subCategories: baseIdsCache.getSubCategories({ categoryId }) })),
      reduce((acc: CategoryInfosMap, { categoryId, subCategories }) => {
        acc.set(categoryId, subCategories);
        return acc;
      }, new Map()),
      takeUntil(cancel),
      defaultIfEmpty(undefined),
    ),
  );
}
