import express from "express";
import http from "http";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const users = new Map();

app.use(express.static(path.join(__dirname, "public")));

function send(socket, data) {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(data));
  }
}

function createId() {
  let id;

  do {
    id = crypto.randomBytes(3).toString("hex").toUpperCase();
  } while (users.has(id));

  return id;
}

wss.on("connection", (socket) => {
  const id = createId();

  users.set(id, socket);

  send(socket, {
    type: "connected",
    id
  });

  socket.on("message", (message) => {
    let data;

    try {
      data = JSON.parse(message.toString());
    } catch {
      return;
    }

    if (data.type === "signal") {
      const target = users.get(data.target);

      if (!target) {
        send(socket, {
          type: "error",
          message: "دستگاه موردنظر پیدا نشد."
        });

        return;
      }

      send(target, {
        type: "signal",
        from: id,
        data: data.data
      });
    }
  });

  socket.on("close", () => {
    users.delete(id);
  });

  socket.on("error", () => {
    users.delete(id);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
