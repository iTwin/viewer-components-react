/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as React from "react";
import {
  type FormatProps,
  FormatType,
  parseFormatType,
  type UnitProps,
} from "@itwin/core-quantity";
import type { UnitsProvider } from "@itwin/core-quantity";
import { ExpandableBlock, Flex, Surface, Text } from "@itwin/itwinui-react";
import {
  getDecimalPrimaryChildren,
  getDecimalSecondaryChildren,
  type PanelProps,
} from "./panels/Decimal.js";
import {
  getFractionalPrimaryChildren,
  getFractionalSecondaryChildren,
} from "./panels/Fractional.js";
import {
  getScientificPrimaryChildren,
  getScientificSecondaryChildren,
} from "./panels/Scientific.js";
import {
  getStationPrimaryChildren,
  getStationSecondaryChildren,
} from "./panels/Station.js";
import {
  getAzimuthPrimaryChildren,
  getAzimuthSecondaryChildren,
} from "./panels/Azimuth.js";
import {
  getBearingPrimaryChildren,
  getBearingSecondaryChildren,
} from "./panels/Bearing.js";
import "./FormatPanel.scss";
import {
  getRatioPrimaryChildren,
  getRatioSecondaryChildren,
} from "./panels/Ratio.js";

// Temporary translation function - this should be replaced with proper i18n
function useTranslation() {
  return {
    translate: (key: string) => {
      // Default translations for common keys
      const translations: Record<string, string> = {
        "QuantityFormat.labels.advancedOptions": "Advanced Options",
      };
      return translations[key] || key;
    },
  };
}

interface FormatPanelProps {
  formatProps: FormatProps;
  unitsProvider: UnitsProvider;
  onFormatChange: (formatProps: FormatProps) => void;
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
          getDecimalPrimaryChildren(panelProps),
          getDecimalSecondaryChildren(panelProps),
        ];
      case FormatType.Fractional:
        return [
          getFractionalPrimaryChildren(panelProps),
          getFractionalSecondaryChildren(panelProps),
        ];
      case FormatType.Scientific:
        return [
          getScientificPrimaryChildren(panelProps),
          getScientificSecondaryChildren(panelProps),
        ];
      case FormatType.Station:
        return [
          getStationPrimaryChildren(panelProps),
          getStationSecondaryChildren(panelProps),
        ];
      case FormatType.Azimuth:
        return [
          getAzimuthPrimaryChildren(panelProps),
          getAzimuthSecondaryChildren(panelProps),
        ];
      case FormatType.Bearing:
        return [
          getBearingPrimaryChildren(panelProps),
          getBearingSecondaryChildren(panelProps),
        ];
      case FormatType.Ratio:
        return [
          getRatioPrimaryChildren(panelProps),
          getRatioSecondaryChildren(panelProps),
        ];
      default:
        return [
          getDecimalPrimaryChildren(panelProps),
          getDecimalSecondaryChildren(panelProps),
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
            {translate("QuantityFormat.labels.advancedOptions")}
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
