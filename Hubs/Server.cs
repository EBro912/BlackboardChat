using BlackboardChat.Data;
using Microsoft.AspNetCore.SignalR;

namespace BlackboardChat.Hubs
{
    public class Server : Hub
    {
        public async Task SendMessage(int channelID, int userID, string message)
        {
            await Clients.All.SendAsync("ReceiveMessage", channelID, userID, message);
            // TODO: store the correct channel and user ids in the database
            await Database.AddMessage(channelID, userID, message, DateTime.Now);
        }

        public async Task RequestChannelMessages(int id)
        {
            var messages = await Database.GetAllMessagesFromChannel(id);
            // only send a list of existing messages to the person requesting them
            await Clients.Caller.SendAsync("SyncChannelMessages", messages);
        }

        // TODO: handle error on the frontend if the requested user doesn't exist
        public async Task RequestLogin(int id)
        {
            var user = await Database.GetUserById(id);
            await Clients.Caller.SendAsync("LoginSuccessful", user);
        }

        // send each user a cache of existing users
        public async Task RequestUsers()
        {
            var users = await Database.GetAllUsers();
            await Clients.Caller.SendAsync("SyncUsers", users.ToList());
        }

        // send existing channels to users 
        // TODO: only return channels that the user can see
        public async Task RequestChannels()
        {
            var channels = await Database.GetAllChannels();
            await Clients.Caller.SendAsync("SyncChannels", channels.ToList());
        }

        public async Task AddChannel(string name)
        {
            // TODO: handle adding members to a channel
            // all users can see new channels for now, this should be fixed
            await Database.AddChannel(name, false, "1,2,3,4,5,6,7,8,9,10,11");
            // after creating the channel in the database, get its row id to be sent back
            Channel channel = await Database.GetChannelByName(name);
            await Clients.All.SendAsync("CreateChannel", channel);
        }
    }
}
