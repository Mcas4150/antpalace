export function connectAntWebSocket(onData) {
    const loc   = window.location;
    const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws    = new WebSocket(`${proto}//${loc.host}/ws`);
  
    ws.addEventListener('open', () => {
      console.log('✔︎ Ant WebSocket connected');
    });
    ws.addEventListener('message', event => {
      try {
        onData(JSON.parse(event.data));
      } catch (err) {
        console.error('WebSocket parse error:', err);
      }
    });
    ws.addEventListener('error', err => {
      console.error('WebSocket error:', err);
    });
  
    return ws;
  }
  