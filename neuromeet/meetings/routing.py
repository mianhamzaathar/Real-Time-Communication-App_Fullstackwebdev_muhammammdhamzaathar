from django.urls import re_path
from .consumers import MeetingConsumer

websocket_urlpatterns = [

re_path(
r'ws/meeting/(?P<room>[\w-]+)/$',
MeetingConsumer.as_asgi()
)

]
