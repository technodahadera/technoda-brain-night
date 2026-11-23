import {rounds} from './data.js?v=6';
import {drawShapes, playSound, stopSound} from './media.js';
import {hostTransport, joinTransport, normalizeCode} from './live.js?v=5';

const app = document.querySelector('#app');
const query = new URLSearchParams(location.search);
const view = query.get('view');
const letters = ['א','ב','ג','ד'];
const modes = new Set(['task','vote','reveal','science']);
const finished = rounds.length;
const badge = (round, index) => `<div class="room-icon ${round.color}" aria-hidden="true">${round.icon}</div><p class="phase-label">${index ? `תחנה ${index} מתוך 7` : 'מתחילים בחימום'}</p>`;
const stationArt = (index, className) =>
  `<img class="${className}" src="./assets/station-${index}.webp" alt="" decoding="async">`;
const makeButton = (action, text, style = 'secondary', disabled = false) => `<button type="button" class="${style}" data-action="${action}" ${disabled ? 'disabled' : ''}>${text}</button>`;
const progress = index => `<div class="round-progress" role="img" aria-label="שלב ${index+1} מתוך 8">${rounds.map((_,i) => `<i class="${i<index?'done':i===index?'now':''}"></i>`).join('')}</div>`;
const footerArt = '<img src="./assets/hero.webp" alt="" class="tiny-art">';
const thankYou = '<h1>תודה שהצטרפתם למסע בתוך הראש שלהם!</h1><p>איזה רגע מהערב תרצו לספר עליו בבית?</p>';
const kitchenSteps = ['פתיחת המקרר','הוצאת חלב','הפעלת קומקום','ערבוב בכוס','הדלקת הטלוויזיה'];
let onSoundFinished;
let activeSound = '';
let soundError = '';
let currentTimer = 0;

function updateTimer() {
  const timer = app.querySelector('[data-timer]');
  if (!timer || !currentTimer) return;
  const remaining = Math.max(0, currentTimer - Date.now());
  const millis = timer.dataset.timer === 'ms';
  timer.textContent = millis ? (remaining / 1000).toFixed(3) : Math.ceil(remaining / 1000);
}
setInterval(updateTimer, 50);

function syncSound() {
  app.querySelector('.beats')?.classList.toggle('playing', Boolean(activeSound));
  app.querySelectorAll('[data-action^="sound:"]').forEach(b => {
    const play = b.dataset.action.slice(6);
    b.setAttribute('aria-pressed',String(activeSound === play));
    if (b.dataset.label) b.textContent = activeSound === play ? '■ עצירת השמע' : b.dataset.label;
  });
  const status = app.querySelector('[data-sound-status]');
  if (status) status.textContent = soundError;
}
function cancelSound() {
  stopSound();
  activeSound = '';
  soundError = '';
}
async function toggleSound(kind) {
  if (activeSound === kind) { cancelSound(); syncSound(); return; }
  activeSound = kind;
  soundError = '';
  syncSound();
  try {
    await playSound(kind, () => {
      activeSound = '';
      syncSound();
      onSoundFinished?.(kind);
    });
  } catch {
    cancelSound();
    soundError = 'לא הצלחנו להשמיע את הקטע. בדקו את השמע ונסו שוב.';
    syncSound();
  }
}

