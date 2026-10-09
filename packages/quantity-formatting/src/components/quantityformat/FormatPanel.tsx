/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./FormatPanel.scss";
import * as React from "react";
import { FormatType, parseFormatType } from "@itwin/core-quantity";
import { Divider, ExpandableBlock, Flex, Surface, Text } from "@itwin/itwinui-react";
import { useTranslation } from "../../useTranslation.js";
import { useUnitsProvider } from "./internal/useUnitsProvider.js";
import { AzimuthPrimaryChildren, AzimuthSecondaryChildren } from "./panels/Azimuth.js";
import { BearingPrimaryChildren, BearingSecondaryChildren } from "./panels/Bearing.js";
import { DecimalPrimaryChildren, DecimalSecondaryChildren } from "./panels/Decimal.js";
import { FractionalPrimaryChildren, FractionalSecondaryChildren } from "./panels/Fractional.js";
import { RatioPrimaryChildren, RatioSecondaryChildren } from "./panels/Ratio.js";
import { ScientificPrimaryChildren, ScientificSecondaryChildren } from "./panels/Scientific.js";
import { StationPrimaryChildren, StationSecondaryChildren } from "./panels/Station.js";

import type { PanelProps} from "./panels/Decimal.js";
import type { UnitsProvider , FormatDefinition, UnitProps } from "@itwin/core-quantity";
/**
 * @beta
 */
export interface FormatPanelProps {
  formatProps: FormatDefinition;
  /** Units used to look up and convert units. Defaults to `IModelApp.quantityFormatter.unitsProvider`. */
  unitsProvider?: UnitsProvider;
  /** Called with the full updated definition after every edit made in the panel. Debounce before persisting. */
  onFormatChange: (formatProps: FormatDefinition) => void;
  persistenceUnit?: UnitProps;
}

/** Format Panel  that uses primary and secondary children based on format type
 * @beta
 */
export function FormatPanel(props: FormatPanelProps) {
  const { formatProps, onFormatChange, persistenceUnit } = props;
  const unitsProvider = useUnitsProvider(props.unitsProvider);
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
        border={false}
      >
        {primaryChildren}
      </Surface>
      <Divider className="quantityFormat-formatPanel-divider" />
      <ExpandableBlock
        title={
          <Text variant="leading">
            {translate("QuantityFormat:labels.advancedOptions")}
          </Text>
        }
        size="small"
        styleType="borderless"
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
