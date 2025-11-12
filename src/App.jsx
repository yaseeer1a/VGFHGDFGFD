import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const SERVER_URL = "http://localhost:5050"; // رابط السيرفر المحلي

export default function App() {
  const [step, setStep] = useState("tuning"); // tuning = اختيار الموجة
  const [wave, setWave] = useState("");
  const [state, setState] = useState({ currentSpeaker: null });
  const socketRef = useRef(null);

  // عند تأكيد الموجة
  const confirmWave = () => {
    const n = Number(wave);
    if (!n || n < 1 || n > 500) return alert("رقم الموجة من 1 إلى 500");

    socketRef.current = io(SERVER_URL);
    socketRef.current.emit("joinWave", n);

    socketRef.current.on("waveUpdate", (data) => setState(data));
    socketRef.current.on("denied", (msg) => alert(msg));

    setStep("ptt");
  };

  // طلب التحدث
  const acquireFloor = () => socketRef.current.emit("acquireFloor");
  const releaseFloor = () => socketRef.current.emit("releaseFloor");

  if (step === "tuning") {
    return (
      <div className="h-screen flex items-center justify-center p-4">
        <div className="card w-[360px] p-6">
          <h1 className="text-2xl font-bold mb-3">virex Voice</h1>
          <p className="text-sm opacity-80 mb-4">
            اكتب رقم الموجة (1–500) ثم اضغط تأكيد
          </p>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-[#0c132b] border border-white/10 rounded-2xl px-4 py-3 outline-none focus:border-accent"
              placeholder="مثال: 77"
              value={wave}
              onChange={(e) => setWave(e.target.value.replace(/\D/g, ""))}
            />
            <button
              onClick={confirmWave}
              className="px-4 py-3 rounded-2xl bg-primary hover:brightness-110 transition"
            >
              تأكيد
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center p-4">
      <div className="card w-[360px] p-6 text-center">
        <h2 className="text-xl font-semibold mb-1">الموجة #{wave}</h2>
        <p className="text-xs opacity-70 mb-6">
          {state.currentSpeaker
            ? state.currentSpeaker === socketRef.current?.id
              ? "🎙️ أنت تتحدث الآن"
              : "🔇 هناك شخص يتحدث"
            : "متاح للتحدث"}
        </p>

        <button
          onMouseDown={acquireFloor}
          onMouseUp={releaseFloor}
          onMouseLeave={releaseFloor}
          onTouchStart={(e) => {
            e.preventDefault();
            acquireFloor();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            releaseFloor();
          }}
          className={`w-full h-44 rounded-2xl transition-all select-none ${
            state.currentSpeaker && state.currentSpeaker !== socketRef.current?.id
              ? "bg-[#2a2f47] cursor-not-allowed"
              : "bg-accent hover:scale-[1.02]"
          }`}
          disabled={!!state.currentSpeaker && state.currentSpeaker !== socketRef.current?.id}
        >
          <div className="text-2xl font-bold">اضغط وتكلم</div>
          <div className="text-xs mt-2 opacity-80">ارفع إصبعك للتوقف</div>
        </button>

        <div className="mt-6 text-xs opacity-70">
          الصوت: واضح وصافي | منع تداخل | تصميم ناعم
        </div>
      </div>
    </div>
  );
}
