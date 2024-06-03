/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { useState } from "react";
import SimpleReactValidator from "simple-react-validator";
import { ReportsConfigWidget } from "../../ReportsConfigWidget";

export const NAME_REQUIREMENTS = "required|NoDuplicateUnderscore|OnlyBeginsWithLetterOrUnderscore|FollowedByLettersUnderscoresSpacesAndDigits|CharLimit";

const useValidator = (): [SimpleReactValidator, React.Dispatch<React.SetStateAction<boolean>>] => {
  const [show, setShow] = useState(false);
  const customValidator = {
    NoDuplicateUnderscore: {
      message: ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Validators.NoDuplicateUnderscore"),
      rule: (val: string) => {
        return !val.match(/__+/i);
      },
    },
    OnlyBeginsWithLetterOrUnderscore: {
      message: ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Validators.OnlyBeginsWithLetterOrUnderscore"),
      rule: (val: string) => {
        return !val.match(/^[\W\d]+/i);
      },
    },
    FollowedByLettersUnderscoresSpacesAndDigits: {
      message: ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Validators.FollowedByLettersUnderscoresSpacesAndDigits"),
      rule: (val: string) => {
        return !val.match(/[^a-zA-Z0-9_\s]+/i);
      },
    },
    CharLimit: {
      message: ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Validators.CharLimit"),
      rule: (val: string) => {
        return val.length <= 128;
      },
    },
  };

  const customMessages = {
    required: ReportsConfigWidget.localization.getLocalizedString("ReportsConfigWidget:Validators.ThisFieldIsRequired"),
  };

  const validator = new SimpleReactValidator({
    messages: customMessages,
    validators: customValidator,
  });

  if (show) {
    validator.showMessages();
  }

  return [validator, setShow];
};

export default useValidator;
