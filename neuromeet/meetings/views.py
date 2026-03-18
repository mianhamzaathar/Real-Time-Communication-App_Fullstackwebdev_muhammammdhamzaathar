import uuid

from django.shortcuts import render


def home(request):
    return render(request, "home.html")


def create_room(request):
    room_id = str(uuid.uuid4())[:8]
    room = {
        "id": room_id,
        "name": f"Meeting {room_id.upper()}",
        "host_id": str(request.user.id) if request.user.is_authenticated else "",
    }
    return render(request, "room.html", {"room": room})