function soundButton(kind, label) {
  return `<button type="button" class="secondary" data-action="sound:${kind}" data-label="${label}" aria-pressed="false">${label}</button>`;
}
const soundStatus = '<p class="status error" data-sound-status role="status"></p>';
function visual(index, reveal = false) {
  if (index === 1 && !reveal) {
    const words = ['אדום','צהוב','כחול','ירוק','שחור','ירוק','אדום','שחור','צהוב','כחול'];
    const colors = ['#168348','#2159b3','#c92942','#202024','#996604','#c92942','#2159b3','#168348','#202024','#996604'];
    return `<div class="stroop">${words.map((word,i) => `<b style="color:${colors[i]}">${word}</b>`).join('')}</div>`;
  }
  if (index === 2) {
    return `<div class="shapes">${['מקור',...letters].map((label,i) => `<div class="shape ${reveal&&i===3?'match':''}"><canvas width="210" height="200" data-shape="${i}" aria-label="מבנה קוביות ${label}"></canvas>${label}</div>`).join('')}</div>`;
  }
  if (index === 5) {
    return `<div class="mystery ${reveal?'outlined':''}"><img src="./assets/mystery.webp" alt="תבנית כתמים בשחור־לבן">${reveal?'<img class="solution" src="./assets/astronaut.webp" alt="התמונה המקורית, האסטרונאוטית איילין קולינס">':''}</div>`;
  }
  const media = rounds[index].media;
  if (media && !reveal) {
    return `<div class="beats" aria-hidden="true">${[20,35,48,68,56,89,69,100,65,88,52,64,40,51,24].map((h,i) => `<b style="--h:${h}%;--d:-${i*58}ms"></b>`).join('')}</div>${soundButton(media,'▶ השמעת הקטע')}${soundStatus}`;
  }
  if (reveal && index === 3) return `<div class="sound-controls">${soundButton('mary','▶ יונתן הקטן')}${soundButton('jacob','▶ אחינו יעקב')}${soundButton('mix','▶ ביחד')}</div>${soundStatus}`;
  if (reveal && index === 6) return `<div class="sound-controls">${soundButton('normal','▶ במהירות רגילה')}${soundButton('speed','▶ במהירות פי ארבעה')}</div>${soundStatus}`;
  if (reveal && index === 7) return `<ol class="sequence">${kitchenSteps.map(s => `<li>${s}</li>`).join('')}</ol>${soundButton('kitchen','▶ השמעה חוזרת')}${soundStatus}`;
  if (reveal && index === 4) return `<p dir="ltr" class="result" style="text-align:right">${rounds[index].equation}</p>`;
  return '';
}

function research(round, index) {
  const media = round.scienceVideo
    ? `<video controls playsinline preload="metadata" aria-labelledby="science-title" src="${round.scienceVideo}"></video>`
    : stationArt(index, 'science-art');
  return `<section class="science-card ${round.scienceVideo ? 'science-video-card' : ''}" aria-labelledby="science-title">
    <div class="science-copy">
      <p class="science-label">מה המדע אומר על ילדים מחוננים?</p>
      <h2 id="science-title">${round.scienceTitle}</h2>
      <p>${round.science}</p>
      <div class="science-source">
        <b class="science-article" lang="en" dir="ltr">${round.articleTitle}</b>
        <span class="science-author"><bdi>${round.ref}</bdi></span>
        <a href="${round.link}" target="_blank" rel="noopener noreferrer">לקריאת המאמר <span aria-hidden="true">↗</span></a>
      </div>
    </div>
    <div class="science-media">${media}</div>
  </section>`;
}
function voteButtons(round, selected, disabled, reveal = false) {
  return `<div class="options">${round.options.map((text,i) => `<button type="button" class="choice ${selected===i?'selected':''} ${reveal&&round.correct===i?'correct':''}" data-action="vote:${i}" aria-pressed="${selected===i}" ${disabled?'disabled':''}><span class="letter" aria-hidden="true">${letters[i]}</span><span>${text}</span></button>`).join('')}</div>`;
}

if (!view) {
  document.querySelector('#station-list').innerHTML = rounds.slice(1).map((round,i) =>
    `<a href="?view=demo&amp;round=${i+1}" class="station-card ${round.color}">${stationArt(i+1,'station-card-art')}<div class="station-card-copy"><strong>${round.title}</strong><small>${round.card}</small></div></a>`).join('');
} else {
  const mode = document.querySelector('#mode-link');
  mode.href = './';
  mode.textContent = 'לדף הבית ←';
  if (view === 'host') presenter();
  else if (view === 'play') participant();
  else if (view === 'demo') demo();
  else location.replace('./');
}

