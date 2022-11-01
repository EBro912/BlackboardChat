﻿"use strict";

var connection = new signalR.HubConnectionBuilder().withUrl("/chat").build();

// cache all users since the class list will (probably) not change
// in the real world, students can drop the class but we dont have to worry about that here
var userCache = [];

// the client's current channel ID
var channelID = 0;
// the client's user object, including their user ID, name, and if they are a professor
var localUser = null;

//Disable the input box until connection is established.
document.getElementById("messageInput").disabled = true;

// Helper function to display a message
function addMessage(channel, user, message) {
    // only display messages sent in the current channel
    // TODO (maybe): some sort of notification/unread system for other channels
    if (channel === channelID) {
        var li = document.createElement("li");
        document.getElementById("messagesList").appendChild(li);
        // TODO: maybe add some formatting (bold and/or color) to each user's name
        li.textContent = `${userCache.at(user-1).name}: ${message}`;
    }
}

// When a message is received by the server, display it
connection.on("ReceiveMessage", function (channel, user, message) {
    addMessage(channel, user, message);
});

// sync messages with the server
connection.on("SyncChannelMessages", function (messages) {
    messages.forEach(x => {
        addMessage(x.channel, x.author, x.content);
    });
});

// sync users with the server
connection.on("SyncUsers", function (users) {
    userCache = users;
    console.log(userCache);
    console.log(`Cached ${userCache.length} users.`);
});

connection.on("LoginSuccessful", function (user) {
    localUser = user;
    document.getElementById("loggedInUser").innerText = `Logged In As: ${localUser.name} (ID: ${localUser.id})`;
    document.getElementById("loggedInUserRole").innerText = localUser.isProfessor ? "Professor" : "Student";
    // request a cache of all users
    connection.invoke("RequestUsers").catch(function (err) {
        return console.error(err.toString());
    });
    // after we are connected to the server, request any existing messages
    connection.invoke("RequestChannelMessages", channelID).catch(function (err) {
        return console.error(err.toString());
    });
});



// Once we are connected to the server, enable the message box
connection.start().then(function () {
    document.getElementById("messageInput").disabled = false;
    // "login" as a user
    // TODO: format the UI differently if the professor logs in
    // TODO: should probably check if the user actually exists in the database
    let userID = parseInt(prompt("Please enter a user ID to login as"));
    connection.invoke("RequestLogin", userID).catch(function (err) {
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
            connection.invoke("SendMessage", channelID, localUser.id, message).catch(function (err) {
                return console.error(err.toString());
            });
            // reset the input box when a message is sent
            input.value = "";
            event.preventDefault();
        }
    }
});