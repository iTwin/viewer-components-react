/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

/* c8 ignore start */

/**
 * Copies a string to the clipboard. Works in iOS as well
 * @internal
 */
export const copyToClipboard = (data: string) => {
  if (isiOsDevice()) {
    copyToClipboardiOS(data);
  } else {
    copyToClipboardWin(data);
  }
};

function isiOsDevice(): boolean {
  const iDevices = ["iPad Simulator", "iPhone Simulator", "iPad", "iPhone", "iPod"];

  let iOS = false;
  if (window.navigator.platform !== undefined) { // eslint-disable-line deprecation/deprecation
    if (
      iDevices.find(
        (device: string) => device.indexOf(window.navigator.platform) !== -1, // eslint-disable-line deprecation/deprecation
      )
    ) {
      iOS = true;
    }
  }
  return iOS;
}

const copyToClipboardWin = (info: string) => {
  const listener = (e: ClipboardEvent) => {
    if (!e.clipboardData) {
      return;
    }

    e.clipboardData.setData("text/plain", info);
    e.preventDefault();
    document.removeEventListener("copy", listener);
  };
  document.addEventListener("copy", listener);
  document.execCommand("copy"); // eslint-disable-line deprecation/deprecation
};

const copyToClipboardiOS = (info: string) => {
  const el: HTMLTextAreaElement = document.createElement(
    "textArea",
  ) as HTMLTextAreaElement;
  el.value = info;
  document.body.appendChild(el);

  const range = document.createRange();
  range.selectNodeContents(el);

  const s = window.getSelection();
  if (!s) {
    return;
  }

  s.removeAllRanges();
  s.addRange(range);

  el.setSelectionRange(0, 999999);

  document.execCommand("copy"); // eslint-disable-line deprecation/deprecation
  document.body.removeChild(el);
};
