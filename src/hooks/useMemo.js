import { getCurrentComponent } from './current.js';
import { areDepsEqual } from './areDepsEqual.js';

/**
 * 계산 비용이 큰 연산의 결과값을 의존성 배열(deps)이 바뀔 때까지 캐싱한다.
 *
 * 동작 메커니즘:
 * 1. 렌더 도중 동기적으로 실행된다.  
 * 2. comp.hooks[index]에 { value, deps } 객체 형태로 캐시를 저장한다.  
 * 3. 이전 deps와 현재 deps가 areDepsEqual로 같으면 계산 함수를 재실행하지 않고 캐시된 value를 반환한다.
 * 4. 최초 렌더링이거나 deps가 달라졌으면 factory()를 실행하여 새 value를 계산하고 캐시를 갱신한다.  
 *
 * @template T
 * @param {() => T} factory - 계산 함수
 * @param {any[]} [deps] - 의존성 배열
 * @returns {T}
 */
export function useMemo(factory, deps) {
  // 현재 컴포넌트와 Hook 슬롯 가져오기
  const comp = getCurrentComponent();
  if (!comp) {
    throw new Error('useMemo: 컴포넌트 렌더링 외부에서 Hook을 호출할 수 없습니다.');
  }

  const index = comp.hookIndex;
  comp.hookIndex += 1;

  // 이전 캐시 가져오기
  const prevHook = comp.hooks[index];

  // deps 비교 후 캐시 반환
  // 이전 캐시가 있고, 의존성 배열의 원소들이 모두 동일하다면 이전 값 재사용
  if (prevHook && areDepsEqual(prevHook.deps, deps)) {
    return prevHook.value;
  }

  // 최초 렌더링이거나 의존성이 변경된 경우 새로 계산
  // value: 이전에 계산한 결과를 재사용하기 위해
  // deps: 현재 계산 결과를 재사용해도 되는지 판단하기 위해
  const value = factory();
  comp.hooks[index] = { value, deps };

  return value;
}
