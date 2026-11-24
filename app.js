import {rounds} from './data.js?v=8';
import {drawShapes, playSound, stopSound} from './media.js';
import {hostTransport, joinTransport, normalizeCode} from './live.js?v=7';
import {resultArt, resultThemes} from './result-art.js?v=1';
import qrcode from './assets/qrcode.js?v=2';

const app = document.querySelector('#app');
const query = new URLSearchParams(location.search);
const siteRoot = new URL('./', document.baseURI);
const route = location.pathname.slice(siteRoot.pathname.length).replace(/(?:^|\/)index\.html$/, '').replace(/\/$/, '');
const resultsPreview = route === 'candy-results';
const view = resultsPreview || route === 'host' ? 'host' : route === 'join' ? 'play' : query.get('view');
const joinPath = room => new URL(`join/?room=${room}`, siteRoot).href;
if (view) document.body.dataset.view = view;
const letters = ['א','ב','ג','ד'];
const modes = new Set(['task','vote','reveal','science']);
const finished = rounds.length;
const badge = (round, index) => `<div class="room-icon ${round.color}" aria-hidden="true">${round.icon}</div><p class="phase-label">${index ? `תחנה ${index} מתוך 7` : 'מתחילים בחימום'}</p>`;
const stationArt = (index, className) =>
  `<img class="${className}" src="./assets/station-${index}.webp" alt="" decoding="async">`;
function stageHeading(index, phase) {
  const round = rounds[index];
  const art = phase === 'science' || (phase === 'reveal' && index === 0) ? '' : stationArt(index, 'stage-art');
  return `<header class="stage-heading"><div class="stage-heading-copy">${badge(round, index)}<h1>${round.title}</h1></div>${art}</header>`;
}
const makeButton = (action, text, style = 'secondary', disabled = false) => `<button type="button" class="${style}" data-action="${action}" ${disabled ? 'disabled' : ''}>${text}</button>`;
const backButton = disabled => makeButton('back', '→ חזרה', 'secondary', disabled);
const progress = index => `<div class="round-progress" role="img" aria-label="שלב ${index+1} מתוך 8">${rounds.map((_,i) => `<i class="${i<index?'done':i===index?'now':''}"></i>`).join('')}</div>`;
const openingArt = '<img src="./assets/opening-ideas.webp" alt="" decoding="async">';
const footerArt = '<img src="./assets/finale.webp" alt="" class="tiny-art" decoding="async">';
const thankYou = '<h1>תודה שהצטרפתם למסע <em>בתוך הראש שלהם!</em></h1><p>איזה רגע מהערב תרצו לספר עליו בבית?</p>';
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

function activityBoard(index, phase, count = 0) {
  const round = rounds[index];
  const voting = phase === 'vote';
  const question = voting ? round.question : round.prompt;
  const illustration = voting ? '' : visual(index);
  const timer = currentTimer ? `<span class="timer" data-timer="${index === 6 ? 'ms' : 's'}" aria-label="זמן שנותר"></span>` : '';
  const votes = voting ? `<span class="count" data-count>${voteCount(count)}</span>` : '';
  return `<div class="activity-board${illustration ? ' has-visual' : ''}">
    <div class="activity-head">
      <p class="stage-question">${question}</p>
      ${timer || votes ? `<div class="activity-tools">${timer}${votes}</div>` : ''}
    </div>
    ${illustration ? `<div class="activity-visual">${illustration}</div>` : ''}
  </div>`;
}

