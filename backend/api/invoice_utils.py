"""Invoice helpers: addresses, paid notifications."""
from .models import SystemSettings


def populate_invoice_addresses(invoice):
    """Fill address fields from job request and user profiles when empty."""
    job = getattr(invoice, 'job', None)
    if not job:
        return invoice
    req = getattr(job, 'request', None)
    if not req:
        return invoice

    updates = []
    if not (invoice.service_address or '').strip() and (req.address or '').strip():
        invoice.service_address = req.address.strip()
        updates.append('service_address')

    customer_profile = getattr(req.user, 'profile', None)
    if not (invoice.customer_address or '').strip() and customer_profile:
        addr = (customer_profile.address or '').strip()
        if addr:
            invoice.customer_address = addr
            updates.append('customer_address')

    provider = getattr(job, 'provider', None)
    provider_user = getattr(provider, 'user', None) if provider else None
    provider_profile = getattr(provider_user, 'profile', None) if provider_user else None
    if not (invoice.provider_address or '').strip() and provider_profile:
        addr = (provider_profile.address or '').strip()
        if addr:
            invoice.provider_address = addr
            updates.append('provider_address')

    if updates:
        invoice.save(update_fields=updates)
    return invoice


def on_invoice_paid(invoice):
    """Notify provider (WebSocket + SMTP email) after invoice is marked paid."""
    populate_invoice_addresses(invoice)

    from .notifications import notify_invoice_paid
    from .emails import send_invoice_paid_to_provider

    notify_invoice_paid(invoice)
    try:
        send_invoice_paid_to_provider(invoice)
    except Exception as exc:
        print(f"Invoice paid email failed: {exc}")


def invoice_email_context(invoice):
    """Shared template context for invoice emails and PDFs."""
    settings = SystemSettings.get_settings()
    symbol = (settings.currency_symbol or '$').strip() or '$'
    job = invoice.job
    req = job.request
    customer = req.user
    provider_user = job.provider.user
    populate_invoice_addresses(invoice)

    def fmt(amount):
        try:
            return f"{symbol}{float(amount):.2f}"
        except (TypeError, ValueError):
            return f"{symbol}0.00"

    return {
        'customer_name': customer.get_full_name() or customer.username,
        'provider_name': provider_user.get_full_name() or provider_user.username,
        'job_title': req.title,
        'subtotal': invoice.subtotal,
        'tax': invoice.tax,
        'discount': invoice.discount,
        'total': invoice.total,
        'currency_symbol': symbol,
        'subtotal_display': fmt(invoice.subtotal),
        'tax_display': fmt(invoice.tax),
        'discount_display': fmt(invoice.discount),
        'total_display': fmt(invoice.total),
        'payment_status': 'PAID' if invoice.paid else 'PENDING',
        'invoice_id': invoice.id,
        'invoice_number': f'{invoice.id:06d}',
        'job_id': job.id,
        'customer_address': invoice.customer_address or '',
        'provider_address': invoice.provider_address or '',
        'service_address': invoice.service_address or req.address or '',
        'platform_name': settings.platform_name or 'ServeFlow AI',
    }
