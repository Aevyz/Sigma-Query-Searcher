#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
import re


TITLE_RE = re.compile(r"^title:\s*(.+)$", re.IGNORECASE)
ID_RE = re.compile(r"^id:\s*(.+)$", re.IGNORECASE)
STATUS_RE = re.compile(r"^status:\s*(.+)$", re.IGNORECASE)
LEVEL_RE = re.compile(r"^level:\s*(.+)$", re.IGNORECASE)
LOGSOURCE_RE = re.compile(r"^logsource:\s*$", re.IGNORECASE)
INDENTED_FIELD_RE = re.compile(r"^\s{2,}([A-Za-z0-9_]+):\s*(.+)$")
DATE_RE = re.compile(r"^date:\s*(.+)$", re.IGNORECASE)
MODIFIED_RE = re.compile(r"^modified:\s*(.+)$", re.IGNORECASE)


def strip_inline_comment(value):
    in_quotes = False
    quote_char = ""
    for idx, char in enumerate(value):
        if char in {'"', "'"}:
            if not in_quotes:
                in_quotes = True
                quote_char = char
            elif quote_char == char:
                in_quotes = False
        if char == "#" and not in_quotes:
            return value[:idx].rstrip()
    return value.strip()


def extract_field(pattern, text):
    for line in text.splitlines():
        match = pattern.match(line.strip())
        if match:
            value = match.group(1).strip()
            value = strip_inline_comment(value)
            return value.strip('"').strip("'")
    return ""


def collect_rules(source_dir, exclude_dirs):
    rules = []
    for path in sorted(source_dir.rglob("*")):
        if path.is_dir():
            continue
        if path.suffix.lower() not in {".yml", ".yaml"}:
            continue
        if any(part in exclude_dirs for part in path.parts):
            continue
        try:
            content = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        rule = {
            "path": str(path.relative_to(source_dir)),
            "title": extract_field(TITLE_RE, content),
            "id": extract_field(ID_RE, content),
            "status": extract_field(STATUS_RE, content),
            "level": extract_field(LEVEL_RE, content),
            "date": extract_field(DATE_RE, content),
            "modified": extract_field(MODIFIED_RE, content),
            "logsource": extract_logsource(content),
            "yaml": content,
        }
        rules.append(rule)
    return rules


def extract_logsource(text):
    product = ""
    category = ""
    service = ""
    fields = []
    lines = text.splitlines()
    for idx, line in enumerate(lines):
        if LOGSOURCE_RE.match(line.strip()):
            for next_line in lines[idx + 1 :]:
                if next_line.strip() == "":
                    continue
                if not next_line.startswith("  "):
                    break
                match = INDENTED_FIELD_RE.match(next_line)
                if match:
                    key = match.group(1).strip()
                    value = strip_inline_comment(match.group(2).strip())
                    value = value.strip('"').strip("'")
                    fields.append(f"{key}:{value}")
                    if key == "product":
                        product = value
                    if key == "category":
                        category = value
                    if key == "service":
                        service = value
            break
    return {
        "raw": ", ".join(fields),
        "product": product,
        "category": category,
        "service": service,
    }


def main():
    base_dir = Path(__file__).resolve().parent
    default_source = (base_dir / ".." / "sigma").resolve()
    parser = argparse.ArgumentParser(description="Build a static Sigma rule index.")
    parser.add_argument(
        "--source",
        default=str(default_source),
        help="Path to the local sigma repo.",
    )
    parser.add_argument(
        "--output",
        default=str(base_dir / "data" / "rules.json"),
        help="Output JSON file.",
    )
    parser.add_argument(
        "--exclude",
        action="append",
        default=["regression_data", "tests", ".git", ".github"],
        help="Directory names to exclude (repeatable).",
    )
    args = parser.parse_args()

    source_dir = Path(args.source).resolve()
    if not source_dir.exists():
        raise SystemExit(f"Source directory not found: {source_dir}")

    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    rules = collect_rules(source_dir, set(args.exclude))
    payload = {
        "generated_from": str(source_dir),
        "count": len(rules),
        "rules": rules,
    }

    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=True)

    print(f"Wrote {len(rules)} rules to {output_path}")


if __name__ == "__main__":
    main()
