"use strict";

var connection = new signalR.HubConnectionBuilder().withUrl("/chat").build();

// the client's current channel ID
var channelID = 0;
// the client's current user ID
var userID = 0;

//Disable the input box until connection is established.
document.getElementById("messageInput").disabled = true;

// Helper function to display a message
function addMessage(channel, message) {
    // only display messages sent in the current channel
    // TODO (maybe): some sort of notification/unread system for other channels
    if (channel === channelID) {
        var li = document.createElement("li");
        document.getElementById("messagesList").appendChild(li);
        li.textContent = `${message}`;
    }
}

// When a message is received by the server, display it
connection.on("ReceiveMessage", function (channel, message) {
    addMessage(channel, message);
});

// sync messages with the server
connection.on("SyncChannelMessages", function (messages) {
    messages.forEach(x => {
        addMessage(x.channel, x.content);
    });
});

// Once we are connected to the server, enable the message box
connection.start().then(function () {
    document.getElementById("messageInput").disabled = false;
    // "login" as a user
    // TODO: format the UI differently if the professor logs in
    // TODO: should probably check if the user actually exists in the database
    userID = parseInt(prompt("Please enter a user ID to login as"));
    // after we are connected to the server, request any existing messages
    connection.invoke("RequestChannelMessages", channelID).catch(function (err) {
        return console.error(err.toString());
    });
}).catch(function (err) {
    return console.error(err.toString());
});

// TODO: dynamically load channels and add event listeners for each as they are added
// TODO: set/handle channel ids based on their ID in the database
// TODO: actually be able to create/delete channels
function changeChannel(id) {
    // disable the new channel from being clicked and enable the old one
    document.getElementById(`channelID_${channelID}`).disabled = false;
    var newChnl = document.getElementById(`channelID_${id}`);
    newChnl.disabled = true;
    // update the channel name at the top of the screen
    document.getElementById("channelName").innerText = newChnl.innerText;
    channelID = id;
    // remove all displayed messages from the message list
    document.getElementById("messagesList").replaceChildren();
    // request the channels messages
    // TODO: possibly cache messages that we already have
    connection.invoke("RequestChannelMessages", channelID).catch(function (err) {
        return console.error(err.toString());
    });
}

const input = document.getElementById("messageInput");
input.addEventListener("keyup", function (event) {
    if (event.key === "Enter") {
        var message = input.value;
        if (message !== "") {
            connection.invoke("SendMessage", channelID, userID, message).catch(function (err) {
                return console.error(err.toString());
            });
            // reset the input box when a message is sent
            input.value = "";
            event.preventDefault();
        }
    }
});