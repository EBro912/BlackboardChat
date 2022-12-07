namespace BlackboardChat.Data
{
    // represents a message sent in a chatroom
    public class Message
    {
        // the rowID of the message
        public int Id { get; set; }
        // the channel ID the message was sent in
        public int Channel { get; set; }
        // the user ID of who sent the message
        public int Author { get; set; }
        // the message's content
        public string? Content { get; set; }
        // when the message was sent
        public DateTime Timestamp { get; set; }
        // if the message has been deleted
        public bool IsDeleted { get; set; }
    }
}
