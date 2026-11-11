import { getCurrentComponent } from '../component/index.js';

/**
 * 렌더 사이에 값을 기억하고, 값을 바꾸면 컴포넌트를 다시 그리도록 예약한다.
 * @template T
 * @param {T | (() => T)} initialValue 함수면 첫 렌더에만 실행해 초깃값을 만든다
 * @returns {[T, (next: T | ((prev: T) => T)) => void]}
 */
export function useState(initialValue) {
  const component = getCurrentComponent();
  // 렌더 밖에서는 어느 컴포넌트의 몇 번째 칸인지 알 수 없다
  if (!component) throw new Error('useState는 컴포넌트 렌더 중에만 호출할 수 있습니다.');

  const index = component.hookIndex++;
  // 칸이 비어 있을 때만 초깃값을 넣어야, 리렌더에서 저장된 값을 덮어쓰지 않는다
  if (index >= component.hooks.length) {
    const value = typeof initialValue === 'function' ? initialValue() : initialValue;
    component.hooks.push({ value });
  }
  const hook = component.hooks[index];

  const setState = (next) => {
    // 렌더 중 setState는 렌더가 끝날 때마다 다시 예약되어 멈추지 않을 수 있다
    if (getCurrentComponent()) throw new Error('렌더 중에는 setState를 호출할 수 없습니다.');
    // 값은 바로 바꿔 두어야, 렌더 전에 연달아 부른 함수형 업데이트가 누적된다
    const nextValue = typeof next === 'function' ? next(hook.value) : next;
    if (Object.is(hook.value, nextValue)) return;
    hook.value = nextValue;
    component.scheduleUpdate();
  };

  return [hook.value, setState];
}
