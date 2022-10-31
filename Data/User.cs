namespace BlackboardChat.Data
{
    // Represents a user in the database
    public class User
    {
        // the rowID of the user
        public int Id { get; set; }
        // the user's name
        public string? Name { get; set; }
        // if the user is the professor or not
        public bool IsProfessor { get; set; }
    }
}
