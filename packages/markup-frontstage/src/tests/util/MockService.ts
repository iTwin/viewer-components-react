import { I18N } from "@bentley/imodeljs-i18n";
import { UiCore } from "@bentley/ui-core";

export class MockService {
  private static _i18n?: I18N;
  private static _hasUiCoreInitialized = false;

  public static get i18n(): I18N {
    if (!MockService._i18n) {
      MockService._i18n = new I18N();
    }
    return MockService._i18n;
  }

  public static async initializeUiCore() {
    if (!MockService._hasUiCoreInitialized) {
      await UiCore.initialize(MockService.i18n);
    }
  }

  public static terminateUiCore() {
    UiCore.terminate();
    MockService._hasUiCoreInitialized = false;
  }
}
