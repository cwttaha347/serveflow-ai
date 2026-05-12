from django.db import migrations


def fix_vehicle_category_typo(apps, schema_editor):
    Category = apps.get_model("api", "Category")
    wrong_names = ("Vehicle mantainence", "Vehicle mantenance")
    correct_name = "Vehicle maintenance"
    for wrong in wrong_names:
        row = Category.objects.filter(name=wrong).first()
        if not row:
            continue
        if Category.objects.filter(name=correct_name).exclude(pk=row.pk).exists():
            continue
        row.name = correct_name
        row.save(update_fields=["name"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0021_remove_embedded_sendgrid_credentials"),
    ]

    operations = [
        migrations.RunPython(fix_vehicle_category_typo, noop),
    ]
