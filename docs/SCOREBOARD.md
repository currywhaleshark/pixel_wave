# 온라인 스코어보드 (총점 랭킹) — Supabase 세팅

클라이언트는 이미 구현되어 있습니다. Supabase 프로젝트를 만들고 **URL·anon 키 두 줄**만 [`js/board.js`](../js/board.js)에 붙여넣으면 켜집니다. 비워두면 랭킹 기능 전체가 숨고 게임은 평소대로 동작합니다.

## 1. 프로젝트 만들기 (약 5분)

1. https://supabase.com → **Start your project** → GitHub 계정으로 가입
2. **New project** — 이름 아무거나(예: `pixel-wave`), Database Password는 생성해서 보관, Region은 **Northeast Asia (Seoul)**
3. 프로젝트가 준비되면(1~2분) 대시보드로 이동

## 2. 테이블·함수 만들기

좌측 **SQL Editor** → **New query** → 아래 전체를 붙여넣고 **Run**:

```sql
-- 랭킹 테이블: 플레이어당 한 줄, 총점은 서버가 계산
create table if not exists public.scoreboard (
  player_id uuid primary key,
  name text not null,
  total integer not null default 0,
  stages jsonb not null default '{}'::jsonb,   -- 해역별 최고 점수 (검증·디버그용)
  updated_at timestamptz not null default now(),
  constraint name_len check (char_length(name) between 1 and 12),
  constraint total_range check (total between 0 and 2100000)
);

-- 읽기는 누구나, 쓰기는 아래 RPC로만
alter table public.scoreboard enable row level security;
create policy "read all" on public.scoreboard for select using (true);

-- 점수 제출: 해역별 점수를 받아 서버가 합산·상한 검증 후 upsert
-- (클라이언트가 보낸 합계를 믿지 않는다. 해역당 상한 30만·stage1~7만 인정)
create or replace function public.submit_score(p_player uuid, p_name text, p_stages jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
  v text;
  sum_total integer := 0;
begin
  if p_player is null then
    raise exception 'bad player';
  end if;
  if p_name is null or char_length(trim(p_name)) < 1 or char_length(trim(p_name)) > 12 then
    raise exception 'bad name';
  end if;

  for k, v in select key, value from jsonb_each_text(p_stages) loop
    if k !~ '^stage[1-7]$' then continue; end if;      -- 해역 키만 인정
    if v !~ '^[0-9]{1,7}$' then continue; end if;       -- 숫자만
    sum_total := sum_total + least(v::integer, 300000); -- 해역당 상한
  end loop;

  insert into scoreboard (player_id, name, total, stages, updated_at)
  values (p_player, trim(p_name), sum_total, p_stages, now())
  on conflict (player_id) do update
    set name = excluded.name,
        total = greatest(scoreboard.total, excluded.total),   -- 총점은 내려가지 않는다
        stages = case when excluded.total >= scoreboard.total
                      then excluded.stages else scoreboard.stages end,
        updated_at = now();
end
$$;

revoke all on function public.submit_score(uuid, text, jsonb) from public;
grant execute on function public.submit_score(uuid, text, jsonb) to anon;
```

"Success. No rows returned" 가 나오면 완료.

## 3. 키 붙여넣기

대시보드 좌측 **Project Settings(톱니) → API**:

- **Project URL** → `BOARD_CFG.url`
- **Project API keys**의 `anon` `public` → `BOARD_CFG.anonKey`

[`js/board.js`](../js/board.js) 맨 위:

```js
const BOARD_CFG = {
  url: 'https://xxxxxxxx.supabase.co',
  anonKey: 'eyJhbGciOi...',
};
```

> anon 키는 **공개용**입니다(그래서 이름이 public). 쓰기는 RPC로만 가능하게 막아뒀으므로 저장소에 커밋해도 됩니다. `service_role` 키는 절대 클라이언트에 넣지 마세요.

## 4. 동작 확인

1. 게임 실행 → 항해도에 **태평양 랭킹 (R)** 버튼이 나타남 (설정 전엔 숨어 있음)
2. 아무 해역이나 클리어 → 랭킹 열기 → 닉네임 정하기 → 내 총점이 보드에 등록
3. 이후에는 **신기록이 나올 때마다 자동 제출**됩니다

