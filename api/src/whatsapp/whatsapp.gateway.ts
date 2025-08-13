import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { WhatsAppMessage } from "./whatsapp.service";

// Get allowed origins from environment or use secure defaults
const getAllowedOrigins = (): string | string[] => {
  if (process.env.CORS_ORIGIN) {
    return process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim());
  }

  // Development defaults only in non-production
  if (process.env.NODE_ENV !== "production") {
    return ["http://localhost:4200", "http://localhost:3000"];
  }

  // No origins allowed in production without explicit configuration
  return [];
};

@WebSocketGateway({
  cors: {
    origin: getAllowedOrigins(),
    credentials: true,
    methods: ["GET", "POST"],
  },
  namespace: "/whatsapp",
})
export class WhatsAppGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger("WhatsAppGateway");

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    client.emit("connection_status", "connected");
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage("join_room")
  handleJoinRoom(
    @MessageBody() data: { phoneNumber: string },
    @ConnectedSocket() client: Socket
  ): void {
    const room = `conversation_${data.phoneNumber}`;
    void client.join(room);
    this.logger.log(`Client ${client.id} joined room: ${room}`);
    client.emit("room_joined", { room });
  }

  @SubscribeMessage("leave_room")
  handleLeaveRoom(
    @MessageBody() data: { phoneNumber: string },
    @ConnectedSocket() client: Socket
  ): void {
    const room = `conversation_${data.phoneNumber}`;
    void client.leave(room);
    this.logger.log(`Client ${client.id} left room: ${room}`);
    client.emit("room_left", { room });
  }

  @SubscribeMessage("typing_start")
  handleTypingStart(
    @MessageBody() data: { phoneNumber: string },
    @ConnectedSocket() client: Socket
  ) {
    const room = `conversation_${data.phoneNumber}`;
    client.to(room).emit("user_typing", { phoneNumber: data.phoneNumber });
  }

  @SubscribeMessage("typing_stop")
  handleTypingStop(
    @MessageBody() data: { phoneNumber: string },
    @ConnectedSocket() client: Socket
  ) {
    const room = `conversation_${data.phoneNumber}`;
    client
      .to(room)
      .emit("user_stopped_typing", { phoneNumber: data.phoneNumber });
  }

  // Emit new message to all clients in conversation room
  emitNewMessage(phoneNumber: string, message: WhatsAppMessage): void {
    const room = `conversation_${phoneNumber}`;
    this.server.to(room).emit("new_message", message);
    this.logger.debug(`Emitted new message to room: ${room}`);
  }

  // Emit message status update to all clients in conversation room
  emitMessageStatusUpdate(
    phoneNumber: string,
    messageId: string,
    status: string
  ): void {
    const room = `conversation_${phoneNumber}`;
    this.server.to(room).emit("message_status_update", { messageId, status });
    this.logger.debug(
      `Emitted status update for message ${messageId} to room: ${room}`
    );
  }

  // Emit conversation update to all clients
  emitConversationUpdate(phoneNumber: string): void {
    const room = `conversation_${phoneNumber}`;
    this.server.to(room).emit("conversation_update", { phoneNumber });
    this.logger.debug(`Emitted conversation update to room: ${room}`);
  }

  // Emit to specific conversation room
  emitToConversation(phoneNumber: string, event: string, data: any) {
    const room = `conversation_${phoneNumber}`;
    this.server.to(room).emit(event, data);
    this.logger.log(`Emitted ${event} to room: ${room}`);
  }

  // Broadcast connection status
  broadcastConnectionStatus(
    status: "connected" | "disconnected" | "connecting"
  ) {
    this.server.emit("connection_status", status);
    this.logger.log(`Broadcasted connection status: ${status}`);
  }
}
