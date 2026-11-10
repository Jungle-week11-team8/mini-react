import { getCurrentComponent } from './current.js';
import { areDepsEqual } from './areDepsEqual.js';

/**
 * Side Effect를 수행하는 훅.
 *
 * 동작 메커니즘:
 * 1. 렌더 도중에는 실행하지 않고, 의존성 변경 여부를 검사해 실행할 콜백을
 *    컴포넌트의 pendingEffects 큐에 예약한다.
 * 2. 실제 DOM에 화면이 모두 반영(Commit)된 직후 flushEffects에 의해 실행된다.
 * 3. 다음 effect가 실행되기 직전에 이전 cleanup 함수를 먼저 호출한다.  
 * 4. deps가 변경되지 않은 경우 콜백과 cleanup 모두 실행되지 않는다. 
 *
 * @param {() => (void | (() => void))} callback - 실행할 부수 효과 함수
 * @param {any[]} [deps] - 의존성 배열 (생략 시 매 렌더마다 실행, []는 마운트 시 1회만)
 */
export function useEffect(callback, deps) {
  const comp = getCurrentComponent();
  if (!comp) {
    throw new Error('useEffect: 컴포넌트 렌더링 외부에서 Hook을 호출할 수 없습니다.');
  }

  const index = comp.hookIndex;
  comp.hookIndex += 1;

  const prevHook = comp.hooks[index];

  // 의존성 배열 비교 (최초 렌더이거나, deps가 없거나, deps의 원소가 바뀌었는지)
  const hasChanged = !prevHook || !areDepsEqual(prevHook.deps, deps);

  if (hasChanged) {
    // render 중에는 실행하지 않고 예약만 등록
    comp.pendingEffects.push(() => {
      // E-6: 다음 effect 실행 직전에 이전 cleanup을 먼저 호출
      if (typeof prevHook?.cleanup === 'function') {
        prevHook.cleanup();
      }

      // 새 effect 실행 및 반환된 cleanup 함수 저장 (E-5)
      const cleanup = callback();
      comp.hooks[index] = {
        deps,
        cleanup: typeof cleanup === 'function' ? cleanup : null,
      };
    });
  }
}

