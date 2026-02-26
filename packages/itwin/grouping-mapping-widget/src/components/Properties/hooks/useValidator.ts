/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { useState } from "react";
import SimpleReactValidator from "simple-react-validator";
import { GroupingMappingWidget } from "../../../GroupingMappingWidget";

export const getValidators = () => ({
  NoDuplicateUnderscore: {
    message: GroupingMappingWidget.translate("validation.noDuplicateUnderscore"),
    rule: (val: string) => {
      return !val.match(/__+/i);
    },
  },
  OnlyBeginsWithLetterOrUnderscore: {
    message: GroupingMappingWidget.translate("validation.startsWithLetterOrUnderscore"),
    rule: (val: string) => {
      const regexPattern = new RegExp(/^[\p{L}\p{Nl}_]+/u);
      return regexPattern.test(val);
    },
  },
  FollowedByLettersUnderscoresAndDigits: {
    message: GroupingMappingWidget.translate("validation.onlyLettersUnderscoresDigits"),
    rule: (val: string) => {
      const regexPattern = new RegExp(/^[\p{L}\p{Nl}\p{Nd}\p{Mn}\p{Mc}\p{Pc}\p{Cf}]+$/u);
      return regexPattern.test(val);
    },
  },
  CharLimit: {
    message: GroupingMappingWidget.translate("validation.charLimit"),
    rule: (val: string) => {
      return val.length <= 128;
    },
  },
});

export const NAME_REQUIREMENTS = "required|NoDuplicateUnderscore|OnlyBeginsWithLetterOrUnderscore|FollowedByLettersUnderscoresAndDigits|CharLimit";

export const getMessages = () => ({ required: GroupingMappingWidget.translate("validation.required") });

const useValidator = (customMessage = getMessages(), customValidator = getValidators()): [SimpleReactValidator, React.Dispatch<React.SetStateAction<boolean>>] => {
  const [show, setShow] = useState(false);
  const validator = new SimpleReactValidator({
    messages: customMessage,
    validators: customValidator,
  });

  if (show) {
    validator.showMessages();
  }

  return [validator, setShow];
};

export default useValidator;