function panelHeading(round, index) {
  return `<header class="panel-heading">
    <div>${badge(round, index)}<h1>${round.title}</h1></div>
    ${stationArt(index, 'panel-art')}
  </header>`;
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

function stationCards({newTab = false} = {}) {
  const linkAttributes = newTab ? ' target="_blank" rel="noopener"' : '';
  return rounds.slice(1).map((round, i) => {
    const number = i + 1;
    return `<a href="./?view=demo&amp;round=${number}"${linkAttributes} class="station-card ${round.color}">
      ${stationArt(number, 'station-card-art')}
      <div class="station-card-copy"><strong>${round.title}</strong><small>${round.card}</small></div>
    </a>`;
  }).join('');
}

const numberFormat = new Intl.NumberFormat('he-IL', {maximumFractionDigits: 1});
const voteCount = n => n === 1 ? 'הצבעה אחת' : `${numberFormat.format(n)} הצבעות`;

function summarizeVotes(index, ballots) {
  const counts = Array(rounds[index].options.length).fill(0);
  let reaction = 0;
  for (const {choice, ms} of ballots.values()) {
    counts[choice]++;
    reaction += ms;
  }
  return {
    total: voteCount(ballots.size),
    average: numberFormat.format(ballots.size ? Math.round(reaction / ballots.size) : 0),
    choices: counts.map(n => {
      const share = ballots.size ? n / ballots.size * 100 : 0;
      return {share, percent: `${numberFormat.format(share)}%`, votes: voteCount(n)};
    }),
  };
}

function graph(index, ballots) {
  const round = rounds[index];
  const {total, average, choices} = summarizeVotes(index, ballots);
  const theme = resultThemes[index];
  const artwork = resultArt(theme);
  return `<div class="vote-results" data-theme="${theme}">
    <header class="vote-results-heading">
      <h2>תוצאות ההצבעה</h2>
      <span class="vote-total">${total}</span>
    </header>
    ${ballots.size ? '' : '<p class="vote-empty">עדיין אין הצבעות לתחנה הזו.</p>'}
    <ul class="vote-chart" style="--columns:${choices.length}">${round.options.map((option, i) => {
      const {share, percent, votes} = choices[i];
      return `<li class="vote-column" style="--share:${share}%">
        ${artwork}
        <div class="vote-label">
          <bdi class="vote-percent">${percent}</bdi>
          <div class="vote-option"><span class="letter" aria-hidden="true">${letters[i]}</span><strong>${option}</strong></div>
          <small>${votes}</small>
        </div>
      </li>`;
    }).join('')}</ul>
    ${index === 6 && ballots.size ? `<p class="vote-reaction">זמן ממוצע מקבלת השאלה ועד ההצבעה באולם <bdi>${average}</bdi> אלפיות שנייה.</p>` : ''}
  </div>`;
}

function previewCandyResults() {
  document.title = 'תצוגת תוצאות | בתוך הראש שלהם';
  const requestedRound = Number(query.get('round'));
  let index = Number.isInteger(requestedRound) && rounds[requestedRound] ? requestedRound : 0;

  function sampleBallots() {
    const counts = rounds[index].options.length === 4 ? [9, 6, 3, 2] : [11, 7, 2];
    const ballots = new Map();
    counts.forEach((count, choice) => {
      for (let vote = 0; vote < count; vote++) ballots.set(ballots.size, {choice, ms: 1800 + ballots.size * 60});
    });
    return ballots;
  }

  let phase = 'reveal';
  function render() {
    const round = rounds[index];
    const ballots = sampleBallots();
    const revealing = phase === 'reveal';
    const content = revealing ? `<section data-results>${graph(index, ballots)}</section>`
      : activityBoard(index, phase, ballots.size);
    app.innerHTML = `<div class="room-wrap">
      <section class="stage stage-${phase} ${round.color}">${stageHeading(index, phase)}${content}</section>
      <section class="host-control vote-preview-controls" aria-label="בקרת הדגמה">
        <div class="control-row">
          ${backButton(!revealing)}
          ${revealing ? makeButton('replay-results', 'הפעלת האנימציה מחדש', 'primary')
            : makeButton('forward', 'לתוצאות ההצבעה ←', 'primary')}
          <a class="secondary" href="./host/">למסך המנחה</a>
        </div>
        <nav class="mini-nav" aria-label="הדגמת תוצאות לפי תחנה">${rounds.map((item, i) =>
          `<button type="button" data-action="preview-round:${i}" aria-label="${i ? `תחנה ${i} · ` : ''}${item.title}" ${i === index ? 'aria-current="step"' : ''}>${i || 'פתיחה'}</button>`).join('')}</nav>
        <p class="status">הצבעות לדוגמה</p>
      </section>
    </div>`;
  }

  app.addEventListener('click', event => {
    const [action, value] = (event.target.closest('[data-action]')?.dataset.action || '').split(':');
    if (action === 'replay-results') {
      app.querySelector('[data-results]').innerHTML = graph(index, sampleBallots());
    } else if (action === 'back' || action === 'forward') {
      phase = action === 'back' ? 'vote' : 'reveal';
      render();
      app.querySelector(`[data-action="${action === 'back' ? 'forward' : 'back'}"]`).focus({preventScroll:true});
    } else if (action === 'preview-round') {
      index = Number(value);
      phase = 'reveal';
      history.replaceState(null, '', index ? `?round=${index}` : location.pathname);
      render();
      app.querySelector(`[data-action="preview-round:${index}"]`).focus({preventScroll:true});
    }
  });
  render();
}

if (!view) {
  document.querySelector('#station-list').innerHTML = stationCards();
} else {
  const mode = document.querySelector('#mode-link');
  mode.href = './';
  mode.textContent = 'לדף הבית ←';
  if (resultsPreview) previewCandyResults();
  else if (view === 'host') presenter();
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
  let ballots = new Map();
  let liveScreen = {index, phase, ballots};
  const screenTrail = [liveScreen];
  let screenCursor = 0;
  roundsByWindow.set(voteWindow, {index, ballots});
  let networkMessage = 'פותחים חדר…';
  let room = '';
  let joinUrl = '';
  let qr = '';
  let resultsFrame;
  let autoTimer;
  let simulate = false;

  const displayedScreen = () => screenTrail[screenCursor];
  const canGoForward = () => screenCursor < screenTrail.length - 1;
  const atLiveScreen = () => displayedScreen() === liveScreen && !canGoForward();

  function showScreen(screen) {
    cancelSound();
    clearTimeout(autoTimer);
    if (screen !== displayedScreen()) {
      screenTrail.splice(screenCursor + 1, screenTrail.length, screen);
      screenCursor = screenTrail.length - 1;
    }
    render();
  }

  function moveScreen(offset) {
    if (offset < 0 ? screenCursor === 0 : !canGoForward()) return;
    cancelSound();
    clearTimeout(autoTimer);
    screenCursor += offset;
    render();
    const direction = offset < 0 ? 'back' : 'forward';
    const focusTarget = app.querySelector(`[data-action="${direction}"]:enabled`)
      ?? app.querySelector('[data-action="forward"], [data-action="advance"], [data-action="resume"]')
      ?? app.querySelector('[data-action="back"]:enabled');
    focusTarget?.focus({preventScroll:true});
  }

  const snapshot = () => ({round:index, phase, openedAt, deadline,
    voteWindow: phase === 'vote' && !simulate ? voteWindow : 0,
    pendingResults: [...pendingResults],
  });
  const transport = hostTransport((message, nextRoom) => {
    networkMessage = message;
    if (room !== nextRoom) {
      room = nextRoom;
      joinUrl = joinPath(room);
      const image = qrcode(0, 'M');
      image.addData(joinUrl);
      image.make();
      qr = image.createDataURL(5, 20);
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
    if (result.ballots !== displayedScreen().ballots) return;
    updateStats();
    const results = app.querySelector('[data-results]');
    if (results && !resultsFrame) {
      resultsFrame = requestAnimationFrame(() => {
        resultsFrame = undefined;
        if (results.isConnected) {
          const shown = displayedScreen();
          updateGraph(results, shown.index, shown.ballots);
        }
      });
    }
  }
  function updateStats() {
    const marker = app.querySelector('[data-count]');
    if (marker) marker.textContent = voteCount(displayedScreen().ballots.size);
    const status = app.querySelector('[data-network]');
    if (status) status.textContent = canGoForward() ? 'מציגים מסך קודם' : simulate ? 'מצב תרגול' : networkMessage;
  }
  function change(nextIndex, nextPhase, resetHistory = false) {
    if (!resetHistory && phase === 'vote' && (nextPhase !== 'vote' || nextIndex !== index)) {
      completed.set(index, ballots);
      if (!simulate) pendingResults.set(voteWindow, index);
    }
    if (nextIndex !== index || nextPhase === 'vote') {
      ballots = new Map();
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
    liveScreen = {index, phase, ballots};
    if (resetHistory) {
      screenTrail.length = 0;
      screenCursor = -1;
    }
    showScreen(liveScreen);
    transport.broadcast();
  }
  function beginVote() { if (atLiveScreen() && phase === 'task') change(index,'vote'); }
  onSoundFinished = kind => {
    if (atLiveScreen() && phase === 'task' && rounds[index].media === kind) {
      autoTimer = setTimeout(beginVote, index === 6 ? 100 : 430);
    }
  };
  function updateGraph(results, index, ballots) {
    if (results.querySelector('.vote-empty')) {
      results.innerHTML = graph(index, ballots);
      return;
    }
    const {total, average, choices} = summarizeVotes(index, ballots);
    results.querySelector('.vote-total').textContent = total;
    results.querySelectorAll('.vote-column').forEach((column, i) => {
      const {share, percent, votes} = choices[i];
      column.style.setProperty('--share', `${share}%`);
      column.querySelector('.vote-percent').textContent = percent;
      column.querySelector('small').textContent = votes;
    });
    const reaction = results.querySelector('.vote-reaction bdi');
    if (reaction) reaction.textContent = average;
  }
  function render() {
    const {index, phase, ballots} = displayedScreen();
    const live = atLiveScreen();
    currentTimer = live ? deadline : 0;
    const round = rounds[index];
    let stage;
    const opening = index === 0 && phase === 'vote';
    const qrImage = qr ? `<img src="${qr}" alt="קוד QR להצטרפות לחדר">` : '';
    if (!round) {
      stage = `<div class="closing-poster"><div class="closing-copy">${thankYou}</div>${footerArt}</div>`;
    } else if (opening) {
      stage = `<div class="opening-layout">
        <div class="opening-poster">
          <div class="opening-visual">
            <img class="opening-art" src="./assets/opening-ideas.webp" alt="" fetchpriority="high">
          </div>
          <div class="opening-copy">
            <p class="opening-kicker">ערב מחצית <span aria-hidden="true"></span> תוכנית המחוננים בטכנודע</p>
            <h1 id="opening-title">בתוך הראש<br><em>שלהם</em></h1>
            <p class="opening-subtitle">בואו לטעום איך זה לחיות בתוך ראש מחונן.</p>
          </div>
        </div>
        <div class="opening-footer">
          <div class="opening-poll">
            <span class="opening-poll-label">שאלת חימום</span>
            <p>${round.question}</p>
          </div>
          <div class="opening-join">
            <div class="opening-instructions">
              <h2>סרקו והצטרפו</h2>
              <p>קוד החדר <bdi class="opening-code">${room || '…'}</bdi></p>
              <span class="opening-count" data-count></span>
            </div>
            ${qrImage ? `<a class="opening-qr" href="${joinUrl}" target="_blank" rel="noopener" aria-label="קישור הצטרפות לחדר ${room}">${qrImage}</a>`
              : '<div class="opening-qr"><span>מכינים קוד סריקה…</span></div>'}
          </div>
        </div>
        <section class="opening-challenges" aria-labelledby="opening-challenges-title">
          <h2 id="opening-challenges-title">מה מחכה לנו?</h2>
          <div class="station-list">${stationCards({newTab: true})}</div>
        </section>
      </div>`;
    } else {
      stage = stageHeading(index, phase);
      if (phase === 'task' || phase === 'vote') {
        stage += activityBoard(index, phase, ballots.size);
      } else if (phase === 'reveal') {
        if (round.answer) stage += `<div class="reveal-answer"><p class="answer-label">התשובה</p><p class="result">${round.answer}</p>${visual(index,true)}</div>`;
        stage += `<section data-results>${graph(index, ballots)}</section>`;
      } else {
        stage += research(round,index);
      }
    }
    const ahead = screenTrail[screenCursor + 1];
    const step = ahead
      ? makeButton('forward', ahead.phase === 'reveal' ? 'לתוצאות ההצבעה ←' : 'קדימה ←', 'primary')
      : !live ? makeButton('review-toggle', phase === 'science' ? 'תוצאות ההצבעה' : 'מה המדע אומר?', 'secondary')
        + makeButton('resume', 'חזרה לשלב הנוכחי', 'primary')
      : !round ? ''  : phase === 'task' ? makeButton('advance','פותחים הצבעה ←','primary')
      : phase === 'vote' ? makeButton('advance','חושפים תוצאות ←','primary')
      : phase === 'reveal' ? makeButton('advance','מה המדע אומר? ←','primary')
      : makeButton('advance',index===7?'לסיום הערב ←':'לתחנה הבאה ←','primary');
    app.innerHTML = `<div class="room-wrap">
      <section class="stage stage-${round ? phase : 'finish'} ${round?.color||'lilac'}${opening ? ' stage-opening' : ''}"${opening ? ' aria-labelledby="opening-title"' : ''}>${stage}</section>
      <section class="host-control" aria-label="בקרת מנחה">
        <div class="control-row">
          ${backButton(screenCursor === 0)}${step}
          ${live && phase==='science' && completed.has(index) ? makeButton('review-current','תוצאות ההצבעה','secondary') : ''}
          <button type="button" class="secondary" data-action="share" aria-haspopup="dialog" ${!room ? 'disabled' : ''}>הצטרפות ושיתוף</button>
          ${makeButton('screen',document.fullscreenElement?'יציאה ממסך מלא':'מסך מלא','quiet')}
          ${live && phase==='vote' ? makeButton('sample','הדגמת הצבעה','quiet',!simulate) : ''}
          ${live ? makeButton('simulation',simulate?'סיום תרגול':'מצב תרגול','quiet',!simulate && (ballots.size>0 || completed.size>0)) : ''}
        </div>
        <nav class="mini-nav" aria-label="מעבר תחנה">${['פתיחה',1,2,3,4,5,6,7,'סיום'].map((s,i)=>`<button type="button" data-action="round:${i}" class="${completed.has(i) ? 'completed-round' : ''}" ${i===index?'aria-current="step"':''} aria-label="${typeof s==='number'?`תחנה ${s}`:s}">${s}${completed.has(i) ? ' <span aria-hidden="true">✓</span>' : ''}</button>`).join('')}</nav>
        <p class="status" data-network role="status"></p>
      </section>
      ${room ? `<dialog class="join-share" aria-labelledby="join-share-title">
        <header class="join-share-header">
          <h2 id="join-share-title">הצטרפות למשפחות</h2>
          <form method="dialog"><button class="quiet" autofocus>סגירה</button></form>
        </header>
        <div class="join-share-room">
          ${qrImage}
          <div>
            <p>סרקו את ה־QR או הקלידו את קוד החדר.</p>
            <bdi class="join-share-code">${room}</bdi>
          </div>
        </div>
        <label for="join-share-link">קישור ישיר לחדר</label>
        <input id="join-share-link" dir="ltr" type="url" value="${joinUrl}" readonly>
        ${makeButton('copy', 'העתקת קישור למשפחות', 'primary')}
        <p class="status" data-copy-status role="status"></p>
      </dialog>` : ''}
    </div>`;
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
    if (action === 'back' || action === 'forward') {
      moveScreen(action === 'back' ? -1 : 1);
      return;
    }
    if (action === 'round') {
      const target = Number(value);
      if (target === index && phase === 'reveal') {
        showScreen(liveScreen);
      } else if (completed.has(target)) {
        showScreen({index:target, phase:'reveal', ballots:completed.get(target)});
        app.querySelector('[data-action="review-toggle"]')?.focus({preventScroll:true});
      } else if (target === index) {
        showScreen(liveScreen);
      } else {
        goTo(target);
      }
    }
    if (action === 'review-current') {
      showScreen({index, phase:'reveal', ballots:completed.get(index)});
      app.querySelector('[data-action="review-toggle"]')?.focus({preventScroll:true});
    }
    if (action === 'review-toggle') {
      const screen = displayedScreen();
      showScreen({...screen, phase: screen.phase === 'science' ? 'reveal' : 'science'});
      app.querySelector('[data-action="review-toggle"]')?.focus({preventScroll:true});
    }
    if (action === 'resume') {
      showScreen(liveScreen);
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
    if (action === 'share') {
      app.querySelector('.join-share')?.showModal();
    }
    if (action === 'copy') {
      const status = app.querySelector('[data-copy-status]');
      try {
        await navigator.clipboard.writeText(joinUrl);
        status.textContent = 'הקישור הועתק.';
      } catch {
        const field = app.querySelector('#join-share-link');
        field.focus();
        field.select();
        status.textContent = 'הקישור מסומן להעתקה.';
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
        simulate = false;
        completed.clear();
        change(0, 'vote', true);
      } else if (!ballots.size && !completed.size) {
        simulate = true;
        if (voteWindow) roundsByWindow.get(voteWindow).practice = true;
        render();
      }
    }
    if (action==='sample' && simulate && phase==='vote') {
      const options = rounds[index].options.length;
      const id = crypto.randomUUID();
      ballots.set(id,{choice:Math.floor(Math.random()*options),ms:1500+Math.round(Math.random()*7000)});
      updateStats();
    }
  });
  document.addEventListener('fullscreenchange', () => {
    const fullscreen = Boolean(document.fullscreenElement);
    document.body.classList.toggle('screen-only',fullscreen);
    const button = app.querySelector('[data-action="screen"]');
    if (button) button.textContent = fullscreen ? 'יציאה ממסך מלא' : 'מסך מלא';
  });
  render();
}

function participant() {
  let state, connection, acknowledged, pending, ackTimeout;
  const room = normalizeCode(query.get('room') || '').slice(0,8);
  let message = room.length === 8 ? 'מתחברים לחדר…' : '', hasError = false;
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
      const showJoinForm = !state && hasError !== isError;
      message=text;
      hasError=isError;
      if (showJoinForm) render();
      else showStatus();
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
      message=`מחוברים לחדר ${room}`;
      hasError=false;
      render();
    }
  }
  function render() {
    let panel;
    let tone = 'lilac room-join';
    if (!state && room.length === 8 && !hasError) {
      panel = `<header class="join-heading"><h1>מצטרפים לערב</h1>${openingArt}</header>`;
    } else if (!state) {
      panel = `<header class="join-heading"><h1>מצטרפים לערב</h1>${openingArt}</header><p class="muted">הקלידו את קוד החדר שמופיע במסך הגדול.</p><form class="form"><label for="room">קוד החדר</label><div><input id="room" name="room" maxlength="8" minlength="8" dir="ltr" value="${room}" required autocomplete="off" autocapitalize="characters" spellcheck="false"><button class="primary">כניסה ←</button></div></form>`;
    } else if (state.round===finished) {
      tone = 'room-finish';
      panel = thankYou + footerArt;
    } else {
      const round=rounds[state.round];
      tone = round.color;
      panel = progress(state.round) + panelHeading(round, state.round);
      if (state.phase==='vote') {
        panel += `<p class="question">${round.question}</p>${voteButtons(round,acknowledged??pending?.choice,acknowledged!==undefined||Boolean(pending))}`;
        if (acknowledged!==undefined) panel+='<p class="confirmation" role="status">התשובה נקלטה! הביטו למסך הגדול.</p>';
        else if (pending) panel+='<p class="status" role="status">שולחים את התשובה…</p>';
      } else if (state.phase==='task') panel += '<p class="waiting-message">הביטו למסך הגדול. ההצבעה תיפתח כאן.</p>';
      else panel += '<p class="waiting-message">עכשיו מסתכלים על המסך הגדול!</p>';
    }
    app.innerHTML = `<div class="room-wrap"><section class="room-panel ${tone}">${panel}<p class="status" data-connection role="status"></p></section></div>`;
    showStatus();
  }
  app.addEventListener('submit', event => {
    event.preventDefault();
    const value = normalizeCode(event.target.elements.room.value);
    if (!/^[A-Z2-9]{8}$/.test(value)) {
      message='יש להזין קוד בן שמונה תווים.';
      hasError=true;
      showStatus();
      return;
    }
    location.assign(joinPath(value));
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
      app.innerHTML = `<div class="room-wrap"><section class="room-panel room-finish">${thankYou}${footerArt}<div class="demo-nav">${makeButton('previous','→ חזרה')}<a class="primary" href="?view=demo">שוב מההתחלה</a><a class="secondary" href="./">לדף הבית</a></div></section></div>`;
      return;
    }
    if (round.seconds && selected===undefined && timerFor!==index) {
      timerFor=index;
      currentTimer=Date.now()+1000*round.seconds;
    }
    const task = index && selected===undefined ? `<div class="stage ${round.color}"><p class="stage-question">${round.prompt}</p>${round.seconds && selected===undefined?'<div class="timer" data-timer="s" aria-label="זמן שנותר"></div>':''}${visual(index)}</div>` : '';
    const reveal = selected!==undefined ? `${round.answer?`<p class="result">${round.answer}</p>${visual(index,true)}`:''}${research(round,index)}` : '';
    app.innerHTML = `<div class="room-wrap solo"><section class="room-panel ${round.color}">${progress(index)}${panelHeading(round,index)}${task}<p class="question">${round.question}</p>${voteButtons(round,selected,selected!==undefined,selected!==undefined)}${reveal}<div class="demo-nav">${index?makeButton('previous','→ הקודמת'):''}${makeButton('next',index===7?'לסיום ←':'לתחנה הבאה ←','primary')}</div></section></div>`;
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
