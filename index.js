// ===== virex-voice server (Express + Socket.IO + LiveKit tokens) =====
import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// حالة كل موجة: متحدث واحد فقط
const waves = new Map(); // key: waveNumber(string) -> { currentSpeaker: userId|null, users:Set }
function getWave(wave) {
  const k = String(wave);
  if (!waves.has(k)) waves.set(k, { currentSpeaker: null, users: new Set() });
  return waves.get(k);
}

// ===== إصدار توكن LiveKit =====
function mintLiveKitToken({ identity, roomName, canPublish }) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret || !process.env.LIVEKIT_URL) {
    console.error('❌ مفقود LIVEKIT_URL/API_KEY/API_SECRET في .env');
  }
  const now = Math.floor(Date.now() / 1000);
  const grants = {
    video: false,
    room: roomName,
    roomJoin: true,
    canPublish,           // true فقط للمتحدث
    canSubscribe: true,
    canPublishData: true,
  };
  const payload = { iss: apiKey, sub: identity, nbf: now - 10, exp: now + 600, grants };
  return jwt.sign(payload, apiSecret, { algorithm: 'HS256' });
}

// مستمع دائم (subscribe فقط)
app.post('/token/listener', (req, res) => {
  const { userId, wave } = req.body || {};
  if (!userId || !wave) return res.status(400).json({ error: 'missing userId/wave' });
  const roomName = `wave-${wave}`;
  const token = mintLiveKitToken({ identity: `u_${userId}`, roomName, canPublish: false });
  res.json({ token, url: process.env.LIVEKIT_URL, roomName });
});

// متحدث (يُسمح فقط إذا هو صاحب الدور)
app.post('/token/speaker', (req, res) => {
  const { userId, wave } = req.body || {};
  const w = getWave(String(wave));
  if (!userId || !wave) return res.status(400).json({ error: 'missing userId/wave' });
  if (!w || w.currentSpeaker !== userId) return res.status(403).json({ error: 'no-floor' });
  const roomName = `wave-${wave}`;
  const token = mintLiveKitToken({ identity: `u_${userId}`, roomName, canPublish: true });
  res.json({ token, url: process.env.LIVEKIT_URL, roomName });
});

// ===== Socket.IO: منطق المتحدث الواحد =====
io.on('connection', (socket) => {
  let joinedWave = null;
  const userId = socket.handshake.query?.userId || socket.id;

  socket.on('joinWave', (waveNumber) => {
    const n = String(waveNumber);
    joinedWave = n;
    const w = getWave(n);
    w.users.add(userId);
    socket.join(`wave-${n}`);
    io.to(`wave-${n}`).emit('waveUpdate', { currentSpeaker: w.currentSpeaker });
    console.log(`🔊 ${userId} دخل الموجة ${n}`);
  });

  socket.on('acquireFloor', () => {
    if (!joinedWave) return;
    const w = getWave(joinedWave);
    if (w.currentSpeaker && w.currentSpeaker !== userId) {
      socket.emit('denied', 'يوجد شخص يتحدث الآن 🎙️');
      return;
    }
    w.currentSpeaker = userId;
    io.to(`wave-${joinedWave}`).emit('waveUpdate', { currentSpeaker: w.currentSpeaker });
    socket.emit('granted');
    console.log(`🎤 ${userId} بدأ يتحدث في الموجة ${joinedWave}`);
  });

  socket.on('releaseFloor', () => {
    if (!joinedWave) return;
    const w = getWave(joinedWave);
    if (w.currentSpeaker === userId) {
      w.currentSpeaker = null;
      io.to(`wave-${joinedWave}`).emit('waveUpdate', { currentSpeaker: null });
      console.log(`🔇 ${userId} توقف في الموجة ${joinedWave}`);
    }
  });

  socket.on('disconnect', () => {
    if (!joinedWave) return;
    const w = getWave(joinedWave);
    w.users.delete(userId);
    if (w.currentSpeaker === userId) {
      w.currentSpeaker = null;
      io.to(`wave-${joinedWave}`).emit('waveUpdate', { currentSpeaker: null });
    }
  });
});

const PORT = process.env.PORT || 5050;
server.listen(PORT, () => console.log(`✅ السيرفر شغال على المنفذ ${PORT}`));
