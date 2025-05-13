// wrap Janus.init + attach logic
// modules/janusClient.js
export function initJanus(server, streamId, { onAttach, onMessage, onRemoteTrack }) {
    Janus.init({
      debug: 'warn',
      callback() {
        // when Janus.init is done, construct a new Janus session
        const janus = new Janus({
          server,
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
          success() {
            // here `janus` is in scope
            janus.attach({
              plugin: 'janus.plugin.streaming',
              success(handle) {
                onAttach(handle);
              },
              onmessage(msg, jsep) {
                onMessage(msg, jsep);
              },
              onremotetrack(track, mid, on) {
                onRemoteTrack(track, mid, on);
              },
              error(err) {
                console.error('Janus plugin error:', err);
              }
            });
          },
          error(err) {
            console.error('Janus session error:', err);
          },
          destroyed() {
            console.log('Janus session destroyed');
          }
        });
      }
    });
  }
  