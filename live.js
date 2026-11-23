const relay = 'https://technoda-brain-night-live.workspace-022996.chatgpt.site';
const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const normalizeCode = value => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

function randomCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), value => alphabet[value % alphabet.length]).join('');
}
function roomURL(room, suffix = '') {
  return `${relay}/room/${room}${suffix}`;
}
async function request(url, options = {}) {
  const response = await fetch(url, {...options,signal:AbortSignal.timeout(5000),cache:'no-store'});
  if (!response.ok) {
    const error = new Error(`Relay returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}
function posting(room, suffix, payload, hostKey) {
  const headers = {'Content-Type':'application/json'};
  if (hostKey) headers['X-Host-Key'] = hostKey;
  return request(roomURL(room,suffix),{method:'POST',headers,body:JSON.stringify(payload)});
}
export function hostTransport(onStatus, onVote, snapshot) {
  const secret = crypto.randomUUID();
  let code = randomCode();
  let ready = false;
  let busy = false;
  let sent;
  let timer;
  let previousStatus = '';
  function status(message) {
    if (message===previousStatus) return;
    previousStatus=message;
    onStatus(message, code);
  }
  async function sync() {
    clearTimeout(timer);
    if (busy) return;
    busy=true;
    const current = snapshot();
    const {round,phase,openedAt,deadline,voteWindow} = current;
    const payload = {round,phase,openedAt,deadline};
    try {
      if (!ready) {
        status('פותחים חדר…');
        await posting(code,'',payload,secret);
        ready=true;
        sent=openedAt;
      } else if (sent!==openedAt) {
        await posting(code,'/stage',payload,secret);
        sent=openedAt;
      }
      status('מוכן לקבל משפחות');
      if (voteWindow && phase!=='science') {
        const votes=await request(roomURL(code,`/results?round=${round}&openedAt=${voteWindow}`),{headers:{'X-Host-Key':secret}});
        votes.forEach(v => onVote({...v,round,openedAt:voteWindow}));
      }
    } catch (error) {
      if (!ready && error.status===409) {
        code=randomCode();
        previousStatus='';
      }
      if (ready && error.status===404) {
        ready=false;
        sent=undefined;
      }
      status('החיבור לשירות ההצבעה נקטע. מנסים שוב…');
    } finally {
      busy=false;
      const changed=snapshot().openedAt!==openedAt;
      timer=setTimeout(sync, changed ? 0 : 1150);
    }
  }
  queueMicrotask(sync);
  return {broadcast:sync};
}

export function joinTransport(room, onStatus, onMessage) {
  let closed=false;
  let connected=false;
  let timer;
  let missing=0;
  async function sync() {
    if (closed) return;
    try {
      const state=await request(roomURL(room));
      if (closed) return;
      connected=true;
      missing=0;
      onStatus('מחוברים לאולם',false);
      onMessage({kind:'state',...state});
    } catch (error) {
      if (closed) return;
      connected=false;
      missing++;
      if (error.status===404 && missing>=3) onStatus('החדר עדיין לא זמין. בדקו את הקוד עם המנחה.',true);
      else onStatus(missing>=3?'מנסים להתחבר מחדש…':'מתחברים למנחה…',missing>=3);
    }
    timer=setTimeout(sync, 1050+Math.random()*480);
  }
  queueMicrotask(sync);
  return {
    send(message) {
      if (!connected || closed) return false;
      const {round,openedAt,voter,choice}=message;
      posting(room,'/vote',{round,openedAt,voter,choice})
        .then(result => { if (!closed) onMessage({kind:'ack',accepted:result.accepted,round,openedAt,choice}); })
        .catch(() => { if (!closed) onStatus('לא התקבל אישור. אפשר לנסות שוב.',true); });
      return true;
    },
    close() { closed=true; clearTimeout(timer); },
  };
}
