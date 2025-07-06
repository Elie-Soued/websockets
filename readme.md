### Overview

This is the implementation of the websocket protocol.


#### Run the application


1. Make sure you have NodeJS installed on your system
2. Clone the project

```bash
git clone https://github.com/Elie-Soued/websockets.git
```

3. Navigate to `/server`and run the script by doing `node websocketServer.js`

4. Navigate ot `/client`and run the script by doing `node websocketClient.js`



#### What to expect

In your client terminal, you should see :

```
sent to the server : Hello server! I am the client :)
coming from the server:   Hey client, what's up bro? I am the server
```

In your server terminal you should see:

```
server running on port 8081
coming from the client:  Hello server! I am the client :)
sent to the client:   Hey client, what's up bro? I am the server

```


#### The Goal

The goal of this project is to make sure both the client and the server can send and receive messages.




