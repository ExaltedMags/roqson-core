#!/usr/bin/env python3
"""Extract Client/Server Scripts from a Frappe SQL backup.

Outputs:
- JSON inventories for all scripts and enabled/active subsets
- individual script files for quick review and migration
- a Markdown summary with counts and key doctypes
"""

from __future__ import annotations

import argparse
import gzip
import json
import re
from collections import Counter, defaultdict
from pathlib import Path


TABLES = ("tabClient Script", "tabServer Script")


def read_backup_text(path: Path) -> str:
    data = path.read_bytes()
    if path.suffix == ".gz":
        data = gzip.decompress(data)
    return data.decode("utf-8", errors="replace")


def extract_create_columns(text: str, table: str) -> list[str]:
    marker = f"CREATE TABLE `{table}` ("
    start = text.find(marker)
    if start == -1:
        raise ValueError(f"Could not find schema for {table}")
    start += len(marker)
    end = text.find("\n) ", start)
    if end == -1:
        raise ValueError(f"Could not find end of schema for {table}")
    schema = text[start:end]

    columns: list[str] = []
    for line in schema.splitlines():
        line = line.strip()
        if not line.startswith("`"):
            continue
        match = re.match(r"`([^`]+)`", line)
        if match:
            columns.append(match.group(1))
    if not columns:
        raise ValueError(f"No columns parsed for {table}")
    return columns


def extract_insert_values_blob(text: str, table: str) -> str:
    marker = f"INSERT INTO `{table}` VALUES "
    start = text.find(marker)
    if start == -1:
        raise ValueError(f"Could not find INSERT data for {table}")
    start += len(marker)
    end = text.find(";\n", start)
    if end == -1:
        end = text.find(";", start)
    if end == -1:
        raise ValueError(f"Could not find end of INSERT data for {table}")
    return text[start:end]


def _unescape_sql_string(value: str) -> str:
    out: list[str] = []
    i = 0
    while i < len(value):
        ch = value[i]
        if ch == "\\" and i + 1 < len(value):
            nxt = value[i + 1]
            mapping = {
                "0": "\0",
                "b": "\b",
                "n": "\n",
                "r": "\r",
                "t": "\t",
                "Z": "\x1a",
                "\\": "\\",
                "'": "'",
                '"': '"',
            }
            out.append(mapping.get(nxt, nxt))
            i += 2
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def iter_rows(values_blob: str) -> list[list[str | None]]:
    rows: list[list[str | None]] = []
    i = 0
    n = len(values_blob)

    while i < n:
        while i < n and values_blob[i] not in "();":
            i += 1
        if i >= n or values_blob[i] == ";":
            break
        if values_blob[i] != "(":
            i += 1
            continue
        i += 1

        row: list[str | None] = []
        while i < n:
            while i < n and values_blob[i] in "\n\r\t ":
                i += 1
            if i >= n:
                break
            ch = values_blob[i]

            if ch == ")":
                rows.append(row)
                i += 1
                break

            if ch == "'":
                i += 1
                token_chars: list[str] = []
                while i < n:
                    ch = values_blob[i]
                    if ch == "\\" and i + 1 < n:
                        token_chars.append(ch)
                        token_chars.append(values_blob[i + 1])
                        i += 2
                        continue
                    if ch == "'":
                        if i + 1 < n and values_blob[i + 1] == "'":
                            token_chars.append("'")
                            i += 2
                            continue
                        i += 1
                        break
                    token_chars.append(ch)
                    i += 1
                row.append(_unescape_sql_string("".join(token_chars)))
            else:
                token_chars: list[str] = []
                while i < n and values_blob[i] not in ",)":
                    token_chars.append(values_blob[i])
                    i += 1
                token = "".join(token_chars).strip()
                row.append(None if token == "NULL" else token)

            while i < n and values_blob[i] in ",\n\r\t ":
                i += 1

    return rows


def rows_to_docs(columns: list[str], rows: list[list[str | None]]) -> list[dict[str, str | None]]:
    docs: list[dict[str, str | None]] = []
    for row in rows:
        if len(row) != len(columns):
            # Keep parsing resilient by trimming/padding rather than crashing.
            if len(row) < len(columns):
                row = row + [None] * (len(columns) - len(row))
            else:
                row = row[: len(columns)]
        docs.append(dict(zip(columns, row)))
    return docs