## 동작 방식 요약

- **총점 = 해역별 최고 점수 합산.** 클라이언트는 해역별 점수(`Meta.data.best`)를 보내고, 합산·검증은 서버 RPC가 한다.
- 플레이어 식별은 로그인 없이 localStorage의 무작위 UUID. 브라우저를 바꾸면 다른 플레이어로 취급된다(의도된 단순화).
- 치팅 완화: 해역 키 화이트리스트, 해역당 상한 30만, 총점 상한 210만, 총점은 단조증가만. 클라이언트 게임 특성상 완전 차단은 불가능하다 — 취미 규모에 맞는 방어선.
- 서버 미설정·네트워크 실패 시 게임 진행에는 아무 영향 없음 (콘솔 경고만).

## 5. 무료 플랜 비활동 중지와 정기 점검

Supabase 무료 프로젝트는 최근 7일간 DB 활동이 적으면 자동 중지될 수 있다.
이미 중지됐으면 Supabase Dashboard에서 **Resume project**로 복구한다.
정기 조회는 복구 작업을 대신하지 않으며, 비활동 중지를 없애는 공식 방법은 유료 플랜 전환이다.
정책 출처: [Supabase Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing).

### 저장소의 점검 작업

- 워크플로: `.github/workflows/scoreboard-health.yml` — **Scoreboard health check**.
- 한국시간 매일 **03:23 / 09:23 / 15:23 / 21:23** 예약 실행(UTC 기준 6시간 간격).
- GitHub에서 실행하므로 개발 PC나 게임을 켜둘 필요가 없다.
- `js/board.js`의 프로젝트 URL·공개 anon 키를 그대로 읽는다. 별도 Secret이나 관리자 키는 필요 없다.
- `GET /rest/v1/scoreboard?select=total&limit=1`로 실제 테이블을 최대 한 건 조회한다.
  가짜 점수 제출, 수정, 삭제는 하지 않는다. 빈 테이블도 정상 응답이면 성공이다.
- 키·닉네임·플레이어 ID·실제 점수는 로그에 출력하지 않는다. 성공 여부와 HTTP 상태만 남긴다.
- 요청 제한 시간은 15초, 네트워크 오류·429·일시적 서버 오류는 최대 3회 시도한다.
  최종 실패 시 작업이 실패 상태로 끝난다. 401/403은 키·읽기 권한부터 확인한다.
- 저장소 권한은 `contents: read`뿐이며, 포크에서는 원본 DB를 호출하지 않는다.
- 점검 코드·게임 연결 설정이 main에서 변경될 때와 수동 실행 시에도 점검한다.

### 활성화·수동 확인·실패 확인

1. 워크플로를 기본 브랜치 **main**에 반영해야 예약 실행이 시작된다.
2. GitHub → **Actions → Scoreboard health check → Run workflow → main**으로 즉시 확인할 수 있다.
3. 실패 시 같은 화면의 **Read one scoreboard row** 로그를 확인한다.
   필요하면 GitHub 개인 알림 설정에서 Actions 실패 알림을 활성화한다(저장소 코드가 개인 알림을 강제하지는 않는다).
4. 로컬에서는 Node.js 24로 `node tools/check_scoreboard.js`를 실행한다.
   네트워크 없이 점검 로직만 검사하려면 `node tests/test_scoreboard_health.js`를 실행한다.
5. 사용을 중단하려면 Actions의 해당 워크플로 메뉴에서 **Disable workflow**를 선택한다.

**한계:** 충분한 DB 요청은 비활동 중지를 줄일 수 있지만 무료 플랜의 상시 가동을 보장하지 않는다.
GitHub 예약 실행도 지연·누락될 수 있고, 공개 저장소는 **60일간 저장소 활동이 없으면 예약 작업이 자동 중지**될 수 있다.
그 경우 Actions에서 워크플로를 다시 활성화하고 수동 점검한다. 중지 방지용 가짜 커밋은 만들지 않는다.
장기간 관리 없이 운영해야 한다면 Supabase 유료 플랜을 사용한다.
예약 실행 제한: [GitHub schedule 문서](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