function presenter() {
  let index = 0, phase = 'vote', openedAt = Date.now(), deadline = 0;
  let voteWindow = openedAt;
  const roundsByWindow = new Map();
  const completed = new Map();
  const pendingResults = new Map();
  let review;
  let ballots = new Map();
  roundsByWindow.set(voteWindow, {index, ballots});
  let networkMessage = 'פותחים חדר…';
  let room = '';
  let qr = '';
  let count = 0;
  let resultsFrame;
  let autoTimer;
  let simulate = false;

  const snapshot = () => ({round:index, phase, openedAt, deadline,
    voteWindow: phase === 'vote' && !simulate ? voteWindow : 0,
    pendingResults: [...pendingResults],
  });
  const transport = hostTransport((message, nextRoom) => {
    networkMessage = message;
    if (room !== nextRoom) {
      room = nextRoom;
      if (typeof window.qrcode === 'function') {
        const image = window.qrcode(0,'M');
        image.addData(new URL(`?view=play&room=${room}`,location.href).href);
        image.make();
        qr = image.createDataURL(5,20);
      }
      render();
    } else updateStats();
  }, receiveVote, snapshot, window => pendingResults.delete(window));

  function receiveVote(data) {
    const result = roundsByWindow.get(data.openedAt);
    if (!result || result.index !== data.round || result.practice) return;
    if (typeof data.voter !== 'string' || !/^[a-f0-9-]{36}$/.test(data.voter)) return;
    if (!Number.isInteger(data.choice) || data.choice < 0 || data.choice >= rounds[data.round].options.length) return;
    if (result.ballots.has(data.voter)) return;
    const ms = Number.isFinite(data.elapsed) ? Math.max(0,data.elapsed) : 0;
    result.ballots.set(data.voter,{choice:data.choice,ms});
    if (result.ballots === ballots) {
      count = ballots.size;
      updateStats();
    }
    const results = app.querySelector('[data-results]');
    if (results && !resultsFrame) {
      resultsFrame = requestAnimationFrame(() => {
        resultsFrame = undefined;
        if (results.isConnected) {
          const shown = review?.index ?? index;
          results.innerHTML = graph(shown, review ? completed.get(shown) : ballots, false);
        }
      });
    }
  }
  function updateStats() {
    const marker = app.querySelector('[data-count]');
    if (marker) marker.textContent = count === 1 ? 'הצבעה אחת' : `${count} הצבעות`;
    const status = app.querySelector('[data-network]');
    if (status) status.textContent = simulate ? 'מצב תרגול' : networkMessage;
  }
  function change(nextIndex, nextPhase) {
    if (phase === 'vote' && (nextPhase !== 'vote' || nextIndex !== index)) {
      completed.set(index, ballots);
      if (!simulate) pendingResults.set(voteWindow, index);
    }
    cancelSound();
    clearTimeout(autoTimer);
    if (nextIndex !== index || nextPhase === 'vote') {
      ballots = new Map();
      count = 0;
    }
    if (nextIndex !== index) voteWindow = 0;
    index = nextIndex;
    phase = nextPhase;
    openedAt = Math.max(Date.now(),openedAt+1);
    if (phase === 'vote') {
      voteWindow = openedAt;
      roundsByWindow.set(voteWindow, {index, ballots, practice: simulate});
    }
    const round = rounds[index];
    const seconds = nextPhase === 'task' ? round?.seconds : nextPhase === 'vote' ? round?.voteSeconds : 0;
    deadline = seconds ? openedAt + seconds * 1000 : 0;
    currentTimer = deadline;
    render();
    transport.broadcast();
  }
  function beginVote() { if (phase === 'task') change(index,'vote'); }
  onSoundFinished = kind => {
    if (phase === 'task' && rounds[index].media === kind) {
      autoTimer = setTimeout(beginVote, index === 6 ? 100 : 430);
    }
  };
  function graph(index, ballots, animate = true) {
    const round = rounds[index];
    const count = ballots.size;
    if (!count) return '<p class="status">עדיין אין הצבעות לתחנה הזו.</p>';
    const counts = Array(round.options.length).fill(0);
    let reaction = 0;
    for (const value of ballots.values()) {
      counts[value.choice]++;
      reaction += value.ms;
    }
    const candies = '<i></i>'.repeat(24);
    return `<div class="candy-results ${animate ? 'pour' : ''}">
      <h2>תוצאות ההצבעה</h2>
      <ul class="candy-chart" style="--columns:${counts.length}">${round.options.map((option, i) => {
        const share = (counts[i] / count) * 100;
        const percent = new Intl.NumberFormat('he-IL', {maximumFractionDigits: 1}).format(share);
        const votes = counts[i] === 1 ? 'הצבעה אחת' : `${counts[i]} הצבעות`;
        return `<li class="candy-column" style="--share:${share}%;--stagger:${i * 100}ms">
          <div class="candy-jar" aria-hidden="true">
            <div class="candy-fill"><div class="candy-bed">${candies}</div></div>
          </div>
          <div class="candy-label"><span class="letter" aria-hidden="true">${letters[i]}</span>
            <strong>${option}</strong><bdi class="candy-percent">${percent}%</bdi><small>${votes}</small>
          </div>
        </li>`;
      }).join('')}</ul>
      ${index === 6 ? `<p class="status">זמן ממוצע מקבלת השאלה ועד ההצבעה באולם <bdi>${Math.round(reaction/count).toLocaleString('he-IL')}</bdi> אלפיות שנייה.</p>` : ''}
    </div>`;
  }
  function render(shownIndex = review?.index ?? index, shownPhase = review?.phase ?? phase) {
    const index = shownIndex, phase = shownPhase;
    const round = rounds[index];
    let stage;
    if (!round) {
      stage = `<div class="stage-finish"><div>${thankYou}</div><img src="./assets/hero.webp" alt=""></div>`;
    } else if (index === 0 && phase === 'vote') {
      stage = `<div class="stage-intro"><div><p class="phase-label">תוכנית המחוננים בטכנודע</p><h1>ברוכים הבאים<br>לערב <em>הורים וילדים</em></h1><p class="stage-question">${round.question}</p><span class="count" data-count></span></div>${stationArt(0,'intro-art')}<div class="qr"><h2>סרקו והצטרפו</h2>${qr ? `<img src="${qr}" alt="קוד QR להצטרפות לחדר">` : ''}<p>קוד החדר <bdi class="code">${room || '…'}</bdi></p></div></div>`;
    } else {
      stage = `<div class="stage-heading"><div>${badge(round,index)}<h1>${round.title}</h1></div>${phase==='science' ? '' : stationArt(index,'stage-art')}</div>`;
      if (phase === 'task' || phase === 'vote') {
        stage += `<p class="stage-question">${phase==='task' ? round.prompt : round.question}</p>`;
        if (deadline) stage += `<span class="timer" data-timer="${index===6?'ms':'s'}" aria-label="זמן שנותר"></span>`;
        if (phase === 'task') stage += visual(index);
        else stage += '<span class="count" data-count></span>';
      } else if (phase === 'reveal') {
        if (round.answer) stage += `<p class="result">${round.answer}</p>${visual(index,true)}`;
        stage += `<section data-results>${graph(index, review ? completed.get(index) : ballots)}</section>`;
      } else {
        stage += research(round,index);
      }
    }
    const step = review
      ? makeButton('review-toggle', phase === 'science' ? 'תוצאות ההצבעה' : 'מה המדע אומר?', 'secondary')
        + makeButton('resume', 'חזרה לשלב הנוכחי', 'primary')
      : !round ? ''  : phase === 'task' ? makeButton('advance','פותחים הצבעה ←','primary')
      : phase === 'vote' ? makeButton('advance','חושפים תוצאות ←','primary')
      : phase === 'reveal' ? makeButton('advance','מה המדע אומר? ←','primary')
      : makeButton('advance',index===7?'לסיום הערב ←':'לתחנה הבאה ←','primary');
    app.innerHTML = `<div class="room-wrap"><section class="stage stage-${round ? phase : 'finish'} ${round?.color||'lilac'}">${stage}</section><section class="host-control" aria-label="בקרת מנחה"><div class="control-row">${step}${!review && phase==='science' && completed.has(index) ? makeButton('review-current','תוצאות ההצבעה','secondary') : ''}${makeButton('copy','העתקת קישור למשפחות','secondary',!room)}${makeButton('screen','מצב הקרנה','quiet')}${!review && phase==='vote'?makeButton('sample','הדגמת הצבעה','quiet',!simulate):''}${!review ? makeButton('simulation',simulate?'סיום תרגול':'מצב תרגול','quiet',!simulate && (count>0 || completed.size>0)) : ''}</div><nav class="mini-nav" aria-label="מעבר תחנה">${['פתיחה',1,2,3,4,5,6,7,'סיום'].map((s,i)=>`<button type="button" data-action="round:${i}" class="${completed.has(i) ? 'completed-round' : ''}" ${i===index?'aria-current="step"':''} aria-label="${typeof s==='number'?`תחנה ${s}`:s}">${s}${completed.has(i) ? ' <span aria-hidden="true">✓</span>' : ''}</button>`).join('')}</nav><p class="status" data-network role="status"></p></section></div>`;
    drawShapes(app, phase==='reveal');
    updateTimer();
    updateStats();
    syncSound();
  }
  function goTo(i) { change(i,i===0?'vote':i===finished?'science':'task'); }
  app.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const [action, value] = button.dataset.action.split(':');
    if (action === 'round') {
      const target = Number(value);
      if (completed.has(target)) {
        cancelSound();
        review = {index:target, phase:'reveal'};
        render();
        app.querySelector('[data-action="review-toggle"]')?.focus({preventScroll:true});
      } else if (target === index) {
        cancelSound();
        review = undefined;
        render();
      } else {
        review = undefined;
        goTo(target);
      }
    }
    if (action === 'review-current') {
      review = {index, phase:'reveal'};
      render();
      app.querySelector('[data-action="review-toggle"]')?.focus({preventScroll:true});
    }
    if (action === 'review-toggle' && review) {
      cancelSound();
      review.phase = review.phase === 'science' ? 'reveal' : 'science';
      render();
      app.querySelector('[data-action="review-toggle"]')?.focus({preventScroll:true});
    }
    if (action === 'resume') {
      cancelSound();
      review = undefined;
      render();
      app.querySelector('[data-action="advance"]')?.focus({preventScroll:true});
    }
    if (action==='sound') await toggleSound(value);
    if (action==='advance') {
      if (phase==='task') beginVote();
      else if (phase==='vote') change(index,'reveal');
      else if (phase==='reveal') change(index,'science');
      else goTo(index+1);
      app.querySelector('[data-action="advance"]')?.focus({preventScroll:true});
    }
    if (action==='copy' && room) {
      const url = new URL(`?view=play&room=${room}`,location.href).href;
      try {
        await navigator.clipboard.writeText(url);
        button.textContent='הקישור הועתק ✓';
      } catch {
        const field = document.createElement('input');
        field.value = url;
        field.readOnly = true;
        button.parentNode.append(field);
        field.select();
      }
    }
    if (action==='screen') {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        try { await document.documentElement.requestFullscreen(); } catch {}
      } else if (document.fullscreenElement) {
        try { await document.exitFullscreen(); } catch {}
      }
      document.body.classList.toggle('screen-only',Boolean(document.fullscreenElement));
    }
    if (action==='simulation') {
      if (simulate) {
        goTo(0);
        completed.clear();
        simulate = false;
        roundsByWindow.get(voteWindow).practice = false;
        render();
      } else if (!count && !completed.size) {
        simulate = true;
        if (voteWindow) roundsByWindow.get(voteWindow).practice = true;
        render();
      }
    }
    if (action==='sample' && simulate && phase==='vote') {
      const options = rounds[index].options.length;
      const id = crypto.randomUUID();
      ballots.set(id,{choice:Math.floor(Math.random()*options),ms:1500+Math.round(Math.random()*7000)});
      count = ballots.size;
      updateStats();
    }
  });
  document.addEventListener('fullscreenchange', () => document.body.classList.toggle('screen-only',Boolean(document.fullscreenElement)));
  render();
}