def script_filename(name: str, suffix: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._")
    return f"{safe or 'script'}.{suffix}"


def as_int(value: str | None, default: int = 0) -> int:
    if value is None or value == "":
        return default
    try:
        return int(value)
    except ValueError:
        return default


def export_script_files(
    docs: list[dict[str, str | None]],
    out_dir: Path,
    script_key: str,
    doctype_key: str,
    active_key: str,
    active_when: int,
    suffix: str,
) -> list[dict[str, str | None]]:
    exported: list[dict[str, str | None]] = []
    out_dir.mkdir(parents=True, exist_ok=True)

    for doc in docs:
        status = as_int(doc.get(active_key))
        if status != active_when:
            continue
        doctype = (doc.get(doctype_key) or "Unknown").replace("/", "_")
        target_dir = out_dir / re.sub(r"[^A-Za-z0-9._-]+", "_", doctype)
        target_dir.mkdir(parents=True, exist_ok=True)
        path = target_dir / script_filename(doc.get("name") or "script", suffix)
        path.write_text(doc.get(script_key) or "", encoding="utf-8")
        exported.append(
            {
                "name": doc.get("name"),
                "doctype": doc.get(doctype_key),
                "path": str(path),
            }
        )
    return exported


def summarize_doctypes(
    client_docs: list[dict[str, str | None]],
    server_docs: list[dict[str, str | None]],
) -> str:
    client_counts = Counter((doc.get("dt") or "Unknown") for doc in client_docs if as_int(doc.get("enabled")) == 1)
    server_counts = Counter((doc.get("reference_doctype") or "Unknown") for doc in server_docs if as_int(doc.get("disabled")) == 0)

    lines = ["## Enabled Script Counts By DocType", "", "| DocType | Client | Server |", "|---|---:|---:|"]
    all_doctypes = sorted(set(client_counts) | set(server_counts))
    for doctype in all_doctypes:
        lines.append(f"| {doctype} | {client_counts.get(doctype, 0)} | {server_counts.get(doctype, 0)} |")
    return "\n".join(lines)


def build_summary(
    backup_path: Path,
    client_docs: list[dict[str, str | None]],
    server_docs: list[dict[str, str | None]],
) -> str:
    enabled_clients = [doc for doc in client_docs if as_int(doc.get("enabled")) == 1]
    active_servers = [doc for doc in server_docs if as_int(doc.get("disabled")) == 0]

    focus = ("Order Form", "Trips")
    lines = [
        "# Backup Script Recovery Summary",
        "",
        f"Backup: `{backup_path}`",
        "",
        f"- Client Scripts in backup: {len(client_docs)}",
        f"- Enabled Client Scripts in backup: {len(enabled_clients)}",
        f"- Server Scripts in backup: {len(server_docs)}",
        f"- Active Server Scripts in backup: {len(active_servers)}",
        "",
    ]

    for doctype in focus:
        lines.extend(
            [
                f"## {doctype}",
                "",
                "### Client Scripts",
            ]
        )
        matching_clients = [doc for doc in client_docs if doc.get("dt") == doctype]
        if not matching_clients:
            lines.append("- None")
        else:
            for doc in sorted(matching_clients, key=lambda d: (as_int(d.get("enabled")) * -1, d.get("name") or "")):
                state = "enabled" if as_int(doc.get("enabled")) == 1 else "disabled"
                lines.append(f"- `{doc.get('name')}`: {state} (modified {doc.get('modified')})")

        lines.extend(["", "### Server Scripts"])
        matching_servers = [doc for doc in server_docs if doc.get("reference_doctype") == doctype]
        if not matching_servers:
            lines.append("- None")
        else:
            for doc in sorted(matching_servers, key=lambda d: (as_int(d.get("disabled")), d.get("name") or "")):
                state = "active" if as_int(doc.get("disabled")) == 0 else "disabled"
                lines.append(
                    f"- `{doc.get('name')}`: {state} [{doc.get('script_type')}] (modified {doc.get('modified')})"
                )
        lines.append("")

    lines.append(summarize_doctypes(client_docs, server_docs))
    return "\n".join(lines).rstrip() + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("backup_path", type=Path)
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=Path("agent_reports/backup_script_recovery"),
    )
    args = parser.parse_args()

    text = read_backup_text(args.backup_path)
    args.out_dir.mkdir(parents=True, exist_ok=True)

    client_columns = extract_create_columns(text, "tabClient Script")
    server_columns = extract_create_columns(text, "tabServer Script")

    client_docs = rows_to_docs(client_columns, iter_rows(extract_insert_values_blob(text, "tabClient Script")))
    server_docs = rows_to_docs(server_columns, iter_rows(extract_insert_values_blob(text, "tabServer Script")))

    enabled_client_docs = [doc for doc in client_docs if as_int(doc.get("enabled")) == 1]
    active_server_docs = [doc for doc in server_docs if as_int(doc.get("disabled")) == 0]

    (args.out_dir / "all_client_scripts.json").write_text(json.dumps(client_docs, indent=2), encoding="utf-8")
    (args.out_dir / "enabled_client_scripts.json").write_text(
        json.dumps(enabled_client_docs, indent=2), encoding="utf-8"
    )
    (args.out_dir / "all_server_scripts.json").write_text(json.dumps(server_docs, indent=2), encoding="utf-8")
    (args.out_dir / "active_server_scripts.json").write_text(
        json.dumps(active_server_docs, indent=2), encoding="utf-8"
    )

    export_script_files(
        client_docs,
        args.out_dir / "client_script_files",
        script_key="script",
        doctype_key="dt",
        active_key="enabled",
        active_when=1,
        suffix="js",
    )
    export_script_files(
        server_docs,
        args.out_dir / "server_script_files",
        script_key="script",
        doctype_key="reference_doctype",
        active_key="disabled",
        active_when=0,
        suffix="py",
    )

    summary = build_summary(args.backup_path, client_docs, server_docs)
    (args.out_dir / "summary.md").write_text(summary, encoding="utf-8")

    print(summary)
    print(f"\nWrote recovery artifacts to: {args.out_dir}")


if __name__ == "__main__":
    main()
