"use strict";

var connection = new signalR.HubConnectionBuilder().withUrl("/chat").build();

// cache all users since the class list will (probably) not change
// prevents us from having to ping the database every time we need to retrieve a user
// in the real world, students can drop the class but we dont have to worry about that here
var userCache = [];
// a reference to the current channel
// used to make some calculations easier
var channelCache = null;
// the client's user object, including their user ID, name, and if they are a professor
var localUser = null;

// whether the local user (a student) is globally muted
// in the real world it would be stupid to have this be on the client but
// this is just a prototype so it doesnt matter
// "client side is the secure side!"
var globallyMuted = false;

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
    if (message.channel === channelCache.id) {
        var isLocalUser = message.author === localUser.id;
        var sender = (isLocalUser ? 'You' : userCache.at(message.author - 1).name);

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

        // only append delete button to div if user is the professor or if the user is the message author
        // and if the message isn't already deleted
        if ((localUser.isProfessor && !message.isDeleted) || (message.author === localUser.id && !message.isDeleted)) {
            // create button to allow message deletion
            var deletebutton = document.createElement('input');
            deletebutton.setAttribute('class', 'deletebutton');
            deletebutton.setAttribute('value', '\u{2716}');
            deletebutton.setAttribute('type', 'button');
            deletebutton.addEventListener('click', function () {
                // convert message id to a number
                let num = Number.parseInt($(this).parent().attr('id').split('_')[1]);
                // pass this function our name to save a database call
                connection.invoke("RequestDeleteMessage", num, localUser.name).catch(function (err) {
                    return console.error(err.toString());
                });
            });

            messagebox.append(deletebutton);
        }

        // create message sender
        var messagesender = document.createElement('text');
        messagesender.setAttribute('class', 'messagesender');
        messagesender.innerText = sender;

        // create message header
        var messageheader = document.createElement('text');
        messageheader.setAttribute('class', 'messageheader');
        messageheader.innerText = " (" + createDateString(new Date(Date.parse(message.timestamp))) + ") :\n";

        // create message text
        var messagetext = document.createElement('text');
        messagetext.setAttribute('class', 'message');
        messagetext.innerText = message.content;

        // append button and text to div
        messagebox.append(messagesender);
        messagebox.append(messageheader);
        messagebox.append(messagetext);

        // append message box and break
        var chat = $("#chatbox");
        chat.append(messagebox)
    }
}


function createDateString(date) {
    var datestr;

    var month = date.getMonth() + 1;
    var day = date.getDate();

    var hours = date.getHours() % 12;
    // convert to 12 hour time 
    if (hours == 0)
        hours = 12;

    var tempmin = date.getMinutes();

    var label = date.getHours() >= 12 ? 'pm' : 'am';
    var minutes = tempmin >= 9 ? tempmin : '0' + tempmin;

    datestr = month + "/" + day + " @ " + hours + ":" + minutes + label;

    return datestr;
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
        if (channelCache.id === channel.id)
            changeChannel(1);
        $(`#channelID_${channel.id}`).remove();
    }
});

