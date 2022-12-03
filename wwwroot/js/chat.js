"use strict";

var connection = new signalR.HubConnectionBuilder().withUrl("/chat").build();

// cache all users since the class list will (probably) not change
// prevents us from having to ping the database every time we need to retrieve a user
// in the real world, students can drop the class but we dont have to worry about that here
var userCache = [];
// the client's current channel ID
var channelID = 0;
// a list of users that can see the current channel
// used to make some calculations easier
var channelUserCache = "";
// the client's user object, including their user ID, name, and if they are a professor
var localUser = null;

//Disable the input box until connection is established.
document.getElementById("messageInput").disabled = true;

// hide the add channel button until the user is the professor
document.getElementById("addChannel").hidden = true;

//Hide the request 1-on-1 button until the user is a student
document.getElementById("requestChat").hidden = true;

document.getElementById("studSettings").hidden = true;
document.getElementById("profSettings").hidden = true;


// Helper function to display a message
function addMessage(message) {
    // only display messages sent in the current channel
    // TODO (maybe): some sort of notification/unread system for other channels
    if (message.channel === channelID) {
        var isLocalUser = message.author === localUser.id;
        var sender = (isLocalUser ? 'You' : userCache.at(message.author - 1).name) + ": ";

        // create div for message
        var messagebox = $("<div class ='messagediv' id ='message'></div>");
        messagebox.addClass(isLocalUser ? 'user' : 'otheruser');
        messagebox.attr('id', `message_${message.id}`);

        if (message.isDeleted) {
            // if the message is already deleted, then show it as deleted to the professor
            // for students just dont show it at all
            if (localUser.isProfessor)
                messagebox.addClass('deleted');
            else
                return;
        }

        // only append delete button to div if user is the professor
        // and if the message isn't already deleted
        if (localUser.isProfessor && !message.isDeleted) {
            // create button to allow message deletion
            var deletebutton = document.createElement('input');
            deletebutton.setAttribute('class', 'deletebutton');
            deletebutton.setAttribute('value', '\u{2716}');
            deletebutton.setAttribute('type', 'button');
            deletebutton.addEventListener('click', function () {
                // convert message id to a number
                let num = Number.parseInt($(this).parent().attr('id').split('_')[1]);
                connection.invoke("RequestDeleteMessage", num).catch(function (err) {
                    return console.error(err.toString());
                });
            });

            messagebox.append(deletebutton);
        }

        // create message text
        var messagetext = document.createElement('text');
        messagetext.setAttribute('class', 'message');
        messagetext.innerText = sender + message.content;

        // appendtext to div
        messagebox.append(messagetext);

        // append message box and break
        var chat = $("#chatbox");
        chat.append(messagebox)
    }
}


// Helper function to create a channel
function addChannel(id, name) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-info";
    button.id = `channelID_${id}`;
    button.onclick = function () { changeChannel(id); };
    button.innerText = name;
    let addButton = document.getElementById("addChannel");
    document.getElementById("buttonlist").insertBefore(button, addButton);
}

// When a message is received by the server, display it
connection.on("ReceiveMessage", function (message) {
    addMessage(message);
});

connection.on("DeleteMessage", function (message) {
    var msg = $(`#message_${message}`);
    // if the user is the professor, then just change the message to red
    if (localUser.isProfessor) {
        msg.addClass('deleted');
        // remove the delete button as the message already deleted
        msg.children('input:first').remove();
    }
    // otherwise, delete the message entirely
    else {
        msg.remove();
    }
});

connection.on("CreateChannel", function (channel) {
    // if we already have access to the channel, then skip it
    if ($(`#channelID_${channel.id}`).length)
        return;
    // convert the database's member storage into an actual array of user IDs
    // and check if we actually have permission to see this channel
    if (channel.members.split(',').includes(localUser.id.toString())) {
        addChannel(channel.id, channel.name);
    }
});

connection.on("RemoveChannel", function (channel) {
    // only attempt to delete the channel if the user has access to it
    if (channel.members.split(',').includes(localUser.id.toString())) {
        // if we are looking at the channel, then change channels
        if (channelID === channel.id)
            changeChannel(0);
        $(`#channelID_${channel.id}`).remove();
    }
});

connection.on("UpdateChannel", function (channel) {
    if (localUser.isProfessor) return;
    if (channel.members.split(',').includes(localUser.id.toString())) {
        // if we can already see the channel then do nothing
        if ($(`#channelID_${channel.id}`).length)
            return;
        addChannel(channel.id, channel.name);
    }
    else {
        if ($(`#channelID_${channel.id}`).length) {
            // change back to the default channel if we get removed
            changeChannel(0);
            $(`#channelID_${channel.id}`).remove();
        }
    }
});

// sync messages with the server
connection.on("SyncChannelMessages", function (messages) {
    messages.forEach(x => {
        addMessage(x);
    });
});

