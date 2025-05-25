import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WhatsAppMessage } from './whatsapp.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/whatsapp',
})
export class WhatsAppGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('WhatsAppGateway');

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    client.emit('connection_status', 'connected');
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_room')
  handleJoinRoom(
    @MessageBody() data: { phoneNumber: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `conversation_${data.phoneNumber}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room: ${room}`);
    client.emit('room_joined', { room });
  }

  @SubscribeMessage('leave_room')
  handleLeaveRoom(
    @MessageBody() data: { phoneNumber: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `conversation_${data.phoneNumber}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} left room: ${room}`);
    client.emit('room_left', { room });
  }

  @SubscribeMessage('typing_start')
  handleTypingStart(
    @MessageBody() data: { phoneNumber: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `conversation_${data.phoneNumber}`;
    client.to(room).emit('user_typing', { phoneNumber: data.phoneNumber });
  }

  @SubscribeMessage('typing_stop')
  handleTypingStop(
    @MessageBody() data: { phoneNumber: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `conversation_${data.phoneNumber}`;
    client
      .to(room)
      .emit('user_stopped_typing', { phoneNumber: data.phoneNumber });
  }

  // Emit new message to all connected clients
  emitMessage(message: WhatsAppMessage) {
    this.server.emit('new_message', message);
    this.logger.log(`Emitted new message: ${message.id}`);
  }

  // Emit message status update
  emitStatusUpdate(update: { messageId: string; status: string }) {
    this.server.emit('message_status_update', update);
    this.logger.log(`Emitted status update for message: ${update.messageId}`);
  }

  // Emit conversation update
  emitConversationUpdate(conversation: { id: string; [key: string]: any }) {
    this.server.emit('conversation_update', conversation);
    this.logger.log(`Emitted conversation update: ${conversation.id}`);
  }

  // Emit to specific conversation room
  emitToConversation(phoneNumber: string, event: string, data: any) {
    const room = `conversation_${phoneNumber}`;
    this.server.to(room).emit(event, data);
    this.logger.log(`Emitted ${event} to room: ${room}`);
  }

  // Broadcast connection status
  broadcastConnectionStatus(
    status: 'connected' | 'disconnected' | 'connecting',
  ) {
    this.server.emit('connection_status', status);
    this.logger.log(`Broadcasted connection status: ${status}`);
  }
}
