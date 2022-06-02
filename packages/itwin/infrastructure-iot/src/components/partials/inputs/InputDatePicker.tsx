/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import React, { useEffect, useState } from "react";

import { DatePicker, DropdownButton, MenuExtraContent } from "@itwin/itwinui-react";

import { UtilitiesService } from "../../../services/UtilitiesService";

import styles from "./InputDatePicker.module.scss";

export function InputDatePicker(props: {value: string, onChange: (newValue: string) => void}) {

  // Storage for date object of input
  const [date, setDate] = useState<Date | undefined>(new Date(props.value));
  useEffect(() => {
    setDate(new Date(props.value));
  }, [props.value]);

  // Fire off event on date change
  const onChange = (newDate?: Date) => {
    setDate(newDate);
    const newDateValue = newDate ? newDate.toISOString() : undefined;
    const oldDateValue = date ? date.toISOString() : undefined;
    if (newDateValue && newDateValue !== oldDateValue) {
      props.onChange(newDateValue);
    }
  };

  return (
    <div>
      <DropdownButton
        size="small"
        className={styles["dropdown-menu-button"]}
        menuItems={
          () => [
            <MenuExtraContent key={0} className={styles["dropdown-menu-content"]}>
              <DatePicker
                showTime={true}
                precision="minutes"
                date={date}
                onChange={onChange}/>
            </MenuExtraContent>,
          ]
        }>
        {date ? UtilitiesService.formatDate(date) : "No date selected"}
      </DropdownButton>
    </div>
  );
}
