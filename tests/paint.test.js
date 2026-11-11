import { describe, it, expect } from 'vitest';
import {
  createPixels,
  paintCell,
  startStroke,
  moveTo,
  countColors,
  paintStroke,
  clearCanvas,
  restoreSaved,
  MAX_HISTORY,
} from '../demo/paint/logic.js';

describe('createPixels', () => {
  it('size × size 칸을 모두 0(빈칸)으로 만든다', () => {
    expect(createPixels(2)).toEqual([0, 0, 0, 0]);
  });
});

describe('paintCell', () => {
  it('원본 배열을 바꾸지 않고 새 배열을 돌려준다', () => {
    const pixels = [0, 0, 0];
    const next = paintCell(pixels, 1, 3);
    expect(next).toEqual([0, 3, 0]);
    expect(pixels).toEqual([0, 0, 0]);
  });

  it('이미 같은 색이면 같은 참조를 돌려준다', () => {
    const pixels = [0, 3, 0];
    expect(paintCell(pixels, 1, 3)).toBe(pixels);
  });

  it('범위 밖 index는 무시하고 같은 참조를 돌려준다', () => {
    const pixels = [0, 0, 0];
    expect(paintCell(pixels, -1, 3)).toBe(pixels);
    expect(paintCell(pixels, 3, 3)).toBe(pixels);
  });
});

describe('startStroke', () => {
  it('끝 위치에서 시작하면 기록이 하나 늘고 위치가 끝으로 간다', () => {
    const history = [[0], [1]];
    const result = startStroke(history, 1);
    expect(result.history).toHaveLength(3);
    expect(result.position).toBe(2);
  });

  it('되감은 위치에서 시작하면 그 뒤 기록은 사라진다', () => {
    const history = [[0], [1], [2]];
    const result = startStroke(history, 0);
    expect(result.history).toEqual([[0], [0]]);
    expect(result.position).toBe(1);
  });

  it('추가한 기록은 이전 기록과 다른 배열이다', () => {
    const history = [[0]];
    const result = startStroke(history, 0);
    expect(result.history[1]).not.toBe(result.history[0]);
  });

  it('원본 history를 바꾸지 않는다', () => {
    const history = [[0], [1]];
    startStroke(history, 0);
    expect(history).toEqual([[0], [1]]);
  });
});

describe('moveTo', () => {
  const history = [[0], [1], [2]];

  it('범위 안 위치는 그대로 돌려준다', () => {
    expect(moveTo(history, 1)).toBe(1);
  });

  it('음수는 0으로 고정한다', () => {
    expect(moveTo(history, -1)).toBe(0);
  });

  it('끝을 넘으면 마지막 위치로 고정한다', () => {
    expect(moveTo(history, 5)).toBe(2);
  });
});

describe('countColors', () => {
  it('빈 캔버스는 빈 배열을 돌려준다', () => {
    expect(countColors([0, 0, 0])).toEqual([]);
  });

  it('지우개(0)는 세지 않고, 많은 순으로 정렬한다', () => {
    expect(countColors([1, 2, 2, 0, 2, 1, 3])).toEqual([
      { color: 2, count: 3 },
      { color: 1, count: 2 },
      { color: 3, count: 1 },
    ]);
  });
});

describe('startStroke 기록 상한', () => {
  it('기록이 상한에 닿으면 가장 오래된 기록을 버린다', () => {
    const history = Array.from({ length: MAX_HISTORY }, (_, i) => [i]);
    const result = startStroke(history, MAX_HISTORY - 1);
    expect(result.history).toHaveLength(MAX_HISTORY);
    expect(result.history[0]).toEqual([1]);
    expect(result.position).toBe(MAX_HISTORY - 1);
  });
});

describe('paintStroke', () => {
  const base = { history: [[0, 0]], position: 0, color: 2, stroke: 'fresh' };

  it('획을 긋는 중이 아니면 칠하지 않는다', () => {
    const state = { ...base, stroke: 'idle' };
    expect(paintStroke(state, 0)).toBe(state);
  });

  it('획의 첫 변경에서 새 기록을 만든다', () => {
    const next = paintStroke(base, 0);
    expect(next.history).toEqual([
      [0, 0],
      [2, 0],
    ]);
    expect(next.position).toBe(1);
    expect(next.stroke).toBe('drawing');
  });

  it('같은 획의 다음 칸은 기록을 늘리지 않고 마지막 기록을 고친다', () => {
    const next = paintStroke(paintStroke(base, 0), 1);
    expect(next.history).toEqual([
      [0, 0],
      [2, 2],
    ]);
    expect(next.position).toBe(1);
  });

  it('아무 칸도 바뀌지 않으면 같은 state를 돌려줘 기록을 남기지 않는다', () => {
    const state = { ...base, history: [[2, 0]] };
    expect(paintStroke(state, 0)).toBe(state);
  });

  it('이전 기록 배열을 바꾸지 않는다', () => {
    const first = paintStroke(base, 0);
    const before = first.history[1];
    paintStroke(first, 1);
    expect(before).toEqual([2, 0]);
  });
});

describe('clearCanvas', () => {
  it('지우기를 기록 하나로 남긴다', () => {
    const state = { history: [[1, 2]], position: 0, color: 1, stroke: 'idle' };
    const next = clearCanvas(state);
    expect(next.history).toEqual([
      [1, 2],
      [0, 0],
    ]);
    expect(next.position).toBe(1);
  });

  it('이미 비어 있으면 같은 state를 돌려준다', () => {
    const state = { history: [[0, 0]], position: 0, color: 1, stroke: 'idle' };
    expect(clearCanvas(state)).toBe(state);
  });
});

describe('restoreSaved', () => {
  const valid = JSON.stringify({ history: [[0, 1, 2, 3]], position: 0 });

  it('형식이 맞으면 기록과 위치를 되살린다', () => {
    expect(restoreSaved(valid, 2, 4)).toEqual({ history: [[0, 1, 2, 3]], position: 0 });
  });

  it('JSON이 아니거나 비어 있으면 null', () => {
    expect(restoreSaved('{', 2, 4)).toBeNull();
    expect(restoreSaved(null, 2, 4)).toBeNull();
  });

  it('격자 크기가 다르면 null', () => {
    expect(restoreSaved(valid, 3, 4)).toBeNull();
  });

  it('없는 색 번호가 있으면 null', () => {
    expect(restoreSaved(valid, 2, 3)).toBeNull();
  });

  it('위치가 기록 범위 밖이면 null', () => {
    const json = JSON.stringify({ history: [[0, 0, 0, 0]], position: 1 });
    expect(restoreSaved(json, 2, 4)).toBeNull();
  });
});
