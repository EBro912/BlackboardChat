using Microsoft.Data.Sqlite;
using Dapper;
using BlackboardChat.Data;

namespace BlackboardChat
{
    // handles all database related functionality
    public class Database
    {
        private static readonly string name = "Data Source=BlackboardChat.sqlite";

        // create all required tables on startup
        public static async void Setup()
        {
            using var connection = new SqliteConnection(name);
            // create the Users table if it doesn't already exist
            connection.Execute("CREATE TABLE IF NOT EXISTS Users ("
                + "Id INTEGER PRIMARY KEY,"
                + "Name VARCHAR(100) UNIQUE NOT NULL,"
                + "IsProfessor TINYINT NOT NULL," 
                + "IsGloballyMuted TINYINT(1) NOT NULL DEFAULT 0);");

            // create the Messages table if it doesn't already exist
            connection.Execute("CREATE TABLE IF NOT EXISTS Messages ("
                + "Id INTEGER PRIMARY KEY,"
                + "Channel INT NOT NULL,"
                + "Author INT NOT NULL,"
                // leave some extra character space just in case
                + "Content VARCHAR(1010) NOT NULL,"
                + "TimeStamp DATETIME NOT NULL,"
                + "IsDeleted TINYINT(1) NOT NULL);");

            // create the Channels table if it doesn't already exist
            connection.Execute("CREATE TABLE IF NOT EXISTS Channels ("
                + "Id INTEGER PRIMARY KEY,"
                + "Name VARCHAR(50) UNIQUE NOT NULL,"
                + "IsForum TINYINT NOT NULL,"
                // this character limit should never be reached but give plenty of room just in case
                + "Members VARCHAR(10000) NOT NULL);");

            // removes all existing channels for testing purposes
            // comment this out if you want to keep the channels made
            connection.Execute("DELETE FROM Channels");

            // removes all existing messages for testing purposes
            // comment this out if you want to keep the messages sent
            connection.Execute("DELETE FROM Messages");

            // if the default channel doesn't exist, add it to the databsae
            // we can shortcut here since we know how big our class is and their ids
            // realistically everyone would have to be dynamically added
            connection.Execute("INSERT OR IGNORE INTO Channels (Name, IsForum, Members)" +
                "VALUES ('open-chat', 0, '1,2,3,4,5,6,7,8,9,10,11');");

            if ((await GetAllUsers()).Count() < 11)
            {
                await AddDummyUsers();
            }
        }

        // adds a user to the database
        // in the real world, the program would use blackboard's database for users
        // but we can use this to make dummy users
        public static async Task AddUser(string username, bool isProfessor)
        {
            using var connection = new SqliteConnection(name);
            var parameters = new { Name = username, IsProfessor = isProfessor };
            await connection.ExecuteAsync("INSERT INTO Users (Name, IsProfessor)" +
                "VALUES (@Name, @IsProfessor);", parameters);
        }

        // inserts a message into the database
        public static async Task AddMessage(int channel, int author, string? content, DateTime timestamp)
        {
            using var connection = new SqliteConnection(name);
            var parameters = new { Channel = channel, Author = author, Content = content, TimeStamp = timestamp };
            await connection.ExecuteAsync("INSERT INTO Messages (Channel, Author, Content, TimeStamp, IsDeleted)" +
                "VALUES (@Channel, @Author, @Content, @TimeStamp, 0);", parameters);
        }

        // inserts a new channel into the database
        public static async Task AddChannel(string? channelName, bool isForum, string? members)
        {
            using var connection = new SqliteConnection(name);
            var parameters = new { Name = channelName, IsForum = isForum, Members = members };
            await connection.ExecuteAsync("INSERT INTO Channels (Name, IsForum, Members)" +
                "VALUES (@Name, @IsForum, @Members);", parameters);
        }

        // gets a user's most recent message
        public static async Task<Message> GetMostRecentMessage(int authorId)
        {
            using var connection = new SqliteConnection(name);
            var parameters = new { Author = authorId };
            return await connection.QueryFirstOrDefaultAsync<Message>("SELECT * FROM Messages WHERE Author = @Author ORDER BY TimeStamp DESC LIMIT 1", parameters);
        }

        public static async Task SetMessageAsDeleted(int id)
        {
            using var connection = new SqliteConnection(name);
            var parameters = new { Id = id };
            await connection.ExecuteAsync("UPDATE Messages SET IsDeleted = 1 WHERE rowid = @Id", parameters);
        }

