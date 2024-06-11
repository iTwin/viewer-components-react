import type { ExpandableBlockProps } from "@itwin/itwinui-react";
import { ExpandableBlock } from "@itwin/itwinui-react";
import React, { forwardRef } from "react";

interface PropertyExpandableBlockProps extends ExpandableBlockProps {
    children: React.ReactNode;
}

export const PropertyExpandableBlock = ({
    children, 
    ...ExpandableBlockProps
}: PropertyExpandableBlockProps) => {
    return(
    <ExpandableBlock {...ExpandableBlockProps}>
        {children}
    </ExpandableBlock>
    )
}

export const PropertyExpandableBlockWithRef = forwardRef<HTMLDivElement, PropertyExpandableBlockProps>(function PropertyExpandableBlockWithRef(props, ref) { 
    return (
        <div ref={ref}>
            <PropertyExpandableBlock {...props}>
                {props.children}
            </PropertyExpandableBlock>
        </div>
    );
});


