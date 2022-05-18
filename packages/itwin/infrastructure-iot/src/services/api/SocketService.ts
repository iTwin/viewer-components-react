/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Observer } from "rxjs";
import { BehaviorSubject, Observable } from "rxjs";
import { filter, first, map, switchMap } from "rxjs/operators";
import { forEach as _forEach, random as _random } from "lodash";

import { SocketState } from "../../enums/api/SocketStateEnum";
import type { SocketStream } from "../../models/api/SocketStreamInterface";
import { SocketResponse } from "../../models/api/SocketResponseModel";
import type { AuthState } from "../../models/auth/AuthStateModel";
import { ConfigService } from "../ConfigService";
import { AuthService } from "../AuthService";
import { LoggerService } from "../LoggerService";

class SocketServiceSingleton {

  private state$ = new BehaviorSubject<SocketState>(SocketState.DISCONNECTED);
  private socket?: WebSocket;
  private connectionTimer?: any;

  private streams: { [key: string]: SocketStream } = {};

  private jsonRpcSpec = "2.0";

  public send$(request: string, params: {[key: string]: any} = {}, unsubscribeRequest?: string): Observable<any> {
    return AuthService.authState$()
      .pipe(
        filter((authState: AuthState | null) => !!authState),
        first(),
        switchMap((authState: AuthState | null) => {
          return new Observable<any>((observer: Observer<any>) => {

            // Generate a random request id for this message
            const id = _random(50000, 99999999);

            // Add project ids parameter to request
            params.projectIds = [authState?.getProjectId()];

            // Save the stream reference so we can find it later on incoming messages
            const newStream: SocketStream = { id, request, params, observer };
            this.streams[id] = newStream;

            // Send the message once socket is connected
            // Also, if not connected, start the connection process
            this.connect();
            this.sendSocketMessage(id, request, params);

            // Delete stream from map after observable completes
            return () => {
              if (unsubscribeRequest) {
                this.send$(unsubscribeRequest, { id: newStream.id }).subscribe();
              }
              delete this.streams[newStream.id];
            };

          });
        })
      );
  }

  private sendSocketMessage(id: number, request: string, params: {[key: string]: any}): void {
    this.state$.pipe(
      first((state: SocketState) => state === SocketState.CONNECTED),
      map(() => this.socket)
    ).subscribe((socket: WebSocket | undefined) => {
      (socket as WebSocket).send(
        JSON.stringify({ jsonrpc: this.jsonRpcSpec, id, method: request, params })
      );
    });
  }

  private connect(): void {
    if (this.state$.getValue() === SocketState.DISCONNECTED) {
      this.state$.next(SocketState.CONNECTING);
      ConfigService.getSocketApi$()
        .pipe(
          switchMap((socketApi: string) => {
            return AuthService.authState$()
              .pipe(
                filter((authState: AuthState | null) => !!authState),
                first(),
                map((authState: AuthState | null) => {
                  return { socketApi, authState: authState as AuthState };
                })
              );
          })
        )
        .subscribe((connectionInfo: {socketApi: string, authState: AuthState}) => {

          // Connect socket to specified API (based on environment)
          this.socket = new WebSocket(connectionInfo.socketApi);

          // Register socket event handlers
          this.socket.onopen = () => {

            LoggerService.log("Socket opened with:", connectionInfo.socketApi);

            // Perform authenticate request immediately after connection
            new Observable<any>((observer: Observer<any>) => {

              // Save the stream reference so we can find it later on incoming messages
              this.streams[0] = {
                id: 0,
                request: "authenticate",
                params: { code: connectionInfo.authState.getApiKey() },
                observer,
              };

              // Send the message over socket
              this.socket?.send(JSON.stringify({
                jsonrpc: this.jsonRpcSpec,
                id: this.streams[0].id,
                method: this.streams[0].request,
                params: this.streams[0].params,
              }));

            }).subscribe(
              () => {
                LoggerService.log("Socket authenticated!");
                this.state$.next(SocketState.CONNECTED);
                this.startConnectionTimer();
                delete this.streams[0];
              }
            );
          };
          this.socket.onmessage = (event: any) => {
            this.onMessage(event.data);
          };
          this.socket.onerror = (error: any) => {
            LoggerService.log("Received general socket error:", error);
          };
          this.socket.onclose = () => {
            this.onClose();
          };
        });
    }
  }

  private onMessage(message: any): void {

    // Parse the JSON message
    const parsedMessage = JSON.parse(message);

    // Check if this message has an id (as all should)
    if (parsedMessage.id !== undefined) {
      const stream = this.streams[parsedMessage.id];
      const response = new SocketResponse(parsedMessage);
      if (stream) {
        if (!response.isError()) {
          if (response.hasData()) {
            stream.observer.next(response.getData());
          }
          if (response.isFinished() || stream.request === "authenticate") {
            stream.observer.complete();
          }
        } else {
          LoggerService.warn("Request", stream.request, "failed:", response.getError());
          stream.observer.error(response.getError());
        }
      } else {
        if (!response.isFinished()) {
          LoggerService.warn("Received message with no handler:", parsedMessage);
        }
      }
    }
  }

  private onClose(): void {

    LoggerService.log("Socket closed");

    // Reset state, socket object
    this.socket = undefined;
    this.state$.next(SocketState.DISCONNECTED);

    // Stop connection timer
    this.stopConnectionTimer();

    // Attempt to re-connect if we have outstanding socket requests
    const streamIds = Object.keys(this.streams);
    if (streamIds.length) {
      setTimeout(() => {

        LoggerService.log("Attempting to re-connect socket");

        // Attempt to re-establish socket connection
        this.connect();

        // Re-send all of the outstanding socket requests and assign them to existing Observers
        _forEach(streamIds, (streamId: string) => {

          // Find the old stream object
          const stream = this.streams[streamId];

          // Re-assign stream reference with a new request id
          stream.id = _random(50000, 99999999);
          this.streams[stream.id] = stream;
          delete this.streams[streamId];

          // Send the message once socket is connected
          this.sendSocketMessage(stream.id, stream.request, stream.params);
        });

      }, 5000);
    }
  }

  private startConnectionTimer(): void {
    this.stopConnectionTimer();
    ConfigService.getSocketTimeout$()
      .subscribe((connectionTimeout: number) => {
        this.connectionTimer = setInterval(() => {
          this.send$("time").subscribe();
        }, connectionTimeout / 2);
      });

  }

  private stopConnectionTimer(): void {
    if (this.connectionTimer) {
      clearInterval(this.connectionTimer);
    }
  }

}

export const SocketService: SocketServiceSingleton = new SocketServiceSingleton();
