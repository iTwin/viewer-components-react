/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import React, { useState } from "react";

import { ExpandableBlock } from "@itwin/itwinui-react";

import styles from "./ExpandableBlockWrapper.module.scss";

export function ExpandableBlockWrapper(props: {title: string, className?: string, isCollapsed?: boolean, children: any}) {

  const [isExpanded, setIsExpanded] = useState<boolean>(!props.isCollapsed);

  return (
    <ExpandableBlock
      className={`${styles["block-wrapper"]} ${props.className}`}
      title={props.title}
      size="small"
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded((isExpanded: boolean) => !isExpanded)}>
      <div className={styles["content-wrapper"]}>
        { props.children }
      </div>
    </ExpandableBlock>
  );
}
