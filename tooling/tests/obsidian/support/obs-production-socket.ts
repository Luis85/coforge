import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { Duplex } from "node:stream";
import { ObsProductionServer } from "../../../../src/plugin/tests/support/coforge/obs-production-server";
import { PRODUCTION_REQUESTS } from "../../../../src/plugin/infrastructure/coforge/obs-production-rpc";
import { record } from "../../../../src/plugin/features/coforge/domain/check";

/** Loopback-only simulated OBS. It never launches OBS or contacts a streaming destination. */
export class ObsProductionSocketServer {
  readonly state = new ObsProductionServer();
  private readonly sockets = new Set<Duplex>();
  private readonly items = new Map<string, Array<Record<string, unknown>>>();
  private sequence = 0;
  private readonly server = createServer((_, response) => {
    response.writeHead(404);
    response.end();
  });
  endpoint = "";
  constructor() {
    this.state.inputs = [];
    this.state.scenes = [{ id: "initial", name: "Scene" }];
    this.state.program = "initial";
    this.state.preview = "initial";
    this.state.frame =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nS8AAAAASUVORK5CYII=";
    this.server.on("upgrade", (request, socket) => {
      const key = request.headers["sec-websocket-key"];
      if (
        typeof key !== "string" ||
        request.headers.upgrade?.toLowerCase() !== "websocket"
      ) {
        socket.destroy();
        return;
      }
      const accept = createHash("sha1")
        .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
        .digest("base64");
      socket.write(
        "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " +
          accept +
          "\r\nSec-WebSocket-Protocol: obswebsocket.json\r\n\r\n",
      );
      this.sockets.add(socket);
      this.send(socket, {
        op: 0,
        d: {
          obsStudioVersion: "32.0.0",
          obsWebSocketVersion: "5.6.3",
          rpcVersion: 1,
        },
      });
      let buffer = Buffer.alloc(0);
      socket.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        if (buffer.length > 1_048_576) {
          socket.destroy();
          return;
        }
        while (buffer.length >= 2) {
          const opcode = buffer[0]! & 15;
          const masked = (buffer[1]! & 128) !== 0;
          let length = buffer[1]! & 127;
          let offset = 2;
          if (length === 126) {
            if (buffer.length < 4) break;
            length = buffer.readUInt16BE(2);
            offset = 4;
          } else if (length === 127) {
            socket.destroy();
            return;
          }
          if (!masked || length > 65535) {
            socket.destroy();
            return;
          }
          if (buffer.length < offset + 4 + length) break;
          const mask = buffer.subarray(offset, offset + 4);
          offset += 4;
          const payload = Buffer.from(buffer.subarray(offset, offset + length));
          for (let index = 0; index < payload.length; index++)
            payload[index] = payload[index]! ^ mask[index % 4]!;
          buffer = buffer.subarray(offset + length);
          if (opcode === 8) {
            socket.end(Buffer.from([0x88, 0]));
            return;
          }
          if (opcode !== 1) continue;
          void this.receive(socket, payload.toString("utf8")).catch(() =>
            socket.destroy(),
          );
        }
      });
      socket.on("close", () => this.sockets.delete(socket));
      socket.on("error", () => this.sockets.delete(socket));
    });
  }
  async start(): Promise<void> {
    await new Promise<void>((resolve) =>
      this.server.listen(0, "127.0.0.1", resolve),
    );
    const address = this.server.address();
    if (!address || typeof address === "string")
      throw new Error("Loopback OBS fixture did not bind.");
    this.endpoint = "ws://127.0.0.1:" + address.port + "/";
  }
  async close(): Promise<void> {
    for (const socket of this.sockets) socket.destroy();
    this.sockets.clear();
    await new Promise<void>((resolve, reject) =>
      this.server.close((error) => (error ? reject(error) : resolve())),
    );
  }
  private send(socket: Duplex, value: unknown): void {
    const payload = Buffer.from(JSON.stringify(value));
    const header = Buffer.alloc(payload.length < 126 ? 2 : 4);
    header[0] = 0x81;
    if (payload.length < 126) header[1] = payload.length;
    else {
      header[1] = 126;
      header.writeUInt16BE(payload.length, 2);
    }
    socket.write(Buffer.concat([header, payload]));
  }
  private event(type: string, data: Record<string, unknown>): void {
    for (const socket of this.sockets)
      this.send(socket, {
        op: 5,
        d: { eventType: type, eventIntent: 1, eventData: data },
      });
  }
  private async receive(socket: Duplex, raw: string): Promise<void> {
    const value = record(JSON.parse(raw));
    const data = record(value.d);
    if (value.op === 1) {
      this.send(socket, { op: 2, d: { negotiatedRpcVersion: 1 } });
      return;
    }
    if (
      value.op !== 6 ||
      typeof data.requestType !== "string" ||
      typeof data.requestId !== "string"
    )
      return;
    const response = await this.request(
      data.requestType,
      record(data.requestData ?? {}),
    );
    this.send(socket, {
      op: 7,
      d: {
        requestType: data.requestType,
        requestId: data.requestId,
        requestStatus: { result: true, code: 100 },
        responseData: response,
      },
    });
  }
  private scene(name: unknown) {
    return this.state.scenes.find((scene) => scene.name === name);
  }
  private sceneItems(name: unknown) {
    const key = String(name);
    let items = this.items.get(key);
    if (!items) {
      items = [];
      this.items.set(key, items);
    }
    return items;
  }
  async request(
    type: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (
      [
        "GetVersion",
        "GetSceneList",
        "GetStreamStatus",
        "GetStats",
        "GetGroupList",
      ].includes(type)
    ) {
      this.state.requests.push({ type, data });
      if (type === "GetVersion")
        return {
          availableRequests: [
            ...new Set([
              ...PRODUCTION_REQUESTS,
              "GetVersion",
              "GetSceneList",
              "GetStreamStatus",
              "GetStats",
              "GetGroupList",
              "CreateScene",
              "SetSceneName",
              "RemoveScene",
              "CreateSceneItem",
              "RemoveSceneItem",
              "SetSceneItemEnabled",
              "SetSceneItemIndex",
              "SetCurrentProgramScene",
              "StartStream",
              "StopStream",
            ]),
          ],
        };
      if (type === "GetSceneList")
        return {
          scenes: this.state.scenes.map((scene) => ({
            sceneUuid: scene.id,
            sceneName: scene.name,
          })),
          currentProgramSceneUuid: this.state.program,
          currentPreviewSceneUuid: this.state.preview,
        };
      if (type === "GetStreamStatus")
        return {
          outputActive: this.state.active,
          outputReconnecting: false,
          outputTimecode: "00:00:00.000",
          outputDuration: 0,
        };
      if (type === "GetGroupList") return { groups: [] };
      return {};
    }
    if (
      [
        "CreateScene",
        "SetCurrentProgramScene",
        "SetCurrentPreviewScene",
        "CreateSceneItem",
        "GetSceneItemList",
        "SetSceneItemEnabled",
        "RemoveSceneItem",
      ].includes(type)
    ) {
      this.state.requests.push({ type, data });
      if (type === "CreateScene") {
        const scene = { id: randomUUID(), name: String(data.sceneName) };
        this.state.scenes.push(scene);
        this.event("SceneCreated", {
          sceneUuid: scene.id,
          sceneName: scene.name,
        });
        return { sceneUuid: scene.id };
      }
      if (
        type === "SetCurrentProgramScene" ||
        type === "SetCurrentPreviewScene"
      ) {
        const scene = this.scene(data.sceneName);
        if (!scene) throw new Error("Fixture scene missing.");
        if (type === "SetCurrentProgramScene") this.state.program = scene.id;
        else this.state.preview = scene.id;
        this.event(
          type === "SetCurrentProgramScene"
            ? "CurrentProgramSceneChanged"
            : "CurrentPreviewSceneChanged",
          { sceneUuid: scene.id, sceneName: scene.name },
        );
        return {};
      }
      const items = this.sceneItems(data.sceneName);
      if (type === "GetSceneItemList") return { sceneItems: items };
      if (type === "CreateSceneItem") {
        const input = this.state.inputs.find(
          (input) => input.inputName === data.sourceName,
        );
        if (!input) throw new Error("Fixture source missing.");
        const id = ++this.sequence;
        items.push({
          sceneItemId: id,
          sourceName: input.inputName,
          sourceUuid: input.inputUuid,
          inputKind: input.inputKind,
          sourceType: "OBS_SOURCE_TYPE_INPUT",
          sceneItemEnabled: data.sceneItemEnabled !== false,
          sceneItemLocked: false,
          sceneItemIndex: items.length,
        });
        this.event("SceneItemCreated", {});
        return { sceneItemId: id };
      }
      const item = items.find((item) => item.sceneItemId === data.sceneItemId);
      if (type === "SetSceneItemEnabled" && item) {
        item.sceneItemEnabled = data.sceneItemEnabled;
        this.event("SceneItemEnableStateChanged", {});
      }
      if (type === "RemoveSceneItem")
        this.items.set(
          String(data.sceneName),
          items.filter((item) => item.sceneItemId !== data.sceneItemId),
        );
      return {};
    }
    const audioInput = this.state.inputs.find(
      (input) => input.inputName === data.inputName,
    );
    if (
      [
        "GetInputMute",
        "GetInputVolume",
        "GetInputAudioMonitorType",
        "GetInputAudioSyncOffset",
        "GetInputAudioTracks",
      ].includes(type) &&
      audioInput &&
      !audioInput.inputKind.includes("wasapi") &&
      audioInput.inputKind !== "ffmpeg_source"
    ) {
      this.state.requests.push({ type, data });
      return {};
    }
    const response = await this.state.request(type, data);
    if (type === "CreateInput") {
      const input = this.state.inputs.find(
        (input) => input.inputName === data.inputName,
      );
      if (input) {
        const id = ++this.sequence;
        this.sceneItems(data.sceneName).push({
          sceneItemId: id,
          sourceName: input.inputName,
          sourceUuid: input.inputUuid,
          inputKind: input.inputKind,
          sourceType: "OBS_SOURCE_TYPE_INPUT",
          sceneItemEnabled: data.sceneItemEnabled !== false,
          sceneItemLocked: false,
          sceneItemIndex: this.sceneItems(data.sceneName).length,
        });
        response.sceneItemId = id;
      }
      this.event("InputCreated", {});
    }
    return response;
  }
}