connection.on("UpdateChannel", function (channel) {
    // reload user sidebar if we are looking at the channel being updated
    if (channelCache.id === channel.id) {
        changeChannel(channelCache.id);
    }
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

connection.on("UpdateChannelMutes", function (channel) {
    // if we are already globally muted then do nothing
    // set the placeholder again just in case
    if (globallyMuted) {
        document.getElementById("messageInput").placeholder = "You are globally muted!"
        document.getElementById("messageInput").disabled = true;
    }
    // only update message box if we are looking at the chat room
    if (channelCache.id === channel.id) {
        channelCache = channel;
        if (channel.mutedMembers.split(',').includes(localUser.id.toString())) {
            document.getElementById("messageInput").placeholder = "You are muted in this chat room!"
            document.getElementById("messageInput").disabled = true;
        }
        else {
            document.getElementById("messageInput").placeholder = "Add Message"
            document.getElementById("messageInput").disabled = false;
        }
    }
});

connection.on("SetUsersAsGloballyMuted", function (users) {
    if (localUser.isProfessor) {
        // update user cache for professor with newly muted users
        connection.invoke("RequestUsers").catch(function (err) {
            return console.error(err.toString());
        });
        return;
    }
    if (users.includes(localUser.id.toString())) {
        document.getElementById("messageInput").placeholder = "You are globally muted!"
        document.getElementById("messageInput").disabled = true;
        globallyMuted = true;
    }
    // fixes a bug where users would be unmuted in the current chatroom if the global mutes were updated
    else if (channelCache.mutedMembers.split(',').includes(localUser.id.toString())) {
        document.getElementById("messageInput").placeholder = "You are muted in this chat room!"
        document.getElementById("messageInput").disabled = true;
    }
    else {
        document.getElementById("messageInput").placeholder = "Add Message"
        document.getElementById("messageInput").disabled = false;
        globallyMuted = false;
    }
});

// sync messages with the server
connection.on("SyncChannelMessages", function (messages) {
    messages.forEach(x => {
        addMessage(x);
    });
});

connection.on("SyncCurrentChannel", function (channel) {
    channelCache = channel;
    const userList = document.getElementById("usersShown");
    channel.members.split(',').map(Number).forEach(x => {
        var li = document.createElement("li");
        li.className = "users";
        li.innerText = userCache.at(x - 1).name;
        userList.appendChild(li);
    });

    // check we are muted in any way
    if (globallyMuted) {
        document.getElementById("messageInput").placeholder = "You are globally muted!"
        document.getElementById("messageInput").disabled = true;
    }
    else if (channel.mutedMembers.split(',').includes(localUser.id.toString())) {
        document.getElementById("messageInput").placeholder = "You are muted in this chat room!"
        document.getElementById("messageInput").disabled = true;
    }
    else {
        document.getElementById("messageInput").placeholder = "Add Message"
        document.getElementById("messageInput").disabled = false;
    }
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
    if (localUser.isGloballyMuted) {
        document.getElementById("messageInput").placeholder = "You are globally muted!"
        document.getElementById("messageInput").disabled = true;
        globallyMuted = true;
    }
    // request a cache of all users
    connection.invoke("RequestUsers").catch(function (err) {
        return console.error(err.toString());
    });
    // after we are connected to the server, request any existing channels and messages
    connection.invoke("RequestChannels").catch(function (err) {
        return console.error(err.toString());
    });
    connection.invoke("RequestCurrentChannel", 1).catch(function (err) {
        return console.error(err.toString());
    });
    connection.invoke("RequestChannelMessages", 1).catch(function (err) {
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
    let userID = parseInt(prompt("Please enter a user ID to login as"));
    connection.invoke("RequestLogin", userID).catch(function (err) {
        return console.error(err.toString());
    });
}).catch(function (err) {
    return console.error(err.toString());
});

function changeChannel(id) {
    // disable the new channel from being clicked and enable the old one
    document.getElementById(`channelID_${channelCache.id}`).disabled = false;
    var newChnl = document.getElementById(`channelID_${id}`);
    newChnl.disabled = true;
    // remove all displayed messages from the message list
    document.getElementById("chatbox").replaceChildren();

    // remove all displayed users on the sidebar
    document.getElementById("usersShown").replaceChildren();

    // request users in new channel to display on sidebar
    connection.invoke("RequestCurrentChannel", id).catch(function (err) {
        return console.error(err.toString());
    });

    // request the channels messages
    // TODO: possibly cache messages that we already have
    connection.invoke("RequestChannelMessages", id).catch(function (err) {
        return console.error(err.toString());
    });
}

connection.on("UpdateLog", function (log) {
    $('#logbody').empty();
    log.forEach(x => {
        $('#logbody').append(`<p>${createDateString(new Date(Date.parse(x.timestamp)))} ${x.message}</p>`);
    });
    $('#logModal').modal('toggle');
});


$(document).ready(function () {
    $('#messageInput').on("keyup", function (event) {
        if (event.key === "Enter") {
            var message = $("#messageInput").val().trim();
            if (message !== "") {
                connection.invoke("SendMessage", channelCache.id, localUser.id, message).catch(function (err) {
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
        if (channelCache.id == 1) {
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
        let users = channelCache.members.split(',').map(Number);
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
        if (channelCache.id == 1) {
            alert("The default chat room may not be deleted.");
            return;
        }
        $('#deleteChatroomModal').modal('toggle');
    });

    $('#confirmDelete').on('click', function (e) {
        connection.invoke("DeleteChannel", channelCache.id, localUser.name).catch(function (err) {
            return console.error(err.toString());
        });
    });

    $('#confirmCreate').on('click', function (e) {
        let name = $('#roomName').val();
        if (name === null)
            return;
        if (name.length === 0) {
            alert("Channel name must not be empty.");
            return;
        }
        name = name.replaceAll(' ', '-');
        if (name.length > 25) {
            alert("Channel name must be shorter than 25 characters.");
            return;
        }
        // professor is always included
        var users = ['1'];
        // a list of usernames for the log
        var usernames = ['Professor Jim'];
        $('#createInputHolder input:checked').each(function () {
            let id = $(this).attr('id').substring(4);
            users.push(id);
            usernames.push(userCache.at(id - 1).name);
        });
        connection.invoke("AddChannel", name, users, localUser.name, usernames).catch(function (err) {
            return console.error(err.toString());
        });
    });

    $('#confirmEdit').on('click', function (e) {
        var add = [];
        var remove = [];
        var addUsernames = [];
        var removeUsernames = [];
        $('#editInputHolder input').each(function () {
            let id = $(this).attr('id').substring(4);
            if ($(this).is(':checked')) {
                add.push(id);
                addUsernames.push(userCache.at(id - 1).name);
            }
            else {
                remove.push(id);
                removeUsernames.push(userCache.at(id - 1).name);
            }
        });
        connection.invoke("UpdateUsersInChannel", channelCache.id, add, remove, addUsernames, removeUsernames).catch(function (err) {
            return console.error(err.toString());
        });
    });

    $('#muteUsersGlobally').on('click', function (e) {
        $('#muteUsersGloballyModal').modal('toggle');
    });

    $('#muteUsersGloballyModal').on('show.bs.modal', function (e) {
        $('#muteGloballyInputHolder').empty();
        userCache.forEach(x => {
            if (x.isProfessor) return;
            $('#muteGloballyInputHolder').append($(`
            <div class="form-check">
               <input class="form-check-input" type="checkbox" value="" id="user${x.id}" ${x.isGloballyMuted ? "checked" : ""}>
               <label class="form-check-label" for="user${x.id}" style="color: black">
                   ${x.name}
               </label>
            </div>`));
        });
    });

    $("#confirmMuteGlobally").on('click', function (e) {
        var add = [];
        var remove = [];
        var addUsernames = [];
        var removeUsernames = [];
        $('#muteGloballyInputHolder input').each(function () {
            let id = $(this).attr('id').substring(4);
            if ($(this).is(':checked')) {
                add.push(id);
                addUsernames.push(userCache.at(id - 1).name);
            }
            else {
                remove.push(id);
                removeUsernames.push(userCache.at(id - 1).name);
            }
        });
        connection.invoke("GloballyMuteUsers", add, remove, addUsernames, removeUsernames).catch(function (err) {
            return console.error(err.toString());
        });
    });

    $('#muteUsersLocally').on('click', function (e) {
        $('#muteUsersLocallyModal').modal('toggle');
    });

    $('#muteUsersLocallyModal').on('show.bs.modal', function (e) {
        $('#muteLocallyInputHolder').empty();
        let localMutes = channelCache.mutedMembers.split(',');
        channelCache.members.split(',').forEach(x => {
            let user = userCache.at(x - 1);
            if (user.isProfessor) return;
            let isLocallyMuted = localMutes.includes(x);
            $('#muteLocallyInputHolder').append($(`
            <div class="form-check">
               <input class="form-check-input" type="checkbox" value="" id="user${user.id}" ${isLocallyMuted ? "checked" : ""}>
               <label class="form-check-label" for="user${user.id}" style="color: black">
                   ${user.name}
               </label>
            </div>`));
        });
    });

    $("#confirmMuteLocally").on('click', function (e) {
        var users = [];
        $('#muteLocallyInputHolder input:checked').each(function () {
            users.push($(this).attr('id').substring(4));
        });
        connection.invoke("UpdateLocallyMutedMembers", channelCache.id, users).catch(function (err) {
            return console.error(err.toString());
        });
    });

    $('#openLog').on('click', function (e) {
        connection.invoke("RequestLog").catch(function (err) {
            return console.error(err.toString());
        });
    });

    $('#logModal').on('show.bs.modal', function (e) {
        // TODO
    });


    $('#requestChat').on("click", function (event) {
        connection.invoke('AddProfUserChannel', localUser).catch(function (err) {
            return console.error(err.toString());
        });
    });
});