function participant() {
  let state, connection, acknowledged, pending, ackTimeout;
  let room = normalizeCode(query.get('room') || '').slice(0,8);
  let message = '', hasError = false;
  let voter = crypto.randomUUID();
  try {
    const storageKey = `technoda-brain-v1:${room}`;
    if (room.length === 8) {
      voter = sessionStorage.getItem(storageKey) || voter;
      sessionStorage.setItem(storageKey,voter);
    }
  } catch {}
  const key = s => s ? `${s.round}:${s.openedAt}` : '';
  const voteKey = () => `technoda-vote:${room}:${key(state)}`;
  function showStatus() {
    const status = app.querySelector('[data-connection]');
    if (status) { status.textContent = message; status.classList.toggle('error',hasError); }
  }
  function connect() {
    connection?.close();
    connection = joinTransport(room, (text,isError) => {
      message=text;
      hasError=isError;
      showStatus();
    }, received);
  }
  function received(data) {
    if (!data || typeof data!=='object') return;
    if (data.kind==='ack' && pending && data.round===state?.round && data.openedAt===state?.openedAt && data.choice===pending.choice) {
      clearTimeout(ackTimeout);
      if (data.accepted) {
        acknowledged = pending.choice;
        try { sessionStorage.setItem(voteKey(),String(acknowledged)); } catch {}
      } else {
        message='ההצבעה נסגרה או שהתשובה כבר נקלטה.';
        hasError=true;
      }
      pending=null;
      render();
      return;
    }
    if (data.kind!=='state' || !Number.isInteger(data.round) || data.round < 0 || data.round > finished || !modes.has(data.phase) || !Number.isFinite(data.openedAt)) return;
    const same = key(data)===key(state) && data.phase===state.phase;
    state=data;
    if (!same) {
      clearTimeout(ackTimeout);
      acknowledged=undefined;
      pending=null;
      try {
        const saved = sessionStorage.getItem(voteKey());
        if (saved !== null) acknowledged=Number(saved);
      } catch {}
      message='מחוברים לאולם';
      hasError=false;
      render();
    }
  }
  function render() {
    let panel;
    if (!state) {
      panel = `<div class="room-icon" aria-hidden="true">🧠</div><h1>מצטרפים לערב</h1><p class="muted">סרקו את הקוד במסך הגדול או הקלידו את קוד החדר.</p><form class="form"><label for="room">קוד החדר</label><div><input id="room" name="room" maxlength="8" minlength="8" value="${room}" required autocomplete="off" autocapitalize="characters" spellcheck="false"><button class="primary">כניסה ←</button></div></form>`;
    } else if (state.round===finished) {
      panel = thankYou + footerArt;
    } else {
      const round=rounds[state.round];
      panel = progress(state.round) + badge(round,state.round) + `<h1>${round.title}</h1>`;
      if (state.phase==='vote') {
        panel += `<p class="question">${round.question}</p>${voteButtons(round,acknowledged??pending?.choice,acknowledged!==undefined||Boolean(pending))}`;
        if (acknowledged!==undefined) panel+='<p class="confirmation" role="status">התשובה נקלטה! הביטו למסך הגדול.</p>';
        else if (pending) panel+='<p class="status" role="status">שולחים את התשובה…</p>';
      } else if (state.phase==='task') panel += '<p class="muted">הביטו למסך הגדול. ההצבעה תיפתח כאן.</p>';
      else panel += '<p class="muted">עכשיו מסתכלים על המסך הגדול!</p>';
    }
    app.innerHTML = `<div class="room-wrap"><section class="room-panel">${panel}<p class="status" data-connection role="status"></p></section></div>`;
    showStatus();
  }
  app.addEventListener('submit', event => {
    event.preventDefault();
    const value = normalizeCode(event.target.elements.room.value);
    if (value.length!==8) {
      message='יש להזין קוד בן שמונה תווים.';
      hasError=true;
      showStatus();
      return;
    }
    location.search = `?view=play&room=${value}`;
  });
  app.addEventListener('click', event => {
    const b = event.target.closest('[data-action^="vote:"]');
    if (!b || state?.phase!=='vote' || pending || acknowledged!==undefined) return;
    const choice = Number(b.dataset.action.slice(5));
    pending={choice};
    if (!connection?.send({kind:'vote',round:state.round,openedAt:state.openedAt,voter,choice})) {
      pending=null;
      message='מחדשים את החיבור. נסו להצביע שוב בעוד רגע.';
      hasError=true;
    } else {
      ackTimeout=setTimeout(() => {
        pending=null;
        message='לא התקבל אישור. אפשר לנסות שוב.';
        hasError=true;
        render();
      },5600);
    }
    render();
  });
  render();
  if (room.length===8) connect();
}

