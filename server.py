"""개발용 정적 서버 + 탄막 에디터 저장 API."""

from __future__ import annotations

import functools
import http.server
import json
import re
from pathlib import Path
from urllib.parse import unquote, urlparse

from tools.build_barrage_patterns import build as build_barrage_patterns


PORT = 8321
ROOT = Path(__file__).resolve().parent
PATTERN_DIR = ROOT / "data" / "barrage-patterns"
PATTERN_ID = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
PATTERN_TYPES = {"fan", "ring", "spiral", "rain", "wall", "laser"}


def validate_pattern(data: object) -> list[str]:
    if not isinstance(data, dict):
        return ["패턴 데이터가 객체가 아닙니다."]
    errors: list[str] = []
    pattern_id = data.get("id")
    if not isinstance(pattern_id, str) or not PATTERN_ID.fullmatch(pattern_id):
        errors.append("id는 영문 소문자·숫자·하이픈만 사용할 수 있습니다.")
    if data.get("version", 1) != 1:
        errors.append("지원하지 않는 version입니다.")
    duration = data.get("duration")
    if not isinstance(duration, (int, float)) or isinstance(duration, bool) or not 0 < duration <= 120:
        errors.append("duration은 0초 초과 120초 이하여야 합니다.")
    emitters = data.get("emitters")
    if not isinstance(emitters, list):
        errors.append("emitters 배열이 필요합니다.")
        return errors
    if len(emitters) > 32:
        errors.append("발사기는 최대 32개입니다.")
    seen: set[str] = set()
    for index, emitter in enumerate(emitters):
        if not isinstance(emitter, dict):
            errors.append(f"emitters[{index}]가 객체가 아닙니다.")
            continue
        emitter_id = emitter.get("id")
        if not isinstance(emitter_id, str) or not PATTERN_ID.fullmatch(emitter_id):
            errors.append(f"emitters[{index}].id가 올바르지 않습니다.")
        elif emitter_id in seen:
            errors.append(f"발사기 id '{emitter_id}'가 중복됩니다.")
        seen.add(emitter_id)
        if emitter.get("type") not in PATTERN_TYPES:
            errors.append(f"emitters[{index}].type이 올바르지 않습니다.")
        interval = emitter.get("interval")
        if not isinstance(interval, (int, float)) or isinstance(interval, bool) or interval < 0.03:
            errors.append(f"emitters[{index}].interval은 0.03초 이상이어야 합니다.")
        start, end = emitter.get("start"), emitter.get("end")
        if not all(isinstance(value, (int, float)) and not isinstance(value, bool) for value in (start, end)):
            errors.append(f"emitters[{index}]의 시작/끝 시간이 필요합니다.")
        elif start < 0 or end < start or end > duration:
            errors.append(f"emitters[{index}]의 시작/끝 시간이 패턴 범위를 벗어납니다.")
    return errors


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    server_version = "PixelWaveDev/1.0"

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Expires", "0")
        super().end_headers()

    def _json(self, status: int, payload: object) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _pattern_id(self) -> str | None:
        path = unquote(urlparse(self.path).path)
        prefix = "/api/barrage-patterns/"
        if not path.startswith(prefix):
            return None
        value = path[len(prefix):]
        return value if PATTERN_ID.fullmatch(value) else None

    def do_GET(self):  # noqa: N802 — 표준 라이브러리 훅 이름
        path = urlparse(self.path).path
        if path == "/api/barrage-patterns":
            items = []
            PATTERN_DIR.mkdir(parents=True, exist_ok=True)
            for file_path in sorted(PATTERN_DIR.glob("*.json")):
                try:
                    data = json.loads(file_path.read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError):
                    continue
                items.append({
                    "id": data.get("id"),
                    "name": data.get("name"),
                    "description": data.get("description", ""),
                    "duration": data.get("duration"),
                    "emitterCount": len(data.get("emitters", [])),
                })
            self._json(200, {"patterns": items})
            return
        pattern_id = self._pattern_id()
        if pattern_id:
            file_path = PATTERN_DIR / f"{pattern_id}.json"
            if not file_path.is_file():
                self._json(404, {"error": "패턴을 찾을 수 없습니다."})
                return
            try:
                self._json(200, json.loads(file_path.read_text(encoding="utf-8")))
            except (OSError, json.JSONDecodeError) as error:
                self._json(500, {"error": str(error)})
            return
        super().do_GET()

    def do_POST(self):  # noqa: N802 — 표준 라이브러리 훅 이름
        pattern_id = self._pattern_id()
        if not pattern_id:
            self._json(404, {"error": "저장 경로가 올바르지 않습니다."})
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            size = 0
        if size <= 0 or size > 1_000_000:
            self._json(413, {"error": "요청 본문은 1MB 이하여야 합니다."})
            return
        try:
            data = json.loads(self.rfile.read(size))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._json(400, {"error": "JSON을 읽을 수 없습니다."})
            return
        if not isinstance(data, dict):
            self._json(400, {"error": "패턴 데이터가 객체가 아닙니다."})
            return
        if data.get("id") != pattern_id:
            self._json(400, {"error": "URL과 데이터의 패턴 id가 다릅니다."})
            return
        errors = validate_pattern(data)
        if errors:
            self._json(400, {"error": "패턴 검증에 실패했습니다.", "details": errors})
            return

        PATTERN_DIR.mkdir(parents=True, exist_ok=True)
        target = PATTERN_DIR / f"{pattern_id}.json"
        temporary = target.with_suffix(".json.tmp")
        previous = target.read_bytes() if target.exists() else None
        try:
            temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            temporary.replace(target)
            build_barrage_patterns()
        except (OSError, ValueError, json.JSONDecodeError) as error:
            if previous is None:
                target.unlink(missing_ok=True)
            else:
                target.write_bytes(previous)
            temporary.unlink(missing_ok=True)
            self._json(500, {"error": f"저장하지 못했습니다: {error}"})
            return
        self._json(200, {"ok": True, "id": pattern_id, "path": f"data/barrage-patterns/{pattern_id}.json"})


def main() -> None:
    handler = functools.partial(NoCacheHandler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(("", PORT), handler) as httpd:
        print(f"dev server on http://localhost:{PORT}")
        print(f"barrage editor on http://localhost:{PORT}/tools/barrage-editor.html")
        print(f"stage sequencer on http://localhost:{PORT}/tools/stage-sequencer.html")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