        public static async Task ResetMutes()
        {
            using var connection = new SqliteConnection(name);
            await connection.ExecuteAsync("UPDATE Users SET IsGloballyMuted = 0");
        }

        public static async Task SetUserAsGloballyMuted(int userId)
        {
            using var connection = new SqliteConnection(name);
            var parameters = new { Id = userId };
            await connection.ExecuteAsync("UPDATE Users SET IsGloballyMuted = 1 WHERE rowid = @Id", parameters);
        }


        // gets a channel's information by its name
        public static async Task<Channel> GetChannelByName(string channelName)
        {
            using var connection = new SqliteConnection(name);
            var parameters = new { Name = channelName };
            return await connection.QueryFirstOrDefaultAsync<Channel>("SELECT * FROM Channels WHERE Name = @Name", parameters);
        }

        // search for a user by their id
        public static async Task<User> GetUserById(int id)
        {
            using var connection = new SqliteConnection(name);
            var parameters = new { Id = id };
            return await connection.QueryFirstOrDefaultAsync<User>("SELECT * FROM Users WHERE rowid = @Id", parameters);
        }

        // search for a user by their name
        public static async Task<User> GetUserByName(string userName)
        {
            using var connection = new SqliteConnection(name);
            var parameters = new { Name = userName };
            return await connection.QueryFirstOrDefaultAsync<User>("SELECT * FROM Users WHERE Name = @Name", parameters);
        }

        // search for a channel by its id
        public static async Task<Channel> GetChannelById(int id)
        {
            using var connection = new SqliteConnection(name);
            var parameters = new { Id = id };
            return await connection.QueryFirstOrDefaultAsync<Channel>("SELECT * FROM Channels WHERE rowid = @Id", parameters);
        }

        // get the professor from the database
        // this assumes that only one user (the professor) will have the IsProfessor boolean set to true
        public static async Task<User> GetProfessor()
        {
            using var connection = new SqliteConnection(name);
            return await connection.QueryFirstOrDefaultAsync<User>("SELECT * FROM Users WHERE IsProfessor = 1");
        }

        // returns all users from the database
        public static async Task<IEnumerable<User>> GetAllUsers()
        {
            using var connection = new SqliteConnection(name);
            return await connection.QueryAsync<User>("SELECT * FROM Users");
        }

        // returns all channels from the database
        public static async Task<IEnumerable<Channel>> GetAllChannels()
        {
            using var connection = new SqliteConnection(name);
            // exclude the default open-chat channel since it's already there
            return await connection.QueryAsync<Channel>("SELECT * FROM Channels WHERE Name != 'open-chat'");
        }

        // returns all messages from the database in a certain channel
        public static async Task<IEnumerable<Message>> GetAllMessagesFromChannel(int id)
        {
            using var connection = new SqliteConnection(name);
            var parameters = new { Id = id };
            return await connection.QueryAsync<Message>("SELECT * FROM Messages WHERE Channel = @Id", parameters);
        }

        public static async Task DeleteChannel(int id)
        {
            using var connection = new SqliteConnection(name);
            var parameters = new { Id = id };
            await connection.ExecuteAsync("DELETE FROM Channels WHERE rowid = @Id", parameters);
        }

        public static async Task DeleteMessagesInChannel(int id)
        {
            using var connection = new SqliteConnection(name);
            var parameters = new { Id = id };
            await connection.ExecuteAsync("DELETE FROM Messages WHERE Channel = @Id", parameters);
        }

        public static async Task UpdateChannelMembers(int id, string members)
        {
            using var connection = new SqliteConnection(name);
            var parameters = new { Id = id, Members = members };
            await connection.ExecuteAsync("UPDATE Channels SET Members = @Members WHERE rowid = @Id", parameters);
        }

        // creates a dummy class list with one professor and 10 students
        public static async Task AddDummyUsers()
        {
            await AddUser("Professor Jim", true);
            await AddUser("Bob Jones", false);
            await AddUser("Steve Carson", false);
            await AddUser("Amanda White", false);
            await AddUser("Alex Smith", false);
            await AddUser("Samantha Wallace", false);
            await AddUser("Peter McCall", false);
            await AddUser("Joe Peterson", false);
            await AddUser("Ariana Larson", false);
            await AddUser("Hannah Cooper", false);
            await AddUser("James Walker", false);
        }
    }
}
