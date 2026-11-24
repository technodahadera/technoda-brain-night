// Each decorative track has the same scale, regardless of its artwork.
export const resultThemes = ['candy', 'paint', 'cubes', 'sound', 'coins', 'bulbs', 'rocket', 'burger'];

export function resultArt(theme) {
  if (theme === 'candy') {
    return `<div class="candy-jar" aria-hidden="true">
      <div class="candy-glass">
        <div class="candy-bed result-fill">${'<i></i>'.repeat(28)}</div>
      </div>
      <div class="candy-rim"></div>
    </div>`;
  }

  if (theme === 'rocket') {
    return `<div class="result-art" aria-hidden="true">
      <div class="art-rocket-flight">
        <div class="art-rocket-track"></div>
        <div class="art-rocket-trail result-fill"></div>
        <div class="art-rocket-ship"><i></i></div>
      </div>
    </div>`;
  }

  const pieces = {
    paint: ['<i class="art-paint-piece"></i>', 6],
    cubes: ['<i class="art-cube"></i>', 6],
    sound: ['<i class="art-sound-beat"><b></b><b></b><b></b><b></b><b></b></i>', 6],
    coins: ['<i class="art-coin"></i>', 6],
    bulbs: ['<i class="art-bulb"></i>', 12],
    burger: ['<i class="art-burger-layer"><b></b></i>', 6],
  };
  const [piece, count] = pieces[theme];
  const stack = piece.repeat(count);
  return `<div class="result-art" aria-hidden="true">
    <div class="art-stack art-outline">${stack}</div>
    <div class="art-stack result-fill">${stack}</div>
    ${theme === 'burger' ? '<i class="art-bottom-bun"></i><div class="art-burger-cap"><i class="art-top-bun"></i></div>' : ''}
  </div>`;
}
