const prefix = 'technoda-brain-night-v1-';
const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const normalizeCode = value => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

function code() {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), value => alphabet[value % alphabet.length]).join('');
}

export function hostTransport(onStatus, onVote, snapshot) {
  let room = code();
  let peer;
  let ready = false;
  const links = new Set();

  function connect() {
    peer = new window.Peer(prefix + room.toLowerCase());
    peer.on('open', () => { ready = true; onStatus('מוכן לקבל משפחות', room); });
    peer.on('connection', link => {
      links.add(link);
      const send = () => link.send({kind:'state', ...snapshot()});
      link.on('open', send);
      link.on('data', data => {
        if (!data || typeof data !== 'object') return;
        if (data.kind === 'hello') send();
        if (data.kind === 'vote') {
          const accepted = onVote(data);
          if (link.open) link.send({kind:'ack', accepted, round:data.round, openedAt:data.openedAt, choice:data.choice});
        }
      });
      link.on('close', () => links.delete(link));
      link.on('error', () => links.delete(link));
    });
    peer.on('disconnected', () => {
      ready = false;
      onStatus('מחדש את החיבור לחדר…', room);
      if (!peer.destroyed) peer.reconnect();
    });
    peer.on('error', error => {
      if (error.type === 'unavailable-id') {
        peer.destroy();
        room = code();
        connect();
        return;
      }
      if (error.type === 'peer-unavailable') return;
      onStatus('יש קושי בחיבור. בדקו אינטרנט או נסו לפתוח את המסך מחדש.', room);
    });
  }
  if (typeof window.Peer === 'function') connect();
  else queueMicrotask(() => onStatus('רכיב החיבור לא נטען. בדקו אינטרנט ורעננו את הדף.', room));
  return {
    room: () => room,
    ready: () => ready,
    broadcast() {
      for (const link of links) {
        if (link.open) link.send({kind:'state', ...snapshot()});
      }
    },
  };
}

export function joinTransport(room, onStatus, onMessage) {
  let peer, link, timeout, retry, closed = false;
  const report = onStatus;
  const retryLater = () => {
    clearTimeout(timeout);
    clearTimeout(retry);
    if (!closed) retry = setTimeout(connect, 2800);
  };
  function connect() {
    if (closed) return;
    if (typeof window.Peer !== 'function') {
      report('רכיב החיבור לא נטען. רעננו את הדף ונסו שוב.', true);
      return;
    }
    if (peer) {
      const previous = peer;
      peer = null;
      previous.destroy();
    }
    link = null;
    report('מתחברים למנחה…', false);
    const current = new window.Peer();
    peer = current;
    timeout = setTimeout(() => {
      if (current !== peer || link?.open) return;
      report('עדיין מחפשים את החדר. בדקו את הקוד ואת החיבור לאינטרנט.', true);
      retryLater();
    }, 9500);
    current.on('open', () => {
      if (current !== peer || closed) return;
      const connection = current.connect(prefix + room.toLowerCase(), {reliable:true});
      link = connection;
      connection.on('open', () => {
        if (current !== peer || closed) return;
        clearTimeout(timeout);
        report('מחוברים לאולם', false);
        connection.send({kind:'hello'});
      });
      connection.on('data', message => { if (current === peer && !closed) onMessage(message); });
      connection.on('close', () => {
        if (current !== peer || closed) return;
        report('החיבור נקטע. מנסים שוב…', true);
        retryLater();
      });
    });
    current.on('error', () => {
      if (current !== peer || closed || link?.open) return;
      report('החדר עדיין לא זמין. בדקו את הקוד עם המנחה.', true);
      retryLater();
    });
  }
  connect();
  return {
    send(message) { if (!link?.open) return false; link.send(message); return true; },
    close() { closed = true; clearTimeout(timeout); clearTimeout(retry); peer?.destroy(); },
  };
}
