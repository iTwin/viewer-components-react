/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./PropertyGrid.scss";
import type { Field, InstanceKey } from "@itwin/presentation-common";
import { KeySet } from "@itwin/presentation-common";
import { FavoritePropertiesScope, Presentation } from "@itwin/presentation-frontend";
import type { PropertyRecord } from "@itwin/appui-abstract";
import type {
  PropertyData,
  PropertyDataFiltererBase,
  PropertyGridContextMenuArgs,
} from "@itwin/components-react";
import {
  PropertyValueRendererManager,
  VirtualizedPropertyGridWithDataProvider,
} from "@itwin/components-react";
import {
  ContextMenuItem,
  GlobalContextMenu,
  Orientation,
  useOptionalDisposable,
  useResizeObserver,
} from "@itwin/core-react";
import {
  UiFramework,
  useActiveIModelConnection,
} from "@itwin/appui-react";
import type { ReactNode } from "react";
import { IconButton } from "@itwin/itwinui-react";
import { SvgProgressBackwardCircular } from "@itwin/itwinui-icons-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { copyToClipboard } from "../api/WebUtilities";
import { PropertyGridManager } from "../PropertyGridManager";
import type {
  ContextMenuItemInfo,
  OnSelectEventArgs,
  PropertyGridProps,
} from "../types";
import { PropertyGridDefaultContextMenuKey } from "../types";
import {
  FilteringPropertyGridWithUnifiedSelection,
  NonEmptyValuesPropertyDataFilterer,
  PlaceholderPropertyDataFilterer,
} from "./FilteringPropertyGrid";
import classnames from "classnames";
import { AutoExpandingPropertyDataProvider } from "../api/AutoExpandingPropertyDataProvider";
import { getShowNullValuesPreference, saveShowNullValuesPreference } from "../api/ShowNullValuesPreferenceClient";

interface PropertyGridPropsWithSingleElement extends PropertyGridProps {
  instanceKey?: InstanceKey;
}

