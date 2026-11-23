"""Generate the five kitchen sound cues. Run from the repo root with Python and ffmpeg."""
import math
import random
import struct
import subprocess
import tempfile
import wave
from pathlib import Path

rate = 24000
track = [0.0] * (12 * rate)
random.seed(214)

def add(start, duration, volume, sound):
    for i in range(int(duration * rate)):
        t = i / rate
        track[round(start * rate) + i] += volume * sound(t, duration)

def sine(frequency, t):
    return math.sin(math.tau * frequency * t)

def noise():
    return random.uniform(-1, 1)

def pop(t, duration):
    return (noise() * .4 + sine(130, t)) * math.exp(-28*t)

# Fridge seal, hinge and light motor sound.
add(.18, .45, .58, pop)
add(.23, 1.1, .31, lambda t,d: (noise()*.45+sine(175+115*t,t)*.45)*math.sin(math.pi*t/d)**2)
add(.65, 2.8, .06, lambda t,d: (sine(55,t)+.4*sine(110,t))*math.sin(math.pi*t/d)**2)

# Carton rustles and its liquid sloshes.
for start, length in [(2.03,.23),(2.30,.31),(2.69,.20),(2.92,.24)]:
    add(start,length,.30,lambda t,d: noise()*math.sin(math.pi*t/d)**2*(.58+.42*sine(35,t)))
add(2.33, .55, .23, lambda t,d: (sine(74+73*t,t)*.65+noise()*.35)*math.sin(math.pi*t/d)**2)

# Kettle switch and a short low water rumble.
add(4.1,.19,.57,pop)
add(4.16,.14,.24,lambda t,d:(sine(650,t)+noise()*.45)*math.exp(-60*t))
add(4.42,1.5,.18,lambda t,d:(noise()*.58+sine(95+40*t,t)*.65)*math.sin(math.pi*t/d)**2)

# Cup and spoon clinks followed by a stir.
add(6.0,.48,.40,pop)
for i,start in enumerate([6.3,6.70,6.96,7.23,7.51,7.78]):
    add(start,.48,.27-i*.018,lambda t,d:(sine(1490,t)*.58+sine(2190,t)*.3+sine(3410,t)*.12)*math.exp(-10*t))
add(6.79,1.3,.11,lambda t,d:noise()*abs(sine(4,t))*math.sin(math.pi*t/d)**2)

# Remote click and TV start-up tones.
add(9.27,.17,.51,pop)
for i,freq in enumerate([330,440,587]):
    add(9.53+i*.19,.44,.19,lambda t,d,freq=freq:(sine(freq,t)+.28*sine(2*freq,t))*math.sin(math.pi*t/d)**2)
add(10.0,1.7,.12,lambda t,d:(noise()*.7+sine(58,t)*.3)*math.sin(math.pi*t/d)**2)

with tempfile.TemporaryDirectory() as temp:
    source = Path(temp) / 'kitchen.wav'
    with wave.open(str(source), 'wb') as output:
        output.setparams((1,2,rate,0,'NONE','not compressed'))
        output.writeframes(struct.pack('<'+'h'*len(track), *(int(32760*max(-1,min(1,x))) for x in track)))
    subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(source),'-b:a','48k','assets/kitchen.mp3'],check=True)
