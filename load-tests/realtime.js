import ws from "k6/ws";
import { Rate } from "k6/metrics";
import { config } from "./config.js";

export const successfulRealtimeConnects = new Rate("realtime_connect_success_rate");
export const realtimeSessionIsolation = new Rate("realtime_session_isolation_rate");

export function realtimeProbe(quizCode, holdSeconds = config.realtimeHoldSeconds) {
  let connected = false;
  let receivedForeignSession = false;
  const code = quizCode || config.quizCode;

  const wsUrl = config.supabaseUrl
    .replace(/^https:/, "wss:")
    .replace(/^http:/, "ws:")
    .replace(/\/$/, "");

  ws.connect(`${wsUrl}/realtime/v1/websocket?apikey=${config.supabaseAnonKey}&vsn=1.0.0`, {
    tags: { flow: "realtime", endpoint: "supabase_realtime_ws", quiz_code: code },
  }, (socket) => {
    socket.on("open", () => {
      connected = true;
      successfulRealtimeConnects.add(true, { quiz_code: code });
      socket.send(JSON.stringify({
        topic: `realtime:quiz-status-${code}`,
        event: "phx_join",
        payload: {},
        ref: `${Date.now()}`,
      }));
      socket.setInterval(() => {
        socket.send(JSON.stringify({
          topic: "phoenix",
          event: "heartbeat",
          payload: {},
          ref: `${Date.now()}`,
        }));
      }, 15000);
      socket.setTimeout(() => {
        realtimeSessionIsolation.add(!receivedForeignSession, { quiz_code: code });
        socket.close();
      }, Math.max(1, holdSeconds) * 1000);
    });

    socket.on("message", (message) => {
      try {
        const parsed = JSON.parse(message);
        const payloadCode = parsed?.payload?.payload?.access_code || parsed?.payload?.access_code;
        if (payloadCode && payloadCode !== code) {
          receivedForeignSession = true;
        }
      } catch (_) {
        // Ignore non-JSON websocket frames.
      }
    });

    socket.on("error", () => {
      if (!connected) successfulRealtimeConnects.add(false, { quiz_code: code });
    });
  });
}

