import net from "net";
import crypto from "crypto";
import { parseFrame, creatingFrames, extractHeaders } from "../utils.js";

let handshakeDone = false;

const server = net.createServer((socket) => {
  socket.on("data", (data) => {
    const headers = extractHeaders(data.toString());
    if (!handshakeDone) {
      const confirmation = handshake(headers);
      socket.write(confirmation);
    } else {
      const { message, isMasked, optCode } = parseFrame(data, true);

      if (optCode == 0x08 || !isMasked) {
        socket.end();
      } else {
        console.log("message coming from the client: ", message);
        const outwardMessage = " Hey client, what's up bro? I am the server";
        const confirmationMessage = creatingFrames(outwardMessage);
        console.log("message sent to the client: ", outwardMessage);
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
