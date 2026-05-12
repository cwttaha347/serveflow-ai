"""
URL configuration for serveflow project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework.authtoken.views import obtain_auth_token
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse

from django.views.generic import TemplateView
import os

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("api.urls")),
    path("api-token-auth/", obtain_auth_token),
    path("health/", lambda request: JsonResponse({"status": "ok", "service": "backend"})),
]

# Serve uploads BEFORE SPA catch-all — otherwise `<path:path>` matches `/media/...`
# and TemplateView tries to render index.html (500 + TemplateDoesNotExist).
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# React SPA Catch-all (must be last among path() routes)
urlpatterns += [
    path("", TemplateView.as_view(template_name="index.html"), name="index"),
    path("<path:path>", TemplateView.as_view(template_name="index.html")),
]
