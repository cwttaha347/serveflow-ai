from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.units import cm
from io import BytesIO
from django.utils import timezone

from .branding import LOGO_PATH


def _invoice_logo_flowable():
    if not LOGO_PATH.is_file():
        return None
    try:
        img = Image(str(LOGO_PATH), width=3.2 * cm, height=1.1 * cm, kind="proportional")
        img.hAlign = "LEFT"
        return img
    except Exception:
        return None


def generate_invoice_pdf(invoice):
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    
    # Custom Styles
    styles.add(ParagraphStyle(name='InvoiceTitle', fontSize=24, fontWeight='bold', textColor=colors.HexColor("#2563eb"), spaceAfter=12))
    styles.add(ParagraphStyle(name='SectionLabel', fontSize=10, textColor=colors.grey, textTransform='uppercase', spaceAfter=4))
    styles.add(ParagraphStyle(name='Value', fontSize=12, fontWeight='bold', spaceAfter=12))

    elements = []

    logo = _invoice_logo_flowable()
    if logo:
        elements.append(logo)
        elements.append(Spacer(1, 0.4 * cm))

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

    from .invoice_utils import populate_invoice_addresses
    populate_invoice_addresses(invoice)

    customer = invoice.job.request.user
    provider_user = invoice.job.provider.user
    customer_lines = f"<b>{customer.get_full_name() or customer.username}</b>"
    if invoice.customer_address:
        customer_lines += f"<br/>{invoice.customer_address}"
    else:
        customer_lines += f"<br/>Customer ID: {customer.id}"
    provider_lines = f"<b>{provider_user.get_full_name() or provider_user.username}</b>"
    if invoice.provider_address:
        provider_lines += f"<br/>{invoice.provider_address}"
    else:
        provider_lines += f"<br/>Category: {getattr(invoice.job.request.category, 'name', 'General')}"

    billing_data = [
        [Paragraph("BILLED TO", styles['SectionLabel']), Paragraph("SERVICE PROVIDER", styles['SectionLabel'])],
        [Paragraph(customer_lines, styles['Normal']), Paragraph(provider_lines, styles['Normal'])]
    ]
    billing_table = Table(billing_data, colWidths=[8*cm, 8*cm])
    elements.append(billing_table)
    if invoice.service_address:
        elements.append(Spacer(1, 0.4*cm))
        elements.append(Paragraph(
            f"<b>Service location:</b> {invoice.service_address}",
            styles['Normal'],
        ))
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
    tax_pct = float(getattr(settings, 'tax_percentage', 0) or 0)
    tax_label = f"Tax ({tax_pct:g}%)" if tax_pct else "Tax"
    totals_data = [
        ["Subtotal", f"{currency}{invoice.subtotal:.2f}"],
        [tax_label, f"{currency}{float(invoice.tax or 0):.2f}"],
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
