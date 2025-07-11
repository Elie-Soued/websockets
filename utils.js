import crypto from "crypto";

export const creatingFrames = (data, masked) => {
  const payload = Buffer.from(data);

  const { offset, payloadUpdatedLength } = handlePayloadLength(payload.length);

  let frameLength;
  let frame;
  let mask;

  if (masked) {
    mask = crypto.randomBytes(4);
    frameLength = 2 + offset + mask.length + payload.length;
    frame = Buffer.alloc(frameLength);
  } else {
    frameLength = 2 + offset + payload.length;
    frame = Buffer.alloc(frameLength);
  }

  frame[0] = 0x81; // 10000001
  frame[1] = 0x80 | payloadUpdatedLength; // 10000000 + payload.length

  if (payloadUpdatedLength === 126) {
    frame.writeUInt16BE(payload.length, 2);
  }

  if (payloadUpdatedLength === 127) {
    frame.writeBigUInt64BE(BigInt(payload.length), 2);
  }

  if (masked) {
    mask.copy(frame, 2 + offset);
    for (let i = 0; i < payload.length; i++) {
      payload[i] = payload[i] ^ mask[i % 4];
    }
    payload.copy(frame, 6 + offset);
  } else {
    payload.copy(frame, 2 + offset);
  }

  return frame;
};

export const parseFrame = (frame, masked) => {
  const firstByte = frame[0];
  const secondByte = frame[1];
  const optCode = firstByte & 0x0f;
  const payloadLength = secondByte & 0x7f;

  const { offset } = getOffset(payloadLength, frame);

  let payload = frame.subarray(2 + offset);

  if (masked) {
    const isMasked = secondByte & 0x80;
    const { mask } = getMask(payloadLength, frame);
    let payload = frame.subarray(2 + mask.length + offset);
    for (let i = 0; i < payload.length; i++) {
      payload[i] = payload[i] ^ mask[i % 4];
    }
    return { optCode, message: payload.toString(), isMasked };
  }

  return { optCode, message: payload.toString() };
};

export const handshake = (data) => {
  const headersIcoming = extractHeaders(data.toString());

  if (
    headersIcoming.Connection === "Upgrade" &&
    headersIcoming.Upgrade === "websocket"
  ) {
    const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    const accept = crypto.hash(
      "sha1",
      headersIcoming["Sec-WebSocket-Key"] + GUID,
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

    return {
      confirmation: lines,
      handshakeIsDone: true,
    };
  } else {
    console.log("ouf");
  }
};

export const prepareClientHeaders = (headers) => {
  let lines = "GET /chat HTTP/1.1\r\n";

  Object.entries(headers).map(([key, val]) => {
    lines = lines + `${key} : ${val}` + "\r\n";
  });

  // Separating the header from the body
  return lines + "\r\n\r\n";
};

const extractHeaders = (data) => {
  const headers = {};

  const lines = data.split("\r\n\r\n")[0];

  for (let line of lines.split("\r\n").slice(1)) {
    const [key, value] = line.split(":");
    if (key && value) headers[key.trim()] = value.trim();
  }

  return headers;
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

const getMask = (payloadLength, frame) => {
  let mask;
  if (payloadLength <= 125) {
    mask = frame.subarray(2, 6);
  } else if (payloadLength === 126) {
    mask = frame.subarray(4, 8);
  } else if (payloadLength === 127) {
    mask = frame.subarray(10, 14);
  }

  return { mask };
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
