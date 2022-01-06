/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./PropertyGrid.scss";
import { Field } from "@itwin/presentation-common";
import { FavoritePropertiesScope, Presentation } from "@itwin/presentation-frontend";
import { PropertyRecord } from "@itwin/appui-abstract";
import {
  PropertyData,
  PropertyDataFiltererBase,
  PropertyGridContextMenuArgs,
  PropertyValueRendererManager,
  VirtualizedPropertyGridWithDataProvider,
} from "@itwin/components-react";
import {
  ContextMenuItem,
  GlobalContextMenu,
  Icon,
  Orientation,
  useResizeObserver,
} from "@itwin/core-react";
import {
  ConfigurableCreateInfo,
  useActiveIModelConnection,
  WidgetControl,
} from "@itwin/appui-react";
import * as React from "react";

import { copyToClipboard } from "../api/WebUtilities";
import { PropertyGridManager } from "../PropertyGridManager";
import {
  ContextMenuItemInfo,
  OnSelectEventArgs,
  PropertyGridProps,
} from "../types";
import {
  FilteringPropertyGridWithUnifiedSelection,
  NonEmptyValuesPropertyDataFilterer,
  PlaceholderPropertyDataFilterer,
} from "./FilteringPropertyGrid";
import classnames from "classnames";
import { AutoExpandingPropertyDataProvider } from "../api/AutoExpandingPropertyDataProvider";

