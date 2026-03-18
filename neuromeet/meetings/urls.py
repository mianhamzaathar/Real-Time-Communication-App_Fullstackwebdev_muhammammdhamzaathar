from django.contrib import admin
from django.urls import path
from meetings import views

urlpatterns = [

path('admin/', admin.site.urls),

path('', views.home),

path('room/', views.create_room),

]