connection.on("SyncChannelUsers", function (users) {
    channelUserCache = users;
    const userList = document.getElementById("usersShown");
    users.split(',').forEach(x => {
        var li = document.createElement("li");
        li.className = "users";
        li.innerText = userCache.at(x - 1).name;
        userList.appendChild(li);
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
    connection.invoke("RequestUsersInChannel", channelID).catch(function (err) {
        return console.error(err.toString());
    });
    connection.invoke("RequestChannelMessages", channelID).catch(function (err) {
        return console.error(err.toString());
    });

    if (localUser.isProfessor) {
        document.getElementById("addChannel").hidden = false;
        document.getElementById("profSettings").hidden = false;
    }

    if (!localUser.isProfessor) {
        document.getElementById("requestChat").hidden = false;
        document.getElementById("studSettings").hidden = false;
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

    // remove all displayed users on the sidebar
    document.getElementById("usersShown").replaceChildren();

    // request users in new channel to display on sidebar
    connection.invoke("RequestUsersInChannel", channelID).catch(function (err) {
        return console.error(err.toString());
    });

    // request the channels messages
    // TODO: possibly cache messages that we already have
    connection.invoke("RequestChannelMessages", channelID).catch(function (err) {
        return console.error(err.toString());
    });
}

function deleteChannel(id) {
    connection.invoke("DeleteChannel", id).catch(function (err) {
        return console.error(err.toString());
    });
}


$(document).ready(function () {
    $('#messageInput').on("keyup", function (event) {
        if (event.key === "Enter") {
            var message = $("#messageInput").val();
            if (message !== "") {
                connection.invoke("SendMessage", channelID, localUser.id, message).catch(function (err) {
                    return console.error(err.toString());
                });
                // reset the input box when a message is sent
                $("#messageInput").val("");
                event.preventDefault();
            }
        }
    });

    $('#addChannel').on('click', function (e) {
        $('#addChannelModal').modal('toggle');
    });

    $('#editUsers').on('click', function (e) {
        if (channelID == 0) {
            alert("The default chat room user list may not be edited.");
            return;
        }
        $('#editUsersModal').modal('toggle');
    });

    $('#addChannelModal').on('show.bs.modal', function (e) {     
        $('#createInputHolder').empty();
        $('#createInputHolder').append($(`
           <div class="form-group">
              <label for="roomName" style="color: black">
                   Room Name
              </label>
              <input type="text" class="form-control" value="" id="roomName">
            </div>
            `));
        userCache.forEach(x => {
            if (x.isProfessor) return;
            $('#createInputHolder').append($(`
            <div class="form-check">
               <input class="form-check-input" type="checkbox" value="" id="user${x.id}">
               <label class="form-check-label" for="user${x.id}" style="color: black">
                   ${x.name}
               </label>
            </div>`));
        });
    });

    $('#editUsersModal').on('show.bs.modal', function (e) {
        $('#editInputHolder').empty();
        let users = channelUserCache.split(',').map(Number);
        console.log(users);
        userCache.forEach(x => {
            if (x.isProfessor) return;
            $('#editInputHolder').append($(`
            <div class="form-check">
               <input class="form-check-input" type="checkbox" value="" id="user${x.id}" ${users.includes(x.id) ? "checked" : ""}>
               <label class="form-check-label" for="user${x.id}" style="color: black">
                   ${x.name}
               </label>
            </div>`));
        });
    });

    $('#deleteChatroom').on('click', function (e) {
        if (channelID == 0) {
            alert("The default chat room may not be deleted.");
            return;
        }
        $('#deleteChatroomModal').modal('toggle');
    });

    $('#confirmDelete').on('click', function (e) {
        deleteChannel(channelID);
    });

    $('#confirmCreate').on('click', function (e) {
        let name = $('#roomName').val();
        if (name === null)
            return;
        name = name.replaceAll(' ', '-');
        if (name.length > 50) {
            alert("Channel name must be shorter than 50 characters.");
            return;
        }
        // professor is always included
        var users = ['1'];
        $('#createInputHolder input:checked').each(function () {
            users.push($(this).attr('id').substring(4));
        });
        connection.invoke("AddChannel", name, users).catch(function (err) {
            return console.error(err.toString());
        });
    });

    $('#confirmEdit').on('click', function (e) {
        var add = [];
        var remove = [];
        console.log("clicked");
        $('#editInputHolder input').each(function () {
            let id = $(this).attr('id').substring(4);
            if ($(this).is(':checked')) {
                add.push(id);
            }
            else {
                remove.push(id);
            }
        });
        connection.invoke("UpdateUsersInChannel", channelID, add, remove).catch(function (err) {
            return console.error(err.toString());
        });
    });

    $('#requestChat').on("click", function (event) {
        connection.invoke('AddProfUserChannel', localUser).catch(function (err) {
            return console.error(err.toString());
        });
    });
});

