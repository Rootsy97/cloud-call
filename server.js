const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "https://rootsy97.github.io",
      "http://localhost:3000"
    ],
    methods: ["GET", "POST"]
  }
});

app.get("/", (_req, res) => {
  res.send("Cloud Call signaling server is running.");
});

io.on("connection", (socket) => {
  socket.on("join-room", ({ room, displayName }) => {
    if (typeof room !== "string" || !/^[a-zA-Z0-9_-]{3,40}$/.test(room)) {
      socket.emit("app-error", "رمز الغرفة يجب أن يتكون من 3 إلى 40 حرفاً أو رقماً.");
      return;
    }

    const members = io.sockets.adapter.rooms.get(room);
    if (members && members.size >= 2) {
      socket.emit("app-error", "الغرفة ممتلئة؛ يسمح بوجود شخصين فقط.");
      return;
    }

    socket.join(room);
    socket.data.room = room;
    socket.data.displayName = String(displayName || "مستخدم").slice(0, 40);

    const currentMembers = io.sockets.adapter.rooms.get(room);
    const count = currentMembers ? currentMembers.size : 1;

    socket.emit("room-joined", {
      room,
      count,
      peerPresent: count === 2
    });

    socket.to(room).emit("peer-joined", {
      displayName: socket.data.displayName
    });
  });

  for (const eventName of ["webrtc-offer", "webrtc-answer", "webrtc-ice"]) {
    socket.on(eventName, (payload) => {
      const room = socket.data.room;
      if (!room) return;
      socket.to(room).emit(eventName, payload);
    });
  }

  socket.on("leave-room", () => leaveRoom(socket));
  socket.on("disconnect", () => leaveRoom(socket));
});

function leaveRoom(socket) {
  const room = socket.data.room;
  if (room) {
    socket.to(room).emit("peer-left");
    socket.leave(room);
    socket.data.room = null;
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Cloud Call server listening on ${PORT}`);
});
