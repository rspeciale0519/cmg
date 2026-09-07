from pathlib import Path

from reportlab.pdfgen import canvas


root = Path(__file__).resolve().parents[1]
output = root / "temp" / "docs" / "CMG_PandaDoc-Tag-Probe.pdf"

pdf = canvas.Canvas(str(output), pagesize=(612, 792))
pdf.setFont("Helvetica", 10)
pdf.drawString(72, 700, "PandaDoc field tag format test")
pdf.drawString(72, 650, "[textfield:H1:square________]")
pdf.drawString(72, 600, "{{textfield:H1:curly________}}")
pdf.drawString(72, 550, "[t:H1:short________]")
pdf.drawString(72, 500, "{{t:H1:cshort________}}")
pdf.save()
