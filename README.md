# Mini React 프로젝트

## 1. 프로젝트 소개

브라우저 표준 API를 활용해 React의 핵심 동작을 직접 구현한 학습용 프로젝트.

### Phase 1. VNode와 Diff·Patch 구현

- 실제 DOM을 VNode로 변환
- Diff를 통해 두 VNode 트리의 차이 계산
- Patch를 통해 변경 사항을 실제 DOM에 반영
- History를 통해 VNode 스냅샷 저장 및 이전·다음 화면 이동

### Phase 2. 컴포넌트와 훅 구현

- 함수 컴포넌트와 상태 관리 구현
- `useState`, `useEffect`, `useMemo` 구현
- Phase 1에서 구현한 VNode, Diff, Patch를 기반으로 리렌더링 동작 구현

### 데모: 정글 생존 자판기

mini-react를 활용해 만든 예시 애플리케이션.

**실행 방법**

```bash
npm run dev
```

실행 후 `/vending/index.html` 접속

| 기능 | 사용한 훅 | 확인 방법 |
| --- | --- | --- |
| 아이템 담기·취소 | `useState` | 영수증에 항목이 추가·삭제됨 |
| 생존 점수 계산 | `useMemo` | 영업 상태만 변경하면 점수 계산 횟수가 증가하지 않음 |
| 영업 중·휴식 중 전환 | `useState` | 문구와 색상이 바뀌고, 휴식 중에는 담기 버튼 비활성화 |
| 선택 내역 자동 저장 | `useEffect` | 새로고침해도 선택 내역이 유지됨 |

**컴포넌트 구조**

- 상태와 훅은 루트 컴포넌트인 `App`에만 존재
- 자식 컴포넌트는 `props`만 전달받는 순수 함수로 구성

---

## 2. 전체 동작 흐름

### 상태 변경과 리렌더

```text
① 클릭
   ↓
② 리렌더
   ↓
③ Diff
   ↓
④ Patch
   ↓
⑤ 마무리
```

| 단계 | 동작 | 설명 |
| --- | --- | --- |
| ① 클릭 | 이벤트 핸들러 | 사용자의 클릭으로 이벤트 핸들러 실행, 클릭 핸들러가 setState 를 호출하면 상태 값이 바뀌고 리렌더가 예약 |
| ② 리렌더 | 새 VNode 생성 | 컴포넌트 함수를 다시 실행해 새로운 VNode 트리 생성 |
| ③ Diff | 차이 비교 | 이전 VNode와 새 VNode를 비교해 패치 목록 생성 |
| ④ Patch | DOM 수정 | 변경이 필요한 부분만 실제 DOM에 반영 |
| ⑤ 마무리 | 이벤트 연결 및 Effect | 최신 이벤트 핸들러 연결 및 Effect 실행 |

### 예시: 자판기에서 커피 담기

수면이 담긴 상태(30점)에서 커피 담기를 한 번 눌렀을 때의 동작.

| 단계 | 일어나는 일 |
| --- | --- |
| ① 클릭 | `setItems` 호출. 선택 목록 `[수면]` → `[수면, 커피]`로 변경하고 리렌더 예약 |
| ② 리렌더 | `App`을 다시 실행해 새로운 VNode 트리 생성 |
| ③ Diff | 영수증 한 줄 추가, 점수·합계·개수·렌더 횟수 텍스트, 막대 길이 등의 차이 발견 |
| ④ Patch | 패치 목록에 있는 노드만 실제 DOM에 반영 |
| ⑤ 마무리 | 최신 이벤트 핸들러 연결 및 선택 내역을 `localStorage`에 저장하는 Effect 실행 |

### 패치 목록 (Patch List)

③ Diff 단계에서 생성하는 객체 배열.

아래는 위 예시에서 생성되는 7개 패치 중 3개.

