/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/


import "./PropertyGrid.scss";

import * as React from "react";

import {
  AuthorizedFrontendRequestContext,
  IModelApp,
} from "@bentley/imodeljs-frontend";
import { Field } from "@bentley/presentation-common";
import { PresentationPropertyDataProvider } from "@bentley/presentation-components";
import {
  FavoritePropertiesScope,
  Presentation,
} from "@bentley/presentation-frontend";
import {
  ActionButtonRenderer,
  ActionButtonRendererProps,
  PropertyData,
  PropertyDataFiltererBase,
  PropertyGridContextMenuArgs,
  PropertyValueRendererManager,
  VirtualizedPropertyGridWithDataProvider,
} from "@bentley/ui-components";
import {
  ContextMenuItem,
  GlobalContextMenu,
  Icon,
  Orientation,
} from "@bentley/ui-core";
import { useActiveIModelConnection } from "@bentley/ui-framework";
import { PropertyGridManager } from "../PropertyGridManager";
import { SettingsStatus } from "@bentley/product-settings-client";
import { PropertyRecord } from "@bentley/ui-abstract";

import {
  FilteringPropertyGridWithUnifiedSelection,
  NonEmptyValuesPropertyDataFilterer,
  PlaceholderPropertyDataFilterer,
} from "./FilteringPropertyGrid";
import { copyToClipboard } from "../api/WebUtilities";
import {
  ContextMenuItemInfo,
  OnSelectEventArgs,
  PropertyGridWidgetBaseProps,
  SharedName,
  SharedNamespace,
  UseDataProviderProps,
} from "../types";

const useDataProvider = (
  props: UseDataProviderProps
): PresentationPropertyDataProvider | undefined => {
  // const [dataProvider, setDataProvider] = React.useState(props.dataProvider);

  // React.useEffect(() => {
  //   if (!dataProvider && props.dataProviderProps?.imodel) {
  //     setDataProvider(
  //       new PresentationPropertyDataProvider(props.dataProviderProps)
  //     );
  //   }
  // }, [props.dataProviderProps]);

  // React.useEffect(() => {
  //   if (dataProvider) {
  //     dataProvider.pagingSize = 50;
  //     dataProvider.isNestedPropertyCategoryGroupingEnabled =
  //       !!PropertyGridManager.flags.enablePropertyGroupNesting;
  //   }
  // }, [dataProvider]);

  const dataProvider = React.useMemo(() => {
    let dp;
    if (props.dataProvider) {
      dp = props.dataProvider;
    } else if (props.dataProviderProps?.imodel) {
      dp = new PresentationPropertyDataProvider(props.dataProviderProps);
    }

    if (dp) {
      dp.pagingSize = 50;
      dp.isNestedPropertyCategoryGroupingEnabled =
        !!PropertyGridManager.flags.enablePropertyGroupNesting;
    }
    return dp;
  }, [props.dataProviderProps]);

  return dataProvider;
};

