﻿using Microsoft.Data.Sqlite;
using Dapper;
using BlackboardChat.Data;

namespace BlackboardChat
{
    // handles all database related functionality
    public class Database
    {
        private static readonly string name = "Data Source=BlackboardChat.sqlite";
        
        // create all required tables on startup
        public static void Setup()
        {
            using var connection = new SqliteConnection(name);
            // create the Users table if it doesn't already exist
            connection.Execute("CREATE TABLE IF NOT EXISTS Users ("
                + "Name VARCHAR(100) NOT NULL,"
                + "IsProfessor TINYINT NOT NULL);");

            // create the Messages table if it doesn't already exist
            connection.Execute("CREATE TABLE IF NOT EXISTS Messages ("
                + "Channel INT NOT NULL,"
                + "Author INT NOT NULL,"
                // leave some extra character space just in case
                + "Content VARCHAR(1010) NOT NULL,"
                + "TimeStamp DATETIME NOT NULL);");

            // create the Channels table if it doesn't already exist
            connection.Execute("CREATE TABLE IF NOT EXISTS Channels ("
                + "Name VARCHAR(50) NOT NULL,"
                + "IsForum TINYINT NOT NULL,"
                // this character limit should never be reached but give plenty of room just in case
                + "Members VARCHAR(10000) NOT NULL);");
        }

        // adds a user to the database
        // in the real world, the program would use blackboard's database for users
        // but we can use this to make dummy users
        public static async Task AddUser(string name, bool isProfessor)
        {
            using var connection = new SqliteConnection(name);
            var parameters = new { Name = name, IsProfessor = isProfessor };
            await connection.ExecuteAsync("INSERT INTO Users (Name, IsProfessor)" +
                "VALUES (@Name, @IsProfessor);", parameters);
        }

        // inserts a message into the database
        public static async Task AddMessage(int channel, int author, string? content, DateTime timestamp)
        {
            using var connection = new SqliteConnection(name);
            var parameters = new { Channel = channel, Author = author, Content = content, TimeStamp = timestamp };
            await connection.ExecuteAsync("INSERT INTO Messages (Channel, Author, Content, TimeStamp)" +
                "VALUES (@Channel, @Author, @Content, @TimeStamp);", parameters);
        }

        // inserts a new channel into the database
        public static async Task AddChannel(string? name, bool isForum, string? members)
        {
            using var connection = new SqliteConnection(name);
            var parameters = new { Name = name, IsForum = isForum, Members = members };
            await connection.ExecuteAsync("INSERT INTO Channels (Name, IsForum, Members)" +
                "VALUES (@Name, @IsForum, @Members);", parameters);
        }

        // search for a user by their id
        public static async Task<User> GetUserById(int id)
        {
            using var connection = new SqliteConnection(name);
            var parameters = new { Id = id };
            return await connection.QuerySingleAsync<User>("SELECT * FROM Users WHERE rowid = @Id", id);
        }

        // get the professor from the database
        // this assumes that only one user (the professor) will have the IsProfessor boolean set to true
        public static async Task<User> GetProfessor()
        {
            using var connection = new SqliteConnection(name);
            return await connection.QuerySingleAsync<User>("SELECT * FROM Users WHERE IsProfessor = 1");
        }

        // returns all users from the database
        public static async Task<IEnumerable<User>> GetAllUsers()
        {
            using var connection = new SqliteConnection(name);
            return await connection.QueryAsync<User>("SELECT * FROM Users");
        }

        // returns all messages from the database in a certain channel
        public static async Task<IEnumerable<Message>> GetAllMessagesFromChannel(int id)
        {
            using var connection = new SqliteConnection(name);
            var parameters = new { Id = id };
            return await connection.QueryAsync<Message>("SELECT * FROM Messages WHERE Channel = @Id", parameters);
        }
    }
}