```js
[
  // 점수 텍스트 노드를 '40'으로 변경
  {
    type: 'SET_DATA',
    path: [0, 1, 0, 1, 1, 1, 0],
    value: '40'
  },

  // 점수 막대의 style 속성 변경
  {
    type: 'UPDATE_ATTRS',
    path: [0, 1, 0, 1, 1, 2, 0],
    set: { style: 'width:40%' },
    remove: []
  },

  // 영수증 <ul>의 1번 자리에 커피 <li> 추가
  {
    type: 'INSERT',
    parentPath: [0, 1, 1, 1, 1],
    index: 1,
    node: { type: 'element', tag: 'li' /* ... */ }
  }
];
```

**주요 개념**

- `path`: 대상 노드의 위치. 컨테이너에서 시작해 몇 번째 자식인지를 순서대로 기록한 배열
- Diff: 이전 VNode와 새 VNode를 비교해 패치 목록만 생성
- Patch: 패치 목록을 받아 실제 DOM을 수정

**핵심 구분**

- Diff는 패치 목록을 만들기만 하며 실제 DOM에 접근하지 않음
- 실제 DOM 변경은 Patch에서만 수행

### update()

②~⑤의 업데이트 과정을 실행하는 코드.

파일 위치: `src/component/FunctionComponent.js`

```js
const nextVNode = this.render(); // 1. 새 VNode 생성

applyPatches(
  this.container,
  diff(this.vnode, nextVNode)
); // 2. Diff 결과를 실제 DOM에 반영

bindEvents(
  this.container.firstChild,
  nextVNode
); // 3. 최신 이벤트 핸들러 연결

this.vnode = nextVNode; // 4. 새 VNode 보관

this.runEffects(); // 5. Effect 실행
```

| 줄 | 단계 | 하는 일 |
| --- | --- | --- |
| 1 | ② 리렌더 | 컴포넌트 함수를 다시 실행해 새 VNode 트리 생성 |
| 2 | ③ Diff / ④ Patch | 이전 VNode와 새 VNode를 `diff`로 비교하고, 나온 패치 목록을 `applyPatches`로 실제 DOM에 적용 |
| 3 | ⑤ 이벤트 연결 | VNode의 `events`를 같은 위치의 DOM 요소에 연결 |
| 4 | VNode 갱신 | 새 VNode를 보관. 다음 업데이트에서 이것이 이전 VNode가 됨 |
| 5 | ⑤ Effect 실행 | 실행 조건을 만족하는 Effect 실행. DOM 반영이 끝난 뒤이므로 `localStorage` 저장이 이 시점에 일어남 |

**리렌더 예약은 update() 외부에서 처리**

- `setState`가 `scheduleUpdate()`를 호출해 리렌더 예약
- 여러 번 연속으로 호출하더라도 `update()`는 한 번만 실행되도록 처리
- 실제 업데이트 과정은 `update()`에서 수행

---

## 3. 주요 용어

| 용어 | 뜻 |
| --- | --- |
| 실제 DOM | 브라우저가 관리하는 노드 트리이자 패치 적용 대상 |
| VNode | DOM 구조를 객체로 표현한 가상 노드 |
| 리렌더 | 상태 변경 후 컴포넌트를 다시 실행해 새 VNode 트리를 만드는 과정 |
| Diff | 이전·새 VNode 트리를 비교해 패치 목록을 만드는 순수 함수 |
| 패치 목록 | 차이를 실제 DOM에 반영하기 위한 변경 연산 목록 (`INSERT`, `REMOVE`, `REPLACE`, `SET_DATA`, `UPDATE_ATTRS`) |
| Patch | 패치 목록을 실제 DOM에 적용하는 과정 |
| History | VNode 스냅샷을 저장하고 이전·다음 상태로 이동하는 기능 |
| Hook | 함수 컴포넌트에서 상태 관리, 계산 결과 재사용, 부수 효과 처리 등을 제공하는 함수 |

---

## 4. VNode 구조

### VNode란?

요소·텍스트·주석으로 이루어진 DOM 구조를 객체로 표현한 것.