function demo() {
  const chosen = Number(query.get('round'));
  let index = Number.isInteger(chosen) && chosen >= 0 && chosen < finished ? chosen : 0;
  let selected;
  const answers = new Map();
  let timerFor = -1;
  function render() {
    const round=rounds[index];
    if (!round) {
      app.innerHTML = `<div class="room-wrap"><section class="room-panel">${thankYou}${footerArt}<div class="demo-nav"><a class="primary" href="?view=demo">שוב מההתחלה</a><a class="secondary" href="./">לדף הבית</a></div></section></div>`;
      return;
    }
    if (round.seconds && selected===undefined && timerFor!==index) {
      timerFor=index;
      currentTimer=Date.now()+1000*round.seconds;
    }
    const task = index && selected===undefined ? `<div class="stage ${round.color}"><p class="stage-question">${round.prompt}</p>${round.seconds && selected===undefined?'<div class="timer" data-timer="s" aria-label="זמן שנותר"></div>':''}${visual(index)}</div>` : '';
    const reveal = selected!==undefined ? `${round.answer?`<p class="result">${round.answer}</p>${visual(index,true)}`:''}${research(round,index)}` : '';
    app.innerHTML = `<div class="room-wrap solo"><section class="room-panel ${round.color}">${progress(index)}${badge(round,index)}<h1>${round.title}</h1>${task}<p class="question">${round.question}</p>${voteButtons(round,selected,selected!==undefined,selected!==undefined)}${reveal}<div class="demo-nav">${index?makeButton('previous','→ הקודמת'):''}${makeButton('next',index===7?'לסיום ←':'לתחנה הבאה ←','primary')}</div></section></div>`;
    drawShapes(app, selected!==undefined);
    updateTimer();
    syncSound();
  }
  app.addEventListener('click', async event => {
    const b=event.target.closest('[data-action]');
    if (!b) return;
    const [action,value] = b.dataset.action.split(':');
    if (action==='sound') { await toggleSound(value); return; }
    cancelSound();
    if (action==='vote') {
      selected=Number(value);
      answers.set(index, selected);
    }
    if (action==='next' || action==='previous') {
      index+=action==='next'?1:-1;
      selected=answers.get(index);
      timerFor=-1;
      window.scrollTo(0,0);
    }
    render();
    if (action==='vote') app.querySelector('[data-action="next"]')?.focus({preventScroll:true});
  });
  render();
}
