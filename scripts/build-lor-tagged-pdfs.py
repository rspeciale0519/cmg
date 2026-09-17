from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

# The third-party imports live inside `build()` on purpose. `--manifest` exports
# the coordinate tables below and nothing else, and the application test that
# checks the manifest against the bundled PDFs must be able to run it on a
# machine that has no PDF toolchain installed.


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "temp" / "docs" / "CMG_Blank-LOR-2026.pdf"
OUTPUT_DIR = ROOT / "temp" / "docs"

TAG_COLOR = (0, 0, 0)
FONT_SIZE = 7


def tag(field_type: str, role: str, field_id: str, width: int = 0) -> str:
    return "{{" + f"{field_type}:{role}:{field_id}{'_' * width}" + "}}"


def system_fields() -> dict[int, list[tuple[float, float, str]]]:
    return {
        1: [
            (103, 550, tag("t", "H1", "ph", 30)),
            (72, 522, tag("t", "H1", "carrier", 15)),
            (358, 522, tag("t", "H1", "policy", 15)),
            (72, 484, tag("t", "H1", "property", 55)),
            (94, 443, tag("t", "H1", "lossdate", 13)),
            (298, 443, tag("t", "H1", "cause", 16)),
            (450, 316, tag("t", "H1", "fee", 5)),
            (464, 55, tag("t", "H1", "d1", 8)),
        ],
        2: [(425, 104, tag("t", "H1", "d2", 8))],
        3: [(455, 145, tag("t", "H1", "d3", 8))],
        4: [(455, 95, tag("t", "H1", "d4", 8))],
        5: [(430, 698, tag("t", "H1", "d5", 8))],
        6: [(430, 677, tag("t", "H1", "d6", 8))],
        7: [(115, 420, tag("t", "H1", "d7", 12))],
        8: [(455, 30, tag("t", "H1", "d8", 8))],
        9: [
            (403, 516, tag("t", "H1", "claimno", 16)),
            (185, 480, tag("t", "H1", "accepted", 14)),
            (416, 480, tag("t", "H1", "adjuster", 13)),
            (177, 441, tag("t", "H1", "phone", 13)),
            (414, 441, tag("t", "H1", "d9a", 8)),
            (128, 403, tag("t", "H1", "email", 20)),
            (125, 366, tag("t", "H1", "d9b", 8)),
            (105, 311, tag("t", "H1", "em", 1)),
            (105, 292, tag("t", "H1", "ne", 1)),
            (105, 273, tag("t", "H1", "su", 1)),
        ],
    }


def signer_fields(dual: bool) -> dict[int, list[tuple[float, float, str]]]:
    fields: dict[int, list[tuple[float, float, str]]] = {
        1: [(176, 55, tag("i", "H1", "i1", 8))],
        2: [(166, 104, tag("i", "H1", "i2", 8))],
        3: [(166, 145, tag("i", "H1", "i3", 8))],
        4: [(176, 95, tag("i", "H1", "i4", 8))],
        5: [(125, 698, tag("s", "H1", "s5", 35))],
        6: [(125, 677, tag("s", "H1", "s6", 35))],
        7: [(145, 486, tag("s", "H1", "s7", 38))],
        8: [(174, 30, tag("i", "H1", "i8", 8))],
        9: [(150, 516, tag("s", "H1", "s9", 28))],
    }
    if not dual:
        return fields

    return {
        1: [
            (176, 55, tag("i", "H1", "i1", 3)),
            (222, 55, tag("i", "H2", "j1", 3)),
        ],
        2: [
            (166, 104, tag("i", "H1", "i2", 3)),
            (212, 104, tag("i", "H2", "j2", 3)),
        ],
        3: [
            (166, 145, tag("i", "H1", "i3", 3)),
            (212, 145, tag("i", "H2", "j3", 3)),
        ],
        4: [
            (176, 95, tag("i", "H1", "i4", 3)),
            (222, 95, tag("i", "H2", "j4", 3)),
        ],
        5: [
            (125, 698, tag("s", "H1", "s5", 16)),
            (245, 698, tag("s", "H2", "t5", 16)),
        ],
        6: [
            (125, 677, tag("s", "H1", "s6", 16)),
            (245, 677, tag("s", "H2", "t6", 16)),
        ],
        7: [
            (145, 486, tag("s", "H1", "s7", 38)),
            (145, 451, tag("s", "H2", "t7", 38)),
        ],
        8: [
            (174, 30, tag("i", "H1", "i8", 3)),
            (220, 30, tag("i", "H2", "j8", 3)),
        ],
        9: [
            (150, 516, tag("s", "H1", "s9", 13)),
            (248, 516, tag("s", "H2", "t9", 13)),
        ],
    }


