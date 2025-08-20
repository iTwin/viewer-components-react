/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as React from "react";
import {
  type FormatDefinition,
  FormatType,
  parseFormatType,
  type UnitProps,
} from "@itwin/core-quantity";
import type { UnitsProvider } from "@itwin/core-quantity";
import { ExpandableBlock, Flex, Surface, Text } from "@itwin/itwinui-react";
import {
  DecimalPrimaryChildren,
  DecimalSecondaryChildren,
  type PanelProps,
} from "./panels/Decimal.js";
import {
  FractionalPrimaryChildren,
  FractionalSecondaryChildren,
} from "./panels/Fractional.js";
import {
  ScientificPrimaryChildren,
  ScientificSecondaryChildren,
} from "./panels/Scientific.js";
import {
  StationPrimaryChildren,
  StationSecondaryChildren,
} from "./panels/Station.js";
import {
  AzimuthPrimaryChildren,
  AzimuthSecondaryChildren,
} from "./panels/Azimuth.js";
import {
  BearingPrimaryChildren,
  BearingSecondaryChildren,
} from "./panels/Bearing.js";
import "./FormatPanel.scss";
import {
  RatioPrimaryChildren,
  RatioSecondaryChildren,
} from "./panels/Ratio.js";
import { useTranslation } from "../../useTranslation.js";

/**
 * @internal
 */
interface FormatPanelProps {
  formatProps: FormatDefinition;
  unitsProvider: UnitsProvider;
  onFormatChange: (formatProps: FormatDefinition) => void;
  persistenceUnit?: UnitProps;
}

/** Format Panel  that uses primary and secondary children based on format type
 * @beta
 */
export function FormatPanel(props: FormatPanelProps) {
  const { formatProps, unitsProvider, onFormatChange, persistenceUnit } = props;
  const [isExpanded, setIsExpanded] = React.useState(false);
  const { translate } = useTranslation();

  const [primaryChildren, secondaryChildren] = React.useMemo(() => {
    const panelProps: PanelProps = {
      formatProps,
      unitsProvider,
      onFormatChange,
      persistenceUnit,
    };
    const formatType = parseFormatType(formatProps.type, "format");

    switch (formatType) {
      case FormatType.Decimal:
        return [
          <DecimalPrimaryChildren {...panelProps} />,
          <DecimalSecondaryChildren {...panelProps} />,
        ];
      case FormatType.Fractional:
        return [
          <FractionalPrimaryChildren {...panelProps} />,
          <FractionalSecondaryChildren {...panelProps} />,
        ];
      case FormatType.Scientific:
        return [
          <ScientificPrimaryChildren {...panelProps} />,
          <ScientificSecondaryChildren {...panelProps} />,
        ];
      case FormatType.Station:
        return [
          <StationPrimaryChildren {...panelProps} />,
          <StationSecondaryChildren {...panelProps} />,
        ];
      case FormatType.Azimuth:
        return [
          <AzimuthPrimaryChildren {...panelProps} />,
          <AzimuthSecondaryChildren {...panelProps} />,
        ];
      case FormatType.Bearing:
        return [
          <BearingPrimaryChildren {...panelProps} />,
          <BearingSecondaryChildren {...panelProps} />,
        ];
      case FormatType.Ratio:
        return [
          <RatioPrimaryChildren {...panelProps} />,
          <RatioSecondaryChildren {...panelProps} />,
        ];
      default:
        return [
          <DecimalPrimaryChildren {...panelProps} />,
          <DecimalSecondaryChildren {...panelProps} />,
        ];
    }
  }, [formatProps, unitsProvider, onFormatChange, persistenceUnit]);

  return (
    <Flex
      flexDirection="column"
      alignItems="flex-start"
      className="quantityFormat--formatPanel"
    >
      <Surface
        elevation={0}
        className="quantityFormat--formatPanel-primaryChildren"
      >
        {primaryChildren}
      </Surface>
      <ExpandableBlock
        title={
          <Text variant="leading">
            {translate("QuantityFormat:labels.advancedOptions")}
          </Text>
        }
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
      >
        <div className="quantityFormat--formatPanel-secondaryChildren">
          {secondaryChildren}
        </div>
      </ExpandableBlock>
    </Flex>
  );
}
