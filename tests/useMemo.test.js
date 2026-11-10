import { expect, it, vi } from 'vitest';
import { FunctionComponent } from '../src/component/index.js';
import { useMemo } from '../src/hooks/index.js';

it('useMemo는 같은 의존성에서 결과를 재사용하고 의존성이 바뀌면 다시 계산한다', () => {
  const container = document.createElement('div');
  const double = vi.fn((value) => value * 2);
  let count = 2;
  let label = '처음';
  const component = new FunctionComponent(() => {
    const doubled = useMemo(() => double(count), [count]);
    return { type: 'text', text: `${label} ${doubled}` };
  }, container);

  component.mount();
  expect(container.textContent).toBe('처음 4');
  expect(double).toHaveBeenCalledTimes(1);

  label = '갱신';
  component.update();
  expect(container.textContent).toBe('갱신 4');
  expect(double).toHaveBeenCalledTimes(1);

  count = 3;
  component.update();
  expect(container.textContent).toBe('갱신 6');
  expect(double).toHaveBeenCalledTimes(2);
});