**기본 구조**

- `type`으로 노드 종류 구분
- 요소 노드: 태그, 속성, 자식 배열 보관
- 텍스트·주석 노드: 문자열 보관
- 이벤트 핸들러: 속성과 분리한 `events` 필드에 보관

### 이벤트 핸들러를 분리하는 이유

- `attrs`에는 DOM의 구조와 속성 정보를 저장
- 이벤트 함수는 `events` 필드에 별도로 저장
- 이벤트 함수는 직렬화 대상에서 제외
- 저장할 DOM 구조 데이터와 실행할 이벤트 함수를 분리

### VNode 예시

자판기 영수증의 한 줄을 VNode로 표현한 예시. 아이템 이름을 나타내는 `<span>`은 생략.

```js
{
  type: 'element',
  tag: 'li',
  attrs: {},
  children: [
    {
      type: 'element',
      tag: 'span',
      attrs: { class: 'plus' },
      // JSX의 +{menu.score}는 텍스트 노드 두 개가 됨
      children: [
        { type: 'text', text: '+' },
        { type: 'text', text: '10' }
      ]
    },
    {
      type: 'element',
      tag: 'button',
      attrs: {
        type: 'button',
        class: 'cancel'
      },
      events: {
        click: () => onRemove(item.entryId)
      }, // 함수는 attrs가 아니라 events에 별도 보관
      children: [
        { type: 'text', text: '취소' }
      ]
    }
  ]
}
```

---

## 5. History

Phase 1 검증 페이지(`/phase1/`)의 뒤로·앞으로 가기 기능.

### 동작 원리

- 함수가 없는 VNode는 순수 데이터이므로 스냅샷으로 그대로 저장 가능
- 이전·다음 기록으로 이동할 때 실제 DOM을 다시 VNode로 읽음
- 현재 VNode와 목표 스냅샷을 비교해 차이를 계산
- 계산한 패치를 실제 DOM에 반영
- 과거 기록에서 새로운 변경 사항을 저장하면 이후 기록은 삭제하고 새 기록 추가

**핵심**

VNode를 데이터 형태로 보관하기 때문에 화면 상태를 스냅샷으로 저장하고 다시 복원할 수 있음.

---

## 6. Hook의 역할

| Hook | 역할 | 자판기에서 |
| --- | --- | --- |
| `useState` | 리렌더 사이에 값을 기억하고, 값이 바뀌면 리렌더 예약 | 선택 목록, 영업 상태 |
| `useMemo` | 의존성이 그대로면 이전 계산 결과 재사용 | 선택 목록이 같으면 점수 계산 생략 |
| `useEffect` | DOM 반영이 끝난 뒤 실행. 의존성이 그대로면 실행 생략 | 첫 렌더와 선택 목록이 바뀐 렌더에서 저장 |

### 예시 1. 영업 상태 전환

화면 아래의 렌더 횟수와 점수 계산 횟수를 통해 확인.

**동작 원리**

- 영업 상태는 선택 목록과 별개의 State
- 영업 상태를 전환하면 컴포넌트가 재실행되어 렌더 횟수 1 증가
- 선택 목록은 이전 렌더와 동일하므로 점수 계산 횟수는 유지
- `useMemo`가 이전 계산 결과를 재사용하기 때문

```js
const score = useMemo(
  () => calculateScore(items),
  [items]
);
```

### 예시 2. 새로고침 후 선택 내역 유지

**새로고침 시 변화**

| 항목 | 새로고침 후 |
| --- | --- |
| 렌더 횟수 | 1부터 다시 시작 |
| 영업 상태 | 초깃값으로 복귀 |
| 선택 내역 | 기존 내역 유지 |

**저장 과정**

- 선택 목록이 바뀐 렌더의 DOM 반영 뒤 `useEffect` 실행
- 선택한 아이템의 ID를 `localStorage`에 저장

**복원 과정**

