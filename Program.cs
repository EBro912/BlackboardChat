/*
 * Libraries used:
 * Microsoft.Data.Sqlite
 * Dapper
 */

using BlackboardChat;
using BlackboardChat.Hubs;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorPages();
builder.Services.AddSignalR();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

app.UseAuthorization();

app.MapRazorPages();
app.MapHub<Server>("/chat");

Database.Setup();

// ***IMPORTANT***
// please only uncomment this if your database doesn't have any dummy users
// and you need to create them
// after creating the dummy users, make sure to recomment this line!

//await Database.AddDummyUsers();

app.Run();
