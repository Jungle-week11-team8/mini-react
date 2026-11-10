import { getCurrentComponent } from '../component/index.js';

/**
 * @template T
 * @param {T} initialValue 첫 렌더에서 저장할 값
 * @returns {[T, (nextValue: T) => void]}
 */
export function useState(initialValue) {
  const { component, slot } = getNextHookSlot();

  // undefined도 저장할 수 있으므로 값 대신 슬롯의 존재 여부로 초기화를 판단한다.
  if (!Object.hasOwn(component.hooks, slot)) {
    component.hooks[slot] = initialValue;
  }

  return [component.hooks[slot], (nextValue) => component.setState(slot, nextValue)];
}

/**
 * @param {() => (void | (() => void))} effect DOM 반영 뒤 실행할 함수
 * @param {readonly unknown[]} [dependencies] 재실행을 판단할 값들
 */
export function useEffect(effect, dependencies) {
  const { component, slot } = getNextHookSlot();
  const previous = component.hooks[slot];
  if (haveSameDependencies(previous?.dependencies, dependencies)) {
    return;
  }

  const nextDependencies = dependencies === undefined ? undefined : Array.from(dependencies);
  component.scheduleEffect(() => {
    // 정리나 effect에서 오류가 나면 다음 갱신에서 이전 effect를 다시 정리하지 않는다.
    const cleanup = previous?.cleanup;
    delete component.hooks[slot];
    if (typeof cleanup === 'function') {
      cleanup();
    }
    component.hooks[slot] = { dependencies: nextDependencies, cleanup: effect() };
  });
}

/**
 * @template T
 * @param {() => T} calculate 렌더에서 실행할 계산
 * @param {readonly unknown[]} [dependencies] 캐시를 재사용할지 판단할 값들
 * @returns {T}
 */
export function useMemo(calculate, dependencies) {
  const { component, slot } = getNextHookSlot();
  const previous = component.hooks[slot];
  if (haveSameDependencies(previous?.dependencies, dependencies)) {
    return previous.value;
  }

  const nextDependencies = dependencies === undefined ? undefined : Array.from(dependencies);
  const value = calculate();
  component.hooks[slot] = { dependencies: nextDependencies, value };
  return value;
}

function getNextHookSlot() {
  const component = getCurrentComponent();
  const slot = component.hookIndex;
  component.hookIndex += 1;
  return { component, slot };
}

function haveSameDependencies(previous, next) {
  return (
    previous !== undefined &&
    next !== undefined &&
    previous.length === next.length &&
    previous.every((value, index) => Object.is(value, next[index]))
  );
}
