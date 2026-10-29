# Builds a fictitious credit card statement from another bank (no real data), used by the browser test.
import sys
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
out = sys.argv[1]
c = canvas.Canvas(out, pagesize=A4)
y = 800
def line(t, size=10):
    global y
    c.setFont('Helvetica', size); c.drawString(50, y, t); y -= 18
line('Nu Pagamentos S.A. - Fatura do cartao de credito', 14)
line('Titular: Fulano de Tal')
line('Vencimento: 15/11/2026     Total desta fatura: R$ 1.234,50')
line('Transacoes de 08/10 a 07/11')
for d, desc, v in [('09/10', 'Padaria Pao Quente', '45,90'), ('12/10', 'Posto Shell Av Brasil', '250,00'), ('15/10', 'iFood *Restaurante Sabor', '89,60'),
                   ('20/10', 'Loja Movel Casa - Parcela 2/6', '400,00'), ('25/10', 'Netflix.com', '55,90'), ('28/10', 'Supermercado Dia', '413,10'), ('30/10', 'Estorno Loja X', '-20,00')]:
    line(f'{d}   {desc:<45} R$ {v}')
line('Total de compras e ajustes: R$ 1.234,50')
c.showPage(); c.save()
