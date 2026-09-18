// src/app/features/recruitment/recruitment.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { RecruitmentWorkflowService, WorkflowStage, WorkflowSummary } from './workflow/recruitment-workflow.service';
import { apiErrorMessage } from '../../shared/utils/api-error';

@Component({
  selector: 'app-recruitment',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './recruitment.component.html',
})
export class RecruitmentComponent {
  private readonly workflow = inject(RecruitmentWorkflowService);
  readonly summary = signal<WorkflowSummary | null>(null);
  readonly error = signal('');
  constructor() { this.load(); }
  load(): void {
    this.error.set('');
    this.workflow.summary().subscribe({ next: value => this.summary.set(value), error: error => this.error.set(apiErrorMessage(error, 'Could not load recruitment statistics.')) });
  }
  count(stage: string): number | null {
    const summary = this.summary();
    return summary ? stage === 'leads' ? summary.statistics.leads : summary.stages[stage as Exclude<WorkflowStage, 'leads'>] : null;
  }
  recruitmentSteps = [
    {
      stage: 'leads',
      title: 'Lead Generation',
      description: 'Upload an Indeed export or a CSV / Excel file of leads',
      icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
    },
    {
      stage: 'contact',
      title: 'Initial Contact',
      description: 'Select contacts and send registration links by WhatsApp or email',
      icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
    },
    {
      stage: 'documents',
      title: 'Document Collection',
      description: 'Review submitted documents and resolve flagged applications',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    },
    {
      stage: 'background',
      title: 'Background Check',
      description: 'See pending, rejected and passed background checks',
      icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    },
    {
      stage: 'classroom',
      title: 'Classroom',
      description: 'Manage candidates ready for training, scheduled or completed',
      icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z',
    },
    {
      stage: 'ride-along',
      title: 'Ride Along',
      description: 'Schedule ride along, activate the driver and archive the application',
      icon: 'M17 8l4 4m0 0l-4 4m4-4H3',
    },
  ];
}
