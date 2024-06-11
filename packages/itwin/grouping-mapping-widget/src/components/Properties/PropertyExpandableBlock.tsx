import type { ExpandableBlockProps } from "@itwin/itwinui-react";
import { ExpandableBlock } from "@itwin/itwinui-react";
import React, { forwardRef } from "react";

interface PropertyExpandableBlockProps extends ExpandableBlockProps {
    children: React.ReactNode;
}

export const PropertyExpandableBlock = forwardRef<HTMLDivElement, PropertyExpandableBlockProps>(function PropertyExpandableBlockWithRef(props, ref) {
    return (
        <div ref={ref}>
            <ExpandableBlock {...props}>
                {props.children}
            </ExpandableBlock>
        </div>
    );
});