- 페이지가 처음 실행될 때 `useState`의 초기화 함수가 저장된 값을 읽음
- 읽어온 값을 초기 상태로 사용

```js
const [items, setItems] = useState(loadItems);

useEffect(() => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(items.map((item) => item.menuId))
  );
}, [items]);
```

- `loadItems`는 첫 렌더에서만 실행되는 초기화 함수
- `useEffect`는 `items`가 변경될 때마다 저장 작업 수행

---

## 7. 이벤트 처리 설계

### 기존 방식의 문제점

초기 앱 코드에서는 `useEffect`를 사용해 버튼을 탐색하고 이벤트 리스너를 직접 연결했음.

- 요소 탐색 코드 반복
- 이벤트 연결 및 정리 코드 반복
- 앱마다 이벤트 연결 코드를 작성해야 하는 문제

### 검토한 방식

| 방식 | 장점 | 단점 | 채택 |
| --- | --- | --- | --- |
| 앱의 `useEffect`에서 `bindEvents` 호출 | 이벤트 연결을 공통 함수로 통합 | 앱별 호출 부담 및 호출 누락 가능성 | 미채택 |
| 루트 이벤트 위임 | 루트에 리스너 집중 | 대상 탐색 및 버블링하지 않는 이벤트 처리의 복잡성 | 미채택 |
| 요소별 리스너 유지 및 핸들러 교체 | 고정 리스너를 통해 최신 핸들러 호출 | 검토한 설계 기준으로 이벤트용 패치 연산 및 명세 수정 필요 | 미채택 |
| 렌더 후 컴포넌트 계층에서 DOM 이벤트 속성에 핸들러 대입 | 앱의 요소 탐색·이벤트 연결·정리 코드 반복 제거 | 매 렌더마다 노드 순회 및 핸들러 재대입 | 채택 |

### 최종 선택

렌더 후 컴포넌트 계층에서 VNode와 실제 DOM을 함께 순회하는 방식.

**구현 방법**

1. VNode와 실제 DOM을 같은 위치끼리 순회
2. 각 DOM 요소의 이벤트 속성에 최신 핸들러 대입
3. 앱에서는 이벤트 핸들러만 선언
4. mini-react에서 실제 이벤트 연결 담당

**선택 이유**

- 구현이 단순함
- 기존 Diff·Patch 구조를 확장할 필요가 없음
- 이벤트 연결을 위한 별도의 패치 연산 및 명세 수정이 불필요함

---

## 8. JSX 도입

### 도입 배경

초기 앱에서는 VNode 객체를 직접 작성했음.

- DOM 구조가 복잡해질수록 객체와 자식 배열의 중첩 증가
- 중첩 구조로 인해 가독성 저하
- 화면 구조를 수정하기 어려움

### 검토 및 선택

- 객체 생성을 줄이는 헬퍼 함수 검토
- DOM 구조를 더 직관적으로 표현하기 위해 JSX 도입

### 같은 버튼을 두 방식으로 작성한 비교

**1. VNode 객체 직접 작성**

```js
{
  type: 'element',
  tag: 'button',
  attrs: {
    type: 'button',
    class: 'cancel'
  },
  events: {
    click: () => onRemove(item.entryId)
  },
  children: [
    { type: 'text', text: '취소' }
  ]
}
```

**2. JSX 사용**

```jsx
<button
  type="button"
  className="cancel"
  onClick={() => onRemove(item.entryId)}
>
  취소
</button>
```

### JSX 변환 과정

**1. 작성한 JSX**

```jsx
<button className="cancel" onClick={handleRemove}>
  취소
</button>
```

**2. Vite가 변환한 결과**

React.createElement가 아니라 우리가 구현한 `h()` 호출로 변환됨.

```js
h(
  'button',
  {
    className: 'cancel',
    onClick: handleRemove
  },
  '취소'
);
```

**3. h() 실행 후 생성되는 VNode**

