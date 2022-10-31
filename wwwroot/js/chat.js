"use strict";

var connection = new signalR.HubConnectionBuilder().withUrl("/chat").build();

//Disable the input box until connection is established.
document.getElementById("messageInput").disabled = true;

// When a message is received by the server, display it
connection.on("ReceiveMessage", function (message) {
    var li = document.createElement("li");
    document.getElementById("messagesList").appendChild(li);
    li.textContent = `${message}`;
});

// Once we are connected to the server, enable the message box
connection.start().then(function () {
    document.getElementById("messageInput").disabled = false;
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