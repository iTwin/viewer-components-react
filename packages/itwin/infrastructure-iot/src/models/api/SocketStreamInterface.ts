/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Observer } from "rxjs";

export interface SocketStream {
  id: number;
  request: string;
  params: {[key: string]: any};
  observer: Observer<any>;
}