export const PropertyGrid = ({
  orientation,
  isOrientationFixed,
  enableFavoriteProperties,
  favoritePropertiesScope,
  customOnDataChanged,
  actionButtonRenderers,
  enableCopyingPropertyText,
  enableNullValueToggle,
  persistNullValueToggle,
  enablePropertyGroupNesting,
  additionalContextMenuOptions,
  defaultContextMenuOptions,
  rulesetId,
  rootClassName,
  dataProvider: propDataProvider,
  onBackButton,
  disableUnifiedSelection,
  instanceKey,
  autoExpandChildCategories,
  headerContent,
}: PropertyGridPropsWithSingleElement) => {
  const iModelConnection = useActiveIModelConnection();
  const createDataProvider = useCallback(() => {
    let dp;
    if (propDataProvider) {
      dp = propDataProvider;
    } else if (iModelConnection) {
      dp = new AutoExpandingPropertyDataProvider({
        imodel: iModelConnection,
        ruleset: rulesetId,
        disableFavoritesCategory: !enableFavoriteProperties,
        autoExpandChildCategories,
      });
    }
    if (dp) {
      dp.pagingSize = 50;
      dp.isNestedPropertyCategoryGroupingEnabled =
        !!enablePropertyGroupNesting;

      // Set selected instance as the key (for Single Element Property Grid)
      if (instanceKey) {
        dp.keys = new KeySet([instanceKey]);
      }
    }
    return dp;
  }, [autoExpandChildCategories, propDataProvider, iModelConnection, rulesetId, enableFavoriteProperties, enablePropertyGroupNesting, instanceKey]);

  const dataProvider = useOptionalDisposable(createDataProvider);

  const [title, setTitle] = useState<PropertyRecord>();
  const [className, setClassName] = useState<string>("");
  const [contextMenu, setContextMenu] = useState<PropertyGridContextMenuArgs | undefined>(undefined);
  const [contextMenuItemInfos, setContextMenuItemInfos] = useState<ContextMenuItemInfo[] | undefined>(undefined);
  const [showNullValues, setShowNullValues] = useState<boolean>(true);
  const [filterer, setFilterer] = useState<PropertyDataFiltererBase>(
    new PlaceholderPropertyDataFilterer()
  );

  const [height, setHeight] = useState(0);
  const [width, setWidth] = useState(0);
  const handleResize = useCallback((w: number, h: number) => {
    setHeight(h);
    setWidth(w);
  }, []);
  const ref = useResizeObserver<HTMLDivElement>(handleResize);

  const localizations = useMemo(() => {
    return {
      favorite: PropertyGridManager.translate("context-menu.favorite"),
      removeFavorite: {
        title: PropertyGridManager.translate(
          "context-menu.remove-favorite.description"
        ),
        label: PropertyGridManager.translate(
          "context-menu.remove-favorite.label"
        ),
      },
      addFavorite: {
        title: PropertyGridManager.translate(
          "context-menu.add-favorite.description"
        ),
        label: PropertyGridManager.translate("context-menu.add-favorite.label"),
      },
      copyText: {
        title: PropertyGridManager.translate(
          "context-menu.copy-text.description"
        ),
        label: PropertyGridManager.translate("context-menu.copy-text.label"),
      },
      hideNull: {
        title: PropertyGridManager.translate(
          "context-menu.hide-null.description"
        ),
        label: PropertyGridManager.translate("context-menu.hide-null.label"),
      },
      showNull: {
        title: PropertyGridManager.translate(
          "context-menu.show-null.description"
        ),
        label: PropertyGridManager.translate("context-menu.show-null.label"),
      },
    };
  }, []);

  // If persisting hide/show empty values, get the preference
  useEffect(() => {
    const setDefaultShowNullValues = async () => {
      if (persistNullValueToggle) {
        const res = await getShowNullValuesPreference();
        if (res !== undefined) {
          res ? setFilterer(new PlaceholderPropertyDataFilterer()) : setFilterer(new NonEmptyValuesPropertyDataFilterer());
          setShowNullValues(res);
        }
      }
    };

    void setDefaultShowNullValues();
  }, [persistNullValueToggle]);

  useEffect(() => {
    const onDataChanged = async () => {
      const propertyData: PropertyData | undefined =
        await dataProvider?.getData();
      if (propertyData) {
        setTitle(propertyData?.label);
        setClassName(propertyData?.description ?? "");
        if (dataProvider && customOnDataChanged) {
          await customOnDataChanged(dataProvider);
        }
      }
    };

    const removeListener = dataProvider?.onDataChanged.addListener(onDataChanged);
    void onDataChanged();

    return () => {
      removeListener?.();
    };
  }, [dataProvider, customOnDataChanged]);

  const onAddFavorite = useCallback(
    async (propertyField: Field) => {
      if (iModelConnection) {
        await Presentation.favoriteProperties.add(propertyField, iModelConnection, favoritePropertiesScope ?? FavoritePropertiesScope.IModel);
        setContextMenu(undefined);
      }
    },
    [iModelConnection, favoritePropertiesScope]
  );

  const onRemoveFavorite = useCallback(
    async (propertyField: Field) => {
      if (iModelConnection) {
        await Presentation.favoriteProperties.remove(propertyField, iModelConnection, favoritePropertiesScope ?? FavoritePropertiesScope.IModel);
        setContextMenu(undefined);
      }
    },

    [iModelConnection, favoritePropertiesScope]
  );

  // Fcn for updating toggle for Hide / Show Empty Fields menu options
  const updateShowNullValues = useCallback(async (value: boolean) => {
    // Update filter and reset context menu
    value ? setFilterer(new PlaceholderPropertyDataFilterer()) : setFilterer(new NonEmptyValuesPropertyDataFilterer());
    setContextMenu(undefined);
    setShowNullValues(value);

    // Persist hide/show value
    if (persistNullValueToggle) {
      await saveShowNullValuesPreference(value);
    }
  }, [persistNullValueToggle]);

  const buildContextMenu = useCallback(
    async (args: PropertyGridContextMenuArgs) => {
      if (dataProvider) {
        const field = await dataProvider.getFieldByPropertyRecord(
          args.propertyRecord
        );
        const items: ContextMenuItemInfo[] = [];
        if (enableFavoriteProperties) {
          if (field && iModelConnection) {
            if (Presentation.favoriteProperties.has(field, iModelConnection, favoritePropertiesScope ?? FavoritePropertiesScope.IModel)) {
              items.push({
                key: PropertyGridDefaultContextMenuKey.RemoveFavorite,
                onSelect: async () => onRemoveFavorite(field),
                title: localizations.removeFavorite.title,
                label: localizations.removeFavorite.label,
              });
            } else {
              items.push({
                key: PropertyGridDefaultContextMenuKey.AddFavorite,
                onSelect: async () => onAddFavorite(field),
                title: localizations.addFavorite.title,
                label: localizations.addFavorite.label,
              });
            }
          }
        }

        if (enableCopyingPropertyText) {
          items.push({
            key: PropertyGridDefaultContextMenuKey.CopyText,
            onSelect: () => {
              args.propertyRecord?.description &&
                copyToClipboard(args.propertyRecord.description);
              setContextMenu(undefined);
            },
            title: localizations.copyText.title,
            label: localizations.copyText.label,
          });
        }

        if (enableNullValueToggle) {
          if (showNullValues) {
            items.push({
              key: PropertyGridDefaultContextMenuKey.HideNull,
              onSelect: async () => {
                await updateShowNullValues(false);
              },
              title: localizations.hideNull.title,
              label: localizations.hideNull.label,
            });
          } else {
            items.push({
              key: PropertyGridDefaultContextMenuKey.ShowNull,
              onSelect: async () => {
                await updateShowNullValues(true);
              },
              title: localizations.showNull.title,
              label: localizations.showNull.label,
            });
          }
        }

        if (additionalContextMenuOptions?.length) {
          for (const option of additionalContextMenuOptions) {
            const newItem = {
              ...option,
              key: `additionalContextMenuOption_${option.label}`,
              onSelect: () => {
                if (option.onSelect) {
                  (option.onSelect as (args: OnSelectEventArgs) => void)({
                    contextMenuArgs: args,
                    field,
                    dataProvider,
                  });
                }
                setContextMenu(undefined);
              },
            };
            // If option needs to go in a specific position in the list, put it there. otherwise just push.
            if (option.forcePosition !== undefined) {
              items.splice(option.forcePosition, 0, newItem);
            } else {
              items.push(newItem);
            }
          }
        }

        // Do any overrides on default menu options
        if (defaultContextMenuOptions?.size && defaultContextMenuOptions.size > 0) {
          for (const key of Object.values(PropertyGridDefaultContextMenuKey)) {
            const overrides = defaultContextMenuOptions?.get(key);
            if (overrides) {
              const itemIndex = items.map((item) => item.key).indexOf(key);
              items[itemIndex] = { ...items[itemIndex], ...overrides };
            }
          }
        }

        // Verify all existing options are valid, and if not remove them
        for (let i = items.length - 1; i >= 0; --i) {
          const item = items[i];
          if (item.isValid !== undefined && !item.isValid(args.propertyRecord, field)) {
            items.splice(i, 1);
          }
        }

        setContextMenuItemInfos(items.length > 0 ? items : undefined);
      }
    },
    [
      dataProvider,
      localizations,
      showNullValues,
      updateShowNullValues,
      enableFavoriteProperties,
      favoritePropertiesScope,
      enableCopyingPropertyText,
      enableNullValueToggle,
      additionalContextMenuOptions,
      defaultContextMenuOptions,
      onAddFavorite,
      onRemoveFavorite,
      iModelConnection,
    ]
  );

  const onPropertyContextMenu = useCallback(
    async (args: PropertyGridContextMenuArgs) => {
      args.event.persist();
      setContextMenu(args.propertyRecord.isMerged ? undefined : args);
      await buildContextMenu(args);
    },
    [buildContextMenu]
  );

  const renderContextMenu = () => {
    if (!contextMenu || !contextMenuItemInfos) {
      return undefined;
    }

    const items: ReactNode[] = [];
    contextMenuItemInfos.forEach((info: ContextMenuItemInfo) =>
      items.push(
        <ContextMenuItem
          key={info.key}
          onSelect={info.onSelect}
          title={info.title}
        >
          {info.label}
        </ContextMenuItem>
      )
    );

    return (
      <GlobalContextMenu
        opened={true}
        onOutsideClick={() => {
          setContextMenu(undefined);
        }}
        onEsc={() => {
          setContextMenu(undefined);
        }}
        identifier="PropertiesWidget"
        x={contextMenu.event.clientX}
        y={contextMenu.event.clientY}
      >
        {items}
      </GlobalContextMenu>
    );
  };

  const renderHeader = () => {
    return (
      <div className="property-grid-react-panel-header">
        {onBackButton !== undefined && (
          <IconButton
            id="property-grid-react-element-list-back-btn"
            styleType="borderless"
            onClick={onBackButton}
            onKeyDown={onBackButton}
            tabIndex={0}
            title={PropertyGridManager.translate("tools.backTooltip")}
          >
            <SvgProgressBackwardCircular />
          </IconButton>
        )}
        <div className="property-grid-react-panel-label-and-class">
          <div className="property-grid-react-panel-label">
            {title && PropertyValueRendererManager.defaultManager.render(title)}
          </div>
          <div className="property-grid-react-panel-class">{className}</div>
        </div>
        {headerContent}
      </div>
    );
  };

  const renderPropertyGrid = () => {
    if (!dataProvider) {
      return undefined;
    }

    return (
      <div ref={ref} style={{ width: "100%", height: "100%" }}>
        {disableUnifiedSelection ? (
          <VirtualizedPropertyGridWithDataProvider
            orientation={orientation ?? Orientation.Horizontal}
            isOrientationFixed={isOrientationFixed ?? true}
            dataProvider={dataProvider}
            isPropertyHoverEnabled={true}
            isPropertySelectionEnabled={true}
            onPropertyContextMenu={onPropertyContextMenu}
            actionButtonRenderers={actionButtonRenderers}
            width={width}
            height={height}
          />
        ) : (
          <FilteringPropertyGridWithUnifiedSelection
            orientation={orientation ?? Orientation.Horizontal}
            isOrientationFixed={isOrientationFixed ?? true}
            dataProvider={dataProvider}
            filterer={filterer}
            isPropertyHoverEnabled={true}
            isPropertySelectionEnabled={true}
            onPropertyContextMenu={onPropertyContextMenu}
            actionButtonRenderers={actionButtonRenderers}
            width={width}
            height={height}
            autoExpandChildCategories={autoExpandChildCategories}
          />
        )}
      </div>
    );
  };

  return (
    <div
      className={classnames("property-grid-widget-container", rootClassName)}
    >
      {!!UiFramework.frameworkState?.sessionState?.numItemsSelected && renderHeader()}
      <div className={"property-grid-container"}>{renderPropertyGrid()}</div>
      {renderContextMenu()}
    </div>
  );
};
