# 보스 탄막 공방

코드 안에 타이머와 `ebullets.push()`를 직접 쓰지 않고, 여러 발사기를 조합한 JSON을 만들고 실제 게임과 같은 실행기로 시험하는 개발 도구다.

## 실행

```bash
python server.py
```

브라우저에서 다음 주소를 연다.

```text
http://localhost:8321/tools/barrage-editor.html
```

## 작업 흐름

1. 왼쪽 아래에서 발사기 종류를 골라 추가한다.
2. 오른쪽에서 시간, 탄수, 탄속, 위치, 난이도 증가량을 조절한다.
3. 중앙 화면에서 재생·배속·난이도를 바꾸고 인어와 보스를 드래그해 본다.
4. 발사기를 여러 개 추가해 서로 다른 리듬과 구간을 겹친다.
5. **저장**을 누르면 `data/barrage-patterns/<id>.json`에 기록된다.
6. **게임에서 시험**을 누르면 실제 충돌·이동·난이도 배율을 사용하는 팡팡 시험전이 열린다.

서버 저장과 별개로 JSON 가져오기·내보내기도 지원한다. 저장 API는 개발 서버에서만 열리며, 패턴 ID를 검사해 `data/barrage-patterns/` 밖에는 쓸 수 없다.

## 휴대폰에서 사용

### PC와 같은 와이파이에서 바로 열기

PC에서 `python server.py`를 실행한 뒤 휴대폰 브라우저에서 아래 주소를 연다.

```text
http://<PC의 내부 IP>:8321/tools/barrage-editor.html
```

이 경우 **저장** 한 번으로 휴대폰 브라우저와 PC의 프로젝트 JSON에 함께 저장된다. PC 방화벽이 8321번 포트 연결을 처음 물으면 같은 사설 네트워크에서의 Python 접속을 허용해야 한다.

### 정적 웹사이트로 독립 사용

저장소를 GitHub Pages 같은 HTTPS 정적 호스팅에 공개하면 PC 서버 없이 사용할 수 있다. `tools/barrage-editor.html`과 상대 경로의 `js/`, `assets/`가 함께 배포되면 된다.

- 변경할 때마다 휴대폰 브라우저에 초안 자동저장
- **저장**으로 이 기기의 패턴 목록에 보관
- 다시 열면 마지막 저장본 또는 닫기 전 초안 복구
- 지원되는 모바일 브라우저에서는 **JSON 내보내기**가 공유 시트를 열고, 그렇지 않으면 파일 다운로드
- 최초 접속 뒤 에디터 핵심 파일을 캐시하여 오프라인 재접속 지원
- 홈 화면에 추가하면 독립 앱 형태로 실행

브라우저 데이터를 지우면 기기 저장본도 사라지므로 완성본은 반드시 JSON으로 내보낸다.

### 코덱스에 넘기기

1. 휴대폰에서 **JSON 내보내기**를 누른다.
2. 공유 시트에서 ‘파일에 저장’을 고르거나 다운로드 폴더에 보관한다.
3. 나중에 코덱스 대화에 해당 `.json` 파일을 첨부하고 적용할 보스·페이즈를 말한다.
4. 코덱스가 JSON을 `data/barrage-patterns/`에 넣고 `python tools/build_barrage_patterns.py`를 실행한 뒤 보스 코드에 연결한다.

같은 호스팅 주소에서 **게임에서 시험**을 누르면 서버가 없어도 기기에 저장된 패턴을 실제 게임의 팡팡 1페이즈 시험전에 연결한다.

## 발사기 종류

| 종류 | 용도 | 주요 값 |
|---|---|---|
| 부채꼴 `fan` | 고정 또는 플레이어 조준 사격 | 탄수, 부채 폭, 조준 |
| 원형 링 `ring` | 전방위 링과 회전 링 | 링 탄수, 발사마다 회전 |
| 회전 나선 `spiral` | 지속 회전하는 다중 나선 | 나선 팔, 회전속도 |
| 탄 비 `rain` | 사각 범위의 무작위 낙하 | 한 번의 탄수, X/Y 범위 |
| 틈새 벽 `wall` | 읽고 피하는 커튼 | 전체 칸, 빈 칸, 틈 이동 |

모든 발사기는 다음 공통 시간 문법을 쓴다.

- `start`~`end`: 발사기가 작동하는 구간
- `interval`: 발사 묶음 사이의 간격
- `burstCount`: 한 묶음에서 연사하는 횟수
- `burstGap`: 묶음 안 연사 사이의 간격

`difficultyCount`와 `difficultySpeed`는 난이도 단계마다 더해지는 값이다. 이지는 0회, 노멀은 1회, 하드는 2회 적용된다. 게임 공통 탄속 배율도 그 뒤에 별도로 적용된다.

## 저장 결과

정본은 사람이 읽고 버전 관리하기 쉬운 JSON이다.

```text
data/barrage-patterns/<id>.json
```

저장할 때 개발 서버가 아래 브라우저용 레지스트리도 자동으로 다시 만든다.

```text
js/barragePatterns.generated.js
```

직접 JSON 파일을 추가하거나 수정했다면 수동으로 같은 작업을 할 수 있다.

```bash
python tools/build_barrage_patterns.py
```

같은 `seed`와 같은 입력은 무작위 탄 비까지 동일하게 재생된다. 따라서 밸런스 검토와 버그 재현에 쓸 수 있다.

## 보스 코드에 연결

팡팡 1페이즈(`pangpang-needle-fan`)가 첫 실제 적용 예제다. 다른 보스도 생성자에서 실행기를 만들고, 해당 페이즈의 `update()`에서 갱신하면 된다.

```js
const pattern = BarrageRuntime.get('my-boss-pattern');
this.patternRunner = new BarrageRuntime.Runner(pattern, {
  emit: bullet => game.ebullets.push(bullet),
});

// 보스 update(dt) 안
this.patternRunner.update(dt, {
  source: { x: this.x, y: this.y },
  target: game.player,
  difficulty: game.diff,
});
```

보스별 특수기인 돌진, 낙뢰, 해류, 기뢰 폭발처럼 단순 탄 생성 이상의 규칙은 기존 보스 코드에 남긴다. 공방은 반복 탄 생성과 조합을 데이터화하는 층이며, 보스 행동 전체를 제한하는 스크립트 언어가 아니다.
