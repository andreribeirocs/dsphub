import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, Subject, BehaviorSubject } from "rxjs";
import { map, catchError } from "rxjs/operators";
import { of } from "rxjs";
import {
  WhatsAppMessage,
  WhatsAppConversation,
  MessageStatus,
  WhatsAppTemplate,
} from "./whatsapp.model";
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class WhatsAppService {
  private readonly API_BASE_URL = environment.apiUrl + "/whatsapp";

  private messageSubject = new Subject<WhatsAppMessage>();
  private statusUpdateSubject = new Subject<{
    messageId: string;
    status: MessageStatus;
  }>();
  private connectionSubject = new BehaviorSubject<
    "connected" | "disconnected" | "connecting"
  >("disconnected");

  constructor(private http: HttpClient) {}

  // Health check to verify backend connection
  connect(): Observable<"connected" | "disconnected" | "connecting"> {
    this.connectionSubject.next("connecting");

    return this.healthCheck().pipe(
      map(() => {
        this.connectionSubject.next("connected");
        return "connected" as const;
      }),
      catchError(() => {
        this.connectionSubject.next("disconnected");
        return of("disconnected" as const);
      })
    );
  }

  disconnect(): void {
    this.connectionSubject.next("disconnected");
  }

  // Send WhatsApp message via backend API (with automatic template handling)
  sendMessage(to: string, body: string): Observable<WhatsAppMessage> {
    const url = `${this.API_BASE_URL}/send`;
    const payload = { to, body };

    return this.http
      .post<{ success: boolean; message: WhatsAppMessage }>(url, payload)
      .pipe(
        map((response) => {
          if (response.success) {
            return response.message;
          } else {
            throw new Error("Failed to send message");
          }
        }),
        catchError((error) => {
          console.error("Error sending message:", error);
          throw error;
        })
      );
  }

  // Send template message to initiate conversation
  sendTemplateMessage(to: string): Observable<WhatsAppMessage> {
    const url = `${this.API_BASE_URL}/send-template`;
    const payload = { to };

    return this.http
      .post<{ success: boolean; message: WhatsAppMessage }>(url, payload)
      .pipe(
        map((response) => {
          if (response.success) {
            return response.message;
          } else {
            throw new Error("Failed to send template message");
          }
        }),
        catchError((error) => {
          console.error("Error sending template message:", error);
          throw error;
        })
      );
  }

  // Send quick message template
  sendQuickMessage(
    to: string,
    template: "greeting" | "availability" | "document_reminder" | "thank_you"
  ): Observable<WhatsAppMessage> {
    const url = `${this.API_BASE_URL}/quick-message`;
    const payload = { to, template };

    return this.http
      .post<{ success: boolean; message: WhatsAppMessage }>(url, payload)
      .pipe(
        map((response) => {
          if (response.success) {
            return response.message;
          } else {
            throw new Error("Failed to send quick message");
          }
        }),
        catchError((error) => {
          console.error("Error sending quick message:", error);
          throw error;
        })
      );
  }

  // Get all conversations from backend
  getConversations(): Observable<WhatsAppConversation[]> {
    const url = `${this.API_BASE_URL}/conversations`;

    return this.http
      .get<{ success: boolean; conversations: WhatsAppConversation[] }>(url)
      .pipe(
        map((response) => {
          if (response.success) {
            return response.conversations;
          } else {
            throw new Error("Failed to fetch conversations");
          }
        }),
        catchError((error) => {
          console.error("Error fetching conversations:", error);
          throw error;
        })
      );
  }

  // Get specific conversation
  getConversation(phoneNumber: string): Observable<WhatsAppConversation> {
    const url = `${this.API_BASE_URL}/conversations/${phoneNumber}`;

    return this.http
      .get<{ success: boolean; conversation: WhatsAppConversation }>(url)
      .pipe(
        map((response) => {
          if (response.success) {
            return response.conversation;
          } else {
            throw new Error("Conversation not found");
          }
        }),
        catchError((error) => {
          console.error("Error fetching conversation:", error);
          throw error;
        })
      );
  }

  // Mark conversation as read
  markConversationAsRead(phoneNumber: string): Observable<void> {
    const url = `${this.API_BASE_URL}/conversations/${phoneNumber}/read`;

    return this.http.post<{ success: boolean; message: string }>(url, {}).pipe(
      map((response) => {
        if (response.success) {
          return;
        } else {
          throw new Error("Failed to mark conversation as read");
        }
      }),
      catchError((error) => {
        console.error("Error marking conversation as read:", error);
        throw error;
      })
    );
  }

  // Delete conversation
  deleteConversation(phoneNumber: string): Observable<void> {
    const url = `${this.API_BASE_URL}/conversations/${phoneNumber}`;

    return this.http.delete<{ success: boolean; message: string }>(url).pipe(
      map((response) => {
        if (response.success) {
          return;
        } else {
          throw new Error("Failed to delete conversation");
        }
      }),
      catchError((error) => {
        console.error("Error deleting conversation:", error);
        throw error;
      })
    );
  }

  // Join conversation room for real-time updates (placeholder for future WebSocket implementation)
  joinConversationRoom(phoneNumber: string): void {
    console.log(`Would join conversation room for ${phoneNumber}`);
  }

  // Leave conversation room (placeholder for future WebSocket implementation)
  leaveConversationRoom(phoneNumber: string): void {
    console.log(`Would leave conversation room for ${phoneNumber}`);
  }

  // Start typing indicator (placeholder for future WebSocket implementation)
  startTyping(phoneNumber: string): void {
    console.log(`Would start typing indicator for ${phoneNumber}`);
  }

  // Stop typing indicator (placeholder for future WebSocket implementation)
  stopTyping(phoneNumber: string): void {
    console.log(`Would stop typing indicator for ${phoneNumber}`);
  }

  // Listen for incoming messages
  onMessageReceived(): Observable<WhatsAppMessage> {
    return this.messageSubject.asObservable();
  }

  // Listen for message status updates
  onMessageStatusUpdate(): Observable<{
    messageId: string;
    status: MessageStatus;
  }> {
    return this.statusUpdateSubject.asObservable();
  }

  // Get connection status
  getConnectionStatus(): Observable<
    "connected" | "disconnected" | "connecting"
  > {
    return this.connectionSubject.asObservable();
  }

  // Get message templates
  getMessageTemplates(): Observable<WhatsAppTemplate[]> {
    // TODO: Implement backend endpoint for message templates
    // For now, return empty array until backend endpoint is created
    return of([]);
  }

  // Health check
  healthCheck(): Observable<{
    success: boolean;
    status: string;
    service: string;
  }> {
    const url = `${this.API_BASE_URL}/health`;

    return this.http.get<{ success: boolean; status: string; service: string }>(
      url
    );
  }
}