```js
{
  type: 'element',
  tag: 'button',
  attrs: {
    class: 'cancel'
  }, // className → class
  events: {
    click: handleRemove
  }, // onClick → events.click
  children: [
    { type: 'text', text: '취소' }
  ] // 문자열 → 텍스트 노드
}
```

### JSX 적용 방식

- Vite 설정에서 JSX 변환 대상을 `h`로 지정 (`demo/vite.config.js`)
- JSX는 `h()` 호출 형태로 변환되고, `h()`가 VNode 객체 생성
- 결과는 직접 작성한 VNode 객체와 같은 구조이므로 Diff·Patch는 JSX 사용 여부와 관계없이 동일하게 동작

**적용 범위**

- 데모 앱의 `.jsx` 파일에서만 JSX 사용
- React 런타임 미사용 (React를 import하지 않음)
- 핵심 구현인 `src/`는 JSX 없이 작성
- 별도의 JSX 변환 없이 브라우저의 ES Modules로 동작

---

## 9. 한계와 실제 React와의 차이점

| 항목 | mini-react | 실제 React |
| --- | --- | --- |
| 리스트 비교 | 인덱스 순서로 1:1 비교. 맨 앞에 삽입하면 뒤 항목이 모두 변경된 것으로 판정 | `key`를 통해 이동을 인식하고 기존 DOM 재사용 |
| useEffect 실행 시점 | DOM 반영 직후 동기 실행. `useLayoutEffect`에 가까운 방식 | 브라우저가 화면을 그린 뒤 실행 |
| 이벤트 | DOM 이벤트 속성에 핸들러 직접 대입 | 루트에서 이벤트 위임과 합성 이벤트로 처리 |

**정리**

mini-react는 React의 모든 기능을 구현하는 것이 아니라, VNode·Diff·Patch·상태 관리·Effect 등 핵심 동작을 직접 구현하면서 동작 원리를 이해하는 데 목적이 있음.

---

## 10. 개발 및 검증 과정

### AI 활용

1. LMS 키워드를 바탕으로 개념 학습
2. AI 설명과 질의응답을 통해 이해 보완
3. 요구사항을 정리한 뒤 구현 대안 비교
4. 모듈별 구현 진행
5. 모델 A로 각각 구현한 결과물을 모델 B로 병합
6. 코드 독해 과정에서 이해되지 않는 문법·로직·설계 의도 질문

### 검증 활동

- 테스트 코드를 먼저 작성하는 방식으로 기능 동작 확인
- 데모를 직접 사용하면서 실제 동작 검증
- 데모 사용 중 export 누락 및 이벤트 미연결 문제 발견
- 모델 B의 병합은 구현 결과를 통합하는 단계로 구분

**검증 관련 참고 사항**

- 병합 과정에서 어떤 검증을 진행했는지에 대한 내용은 불명확
- 별도의 2차 검증 여부는 확인되지 않음

---

## 11. 핵심 정리

이번 프로젝트에서 직접 구현하고 이해한 핵심 개념.

| 구분 | 핵심 내용 |
| --- | --- |
| VNode | 실제 DOM 구조를 객체로 표현 |
| Diff | 이전 VNode와 새 VNode의 차이 계산 |
| Patch | 변경 사항만 실제 DOM에 반영 |
| History | VNode 스냅샷을 활용한 이전·다음 상태 복원 |
| useState | 상태를 기억하고 변경 시 리렌더 예약 |
| useMemo | 의존성이 바뀌지 않으면 이전 계산 결과 재사용 |
| useEffect | DOM 반영 이후 부수 효과 실행 |
| 이벤트 처리 | 컴포넌트 계층에서 VNode와 DOM을 순회하며 이벤트 연결 |
| JSX | 화면 구조를 직관적으로 작성하고 h() 호출로 변환 |

**프로젝트의 핵심 흐름**

상태 변경 → 컴포넌트 재실행 → 새 VNode 생성 → Diff → Patch → 이벤트 연결 → Effect 실행