export const PropertyGrid = ({
  orientation,
  isOrientationFixed,
  enableFavoriteProperties,
  favoritePropertiesScope,
  enableCopyingPropertyText,
  enableNullValueToggle,
  enablePropertyGroupNesting,
  additionalContextMenuOptions,
  rulesetId,
  rootClassName,
  dataProvider: propDataProvider,
  onInfoButton,
  onBackButton,
  disableUnifiedSelection,
}: PropertyGridProps) => {
  const iModelConnection = useActiveIModelConnection();

  const dataProvider = React.useMemo(() => {
    let dp;
    if (propDataProvider) {
      dp = propDataProvider;
    } else if (iModelConnection) {
      dp = new AutoExpandingPropertyDataProvider({
        imodel: iModelConnection,
        ruleset: rulesetId,
        disableFavoritesCategory: !enableFavoriteProperties,
      });
    }

    if (dp) {
      dp.pagingSize = 50;
      dp.isNestedPropertyCategoryGroupingEnabled =
        !!enablePropertyGroupNesting;
    }
    return dp;
  }, [propDataProvider, iModelConnection, rulesetId, enableFavoriteProperties, enablePropertyGroupNesting]);

  const [title, setTitle] = React.useState<PropertyRecord>();
  const [className, setClassName] = React.useState<string>("");
  const [contextMenu, setContextMenu] = React.useState<
    PropertyGridContextMenuArgs | undefined
  >(undefined);
  const [contextMenuItemInfos, setContextMenuItemInfos] = React.useState<
    ContextMenuItemInfo[] | undefined
  >(undefined);
  const [showNullValues, setShowNullValues] = React.useState<boolean>(true);
  const [filterer, setFilterer] = React.useState<PropertyDataFiltererBase>(
    new PlaceholderPropertyDataFilterer()
  );

  const [height, setHeight] = React.useState(0);
  const [width, setWidth] = React.useState(0);
  const handleResize = React.useCallback((w: number, h: number) => {
    setHeight(h);
    setWidth(w);
  }, []);
  const ref = useResizeObserver<HTMLDivElement>(handleResize);

  const localizations = React.useMemo(() => {
    return {
      favorite: PropertyGridManager.translate("context-menu.favorite"),
      unshareFavorite: {
        title: PropertyGridManager.translate(
          "context-menu.unshare-favorite.description"
        ),
        label: PropertyGridManager.translate(
          "context-menu.unshare-favorite.label"
        ),
      },
      shareFavorite: {
        title: PropertyGridManager.translate(
          "context-menu.share-favorite.description"
        ),
        label: PropertyGridManager.translate(
          "context-menu.share-favorite.label"
        ),
      },
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

  React.useEffect(() => {
    const onDataChanged = async () => {
      let propertyData: PropertyData | undefined =
        await dataProvider?.getData();
      if (propertyData) {
        setTitle(propertyData?.label);
        setClassName(propertyData?.description ?? "");
      }
    };

    dataProvider?.onDataChanged.addListener(onDataChanged);
    void onDataChanged();

    return () => {
      dataProvider?.onDataChanged.removeListener(onDataChanged);
      dataProvider?.dispose();
    };
  }, [dataProvider]);

  const onAddFavorite = React.useCallback(
    async (propertyField: Field) => {
      if (iModelConnection) {
        await Presentation.favoriteProperties.add(propertyField, iModelConnection, favoritePropertiesScope ?? FavoritePropertiesScope.IModel);
        setContextMenu(undefined);
      }
    },
    [iModelConnection, favoritePropertiesScope]
  );

  const onRemoveFavorite = React.useCallback(
    async (propertyField: Field) => {
      if (iModelConnection) {
        await Presentation.favoriteProperties.remove(propertyField, iModelConnection, favoritePropertiesScope ?? FavoritePropertiesScope.IModel);
        setContextMenu(undefined);
      }
    },

    [iModelConnection, favoritePropertiesScope]
  );

  const onHideNull = React.useCallback(() => {
    setFilterer(new NonEmptyValuesPropertyDataFilterer());
    setContextMenu(undefined);
    setShowNullValues(false);
  }, []);

  const onShowNull = React.useCallback(() => {
    setFilterer(new PlaceholderPropertyDataFilterer());
    setContextMenu(undefined);
    setShowNullValues(true);
  }, []);

  const buildContextMenu = React.useCallback(
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
                key: "remove-favorite",
                onSelect: async () => onRemoveFavorite(field),
                title: localizations.removeFavorite.title,
                label: localizations.removeFavorite.label,
              });
            } else {
              items.push({
                key: "add-favorite",
                onSelect: async () => onAddFavorite(field),
                title: localizations.addFavorite.title,
                label: localizations.addFavorite.label,
              });
            }
          }
        }

        if (enableCopyingPropertyText) {
          items.push({
            key: "copy-text",
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
              key: "hide-null",
              onSelect: () => {
                onHideNull();
              },
              title: localizations.hideNull.title,
              label: localizations.hideNull.label,
            });
          } else {
            items.push({
              key: "show-null",
              onSelect: () => {
                onShowNull();
              },
              title: localizations.showNull.title,
              label: localizations.showNull.label,
            });
          }
        }

        if (additionalContextMenuOptions?.length) {
          for (const option of additionalContextMenuOptions) {
            items.push({
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
            });
          }
        }

        setContextMenuItemInfos(items.length > 0 ? items : undefined);
      }
    },
    [
      dataProvider,
      localizations,
      showNullValues,
      enableFavoriteProperties,
      enableCopyingPropertyText,
      enableNullValueToggle,
      additionalContextMenuOptions,
      onAddFavorite,
      onRemoveFavorite,
      onHideNull,
      onShowNull,
    ]
  );

  const onPropertyContextMenu = React.useCallback(
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

    const items: React.ReactNode[] = [];
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
          <div
            className="property-grid-react-panel-back-btn"
            onClick={onBackButton}
          >
            <Icon
              className="property-grid-react-panel-icon"
              iconSpec="icon-progress-backward"
            />
          </div>
        )}
        <div className="property-grid-react-panel-label-and-class">
          <div className="property-grid-react-panel-label">
            {title && PropertyValueRendererManager.defaultManager.render(title)}
          </div>
          <div className="property-grid-react-panel-class">{className}</div>
        </div>
        {onInfoButton !== undefined && (
          <div
            className="property-grid-react-panel-info-btn"
            onClick={onInfoButton}
            title={PropertyGridManager.translate("element-list.title")}
          >
            <Icon
              className="property-grid-react-panel-icon"
              iconSpec="icon-info-hollow"
            />
          </div>
        )}
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
            width={width}
            height={height}
          />
        )}
      </div>
    )
  };

  return (
    <div
      className={classnames("property-grid-widget-container", rootClassName)}
    >
      {renderHeader()}
      <div className={"property-grid-container"}>{renderPropertyGrid()}</div>
      {renderContextMenu()}
    </div>
  );
};

export class PropertyGridWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactNode = <PropertyGrid {...options} />;
  }
}
