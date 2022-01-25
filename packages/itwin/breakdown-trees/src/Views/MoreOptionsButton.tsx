/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IconButton } from "./IconButton";
import * as React from "react";
import classnames from "classnames";
import { BreakdownTrees } from "../BreakdownTrees";
import { ContextMenuItem, Icon, Popup } from "@itwin/core-react";
import type { OptionItemHandler } from "./OptionItemHandlers/OptionItemHandler";
import { RelativePosition } from "@itwin/appui-abstract";
import styles from "./MoreOptionsButton.module.scss";

export interface MoreOptionsButtonProps {
  optionItems: OptionItemHandler[];
}

export const MoreOptionsButton: React.FC<MoreOptionsButtonProps> = (props: MoreOptionsButtonProps) => {
  const [displayDropdown, setDisplayDropdown] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const getOptionMenu = React.useCallback((): React.ReactNode[] => {
    const items: React.ReactNode[] = [];
    props.optionItems.forEach((optionHandler: OptionItemHandler) => {
      items.push(
        <div key={optionHandler.key} className={styles.itemContainer}>
          <ContextMenuItem
            key={optionHandler.key}
            icon={optionHandler.toolIcon}
            className={styles.popupItem}
            onClick={() => {
              optionHandler.toggle();
              setDisplayDropdown(false);
            }}
          >
            {optionHandler.label}
          </ContextMenuItem>
          {optionHandler.getIsActive() && (<Icon iconSpec="icon-checkmark" className={styles.iconCheckmark} />)}
        </div>,
      );
    });
    return items;
  }, [props.optionItems]);

  return (<div ref={dropdownRef} className={styles.meatballButtonContainer}>
    <IconButton
      key="drop-down-button"
      icon="icon-more-2"
      className={classnames("toolbar-icon", "right")}
      onClick={() => setDisplayDropdown(!displayDropdown)}
      title={BreakdownTrees.translate("contextMenu.moreOptions")}
    />
    <div>
      <Popup
        className={styles.popup}
        isOpen={displayDropdown}
        target={dropdownRef.current}
        onOutsideClick={() => {
          setDisplayDropdown(false);
        }}
        position={RelativePosition.BottomRight}
        offset={0}
      >
        {getOptionMenu()}
      </Popup>
    </div>
  </div>
  );
};
