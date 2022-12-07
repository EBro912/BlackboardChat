namespace BlackboardChat.Data
{
    public class LogEntry
    {
        // the row ID of the log entry
        public int Id { get; set; }
        
        // the action that the log entry represents
        public Action Action { get; set; }

        // when the action was performed
        public DateTime Timestamp { get; set; }

        // the message of the log entry (what happened)
        public string? Message { get; set; }
    }
}
