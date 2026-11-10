import { expect, it } from 'vitest';
import { FunctionComponent } from '../src/component/index.js';
import { useEffect } from '../src/hooks/index.js';

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
