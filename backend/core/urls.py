from django.urls import path
from . import views

urlpatterns = [
    path("api/process-audio/", views.process_audio, name="process_audio"),
]
