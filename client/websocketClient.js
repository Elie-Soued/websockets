import net from "net";
import crypto from "crypto";

const createWebSocketClient = (port, host) => {
  const webSocketClient = {
    port,
    host,
    headers: {
      Host: host,
      Upgrade: "websocket",
      Connection: "Upgrade",
      "Sec-WebSocket-Key": crypto.randomBytes(16).toString("base64"),
      "Sec-WebSocket-Protocol": "chat, superchat",
      "Sec-WebSocket-Version": 13,
    },
  };

  webSocketClient.connect = connect.bind(webSocketClient);
  return webSocketClient;
};

const connect = function () {
  const socket = net.createConnection({ host: this.host, port: this.port });

  socket.on("connect", () => {
    let lines = "GET /chat HTTP/1.1\r\n";

    Object.entries(this.headers).map(([key, val]) => {
      lines = lines + `${key} : ${val}` + "\r\n";
    });

    // Separating the header from the body
    lines = lines + "\r\n\r\n";

    socket.write(lines);
  });

  socket.on("data", (chunk) => {
    const firstline = chunk.toString().split("\r\n")[0].trim();

    if (firstline === "HTTP/1.1 101 Switching Protocols") {
      const frame = creatingMaskedFrames("Hello server! I am the client :)");
      console.log("Hello server! I am the client :)");
      socket.write(frame);
    } else {
      const { optCode, message } = parseFrame(chunk);

      if (optCode != 0x08) {
        console.log("coming from the server ", message);
      }
    }
  });

  socket.on("error", (error) => {
    console.log("error :>> ", error);
  });

  return socket;
};

/**
 * Details explanation can be found here : https://datatracker.ietf.org/doc/html/rfc6455#section-5.2
 * Simple structure is as shown below:
 *
 * Byte 0
 * ------
 * FIN   : 1bit // boolean expressing if this is the last frame
 * RSV1  : 1bit // Must be zero unless an extension is negotiated that defines meanings for non-zero values.
 * RSV2  : 1bit // Same as above
 * RSV3  : 1bit // Same as above
 * opcode: 4bit // Metadata about the frame
 *
 * Byte1
 * -----
 * Masked : 1bit // Boolean expressing if the frame is masked
 * payload length : 7bits
 *
 * Byte 2 -5
 * ---------
 * Mask (4bytes)
 *
 *
 * Byte 6 - onwards
 * ----------------
 * Payload
 *
 */

const creatingMaskedFrames = (data) => {
  const payload = Buffer.from(data);
  const mask = crypto.randomBytes(4);

  const { offset, payloadUpdatedLength } = handlePayloadLength(payload.length);

  const frameLength = 2 + offset + mask.length + payload.length;
  const frame = Buffer.alloc(frameLength);

  frame[0] = 0x81; // 10000001
  frame[1] = 0x80 | payloadUpdatedLength; // 10000000 + payload.length

  if (payloadUpdatedLength === 126) {
    frame.writeUInt16BE(payload.length, 2);
  }

  if (payloadUpdatedLength === 127) {
    frame.writeBigUInt64BE(BigInt(payload.length), 2);
  }

  // Adding the mask at the 3rd position in the buffer
  mask.copy(frame, 2 + offset);

  for (let i = 0; i < payload.length; i++) {
    payload[i] = payload[i] ^ mask[i % 4];
  }

  // Adding the masked payload after the mask
  payload.copy(frame, 6 + offset);

  return frame;
};

const handlePayloadLength = (payloadLength) => {
  if (payloadLength <= 125) {
    return {
      payloadUpdatedLength: payloadLength,
      offset: 0,
    };
  } else if (payloadLength <= 65535) {
    return {
      payloadUpdatedLength: 126,
      offset: 2,
    };
  } else {
    return {
      payloadUpdatedLength: 127,
      offset: 8,
    };
  }
};

const parseFrame = (frame) => {
  const firstByte = frame[0];
  const secondByte = frame[1];
  const optCode = firstByte & 0x0f;
  const payloadLength = secondByte & 0x7f;
  const { offset } = getOffset(payloadLength);
  let payload = frame.subarray(2 + offset);
  return { optCode, message: payload.toString() };
};

const getOffset = (payloadLength) => {
  let offset;

  if (payloadLength <= 125) {
    offset = 0;
  } else if (payloadLength === 126) {
    offset = 2;
  } else if (payloadLength === 127) {
    offset = 8;
  }

  return { offset };
};

const webSocketClient = createWebSocketClient(8081, "localhost");

webSocketClient.connect();
