import { getCurrentComponent } from '../component/index.js';
import { depsChanged } from './depsChanged.js';

/**
 * 렌더가 DOM에 반영된 뒤 effect를 실행한다. 의존성이 그대로면 건너뛴다.
 * @param {() => (void | (() => void))} effect 함수를 반환하면 다음 effect 전에 정리용으로 부른다
 * @param {unknown[]} [deps] 생략하면 매 렌더, 빈 배열이면 첫 렌더에만 실행한다
 */
export function useEffect(effect, deps) {
  const component = getCurrentComponent();
  // 렌더 밖에서는 어느 컴포넌트의 몇 번째 칸인지 알 수 없다
  if (!component) throw new Error('useEffect는 컴포넌트 렌더 중에만 호출할 수 있습니다.');

  const index = component.hookIndex++;
  const isFirst = index >= component.hooks.length;
  if (isFirst) component.hooks.push({ deps: undefined, cleanup: undefined });
  const hook = component.hooks[index];

  if (isFirst || depsChanged(hook.deps, deps)) {
    // 지금은 DOM이 아직 바뀌기 전이라, 실행은 component가 반영을 마친 뒤에 한다
    component.pendingEffects.push({
      hook,
      effect,
      deps: deps === undefined ? undefined : [...deps],
    });
  }
}
