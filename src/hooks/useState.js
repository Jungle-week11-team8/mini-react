import { getCurrentComponent } from './current.js';

/**
 * 상태(State)를 생성하고 갱신하는 훅.
 *
 * 동작 메커니즘:
 * 1. currentComponent를 통해 현재 렌더링 중인 FunctionComponent 인스턴스를 찾는다.
 * 2. 컴포넌트의 hooks 배열에서 자신의 hookIndex 위치를 클로저로 캡처한다.
 * 3. 최초 렌더링 시에만 initialValue(또는 initialValue())로 초기값을 설정한다. 
 * 4. setState가 호출되면 새 값을 계산하고, Object.is 비교를 거쳐 다를 때만
 *    comp.hooks[index]를 갱신하고 comp.update()를 호출해 반응형 갱신을 트리거한다. 
 *
 * @template T
 * @param {T | (() => T)} initialValue
 * @returns {[T, (action: T | ((prev: T) => T)) => void]}
 */
export function useState(initialValue) {
  const comp = getCurrentComponent();
  if (!comp) {
    throw new Error('useState: 컴포넌트 렌더링 외부에서 Hook을 호출할 수 없습니다.');
  }

  // 현재 슬롯의 인덱스를 캡처하고 다음 훅을 위해 hookIndex를 1 증가
  const index = comp.hookIndex; // 렌더링이 끝난 후에도 setter가 같은 상태 슬롯을 찾아갈 수 있도록 보존
  comp.hookIndex += 1; // 렌더링 중에 Hook의 위치를 결정

  // 최초 렌더링 - 현재 Hook이 사용할 슬롯이 아직 존재하지 않을 때만 초기값을 저장
  if (comp.hooks.length <= index) {
    const value = typeof initialValue === 'function' ? initialValue() : initialValue;
    comp.hooks[index] = value;
  }

  // index와 comp를 클로저로 캡처한 setter 함수
  const setState = (nextAction) => {
    // 기존 상태 가져오기
    const prevValue = comp.hooks[index];
    // 새로운 상태 계산하기
    // 1. 값 직접 전달
    // 2. 함수형 업데이트 방식
    const nextValue = typeof nextAction === 'function' ? nextAction(prevValue) : nextAction;

    // Object.is로 변경여부 확인 
    // 값이 같으면 불필요한 렌더링(update) 생략
    if (Object.is(prevValue, nextValue)) {
      return;
    }

    // 상태 저장 및 화면 자동 갱신 트리거
    comp.hooks[index] = nextValue;
    comp.update();
  };

  return [comp.hooks[index], setState];
}

