import { expect, it, vi } from 'vitest';
import { FunctionComponent } from '../src/component/index.js';
import { useEffect, useState } from '../src/hooks/index.js';

it('useEffect는 DOM 반영 뒤 실행하고 의존성이 바뀌면 이전 effect를 먼저 정리한다', () => {
  const container = document.createElement('div');
  const effectLog = [];
  let count = 0;
  const component = new FunctionComponent(() => {
    useEffect(() => {
      const renderedText = container.textContent;
      effectLog.push(`실행 ${renderedText}`);
      return () => {
        effectLog.push(`정리 ${renderedText}`);
      };
    }, [count]);

    return { type: 'text', text: String(count) };
  }, container);

  component.mount();
  expect(effectLog).toEqual(['실행 0']);

  component.update();
  expect(effectLog).toEqual(['실행 0']);

  count = 1;
  component.update();
  expect(effectLog).toEqual(['실행 0', '정리 0', '실행 1']);
});

it('같은 상태값으로 다시 렌더하면 effect를 재실행하지 않는다', () => {
  const container = document.createElement('div');
  const effectLog = [];
  let setCount;
  const render = vi.fn(() => {
    const [count, updateCount] = useState(2);
    setCount ??= updateCount;
    useEffect(() => {
      effectLog.push(count);
    }, [count]);

    return { type: 'text', text: String(count) };
  });
  const component = new FunctionComponent(render, container);

  component.mount();
  expect(effectLog).toEqual([2]);

  setCount(2);
  expect(render).toHaveBeenCalledTimes(2);
  expect(effectLog).toEqual([2]);

  setCount(3);
  expect(effectLog).toEqual([2, 3]);
});

it('두 의존성 중 어느 하나가 바뀌어도 effect를 재실행한다', () => {
  const container = document.createElement('div');
  const effectLog = [];
  let count = 1;
  let label = 'a';
  const component = new FunctionComponent(() => {
    const dependencies = [count, label];
    useEffect(() => {
      effectLog.push(dependencies);
    }, dependencies);

    return { type: 'text', text: label };
  }, container);

  component.mount();
  expect(effectLog).toEqual([[1, 'a']]);

  component.update();
  expect(effectLog).toEqual([[1, 'a']]);

  label = 'b';
  component.update();
  expect(effectLog).toEqual([
    [1, 'a'],
    [1, 'b'],
  ]);

  component.update();
  expect(effectLog).toEqual([
    [1, 'a'],
    [1, 'b'],
  ]);

  count = 2;
  component.update();
  expect(effectLog).toEqual([
    [1, 'a'],
    [1, 'b'],
    [2, 'b'],
  ]);
});
