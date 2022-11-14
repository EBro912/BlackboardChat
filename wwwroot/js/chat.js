"use strict";

var connection = new signalR.HubConnectionBuilder().withUrl("/chat").build();

// cache all users since the class list will (probably) not change
// prevents us from having to ping the database every time we need to retrieve a user
// in the real world, students can drop the class but we dont have to worry about that here
var userCache = [];

// the client's current channel ID
var channelID = 0;
// the client's user object, including their user ID, name, and if they are a professor
var localUser = null;

//Disable the input box until connection is established.
document.getElementById("messageInput").disabled = true;

// hide the add channel button until the user is the professor
document.getElementById("addChannel").hidden = true;

// Helper function to display a message
function addMessage(channel, user, message) {
    // only display messages sent in the current channel
    // TODO (maybe): some sort of notification/unread system for other channels
    if (channel === channelID) {
        var isLocalUser = user === localUser.id;
        var msg = `${isLocalUser ? "You" : userCache.at(user - 1).name}: ${message}`

        // create message box with users message
        var messagebox = document.createElement('text');
        messagebox.setAttribute('class', 'message');
        messagebox.setAttribute('id', isLocalUser ? 'user' : 'otheruser');
        messagebox.textContent = msg;

        // append message box and break
        var chat = document.getElementById('chatbox');
        chat.appendChild(messagebox);
    }
}

// Helper function to create a channel
function addChannel(id, name) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-secondary";
    button.id = `channelID_${id}`;
    button.onclick = function () { changeChannel(id); };
    button.innerText = name;
    let addButton = document.getElementById("addChannel");
    document.getElementById("buttonlist").insertBefore(button, addButton);
}

// When a message is received by the server, display it
connection.on("ReceiveMessage", function (channel, user, message) {
    addMessage(channel, user, message);
});

connection.on("CreateChannel", function (channel) {
    // convert the database's member storage into an actual array of user IDs
    // and check if we actually have permission to see this channel
    if (channel.members.split(',').includes(localUser.id.toString())) {
        addChannel(channel.id, channel.name);
    }
});

// sync messages with the server
connection.on("SyncChannelMessages", function (messages) {
    messages.forEach(x => {
        addMessage(x.channel, x.author, x.content);
    });
});

// sync channels with the server
connection.on("SyncChannels", function (channels) {
    channels.forEach(x => {
        // convert the database's member storage into an actual array of user IDs
        // and check if we actually have permission to see this channel
        if (x.members.split(',').includes(localUser.id.toString())) {
            addChannel(x.id, x.name);
        }
    });
});

// sync users with the server
connection.on("SyncUsers", function (users) {
    userCache = users;
    console.log(`Cached ${userCache.length} users.`);
});

connection.on("LoginSuccessful", function (user) {
    localUser = user;
    // request a cache of all users
    connection.invoke("RequestUsers").catch(function (err) {
        return console.error(err.toString());
    });
    // after we are connected to the server, request any existing channels and messages
    connection.invoke("RequestChannels").catch(function (err) {
        return console.error(err.toString());
    });
    connection.invoke("RequestChannelMessages", channelID).catch(function (err) {
        return console.error(err.toString());
    });

    if (localUser.isProfessor) {
        document.getElementById("addChannel").hidden = false;
    }
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

// TODO: actually be able to create/delete channels
function changeChannel(id) {
    // disable the new channel from being clicked and enable the old one
    document.getElementById(`channelID_${channelID}`).disabled = false;
    var newChnl = document.getElementById(`channelID_${id}`);
    newChnl.disabled = true;
    channelID = id;
    // remove all displayed messages from the message list
    document.getElementById("chatbox").replaceChildren();
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

const add = document.getElementById("addChannel");
add.addEventListener("click", function (event) {
    let name = prompt("Enter a name for the new channel");
    if (name === null)
        return;
    name = name.replaceAll(' ', '-');
    if (name.length > 50) {
        alert("Channel name must be shorter than 50 characters.");
        return;
    }
    // TODO: handle if a channel name already exists
    connection.invoke("AddChannel", name).catch(function (err) {
        return console.error(err.toString());
    });
});