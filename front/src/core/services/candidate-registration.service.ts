import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../environments/environment";

export interface TokenValidationResponse {
  candidateId: string;
  name: string;
  phone: string;
  alreadyCompleted: boolean;
  status?: string;
  completedAt?: string;
}

export interface CompleteRegistrationRequest {
  token: string;
  email?: string;
  dateOfBirth: string;
  address: string;
  postalCode: string;
  citizenship?: string;
  documentNumber?: string;
  insuranceNumber: string;
  driverLicense: string;
  driverLicenseExpiry: string;
  passportVisaExpiry?: string;
  rtwExpiry?: string;
  points?: number;
  nextDVLA?: string;
  sla?: string;
  account?: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  driverLicenseImage: string;
  insuranceImage: string;
  addressProofImage: string;
  passportImage?: string;
  rightToWorkImage?: string;
  comments?: string;
}

export interface CompleteRegistrationResponse {
  id: string;
  name: string;
  email?: string;
  phoneNumber: string;
  status: string;
  address: string;
  insuranceNumber: string;
  driverLicense: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  message: string;
  documentsUploaded: number;
}

@Injectable({
  providedIn: "root",
})
export class CandidateRegistrationService {
  private readonly API_URL = `${environment.apiUrl}/recruitment`;
  private http = inject(HttpClient);

  validateToken(token: string): Observable<TokenValidationResponse> {
    return this.http.get<TokenValidationResponse>(
      `${this.API_URL}/validate-token/${token}`
    );
  }

  completeRegistration(
    data: CompleteRegistrationRequest
  ): Observable<CompleteRegistrationResponse> {
    return this.http.post<CompleteRegistrationResponse>(
      `${this.API_URL}/complete-registration`,
      data
    );
  }
}
