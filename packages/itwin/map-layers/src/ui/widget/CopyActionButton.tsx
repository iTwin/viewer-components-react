import { SvgCheckmarkSmall, SvgCopy } from "@itwin/itwinui-icons-react";
import { IconButton } from "@itwin/itwinui-react";
import { useEffect, useRef, useState } from "react";

import { IModelApp, NotifyMessageDetails, OutputMessagePriority } from "@itwin/core-frontend";

import { MapLayersUI } from "../../mapLayers";

interface CopyActionButtonProps {
  value: string;
  onCopy?: (value: string) => Promise<void> | void;
}

/**
 * Renders an icon button that copies a value to the clipboard.
 *
 * After a click, the icon and label briefly switch to a copied state.
 */
export function CopyActionButton({ value, onCopy }: CopyActionButtonProps) {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <IconButton
      styleType="borderless"
      label={isCopied ? MapLayersUI.localization.getLocalizedString("mapLayers:FeatureInfoWidget.Copied") : MapLayersUI.localization.getLocalizedString("mapLayers:FeatureInfoWidget.Copy")}
      onClick={async () => {
        try {
          if (onCopy) {
            await onCopy(value);
          } else {
            await navigator.clipboard.writeText(value);
          }
          setIsCopied(true);

          if (timeoutRef.current !== undefined) {
            clearTimeout(timeoutRef.current);
          }

          timeoutRef.current = setTimeout(() => {
            setIsCopied(false);
            timeoutRef.current = undefined;
          }, 1200);
        } catch {
          const copyFailedMessage = MapLayersUI.localization.getLocalizedString("mapLayers:FeatureInfoWidget.CopyFailed");
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Warning, copyFailedMessage));
        }
      }}
      disabled={isCopied}
      // Use key to reset internal state of IconButton when isCopied changes, ensuring the label updates immediately.
      key={String(isCopied)}
    >
      {isCopied ? <SvgCheckmarkSmall /> : <SvgCopy />}
    </IconButton>
  );
};
