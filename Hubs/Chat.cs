using Microsoft.AspNetCore.SignalR;

namespace BlackboardChat.Hubs
{
    public class Chat : Hub
    {
        public async Task SendMessage(int channelID, int userID, string message)
        {
            await Clients.All.SendAsync("ReceiveMessage", channelID, message);
            // TODO: store the correct channel and user ids in the database
            await Database.AddMessage(channelID, userID, message, DateTime.Now);
        }

        public async Task RequestChannelMessages(int id)
        {
            var messages = await Database.GetAllMessagesFromChannel(id);
            // only send a list of existing messages to the person requesting them
            await Clients.Caller.SendAsync("SyncChannelMessages", messages);
        }
    }
}
