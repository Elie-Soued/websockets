import net from "net";
import { parseFrame, creatingFrames, handshake } from "../utils.js";

const server = net.createServer((socket) => {
  let handshakeDone = false;
  socket.on("data", (data) => {
    if (!handshakeDone) {
      const { confirmation, handshakeIsDone } = handshake(data.toString());
      handshakeDone = handshakeIsDone;
      socket.write(confirmation);
    } else {
      const { message, isMasked, optCode } = parseFrame(data, true);
      if (optCode == 0x08 || !isMasked) {
        socket.end();
      } else {
        console.log("coming from the client: ", message);
        const outwardMessage = " Hey client, what's up bro? I am the server";
        const confirmationMessage = creatingFrames(outwardMessage);
        console.log("sent to the client: ", outwardMessage);
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
