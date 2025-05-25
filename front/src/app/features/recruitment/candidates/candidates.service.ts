// src/app/features/recruitment/candidates/candidates.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface Candidate {
  id: string;
  name: string;
  phoneNumber: string;
  status: string;
  email?: string;
  source?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCandidateDto {
  name: string;
  phoneNumber: string;
}

export interface SendSmsDto {
  candidateId: string;
}

@Injectable({
  providedIn: 'root',
})
export class CandidatesService {
  private readonly API_URL = `${environment.apiUrl}/recruitment`;

  constructor(private http: HttpClient) {}

  getCandidates(): Observable<Candidate[]> {
    return this.http.get<Candidate[]>(`${this.API_URL}/candidates`);
  }

  createCandidate(candidate: CreateCandidateDto): Observable<Candidate> {
    return this.http.post<Candidate>(`${this.API_URL}/candidates`, candidate);
  }

  sendSms(candidateId: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/send-sms`, { candidateId });
  }
}
