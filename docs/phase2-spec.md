# Phase 2 통합 계약

PR #37의 공개 API와 비동기 갱신을 기준으로 #38의 마운트·effect 안전장치,
#39의 동일 상태값 갱신 생략을 통합한다. VNode와 Patch는 `vnode-spec.md`를 그대로 따른다.

## 컴포넌트

- `new FunctionComponent(fn, props = {})`로 생성하고 `mount(container)`로 처음 그린다.
- `fn`은 루트 VNode 하나를 반환한다. 자식은 props를 받는 순수 함수로 실행한다.
- mount는 빈 컨테이너에서 한 번만 허용한다. mount 전 update는 오류다.
- 처음 그릴 때도 INSERT patch를 사용한다. 실제 DOM 변경은 patch 모듈에서만 수행한다.
- `update()`는 동기적으로 DOM을 갱신한다. effect 실행 중 호출한 update는 예약한다.
- 렌더 실패 시 DOM과 이전 VNode를 유지하고, effect를 실행하지 않는다.

## 상태와 훅

- 훅은 렌더 중 같은 순서로 호출한다. 상태는 루트 컴포넌트에서만 관리한다.
- `useState(initial)`은 함수 초깃값을 최초 한 번 실행한다.
- setter는 값 또는 `(prev) => next`를 받는다. 상태 슬롯의 값은 즉시 갱신한다.
- 이전 값과 다음 값이 `Object.is`로 같으면 새 렌더를 예약하지 않는다.
- 렌더 중 setter 호출은 상태를 바꾸기 전에 오류를 낸다.
- 연속 setter 호출은 마이크로태스크 한 번으로 모아 DOM에 반영한다.
- `useEffect(effect, deps)`는 DOM 반영 후 호출 순서대로 실행한다.
- deps 생략은 매 렌더, 빈 배열은 최초 실행, 배열은 원소를 `Object.is`로 비교한다.
- 의존성 배열은 복사해 기억한다. effect의 의존성은 실행에 성공한 뒤 저장한다.
- 새 effect 전에 이전 cleanup을 호출한다. cleanup이나 effect 실패 후 재시도해도
  이미 호출한 cleanup을 반복하지 않는다.
- effect의 setter는 현재 effect들을 마친 다음 렌더를 예약한다.
- effect로 50회를 초과해 연속 렌더하면 오류로 중단한다.
- `useMemo(factory, deps)`는 렌더 중 계산하고, 같은 의존성이면 계산 결과를 재사용한다.
- unmount와 그 시점의 cleanup은 이번 통합 범위에 포함하지 않는다.

## PR별 반영 범위

- #37: 컴포넌트·훅 구조, 상태 객체 슬롯, 일괄 갱신, 렌더 제한, 공개 API와 테스트.
- #38: 빈 컨테이너·생명주기 검사, INSERT 마운트, 의존성 복사와 effect 성공 후 저장.
- #39: 동일 상태값 검사, NaN·객체 참조·함수형 상태 갱신 등의 검증 사례.
- #39의 함수형 attrs, createDom 이동, h 추가는 가져오지 않는다.
  이벤트는 VNode에 함수를 넣지 않고 데모의 외부 리스너로 연결한다.
