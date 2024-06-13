/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { ExpandableBlockProps } from "@itwin/itwinui-react";
import { ExpandableBlock } from "@itwin/itwinui-react";
import React, { forwardRef, useCallback } from "react";
import { useForwardRef } from "./hooks/useForwardRef";

interface ScrollableExpandableBlockProps extends ExpandableBlockProps {
  parentRef?: React.RefObject<HTMLDivElement>;
  children: React.ReactNode;
}

export const ScrollableExpandableBlock = forwardRef<HTMLDivElement, ScrollableExpandableBlockProps>(function PropertyExpandableBlockWithRef(props, forwardRef) {
  const { parentRef, children, ...rest } = props;
  const forwardedRef = useForwardRef<HTMLDivElement>(forwardRef);

  const scrollToBlock = useCallback(() => {
    setTimeout(() => {
      if (parentRef?.current && forwardedRef.current) {
        parentRef?.current.scrollTo({
          top: forwardedRef.current.offsetTop,
          behavior: "smooth",
        });
      }
    }, 500);
  }, [forwardedRef, parentRef]);

  const handleToggle = useCallback(
    (isExpanding: boolean) => {
      if (isExpanding === true) scrollToBlock();
    },
    [scrollToBlock],
  );

  return (
    <div ref={forwardedRef}>
      <ExpandableBlock onToggle={handleToggle} {...rest}>
        {children}
      </ExpandableBlock>
    </div>
  );
});
