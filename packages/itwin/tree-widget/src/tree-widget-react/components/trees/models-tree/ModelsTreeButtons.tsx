/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useState } from "react";
import { firstValueFrom, mergeAll, toArray } from "rxjs";
import { IconButton } from "@stratakit/bricks";
import toggle2DSvg from "@stratakit/icons/2d.svg";
import toggle3DSvg from "@stratakit/icons/3d.svg";
import focusModeSvg from "@stratakit/icons/cursor-click.svg";
import visibilityHideSvg from "@stratakit/icons/visibility-hide.svg";
import visibilityInvertSvg from "@stratakit/icons/visibility-invert.svg";
import visibilityShowSvg from "@stratakit/icons/visibility-show.svg";
import { useTranslation } from "../common/components/LocalizationContext.js";
import { useFocusedInstancesContext } from "../common/FocusedInstancesContext.js";
import { useSharedTreeContextInternal } from "../common/internal/SharedTreeContextProviderInternal.js";
import { getClassesByView } from "../common/internal/Utils.js";
import { areAllModelsVisible, hideAllModels, invertAllModels, showAll, toggleModels } from "../common/Utils.js";

import type { ReactElement } from "react";
import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { TreeToolbarButtonProps } from "../../tree-header/SelectableTree.js";
import type { TreeWidgetViewport } from "../common/TreeWidgetViewport.js";

/**
 * Information about a single Model.
 * @public
 */
export interface ModelInfo {
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
 * **Note:** Requires `SharedTreeContextProvider` to be present in components tree above.
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
  const { getBaseIdsCache } = useSharedTreeContextInternal();
  const baseIdsCache = getBaseIdsCache({ imodel, elementClassName: getClassesByView("3d").elementClass, type: "3d" });
  useEffect(() => {
    const getModels = async () => {
      try {
        const models = await firstValueFrom(baseIdsCache.getAllModels());
        setAvailableModels(models.map((id) => ({ id })));
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
 * Requires `SharedTreeContextProvider` to be present in component tree above.
 * @public
 */
export function ShowAllButton(props: ModelsTreeHeaderButtonProps) {
  const { getBaseIdsCache, cancelChangesInProgress } = useSharedTreeContextInternal();
  const baseIdsCache = getBaseIdsCache({ imodel: props.viewport.iModel, elementClassName: getClassesByView("3d").elementClass, type: "3d" });
  const translate = useTranslation();
  const onClick = useCallback(async () => {
    try {
      cancelChangesInProgress.next();
      const categories = await firstValueFrom(baseIdsCache.getAllCategoriesOfElements().pipe(mergeAll(), toArray()));
      return await showAll({
        models: props.models.map((model) => model.id),
        categories,
        viewport: props.viewport,
      });
    } catch {}
  }, [baseIdsCache, props.viewport, props.models, cancelChangesInProgress]);
  return (
    <IconButton
      variant={"ghost"}
      label={translate("modelsTree.buttons.showAll.tooltip")}
      onClick={() => {
        // cspell:disable-next-line
        props.onFeatureUsed?.("models-tree-showall");
        void onClick();
      }}
      icon={visibilityShowSvg}
    />
  );
}

/** @public */
export function HideAllButton(props: ModelsTreeHeaderButtonProps) {
  const { cancelChangesInProgress } = useSharedTreeContextInternal();
  const translate = useTranslation();
  return (
    <IconButton
      variant={"ghost"}
      label={translate("modelsTree.buttons.hideAll.tooltip")}
      onClick={() => {
        // cspell:disable-next-line
        props.onFeatureUsed?.("models-tree-hideall");
        cancelChangesInProgress.next();
        hideAllModels(
          props.models.map((model) => model.id),
          props.viewport,
        );
      }}
      icon={visibilityHideSvg}
    />
  );
}

/** @public */
export function InvertButton(props: ModelsTreeHeaderButtonProps) {
  const { changesInProgress } = useSharedTreeContextInternal();
  const translate = useTranslation();
  return (
    <IconButton
      variant={"ghost"}
      label={translate("modelsTree.buttons.invert.tooltip")}
      onClick={() => {
        props.onFeatureUsed?.("models-tree-invert");
        void Promise.allSettled([...changesInProgress]).then(() => {
          invertAllModels(
            props.models.map((model) => model.id),
            props.viewport,
          );
        });
      }}
      icon={visibilityInvertSvg}
    />
  );
}

/** @public */
export function View2DButton(props: ModelsTreeHeaderButtonProps) {
  const translate = useTranslation();
  const models2d = useMemo(() => {
    return props.models.filter((model) => model.isPlanProjection).map((model) => model.id);
  }, [props.models]);

  const [is2dToggleActive, setIs2dToggleActive] = useState(() => areAllModelsVisible(models2d, props.viewport));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIs2dToggleActive(areAllModelsVisible(models2d, props.viewport));
    return props.viewport.onDisplayedModelsChanged.addListener(() => setIs2dToggleActive(areAllModelsVisible(models2d, props.viewport)));
  }, [models2d, props.viewport]);

  return (
    <IconButton
      variant={"ghost"}
      label={translate("modelsTree.buttons.toggle2d.tooltip")}
      onClick={() => {
        props.onFeatureUsed?.("models-tree-view2d");
        toggleModels(models2d, is2dToggleActive, props.viewport);
      }}
      aria-disabled={models2d.length === 0}
      active={is2dToggleActive}
      icon={toggle2DSvg}
    />
  );
}

/** @public */
export function View3DButton(props: ModelsTreeHeaderButtonProps) {
  const translate = useTranslation();
  const models3d = useMemo(() => {
    return props.models.filter((model) => !model.isPlanProjection).map((model) => model.id);
  }, [props.models]);

  const [is3dToggleActive, setIs3dToggleActive] = useState(() => areAllModelsVisible(models3d, props.viewport));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIs3dToggleActive(areAllModelsVisible(models3d, props.viewport));
    return props.viewport.onDisplayedModelsChanged.addListener(() => setIs3dToggleActive(areAllModelsVisible(models3d, props.viewport)));
  }, [models3d, props.viewport]);

  return (
    <IconButton
      variant={"ghost"}
      label={translate("modelsTree.buttons.toggle3d.tooltip")}
      onClick={() => {
        props.onFeatureUsed?.("models-tree-view3d");
        toggleModels(models3d, is3dToggleActive, props.viewport);
      }}
      aria-disabled={models3d.length === 0}
      active={is3dToggleActive}
      icon={toggle3DSvg}
    />
  );
}

/** @public */
export function ToggleInstancesFocusButton({ onFeatureUsed, disabled }: { onFeatureUsed?: (feature: string) => void; disabled?: boolean }) {
  const { enabled, toggle } = useFocusedInstancesContext();
  const translate = useTranslation();
  const label = disabled
    ? translate("modelsTree.buttons.toggleFocusMode.disabled.tooltip")
    : enabled
      ? translate("modelsTree.buttons.toggleFocusMode.disable.tooltip")
      : translate("modelsTree.buttons.toggleFocusMode.enable.tooltip");
  return (
    <IconButton
      variant={"ghost"}
      label={label}
      onClick={() => {
        // cspell:disable-next-line
        onFeatureUsed?.("models-tree-instancesfocus");
        toggle();
      }}
      aria-disabled={disabled}
      active={enabled}
      icon={focusModeSvg}
    />
  );
}
