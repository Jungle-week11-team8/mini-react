import { getCurrentComponent } from '../component/index.js';
import { depsChanged } from './depsChanged.js';

/**
 * 의존성이 그대로면 이전에 계산한 값을 다시 쓰고, 바뀌었을 때만 새로 계산한다.
 * @template T
 * @param {() => T} factory
 * @param {unknown[]} [deps] 생략하면 매 렌더 새로 계산한다
 * @returns {T}
 */
export function useMemo(factory, deps) {
  const component = getCurrentComponent();
  // 렌더 밖에서는 어느 컴포넌트의 몇 번째 칸인지 알 수 없다
  if (!component) throw new Error('useMemo는 컴포넌트 렌더 중에만 호출할 수 있습니다.');

  const index = component.hookIndex++;
  const isFirst = index >= component.hooks.length;
  if (isFirst) component.hooks.push({ value: undefined, deps: undefined });
  const hook = component.hooks[index];

  // effect와 달리 반환값이 렌더 결과에 바로 쓰이므로, 렌더 중에 바로 계산한다
  if (isFirst || depsChanged(hook.deps, deps)) {
    hook.value = factory();
    hook.deps = deps;
  }
  return hook.value;
}
