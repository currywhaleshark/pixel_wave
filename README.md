# 픽셀 파도: 집으로 가는 길 (Pixel Wave: Homebound)

태평양 한가운데서 조개폰 배터리가 3%. 인어는 지도도 없이 별빛 길을 따라 집까지 헤엄쳐 돌아간다.

**횡스크롤 캐주얼 탄막 슈팅** — 픽셀 + 파스텔 바닷속 + 칩튠 감성. 탄막인데 살벌하지 않고 반짝반짝, 죽어도 뽀글, 보스도 화해합니다.

## 플레이

```bash
python server.py
```

브라우저에서 `http://localhost:8321` 접속. (빌드 과정 없음 — 순수 HTML5 Canvas + JS)

보스 탄막을 만들고 즉시 시험하려면 `http://localhost:8321/tools/barrage-editor.html`을 연다.
발사기를 겹쳐 미리 본 뒤 **저장**하면 `data/barrage-patterns/`의 JSON과 게임용 레지스트리가 함께 갱신된다.
같은 주소를 휴대폰으로 열면 기기 자동저장·JSON 공유를 사용하는 모바일 화면으로 바뀐다. 정적 호스팅에서도 서버 없이 제작·미리보기·내보내기가 가능하다.

스테이지 전체 흐름은 `http://localhost:8321/tools/stage-sequencer.html`에서 확인한다.
현재 M1은 Stage 3을 읽기 전용으로 컴파일해 전체·구간 반복 재생, 난이도 전환,
타임라인 클립 검사, Stage JSON 내보내기를 지원한다.

| 입력 | 이동 | 봄 |
|---|---|---|
| 키보드 | 방향키/WASD, Shift 저속 | Space |
| 마우스 | 포인터를 향해 유영 | 클릭 |
| 터치 | 상대 드래그 (떼면 정지) | 화면 버튼 |

샷은 전 입력 공통 자동발사.

항해도: ←→ 해역 선택, Enter로 **출격 준비 창**(난이도·돌고래·봄 선택), S 상점.
창은 이전 선택을 기억하고 마커가 출격 버튼에 붙은 채 열리므로, 바꿀 게 없으면 **Enter 두 번**으로 바로 출격.

`?debug` 를 URL에 붙이면 전 해역·전 난이도 해금 + 치트키(1 파워 · 2 진주 · 3 무적 · 4 보스직행 · 5 페이즈스킵).

## 콘텐츠

- **해역 7 + 엔딩**: 산호 초입 → 해파리 초원 → 거북이 고속도로 → 심해 협곡 → 난파선 묘지 → 폭풍 수면 → 용궁 앞바다
- **보스 7**: 뾰족복어 팡팡 / 등불 여왕 몽실 / 특송 가오리 씽씽 / 심해 아귀 초롱 / 유령 곰치 부우 / 천둥 뱀장어 우르릉 / 폭풍의 근원 휘이 — 각 3페이즈 + 클라이맥스 「대파도」
- **스테이지 기믹**: 거북 택시 탑승, 심해 어둠/광원, 난파선 지형, 유령의 실체↔반투명, 해류, 물속 번개
- **성장**: 돌고래 3종(유도/폭발/관통) × 3레벨, 세이브 섬 상점, 영구 진주 은행 — 기본샷 화력은 못 키우고, 생존 능력과 돌고래 빌드만 팝니다
- **난이도 3단**: 이지 / 노멀 / 하드 — 해역별 해금. 탄 밀도·패턴 진화·체력이 함께 오릅니다

## 구조

```
index.html          진입점
js/config.js        튜닝 수치 · 난이도 테이블 · 픽셀 렌더 규격
js/assets.js        스프라이트 시트/프레임/앵커 정의 (아트 단일 진실 원천)
js/spriteRenderer.js 스프라이트 그리기 (프레임·반전·픽셀 스냅)
js/fonts.js         픽셀 폰트 (고유 크기 배수 스냅 · sans-serif 폴백)
js/audio.js         BGM 크로스페이드 · 효과음 합성 · 볼륨
js/input.js         키보드/마우스/터치 (속도 상한 통일)
js/meta.js          영구 저장 · 상점 카탈로그
js/entities.js      플레이어 · 잡몹 · 진주
js/dolphin.js       옵션 돌고래 3종
js/waves.js         잡몹 문법(5축) + 스테이지 타임라인
js/stage/            Stage JSON 검증·컴파일·결정론 미리보기
js/barrage.js        데이터 기반 탄막 실행기 (게임·탄막 공방 공용)
js/boss*.js         보스 1~7
js/map.js           항해도 · 상점 · 랭킹 UI
js/board.js         온라인 스코어보드 (Supabase — docs/SCOREBOARD.md)
js/main.js          게임 루프 · 충돌 · 렌더
data/barrage-patterns/ 보스 탄막 JSON
tools/barrage-editor.html 보스 탄막 제작·미리보기·저장 도구
tools/stage-sequencer.html 모바일 스테이지 타임라인·구간 미리보기
assets/             스프라이트 시트 (없으면 도형 폴백)
assets/fonts/       갈무리 픽셀 폰트 (OFL-1.1)
assets/bgm/         BGM (없으면 무음)
docs/GDD.md         게임 기획서
docs/ART_SPEC.md    픽셀아트·폰트 제작 규격
docs/AUDIO_SPEC.md  오디오 규격 (BGM 파일 목록 · 효과음)
```

웨이브는 전부 데이터입니다 — `waves.js`의 타임라인 한 줄이 웨이브 하나(`{ t, kind, M, D, F, S, n, ... }`). 잡몹 문법 5축(이동·진입·편대·사격·스펙)의 조합으로 만들어집니다. 자세한 설계는 [docs/GDD.md](docs/GDD.md) 참고.

보스 탄막 데이터의 필드와 다른 보스에 연결하는 방법은 [docs/BARRAGE_EDITOR.md](docs/BARRAGE_EDITOR.md)에 정리되어 있다.

## 상태

**Playable Alpha** — 콘텐츠(해역 7 + 엔딩 + 난이도 3단) 전량 플레이 가능.

렌더는 **480×270 월드를 2배 확대**하는 픽셀아트 규격으로 동작하며(HUD는 960×540 별도 레이어),
스프라이트 파이프라인(`assets.js` + `spriteRenderer.js`)이 준비돼 있습니다.
아직 스프라이트 시트가 없어 각 엔티티는 **임시 캔버스 도형**으로 그려지고,
아트가 완성된 항목부터 `on: true`로 켜면서 하나씩 교체합니다 — [docs/ART_SPEC.md](docs/ART_SPEC.md).

오디오는 레이어가 완성돼 있습니다 — 효과음은 WebAudio로 실시간 합성되어 **지금 바로 들리고**, BGM은 에 파일을 넣으면 자동으로 재생됩니다([docs/AUDIO_SPEC.md](docs/AUDIO_SPEC.md)).