export const FunctionalPropertyGridWidget = ({
  orientation,
  isOrientationFixed,
  enableFavoriteProperties,
  enableCopyingPropertyText,
  enableNullValueToggle,
  additionalContextMenuOptions,
  rulesetId,
  rootClassName,
  dataProvider: propDataProvider,
  onInfoButton,
  onBackButton,
  disableUnifiedSelection,
}: PropertyGridWidgetBaseProps) => {
  const iModelConnection = useActiveIModelConnection();
  if (!iModelConnection) {
    return null;
  }

  const projectId = iModelConnection.contextId;
  const iModelId = iModelConnection.iModelId;

  const dataProvider = useDataProvider({
    dataProvider: propDataProvider,
    dataProviderProps: {
      imodel: iModelConnection,
      ruleset: rulesetId,
      disableFavoritesCategory: !enableFavoriteProperties,
    },
  });
  // if (!dataProvider) {
  //   return null;
  // }

  const [title, setTitle] = React.useState<PropertyRecord>();
  const [className, setClassName] = React.useState<string>("");
  const [contextMenu, setContextMenu] = React.useState<
    PropertyGridContextMenuArgs | undefined
  >(undefined);
  const [contextMenuItemInfos, setContextMenuItemInfos] = React.useState<
    ContextMenuItemInfo[] | undefined
  >(undefined);
  const [sharedFavorites, setSharedFavorites] = React.useState<string[]>([]);
  const [showNullValues, setShowNullValues] = React.useState<boolean>(true);
  const [filterer, setFilterer] = React.useState<PropertyDataFiltererBase>(
    new PlaceholderPropertyDataFilterer()
  );

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
      tooManySelected: PropertyGridManager.translate(
        "context-menu.selection.too-many-elements-selected"
      ),
      noneSelected: PropertyGridManager.translate(
        "context-menu.selection.no-elements-selected"
      ),
    };
  }, []);

  /**
   * Finds the name of the Favorites category
   * @param propertyRecords
   */
  const getFavoritesCategoryName = React.useCallback(
    async (categories: {
      [categoryName: string]: PropertyRecord[];
    }): Promise<string> => {
      const keys = Object.keys(categories);

      for (const key of keys) {
        const category = categories[key];

        for (const record of category) {
          const field = await dataProvider?.getFieldByPropertyRecord(record);
          if (
            field !== undefined &&
            Presentation.favoriteProperties.has(field, projectId)
          ) {
            return key;
          }
        }
      }
      return "Favorite";
    },
    [dataProvider, projectId]
  );

  const addSharedFavsToData = React.useCallback(
    async (propertyData: PropertyData) => {
      if (!enableFavoriteProperties) {
        return propertyData;
      }

      let newSharedFavs: string[] = [];
      if (projectId) {
        const requestContext = await AuthorizedFrontendRequestContext.create();
        const result = await IModelApp.settings.getSharedSetting(
          requestContext,
          SharedNamespace,
          SharedName,
          false,
          projectId,
          iModelId
        );
        if (result.setting?.slice) {
          newSharedFavs = (result.setting as string[]).slice();
        }
        setSharedFavorites(newSharedFavs);
      }
      if (propertyData.categories[0]?.name !== "Favorite") {
        propertyData.categories.unshift({
          name: "Favorite",
          label: "Favorite",
          expand: true,
        });
        propertyData.records.Favorite = [];
      }
      const favoritesCategoryName = await getFavoritesCategoryName(
        propertyData.records
      );
      const dataFavs = propertyData.records[favoritesCategoryName];

      for (const cat of propertyData.categories) {
        if (cat.name !== "Favorite") {
          for (const rec of propertyData.records[cat.name]) {
            const propName = rec.property.name;
            const shared =
              newSharedFavs &&
              newSharedFavs?.findIndex(
                (fav: string) => rec.property.name === fav
              ) >= 0;
            if (
              shared &&
              !dataFavs.find(
                (favRec: PropertyRecord) => favRec.property.name === propName
              )
            ) {
              // if shared & not already in favorites
              dataFavs.push(rec);
              const propertyField =
                await dataProvider?.getFieldByPropertyRecord(rec);
              if (propertyField) {
                await Presentation.favoriteProperties.add(
                  propertyField,
                  projectId
                );
              }
            }
          }
        }
      }
      return dataProvider?.getData();
    },
    [
      enableFavoriteProperties,
      projectId,
      iModelId,
      getFavoritesCategoryName,
      dataProvider,
    ]
  );

  const onDataChanged = React.useCallback(async () => {
    let propertyData: PropertyData | undefined = await dataProvider?.getData();
    if (propertyData) {
      propertyData = await addSharedFavsToData(propertyData);
      setTitle(propertyData?.label);
      setClassName(propertyData?.description ?? "");
    }
    console.log("some change");
  }, [dataProvider, addSharedFavsToData]);

  React.useEffect(() => {
    // const onDataChanged = async () => {
    //   let propertyData: PropertyData | undefined =
    //     await dataProvider?.getData();
    //   if (propertyData) {
    //     propertyData = await addSharedFavsToData(propertyData);
    //     setTitle(propertyData?.label);
    //     setClassName(propertyData?.description ?? "");
    //   }
    //   console.log("some change");
    // };

    dataProvider?.onDataChanged.addListener(onDataChanged);

    return () => {
      dataProvider?.onDataChanged.removeListener(onDataChanged);
      dataProvider?.dispose();
    };
  }, [dataProvider, onDataChanged]);

  const onAddFavorite = React.useCallback(
    async (propertyField: Field) => {
      await Presentation.favoriteProperties.add(propertyField, projectId);
      setContextMenu(undefined);
    },
    [projectId]
  );

  const onRemoveFavorite = React.useCallback(
    async (propertyField: Field) => {
      await Presentation.favoriteProperties.remove(propertyField, projectId);
      setContextMenu(undefined);
    },
    [projectId]
  );

  const onShareFavorite = React.useCallback(
    async (propName: string) => {
      if (!projectId || !sharedFavorites) {
        setContextMenu(undefined);
        return;
      }
      sharedFavorites.push(propName);

      const requestContext = await AuthorizedFrontendRequestContext.create();
      const result = await IModelApp.settings.saveSharedSetting(
        requestContext,
        sharedFavorites,
        SharedNamespace,
        SharedName,
        false,
        projectId,
        iModelId
      );
      if (result.status !== SettingsStatus.Success) {
        throw new Error(
          "Could not share favoriteProperties: " + result.errorMessage
        );
      }
      const result2 = await IModelApp.settings.getSharedSetting(
        requestContext,
        SharedNamespace,
        SharedName,
        false,
        projectId,
        iModelId
      );
      if (result2.status !== SettingsStatus.Success) {
        throw new Error(
          "Could not share favoriteProperties: " + result2.errorMessage
        );
      }
      setContextMenu(undefined);
    },
    [sharedFavorites, projectId, iModelId]
  );

  const onUnshareFavorite = React.useCallback(
    async (propName: string) => {
      if (!projectId || !sharedFavorites) {
        setContextMenu(undefined);
        return;
      }
      const index = sharedFavorites.indexOf(propName);
      if (index > -1) {
        sharedFavorites.splice(index, 1);
      }
      const requestContext = await AuthorizedFrontendRequestContext.create();
      const result = await IModelApp.settings.saveSharedSetting(
        requestContext,
        sharedFavorites,
        SharedNamespace,
        SharedName,
        false,
        projectId,
        iModelId
      );
      if (result.status !== SettingsStatus.Success) {
        throw new Error(
          "Could not unshare favoriteProperties: " + result.errorMessage
        );
      }
      setContextMenu(undefined);
    },
    [sharedFavorites, projectId, iModelId]
  );

  const shareActionButtonRenderer: ActionButtonRenderer = (
    props: ActionButtonRendererProps
  ) => {
    const shared =
      sharedFavorites !== undefined &&
      sharedFavorites?.findIndex(
        (fav: string) => props.property.property.name === fav
      ) >= 0;
    return (
      <div>
        {shared && (
          <span className="icon icon-share" style={{ paddingRight: "5px" }} />
        )}
      </div>
    );
  };

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
          if (field) {
            if (
              sharedFavorites &&
              sharedFavorites?.findIndex(
                (fav: string) => args.propertyRecord.property.name === fav
              ) >= 0
            ) {
              // i.e. if shared
              items.push({
                key: "unshare-favorite",
                onSelect: async () =>
                  onUnshareFavorite(args.propertyRecord.property.name),
                title: localizations.unshareFavorite.title,
                label: localizations.unshareFavorite.label,
              });
            } else if (Presentation.favoriteProperties.has(field, projectId)) {
              items.push({
                key: "share-favorite",
                onSelect: async () =>
                  onShareFavorite(args.propertyRecord.property.name),
                title: localizations.shareFavorite.title,
                label: localizations.shareFavorite.label,
              });
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
      sharedFavorites,
      projectId,
      showNullValues,
      enableFavoriteProperties,
      enableCopyingPropertyText,
      enableNullValueToggle,
      onAddFavorite,
      onRemoveFavorite,
      onShareFavorite,
      onUnshareFavorite,
      onHideNull,
      onShowNull,
    ]
  );

  const onPropertyContextMenu = React.useCallback(
    (args: PropertyGridContextMenuArgs) => {
      args.event.persist();
      setContextMenu(args.propertyRecord.isMerged ? undefined : args);
      buildContextMenu(args);
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
    console.count("renderPropertyGrid");
    if (disableUnifiedSelection) {
      return (
        <VirtualizedPropertyGridWithDataProvider
          orientation={orientation ?? Orientation.Horizontal}
          isOrientationFixed={isOrientationFixed ?? true}
          dataProvider={dataProvider}
          isPropertyHoverEnabled={true}
          isPropertySelectionEnabled={true}
          onPropertyContextMenu={onPropertyContextMenu}
          actionButtonRenderers={[shareActionButtonRenderer]}
        />
      );
    } else {
      return (
        <div className="filtering-property-grid-with-unified-selection">
          <FilteringPropertyGridWithUnifiedSelection
            orientation={orientation ?? Orientation.Horizontal}
            isOrientationFixed={isOrientationFixed ?? true}
            dataProvider={dataProvider}
            filterer={filterer}
            isPropertyHoverEnabled={true}
            isPropertySelectionEnabled={true}
            onPropertyContextMenu={onPropertyContextMenu}
            actionButtonRenderers={[shareActionButtonRenderer]}
          />
        </div>
      );
    }
  };

  return (
    // <div className="property-grid-widget-container">
    <div className={rootClassName}>
      {renderHeader()}
      {/* <div className="property-grid-container"> */}
      {renderPropertyGrid()}
      {/* </div> */}
      {renderContextMenu()}
    </div>
  );
};
