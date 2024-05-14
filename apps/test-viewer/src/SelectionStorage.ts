import { IModelConnection } from "@itwin/core-frontend";
import { createStorage } from "@itwin/unified-selection";

const unifiedSelectionStorage = createStorage();

IModelConnection.onClose.addListener((imodel) => {
  unifiedSelectionStorage.clearStorage({ imodelKey: imodel.key });
});

export { unifiedSelectionStorage };
