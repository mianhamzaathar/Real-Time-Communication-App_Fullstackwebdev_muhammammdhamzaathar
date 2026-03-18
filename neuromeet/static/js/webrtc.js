let peers = {};
let socket = new WebSocket("ws://"+window.location.host+"/ws/meeting/"+room+"/");

let grid = document.getElementById("videoGrid");

navigator.mediaDevices.getUserMedia({video:true, audio:true})
.then(stream => {
    let localVideo = document.getElementById("localVideo");
    localVideo.srcObject = stream;

    socket.onmessage = e => {
        let data = JSON.parse(e.data);
        if(data.user){
            createPeer(data.user, stream);
        }
    }
});

function createPeer(user, stream){
    if(peers[user]) return;

    let peer = new RTCPeerConnection();

    stream.getTracks().forEach(track=>{
        peer.addTrack(track, stream);
    });

    peer.ontrack = e => {
        let video = document.createElement("video");
        video.srcObject = e.streams[0];
        video.autoplay = true;
        grid.appendChild(video);
    }

    peers[user] = peer;
}