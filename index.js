import express from "express";
import http from "http";
import morgan from "morgan";
import { Server as SocketServer } from "socket.io";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { PORT } from "./config.js";
import cors from "cors";

// Inicializaciones
const app = express();
const server = http.createServer(app);

app.get('/', (req, res) => {
  res.send('Servidor funcionando correctamente');
});

const io = new SocketServer(server, {
  cors: {
    origin: "'https://scoring-am.web.app", // O el puerto en el que está tu aplicación ReactJS
  },
});
const __dirname = dirname(fileURLToPath(import.meta.url));

// Middlewares
app.use(cors());
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: false }));

// Archivos estáticos
app.use(express.static(join(__dirname, "../client/build")));

// Objeto para almacenar los clientes conectados a cada cancha
const canchaClients = {};

// Manejo de conexiones de Socket.IO
io.on("connection", (socket) => {
  // Manejar identificación del cliente
  socket.on("identify", (data) => {
    const { cancha, type } = data;
    if (!canchaClients[cancha]) {
      canchaClients[cancha] = { arbitros: [], clientes: [] };
    }

    if (type === "arbitro") {
      canchaClients[cancha].arbitros.push(socket.id);
    } else {
      canchaClients[cancha].clientes.push(socket.id);
    }

    console.log(`Cliente identificado: ${socket.id} como ${type} en ${cancha}`);
    // Emitir el conteo actualizado a todos los clientes de la cancha
    io.to(cancha).emit("clientCount", {
      arbitros: canchaClients[cancha].arbitros.length,
      clientes: canchaClients[cancha].clientes.length,
    });
    socket.join(cancha); // Unir el socket a la sala de la cancha
  });

  // Manejar mensajes del cliente
  socket.on("message", (body) => {
    console.log(`Mensaje de ${socket.id}:`, body);

    // Enviar mensaje a un cliente específico usando su nombre
    const targetCancha = body.cancha; // Cambia esto según necesites
    io.to(targetCancha).emit("message", body);
  });

  socket.on("disconnect", () => {
  //  console.log("Cliente desconectado:", socket.id);
    // Eliminar la conexión del cliente
    for (const [cancha, clients] of Object.entries(canchaClients)) {
      const { arbitros, clientes } = clients;
      const arbitroIndex = arbitros.indexOf(socket.id);
      const clienteIndex = clientes.indexOf(socket.id);
      if (arbitroIndex !== -1) {
        arbitros.splice(arbitroIndex, 1);
      } else if (clienteIndex !== -1) {
        clientes.splice(clienteIndex, 1);
      }
      // Emitir el conteo actualizado a todos los clientes de la cancha
      io.to(cancha).emit("clientCount", {
        arbitros: arbitros.length,
        clientes: clientes.length,
      });
      // Eliminar la cancha si no tiene más clientes ni árbitros
      if (arbitros.length === 0 && clientes.length === 0) {
        delete canchaClients[cancha];
      }
    }
  });
});

// Iniciar el servidor
server.listen(PORT);
//console.log(`Server running on port ${PORT}`);