namespace BlackboardChat.Data
{
    // represents a chat room instance
    public class Channel
    {
        // the rowID of the channel
        public int Id { get; set; }

        // the channel's name
        public string? Name { get; set; }

        // whether or not the channel is a forum channel
        public bool IsForum { get; set; }

        // the topic of the channel, if the channel is a forum channel
        public string? Topic { get; set; }

        // a comma separated list of user IDs that can see this channel
        // since SQL doesn't support arrays, we have to use a string to store this
        public string? Members { get; set; }

        // a comma separated list of user IDs that cannot send messages in this channel
        // since SQL doesn't support arrays, we have to use a string to store this
        public string? MutedMembers { get; set; }
    }
}
