# @itwin/quantity-formatting-react

React components for quantity formatting in iTwin.js applications.

## Description

This package provides React components for working with quantities and their formatting in iTwin.js applications. It includes components for input, display, and conversion of quantities with proper unit handling.

**Key Features:**
- **QuantityFormatPanelV2**: Modern quantity format panel with improved UX
- **FormatPanelV2**: Flexible format panel with primary/secondary option organization
- **FormatSampleV2**: Real-time preview of quantity formatting
- **Comprehensive Format Support**: Support for Decimal, Fractional, Scientific, Station, Azimuth, Bearing, and Ratio formats
- **Modular Architecture**: Organized into panels and internal components for reusability

## Main Components
- `QuantityFormatPanelV2` - Main panel for quantity format configuration
- `FormatPanelV2` - Core format panel with expandable advanced options
- `FormatSampleV2` - Live preview component for formatted values

## Installation

```bash
npm install @itwin/quantity-formatting-react
```

## Usage

```typescript
import {
  QuantityFormatPanelV2,
  FormatPanelV2,
  FormatSampleV2
} from "@itwin/quantity-formatting-react";

// Use the QuantityFormatPanelV2 component
<QuantityFormatPanelV2
  formatDefinition={formatProps}
  unitsProvider={unitsProvider}
  onFormatChange={(newFormat) => console.log(newFormat)}
  showSample={true}
  initialMagnitude={1234.56}
/>
```

## License

This project is licensed under the MIT License - see the [LICENSE.md](./LICENSE.md) file for details.
