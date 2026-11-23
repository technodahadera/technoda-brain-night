const melodies = {
  mary: [64,62,60,62,64,64,64,0,62,62,62,0,64,67,67,0],
  jacob: [60,62,64,60,60,62,64,60,64,65,67,0,64,65,67,0],
  twinkle: [60,60,67,67,69,69,67,0,65,65,64,64,62,62,60,0],
};
let context;
const wave = document.createElement('audio');
let playback = 0;
const active = new Set();

export function stopSound() {
  playback++;
  wave.pause();
  wave.onended = null;
  for (const node of active) { try { node.stop(); } catch {} }
  active.clear();
}

export async function playSound(kind, done) {
  stopSound();
  const token = playback;
  if (kind === 'kitchen') {
    wave.src = './assets/kitchen.mp3';
    wave.onended = () => { if (token === playback) done(); };
    await wave.play();
    return;
  }
  context ??= new AudioContext();
  await context.resume();
  if (token !== playback) return;
  const start = context.currentTime + .045;
  const note = (pitch, begin, length, type, volume) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = 440 * 2 ** ((pitch - 69) / 12);
    gain.gain.setValueAtTime(.001, begin);
    gain.gain.exponentialRampToValueAtTime(volume, begin + .013);
    gain.gain.exponentialRampToValueAtTime(.001, begin + length);
    oscillator.connect(gain).connect(context.destination);
    active.add(oscillator);
    oscillator.onended = () => active.delete(oscillator);
    oscillator.start(begin);
    oscillator.stop(begin + length);
  };
  const line = (name, beat, transpose, type, volume, first = 0, repeat = 1) => {
    const notes = melodies[name];
    for (let i = 0; i < notes.length * repeat; i++) {
      const pitch = notes[i % notes.length];
      if (!pitch) continue;
      const sustain = !notes[(i+1) % notes.length] ? 1.8 : .84;
      note(pitch + transpose, start + first + i * beat, beat * sustain, type, volume);
    }
  };
  let duration;
  if (kind === 'mix') {
    line('mary', .31, 7, 'triangle', .17, 0, 2);
    line('jacob', .31, -12, 'sine', .24, .07, 2);
    duration = 10;
  } else if (kind === 'mary' || kind === 'jacob') {
    line(kind, .32, kind === 'mary' ? 7 : -12, kind === 'mary' ? 'triangle' : 'sine', .2);
    duration = 5.2;
  } else {
    const beat = kind === 'normal' ? .37 : .0925;
    line('twinkle', beat, 0, 'triangle', .21);
    duration = beat * 16;
  }
  setTimeout(() => { if (token === playback) done(); }, duration * 1000 + 65);
}

const structure = [[0,0,0],[1,0,0],[2,0,0],[3,0,0],[3,1,0],[3,2,0],[3,2,1],[3,2,2],[3,3,2],[3,3,3]];
const orientations = [[-.67,.42,false],[.72,.25,true],[-1.7,-.37,true],[1.45,.32,false],[2.45,.49,true]];
export function drawShapes(root, animate = false) {
  root.querySelectorAll('canvas[data-shape]').forEach(canvas => {
    const index = Number(canvas.dataset.shape);
    const pen = canvas.getContext('2d');
    const [yaw, pitch, mirror] = orientations[index];
    const paint = (y, p) => {
      const points = (coords) => {
        let [a,b,c] = coords.map(v => v - 1.5);
        if (mirror) a = -a;
        const x = a*Math.cos(y) - c*Math.sin(y);
        const z = a*Math.sin(y) + c*Math.cos(y);
        return [x, -b*Math.cos(p) + z*Math.sin(p), b*Math.sin(p) + z*Math.cos(p)];
      };
      const faces = [];
      const positions = [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
      const sides = [
        [[0,1,2,3],'#9b74dc'], [[4,7,6,5],'#b18be9'], [[0,4,5,1],'#9868cd'],
        [[3,2,6,7],'#dbc1ff'], [[0,3,7,4],'#8252bf'], [[1,5,6,2],'#a887e0'],
      ];
      for (const [x,y,z] of structure) {
        const vertices = positions.map(([a,b,c]) => points([x+a-.5,y+b-.5,z+c-.5]));
        for (const [indices, color] of sides) {
          const polygon = indices.map(i => vertices[i]);
          faces.push({polygon,color,depth:polygon.reduce((sum, point) => sum + point[2],0) / 4});
        }
      }
      faces.sort((a,b) => a.depth - b.depth);
      pen.clearRect(0,0,210,200);
      for (const {polygon,color} of faces) {
        pen.beginPath();
        polygon.forEach(([x,y],i) => i ? pen.lineTo(105+x*30,100+y*30) : pen.moveTo(105+x*30,100+y*30));
        pen.closePath();
        pen.fillStyle = color;
        pen.strokeStyle = '#53358c';
        pen.lineWidth = 1.6;
        pen.fill();
        pen.stroke();
      }
    };
    paint(yaw,pitch);
    if (animate && index === 3 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const start = performance.now();
      const frame = now => {
        if (!canvas.isConnected) return;
        const f = Math.min(1,(now-start)/1050);
        const ease = f*f*(3-2*f);
        paint(yaw + (-.67-yaw)*ease,pitch + (.42-pitch)*ease);
        if (f < 1) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }
  });
}
