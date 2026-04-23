from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.units import cm
from io import BytesIO
from django.utils import timezone

def generate_invoice_pdf(invoice):
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    
    # Custom Styles
    styles.add(ParagraphStyle(name='InvoiceTitle', fontSize=24, fontWeight='bold', textColor=colors.HexColor("#2563eb"), spaceAfter=12))
    styles.add(ParagraphStyle(name='SectionLabel', fontSize=10, textColor=colors.grey, textTransform='uppercase', spaceAfter=4))
    styles.add(ParagraphStyle(name='Value', fontSize=12, fontWeight='bold', spaceAfter=12))

    elements = []

    # Header
    elements.append(Paragraph("INVOICE", styles['InvoiceTitle']))
    elements.append(Paragraph(f"#{str(invoice.id).zfill(6)}", styles['Normal']))
    elements.append(Spacer(1, 1*cm))

    # Top Info Table
    info_data = [
        [Paragraph("DATE", styles['SectionLabel']), Paragraph("STATUS", styles['SectionLabel'])],
        [Paragraph(invoice.created_at.strftime("%B %d, %Y"), styles['Value']), 
         Paragraph("PAID" if invoice.paid else "PENDING", ParagraphStyle(name='Status', fontSize=12, fontWeight='bold', textColor=colors.green if invoice.paid else colors.orange))]
    ]
    info_table = Table(info_data, colWidths=[8*cm, 8*cm])
    elements.append(info_table)
    elements.append(Spacer(1, 1*cm))

    # Billing Info
    billing_data = [
        [Paragraph("BILLED TO", styles['SectionLabel']), Paragraph("SERVICE PROVIDER", styles['SectionLabel'])],
        [
            Paragraph(f"<b>{invoice.job.request.user.username}</b><br/>Customer ID: {invoice.job.request.user.id}", styles['Normal']),
            Paragraph(f"<b>{invoice.job.provider.user.username}</b><br/>Category: {getattr(invoice.job.request.category, 'name', 'General')}", styles['Normal'])
        ]
    ]
    billing_table = Table(billing_data, colWidths=[8*cm, 8*cm])
    elements.append(billing_table)
    elements.append(Spacer(1, 1.5*cm))

    # Line Items Table
    table_data = [
        [Paragraph("<b>Description</b>", styles['Normal']), Paragraph("<b>Amount</b>", styles['Normal'])]
    ]
    
    # Main Service item
    currency = "$" # Default, will be updated in Phase 4 properly if possible to pass
    # Actually, try to get from SystemSettings
    from .models import SystemSettings
    settings = SystemSettings.get_settings()
    currency = settings.currency_symbol

    table_data.append([
        Paragraph(f"<b>{invoice.job.request.title}</b><br/>{invoice.job.request.description[:100]}...", styles['Normal']),
        Paragraph(f"{currency}{invoice.subtotal:.2f}", styles['Normal'])
    ])

    line_table = Table(table_data, colWidths=[12*cm, 4*cm])
    line_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#f8fafc")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor("#64748b")),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(line_table)
    elements.append(Spacer(1, 1*cm))

    # Totals
    totals_data = [
        ["Subtotal", f"{currency}{invoice.subtotal:.2f}"],
        ["Tax (0%)", f"{currency}0.00"],
        [Paragraph("<b>Total</b>", styles['Normal']), Paragraph(f"<b>{currency}{invoice.total:.2f}</b>", styles['Value'])]
    ]
    totals_table = Table(totals_data, colWidths=[12*cm, 4*cm])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('LINEABOVE', (0, 2), (-1, 2), 1, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0, 2), (-1, 2), 10),
    ]))
    elements.append(totals_table)

    # Footer
    elements.append(Spacer(1, 4*cm))
    elements.append(Paragraph("Thank you for using ServeFlow AI!", ParagraphStyle(name='Footer', alignment=1, textColor=colors.grey)))

    doc.build(elements)
    buffer.seek(0)
    return buffer
