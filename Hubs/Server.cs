using BlackboardChat.Data;
using Microsoft.AspNetCore.SignalR;

namespace BlackboardChat.Hubs
{
    public class Server : Hub
    {
        public async Task SendMessage(int channelID, int userID, string message)
        {
            await Clients.All.SendAsync("ReceiveMessage", channelID, userID, message);
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
        public async Task RequestChannels()
        {
            var channels = await Database.GetAllChannels();
            await Clients.Caller.SendAsync("SyncChannels", channels.ToList());
        }

        public async Task AddChannel(string name, string[] members)
        {
            Channel channel = await Database.GetChannelByName(name);
            if (channel != null) { return; }
            await Database.AddChannel(name, false, string.Join(',', members));
            // after creating the channel in the database, get its row id to be sent back
            channel = await Database.GetChannelByName(name);
            await Clients.All.SendAsync("CreateChannel", channel);
        }

        public async Task AddProfUserChannel(User x)
        {
            // TODO: handle adding members to a channel
            // all users can see new channels for now, this should be fixed
            string chName = x.Name.Replace(' ', '-');
            Channel channel = await Database.GetChannelByName(chName);
            if (channel != null) { return; }
            string members = "1," + x.Id;
            await Database.AddChannel(chName, false, members);
            // after creating the channel in the database, get its row id to be sent back
            channel = await Database.GetChannelByName(chName);
            await Clients.All.SendAsync("CreateChannel", channel);
        }

        public async Task RequestUsersInChannel(int channelId)
        {
            // edge case, 0 is the default channel which isnt in the database and everyone can see
            // so just return everyone
            if (channelId == 0)
            {
                await Clients.Caller.SendAsync("SyncChannelUsers", "1,2,3,4,5,6,7,8,9,10,11");
            }
            else
            {
                Channel channel = await Database.GetChannelById(channelId);
                await Clients.Caller.SendAsync("SyncChannelUsers", channel.Members);
            }
        }

        public async Task DeleteChannel(string channelName)
        {
            // prevent deleting the default chat room
            if (channelName == "open-chat")
                return;
            Channel channel = await Database.GetChannelByName(channelName);
            if (channel != null)
            {
                // delete the chat room and the messages that were in the chat room
                await Database.DeleteChannel(channel.Id);
                await Database.DeleteMessagesInChannel(channel.Id);
                await Clients.All.SendAsync("RemoveChannel", channel);
            }
        }

        public async Task UpdateUsersInChannel(int channelId, string[] add, string[] remove)
        {
            Channel channel = await Database.GetChannelById(channelId);
            if (channel != null)
            {
                List<string> members = channel.Members.Split(',').ToList();
                foreach (string s in add)
                {
                    if (!members.Contains(s))
                    {
                        members.Add(s);
                    }
                }
                foreach (string s in remove)
                {
                    members.Remove(s);
                }
                string updated = string.Join(',', members);
                channel.Members = updated;
                await Database.UpdateChannelMembers(channel.Id, updated);
                await Clients.All.SendAsync("UpdateChannel", channel);
            }
        }
    }
}
