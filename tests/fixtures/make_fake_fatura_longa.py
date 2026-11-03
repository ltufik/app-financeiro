# Builds a long fictitious card bill (5 pages, 250 purchases, no real data): the app must read it in parts.
import sys
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
out = sys.argv[1]
c = canvas.Canvas(out, pagesize=A4)
lojas = ['Padaria Pao Quente', 'Posto Avenida', 'Mercado Bom Preco', 'Farmacia Saude', 'Restaurante Sabor', 'Livraria Centro', 'Loja de Roupas Moda', 'Pet Shop Amigo', 'Cinema Shopping', 'Lanchonete Rapida']
n = 0
for page in range(5):
    y = 800
    def line(t, size=9):
        global y
        c.setFont('Helvetica', size); c.drawString(40, y, t); y -= 15
    if page == 0:
        line('Banco Ficticio S.A. - Fatura do cartao de credito final 7777', 13)
        line('Vencimento: 10/12/2026     Total desta fatura: R$ 18.750,00')
    for i in range(50):
        n += 1
        line(f'{(n % 28) + 1:02d}/11   {lojas[n % 10]} compra numero {n:03d} referente ao mes   R$ {50 + (n % 3) * 25:.2f}'.replace('.', ','))
    c.showPage()
c.save()
