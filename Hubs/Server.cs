using BlackboardChat.Data;
using Microsoft.AspNetCore.SignalR;
using Action = BlackboardChat.Data.Action;

namespace BlackboardChat.Hubs
{
    public class Server : Hub
    {
        public async Task SendMessage(int channelID, int userID, string message)
        {
            await Database.AddMessage(channelID, userID, message, DateTime.Now);
            Message msg = await Database.GetMostRecentMessage(userID);
            await Clients.All.SendAsync("ReceiveMessage", msg);
        }

        public async Task RequestDeleteMessage(int id, string deleter)
        {
            await Database.SetMessageAsDeleted(id);
            Message msg = await Database.GetMessageById(id);
            User target = await Database.GetUserById(msg.Author);
            string message = $"<b>{deleter} deleted a message from {target.Name}:</b> \"{msg.Content}\"";
            await Database.AddLogEntry(Action.DELETE_MESSAGE, DateTime.Now, message);
            await Clients.All.SendAsync("DeleteMessage", id);
        }

        public async Task GloballyMuteUsers(string[] users)
        {
            // reset the mutes back to default
            await Database.ResetMutes();
            foreach (string s in users)
                await Database.SetUserAsGloballyMuted(int.Parse(s));
            await Clients.All.SendAsync("SetUsersAsGloballyMuted", users);
        }

        public async Task UpdateLocallyMutedMembers(int channelId, string[] users)
        {
            Channel channel = await Database.GetChannelById(channelId);
            if (channel != null)
            {         
                string updated = string.Join(',', users);
                channel.MutedMembers = updated;
                await Database.UpdateChannelMutedMembers(channel.Id, updated);
                await Clients.All.SendAsync("UpdateChannelMutes", channel);
            }
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

        public async Task AddChannel(string name, string[] members, string creator, string[] usernames)
        {
            Channel channel = await Database.GetChannelByName(name);
            if (channel != null) { return; }
            await Database.AddChannel(name, false, string.Join(',', members));
            // after creating the channel in the database, get its row id to be sent back
            channel = await Database.GetChannelByName(name);
            string message = $"<b>{creator} created chat room {name} with the following users:</b> {string.Join(", ", usernames)}";
            await Database.AddLogEntry(Action.CREATE_CHATROOM, DateTime.Now, message);
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

        public async Task RequestCurrentChannel(int channelId)
        {
            Channel channel = await Database.GetChannelById(channelId);
            await Clients.Caller.SendAsync("SyncCurrentChannel", channel);
        }

        public async Task DeleteChannel(int channelID, string deleter)
        {
            Channel channel = await Database.GetChannelById(channelID);
            if (channel != null)
            {
                // delete the chat room and the messages that were in the chat room
                await Database.DeleteChannel(channel.Id);
                await Database.DeleteMessagesInChannel(channel.Id);
                string message = $"<b>{deleter} deleted chat room {channel.Name}</b>";
                await Database.AddLogEntry(Action.DELETE_CHATROOM, DateTime.Now, message);
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

        public async Task RequestLog()
        {
            var log = await Database.GetLog();
            await Clients.Caller.SendAsync("UpdateLog", log.ToList());
        }


    }    
}
