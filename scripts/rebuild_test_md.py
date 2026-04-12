from pathlib import Path
import re


def humanize(name: str) -> str:
    value = re.sub(r"^test_", "", name or "")
    value = value.replace("_", " ").strip()
    return value[:1].upper() + value[1:] if value else ""


def infer_kind(test_id: str) -> str:
    if test_id.startswith("src/__tests__/"):
        if "/lib/" in test_id:
            return "Frontend Unit/API-client"
        if any(key in test_id for key in ["graph-focus", "workspace-panel", "upload.test", "graph.test"]):
            return "Frontend Integration/UI"
        return "Frontend Component"

    low = test_id.split("::")[0].lower()
    if any(
        key in low
        for key in [
            "test_views.py",
            "test_auth_api.py",
            "test_llm_settings.py",
            "test_export.py",
            "test_report_view.py",
            "test_workflow.py",
            "test_project_document_endpoints.py",
            "test_document_review_integrity.py",
            "test_project_extract_incremental.py",
        ]
    ):
        return "Backend Integration/API"
    if any(
        key in low
        for key in [
            "test_pipeline.py",
            "test_report.py",
            "test_smq.py",
            "test_personas.py",
            "test_workplan.py",
            "test_contextual_summary_api.py",
            "test_priority.py",
        ]
    ):
        return "Backend Service/Integration"
    return "Backend Unit"


def infer_description(test_id: str) -> str:
    parts = test_id.split("::")
    test_name = parts[-1]
    file_name = (
        Path(parts[0]).name.replace("test_", "").replace(".py", "").replace(".tsx", "").replace(".ts", "")
    )
    return f"{humanize(test_name)} ({file_name})."


def main() -> None:
    backend = [line.strip() for line in Path("backend-tests.txt").read_text(encoding="utf-8").splitlines() if line.strip()]
    frontend = [
        line.strip() for line in Path("frontend-tests.txt").read_text(encoding="utf-8").splitlines() if line.strip()
    ]
    rows = backend + frontend

    kind_counts: dict[str, int] = {}
    for test_id in rows:
        kind = infer_kind(test_id)
        kind_counts[kind] = kind_counts.get(kind, 0) + 1

    output: list[str] = []
    output += ["# Test Execution and Coverage Inventory", "", "Date: 2026-04-10", "", "## Overview", ""]
    output += ["| Metric | Count |", "|---|---:|"]
    output += [
        f"| Total tests | {len(rows)} |",
        f"| Backend (pytest) | {len(backend)} |",
        f"| Frontend (Jest) | {len(frontend)} |",
        "",
    ]

    output += ["## Test Types", "", "| Type | Count |", "|---|---:|"]
    for kind in sorted(kind_counts):
        output.append(f"| {kind} | {kind_counts[kind]} |")

    output += ["", "## Backend Tests", "", "| # | Test ID | Type | Description |", "|---:|---|---|---|"]
    for index, test_id in enumerate(backend, 1):
        output.append(f"| {index} | {test_id} | {infer_kind(test_id)} | {infer_description(test_id)} |")

    output += ["", "## Frontend Tests", "", "| # | Test ID | Type | Description |", "|---:|---|---|---|"]
    for index, test_id in enumerate(frontend, len(backend) + 1):
        output.append(f"| {index} | {test_id} | {infer_kind(test_id)} | {infer_description(test_id)} |")

    Path("test.md").write_text("\n".join(output) + "\n", encoding="utf-8")
    print(f"Wrote test.md with {len(rows)} tests")


if __name__ == "__main__":
    main()
