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

export const extractHeaders = (data) => {
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
