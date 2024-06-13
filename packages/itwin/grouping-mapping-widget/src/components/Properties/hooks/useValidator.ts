/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { useState } from "react";
import SimpleReactValidator from "simple-react-validator";

export const Validators = {
  NoDuplicateUnderscore: {
    message: 'Remove duplicate "_"',
    rule: (val: string) => {
      return !val.match(/__+/i);
    },
  },
  OnlyBeginsWithLetterOrUnderscore: {
    message: "Name can only start with a letter or underscore.",
    rule: (val: string) => {
      const regexPattern = new RegExp(/^[\p{L}\p{Nl}_]+/u);
      return regexPattern.test(val);
    },
  },
  FollowedByLettersUnderscoresAndDigits: {
    message: "Name can only contain letters, underscores, or digits",
    rule: (val: string) => {
      const regexPattern = new RegExp(/^[\p{L}\p{Nl}\p{Nd}\p{Mn}\p{Mc}\p{Pc}\p{Cf}]+$/u);
      return regexPattern.test(val);
    },
  },
  CharLimit: {
    message: "There is an 128 character limit.",
    rule: (val: string) => {
      return val.length <= 128;
    },
  },
};

export const NAME_REQUIREMENTS = "required|NoDuplicateUnderscore|OnlyBeginsWithLetterOrUnderscore|FollowedByLettersUnderscoresAndDigits|CharLimit";

export const Messages = { required: "This field is required." };

const useValidator = (customMessage = Messages, customValidator = Validators): [SimpleReactValidator, React.Dispatch<React.SetStateAction<boolean>>] => {
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
