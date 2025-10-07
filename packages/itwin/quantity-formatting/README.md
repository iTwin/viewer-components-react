# @itwin/quantity-formatting-react

React components for quantity formatting in iTwin.js applications.

## Description

This package provides React components for working with quantities and their formatting in iTwin.js applications. It includes components for configuring, displaying, and converting quantities with proper unit handling and formatting options.

**Key Features:**

- **Comprehensive Format Configuration**: Support for Decimal, Fractional, Scientific, Station, Azimuth, Bearing, and Ratio formats
- **Real-time Preview**: Live formatting preview as you adjust settings
- **Unit Management**: Support for composite units and unit conversion
- **Flexible UI Components**: Modular components that can be embedded in dialogs, panels, or custom UIs
- **Format Selection**: Choose from predefined formats to customize

## Installation

```bash
npm install @itwin/quantity-formatting-react
```

## Common Worfklow

The typical workflow involves selecting a format and customizing it to meet your needs:

1. **Select a Format**: Use the `FormatSelector` to choose from available predefined formats
2. **Customize Settings**: Modify format properties like precision, units, and display options
3. **Preview Changes**: See real-time formatting preview as you make adjustments
4. **Save or Reset**: Apply your changes or revert to the original format

### Example Workflow

> FormatSelector and QuantityFormatPanel are separate components, that can be used together. The following example's code can be found in this repository's [QuantityFormatButton.tsx](https://github.com/iTwin/viewer-components-react/blob/master/apps/test-viewer/src/components/QuantityFormatButton.tsx)

#### Editing a Format
Starting with the `FormatSelector`, this component shows all available formats to choose from. It also includes a search bar, allowing you to filter formats based on their labels:

<img src="./media/list-of-formats.png" alt="List of formats of a FormatSelector" width="760" height="440">

After selecting a format from the `FormatSelector`, the `QuantityFormatPanel` appears. Initially, the Save and Clear buttons are disabled when no changes have been made.

<img src="./media/selected-format.png" alt="QuantityFormatPanel with a format selected" width="760" height="440">

You can then customize the format by changing properties like the unit. For example, changing from feet to meters:

<img src="./media/dropdown-select-unit.png" alt="Dropdown of units" width="760" height="440">

After making changes, notice how the Save and Clear buttons become enabled (highlighted), indicating that modifications can now be applied or discarded. The preview panel also now shows the value converted to meters:

<img src="./media/after-select-unit.png" alt="After changing unit" width="760" height="440">

Click **Save** to apply your changes or **Clear** to reset back to the original format settings.

#### Editing a Format Set

> This is for applications that enable users to edit a format set. This is opt in. Otherwise, the input fields will be greyed out and disabled.

We start off by showing a `FormatSetSelector`, and in this example, the currently active format set is initially selected. The `FormatSetPanel`, shown on the right, shows a label, unit system, and description. While a format set, contains a name that can uniquely identify the set, it is omitted from the component, opting to show the label only.

<img src="./media/initial-format-set.png" alt="Initial selected format set" width="760" height="440">

A format set might not capture all the formatting options used in an iTwin application. When this happens, a format set can rely on it's unit system to tell the application to show formatting in that unit system. There's a dropdown selector to configure which unit system a format set uses, which an application can use.

<img src="./media/show-unit-system-list.png" alt="Unit system selector" width="760" height="440">

After making changes, notice how the Save and Clear buttons become enabled (highlighted), indicating that modifications can now be applied or discarded.

<img src="./media/after-click-unit-system.png" alt="After unit system select" width="760" height="440">

## Components

This package provides six main React components for quantity formatting:

- **QuantityFormatPanel**: Complete formatting configuration with live preview
- **FormatPanel**: Flexible format property editor
- **FormatSample**: Real-time formatting preview component
- **FormatSelector**: Component for selecting from predefined formats within a format set
- **FormatSetSelector**: Component for selecting from multiple format sets
- **FormatSetPanel**: Component for viewing and editing format set properties

### QuantityFormatPanel

The main component for configuring quantity formatting. It provides a complete user interface for setting up format properties and includes a live formatting preview.

#### QuantityFormatPanel Properties

```typescript
interface QuantityFormatPanelProps {
  formatDefinition: FormatDefinition; // Current format configuration
  unitsProvider: UnitsProvider; // Provider for unit definitions
  onFormatChange: (formatProps: FormatDefinition) => void; // Callback when format changes
  initialMagnitude?: number; // Initial value for sample preview (default: 0)
  showSample?: boolean; // Whether to show the format sample (default: true)
}
```

#### QuantityFormatPanel Usage

<details>
<summary>QuantityFormatPanel example code</summary>

```tsx
import React, { useState, useCallback } from "react";
import { QuantityFormatPanel } from "@itwin/quantity-formatting-react";
import { IModelApp } from "@itwin/core-frontend";
import { Modal, Button, ModalButtonBar } from "@itwin/itwinui-react";
import type { FormatDefinition } from "@itwin/core-quantity";

function QuantityFormatDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [formatDefinition, setFormatDefinition] = useState<FormatDefinition>({
    precision: 4,
    type: "Decimal",
    composite: {
      units: [{ name: "Units.M", label: "m" }],
    },
  });

  const handleFormatChange = useCallback((newFormat: FormatDefinition) => {
    setFormatDefinition(newFormat);
  }, []);

  const handleApply = useCallback(() => {
    // Apply the format changes to your application
    console.log("Applied format:", formatDefinition);
    setIsOpen(false);
  }, [formatDefinition]);

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Configure Format</Button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Quantity Format Settings">
        <QuantityFormatPanel
          formatDefinition={formatDefinition}
          unitsProvider={IModelApp.quantityFormatter.unitsProvider}
          onFormatChange={handleFormatChange}
          initialMagnitude={123.456}
        />

        <ModalButtonBar>
          <Button onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button styleType="high-visibility" onClick={handleApply}>
            Apply
          </Button>
        </ModalButtonBar>
      </Modal>
    </>
  );
}
```

</details>

### FormatPanel

A flexible component for editing format properties with customizable primary and secondary sections. This component provides more granular control than `QuantityFormatPanel`.

#### FormatPanel Properties

```typescript
interface FormatPanelProps {
  formatDefinition: FormatDefinition; // Current format configuration
  unitsProvider: UnitsProvider; // Provider for unit definitions
  onFormatChange: (formatProps: FormatDefinition) => void; // Callback when format changes
  persistenceUnit?: UnitProps; // Unit for persistence/storage
}
```

#### FormatPanel Usage

<details>
<summary>FormatPanel example code</summary>

```tsx
import React, { useState } from "react";
import { FormatPanel } from "@itwin/quantity-formatting-react";
import { IModelApp } from "@itwin/core-frontend";
import type { FormatDefinition } from "@itwin/core-quantity";

function CustomFormatEditor() {
  const [format, setFormat] = useState<FormatDefinition>({
    precision: 2,
    type: "Decimal",
    formatTraits: ["showUnitLabel"],
    composite: {
      units: [{ name: "Units.FT", label: "ft" }],
    },
  });
  const persistenceUnit = await IModelApp.quantityFormatter.unitsProvider.findUnit("Units.M");

  return (
    <div style={{ padding: "16px" }}>
      <h3>Custom Format Editor</h3>
      <FormatPanel
        formatDefinition={format}
        unitsProvider={IModelApp.quantityFormatter.unitsProvider}
        onFormatChange={setFormat}
        persistenceUnit={persistenceUnit}
      />

      <div style={{ marginTop: "16px" }}>
        <h4>Current Format Configuration:</h4>
        <pre>{JSON.stringify(format, null, 2)}</pre>
      </div>
    </div>
  );
}
```

</details>

### FormatSample

A component that provides real-time preview of how values will be formatted using the current format configuration. Shows both the input value and the formatted output.

#### FormatSample Properties

```typescript
interface FormatSampleProps {
  formatProps: FormatDefinition; // Format configuration to preview
  unitsProvider: UnitsProvider; // Provider for unit definitions
  persistenceUnit?: UnitProps; // Unit for the input value
  initialMagnitude?: number; // Initial value to display (default: 0)
}
```

#### FormatSample Usage

<details>
<summary>FormatSample example code</summary>

```tsx
import React, { useState } from "react";
import { FormatSample } from "@itwin/quantity-formatting-react";
import { IModelApp } from "@itwin/core-frontend";
import type { FormatDefinition } from "@itwin/core-quantity";

function FormatPreview() {
  const [format] = useState<FormatDefinition>({
    precision: 3,
    type: "Decimal",
    formatTraits: ["showUnitLabel"],
    composite: {
      units: [{ name: "Units.M", label: "m" }],
    },
  });

  return (
    <div style={{ padding: "16px" }}>
      <h3>Format Preview</h3>
      <FormatSample formatProps={format} unitsProvider={IModelApp.quantityFormatter.unitsProvider} initialMagnitude={123.456789} />
    </div>
  );
}
```

</details>

### FormatSelector

A component for selecting from predefined format definitions within a format set.

#### FormatSelector Properties

```typescript
interface FormatSelectorProps {
  activeFormatSet?: FormatSet; // Set of available formats
  activeFormatDefinitionKey?: string; // Currently selected format key
  onListItemChange: (formatDefinition: FormatDefinition, key: string) => void; // Selection callback
}
```

#### FormatSelector Usage

<details>
<summary>FormatSelector example code</summary>

```tsx
import React, { useState, useCallback } from "react";
import { FormatSelector } from "@itwin/quantity-formatting-react";
import type { FormatDefinition, FormatSet } from "@itwin/ecschema-metadata";

function FormatSelectionPanel({ formatSet }: { formatSet?: FormatSet }) {
  const [selectedKey, setSelectedKey] = useState<string>();

  const handleFormatSelection = useCallback((formatDef: FormatDefinition, key: string) => {
    setSelectedKey(key);
    console.log("Selected format:", formatDef.label, "with key:", key);
  }, []);

  return (
    <div style={{ padding: "16px" }}>
      <h3>Select a Format</h3>
      <FormatSelector activeFormatSet={formatSet} activeFormatDefinitionKey={selectedKey} onListItemChange={handleFormatSelection} />
    </div>
  );
}
```

</details>

### FormatSetSelector

A component for selecting from multiple format sets. This is useful when you have multiple predefined collections of formats (e.g., different format sets for different projects or disciplines).

#### FormatSetSelector Properties

```typescript
interface FormatSetSelectorProps {
  formatSets?: FormatSet[]; // Array of available format sets
  selectedFormatSetKey?: string; // Currently selected format set key
  onFormatSetChange: (formatSet: FormatSet, key: string) => void; // Selection callback
}
```

#### FormatSetSelector Usage

<details>
<summary>FormatSetSelector example code</summary>

```tsx
import React, { useState, useCallback } from "react";
import { FormatSetSelector } from "@itwin/quantity-formatting-react";
import type { FormatSet } from "@itwin/ecschema-metadata";

function FormatSetSelectionPanel() {
  const [formatSets] = useState<FormatSet[]>([
    {
      name: "MetricSet",
      label: "Metric Formats",
      unitSystem: "metric",
      description: "Standard metric unit formats for international projects",
      formats: {
        /* format definitions */
      },
    },
    {
      name: "ImperialSet",
      label: "Imperial Formats",
      unitSystem: "imperial",
      description: "Imperial unit formats for US-based projects",
      formats: {
        /* format definitions */
      },
    },
  ]);

  const [selectedKey, setSelectedKey] = useState<string>();

  const handleFormatSetChange = useCallback((formatSet: FormatSet, key: string) => {
    setSelectedKey(key);
    console.log("Selected format set:", formatSet.label);
  }, []);

  return (
    <div style={{ height: "400px", padding: "16px" }}>
      <h3>Select a Format Set</h3>
      <FormatSetSelector formatSets={formatSets} selectedFormatSetKey={selectedKey} onFormatSetChange={handleFormatSetChange} />
    </div>
  );
}
```

</details>

### FormatSetPanel

A component for viewing and editing format set properties such as label, unit system, and description. This component can be used in both read-only and editable modes.

#### FormatSetPanel Properties

```typescript
interface FormatSetPanelProps {
  formatSet?: FormatSet; // Format set to display/edit
  editable?: boolean; // Whether the panel is in edit mode (default: false)
  onFormatSetChange?: (formatSet: FormatSet) => void; // Callback when format set properties change
}
```

#### FormatSetPanel Usage

<details>
<summary>FormatSetPanel example code</summary>

```tsx
import React, { useState, useCallback } from "react";
import { FormatSetPanel } from "@itwin/quantity-formatting-react";
import { Button, Flex } from "@itwin/itwinui-react";
import type { FormatSet } from "@itwin/ecschema-metadata";

function FormatSetEditor() {
  const [formatSet, setFormatSet] = useState<FormatSet>({
    name: "CustomSet",
    label: "Custom Format Set",
    unitSystem: "metric",
    description: "A custom format set for my project",
    formats: {},
  });

  const [clonedFormatSet, setClonedFormatSet] = useState<FormatSet>({ ...formatSet });
  const [hasChanges, setHasChanges] = useState(false);

  const handleFormatSetChange = useCallback((updatedFormatSet: FormatSet) => {
    setClonedFormatSet(updatedFormatSet);
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    setFormatSet(clonedFormatSet);
    setHasChanges(false);
    console.log("Saved format set:", clonedFormatSet);
  }, [clonedFormatSet]);

  const handleClear = useCallback(() => {
    setClonedFormatSet({ ...formatSet });
    setHasChanges(false);
  }, [formatSet]);

  return (
    <Flex flexDirection="column" gap="m" style={{ padding: "16px" }}>
      <h3>Format Set Editor</h3>

      <FormatSetPanel formatSet={clonedFormatSet} editable={true} onFormatSetChange={handleFormatSetChange} />

      <Flex justifyContent="space-between" gap="s">
        <Button size="small" styleType="default" onClick={handleClear} disabled={!hasChanges}>
          Clear
        </Button>
        <Button size="small" styleType="high-visibility" onClick={handleSave} disabled={!hasChanges}>
          Save
        </Button>
      </Flex>
    </Flex>
  );
}
```

</details>

## Complete Example

A comprehensive example showing how to use FormatSelector together with QuantityFormatPanel can be found in this repository's test-viewer, found in [QuantityFormatButton.tsx](https://github.com/iTwin/viewer-components-react/blob/master/apps/test-viewer/src/components/QuantityFormatButton.tsx). The [common workflow](#common-worfklow) in the section above walks through the component in pictures.

## Initialization

Before using the components, initialize the localization support:

```typescript
import { QuantityFormatting } from "@itwin/quantity-formatting-react";
import { IModelApp } from "@itwin/core-frontend";

// Initialize during application startup
await QuantityFormatting.startup({
  localization: IModelApp.localization, // Optional: use custom localization
});
```

</details>

## License

This project is licensed under the MIT License - see the [LICENSE.md](./LICENSE.md) file for details.
