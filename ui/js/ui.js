
function sendmessage() {
    // get message that user typed
    var message = document.getElementById('message').value;
    
    // create message box with users message
    var messagebox = document.createElement('text');
    messagebox.setAttribute('class', 'message');
    messagebox.setAttribute('id', 'user');
    messagebox.textContent = message;

    // append message box and break
    var chat = document.getElementById('chatbox');
    chat.appendChild(messagebox);
    chat.appendChild(document.createElement('br'));

    // reset area for typing message
    document.getElementById('message').value = "";
}

