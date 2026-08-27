# assets

픽셀아트 스프라이트 시트를 여기에 둡니다.

| 파일 | 내용 |
|---|---|
| `sprites.png` | 플레이어·돌고래·잡몹·거북·탄·진주 |
| `bosses.png` | 보스 7종 |

- 규격(좌표·크기·프레임·앵커): [`docs/ART_SPEC.md`](../docs/ART_SPEC.md)
- 코드 쪽 정의: [`js/assets.js`](../js/assets.js)

파일이 없어도 게임은 정상 동작합니다 — 각 엔티티가 임시 도형으로 그려집니다.
그린 항목은 `js/assets.js`에서 `on: true`로 켜야 반영됩니다.
