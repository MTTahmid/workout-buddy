import dotenv from 'dotenv';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server as IOServer } from 'socket.io';
import app from './app.js';
import connectDB from './config/db.js';
import { runNotificationSweep } from './services/notificationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = Number(process.env.PORT) || 5000;
const MAX_PORT_RETRIES = 10;

const startServer = async () => {
  await connectDB();

  const server = http.createServer(app);

  const io = new IOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    },
  });

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    socket.on('join-user', ({ userId }) => {
      if (userId) {
        socket.join(`user:${String(userId)}`);
      }
    });

    socket.on('join', ({ buddyPairId }) => {
      if (buddyPairId) {
        socket.join(String(buddyPairId));
        console.log(`Socket ${socket.id} joined room ${buddyPairId}`);
      }
    });

    socket.on('leave', ({ buddyPairId }) => {
      if (buddyPairId) socket.leave(String(buddyPairId));
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', socket.id, reason);
    });
  });

  // make io available to request handlers via req.app.get('io')
  app.set('io', io);

  void runNotificationSweep(io).catch((error) => {
    console.error('Initial notification sweep failed:', error);
  });

  setInterval(() => {
    void runNotificationSweep(io).catch((error) => {
      console.error('Notification sweep failed:', error);
    });
  }, 15 * 60 * 1000);

  const listenWithPortFallback = (port, retriesLeft) => {
    server.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE' && retriesLeft > 0) {
        const nextPort = port + 1;
        console.warn(`Port ${port} is in use. Retrying on ${nextPort}...`);
        listenWithPortFallback(nextPort, retriesLeft - 1);
        return;
      }

      console.error('Failed to start server:', error.message);
      process.exit(1);
    });
  };

  listenWithPortFallback(PORT, MAX_PORT_RETRIES);
};

startServer();
