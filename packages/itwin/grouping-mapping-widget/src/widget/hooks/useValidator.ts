/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useState } from "react";
import SimpleReactValidator from "simple-react-validator";

export const Validators = {
  NoInvalidChars: {
    message: "Contains invalid characters.",
    rule: (val: string) => {
      const regex = RegExp(/^[a-zA-Z0-9]+$/);
      return regex.test(val);
    },
  },
  NoSpacesInName: {
    message: "Name cannot contain spaces.",
    rule: (val: string) => !val.match(/ /),
  },
};

export const Messages = { required: "This field is required." };

const useValidator = (
  customMessage = Messages,
  customValidator = Validators,
): [SimpleReactValidator, React.Dispatch<React.SetStateAction<boolean>>] => {
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
