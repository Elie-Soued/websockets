import net from "net";
import crypto from "crypto";

let handshakeDone = false;

const server = net.createServer((socket) => {
  socket.on("data", (data) => {
    const headers = extractHeaders(data.toString());
    if (!handshakeDone) {
      const confirmation = handshake(headers);
      socket.write(confirmation);
    } else {
      const { message, isMasked, optCode } = parseFrame(data);

      if (optCode == 0x08 || !isMasked) {
        socket.end();
      } else {
        console.log("message coming from the client  :>> ", message);
        const confirmationMessage = creatingNonMaskedFrames("Roger client");
        console.log("message sent to client : Roger client");
        socket.write(confirmationMessage);
      }
    }
  });

  socket.on("end", () => {
    console.log("client disconnected");
  });
});

server.listen(8081, () => {
  console.log("server running on port 8081");
});

const extractHeaders = (data) => {
  const headers = {};

  const lines = data.split("\r\n\r\n")[0];

  for (let line of lines.split("\r\n").slice(1)) {
    const [key, value] = line.split(":");
    if (key && value) headers[key.trim()] = value.trim();
  }

  return headers;
};

const handshake = (head) => {
  if (head.Connection === "Upgrade" && head.Upgrade === "websocket") {
    const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    const accept = crypto.hash(
      "sha1",
      head["Sec-WebSocket-Key"] + GUID,
      "base64"
    );

    let lines = "HTTP/1.1 101 Switching Protocols \r\n";

    const headers = {
      Upgrade: "websocket",
      Connection: "Upgrade",
      "Sec-WebSocket-Accept": `${accept}`,
    };

    Object.entries(headers).map(([key, value]) => {
      lines = lines + `${key} : ${value} \r\n`;
    });

    lines = lines + "\r\n\r\n";
    handshakeDone = true;
    return lines;
  } else {
    console.log("ouf");
  }
};

const parseFrame = (frame) => {
  const firstByte = frame[0];
  const secondByte = frame[1];

  const optCode = firstByte & 0x0f;
  const isMasked = secondByte & 0x80;

  const payloadLength = secondByte & 0x7f;

  const { mask, offset } = getMaskAndOffset(payloadLength, frame);

  let payload = frame.subarray(6 + offset);

  for (let i = 0; i < payload.length; i++) {
    payload[i] = payload[i] ^ mask[i % 4];
  }

  return { optCode, message: payload.toString(), isMasked };
};

const getMaskAndOffset = (payloadLength, frame) => {
  let offset = 0;
  let mask;

  if (payloadLength <= 125) {
    mask = frame.subarray(2, 6);
  } else if (payloadLength === 126) {
    offset = 2;
    mask = frame.subarray(2 + offset, 6 + offset);
  } else if (payloadLength === 127) {
    offset = 8;
    mask = frame.subarray(2 + offset, 6 + offset);
  }

  return { offset, mask };
};

const creatingNonMaskedFrames = (data) => {
  const payload = Buffer.from(data);

  const { offset, payloadUpdatedLength } = handlePayloadLength(payload.length);

  const frameLength = 2 + offset + payload.length;
  const frame = Buffer.alloc(frameLength);

  frame[0] = 0x81; // 10000001
  frame[1] = payloadUpdatedLength; // 10000000 + payload.length

  if (payloadUpdatedLength === 126) {
    frame.writeUInt16BE(payload.length, 2);
  }

  if (payloadUpdatedLength === 127) {
    frame.writeBigUInt64BE(BigInt(payload.length), 2);
  }

  // Adding the masked payload after the mask
  payload.copy(frame, 2 + offset);

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
