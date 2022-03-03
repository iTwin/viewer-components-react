/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./MultiElementPropertyGrid.scss";

import type { InstanceKey } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import type { ConfigurableCreateInfo } from "@itwin/appui-react";
import {
  useActiveIModelConnection,
  WidgetControl,
} from "@itwin/appui-react";

import type { PropertyGridProps } from "../types";
import { ElementList } from "./ElementList";
import { PropertyGrid } from "./PropertyGrid";
import React, { useEffect, useMemo, useState } from "react";

enum MultiElementPropertyContent {
  PropertyGrid = 0,
  ElementList = 1,
  SingleElementPropertyGrid = 2,
}

export const MultiElementPropertyGrid = (props: PropertyGridProps) => {
  const iModelConnection = useActiveIModelConnection();
  const [content, setContent] = useState<MultiElementPropertyContent>(
    MultiElementPropertyContent.PropertyGrid
  );
  const [instanceKeys, setInstanceKeys] = useState<InstanceKey[]>([]);
  const [moreThanOneElement, setMoreThanOneElement] = useState(false);
  const [selectedInstanceKey, setSelectedInstanceKey] =
    useState<InstanceKey>();

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

  // since css animation requires all react components be rendered - just move non-active components to the side
  const getAnimationStyle = (idx: MultiElementPropertyContent.PropertyGrid) => {
    let style: React.CSSProperties;

    if (idx === content) {
      style = { transform: "translate(0,0)" };
    } else if (idx === MultiElementPropertyContent.PropertyGrid ||
        (idx === MultiElementPropertyContent.ElementList  && content === MultiElementPropertyContent.SingleElementPropertyGrid)
    ) {
      style = { transform: "translate(-100%,0)" };
    } else {
      style = { transform: "translate(100%,0)" };
    }

    return style;
  };

  return (
    <div className="property-grid-react-transition-container">
      <div className="property-grid-react-transition-container-inner">
        {items.map((component, idx) => (
          <div className="property-grid-react-animated-tab" style={getAnimationStyle(idx)} key={component.key}>
            { component }
          </div>
        ))}
      </div>
    </div>
  );
};

export class MultiElementPropertyGridWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: PropertyGridProps) {
    super(info, options);

    this.reactNode = <MultiElementPropertyGrid {...options} />;
  }
}
