"use strict";

var connection = new signalR.HubConnectionBuilder().withUrl("/chat").build();

//Disable the input box until connection is established.
document.getElementById("messageInput").disabled = true;

// Helper function to display a message
function addMessage(message) {
    var li = document.createElement("li");
    document.getElementById("messagesList").appendChild(li);
    li.textContent = `${message}`;
}

// When a message is received by the server, display it
connection.on("ReceiveMessage", function (message) {
    addMessage(message);
});

// When we first connect, 
connection.on("SyncMessages", function (messages) {
    messages.forEach(x => {
        console.log(x);
        addMessage(x.content);
    });
});

// Once we are connected to the server, enable the message box
connection.start().then(function () {
    document.getElementById("messageInput").disabled = false;
    // after we are connected to the server, request any existing messages
    connection.invoke("RequestMessages").catch(function (err) {
        return console.error(err.toString());
    });
}).catch(function (err) {
    return console.error(err.toString());
});


const input = document.getElementById("messageInput");
input.addEventListener("keyup", function (event) {
    if (event.key === "Enter") {
        var message = input.value;
        if (message !== "") {
            connection.invoke("SendMessage", message).catch(function (err) {
                return console.error(err.toString());
            });
            // reset the input box when a message is sent
            input.value = "";
            event.preventDefault();
        }
    }
});