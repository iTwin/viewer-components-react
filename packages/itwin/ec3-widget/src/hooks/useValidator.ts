/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useState } from "react";
import SimpleReactValidator from "simple-react-validator";

export const NAME_REQUIREMENTS =
  "required";

export const Messages = { required: "This field is required." };

const useValidator = (
  customMessage = Messages,
): [SimpleReactValidator, React.Dispatch<React.SetStateAction<boolean>>] => {
  const [show, setShow] = useState(false);
  const validator = new SimpleReactValidator({
    messages: customMessage
  });

  if (show) {
    validator.showMessages();
  }

  return [validator, setShow];
};

export default useValidator;
