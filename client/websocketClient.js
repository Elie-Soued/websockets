import net from "net";
import crypto from "crypto";
import { parseFrame, creatingFrames } from "../utils.js";

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
      const frame = creatingFrames("Hello server! I am the client :)", true);
      console.log(
        "Message sent to the server : Hello server! I am the client :)"
      );
      socket.write(frame);
    } else {
      const { optCode, message } = parseFrame(chunk);

      if (optCode != 0x08) {
        console.log("Message coming from the server: ", message);
      }
    }
  });

  socket.on("error", (error) => {
    console.log("error :>> ", error);
  });

  return socket;
};

const webSocketClient = createWebSocketClient(8081, "localhost");

webSocketClient.connect();
