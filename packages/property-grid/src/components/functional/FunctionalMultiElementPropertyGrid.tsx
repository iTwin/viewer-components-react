/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "../MultiElementPropertyGrid.scss";

import { InstanceKey, KeySet } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";
import { useActiveIModelConnection } from "@bentley/ui-framework";
import * as React from "react";
import { animated, Transition } from "react-spring/renderprops.cjs";

import { AutoExpandingPropertyDataProvider } from "../../api/AutoExpandingPropertyDataProvider";
import { PropertyGridManager } from "../../PropertyGridManager";
import { PropertyGridWidgetBaseProps } from "../../types";
import { MultiElementPropertyContent } from "../MultiElementPropertyGrid";
import { FunctionalElementList } from "./FunctionalElementList";
import { FunctionalPropertyGridWidget } from "./FunctionalPropertyGridWidget";

interface SinglePropertyGridProps extends PropertyGridWidgetBaseProps {
  instanceKey: InstanceKey;
}

const SingleElementPropertyGrid = ({
  instanceKey,
  ...props
}: SinglePropertyGridProps) => {
  const iModelConnection = useActiveIModelConnection();
  const dataProvider = React.useMemo(() => {
    let dp;

    if (iModelConnection) {
      dp = new AutoExpandingPropertyDataProvider({
        imodel: iModelConnection,
        ruleset: props.rulesetId,
        disableFavoritesCategory: !props.enableFavoriteProperties,
      });
    }

    if (dp) {
      dp.pagingSize = 50;
      dp.isNestedPropertyCategoryGroupingEnabled =
        !!PropertyGridManager.flags.enablePropertyGroupNesting;
      // Set inspected instance as the key
      dp.keys = new KeySet([instanceKey]);
    }

    return dp;
  }, [
    iModelConnection,
    props.rulesetId,
    props.enableFavoriteProperties,
    instanceKey,
  ]);

  return (
    <FunctionalPropertyGridWidget
      {...props}
      dataProvider={dataProvider}
      disableUnifiedSelection={true}
    />
  );
};

export const FunctionalMultiElementPropertyGrid = (
  props: PropertyGridWidgetBaseProps
) => {
  const iModelConnection = useActiveIModelConnection();
  const [content, setContent] = React.useState<MultiElementPropertyContent>(
    MultiElementPropertyContent.PropertyGrid
  );
  const [animationForward, setAnimationForward] = React.useState(true);
  const [instanceKeys, setInstanceKeys] = React.useState<InstanceKey[]>([]);
  const [moreThanOneElement, setMoreThanOneElement] = React.useState(false);
  const [selectedInstanceKey, setSelectedInstanceKey] =
    React.useState<InstanceKey>();

  React.useEffect(() => {
    const onSelectionChange = () => {
      setContent(MultiElementPropertyContent.PropertyGrid);
      setAnimationForward(false);
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

    Presentation.selection.selectionChange.addListener(onSelectionChange);
    return () => {
      Presentation.selection.selectionChange.removeListener(onSelectionChange);
    };
  }, [iModelConnection]);

  const onOpenList = () => {
    setContent(MultiElementPropertyContent.ElementList);
    setAnimationForward(true);
  };

  const onCloseList = () => {
    setContent(MultiElementPropertyContent.PropertyGrid);
    setAnimationForward(false);
  };

  const onSelectElement = (instanceKey: InstanceKey) => {
    setContent(MultiElementPropertyContent.SingleElementPropertyGrid);
    setAnimationForward(true);
    setSelectedInstanceKey(instanceKey);
  };

  const onCloseSinglePropertyGrid = () => {
    setContent(MultiElementPropertyContent.ElementList);
    setAnimationForward(false);
  };

  const items = [
    <FunctionalPropertyGridWidget
      {...props}
      key={"PropertyGrid"}
      onInfoButton={moreThanOneElement ? onOpenList : undefined}
    />,
  ];
  if (iModelConnection) {
    items.push(
      <FunctionalElementList
        iModelConnection={iModelConnection}
        instanceKeys={instanceKeys}
        onBack={onCloseList}
        onSelect={onSelectElement}
        rootClassName={props.rootClassName}
        key={"ElementList"}
      />
    );
  }
  if (selectedInstanceKey) {
    items.push(
      <SingleElementPropertyGrid
        {...props}
        instanceKey={selectedInstanceKey}
        onBackButton={onCloseSinglePropertyGrid}
        key={"SingleElementPropertyGrid"}
      />
    );
  }

  return (
    <div className="property-grid-react-transition-container">
      <Transition
        items={content as number}
        config={{ duration: 200, easing: (t: number) => t * t }}
        from={{
          transform: animationForward
            ? "translate(100%,0)"
            : "translate(-100%,0)",
        }}
        enter={{ transform: "translate(0,0)" }}
        leave={{
          transform: !animationForward
            ? "translate(100%,0)"
            : "translate(-100%,0)",
        }}
      >
        {(index) => (style) =>
          (
            <animated.div
              className="property-grid-react-animated-tab"
              style={style}
            >
              {items[index]}
            </animated.div>
          )}
      </Transition>
    </div>
  );
};
