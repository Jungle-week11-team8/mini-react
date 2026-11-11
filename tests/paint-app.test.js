import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FunctionComponent } from '../src/index.js';
import { PaintApp, SIZE, STORAGE_KEY } from '../demo/paint/app.js';
import { paintStroke, moveTo } from '../demo/paint/logic.js';

const flush = () => new Promise((resolve) => setTimeout(resolve));

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => (data[key] = value),
  };
}

function mountApp(storage = fakeStorage()) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let setState;
  const statuses = [];
  new FunctionComponent(PaintApp, {
    storage,
    bind: (setter) => (setState = setter),
    onSaveStatus: (status) => statuses.push(status),
  }).mount(container);
  // 한 획: 누르고 칸 하나를 칠한 뒤 뗀다
  const stroke = (index) =>
    setState((state) => ({
      ...paintStroke({ ...state, stroke: 'fresh' }, index),
      stroke: 'idle',
    }));
  const go = (delta) =>
    setState((state) => ({ ...state, position: moveTo(state.history, state.position + delta) }));
  return { container, storage, statuses, stroke, go };
}

const cell = (container, index) => container.querySelector(`[data-index="${index}"]`);

describe('PaintApp', () => {
  beforeEach(() => vi.useRealTimers());
  afterEach(() => (document.body.innerHTML = ''));

  it(`${SIZE}×${SIZE} 칸을 빈칸으로 그린다`, () => {
    const { container } = mountApp();
    expect(container.querySelectorAll('[data-index]')).toHaveLength(SIZE * SIZE);
    expect(cell(container, 0).dataset.color).toBe('0');
  });

  it('한 칸을 칠하면 캔버스에서는 그 칸의 속성만 바뀐다', async () => {
    const { container, stroke } = mountApp();
    const records = [];
    new MutationObserver((list) => records.push(...list)).observe(container, {
      subtree: true,
      attributes: true,
      childList: true,
    });
    stroke(5);
    await flush();
    const cellChanges = records.filter(({ target }) => target.dataset?.index !== undefined);
    expect(cellChanges).toHaveLength(1);
    expect(cellChanges[0].target).toBe(cell(container, 5));
    expect(cell(container, 5).dataset.color).toBe('1');
  });

  it('뒤로 가면 캔버스가 처음 그림과 같은 DOM이 되고, 앞으로 가면 다시 칠한 그림이 된다', async () => {
    const { container, stroke, go } = mountApp();
    // 기록 눈금은 되감아도 남아 있으므로 캔버스만 비교한다
    const canvas = () => container.querySelector('.canvas').outerHTML;
    const initial = canvas();
    stroke(5);
    await flush();
    const painted = canvas();
    go(-1);
    await flush();
    expect(canvas()).toBe(initial);
    go(1);
    await flush();
    expect(canvas()).toBe(painted);
  });

  it('처음 칠하면 색 통계가 안내문에서 목록으로 바뀐다', async () => {
    const { container, stroke } = mountApp();
    expect(container.querySelector('.stats-empty')).not.toBeNull();
    stroke(0);
    await flush();
    expect(container.querySelector('.stats-empty')).toBeNull();
    expect(container.querySelector('.stats li').textContent).toBe('주황 1칸');
  });

  it('되감은 뒤 새로 칠하면 뒤쪽 기록 눈금이 사라진다', async () => {
    const { container, stroke, go } = mountApp();
    stroke(0);
    await flush();
    stroke(1);
    await flush();
    expect(container.querySelectorAll('.tick')).toHaveLength(3);
    go(-2);
    await flush();
    stroke(2);
    await flush();
    expect(container.querySelectorAll('.tick')).toHaveLength(2);
  });

  it('잠시 멈춘 뒤 한 번만 저장하고, 그 전 예약은 cleanup으로 취소한다', async () => {
    vi.useFakeTimers();
    const { storage, statuses, stroke } = mountApp();
    stroke(0);
    await vi.advanceTimersByTimeAsync(0);
    stroke(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(storage.data[STORAGE_KEY]).toBeUndefined();
    await vi.advanceTimersByTimeAsync(500);
    expect(statuses.filter((s) => s === 'cancelled')).toHaveLength(2);
    expect(statuses.at(-1)).toBe('saved');
    expect(JSON.parse(storage.data[STORAGE_KEY]).position).toBe(2);
  });

  it('저장된 그림을 불러오고, 형식이 틀리면 빈 캔버스로 시작한다', () => {
    const pixels = new Array(SIZE * SIZE).fill(0);
    pixels[3] = 4;
    const saved = JSON.stringify({ history: [pixels], position: 0 });
    const { container } = mountApp(fakeStorage({ [STORAGE_KEY]: saved }));
    expect(cell(container, 3).dataset.color).toBe('4');

    const broken = mountApp(fakeStorage({ [STORAGE_KEY]: '{"history":[[9]]}' }));
    expect(cell(broken.container, 3).dataset.color).toBe('0');
  });
});
