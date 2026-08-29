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
