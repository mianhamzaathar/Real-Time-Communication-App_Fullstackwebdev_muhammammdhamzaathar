function sendMessage(){
    let msg = document.getElementById("msg").value;
    if(msg.trim() === "") return;

    socket.send(JSON.stringify({
        type: "chat",
        message: msg
    }));

    document.getElementById("msg").value = "";
}

socket.onmessage = e => {
    let data = JSON.parse(e.data);
    if(data.type === "chat"){
        let li = document.createElement("li");
        li.textContent = data.message;
        document.getElementById("chat").appendChild(li);
    }
}