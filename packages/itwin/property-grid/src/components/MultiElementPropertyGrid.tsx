/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./MultiElementPropertyGrid.scss";

import type { InstanceKey } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import {
  useActiveFrontstageDef,
  useActiveIModelConnection,
} from "@itwin/appui-react";

import type { PropertyGridProps } from "../types";
import { ElementList } from "./ElementList";
import { PropertyGrid } from "./PropertyGrid";
import React, { useEffect, useMemo, useState } from "react";
import classnames from "classnames";
import { WidgetState } from "@itwin/appui-abstract";
import { Id64 } from "@itwin/core-bentley";

enum MultiElementPropertyContent {
  PropertyGrid = 0,
  ElementList = 1,
  SingleElementPropertyGrid = 2,
}

function useSpecificWidgetDef(id: string) {
  const frontstageDef = useActiveFrontstageDef();
  return frontstageDef?.findWidgetDef(id);
}

export const MultiElementPropertyGridId = "vcr:MultiElementPropertyGrid";

export const MultiElementPropertyGrid = (props: PropertyGridProps) => {
  const iModelConnection = useActiveIModelConnection();
  const [content, setContent] = useState<MultiElementPropertyContent>(
    MultiElementPropertyContent.PropertyGrid
  );
  const [instanceKeys, setInstanceKeys] = useState<InstanceKey[]>([]);
  const [moreThanOneElement, setMoreThanOneElement] = useState(false);
  const [selectedInstanceKey, setSelectedInstanceKey] =
    useState<InstanceKey>();
  const widgetDef = useSpecificWidgetDef(MultiElementPropertyGridId);

  useEffect(() => {
    const onSelectionChange = () => {
      setContent(MultiElementPropertyContent.PropertyGrid);
      if (iModelConnection) {
        const selectionSet =
          Presentation.selection.getSelection(iModelConnection);
        const instanceKeys: InstanceKey[] = [];
        selectionSet.instanceKeys.forEach(
          (ids: Set<string>, className: string) => {
            ids.forEach((id: string) => {
              instanceKeys.push({
                id,
                className,
              });
            });
          }
        );
        setInstanceKeys(instanceKeys);
        setMoreThanOneElement(selectionSet.instanceKeysCount > 1);
        setSelectedInstanceKey(undefined);
      }
    };

    const removeListener = Presentation.selection.selectionChange.addListener(onSelectionChange);
    return () => removeListener();
  }, [iModelConnection]);

  const items = [
    ...useMemo(() => {
      const _items = [
        <PropertyGrid
          {...props}
          onInfoButton={
            moreThanOneElement
              ? () => {
                setContent(MultiElementPropertyContent.ElementList);
              }
              : undefined
          }
          key={"PropertyGrid"}
        />,
      ];
      if (iModelConnection) {
        _items.push(
          <ElementList
            iModelConnection={iModelConnection}
            instanceKeys={instanceKeys}
            onBack={() => {
              setContent(MultiElementPropertyContent.PropertyGrid);
            }}
            onSelect={(instanceKey: InstanceKey) => {
              setContent(MultiElementPropertyContent.SingleElementPropertyGrid);
              setSelectedInstanceKey(instanceKey);
            }}
            rootClassName={props.rootClassName}
            key={"ElementList"}
          />
        );
      }

      return _items;
    }, [props, moreThanOneElement, iModelConnection, instanceKeys]),
  ];

  items.push(
    <PropertyGrid
      {...props}
      instanceKey={selectedInstanceKey}
      disableUnifiedSelection={true}
      onBackButton={() => {
        setContent(MultiElementPropertyContent.ElementList);
      }}
      key={"SingleElementPropertyGrid"}
    />
  );

  useEffect(() => {
    if (instanceKeys.some((key) => !Id64.isTransient(key.id))) {
      widgetDef?.setWidgetState(WidgetState.Open);
    } else {
      widgetDef?.setWidgetState(WidgetState.Hidden);
    }
  }, [widgetDef, instanceKeys]);

  return (
    <div className="property-grid-react-transition-container">
      <div className="property-grid-react-transition-container-inner">
        {items.map((component, idx) => (
          <div key={component.key} className={classnames({
            "property-grid-react-animated-tab": true,
            "property-grid-react-animated-tab-animate-right": idx > content,
            "property-grid-react-animated-tab-animate-left": idx < content,
          })} >
            { component }
          </div>
        ))}
      </div>
    </div>
  );
};
