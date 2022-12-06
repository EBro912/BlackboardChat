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

        public async Task GloballyMuteUsers(string[] add, string[] remove, string[] addUsernames, string[] removeUsernames)
        {
            List<string> logAdd = new List<string>();
            List<string> logRemove = new List<string>();
            var existing = await Database.GetGloballyMutedUsers();
            List<string> members = existing.Select(x => x.Id.ToString()).ToList();
            for (int i = 0; i < add.Length; i++)
            {
                if (!members.Contains(add[i]))
                {
                    await Database.SetUserIsGloballyMuted(int.Parse(add[i]), true);
                    logAdd.Add(addUsernames[i]);
                }
            }
            for (int i = 0; i < remove.Length; i++)
            {
                if (members.Contains(remove[i]))
                {
                    await Database.SetUserIsGloballyMuted(int.Parse(remove[i]), false);
                    logRemove.Add(removeUsernames[i]);
                }
            }
            if (logAdd.Count > 0)
            {
                string message = $"<b>The following users were globally muted:</b> {string.Join(", ", logAdd)}";
                await Database.AddLogEntry(Action.GLOBALLY_MUTE_USERS, DateTime.Now, message);
            }
            if (logRemove.Count > 0)
            {
                string message = $"<b>The following users were globally unmuted:</b> {string.Join(", ", logRemove)}";
                await Database.AddLogEntry(Action.GLOBALLY_UNMUTE_USERS, DateTime.Now, message);
            }
            await Clients.All.SendAsync("SetUsersAsGloballyMuted", add);
        }

        public async Task UpdateLocallyMutedMembers(int channelId, string[] add, string[] remove, string[] addUsernames, string[] removeUsernames)
        {
            Channel channel = await Database.GetChannelById(channelId);
            // arrays to log users with
            List<string> logAdd = new List<string>();
            List<string> logRemove = new List<string>();
            if (channel != null)
            {
                List<string> members = channel.MutedMembers.Split(',').ToList();
                for (int i = 0; i < add.Length; i++)
                {
                    if (!members.Contains(add[i]))
                    {
                        members.Add(add[i]);
                        logAdd.Add(addUsernames[i]);
                    }
                }
                for (int i = 0; i < remove.Length; i++)
                {
                    if (members.Contains(remove[i]))
                    {
                        members.Remove(remove[i]);
                        logRemove.Add(removeUsernames[i]);
                    }
                }
                string updated = string.Join(',', members);
                channel.MutedMembers = updated;
                await Database.UpdateChannelMutedMembers(channel.Id, updated);
                if (logAdd.Count > 0)
                {
                    string message = $"<b>The following members were muted in {channel.Name}:</b> {string.Join(", ", logAdd)}";
                    await Database.AddLogEntry(Action.LOCALLY_MUTE_USERS, DateTime.Now, message);
                }
                if (logRemove.Count > 0)
                {
                    string message = $"<b>The following members were unmuted in {channel.Name}:</b> {string.Join(", ", logRemove)}";
                    await Database.AddLogEntry(Action.LOCALLY_UNMUTE_USERS, DateTime.Now, message);
                }
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

        public async Task UpdateUsersInChannel(int channelId, string[] add, string[] remove, string[] addUsernames, string[] removeUsernames)
        {
            Channel channel = await Database.GetChannelById(channelId);
            // arrays to log users with
            List<string> logAdd = new List<string>();
            List<string> logRemove = new List<string>();
            if (channel != null)
            {
                List<string> members = channel.Members.Split(',').ToList();
                for (int i = 0; i < add.Length; i++)
                {
                    if (!members.Contains(add[i]))
                    {
                        members.Add(add[i]);
                        logAdd.Add(addUsernames[i]);
                    }
                }
                for (int i = 0; i < remove.Length; i++)
                {
                    if (members.Contains(remove[i]))
                    {
                        members.Remove(remove[i]);
                        logRemove.Add(removeUsernames[i]);
                    }
                }
                string updated = string.Join(',', members);
                channel.Members = updated;
                await Database.UpdateChannelMembers(channel.Id, updated);
                if (logAdd.Count > 0)
                {
                    string message = $"<b>The following members were added to {channel.Name}:</b> {string.Join(", ", logAdd)}";
                    await Database.AddLogEntry(Action.ADD_USERS, DateTime.Now, message);
                }
                if (logRemove.Count > 0)
                {
                    string message = $"<b>The following members were removed from {channel.Name}:</b> {string.Join(", ", logRemove)}";
                    await Database.AddLogEntry(Action.REMOVE_USERS, DateTime.Now, message);
                }
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
