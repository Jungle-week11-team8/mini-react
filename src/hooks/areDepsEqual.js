/**
 * 두 의존성(deps) 배열의 원소들이 변경되었는지 비교한다.
 *
 * 두 배열의 길이가 같고 모든 원소가 Object.is로 같으면 true
 * prevDeps가 없거나(최초 렌더링) 유효한 배열이 아니면 false
 * nextDeps가 undefined이면 '항상 변경됨'으로 취급하여 false 반환 (매 렌더마다 실행)
 *
 * @param {any[]} [prevDeps]
 * @param {any[]} [nextDeps]
 * @returns {boolean}
 */
export function areDepsEqual(prevDeps, nextDeps) {
  // deps 인자가 생략되었거나(undefined) null이면 항상 변경된 것으로 판단
  if (prevDeps === null || prevDeps === undefined || nextDeps === null || nextDeps === undefined) {
    return false;
  }

  // 둘 중 하나라도 배열이 아니거나 길이가 다르면 변경된 것으로 판단
  if (!Array.isArray(prevDeps) || !Array.isArray(nextDeps)) {
    return false;
  }

  if (prevDeps.length !== nextDeps.length) {
    return false;
  }

  // 모든 원소가 Object.is 기준으로 일치해야 같음
  for (let i = 0; i < prevDeps.length; i++) {
    if (!Object.is(prevDeps[i], nextDeps[i])) {
      return false;
    }
  }

  return true;
}