def prepare_page_background(page_number: int, output_canvas: canvas.Canvas) -> None:
    if page_number != 9:
        return
    output_canvas.setFillColorRGB(1, 1, 1)
    output_canvas.rect(412, 478, 120, 32, fill=1, stroke=0)
    output_canvas.setStrokeColorRGB(0, 0, 0)
    output_canvas.setLineWidth(1)
    output_canvas.line(414, 480, 530, 480)


def build(output: Path, dual: bool) -> None:
    import pypdfium2 as pdfium
    from pypdf import PdfReader
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen import canvas

    reader = PdfReader(str(SOURCE))
    rendered = pdfium.PdfDocument(str(SOURCE))
    systems = system_fields()
    signers = signer_fields(dual)
    output_canvas = canvas.Canvas(str(output))

    for page_number, page in enumerate(reader.pages, start=1):
        width = float(page.mediabox.width)
        height = float(page.mediabox.height)
        output_canvas.setPageSize((width, height))
        image = rendered[page_number - 1].render(scale=150 / 72).to_pil()
        output_canvas.drawImage(
            ImageReader(image),
            0,
            0,
            width=width,
            height=height,
            preserveAspectRatio=False,
        )
        prepare_page_background(page_number, output_canvas)
        output_canvas.setFont("Helvetica", FONT_SIZE)
        output_canvas.setFillColorRGB(*TAG_COLOR)
        for x, y, value in systems.get(page_number, []):
            output_canvas.drawString(x, y, value)
        for x, y, value in signers.get(page_number, []):
            output_canvas.drawString(x, y, value)
        output_canvas.showPage()

    output_canvas.save()


TAG_ID = re.compile(r"\{\{(?P<type>[a-z]):(?P<role>H[12]):(?P<id>[a-z0-9]+)_*\}\}")


def placements(fields: dict[int, list[tuple[float, float, str]]]) -> list[dict[str, object]]:
    """The drawn tags as data: page, baseline, and the exact string drawn."""
    rows: list[dict[str, object]] = []
    for page_number in sorted(fields):
        for x, y, value in fields[page_number]:
            match = TAG_ID.fullmatch(value)
            if match is None:
                raise SystemExit(f"Unreadable tag on page {page_number}: {value}")
            rows.append(
                {
                    "page": page_number,
                    "x": x,
                    "y": y,
                    "id": match.group("id"),
                    "role": match.group("role"),
                    "type": match.group("type"),
                    "tag": value,
                }
            )
    return rows


def manifest() -> dict[str, object]:
    """
    The single source of truth for where each tag sits, exported for
    `src/lib/esign/lor-prefill.ts`.

    `data` holds the tags the application replaces with claim values.
    `signature` holds the initial and signature tags, which must survive
    prefilling verbatim so PandaDoc still detects them on upload.
    """
    system = placements(system_fields())
    return {
        "font": "Helvetica",
        "fontSize": FONT_SIZE,
        "variants": {
            "single": {"data": system, "signature": placements(signer_fields(dual=False))},
            "dual": {"data": system, "signature": placements(signer_fields(dual=True))},
        },
    }


def write_manifest(output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(manifest(), indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--manifest",
        type=Path,
        help="Write the tag coordinate manifest to this path and build no PDF.",
    )
    args = parser.parse_args()

    if args.manifest is not None:
        write_manifest(args.manifest)
        return

    if not SOURCE.exists():
        raise SystemExit(f"Source PDF does not exist: {SOURCE}")
    build(OUTPUT_DIR / "CMG_LOR-2026-PandaDoc-Single.pdf", dual=False)
    build(OUTPUT_DIR / "CMG_LOR-2026-PandaDoc-Dual.pdf", dual=True)


if __name__ == "__main__":
    main()
