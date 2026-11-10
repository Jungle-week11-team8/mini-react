/**
 * 이전 의존성 배열과 비교해 하나라도 바뀌었는지 알려 준다. 배열이 없으면 항상 바뀐 것으로 본다.
 * @param {unknown[] | undefined} prevDeps
 * @param {unknown[] | undefined} nextDeps
 * @returns {boolean}
 */
export function depsChanged(prevDeps, nextDeps) {
  if (!prevDeps || !nextDeps) return true;
  // Object.is는 NaN을 같은 값으로 보므로, NaN이 그대로면 바뀌지 않은 것으로 본다
  return (
    prevDeps.length !== nextDeps.length || nextDeps.some((dep, i) => !Object.is(dep, prevDeps[i]))
  );
}
