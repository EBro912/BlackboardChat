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

        // a comma separated list of user IDs that can see this channel
        // since SQL doesn't support arrays, we have to use a string to store this
        public string? Members { get; set; }

        // a comma separated list of user IDs that can send messages in this channel
        // since SQL doesn't support arrays, we have to use a string to store this
        public string? MutedMembers { get; set; }
    }
}
