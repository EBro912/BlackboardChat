using Microsoft.AspNetCore.SignalR;

namespace BlackboardChat.Hubs
{
    public class Chat : Hub
    {
        public async Task SendMessage(string message)
        {
            await Clients.All.SendAsync("ReceiveMessage", message);
            // TODO: store the correct channel and user ids in the database
            await Database.AddMessage(0, 0, message, DateTime.Now);
        }

        public async Task RequestMessages()
        {
            var messages = await Database.GetAllMessages();
            // only send a list of existing messages to the person requesting them
            await Clients.Caller.SendAsync("SyncMessages", messages);
        }
    }
}
