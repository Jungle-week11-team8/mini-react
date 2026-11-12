import { useMemo } from './useMemo.js';

/**
 * 렌더링 간에 변경 가능한 참조(ref) 객체를 유지하는 훅.
 * 값이 바뀌어도 컴포넌트를 리렌더링하지 않는다.
 *
 * useMemo를 활용하여 최초 마운트 시 { current: initialValue } 객체를 단 1회 생성하고 유지한다.
 *
 * @template T
 * @param {T} initialValue
 * @returns {{ current: T }}
 */
export function useRef(initialValue) {
  return useMemo(() => ({ current: initialValue }), []);
}
