// 그림판의 상태 계산만 담는다. DOM을 모르므로 테스트에서 바로 확인할 수 있다.
// 그림은 색 번호 배열이다. 0은 빈칸(지우개)이다.

/**
 * @param {number} size 한 변의 칸 수
 * @returns {number[]}
 */
export function createPixels(size) {
  return new Array(size * size).fill(0);
}

/**
 * @param {number[]} pixels
 * @param {number} index
 * @param {number} color
 * @returns {number[]} 바뀐 게 없으면 원본 참조를 그대로 돌려준다
 */
export function paintCell(pixels, index, color) {
  // 같은 참조를 돌려줘야 setState가 Object.is로 같다고 보고 렌더를 건너뛴다
  if (index < 0 || index >= pixels.length || pixels[index] === color) return pixels;
  const next = pixels.slice();
  next[index] = color;
  return next;
}

/**
 * 새 획을 시작한다. 지금 위치 그림의 사본을 기록 끝에 붙이고, 획 동안 그 사본을 고친다.
 * @param {number[][]} history
 * @param {number} position
 * @returns {{ history: number[][], position: number }}
 */
export function startStroke(history, position) {
  // 되감은 상태에서 새로 그리면 그 뒤 미래는 버린다
  const kept = history.slice(0, position + 1);
  // 기록 눈금이 끝없이 늘지 않도록 가장 오래된 기록부터 버린다
  const next = [...kept, kept[position].slice()].slice(-MAX_HISTORY);
  return { history: next, position: next.length - 1 };
}

export const MAX_HISTORY = 50;

/**
 * @typedef {{ history: number[][], position: number, color: number,
 *   stroke: 'idle' | 'fresh' | 'drawing' }} PaintState
 * stroke: 'fresh'는 버튼을 눌렀지만 아직 칸을 바꾸지 않은 상태다.
 */

/**
 * 획 중에 칸 하나를 칠한다. 획에서 처음 바뀌는 칸일 때만 새 기록을 만든다.
 * @param {PaintState} state
 * @param {number} index
 * @returns {PaintState} 바뀐 게 없으면 같은 state
 */
export function paintStroke(state, index) {
  if (state.stroke === 'idle') return state;
  const current = state.history[state.position];
  const painted = paintCell(current, index, state.color);
  // 같은 색 칸만 문지른 획이 빈 기록을 남기지 않게 한다
  if (painted === current) return state;
  if (state.stroke === 'fresh') {
    const { history, position } = startStroke(state.history, state.position);
    history[position] = painted;
    return { ...state, history, position, stroke: 'drawing' };
  }
  const history = state.history.slice();
  history[state.position] = painted;
  return { ...state, history };
}

/**
 * 캔버스를 비운다. 되돌릴 수 있도록 지우기도 기록 하나로 남긴다.
 * @param {PaintState} state
 * @returns {PaintState}
 */
export function clearCanvas(state) {
  const current = state.history[state.position];
  if (current.every((color) => color === 0)) return state;
  const { history, position } = startStroke(state.history, state.position);
  history[position] = current.map(() => 0);
  return { ...state, history, position };
}

/**
 * 저장된 문자열을 기록으로 되살린다. 형식이 하나라도 다르면 null을 돌려준다.
 * @param {string | null} json
 * @param {number} size
 * @param {number} colorCount
 * @returns {{ history: number[][], position: number } | null}
 */
export function restoreSaved(json, size, colorCount) {
  // localStorage는 다른 버전 코드나 사용자가 고칠 수 있어 그대로 믿지 않는다
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  const isPixels = (pixels) =>
    Array.isArray(pixels) &&
    pixels.length === size * size &&
    pixels.every((color) => Number.isInteger(color) && color >= 0 && color < colorCount);
  const { history, position } = data ?? {};
  if (!Array.isArray(history) || history.length === 0 || history.length > MAX_HISTORY) return null;
  if (!history.every(isPixels)) return null;
  if (!Number.isInteger(position) || position < 0 || position >= history.length) return null;
  return { history, position };
}

/**
 * @param {number[][]} history
 * @param {number} position
 * @returns {number} 기록 범위 안으로 고정한 위치
 */
export function moveTo(history, position) {
  return Math.min(Math.max(position, 0), history.length - 1);
}

/**
 * @param {number[]} pixels
 * @returns {{ color: number, count: number }[]} 많이 쓴 색부터
 */
export function countColors(pixels) {
  const counts = new Map();
  for (const color of pixels) {
    if (color !== 0) counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  return [...counts].map(([color, count]) => ({ color, count })).sort((a, b) => b.count - a.count);
}
