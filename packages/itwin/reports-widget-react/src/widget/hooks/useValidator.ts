/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp } from "@itwin/core-frontend";
import { useState } from "react";
import SimpleReactValidator from "simple-react-validator";

export const NAME_REQUIREMENTS =
  "required|NoDuplicateUnderscore|OnlyBeginsWithLetterOrUnderscore|FollowedByLettersUnderscoresAndDigits|CharLimit";

const useValidator = (
): [SimpleReactValidator, React.Dispatch<React.SetStateAction<boolean>>] => {
  const [show, setShow] = useState(false);
  const customValidator = {
    NoDuplicateUnderscore: {
      message: IModelApp.localization.getLocalizedString("ReportsWidget:Validators.NoDuplicateUnderscore"),
      rule: (val: string) => {
        return !val.match(/__+/i);
      },
    },
    OnlyBeginsWithLetterOrUnderscore: {
      message: IModelApp.localization.getLocalizedString("ReportsWidget:Validators.OnlyBeginsWithLetterOrUnderscore"),
      rule: (val: string) => {
        return !val.match(/^[\W\d]+/i);
      },
    },
    FollowedByLettersUnderscoresAndDigits: {
      message: IModelApp.localization.getLocalizedString("ReportsWidget:Validators.FollowedByLettersUnderscoresAndDigits"),
      rule: (val: string) => {
        return !val.match(/\W+/i);
      },
    },
    CharLimit: {
      message: IModelApp.localization.getLocalizedString("ReportsWidget:Validators.CharLimit"),
      rule: (val: string) => {
        return val.length <= 128;
      },
    },
  };

  const customMessages = { required: IModelApp.localization.getLocalizedString("ReportsWidget:Validators.ThisFieldIsRequired") };

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
