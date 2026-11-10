/**
 * 렌더링 중인 현재 FunctionComponent 인스턴스를 보관하는 모듈 전역 포인터.
 *
 * 자바스크립트는 싱글 스레드이므로 컴포넌트의 render()가 실행되는 동안
 * 전역 변수에 현재 컴포넌트를 등록해 두면, 밖에서 호출된 Hook(useState 등)이
 * 어떤 컴포넌트의 hooks 배열을 써야 하는지 알 수 있습니다.
 */

let currentComponent = null;

export function getCurrentComponent() {
  return currentComponent;
}

export function setCurrentComponent(comp) {
  currentComponent = comp;
}
