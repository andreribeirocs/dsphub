// src/app/features/recruitment/candidates/candidates.service.ts
import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../../environments/environment";

export interface CandidateDocuments {
  passportImage?: string; // base64 encoded image
  driverLicenseImage?: string; // base64 encoded image
  insuranceNumberImage?: string; // base64 encoded image
  addressProofImage?: string; // base64 encoded image
  medicalCertificate?: string; // base64 encoded image
  trainingCertificate?: string; // base64 encoded image
  tlcLicenseImage?: string; // base64 encoded image
  socialSecurityImage?: string; // base64 encoded image
  birthCertificateImage?: string; // base64 encoded image
  vehicleRegistrationImage?: string; // base64 encoded image
  vehicleInsuranceImage?: string; // base64 encoded image

  // Structured additional data from registration process
  additionalData?: {
    postalCode?: string;
    dateOfBirth?: string;
    emergencyContact?: {
      name?: string;
      phone?: string;
      relationship?: string;
    };
    driverLicenseExpiry?: string;
    // Allow for additional fields that might be added
    [key: string]: unknown;
  };

  // Allow for additional document types
  [key: string]: string | object | undefined;
}

export interface Candidate {
  id: string;
  name: string;
  phoneNumber: string;
  status: string;
  email?: string;
  source?: string;
  notes?: string;
  address?: string;

  // Personal Information
  dateOfBirth?: string;
  age?: number;
  citizenship?: string;

  // Address Information
  postalCode?: string;

  // Document Information
  documentNumber?: string;
  insuranceNumber?: string;
  insuranceNumberImage?: string;
  driverLicense?: string;
  driverLicenseImage?: string;
  addressProofImage?: string;

  // Expiry Dates
  passportVisaExpiry?: string;
  rtwExpiry?: string;
  licenceExpiry?: string;

  // DVLA Information
  points?: number;
  nextDVLA?: string;

  // System Fields
  lastCheck?: string;
  lastCheckOn?: string;

  // Agreement Information
  sla?: string;
  account?: string;
  formCompleted?: boolean;

  // Document Storage
  documents?: CandidateDocuments; // Updated to use proper interface
  documentsCount?: number;

  // Driver-specific fields from payload
  driverId?: string;
  tlcLicense?: string;
  vehicleId?: string;
  routeId?: string;
  signUpDate?: string;
  startWorkingDate?: string;
  lastWorkingDate?: string;
  isActive?: boolean;
  onboardingCompleted?: boolean;
  backgroundCheckStatus?: string;
  backgroundCheckDate?: string;
  tlcLicenseExpiry?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;

  // Vehicle information
  vehicle?: {
    id: string;
    plateNumber: string;
    model?: string;
    year?: number;
    color?: string;
    vin?: string;
    registrationExpiry?: string;
    insuranceExpiry?: string;
    inspectionExpiry?: string;
    isActive?: boolean;
  };

  // Route information
  route?: {
    id: string;
    name: string;
    description?: string;
    startLocation?: string;
    endLocation?: string;
    estimatedDuration?: number;
    isActive?: boolean;
  };

  // Financial information
  payRate?: number;
  payType?: string; // 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY'
  totalEarnings?: number;
  lastPayDate?: string;

  // Performance metrics
  totalTrips?: number;
  averageRating?: number;
  onTimePercentage?: number;
  incidentCount?: number;

  // Additional driver documents
  medicalCertificate?: string;
  medicalCertificateExpiry?: string;
  drugTestResult?: string;
  drugTestDate?: string;
  trainingCertificate?: string;
  trainingCompletionDate?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CreateCandidateDto {
  name: string;
  phoneNumber: string;
  email?: string;
  source?: string;
}

export interface SendSmsDto {
  candidateId: string;
}

export interface UpdateCandidateDto {
  name?: string;
  phoneNumber?: string;
  email?: string;
  status?: string;
  source?: string;
  address?: string;
  insuranceNumber?: string;
  insuranceNumberImage?: string;
  driverLicense?: string;
  driverLicenseImage?: string;
  addressProofImage?: string;
  notes?: string;

  // Driver-specific updates
  tlcLicense?: string;
  vehicleId?: string;
  routeId?: string;
  signUpDate?: string;
  startWorkingDate?: string;
  lastWorkingDate?: string;
  isActive?: boolean;
  onboardingCompleted?: boolean;
  backgroundCheckStatus?: string;
  backgroundCheckDate?: string;
  tlcLicenseExpiry?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;

  // Personal Information updates
  dateOfBirth?: string;
  age?: number;
  citizenship?: string;
  postalCode?: string;
  documentNumber?: string;

  // Expiry Dates updates
  passportVisaExpiry?: string;
  rtwExpiry?: string;
  licenceExpiry?: string;

  // DVLA Information updates
  points?: number;
  nextDVLA?: string;

  // System Fields updates
  lastCheck?: string;
  formCompleted?: boolean;

  // Agreement Information updates
  sla?: string;
  account?: string;

  // Financial updates
  payRate?: number;
  payType?: string;

  // Additional documents
  medicalCertificate?: string;
  medicalCertificateExpiry?: string;
  drugTestResult?: string;
  drugTestDate?: string;
  trainingCertificate?: string;
  trainingCompletionDate?: string;
}

@Injectable({
  providedIn: "root",
})
export class CandidatesService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/recruitment`;

  getCandidates(): Observable<Candidate[]> {
    return this.http.get<Candidate[]>(`${this.API_URL}/candidates`);
  }

  getCandidateById(id: string): Observable<Candidate> {
    return this.http.get<Candidate>(`${this.API_URL}/candidates/${id}`);
  }

  createCandidate(candidate: CreateCandidateDto): Observable<Candidate> {
    return this.http.post<Candidate>(`${this.API_URL}/candidates`, candidate);
  }

  updateCandidate(
    id: string,
    candidate: UpdateCandidateDto
  ): Observable<Candidate> {
    return this.http.patch<Candidate>(
      `${this.API_URL}/candidates/${id}`,
      candidate
    );
  }

  deleteCandidate(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/candidates/${id}`);
  }

  sendSms(
    candidateId: string
  ): Observable<{ message: string; success: boolean }> {
    return this.http.post<{ message: string; success: boolean }>(
      `${this.API_URL}/send-sms`,
      { candidateId }
    );
  }
}
