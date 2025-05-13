// wrap Janus.init + attach logic
// modules/janusClient.js

import Janus from "janus-gateway";

let plugin = null; // Keep plugin handle within this module

// handleAttach: Called when the Janus plugin is successfully attached.
function handleAttach(handle, streamId) {
  plugin = handle;
  console.log("Attached to plugin:", handle);
  // Send a message to the Janus streaming plugin to watch the specified stream ID.
  plugin.send({ message: { request: 'watch', id: streamId } });
}

// handleMessage: Called when a message is received from Janus.
// This is typically used to handle JSEP (Session Description Protocol) offers/answers.
function handleMessage(msg, jsep) {
  if (!jsep) return; // Ignore messages without JSEP.
  // Create an answer to the received JSEP offer.
  plugin.createAnswer({
    jsep, // The received JSEP offer.
    media: { audioSend: false, videoSend: false }, // Configure media (not sending audio/video from client).
    success: answer => plugin.send({ message: { request: 'start' }, jsep: answer }), // On success, send the answer to Janus.
    error: console.error // Log any errors.
  });
}


export async function initJanus(server, streamId, { onRemoteTrack }) {
  if (!window.Janus) {
    await import(
      "https://cdn.jsdelivr.net/npm/janus-gateway@1.3.1/npm/janus.min.js"
    );
  }

  window.Janus.init({
    debug: "warn",
    callback() {
      const janus = new window.Janus({
        server,
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        success() {
          janus.attach({
            plugin: "janus.plugin.streaming",
            success(handle) {
              handleAttach(handle, streamId);
            },
            onmessage(msg, jsep) {
              handleMessage(msg, jsep);
            },
            onremotetrack(track, mid, on) {
              onRemoteTrack(track, mid, on);
            },
            error(err) {
              console.error("Janus plugin error:", err);
            },
          });
        },
        error(err) {
          console.error("Janus session error:", err);
        },
        destroyed() {
          console.log("Janus session destroyed");
        },
      });
    },
  });
}
