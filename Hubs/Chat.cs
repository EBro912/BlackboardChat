using Microsoft.AspNetCore.SignalR;

namespace BlackboardChat.Hubs
{
    public class Chat : Hub
    {
        public async Task SendMessage(string message)
        {
            await Clients.All.SendAsync("ReceiveMessage", message);
        }
    }
}
