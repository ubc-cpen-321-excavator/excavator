import { createApp } from './app';
import { env } from './config/env';
import https from 'https';
import fs from "node:fs";

// import WebSocket, {WebSocketServer} from "ws";

const app = createApp();


// Readd the code below later once we implement HTTPS

// const server = https
//     .createServer(
//         {
//             key: fs.readFileSync("secrets/m1_ec2_key.pem"),
//             cert: fs.readFileSync("secrets/m1_ec2_cert.pem")
//         }
//         ,app
//     )
//     .listen(env.port, () => {
//       console.log(`Server listening on ${env.port}\nLink: https://localhost:${env.port}`);
//     })

const server = app.listen(env.port, () => {
    console.log(`Server listening on ${env.port}\nLink: http://localhost:${env.port}`);
})

// No websockets are needed for CP1, if needed later, this snippet will stay here but commented

// Websocket code
// Might need to refactor this later
// const wsServer = new WebSocketServer({server:server});
// const socket = new WebSocket("wss://8.229.22.124")
//
// wsServer.on("connection", (websocket) => {
//
//     socket.onmessage = (message) => {
//         websocket.send(message.data.toString());
//     }
//
// })


for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      process.exit(0);
    });
  });
}
