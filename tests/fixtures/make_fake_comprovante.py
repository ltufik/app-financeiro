# Builds a fictitious Pix receipt (no real data), used by the browser test: a PDF that must become one entry.
import sys
from reportlab.lib.pagesizes import A6
from reportlab.pdfgen import canvas
out = sys.argv[1]
c = canvas.Canvas(out, pagesize=A6)
y = 390
def line(t, size=9):
    global y
    c.setFont('Helvetica', size); c.drawString(20, y, t); y -= 16
line('Comprovante de Pix', 13)
line('Pix enviado em 29/10/2026 as 10:42')
line('Valor: R$ 180,00')
line('Quem recebeu: Joao Encanador')
line('Instituicao: Banco Ficticio S.A.')
line('Quem pagou: Fulano de Tal')
line('Chave Pix: celular')
line('ID da transacao: E00000000202610291042FICTICIO')
c.showPage(); c.save()
