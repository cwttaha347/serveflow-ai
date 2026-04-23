import os
import django
from django.core.management import call_command

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'serveflow.settings')
django.setup()

print("=== CREATING SAMPLE DATA ===")
print("Delegating to unified management command: seed_serveflow_v2")
call_command('seed_serveflow_v2')
print("=== SAMPLE DATA READY ===")
